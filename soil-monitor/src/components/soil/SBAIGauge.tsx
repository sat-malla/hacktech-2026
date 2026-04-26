export function SBAIGauge({ value, band }: { value: number; band: string }) {
  const radius = 72;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value)) / 100;

  const colorVar =
    band === "excellent" || band === "good"
      ? "var(--success)"
      : band === "moderate"
        ? "var(--warning)"
        : "var(--danger)";

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width={180} height={180} viewBox="0 0 180 180" className="-rotate-90">
        <circle
          cx={90}
          cy={90}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={10}
        />
        <circle
          cx={90}
          cy={90}
          r={radius}
          fill="none"
          stroke={colorVar}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[52px] font-semibold leading-none tabular-nums tracking-tight">
          {value}
        </span>
        <span className="mt-1.5 text-[8.5px] px-2 py-1 uppercase tracking-[0.16em] text-muted-foreground">
          SBAI · {band}
        </span>
      </div>
    </div>
  );
}
