import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { useLiveMetrics, type LiveMetrics } from "@/hooks/useLiveMetrics";

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
          <div className="font-display font-light text-lg">{m.weather}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono-tight tracking-[0.2em] uppercase text-muted-foreground mb-1">Location</div>
          <div className="font-display font-light text-lg">{m.gps}</div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/60 pt-4">
        {recommendation}
      </p>
    </div>
  );
}

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
    return `Current condition: ${m.weather.toLowerCase()}. Humidity ${m.weatherHumidity.toFixed(0)}%, wind ${m.weatherWind.toFixed(1)} km/h.`;
  }
  if (q.includes("depth") || q.includes("level")) {
    return `Probe depth ${m.depth.toFixed(0)} cm. Water table detected at ${m.waterLevel.toFixed(0)} cm below surface.`;
  }
  if (q.includes("location") || q.includes("gps") || q.includes("where")) {
    return `Sensor located at ${m.gps}, oriented ${m.orientation.toFixed(0)}° from north.`;
  }
  return `Right now: moisture ${m.moisture.toFixed(0)}%, temp ${m.temperature.toFixed(1)}°C, water level ${m.waterLevel.toFixed(0)} cm. ${m.weather}.`;
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
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-data pulse-ring" />
            <span className="text-[10px] font-mono-tight tracking-[0.25em] uppercase text-muted-foreground">
              Live · Sensor 01 · {metrics.gps}
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
            label="Water Level"
            value={metrics.waterLevel.toFixed(0)}
            unit="cm"
            accent="cyan"
          >
            <WaterGauge level={metrics.waterLevel} />
          </MetricCard>

          <MetricCard label="Weather" value={metrics.weather} accent="copper">
            <div className="flex gap-4 text-[10px] font-mono-tight text-muted-foreground tracking-wider">
              <span>HUM {metrics.weatherHumidity.toFixed(0)}%</span>
              <span>WIND {metrics.weatherWind.toFixed(1)}km/h</span>
            </div>
          </MetricCard>

          <MetricCard
            label="Orientation"
            value={metrics.orientation.toFixed(0)}
            unit="° N"
            accent="cyan"
          >
            <div className="text-[10px] font-mono-tight text-muted-foreground tracking-wider">
              Compass heading
            </div>
          </MetricCard>

          <MetricCard
            label="Probe Depth"
            value={metrics.depth.toFixed(0)}
            unit="cm"
            accent="copper"
          >
            <div className="flex gap-1 mt-1">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  className="flex-1 h-4 rounded-sm"
                  style={{
                    backgroundColor:
                      i / 8 < metrics.depth / 70
                        ? "var(--copper)"
                        : "var(--muted)",
                    opacity: i / 8 < metrics.depth / 70 ? 1 - i * 0.08 : 1,
                  }}
                />
              ))}
            </div>
          </MetricCard>
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
