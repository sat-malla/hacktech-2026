import { createFileRoute, Link } from "@tanstack/react-router";
import SiteHeader from "@/components/SiteHeader";
import { useLiveMetrics } from "@/hooks/useLiveMetrics";
import plantImg from "@/assets/home-plant.png";

export const Route = createFileRoute("/home-garden")({
  head: () => ({
    meta: [
      { title: "Home Garden — Soil Compass" },
      {
        name: "description",
        content:
          "A single-pot view of the Soil Compass for family home plants — watch one pot's moisture, temperature, water and care recommendations in real time.",
      },
      { property: "og:title", content: "Home Garden — Soil Compass" },
      {
        property: "og:description",
        content: "Single-pot home plant monitoring with the Soil Compass.",
      },
    ],
  }),
  component: HomeGardenPage,
});

function Stat({
  label,
  value,
  unit,
  accent = "copper",
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: "copper" | "cyan";
}) {
  const accentClass = accent === "cyan" ? "text-cyan-data" : "text-copper";
  return (
    <div className="border-l-2 border-border pl-3 py-1 hover:border-copper/60 transition-colors">
      <div className="text-[9px] font-mono-tight tracking-[0.3em] uppercase text-muted-foreground mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`font-display font-light text-xl ${accentClass}`}>{value}</span>
        {unit && <span className="text-[10px] font-mono-tight text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function HomeGardenPage() {
  const metrics = useLiveMetrics(2200);

  // Plant care logic for an indoor potted plant (different ranges than a field)
  const moistureIdeal = metrics.moisture >= 40 && metrics.moisture <= 70;
  const tempIdeal = metrics.temperature >= 17 && metrics.temperature <= 24;

  let healthLevel: "thriving" | "okay" | "needs-care" = "thriving";
  if (!moistureIdeal && !tempIdeal) healthLevel = "needs-care";
  else if (!moistureIdeal || !tempIdeal) healthLevel = "okay";

  const healthMeta = {
    thriving: {
      label: "THRIVING",
      tip: "Your plant is happy. Keep your routine.",
      color: "text-[#7aa84a]",
      border: "border-[#7aa84a]/40",
      dot: "bg-[#7aa84a]",
    },
    okay: {
      label: "OKAY",
      tip:
        metrics.moisture < 40
          ? "Soil is drying — water within 24h."
          : metrics.moisture > 70
            ? "Soil is saturated — let it dry out a day."
            : metrics.temperature < 17
              ? "A bit cool — move toward a warmer spot."
              : "A bit warm — give it some shade.",
      color: "text-[#d4a84a]",
      border: "border-[#d4a84a]/40",
      dot: "bg-[#d4a84a]",
    },
    "needs-care": {
      label: "NEEDS CARE",
      tip: "Multiple readings outside ideal range. Check on your plant.",
      color: "text-[#e54d2e]",
      border: "border-[#e54d2e]/40",
      dot: "bg-[#e54d2e]",
    },
  }[healthLevel];

  // Friendly watering schedule line
  const daysUntilWater = Math.max(
    0,
    Math.round(((metrics.moisture - 40) / 8) * 1),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <div className="pt-24 pb-16 px-4 md:px-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-8 px-2">
          <div className="text-[10px] font-mono-tight tracking-[0.4em] uppercase text-copper mb-3">
            ◦ Home Garden · Single Pot
          </div>
          <h1 className="font-display font-light text-3xl md:text-5xl leading-tight">
            Just one plant.{" "}
            <span className="text-muted-foreground italic font-extralight">Cared for.</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            A friendlier view for family homes — watch a single pot, get plain-language
            care tips, never overwater again.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
          {/* Plant photo + floating metric tags */}
          <div className="relative rounded-sm border border-border bg-card/40 overflow-hidden h-[500px] lg:h-[640px]">
            <div className="absolute inset-0 topo-grid opacity-30 pointer-events-none" />
            <div className="absolute inset-0 organic-noise pointer-events-none" />

            {/* Soft radial glow behind plant */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center 65%, color-mix(in oklab, var(--copper) 14%, transparent) 0%, transparent 60%)",
              }}
            />

            {/* The plant */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <img
                src={plantImg}
                alt="Potted houseplant being monitored by the Soil Compass"
                loading="lazy"
                width={1024}
                height={1024}
                className="max-h-[90%] max-w-[70%] object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.6)] plant-sway"
              />
            </div>

            {/* Floating metric tags around the plant */}
            <div className="absolute top-[28%] left-6 z-10 backdrop-blur-sm bg-background/80 border border-cyan-data/40 rounded-sm px-3 py-1.5 fade-up">
              <div className="text-[8px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground">
                Soil Moisture
              </div>
              <div className="font-mono-tight text-cyan-data text-sm">
                {metrics.moisture.toFixed(0)}%
              </div>
            </div>

            <div className="absolute top-[20%] right-6 z-10 backdrop-blur-sm bg-background/80 border border-copper/40 rounded-sm px-3 py-1.5 fade-up">
              <div className="text-[8px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground">
                Room Temp
              </div>
              <div className="font-mono-tight text-copper text-sm">
                {metrics.temperature.toFixed(1)}°C
              </div>
            </div>

            <div className="absolute top-[55%] left-4 z-10 backdrop-blur-sm bg-background/80 border border-copper/40 rounded-sm px-3 py-1.5 fade-up">
              <div className="text-[8px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground">
                Humidity
              </div>
              <div className="font-mono-tight text-copper text-sm">
                {metrics.weatherHumidity.toFixed(0)}%
              </div>
            </div>

            <div className="absolute top-[60%] right-4 z-10 backdrop-blur-sm bg-background/80 border border-cyan-data/40 rounded-sm px-3 py-1.5 fade-up">
              <div className="text-[8px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground">
                Water Reservoir
              </div>
              <div className="font-mono-tight text-cyan-data text-sm">
                {metrics.waterLevel.toFixed(0)} cm
              </div>
            </div>

            {/* Probe leader line near pot */}
            <div className="absolute bottom-[18%] left-[58%] z-10 backdrop-blur-sm bg-background/85 border border-[#7aa84a]/50 rounded-sm px-3 py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7aa84a] pulse-ring" />
                <span className="text-[8px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground">
                  Probe Active
                </span>
              </div>
            </div>

            {/* Top-left status */}
            <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
              <span className={`w-1.5 h-1.5 rounded-full ${healthMeta.dot} pulse-ring`} />
              <span className="text-[10px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground">
                LIVE · Living Room · Pot 01
              </span>
            </div>

            {/* Top-right plant health badge */}
            <div
              className={`absolute top-4 right-4 z-10 backdrop-blur-md bg-background/70 border ${healthMeta.border} rounded-sm px-4 py-2.5`}
            >
              <div className="text-[9px] font-mono-tight tracking-[0.3em] uppercase text-muted-foreground">
                Plant Health
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`font-display font-light text-2xl ${healthMeta.color}`}>
                  {healthMeta.label}
                </span>
              </div>
            </div>
          </div>

          {/* Right column: live + care tips */}
          <div className="flex flex-col gap-4">
            {/* Care tip card */}
            <div className={`border ${healthMeta.border} rounded-sm p-5 bg-card/40`}>
              <div className="text-[10px] font-mono-tight tracking-[0.3em] uppercase text-copper mb-2">
                ◦ Today's Tip
              </div>
              <p className="text-sm font-mono-tight leading-relaxed">{healthMeta.tip}</p>
              <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-[10px] font-mono-tight tracking-[0.2em] uppercase">
                <span className="text-muted-foreground">Next watering</span>
                <span className="text-copper">
                  {daysUntilWater === 0 ? "Today" : `~${daysUntilWater}d`}
                </span>
              </div>
            </div>

            {/* Live readings */}
            <div className="border border-border bg-card/40 rounded-sm p-5 flex-1">
              <div className="flex items-center justify-between mb-5">
                <div className="text-[10px] font-mono-tight tracking-[0.3em] uppercase text-copper">
                  ◦ Pot Readings
                </div>
                <span className="text-[9px] font-mono-tight tracking-[0.2em] uppercase text-muted-foreground">
                  every 2s
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <Stat label="Soil Moisture" value={metrics.moisture.toFixed(0)} unit="%" accent="cyan" />
                <Stat label="Room Temp" value={metrics.temperature.toFixed(1)} unit="°C" accent="copper" />
                <Stat label="Water Reservoir" value={metrics.waterLevel.toFixed(0)} unit="cm" accent="cyan" />
                <Stat label="Humidity" value={metrics.weatherHumidity.toFixed(0)} unit="%" accent="copper" />
                <Stat label="Light" value={metrics.weather} accent="copper" />
                <Stat label="Probe Depth" value={metrics.depth.toFixed(0)} unit="cm" accent="cyan" />
              </div>
              <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between">
                <span className="text-[10px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground">
                  Pot · Indoor
                </span>
                <Link
                  to="/"
                  className="text-[10px] font-mono-tight tracking-[0.25em] uppercase text-copper hover:underline"
                >
                  ← Back to field view
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
