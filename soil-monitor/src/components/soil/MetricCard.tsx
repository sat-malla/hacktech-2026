import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export function MetricCard({
  label,
  value,
  unit,
  hint,
  fact,
  accent = "default",
  size = "md",
  children,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  fact?: string;
  accent?: "default" | "success" | "warning" | "danger" | "biology";
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}) {
  const accentMap: Record<string, string> = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    biology: "text-biology",
  };
  const sizeMap = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-5xl",
  };
  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-medium text-muted-foreground">
            {label}
          </span>
          {fact && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground/60 hover:text-foreground">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-[12px]">
                  {fact}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {hint && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{hint}</span>
        )}
      </div>
      <div
        className={cn(
          "mt-3 flex items-baseline gap-1 font-semibold tabular-nums",
          accentMap[accent],
          sizeMap[size],
        )}
      >
        <span>{value}</span>
        {unit && (
          <span className="text-base font-medium text-muted-foreground">{unit}</span>
        )}
      </div>
      {children}
    </div>
  );
}
