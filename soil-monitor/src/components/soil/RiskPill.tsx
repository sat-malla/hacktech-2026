import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/soil/types";

export function RiskPill({ risk, size = "md" }: { risk: RiskLevel; size?: "sm" | "md" | "lg" }) {
  const map = {
    low: { label: "Low Risk", classes: "bg-success/12 text-success ring-success/20" },
    moderate: {
      label: "Moderate Risk",
      classes: "bg-warning/15 text-warning ring-warning/25",
    },
    high: { label: "High Risk", classes: "bg-danger/12 text-danger ring-danger/25" },
  } as const;
  const sizeCls =
    size === "lg"
      ? "text-sm px-3.5 py-1.5"
      : size === "sm"
        ? "text-[11px] px-2 py-0.5"
        : "text-[12px] px-2.5 py-1";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset",
        map[risk].classes,
        sizeCls,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          risk === "low" && "bg-success",
          risk === "moderate" && "bg-warning",
          risk === "high" && "bg-danger",
        )}
      />
      {map[risk].label}
    </span>
  );
}
