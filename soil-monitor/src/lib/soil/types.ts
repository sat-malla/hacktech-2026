export type ScenarioId =
  | "depleted-corn"
  | "waterlogged-clay"
  | "average-bed"
  | "healthy-managed";

export type CropId = "tomatoes" | "strawberries";

export type MetricKey =
  | "ph"
  | "nitrogen"
  | "moisture"
  | "drainage"
  | "om"
  | "conductivity"
  | "temp"
  | "co2";

export type SoilMetrics = Record<MetricKey, number>;

export type Range = { min: number; max: number };

export type CropGroup = "quick-veg" | "row-grain" | "tree-fruit";

export type CropProfile = {
  id: CropId;
  name: string;
  group: CropGroup;
  targets: Record<MetricKey, Range>;
  /** Higher = more sensitive to that metric being out of range. 0–1. */
  sensitivity: Partial<Record<MetricKey, number>>;
  /** Ideal prep window (days before planting). */
  idealPrepDays: number;
  /** Max meaningful prep horizon for the slider (days). */
  maxPrepDays: number;
};

export type Scenario = {
  id: ScenarioId;
  name: string;
  story: string;
  metrics: SoilMetrics;
  /** 30 days of (co2, moisture) readings, oldest -> newest. */
  trend: { day: number; co2: number; moisture: number }[];
  scanReadout: {
    soilType: string;
    om: number;
    drainage: number;
    ph: number;
    confidence: number;
  };
};

export type GapStatus = "ready" | "below" | "above";

export type GapItem = {
  key: MetricKey;
  label: string;
  unit: string;
  value: number;
  target: Range;
  status: GapStatus;
  /** 0..1 normalized severity */
  severity: number;
};

export type RiskLevel = "low" | "moderate" | "high";

export type Diagnosis = {
  gaps: GapItem[];
  readiness: number; // 0..100
  yieldIndex: number; // 0..160ish, 100 baseline
  risk: RiskLevel;
  riskReasons: string[];
  primaryConstraint: GapItem | null;
  trendClass: "improving" | "stable" | "declining";
  trendDelta: number;
  sbai: number; // 0..100
  sbaiBand: "low" | "moderate" | "good" | "excellent";
  missedWindow: { active: boolean; message: string };
};

export type ActionItem = {
  id: string;
  title: string;
  metric: MetricKey;
  costRange: [number, number];
  yieldGainPct: number; // 0..1
  effortDays: number;
  /** higher = better */
  roiScore: number;
};

export type PlanWeek = {
  week: number;
  phase: string;
  action: string;
  metric: MetricKey;
  expectedImpact: string;
};

export type Counterfactual = {
  id: "do-nothing" | "fix-top" | "full-plan";
  label: string;
  description: string;
  readiness: number;
  yieldIndex: number;
  risk: RiskLevel;
};
