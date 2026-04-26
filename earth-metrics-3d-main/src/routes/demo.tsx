import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { useLiveMetrics, type LiveMetrics } from "@/hooks/useLiveMetrics";
import HistoryChart from "@/components/HistoryChart";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Live Dashboard — SoilTune" },
      {
        name: "description",
        content:
          "Your personal plant & soil dashboard — live moisture, temperature, water level and weather, plus an AI assistant ready to answer questions.",
      },
      { property: "og:title", content: "Live Dashboard — SoilTune" },
      {
        property: "og:description",
        content: "A friendly dashboard for your plants with a built-in AI assistant.",
      },
    ],
  }),
  component: DemoPage,
});

function Sparkline({ values, color = "var(--copper)" }: { values: number[]; color?: string }) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 120;
  const h = 36;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  unit,
  accent,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: "copper" | "cyan";
  children?: React.ReactNode;
}) {
  const accentClass = accent === "cyan" ? "text-cyan-data" : "text-copper";
  return (
    <div className="border border-border bg-card/40 p-5 rounded-sm relative overflow-hidden group hover:border-copper/40 transition-colors">
      <div className="text-[10px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground mb-3">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-display font-light text-3xl ${accentClass}`}>{value}</span>
        {unit && (
          <span className="text-xs font-mono-tight text-muted-foreground">{unit}</span>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function WaterGauge({ level }: { level: number }) {
  const pct = Math.min(100, Math.max(0, ((level - 10) / 50) * 100));
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-cyan-data transition-all duration-1000"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatusSummary({ m }: { m: LiveMetrics }) {
  const moistureStatus =
    m.moisture < 35 ? { label: "Dry", tone: "text-[#d4a84a]" } :
    m.moisture > 70 ? { label: "Saturated", tone: "text-cyan-data" } :
    { label: "Healthy", tone: "text-[#7aa84a]" };

  const tempStatus =
    m.temperature < 15 ? { label: "Cool", tone: "text-cyan-data" } :
    m.temperature > 24 ? { label: "Warm", tone: "text-[#d4a84a]" } :
    { label: "Ideal", tone: "text-[#7aa84a]" };

  const recommendation =
    m.moisture < 35
      ? "Your plants could use a drink. Consider watering in the next few hours."
      : m.moisture > 75
      ? "Soil is well saturated — hold off on watering today."
      : "Conditions look great. No action needed right now.";

  return (
    <div className="border border-border bg-card/40 rounded-sm p-5 md:p-7">
      <div className="text-[10px] font-mono-tight tracking-[0.3em] uppercase text-copper mb-4">
        ◦ Today's Snapshot
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div>
          <div className="text-[10px] font-mono-tight tracking-[0.2em] uppercase text-muted-foreground mb-1">Moisture</div>
          <div className={`font-display font-light text-lg ${moistureStatus.tone}`}>{moistureStatus.label}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono-tight tracking-[0.2em] uppercase text-muted-foreground mb-1">Temperature</div>
          <div className={`font-display font-light text-lg ${tempStatus.tone}`}>{tempStatus.label}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono-tight tracking-[0.2em] uppercase text-muted-foreground mb-1">Weather</div>
          <div className="font-display font-light text-lg">Cloudy</div>
        </div>
        <div>
          <div className="text-[10px] font-mono-tight tracking-[0.2em] uppercase text-muted-foreground mb-1">Type</div>
          <div className="font-display font-light text-lg">Tomato</div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/60 pt-4">
        {recommendation}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prediction helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function scoreColor(score: number) {
  if (score >= 70) return { text: "#4ade80", label: "Good" };
  if (score >= 40) return { text: "#fb923c", label: "Moderate" };
  return { text: "#ef4444", label: "Poor" };
}

function computePredictions(m: LiveMetrics) {
  // Soil Yield — moisture near 55%, temp near 22°C, high humidity all contribute
  const yieldMoisture = clamp(100 - Math.abs(m.moisture - 55) * 2.5, 0, 100);
  const yieldTemp     = clamp(100 - Math.abs(m.temperature - 22) * 5, 0, 100);
  const yieldHumidity = clamp(m.humidity, 0, 100);
  const yieldWater    = clamp(m.waterLevel * 5, 0, 100);
  const soilYield     = Math.round(0.35 * yieldMoisture + 0.30 * yieldTemp + 0.25 * yieldHumidity + 0.10 * yieldWater);

  // Arableness — low methane, moisture near 55%, stable drainage all help
  const arableMethane  = clamp(100 - m.methane * 3, 0, 100);
  const arableMoisture = clamp(100 - Math.abs(m.moisture - 55) * 2, 0, 100);
  const arableDrain    = clamp(80 - Math.abs(m.drainage) * 2, 0, 100);
  const arableness     = Math.round(0.35 * arableMethane + 0.45 * arableMoisture + 0.20 * arableDrain);

  // Organic Matter — moderate methane (5–15%) signals active decomposition
  const organic = Math.round(
    m.methane < 5
      ? m.methane * 8
      : m.methane < 15
        ? 40 + (m.methane - 5) * 4
        : clamp(80 - (m.methane - 15) * 3, 0, 100)
  );

  return { soilYield, arableness, organic };
}

function PredictionCard({
  label,
  score,
  description,
}: {
  label: string;
  score: number;
  description: string;
}) {
  const { text, label: tier } = scoreColor(score);
  return (
    <div className="border border-border bg-card/40 p-5 rounded-sm flex flex-col gap-3 hover:border-copper/30 transition-colors">
      <div className="text-[10px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display font-light text-4xl" style={{ color: text }}>
          {score}
        </span>
        <span className="text-xs font-mono-tight text-muted-foreground">/ 100</span>
        <span className="ml-auto text-[10px] font-mono-tight tracking-[0.2em] uppercase" style={{ color: text }}>
          {tier}
        </span>
      </div>
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: text }}
        />
      </div>
      <p className="text-[11px] font-mono-tight text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function PredictiveSection({ m }: { m: LiveMetrics }) {
  const { soilYield, arableness, organic } = computePredictions(m);
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-3 px-1">
        <div className="text-[10px] font-mono-tight tracking-[0.3em] uppercase text-copper">
          ◦ Predictive Analytics
        </div>
        <div className="flex-1 h-px bg-border/60" />
        <span className="text-[9px] font-mono-tight tracking-[0.2em] uppercase text-muted-foreground">
          derived from live sensor data
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PredictionCard
          label="Soil Yield Potential"
          score={soilYield}
          description={`Estimates crop productivity from moisture (${m.moisture.toFixed(0)}%), temperature (${m.temperature.toFixed(1)}°C), and humidity (${m.humidity.toFixed(0)}%).`}
        />
        <PredictionCard
          label="Arableness"
          score={arableness}
          description={`Suitability for cultivation based on methane (${m.methane.toFixed(1)}%), moisture, and drainage (${m.drainage.toFixed(1)}%).`}
        />
        <PredictionCard
          label="Organic Matter Index"
          score={organic}
          description={`Estimates organic activity from MQ2 methane reading (${m.methane.toFixed(1)}%). Moderate methane signals active decomposition.`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function generateReply(input: string, m: LiveMetrics): string {
  const q = input.toLowerCase();
  if (q.includes("irriga") || q.includes("water")) {
    return m.moisture < 35
      ? `Moisture is low at ${m.moisture.toFixed(0)}%. Recommend watering now — water table is ${m.waterLevel.toFixed(0)} cm deep.`
      : `Moisture sits at ${m.moisture.toFixed(0)}%. No need to water yet — keep an eye on the next 6 hours.`;
  }
  if (q.includes("temp")) {
    return `Soil temperature is ${m.temperature.toFixed(1)}°C — ${m.temperature < 15 ? "cool" : m.temperature > 22 ? "warm" : "ideal"} for most plants.`;
  }
  if (q.includes("weather") || q.includes("rain")) {
    return `Current condition: Cloudy. Humidity ${m.humidity.toFixed(0)}%.`;
  }
  if (q.includes("depth") || q.includes("level")) {
    return `Probe depth ${m.depth.toFixed(0)} cm. Water table detected at ${m.waterLevel.toFixed(0)} cm below surface.`;
  }
  if (q.includes("location") || q.includes("gps") || q.includes("where")) {
    return `Sensor located at ${m.gps}, oriented ${m.orientation.toFixed(0)}° from north.`;
  }
  return `Right now: moisture ${m.moisture.toFixed(0)}%, temp ${m.temperature.toFixed(1)}°C, humidity ${m.humidity.toFixed(0)}%. Cloudy.`;
}

function DemoPage() {
  const metrics = useLiveMetrics(1800);
  const moistureHist = metrics.history.map((h) => h.moisture);
  const tempHist = metrics.history.map((h) => h.temperature);

  const [chat, setChat] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "Hi! I'm SoilLink. Ask me anything about your plants — watering, weather, soil temp, or what to do next." },
  ]);
  const [input, setInput] = useState("");

  function send() {
    const text = input.trim();
    if (!text) return;
    const reply = generateReply(text, metrics);
    setChat((c) => [...c, { role: "user", text }, { role: "bot", text: reply }]);
    setInput("");
  }

  const suggestions = [
    "Should I water today?",
    "What's the soil temp?",
    "How's the weather?",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <div className="pt-20 pb-16 px-4 md:px-8 max-w-[1400px] mx-auto">
        <div className="mb-8 px-2 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] font-mono-tight tracking-[0.4em] uppercase text-copper mb-3">
              ◦ Your Garden · Live
            </div>
            <h1 className="font-display font-light text-3xl md:text-5xl leading-tight">
              Your plants,{" "}
              <span className="text-muted-foreground italic font-extralight">at a glance.</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${metrics.stale ? "bg-[#d4a84a]" : "bg-cyan-data pulse-ring"}`}
            />
            <span className="text-[10px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground">
              {metrics.stale ? "Stale · last known values" : `Live · Sensor 01 · ${metrics.gps}`}
            </span>
          </div>
        </div>

        {/* Today's snapshot */}
        <StatusSummary m={metrics} />

        {/* Metric grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <MetricCard
            label="Soil Moisture"
            value={metrics.moisture.toFixed(0)}
            unit="%"
            accent="cyan"
          >
            <Sparkline values={moistureHist} color="var(--cyan-data)" />
          </MetricCard>

          <MetricCard
            label="Temperature"
            value={metrics.temperature.toFixed(1)}
            unit="°C"
            accent="copper"
          >
            <Sparkline values={tempHist} color="var(--copper)" />
          </MetricCard>

          <MetricCard
            label="Drainage"
            value={metrics.drainage.toFixed(1)}
            unit="%"
            accent="cyan"
          >
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-cyan-data transition-all duration-700"
                style={{ width: `${Math.min(100, Math.abs(metrics.drainage))}%` }}
              />
            </div>
          </MetricCard>

          <MetricCard
            label="Humidity (predicted)"
            value={metrics.humidity.toFixed(0)}
            unit="%"
            accent="cyan"
          >
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-cyan-data transition-all duration-700"
                style={{ width: `${Math.min(100, metrics.humidity)}%` }}
              />
            </div>
          </MetricCard>

          <MetricCard
            label="Soil Temperature"
            value={metrics.soilTemperature.toFixed(1)}
            unit="°C"
            accent="copper"
          >
            <div className="text-[10px] font-mono-tight text-muted-foreground tracking-wider">
              Underground probe
            </div>
          </MetricCard>

          <MetricCard
            label="Methane (MQ2)"
            value={metrics.methane.toFixed(1)}
            unit="%"
            accent="copper"
          >
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, metrics.methane)}%`,
                  backgroundColor: metrics.methane > 20 ? "#ef4444" : metrics.methane > 10 ? "#d4a84a" : "var(--copper)",
                }}
              />
            </div>
          </MetricCard>
        </div>

        {/* Predictive analytics */}
        <PredictiveSection m={metrics} />

        {/* History chart */}
        <div className="mt-4">
          <HistoryChart />
        </div>

        {/* Chatbot */}
        <div className="mt-6 border border-border bg-card/40 rounded-sm p-5 md:p-7">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-mono-tight tracking-[0.3em] uppercase text-copper">
              ◦ Ask SoilLink
            </div>
            <div className="text-[10px] font-mono-tight tracking-[0.2em] uppercase text-muted-foreground">
              AI assistant
            </div>
          </div>

          <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-2 font-mono-tight text-sm">
            {chat.map((m, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 ${
                  m.role === "user" ? "justify-end" : ""
                }`}
              >
                {m.role === "bot" && (
                  <span className="text-[10px] tracking-[0.2em] uppercase text-copper mt-1.5 shrink-0">
                    SoilLink
                  </span>
                )}
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-sm ${
                    m.role === "user"
                      ? "bg-muted"
                      : "bg-copper/10 border border-copper/20"
                  }`}
                >
                  {m.text}
                </div>
                {m.role === "user" && (
                  <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-1.5 shrink-0">
                    You
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Suggestion chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const reply = generateReply(s, metrics);
                  setChat((c) => [...c, { role: "user", text: s }, { role: "bot", text: reply }]);
                }}
                className="text-[10px] font-mono-tight tracking-[0.15em] uppercase px-3 py-1.5 rounded-sm border border-border hover:border-copper/40 hover:text-copper transition-colors text-muted-foreground"
              >
                {s}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-border pt-4"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your plants…"
              className="flex-1 bg-transparent text-sm font-mono-tight outline-none placeholder:text-muted-foreground/60 px-2"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-copper text-primary-foreground text-xs font-mono-tight tracking-[0.2em] uppercase rounded-sm hover:bg-copper/90 transition-colors"
            >
              Send →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
