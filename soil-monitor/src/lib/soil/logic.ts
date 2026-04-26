import type {
  ActionItem,
  Counterfactual,
  CropProfile,
  Diagnosis,
  GapItem,
  GapStatus,
  MetricKey,
  PlanWeek,
  RiskLevel,
  Scenario,
  SoilMetrics,
} from "./types";
import { METRIC_LABELS } from "./data";

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function gapStatus(value: number, target: { min: number; max: number }): GapStatus {
  if (value < target.min) return "below";
  if (value > target.max) return "above";
  return "ready";
}

function severityFor(value: number, target: { min: number; max: number }): number {
  if (value >= target.min && value <= target.max) return 0;
  const span = Math.max(target.max - target.min, 0.0001);
  const dist = value < target.min ? target.min - value : value - target.max;
  return clamp(dist / span, 0, 1.5) / 1.5;
}

export function diagnose(
  metrics: SoilMetrics,
  crop: CropProfile,
  scenario: Scenario,
  daysToPlanting: number,
): Diagnosis {
  // Gaps
  const gaps: GapItem[] = (Object.keys(crop.targets) as MetricKey[]).map((key) => {
    const target = crop.targets[key];
    const value = metrics[key];
    const status = gapStatus(value, target);
    const severity = severityFor(value, target);
    return {
      key,
      label: METRIC_LABELS[key].label,
      unit: METRIC_LABELS[key].unit,
      value,
      target,
      status,
      severity,
    };
  });

  // Primary constraint = severity * sensitivity, max
  let primary: GapItem | null = null;
  let primaryScore = 0;
  for (const g of gaps) {
    const sens = crop.sensitivity[g.key] ?? 0.4;
    const score = g.severity * sens;
    if (score > primaryScore) {
      primaryScore = score;
      primary = g;
    }
  }

  // SBAI: composite of temp, moisture, CO2, OM, drainage, conductivity
  const sbai = computeSBAI(metrics);
  const sbaiBand: Diagnosis["sbaiBand"] =
    sbai >= 80 ? "excellent" : sbai >= 60 ? "good" : sbai >= 40 ? "moderate" : "low";

  // Trend classification on last vs first window
  const trend = scenario.trend;
  const head = trend.slice(0, 7).reduce((s, p) => s + p.co2, 0) / 7;
  const tail = trend.slice(-7).reduce((s, p) => s + p.co2, 0) / 7;
  const trendDelta = tail - head;
  const trendClass: Diagnosis["trendClass"] =
    trendDelta > 4 ? "improving" : trendDelta < -4 ? "declining" : "stable";

  // Readiness
  const totalSensitivity = gaps.reduce(
    (s, g) => s + (crop.sensitivity[g.key] ?? 0.4),
    0,
  );
  const weightedGap =
    gaps.reduce((s, g) => s + g.severity * (crop.sensitivity[g.key] ?? 0.4), 0) /
    Math.max(totalSensitivity, 0.001);
  let readiness = (1 - weightedGap) * 100;

  // Time penalty: too little prep hurts a lot; waiting too long also degrades
  // (biology windows pass, weeds rebound, amendments leach).
  const prepRatio = daysToPlanting / Math.max(crop.idealPrepDays, 1);
  if (prepRatio < 1) {
    // Up to -45 points when you have almost no prep time
    readiness -= (1 - prepRatio) * 45;
  } else if (prepRatio > 1.5) {
    // Linear decay past 1.5× ideal, capped at -25 by 4× ideal
    readiness -= Math.min(25, (prepRatio - 1.5) * 10);
  }

  // Trend bonus / penalty
  if (trendClass === "improving") readiness += 4;
  if (trendClass === "declining") readiness -= 6;

  readiness = clamp(Math.round(readiness), 0, 100);

  // Yield index — 100 baseline, scaled by readiness and SBAI
  const yieldIndex = Math.round(60 + readiness * 0.55 + (sbai - 50) * 0.25);

  // Risk — escalated when prep window is severely short OR way too early
  const severelyLate = prepRatio < 0.4;
  const wayTooEarly = prepRatio > 3;
  const risk: RiskLevel =
    primaryScore > 0.55 || readiness < 45 || severelyLate
      ? "high"
      : primaryScore > 0.3 || readiness < 70 || prepRatio < 0.7 || wayTooEarly
        ? "moderate"
        : "low";

  // Reasons
  const reasons: string[] = [];
  if (primary) {
    const dir = primary.status === "below" ? "below" : "above";
    reasons.push(
      `${primary.label} is ${dir} the target range — the binding constraint for ${crop.name}.`,
    );
  }
  if (trendClass === "declining") {
    reasons.push("Microbial respiration is trending down over the last 30 days.");
  }
  if (prepRatio < 0.5) {
    reasons.push(
      `Only ${daysToPlanting} days until planting — below the ${crop.idealPrepDays}-day ideal prep window.`,
    );
  }
  const otherBigGaps = gaps
    .filter((g) => g !== primary && g.severity > 0.4)
    .slice(0, 2);
  for (const g of otherBigGaps) {
    reasons.push(`${g.label} ${g.status === "below" ? "low" : "high"} (${g.value}${g.unit}).`);
  }
  if (reasons.length === 0) reasons.push("All key metrics inside target range — green light.");

  // Missed-window alert
  const missedActive =
    primary !== null && primaryScore > 0.35 && daysToPlanting < primaryFixDays(primary.key);
  const missedWindow = {
    active: missedActive,
    message: missedActive && primary
      ? `${primary.label} typically takes ${primaryFixDays(primary.key)}+ days to correct — you have ${daysToPlanting}.`
      : "",
  };

  return {
    gaps,
    readiness,
    yieldIndex,
    risk,
    riskReasons: reasons,
    primaryConstraint: primary,
    trendClass,
    trendDelta,
    sbai,
    sbaiBand,
    missedWindow,
  };
}

function primaryFixDays(key: MetricKey): number {
  switch (key) {
    case "ph":
      return 21;
    case "drainage":
      return 14;
    case "om":
      return 30;
    case "nitrogen":
      return 7;
    case "moisture":
      return 3;
    case "conductivity":
      return 14;
    case "temp":
      return 5;
    case "co2":
      return 21;
  }
}

export function computeSBAI(m: SoilMetrics): number {
  // Normalize each driver into 0..1
  const tempScore = bell(m.temp, 70, 18); // peak around 70F
  const moistureScore = bell(m.moisture, 26, 10);
  const co2Score = clamp(m.co2 / 70, 0, 1);
  const omScore = clamp(m.om / 6, 0, 1);
  const drainageScore = bell(m.drainage, 7.5, 3);
  const ecScore = bell(m.conductivity, 1.2, 1.2);

  const composite =
    tempScore * 0.15 +
    moistureScore * 0.18 +
    co2Score * 0.25 +
    omScore * 0.22 +
    drainageScore * 0.12 +
    ecScore * 0.08;

  return Math.round(composite * 100);
}

function bell(value: number, peak: number, halfWidth: number): number {
  const d = (value - peak) / halfWidth;
  return clamp(1 - d * d * 0.6, 0, 1);
}

export function rankActions(diag: Diagnosis, crop: CropProfile): ActionItem[] {
  const COSTS: Record<MetricKey, [number, number]> = {
    ph: [40, 180],
    nitrogen: [25, 90],
    moisture: [10, 60],
    drainage: [80, 220],
    om: [60, 240],
    conductivity: [30, 110],
    temp: [0, 40],
    co2: [25, 90],
  };
  const TITLES: Record<MetricKey, string> = {
    ph: "Lime / sulfur amendment to correct pH",
    nitrogen: "Apply slow-release nitrogen blend",
    moisture: "Adjust irrigation schedule + mulch",
    drainage: "Install French drain / broadfork to break compaction",
    om: "Top-dress 1\" finished compost",
    conductivity: "Leach salts with deep watering cycle",
    temp: "Lay black plastic / row cover to warm soil",
    co2: "Inoculate with compost tea + cover crop",
  };
  const EFFORT: Record<MetricKey, number> = {
    ph: 14,
    nitrogen: 3,
    moisture: 1,
    drainage: 7,
    om: 5,
    conductivity: 5,
    temp: 2,
    co2: 10,
  };

  return diag.gaps
    .filter((g) => g.severity > 0.05)
    .map((g) => {
      const sens = crop.sensitivity[g.key] ?? 0.4;
      const yieldGainPct = Math.min(0.35, g.severity * sens * 0.45);
      const costMid = (COSTS[g.key][0] + COSTS[g.key][1]) / 2;
      const roiScore = (yieldGainPct * 1000) / Math.max(costMid, 10);
      return {
        id: `act-${g.key}`,
        title: TITLES[g.key],
        metric: g.key,
        costRange: COSTS[g.key],
        yieldGainPct,
        effortDays: EFFORT[g.key],
        roiScore,
      };
    })
    .sort((a, b) => b.roiScore - a.roiScore);
}

export function buildPlan(actions: ActionItem[], crop: CropProfile): PlanWeek[] {
  const phaseFor = (i: number) =>
    i === 0 ? "Diagnose & Reset" : i === 1 ? "Amend" : i === 2 ? "Stabilize" : "Plant Prep";
  return actions.slice(0, 4).map((a, i) => ({
    week: i + 1,
    phase: phaseFor(i),
    action: a.title,
    metric: a.metric,
    expectedImpact: `+${Math.round(a.yieldGainPct * 100)}% yield potential, ~${a.effortDays} days of effort`,
  })).concat(
    actions.length < 4
      ? [
          {
            week: actions.length + 1,
            phase: "Plant",
            action: `Direct-seed or transplant ${crop.name.toLowerCase()}`,
            metric: "moisture" as MetricKey,
            expectedImpact: "Lock in gains and begin in-season monitoring.",
          },
        ]
      : [],
  );
}

export function counterfactuals(
  diag: Diagnosis,
  actions: ActionItem[],
): Counterfactual[] {
  const top = actions[0];
  const fullGain = actions.reduce((s, a) => s + a.yieldGainPct, 0);

  return [
    {
      id: "do-nothing",
      label: "Do nothing",
      description: "Plant as-is. Current trajectory.",
      readiness: clamp(diag.readiness - (diag.trendClass === "declining" ? 8 : 2), 0, 100),
      yieldIndex: diag.yieldIndex,
      risk: diag.risk,
    },
    {
      id: "fix-top",
      label: "Fix top constraint",
      description: top
        ? `Address ${diag.primaryConstraint?.label ?? top.metric}.`
        : "No critical fix needed.",
      readiness: clamp(diag.readiness + (top ? Math.round(top.yieldGainPct * 70) : 0), 0, 100),
      yieldIndex: diag.yieldIndex + (top ? Math.round(top.yieldGainPct * 100) : 0),
      risk: stepDownRisk(diag.risk, top ? 1 : 0),
    },
    {
      id: "full-plan",
      label: "Follow full plan",
      description: "Sequence every ROI-positive intervention.",
      readiness: clamp(diag.readiness + Math.round(fullGain * 80), 0, 100),
      yieldIndex: diag.yieldIndex + Math.round(fullGain * 110),
      risk: stepDownRisk(diag.risk, 2),
    },
  ];
}

function stepDownRisk(r: RiskLevel, steps: number): RiskLevel {
  const order: RiskLevel[] = ["low", "moderate", "high"];
  const idx = order.indexOf(r);
  return order[clamp(idx - steps, 0, 2)];
}

function clampLocal() {} // no-op export silencer

clampLocal();
