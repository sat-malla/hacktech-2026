import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { GapItem } from "@/lib/soil/types";

export function GapBar({ gap }: { gap: GapItem }) {
  const span = gap.target.max - gap.target.min;
  const display = Math.max(gap.target.min - span, 0);
  const total = gap.target.max + span - display;
  const targetStart = ((gap.target.min - display) / total) * 100;
  const targetWidth = (span / total) * 100;
  const valuePct = ((gap.value - display) / total) * 100;

  const statusColor =
    gap.status === "ready"
      ? "bg-success"
      : gap.status === "below"
        ? "bg-warning"
        : "bg-danger";

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-[12px]">
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{gap.label}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              gap.status === "ready" && "bg-success/12 text-success",
              gap.status === "below" && "bg-warning/15 text-warning",
              gap.status === "above" && "bg-danger/12 text-danger",
            )}
          >
            {gap.status}
          </span>
        </div>
        <div className="tabular-nums text-muted-foreground">
          <span className="text-foreground font-semibold">
            {gap.value.toFixed(gap.value >= 10 ? 0 : 1)}
            {gap.unit}
          </span>
          <span className="ml-2 text-[11px]">
            target {gap.target.min}–{gap.target.max}
            {gap.unit}
          </span>
        </div>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute top-0 h-full bg-success/15"
          style={{ left: `${targetStart}%`, width: `${targetWidth}%` }}
        />
        <motion.div
          className={cn("absolute top-0 h-full w-[3px] rounded-full", statusColor)}
          initial={{ left: `${valuePct}%` }}
          animate={{ left: `${Math.max(0, Math.min(99, valuePct))}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
        />
      </div>
    </div>
  );
}
