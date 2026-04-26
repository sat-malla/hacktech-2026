import { createFileRoute } from "@tanstack/react-router";
import { useDerived, useSoilStore, PLOTS } from "@/lib/soil/store";
import { AppShell } from "@/components/soil/AppShell";
import { InputMatrix } from "@/components/soil/InputMatrix";
import { SBAIGauge } from "@/components/soil/SBAIGauge";
import { GapBar } from "@/components/soil/GapBar";
import { RiskPill } from "@/components/soil/RiskPill";
import { CounterfactualGrid, MissedWindowBanner } from "@/components/soil/ActionPanels";
import { CostBenefit } from "@/components/soil/CostBenefit";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SoilCompass — Biological Readiness Dashboard" },
      {
        name: "description",
        content: "Diagnose soil biology, crop readiness, and yield potential.",
      },
      { property: "og:title", content: "SoilCompass — Biological Readiness Dashboard" },
      {
        property: "og:description",
        content: "Diagnose soil biology, crop readiness, and yield potential.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-[260px_1fr]">
        <InputMatrix />
        <div className="space-y-14 min-w-0">
          <DashboardHeader />
          <MissedWindowBanner />
          <StatusPanel />
          <DiagnosticArea />
          <Section
            kicker="Outlook"
            title="Three possible futures."
            subtitle="What happens to readiness, yield, and risk under each path."
          >
            <CounterfactualGrid />
          </Section>
          <CostBenefit />
        </div>
      </div>
    </AppShell>
  );
}

function DashboardHeader() {
  const { crop, scenario, diag } = useDerived();
  const days = useSoilStore((s) => s.plots[s.activePlot].daysToPlanting);
  const activePlot = useSoilStore((s) => s.activePlot);
  const plotMeta = PLOTS.find((p) => p.id === activePlot)!;
  const sensorId = `SC-0${activePlot.slice(-1)}A`;
  return (
    <div className="relative space-y-6">
      {/* Ambient color wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-10 -z-10 h-72 w-[520px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 50%, color-mix(in oklab, var(--success) 22%, transparent), transparent 70%), radial-gradient(50% 50% at 80% 30%, color-mix(in oklab, var(--biology) 18%, transparent), transparent 70%)",
        }}
      />
      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          <span className="text-success font-medium">Live</span>
        </span>
        <span className="tabular-nums">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        <span className="tabular-nums">{plotMeta.label} · {plotMeta.bearing}</span>
      </div>

      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {scenario.name}
          </div>
          <h1 className="mt-3 text-[42px] font-semibold leading-[1.05] tracking-[-0.025em]">
            {crop.name}.
            <span className="block font-serif font-normal italic text-muted-foreground">
              {days} days to planting.
            </span>
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RiskPill risk={diag.risk} size="lg" />
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {diag.gaps.filter((g) => g.status !== "ready").length} of{" "}
            {diag.gaps.length} metrics off-target
          </div>
        </div>
      </div>
    </div>
  );
}

/* The unified status panel: gauge + biology trend + readiness + yield in one
   coherent instrument layout (gauge dominant, vitals as a typographic table). */
function StatusPanel() {
  const { diag, scenario, crop } = useDerived();

  const trendColor =
    diag.trendClass === "improving"
      ? "var(--success)"
      : diag.trendClass === "declining"
        ? "var(--danger)"
        : "var(--muted-foreground)";

  const TrendIcon =
    diag.trendClass === "improving"
      ? ArrowUpRight
      : diag.trendClass === "declining"
        ? ArrowDownRight
        : Minus;

  return (
    <Section
      kicker="Status"
      title="Vital signs."
      subtitle="A composite read of biology, readiness, and yield potential."
    >
      <div className="card-elevated overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,260px)_1fr]">
          {/* Gauge */}
          <div
            className="relative flex flex-col items-center justify-center border-b border-border px-6 py-8 lg:border-b-0 lg:border-r"
            style={{
              background:
                "radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, var(--biology) 6%, transparent), transparent 65%)",
            }}
          >
            <SBAIGauge value={diag.sbai} band={diag.sbaiBand} />
            <div className="mt-5 max-w-[200px] text-center">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-biology">
                Soil Biological Age
              </div>
              <p className="mt-1.5 font-serif text-[12px] italic leading-relaxed text-muted-foreground">
                Composite of temperature, moisture, CO₂, organic matter, drainage, and conductivity.
              </p>
            </div>
          </div>

          {/* Vitals table */}
          <div className="divide-y divide-border">
            <VitalRow
              label="30-day biology trend"
              value={
                <span className="capitalize">
                  {diag.trendClass}
                  <span className="ml-2 text-[12px] font-normal text-muted-foreground tabular-nums">
                    {diag.trendDelta >= 0 ? "+" : ""}
                    {diag.trendDelta.toFixed(1)} CO₂
                  </span>
                </span>
              }
              icon={
                <TrendIcon
                  className="h-4 w-4"
                  style={{ color: trendColor }}
                />
              }
              spark={
                <div className="h-9 w-28">
                  <ResponsiveContainer>
                    <AreaChart data={scenario.trend}>
                      <defs>
                        <linearGradient id="vSpark" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={trendColor} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="co2"
                        stroke={trendColor}
                        strokeWidth={1.5}
                        fill="url(#vSpark)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              }
            />
            <VitalRow
              label="Crop readiness"
              sublabel={`vs. ${crop.name.toLowerCase()} target band`}
              value={
                <span
                  className={
                    diag.readiness >= 70
                      ? "text-success"
                      : diag.readiness >= 45
                        ? "text-warning"
                        : "text-danger"
                  }
                >
                  {diag.readiness}
                  <span className="text-[16px] font-normal text-muted-foreground">%</span>
                </span>
              }
              progress={diag.readiness / 100}
              progressColor={
                diag.readiness >= 70
                  ? "bg-success"
                  : diag.readiness >= 45
                    ? "bg-warning"
                    : "bg-danger"
              }
            />
            <VitalRow
              label="Yield index"
              sublabel="100 = baseline season"
              value={
                <span
                  className={
                    diag.yieldIndex >= 100 ? "text-foreground" : "text-warning"
                  }
                >
                  {diag.yieldIndex}
                </span>
              }
              delta={
                <span
                  className={
                    diag.yieldIndex >= 100 ? "text-success" : "text-warning"
                  }
                >
                  {diag.yieldIndex >= 100 ? "+" : ""}
                  {diag.yieldIndex - 100} pts
                </span>
              }
            />
          </div>
        </div>
      </div>
    </Section>
  );
}

function VitalRow({
  label,
  sublabel,
  value,
  icon,
  spark,
  progress,
  progressColor,
  delta,
}: {
  label: string;
  sublabel?: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  spark?: React.ReactNode;
  progress?: number;
  progressColor?: string;
  delta?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-5 px-6 py-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[12.5px] font-medium text-foreground">
          {label}
          {icon}
        </div>
        {sublabel && (
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">{sublabel}</div>
        )}
        {progress !== undefined && (
          <div className="mt-3 h-[3px] w-full max-w-[260px] overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${progressColor ?? "bg-foreground"} transition-[width] duration-700 ease-out`}
              style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-end">
        {spark}
      </div>
      <div className="text-right">
        <div className="text-[28px] font-semibold leading-none tabular-nums tracking-tight">
          {value}
        </div>
        {delta && (
          <div className="mt-1 text-[11.5px] font-medium tabular-nums">{delta}</div>
        )}
      </div>
    </div>
  );
}

function DiagnosticArea() {
  const { diag } = useDerived();
  return (
    <Section
      kicker="Diagnostic"
      title="Crop gap analysis."
      subtitle="Each metric measured against its target band."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div className="card-elevated space-y-5 p-6">
          {diag.gaps.map((g) => (
            <GapBar key={g.key} gap={g} />
          ))}
        </div>
        <div className="card-elevated p-6">
          <div className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Why this risk
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <RiskPill risk={diag.risk} />
            {diag.primaryConstraint && (
              <span className="text-[11.5px] text-muted-foreground">
                Primary:{" "}
                <span className="font-medium text-foreground">
                  {diag.primaryConstraint.label}
                </span>
              </span>
            )}
          </div>
          <ul className="mt-5 space-y-2.5 text-[13px]">
            {diag.riskReasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 leading-snug">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                <span className="text-foreground/80">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function Section({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-6">
        {kicker && (
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <span className="h-1 w-1 rounded-full bg-success" />
            {kicker}
          </div>
        )}
        <h2 className="mt-1.5 text-[26px] font-semibold tracking-[-0.022em]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 max-w-xl text-[13.5px] text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
