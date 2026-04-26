import { useState } from "react";
import { useDerived } from "@/lib/soil/store";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { METRIC_LABELS } from "@/lib/soil/data";

export function WeekPlan() {
  const { plan } = useDerived();
  const [active, setActive] = useState(0);
  const safeActive = Math.min(active, Math.max(plan.length - 1, 0));
  const step = plan[safeActive];

  if (plan.length === 0) {
    return (
      <div className="card-elevated p-6 text-[13px] text-muted-foreground">
        No plan needed — soil is plant-ready.
      </div>
    );
  }

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[12px] font-medium text-muted-foreground">
            Week-by-week plan
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActive((a) => Math.max(0, a - 1))}
            disabled={safeActive === 0}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-2 text-[12px] font-medium tabular-nums text-muted-foreground">
            {safeActive + 1} / {plan.length}
          </span>
          <button
            onClick={() => setActive((a) => Math.min(plan.length - 1, a + 1))}
            disabled={safeActive === plan.length - 1}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="px-6 pt-6">
        <div className="flex items-center gap-1">
          {plan.map((p, i) => (
            <button
              key={p.week}
              onClick={() => setActive(i)}
              className="group flex flex-1 flex-col items-start gap-1.5"
            >
              <div className="flex w-full items-center gap-1">
                <div
                  className={
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums transition-all " +
                    (i === safeActive
                      ? "bg-foreground text-background"
                      : i < safeActive
                        ? "bg-success text-success-foreground"
                        : "bg-muted text-muted-foreground")
                  }
                >
                  {i + 1}
                </div>
                {i < plan.length - 1 && (
                  <div
                    className={
                      "h-[2px] flex-1 rounded-full " +
                      (i < safeActive ? "bg-success" : "bg-muted")
                    }
                  />
                )}
              </div>
              <div className="text-left">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Wk {p.week}
                </div>
                <div className="text-[11px] font-medium text-foreground/80 leading-tight line-clamp-1">
                  {p.phase}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={safeActive}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="m-6 rounded-xl border border-border bg-surface p-5"
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {step.phase} · Week {step.week}
          </div>
          <div className="mt-2 text-[18px] font-semibold tracking-tight leading-snug">
            {step.action}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Tag label="Affects" value={METRIC_LABELS[step.metric].label} />
            <Tag label="Impact" value={step.expectedImpact} />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-[11px]">
      <span className="font-semibold uppercase tracking-wider text-muted-foreground">
        {label}:
      </span>{" "}
      <span className="font-medium">{value}</span>
    </div>
  );
}
