import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/soil/AppShell";
import { InputMatrix } from "@/components/soil/InputMatrix";
import { ScanSimulator } from "@/components/soil/ScanSimulator";
import { useDerived, useSoilStore } from "@/lib/soil/store";
import { METRIC_LABELS } from "@/lib/soil/data";
import type { MetricKey } from "@/lib/soil/types";
import { motion } from "framer-motion";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan — SoilCompass" },
      {
        name: "description",
        content:
          "Simulate a camera-based soil scan. Get soil type, organic matter, drainage, and pH with confidence scoring.",
      },
      { property: "og:title", content: "Scan — SoilCompass" },
      {
        property: "og:description",
        content: "Simulated camera scan reading: soil type, OM, drainage, pH.",
      },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  const metrics = useSoilStore((s) => s.plots[s.activePlot].metrics);
  const { scenario } = useDerived();
  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[300px_1fr]">
        <InputMatrix />
        <div className="space-y-10">
          <header className="border-b border-border pb-6">
            <div className="text-[12px] font-medium text-muted-foreground">
              Field Scan
            </div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              Snap, classify, sync.
            </h1>
            <p className="mt-2 max-w-md text-[13.5px] text-muted-foreground">
              The scan overrides pH, OM, and drainage in your live diagnosis.
            </p>
          </header>

          <ScanSimulator />

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-elevated p-6"
          >
            <div className="text-[12px] font-medium text-muted-foreground">
              Live sensor read · {scenario.name}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.keys(metrics) as MetricKey[]).map((k) => (
                <div key={k} className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                    {METRIC_LABELS[k].label}
                  </div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">
                    {metrics[k].toFixed(metrics[k] >= 10 ? 0 : 1)}
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                      {METRIC_LABELS[k].unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
