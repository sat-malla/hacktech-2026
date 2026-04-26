import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export function TrendSparkline({
  data,
  trendClass,
  delta,
}: {
  data: { day: number; co2: number; moisture: number }[];
  trendClass: "improving" | "stable" | "declining";
  delta: number;
}) {
  const colorVar =
    trendClass === "improving"
      ? "var(--success)"
      : trendClass === "declining"
        ? "var(--danger)"
        : "var(--muted-foreground)";

  const Icon =
    trendClass === "improving"
      ? ArrowUpRight
      : trendClass === "declining"
        ? ArrowDownRight
        : Minus;

  return (
    <div className="card-elevated p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] font-medium text-muted-foreground">
            30-day trend
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={cn(
                "text-3xl font-semibold capitalize tabular-nums",
                trendClass === "improving" && "text-success",
                trendClass === "declining" && "text-danger",
                trendClass === "stable" && "text-foreground",
              )}
            >
              {trendClass}
            </span>
            <span className="text-[12px] text-muted-foreground tabular-nums">
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)} CO₂
            </span>
          </div>
        </div>
        <Icon
          className={cn(
            "h-5 w-5",
            trendClass === "improving" && "text-success",
            trendClass === "declining" && "text-danger",
            trendClass === "stable" && "text-muted-foreground",
          )}
        />
      </div>
      <div className="mt-4 h-[80px] w-full">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorVar} stopOpacity={0.25} />
                <stop offset="100%" stopColor={colorVar} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="co2"
              stroke={colorVar}
              strokeWidth={1.75}
              fill="url(#sparkFill)"
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
