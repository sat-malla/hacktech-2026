import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/soil/AppShell";
import { InputMatrix } from "@/components/soil/InputMatrix";
import { ROIActions, MissedWindowBanner } from "@/components/soil/ActionPanels";
import { WeekPlan } from "@/components/soil/WeekPlan";
import { useDerived } from "@/lib/soil/store";
import { RiskPill } from "@/components/soil/RiskPill";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan — SoilCompass" },
      {
        name: "description",
        content:
          "ROI-ranked interventions and a week-by-week plan to bring your soil to plant-ready status.",
      },
      { property: "og:title", content: "Plan — SoilCompass" },
      {
        property: "og:description",
        content: "ROI-ranked interventions and a week-by-week prep plan.",
      },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const { diag, crop } = useDerived();
  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[300px_1fr]">
        <InputMatrix />
        <div className="space-y-10">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
            <div>
              <div className="text-[12px] font-medium text-muted-foreground">
                Action Plan
              </div>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
                Path to plant-ready{" "}
                <span className="text-muted-foreground font-normal">
                  {crop.name.toLowerCase()}
                </span>
              </h1>
              <p className="mt-2 max-w-md text-[13.5px] text-muted-foreground">
                Ranked by yield-per-dollar. Sequence them to maximise biology before planting.
              </p>
            </div>
            <RiskPill risk={diag.risk} size="lg" />
          </header>

          <MissedWindowBanner />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ROIActions />
            <WeekPlan />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
