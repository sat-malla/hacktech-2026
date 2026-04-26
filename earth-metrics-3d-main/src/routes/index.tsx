import { createFileRoute, Link } from "@tanstack/react-router";
import SiteHeader from "@/components/SiteHeader";
import HistoryChart from "@/components/HistoryChart";
import { useLiveMetrics } from "@/hooks/useLiveMetrics";
import DeviceCinematic from "@/components/DeviceCinematic";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Soil Compass — Sense the ground beneath you" },
      {
        name: "description",
        content:
          "An interactive 3D dashboard for the Soil Compass — real-time plant, soil and weather metrics with full historical trends.",
      },
      { property: "og:title", content: "Soil Compass — Sense the ground beneath you" },
      {
        property: "og:description",
        content: "Live plant + soil sensing, visualised. Explore the Soil Compass.",
      },
    ],
  }),
  component: Index,
});


function LiveStat({
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

function Index() {
  const metrics = useLiveMetrics(2200);

  // Field risk score (0-100). Higher = worse conditions for crops.
  const riskScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        Math.abs(metrics.moisture - 55) * 1.0 +
          Math.abs(metrics.temperature - 22) * 2.2 +
          Math.abs(metrics.waterLevel - 30) * 0.8,
      ),
    ),
  );

  const riskLevel: "low" | "medium" | "high" =
    riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low";

  const riskMeta = {
    low: {
      label: "LOW",
      description: "Field conditions are within optimal range. Continue monitoring.",
      color: "text-[#7aa84a]",
      border: "border-[#7aa84a]/40",
      bg: "bg-[#7aa84a]/10",
      dot: "bg-[#7aa84a]",
    },
    medium: {
      label: "MEDIUM",
      description: "Some readings drifting from optimal. Action recommended within 24h.",
      color: "text-[#d4a84a]",
      border: "border-[#d4a84a]/40",
      bg: "bg-[#d4a84a]/10",
      dot: "bg-[#d4a84a]",
    },
    high: {
      label: "HIGH",
      description: "Critical thresholds breached. Intervention required now.",
      color: "text-[#e54d2e]",
      border: "border-[#e54d2e]/40",
      bg: "bg-[#e54d2e]/10",
      dot: "bg-[#e54d2e]",
    },
  }[riskLevel];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <SiteHeader />

      {/* HERO — headline + CTA only, kept clean */}
      <section className="relative pt-32 pb-12 px-6 md:px-12 border-b border-border/40">
        <div className="absolute inset-0 topo-grid opacity-50 pointer-events-none" />
        <div className="absolute inset-0 organic-noise pointer-events-none" />
        <div className="relative max-w-7xl mx-auto fade-up">
          <div className="text-[10px] font-mono-tight tracking-[0.4em] uppercase text-copper mb-3">
            ◦ Model 01 — Plant Field Probe
          </div>
          <h1 className="font-display font-light text-4xl md:text-6xl lg:text-7xl max-w-4xl leading-[1.05] tracking-tight">
            Sense the ground
            <br />
            <span
              className="italic font-extralight bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(110deg, oklch(0.92 0.18 145) 0%, oklch(0.72 0.19 150) 45%, oklch(0.55 0.16 160) 100%)",
              }}
            >
              beneath you.
            </span>
          </h1>
          <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="max-w-md text-sm md:text-base text-muted-foreground leading-relaxed">
              Real-time plant intelligence from the field: soil, water, and weather data in one connected dashboard.
            </p>
            <Link to="/demo" className="inline-flex items-center gap-3 group w-fit">
              <span className="text-xs font-mono-tight tracking-[0.3em] uppercase text-foreground">
                Enter live demo
              </span>
              <span className="w-12 h-px bg-copper group-hover:w-20 transition-all duration-300" />
              <span className="text-copper">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* DASHBOARD — plant + live metrics */}
      <section className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          {/* Cinematic 3D scene: field → plant → underground */}
          <div className="relative rounded-sm border border-border bg-card/40 overflow-hidden h-[480px] lg:h-[620px]">
            <DeviceCinematic />

            {/* Subtle texture overlay */}
            <div className="absolute inset-0 organic-noise opacity-25 pointer-events-none" />

            {/* Soft risk-tinted vignette */}
            <div
              className="absolute inset-0 pointer-events-none mix-blend-soft-light"
              style={{
                background: `radial-gradient(ellipse at 50% 60%, ${
                  { low: "#7aa84a", medium: "#d4a84a", high: "#e54d2e" }[riskLevel]
                }33 0%, transparent 65%)`,
              }}
            />

            {/* Top-left status badge removed */}

            {/* Top-right risk score badge removed */}



          </div>

          {/* Live metrics column */}
          <div className="border border-border bg-card/40 rounded-sm p-5 md:p-6 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div className="text-[10px] font-mono-tight tracking-[0.3em] uppercase text-copper">
                ◦ Live Readings
              </div>
              <span className="flex items-center gap-1.5 text-[9px] font-mono-tight tracking-[0.2em] uppercase text-muted-foreground">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: metrics.stale ? "#d4a84a" : "#4ade80" }}
                />
                {metrics.stale ? "stale" : "live"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-5 flex-1">
              <LiveStat
                label="Soil Moisture"
                value={metrics.moisture.toFixed(0)}
                unit="%"
                accent="cyan"
              />
              <LiveStat
                label="Air Temp"
                value={metrics.temperature.toFixed(1)}
                unit="°C"
                accent="copper"
              />
              <LiveStat
                label="Water Level"
                value={metrics.waterLevel.toFixed(0)}
                unit="cm"
                accent="cyan"
              />
              <LiveStat
                label="Weather"
                value={metrics.weather}
                accent="copper"
              />
              <LiveStat
                label="Humidity"
                value={metrics.weatherHumidity.toFixed(0)}
                unit="%"
                accent="cyan"
              />
              <LiveStat
                label="Wind"
                value={metrics.weatherWind.toFixed(1)}
                unit="km/h"
                accent="copper"
              />
              <LiveStat
                label="Probe Depth"
                value={metrics.depth.toFixed(0)}
                unit="cm"
                accent="copper"
              />
              <LiveStat
                label="Heading"
                value={metrics.orientation.toFixed(0)}
                unit="°N"
                accent="cyan"
              />
            </div>

            <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-end">
              <Link
                to="/demo"
                className="text-[10px] font-mono-tight tracking-[0.25em] uppercase text-copper hover:underline"
              >
                Open full dashboard →
              </Link>
            </div>
          </div>
        </div>

        {/* Historical chart */}
        <div className="mt-4">
          <HistoryChart />
        </div>
      </section>

      {/* CHATBOT TEASER */}
      <section className="border-t border-border/60 py-20 md:py-28 px-6 md:px-12 bg-card/30">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-[10px] font-mono-tight tracking-[0.4em] uppercase text-copper mb-4">
              ◦ Conversational
            </div>
            <h2 className="font-display font-light text-3xl md:text-5xl leading-tight mb-6">
              Ask the SoilLink.
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-md">
              Skip the dashboards. Type a question, get a grounded answer based on
              the readings happening underneath your plants right now!
            </p>
          </div>

          <div className="border border-border bg-background rounded-sm p-6 md:p-8 space-y-4 font-mono-tight">
            <div className="flex items-start gap-3">
              <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-1.5">You</span>
              <div className="flex-1 text-sm bg-muted px-4 py-2.5 rounded-sm">
                Should I water my tomatoes today?
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[10px] tracking-[0.2em] uppercase text-copper mt-1.5">Tune</span>
              <div className="flex-1 text-sm bg-copper/10 border border-copper/20 px-4 py-2.5 rounded-sm">
                Soil moisture is at <span className="text-copper">47%</span>{" "}
                with rising humidity. Hold off — light rain forecast within 6 hours.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-1.5">You</span>
              <div className="flex-1 text-sm bg-muted px-4 py-2.5 rounded-sm">
                What's the field risk this morning?
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[10px] tracking-[0.2em] uppercase text-copper mt-1.5">Tune</span>
              <div className="flex-1 text-sm bg-copper/10 border border-copper/20 px-4 py-2.5 rounded-sm">
                Risk: <span className="text-[#7aa84a]">LOW</span> (18/100). Soil temp{" "}
                <span className="text-copper">18.6°C</span>, moisture{" "}
                <span className="text-cyan-data">47%</span>.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="border-t border-border/60 py-12 px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <div className="font-display tracking-[0.2em] uppercase text-sm">
              Soil<span className="text-copper">T</span>une
            </div>
            <p className="text-xs text-muted-foreground mt-2 font-mono-tight tracking-wide">
              Field-ready soil sensing · Model 01
            </p>
          </div>
          <div className="text-xs font-mono-tight text-muted-foreground space-y-1">
            <div className="text-[10px] tracking-[0.25em] uppercase">
              © {new Date().getFullYear()} — Built at HackTech
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
