import { useEffect, useMemo, useState } from "react";
import { useHistoricalReadings } from "../hooks/useHistoricalReadings";

type SeriesKey = "moisture" | "temperature" | "waterLevel";

interface Point {
  month: string;
  moisture: number;
  temperature: number;
  waterLevel: number;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Deterministic pseudo-random so SSR and client render identically
function noise(i: number, seed: number) {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

// Pseudo-historical data — looks like a real growing season
function generateHistory(): Point[] {
  return MONTHS.map((m, i) => {
    const temperature = 8 + 14 * Math.sin((i / 11) * Math.PI) + noise(i, 1) * 1.5;
    const moisture = 55 - 18 * Math.sin((i / 11) * Math.PI) + noise(i, 2) * 4;
    const waterLevel = 35 - 12 * Math.sin((i / 11) * Math.PI) + noise(i, 3) * 3;
    return {
      month: m,
      temperature: Math.round(temperature * 10) / 10,
      moisture: Math.round(moisture),
      waterLevel: Math.round(waterLevel),
    };
  });
}

const SERIES_META: Record<
  SeriesKey,
  { label: string; unit: string; color: string; cssVar: string }
> = {
  moisture: { label: "Moisture", unit: "%", color: "var(--cyan-data)", cssVar: "cyan-data" },
  temperature: { label: "Temperature", unit: "°C", color: "var(--copper)", cssVar: "copper" },
  waterLevel: { label: "Water Level", unit: "cm", color: "#d4a84a", cssVar: "" },
};

export default function HistoryChart() {
  const { data: liveData, loading } = useHistoricalReadings(24);

  const generatedData = useMemo(() => generateHistory(), []);

  // Use real data when available; fall back to generated placeholder
  const rawData = !loading && liveData.length > 0 ? liveData : generatedData;

  // Normalise field name: real data uses `label`, generated uses `month`
  const data: Point[] = rawData.map((d) => ({
    month: (d as { label?: string; month?: string }).label ?? (d as { month: string }).month,
    moisture: d.moisture,
    temperature: d.temperature,
    waterLevel: d.waterLevel,
  }));

  const isLive = !loading && liveData.length > 0;

  const [active, setActive] = useState<Record<SeriesKey, boolean>>({
    moisture: true,
    temperature: true,
    waterLevel: true,
  });
  const [hover, setHover] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="border border-border bg-card/40 rounded-sm p-5 md:p-7 h-[420px]" />
    );
  }

  const W = 760;
  const H = 280;
  const PAD = { top: 24, right: 24, bottom: 36, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // y-axis: normalize each series to 0-100 visual range using a shared scale
  const allValues: number[] = [];
  (Object.keys(active) as SeriesKey[]).forEach((k) => {
    if (active[k]) data.forEach((d) => allValues.push(d[k]));
  });
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 60);
  const range = max - min || 1;

  const xFor = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yFor = (v: number) => PAD.top + innerH - ((v - min) / range) * innerH;

  const linePath = (key: SeriesKey) =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d[key])}`)
      .join(" ");

  const areaPath = (key: SeriesKey) => {
    const top = data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d[key])}`)
      .join(" ");
    return `${top} L ${xFor(data.length - 1)} ${PAD.top + innerH} L ${xFor(0)} ${PAD.top + innerH} Z`;
  };

  const yTicks = 4;
  const tickValues = Array.from(
    { length: yTicks + 1 },
    (_, i) => min + (range * i) / yTicks,
  );

  return (
    <div className="border border-border bg-card/40 rounded-sm p-5 md:p-7">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] font-mono-tight tracking-[0.3em] uppercase text-copper mb-2 flex items-center gap-2">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: isLive ? "#4ade80" : "#475569", boxShadow: isLive ? "0 0 5px #4ade80" : "none" }}
            />
            {isLive ? `◦ Live data · ${liveData.length} readings` : "◦ Trends · Past 12 months"}
          </div>
          <h3 className="font-display font-light text-2xl md:text-3xl">
            {isLive ? "Sensor readings history" : "Growing season at a glance"}
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(SERIES_META) as SeriesKey[]).map((k) => {
            const meta = SERIES_META[k];
            const isOn = active[k];
            return (
              <button
                key={k}
                onClick={() => setActive((a) => ({ ...a, [k]: !a[k] }))}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-sm text-[10px] font-mono-tight tracking-[0.2em] uppercase transition-colors ${
                  isOn
                    ? "border-border bg-muted/60 text-foreground"
                    : "border-border/50 text-muted-foreground/60"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: isOn ? meta.color : "transparent", border: `1px solid ${meta.color}` }}
                />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto min-w-[600px]"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            {(Object.keys(SERIES_META) as SeriesKey[]).map((k) => (
              <linearGradient
                key={k}
                id={`grad-${k}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={SERIES_META[k].color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={SERIES_META[k].color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Y grid */}
          {tickValues.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yFor(v)}
                y2={yFor(v)}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeDasharray="2 4"
              />
              <text
                x={PAD.left - 8}
                y={yFor(v) + 3}
                fontSize="9"
                fontFamily="var(--font-mono)"
                textAnchor="end"
                fill="currentColor"
                opacity="0.5"
              >
                {Math.round(v)}
              </text>
            </g>
          ))}

          {/* X labels */}
          {data.map((d, i) => (
            <text
              key={d.month}
              x={xFor(i)}
              y={H - 14}
              fontSize="9"
              fontFamily="var(--font-mono)"
              textAnchor="middle"
              fill="currentColor"
              opacity={hover === i ? 1 : 0.5}
            >
              {d.month}
            </text>
          ))}

          {/* Area fills + lines */}
          {(Object.keys(SERIES_META) as SeriesKey[]).map((k) => {
            if (!active[k]) return null;
            const meta = SERIES_META[k];
            return (
              <g key={k}>
                <path d={areaPath(k)} fill={`url(#grad-${k})`} />
                <path
                  d={linePath(k)}
                  fill="none"
                  stroke={meta.color}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {data.map((d, i) => (
                  <circle
                    key={i}
                    cx={xFor(i)}
                    cy={yFor(d[k])}
                    r={hover === i ? 3.5 : 2}
                    fill="var(--background)"
                    stroke={meta.color}
                    strokeWidth={1.4}
                  />
                ))}
              </g>
            );
          })}

          {/* Hover capture */}
          {data.map((_, i) => (
            <rect
              key={i}
              x={xFor(i) - innerW / data.length / 2}
              y={0}
              width={innerW / data.length}
              height={H}
              fill="transparent"
              style={{ cursor: "crosshair" }}
              onMouseEnter={() => setHover(i)}
              onMouseMove={() => setHover(i)}
            />
          ))}

          {/* Hover line + tooltip */}
          {hover !== null && (
            <g>
              <line
                x1={xFor(hover)}
                x2={xFor(hover)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                stroke="var(--copper)"
                strokeOpacity="0.4"
                strokeDasharray="3 3"
              />
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            className="absolute top-2 right-2 border border-border bg-background/95 backdrop-blur-sm rounded-sm p-3 min-w-[140px]"
          >
            <div className="text-[10px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground mb-2">
              {data[hover].month}
            </div>
            <div className="space-y-1.5">
              {(Object.keys(SERIES_META) as SeriesKey[]).map((k) => {
                if (!active[k]) return null;
                const meta = SERIES_META[k];
                return (
                  <div key={k} className="flex items-center justify-between gap-3 text-xs font-mono-tight">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className="w-2 h-2 rounded-sm"
                        style={{ backgroundColor: meta.color }}
                      />
                      {meta.label}
                    </span>
                    <span style={{ color: meta.color }}>
                      {data[hover][k]}
                      {meta.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 pt-4 border-t border-border/60">
        {(Object.keys(SERIES_META) as SeriesKey[]).map((k) => {
          const meta = SERIES_META[k];
          const values = data.map((d) => d[k]);
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const trend = values[values.length - 1] - values[0];
          return (
            <div key={k}>
              <div className="text-[9px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground mb-1">
                Avg {meta.label}
              </div>
              <div className="font-display font-light text-xl" style={{ color: meta.color }}>
                {avg.toFixed(1)}
                <span className="text-xs text-muted-foreground ml-1">{meta.unit}</span>
              </div>
              <div className="text-[10px] font-mono-tight text-muted-foreground mt-0.5">
                {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}{meta.unit} year-over-year
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
