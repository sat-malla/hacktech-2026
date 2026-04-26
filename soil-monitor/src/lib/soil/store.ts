import { create } from "zustand";
import type {
  CropId,
  ScenarioId,
  SoilMetrics,
  MetricKey,
} from "@/lib/soil/types";
import { CROPS, SCENARIOS } from "@/lib/soil/data";
import {
  diagnose,
  rankActions,
  buildPlan,
  counterfactuals,
} from "@/lib/soil/logic";

type ScanState = "idle" | "scanning" | "done";

export type PlotId = "plot-1" | "plot-2" | "plot-3" | "plot-4";

export type PlotMeta = {
  id: PlotId;
  label: string; // e.g. "Plot 1"
  bearing: string; // e.g. "West bed"
};

export const PLOTS: PlotMeta[] = [
  { id: "plot-1", label: "Plot 1", bearing: "West bed" },
  { id: "plot-2", label: "Plot 2", bearing: "South bed" },
  { id: "plot-3", label: "Plot 3", bearing: "East bed" },
  { id: "plot-4", label: "Plot 4", bearing: "North bed" },
];

type PlotState = {
  scenario: ScenarioId;
  crop: CropId;
  daysToPlanting: number;
  metrics: SoilMetrics;
};

const tomatoes = CROPS.find((c) => c.id === "tomatoes")!;
const strawberries = CROPS.find((c) => c.id === "strawberries")!;

// Distinct starting state per plot so they feel like real, different fields.
const PLOT_DEFAULTS: Record<PlotId, PlotState> = {
  "plot-1": {
    scenario: "average-bed",
    crop: "tomatoes",
    daysToPlanting: tomatoes.idealPrepDays,
    metrics: { ...SCENARIOS.find((s) => s.id === "average-bed")!.metrics },
  },
  "plot-2": {
    scenario: "waterlogged-clay",
    crop: "strawberries",
    daysToPlanting: Math.round(strawberries.idealPrepDays * 0.6),
    metrics: { ...SCENARIOS.find((s) => s.id === "waterlogged-clay")!.metrics },
  },
  "plot-3": {
    scenario: "depleted-corn",
    crop: "tomatoes",
    daysToPlanting: Math.round(tomatoes.idealPrepDays * 1.2),
    metrics: { ...SCENARIOS.find((s) => s.id === "depleted-corn")!.metrics },
  },
  "plot-4": {
    scenario: "healthy-managed",
    crop: "strawberries",
    daysToPlanting: strawberries.idealPrepDays,
    metrics: { ...SCENARIOS.find((s) => s.id === "healthy-managed")!.metrics },
  },
};

type SoilStore = {
  activePlot: PlotId;
  plots: Record<PlotId, PlotState>;

  scanState: ScanState;
  scanProgress: number;

  // Plot management
  setActivePlot: (id: PlotId) => void;

  // Per-plot setters (operate on the active plot)
  setScenario: (id: ScenarioId) => void;
  setCrop: (id: CropId) => void;
  setDaysToPlanting: (n: number) => void;
  setMetric: (key: MetricKey, value: number) => void;
  resetMetricsFromScenario: () => void;

  // Scan
  startScan: () => void;
  tickScan: () => void;
  finishScan: () => void;

  // Convenience selectors (computed on the fly in selectors below)
};

export const useSoilStore = create<SoilStore>((set, get) => {
  const updateActive = (patch: (p: PlotState) => Partial<PlotState>) =>
    set((state) => {
      const current = state.plots[state.activePlot];
      return {
        plots: {
          ...state.plots,
          [state.activePlot]: { ...current, ...patch(current) },
        },
      };
    });

  return {
    activePlot: "plot-4",
    plots: PLOT_DEFAULTS,

    scanState: "idle",
    scanProgress: 0,

    setActivePlot: (id) => set({ activePlot: id, scanState: "idle", scanProgress: 0 }),

    setScenario: (id) => {
      const s = SCENARIOS.find((x) => x.id === id);
      if (!s) return;
      updateActive(() => ({ scenario: id, metrics: { ...s.metrics } }));
    },
    setCrop: (id) => {
      const c = CROPS.find((x) => x.id === id);
      if (!c) return;
      updateActive((p) => ({
        crop: id,
        daysToPlanting: Math.min(p.daysToPlanting, c.maxPrepDays),
      }));
    },
    setDaysToPlanting: (n) => updateActive(() => ({ daysToPlanting: n })),
    setMetric: (key, value) =>
      updateActive((p) => ({ metrics: { ...p.metrics, [key]: value } })),
    resetMetricsFromScenario: () => {
      const p = get().plots[get().activePlot];
      const s = SCENARIOS.find((x) => x.id === p.scenario);
      if (s) updateActive(() => ({ metrics: { ...s.metrics } }));
    },

    startScan: () => set({ scanState: "scanning", scanProgress: 0 }),
    tickScan: () =>
      set((s) => ({
        scanProgress: Math.min(100, s.scanProgress + 7 + Math.random() * 6),
      })),
    finishScan: () => {
      const state = get();
      const plot = state.plots[state.activePlot];
      const s = SCENARIOS.find((x) => x.id === plot.scenario)!;
      set({
        scanState: "done",
        scanProgress: 100,
        plots: {
          ...state.plots,
          [state.activePlot]: {
            ...plot,
            metrics: {
              ...plot.metrics,
              om: s.scanReadout.om,
              drainage: s.scanReadout.drainage,
            },
          },
        },
      });
    },
  };
});

/** Backwards-compatible selectors for the active plot. */
export const useActivePlotState = () =>
  useSoilStore((s) => s.plots[s.activePlot]);

export const useSelectedScenario = () =>
  useSoilStore((s) => s.plots[s.activePlot].scenario);
export const useSelectedCrop = () =>
  useSoilStore((s) => s.plots[s.activePlot].crop);
export const useDaysToPlanting = () =>
  useSoilStore((s) => s.plots[s.activePlot].daysToPlanting);
export const useSoilMetrics = () =>
  useSoilStore((s) => s.plots[s.activePlot].metrics);

/** Derived selectors — all computed reactively from the active plot's state. */
export function useDerived() {
  const plot = useActivePlotState();
  const scenario = SCENARIOS.find((s) => s.id === plot.scenario)!;
  const crop = CROPS.find((c) => c.id === plot.crop)!;
  const diag = diagnose(plot.metrics, crop, scenario, plot.daysToPlanting);
  const actions = rankActions(diag, crop);
  const plan = buildPlan(actions, crop);
  const futures = counterfactuals(diag, actions);

  return { scenario, crop, diag, actions, plan, futures };
}
