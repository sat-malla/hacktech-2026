import { useEffect } from "react";
import { useSoilStore } from "@/lib/soil/store";
import { SCENARIOS } from "@/lib/soil/data";
import { motion } from "framer-motion";
import { ScanLine, Sparkles } from "lucide-react";

export function ScanSimulator() {
  const scanState = useSoilStore((s) => s.scanState);
  const progress = useSoilStore((s) => s.scanProgress);
  const start = useSoilStore((s) => s.startScan);
  const tick = useSoilStore((s) => s.tickScan);
  const finish = useSoilStore((s) => s.finishScan);
  const scenarioId = useSoilStore((s) => s.plots[s.activePlot].scenario);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;

  useEffect(() => {
    if (scanState !== "scanning") return;
    const interval = setInterval(() => {
      const cur = useSoilStore.getState().scanProgress;
      if (cur >= 100) {
        clearInterval(interval);
        finish();
      } else {
        tick();
      }
    }, 120);
    return () => clearInterval(interval);
  }, [scanState, tick, finish]);

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div>
          <div className="text-[12px] font-medium text-muted-foreground">
            Camera scan
          </div>
          <h3 className="mt-1 text-[20px] font-semibold tracking-tight">
            Snap a photo of the soil surface
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            We classify soil type, OM, drainage, and pH from imagery.
          </p>
        </div>
        <button
          onClick={start}
          disabled={scanState === "scanning"}
          className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <ScanLine className="h-4 w-4" />
          {scanState === "scanning" ? "Scanning…" : scanState === "done" ? "Re-scan" : "Start scan"}
        </button>
      </div>

      <div className="relative h-44 border-y border-border bg-gradient-to-br from-earth/15 to-biology/10">
        {/* Faux soil texture */}
        <div className="absolute inset-0 opacity-50 [background:radial-gradient(circle_at_30%_20%,oklch(0.55_0.07_60/0.45),transparent_40%),radial-gradient(circle_at_70%_60%,oklch(0.4_0.05_70/0.35),transparent_45%),radial-gradient(circle_at_50%_85%,oklch(0.35_0.04_50/0.4),transparent_40%)]" />
        {scanState === "scanning" && (
          <motion.div
            initial={{ y: -10 }}
            animate={{ y: 180 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-x-0 h-[2px] bg-biology shadow-[0_0_20px_oklch(0.62_0.19_255)]"
          />
        )}
        {scanState === "scanning" && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
              <motion.div
                className="h-full bg-biology"
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeOut" }}
              />
            </div>
            <div className="mt-1 text-[11px] font-medium text-foreground/80 tabular-nums">
              Analyzing aggregates · {Math.round(progress)}%
            </div>
          </div>
        )}
        {scanState === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-3 grid grid-cols-2 gap-2 sm:grid-cols-5"
          >
            <ReadoutChip label="Soil Type" value={scenario.scanReadout.soilType} />
            <ReadoutChip label="OM" value={`${scenario.scanReadout.om}%`} />
            <ReadoutChip label="Drainage" value={`${scenario.scanReadout.drainage}/10`} />
            <ReadoutChip label="pH" value={String(scenario.scanReadout.ph)} />
            <ReadoutChip
              label="Confidence"
              value={`${scenario.scanReadout.confidence}%`}
              accent
            />
          </motion.div>
        )}
        {scanState === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-surface-elevated/80 px-3 py-1.5 text-[12px] text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-biology" /> Tap "Start Scan" to simulate
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReadoutChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border bg-surface-elevated/90 px-3 py-2 backdrop-blur " +
        (accent ? "border-biology/40" : "border-border")
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-0.5 text-[14px] font-semibold tabular-nums " +
          (accent ? "text-biology" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
