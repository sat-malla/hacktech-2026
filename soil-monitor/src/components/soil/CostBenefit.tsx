import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDerived, useSoilStore } from "@/lib/soil/store";
import type { CropId } from "@/lib/soil/types";
import { Calculator, TrendingUp, AlertTriangle } from "lucide-react";

/** Hardcoded economic assumptions per crop. */
const CROP_ECON: Record<
  CropId,
  {
    pricePerKg: number;
    baselineKgPerSqm: number;
    pesticideReductionPct: number; // 0..1
    sensorCost: [number, number];
  }
> = {
  strawberries: {
    pricePerKg: 4.5,
    baselineKgPerSqm: 0.8,
    pesticideReductionPct: 0.35,
    sensorCost: [40, 90],
  },
  tomatoes: {
    pricePerKg: 2.2,
    baselineKgPerSqm: 1.2,
    pesticideReductionPct: 0.28,
    sensorCost: [40, 90],
  },
};

/** Animated count-up. Whole numbers tabular. */
function useCountUp(target: number, duration = 800, deps: unknown[] = []): number {
  const [val, setVal] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = val;
    startRef.current = null;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const k = Math.min(1, elapsed / duration);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - k, 3);
      setVal(fromRef.current + (target - fromRef.current) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, ...deps]);

  return val;
}

function fmtMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  return sign + "$" + abs.toLocaleString();
}

export function CostBenefit() {
  const cropId = useSoilStore((s) => s.plots[s.activePlot].crop);
  const setCrop = useSoilStore((s) => s.setCrop);
  const { diag, actions, futures } = useDerived();

  // Only allow our two crops; if anything else somehow selected, default to tomatoes.
  const activeCrop: CropId = cropId === "strawberries" ? "strawberries" : "tomatoes";
  const econ = CROP_ECON[activeCrop];

  // Suggested current yield from yield index × baseline.
  // Yield index 100 = baseline. Scale linearly.
  const defaultYield = (plot: number) =>
    Math.max(1, Math.round((diag.yieldIndex / 100) * econ.baselineKgPerSqm * plot));

  // Inputs
  const [plot, setPlot] = useState(100);
  const [yieldKg, setYieldKg] = useState<number>(() => defaultYield(100));
  const [yieldDirty, setYieldDirty] = useState(false);
  const [pesticide, setPesticide] = useState(180);
  const [ownsSensor, setOwnsSensor] = useState(false);
  const [calculated, setCalculated] = useState(false);

  // Re-suggest yield when crop or yieldIndex changes (unless user edited it).
  useEffect(() => {
    if (!yieldDirty) setYieldKg(defaultYield(plot));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCrop, diag.yieldIndex, plot]);

  // Computed economics
  const result = useMemo(() => {
    const doNothing = futures.find((f) => f.id === "do-nothing")!;
    const fullPlan = futures.find((f) => f.id === "full-plan")!;
    const yieldDeltaPct = Math.max(0, (fullPlan.yieldIndex - doNothing.yieldIndex) / 100);

    const yieldUpliftKg = Math.round(yieldKg * yieldDeltaPct);
    const revenueUplift = yieldUpliftKg * econ.pricePerKg;

    // Amendment cost — sum of ROI action mid-points.
    const amendLow = actions.reduce((s, a) => s + a.costRange[0], 0);
    const amendHigh = actions.reduce((s, a) => s + a.costRange[1], 0);
    const amendMid = (amendLow + amendHigh) / 2;

    const sensorLow = ownsSensor ? 0 : econ.sensorCost[0];
    const sensorHigh = ownsSensor ? 0 : econ.sensorCost[1];
    const sensorMid = (sensorLow + sensorHigh) / 2;

    const pesticideSaving = pesticide * econ.pesticideReductionPct;

    const totalCostMid = amendMid + sensorMid;
    const netDelta = revenueUplift + pesticideSaving - totalCostMid;
    const paybackSeasons =
      revenueUplift + pesticideSaving > 0
        ? totalCostMid / (revenueUplift + pesticideSaving)
        : Infinity;

    return {
      yieldDeltaPct,
      yieldUpliftKg,
      revenueUplift,
      amendLow,
      amendHigh,
      amendMid,
      sensorLow,
      sensorHigh,
      pesticideSaving,
      totalCostMid,
      netDelta,
      paybackSeasons,
    };
  }, [actions, futures, yieldKg, pesticide, ownsSensor, econ]);

  // Animated values (only animate after calculate pressed; key resets transitions).
  const animKey = `${activeCrop}-${plot}-${yieldKg}-${pesticide}-${ownsSensor}-${calculated}`;
  const aRevenue = useCountUp(calculated ? result.revenueUplift : 0, 700, [animKey]);
  const aPesticide = useCountUp(calculated ? result.pesticideSaving : 0, 700, [animKey]);
  const aAmend = useCountUp(calculated ? result.amendMid : 0, 700, [animKey]);
  const aSensor = useCountUp(calculated ? (result.sensorLow + result.sensorHigh) / 2 : 0, 700, [animKey]);
  const aYieldKg = useCountUp(calculated ? result.yieldUpliftKg : 0, 700, [animKey]);
  const aNet = useCountUp(calculated ? result.netDelta : 0, 900, [animKey]);

  const netPositive = result.netDelta >= 0;
  const showHighRiskBanner = diag.risk === "high";

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <div className="text-[12px] font-medium text-muted-foreground">
            Cost-benefit analysis
          </div>
          <div className="mt-0.5 text-[15px] font-semibold tracking-tight">
            What's it worth to fix the soil?
          </div>
        </div>
        <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
          <Calculator className="h-3.5 w-3.5" />
          Estimate from your readings
        </div>
      </div>

      {/* Crop toggle */}
      <div className="px-5 pt-5">
        <div className="grid grid-cols-2 gap-2">
          {(["strawberries", "tomatoes"] as const).map((id) => {
            const active = activeCrop === id;
            return (
              <button
                key={id}
                onClick={() => setCrop(id)}
                className={
                  "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors " +
                  (active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-surface-elevated hover:border-border-strong")
                }
              >
                <div>
                  <div className="text-[13px] font-semibold capitalize">{id}</div>
                  <div
                    className={
                      "mt-0.5 text-[11px] " +
                      (active ? "text-background/70" : "text-muted-foreground")
                    }
                  >
                    ${CROP_ECON[id].pricePerKg.toFixed(2)}/kg · {CROP_ECON[id].baselineKgPerSqm} kg/m²
                  </div>
                </div>
                <span
                  className={
                    "h-1.5 w-1.5 rounded-full " +
                    (active ? "bg-background" : "bg-border-strong")
                  }
                />
              </button>
            );
          })}
        </div>
      </div>

      {showHighRiskBanner && (
        <div className="mx-5 mt-4 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-[12px] text-danger">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            High soil risk detected — fixing this first maximises your ROI.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* INPUT PANEL */}
        <div className="space-y-4">
          <FieldLabel
            label="Plot size"
            hint="square metres"
            value={
              <NumberInput
                value={plot}
                min={1}
                step={1}
                suffix="m²"
                onChange={(n) => setPlot(n)}
              />
            }
          />
          <FieldLabel
            label="Current yield estimate"
            hint={
              yieldDirty
                ? "your override"
                : `~${defaultYield(plot)} kg suggested from yield index`
            }
            value={
              <NumberInput
                value={yieldKg}
                min={0}
                step={1}
                suffix="kg"
                onChange={(n) => {
                  setYieldKg(n);
                  setYieldDirty(true);
                }}
              />
            }
          />
          <FieldLabel
            label="Pesticide spend"
            hint="per season"
            value={
              <NumberInput
                value={pesticide}
                min={0}
                step={5}
                prefix="$"
                onChange={(n) => setPesticide(n)}
              />
            }
          />

          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated/60 px-4 py-3">
            <div>
              <div className="text-[12px] font-semibold">I already own a soil sensor</div>
              <div className="text-[11px] text-muted-foreground">
                Skips one-time equipment cost
              </div>
            </div>
            <Toggle value={ownsSensor} onChange={setOwnsSensor} />
          </div>

          <button
            onClick={() => setCalculated(true)}
            className="w-full rounded-xl bg-foreground px-4 py-3 text-[13px] font-semibold text-background shadow-soft transition-transform active:scale-[0.99]"
          >
            Calculate ROI
          </button>

          <div className="rounded-xl bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Assumptions · {activeCrop}:</span>{" "}
            ${econ.pricePerKg.toFixed(2)}/kg market price ·{" "}
            {Math.round(econ.pesticideReductionPct * 100)}% pesticide reduction with healthy soil ·
            sensor ${econ.sensorCost[0]}–${econ.sensorCost[1]}.
          </div>
        </div>

        {/* RESULTS PANEL */}
        <AnimatePresence mode="wait">
          {!calculated ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 p-6 text-center"
            >
              <div>
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3 text-[13px] font-semibold">Results appear here</div>
                <p className="mt-1 max-w-[260px] text-[12px] text-muted-foreground">
                  Enter your plot, yield, and spend, then hit Calculate ROI.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* Net delta — hero number */}
              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="text-[12px] font-medium text-muted-foreground">
                  Net profit delta · per season
                </div>
                <div
                  className={
                    "mt-2 text-5xl font-semibold tabular-nums tracking-tight " +
                    (netPositive ? "text-success" : "text-danger")
                  }
                >
                  {fmtMoney(aNet)}
                </div>
                <div className="mt-2 text-[12.5px] text-muted-foreground">
                  {Number.isFinite(result.paybackSeasons)
                    ? result.paybackSeasons <= 0
                      ? "You recover costs within the first season."
                      : `Pays back in ~${
                          result.paybackSeasons < 1
                            ? "1"
                            : Math.round(result.paybackSeasons * 10) / 10
                        } season${result.paybackSeasons >= 2 ? "s" : ""}.`
                    : "Pay-back not reachable at current uplift — fix the binding constraint first."}
                </div>
              </div>

              {/* Gains */}
              <div className="grid grid-cols-2 gap-3">
                <ResultTile
                  tone="success"
                  label="Revenue uplift"
                  value={fmtMoney(aRevenue)}
                  sub={`${Math.round(aYieldKg)} kg extra yield`}
                />
                <ResultTile
                  tone="success"
                  label="Pesticide savings"
                  value={fmtMoney(aPesticide)}
                  sub={`${Math.round(econ.pesticideReductionPct * 100)}% reduction`}
                />
              </div>

              {/* Costs */}
              <div className="grid grid-cols-2 gap-3">
                <ResultTile
                  tone="warning"
                  label="Amendment costs"
                  value={fmtMoney(aAmend)}
                  sub={`${actions.length} action${actions.length === 1 ? "" : "s"} · $${result.amendLow}–$${result.amendHigh}`}
                />
                <ResultTile
                  tone="warning"
                  label="Equipment"
                  value={ownsSensor ? "Owned" : fmtMoney(aSensor)}
                  sub={
                    ownsSensor
                      ? "No new hardware"
                      : `One-time · $${result.sensorLow}–$${result.sensorHigh}`
                  }
                />
              </div>

              <p className="pt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                Estimates based on your soil readings and regional averages. Actual results vary.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ----- small bits ----- */

function FieldLabel({
  label,
  hint,
  value,
}: {
  label: string;
  hint?: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] font-semibold">{label}</span>
        {hint && <span className="text-[10.5px] text-muted-foreground">{hint}</span>}
      </div>
      {value}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  step = 1,
  prefix,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [text, setText] = useState<string>(String(value));
  const focusedRef = useRef(false);

  // Keep local text in sync when value changes externally (and not while typing)
  useEffect(() => {
    if (!focusedRef.current) setText(String(value));
  }, [value]);

  return (
    <div className="flex items-center rounded-xl border border-border bg-surface-elevated focus-within:border-foreground/60 focus-within:shadow-soft">
      {prefix && (
        <span className="pl-3 text-[12px] font-medium text-muted-foreground">{prefix}</span>
      )}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={text}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          const n = Number(text);
          const clamped =
            !Number.isFinite(n) || text === ""
              ? min ?? 0
              : min !== undefined && n < min
                ? min
                : n;
          setText(String(clamped));
          onChange(clamped);
        }}
        onChange={(e) => {
          // allow only digits (and optional decimals if step < 1)
          const raw = e.target.value.replace(/[^0-9.]/g, "");
          // strip leading zeros (but keep "0" alone and "0.x")
          const cleaned = raw.replace(/^0+(?=\d)/, "");
          setText(cleaned);
          if (cleaned === "") return;
          const n = Number(cleaned);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-full bg-transparent px-3 py-2.5 text-[14px] font-semibold tabular-nums outline-none"
      />
      {suffix && (
        <span className="pr-3 text-[12px] font-medium text-muted-foreground">{suffix}</span>
      )}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={
        "relative h-6 w-11 rounded-full transition-colors " +
        (value ? "bg-success" : "bg-border-strong")
      }
      aria-pressed={value}
    >
      <span
        className={
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-transform " +
          (value ? "translate-x-5" : "translate-x-0.5")
        }
      />
    </button>
  );
}

function ResultTile({
  tone,
  label,
  value,
  sub,
}: {
  tone: "success" | "warning";
  label: string;
  value: string;
  sub?: string;
}) {
  const valColor = tone === "success" ? "text-success" : "text-foreground";
  const dotColor = tone === "success" ? "bg-success" : "bg-warning";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-1.5">
        <span className={"h-1.5 w-1.5 rounded-full " + dotColor} />
        <div className="text-[11px] font-medium text-muted-foreground">
          {label}
        </div>
      </div>
      <div className={"mt-1.5 text-2xl font-semibold tabular-nums tracking-tight " + valColor}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
