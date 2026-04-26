import { useSoilStore, PLOTS, type PlotId } from "@/lib/soil/store";
import { CROPS, METRIC_BOUNDS, METRIC_LABELS, SCENARIOS } from "@/lib/soil/data";
import type { MetricKey, ScenarioId, CropId } from "@/lib/soil/types";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";

const PRIMARY: MetricKey[] = ["ph", "om", "drainage", "moisture"];
const SECONDARY: MetricKey[] = ["nitrogen", "conductivity", "temp", "co2"];

export function InputMatrix() {
  const activePlot = useSoilStore((s) => s.activePlot);
  const setActivePlot = useSoilStore((s) => s.setActivePlot);
  const scenarioId = useSoilStore((s) => s.plots?.[s.activePlot]?.scenario);
  const cropId = useSoilStore((s) => s.plots?.[s.activePlot]?.crop);
  const days = useSoilStore((s) => s.plots?.[s.activePlot]?.daysToPlanting ?? 0);
  const metrics = useSoilStore((s) => s.plots?.[s.activePlot]?.metrics);
  const setScenario = useSoilStore((s) => s.setScenario);
  const setCrop = useSoilStore((s) => s.setCrop);
  const setDays = useSoilStore((s) => s.setDaysToPlanting);
  const setMetric = useSoilStore((s) => s.setMetric);
  const reset = useSoilStore((s) => s.resetMetricsFromScenario);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const crop = CROPS.find((c) => c.id === cropId) ?? CROPS[0];
  const plotMeta = PLOTS.find((p) => p.id === activePlot) ?? PLOTS[0];
  const safeMetrics = metrics ?? scenario.metrics;

  return (
    <aside className="lg:sticky lg:top-16 self-start">
      <div className="space-y-8 pb-10">
        {/* Field meta */}
        <div className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Field
            </div>
            <div className="text-right">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Last sync
              </div>
              <div className="mt-0.5 text-[12px] tabular-nums text-foreground">2 min ago</div>
            </div>
          </div>
          <div className="mt-2">
            <Select
              value={activePlot}
              onValueChange={(v) => setActivePlot(v as PlotId)}
            >
              <SelectTrigger
                className="h-auto w-full border-0 bg-transparent p-0 hover:opacity-80 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60"
              >
                <span className="font-serif text-[15px] italic text-foreground">
                  {plotMeta.label} · {plotMeta.bearing}
                </span>
              </SelectTrigger>
              <SelectContent align="start">
                {PLOTS.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-[13px]">
                    <span className="font-medium">{p.label}</span>
                    <span className="ml-1.5 text-muted-foreground">— {p.bearing}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Scenario */}
        <Section label="Scenario">
          <div className="space-y-1">
            {SCENARIOS.map((s) => (
              <ScenarioRow
                key={s.id}
                id={s.id}
                name={s.name}
                active={s.id === scenarioId}
                onClick={() => setScenario(s.id)}
              />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={scenario.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3 font-serif text-[12.5px] italic leading-relaxed text-muted-foreground"
            >
              {scenario.story}
            </motion.p>
          </AnimatePresence>
        </Section>

        {/* Crop */}
        <Section label="Crop">
          <div className="grid grid-cols-2 gap-1.5">
            {CROPS.map((c) => (
              <CropChip
                key={c.id}
                id={c.id}
                name={c.name}
                active={c.id === cropId}
                onClick={() => setCrop(c.id)}
              />
            ))}
          </div>
        </Section>

        {/* Timeline */}
        <Section label="Timeline">
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="text-muted-foreground">Days to planting</span>
            <span className="font-mono text-[13px] font-medium tabular-nums text-foreground">
              {days}
              <span className="text-muted-foreground/70"> / {crop.idealPrepDays} ideal</span>
            </span>
          </div>
          <Slider
            value={[Math.min(days, crop.maxPrepDays)]}
            min={0}
            max={crop.maxPrepDays}
            step={1}
            onValueChange={(v) => setDays(v[0])}
            className="mt-3"
          />
          <PrepBar days={days} ideal={crop.idealPrepDays} max={crop.maxPrepDays} />
        </Section>

        {/* Primary readings */}
        <Section
          label="Soil readings"
          right={
            <button
              onClick={reset}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          }
        >
          <div className="space-y-4">
            {PRIMARY.map((key) => (
              <ReadingRow
                key={key}
                mKey={key}
                value={safeMetrics[key]}
                onChange={(v) => setMetric(key, v)}
              />
            ))}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-2.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Secondary
            </div>
            <div className="space-y-4">
              {SECONDARY.map((key) => (
                <ReadingRow
                  key={key}
                  mKey={key}
                  value={safeMetrics[key]}
                  onChange={(v) => setMetric(key, v)}
                  compact
                />
              ))}
            </div>
          </div>
        </Section>
      </div>
    </aside>
  );
}

function Section({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function ScenarioRow({
  id,
  name,
  active,
  onClick,
}: {
  id: ScenarioId;
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-id={id}
      className={
        "group flex w-full items-center justify-between py-1.5 text-left text-[13px] transition-colors " +
        (active ? "text-foreground" : "text-muted-foreground hover:text-foreground")
      }
    >
      <span className={active ? "font-medium" : ""}>{name}</span>
      <span
        className={
          "h-1.5 w-1.5 rounded-full transition-colors " +
          (active ? "bg-success" : "bg-transparent group-hover:bg-border-strong")
        }
      />
    </button>
  );
}

function CropChip({
  id,
  name,
  active,
  onClick,
}: {
  id: CropId;
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-id={id}
      className={
        "rounded-md border px-2 py-2 text-[12.5px] font-medium transition-colors " +
        (active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-foreground hover:border-border-strong")
      }
    >
      {name}
    </button>
  );
}

function ReadingRow({
  mKey,
  value,
  onChange,
  compact,
}: {
  mKey: MetricKey;
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  const meta = METRIC_LABELS[mKey];
  const bounds = METRIC_BOUNDS[mKey];
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="text-muted-foreground">{meta.label}</span>
        <span className="font-mono text-[12.5px] tabular-nums">
          <span className="font-medium text-foreground">
            {value.toFixed(value >= 10 ? 0 : 1)}
          </span>
          {meta.unit && (
            <span className="ml-0.5 text-[10.5px] text-muted-foreground">
              {meta.unit}
            </span>
          )}
        </span>
      </div>
      <Slider
        value={[value]}
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        onValueChange={(v) => onChange(v[0])}
        className={compact ? "mt-1.5" : "mt-2"}
      />
    </div>
  );
}

function PrepBar({ days, ideal, max }: { days: number; ideal: number; max: number }) {
  const idealPct = (ideal / max) * 100;
  const dayPct = (Math.min(days, max) / max) * 100;
  const ratio = days / Math.max(ideal, 1);
  const onTime = ratio >= 0.7 && ratio <= 1.6;
  const tooTight = ratio < 0.4;
  const label = tooTight ? "Too late" : onTime ? "On time" : ratio < 0.7 ? "Tight" : "Early";
  const color = tooTight ? "text-danger" : onTime ? "text-success" : "text-warning";
  const markerColor = tooTight ? "bg-danger" : onTime ? "bg-success" : "bg-warning";
  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute top-0 h-full bg-success/30"
          style={{
            left: `${Math.max(0, idealPct - 6)}%`,
            width: `${Math.min(idealPct + 8, 100) - Math.max(0, idealPct - 6)}%`,
          }}
        />
        <div
          className={"absolute top-0 h-full w-[2px] " + markerColor}
          style={{ left: `${Math.min(98, dayPct)}%` }}
        />
      </div>
      <span className={"text-[10px] font-medium uppercase tracking-wider " + color}>
        {label}
      </span>
    </div>
  );
}
