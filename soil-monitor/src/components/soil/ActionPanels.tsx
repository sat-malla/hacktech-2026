import { useDerived, useSoilStore } from "@/lib/soil/store";
import { motion } from "framer-motion";
import { ArrowRight, DollarSign, Clock, TrendingUp } from "lucide-react";
import { METRIC_LABELS } from "@/lib/soil/data";

export function ROIActions() {
  const { actions } = useDerived();

  if (actions.length === 0) {
    return (
      <div className="card-elevated p-6 text-center text-[13px] text-muted-foreground">
        No interventions needed — every metric is in range.
      </div>
    );
  }

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="text-[12px] font-medium text-muted-foreground">
          ROI-ranked actions
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {actions.length} recommended
        </span>
      </div>
      <ul className="divide-y divide-border">
        {actions.slice(0, 6).map((a, i) => (
          <motion.li
            key={a.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center justify-between gap-4 px-6 py-4"
          >
            <div className="flex items-start gap-4">
              <div className="text-[13px] font-medium tabular-nums text-muted-foreground w-4">
                {i + 1}
              </div>
              <div>
                <div className="text-[14px] font-semibold leading-tight">{a.title}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
                  <span className="flex items-center gap-1 tabular-nums">
                    <DollarSign className="h-3 w-3" />${a.costRange[0]}–${a.costRange[1]}
                  </span>
                  <span className="flex items-center gap-1 tabular-nums">
                    <Clock className="h-3 w-3" />~{a.effortDays} days
                  </span>
                  <span className="flex items-center gap-1 text-success tabular-nums">
                    <TrendingUp className="h-3 w-3" />+{Math.round(a.yieldGainPct * 100)}% yield
                  </span>
                  <span className="text-muted-foreground/80">
                    {METRIC_LABELS[a.metric].label}
                  </span>
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

export function CounterfactualGrid() {
  const { futures } = useDerived();
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {futures.map((f, i) => {
        const dot =
          f.id === "do-nothing"
            ? "bg-muted-foreground/40"
            : f.id === "fix-top"
              ? "bg-warning"
              : "bg-success";
        return (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-elevated p-6"
          >
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Path {i + 1}
              </div>
            </div>
            <div className="mt-2 text-[17px] font-semibold tracking-tight">{f.label}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              {f.description}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
              <FutureMetric label="Ready" value={`${f.readiness}%`} />
              <FutureMetric label="Yield" value={String(f.yieldIndex)} />
              <FutureMetric label="Risk" value={f.risk} capitalize />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function FutureMetric({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-[15px] font-semibold tabular-nums ${capitalize ? "capitalize" : ""}`}>
        {value}
      </div>
    </div>
  );
}

export function MissedWindowBanner() {
  const { diag } = useDerived();
  const days = useSoilStore((s) => s.plots[s.activePlot].daysToPlanting);
  if (!diag.missedWindow.active) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-warning"
    >
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground text-[11px] font-bold">
        !
      </div>
      <div>
        <div className="font-semibold">Window closing</div>
        <div className="text-warning/85 mt-0.5">
          {diag.missedWindow.message} ({days}d remaining)
        </div>
      </div>
    </motion.div>
  );
}
