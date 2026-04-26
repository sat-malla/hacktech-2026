import type { CropProfile, Scenario, MetricKey } from "./types";

export const METRIC_LABELS: Record<MetricKey, { label: string; unit: string; fact: string }> = {
  nitrogen: {
    label: "Nitrogen",
    unit: "ppm",
    fact: "Corn pulls roughly 1 lb of N per bushel of grain produced.",
  },
  moisture: {
    label: "Moisture",
    unit: "%",
    fact: "Field capacity for most loams sits around 25–35%.",
  },
  drainage: {
    label: "Drainage",
    unit: "/10",
    fact: "Compacted clay below 4/10 drainage stunts root depth by 30–50%.",
  },
  om: {
    label: "Organic Matter",
    unit: "%",
    fact: "1% organic matter holds ~27,000 gallons of water per acre.",
  },
  conductivity: {
    label: "EC",
    unit: "dS/m",
    fact: "Above 4 dS/m most vegetables lose yield to salinity stress.",
  },
  temp: {
    label: "Soil Temp",
    unit: "°F",
    fact: "Corn germination stalls below 50°F soil temperature.",
  },
  co2: {
    label: "CO₂ Respiration",
    unit: "ppm/d",
    fact: "Higher CO₂ flux means microbes are actively cycling nutrients.",
  },
};

export const CROPS: CropProfile[] = [
  {
    id: "tomatoes",
    name: "Tomatoes",
    group: "quick-veg",
    maxPrepDays: 90,
    targets: {
      nitrogen: { min: 18, max: 35 },
      moisture: { min: 20, max: 30 },
      drainage: { min: 7, max: 10 },
      om: { min: 4, max: 8 },
      conductivity: { min: 0.5, max: 2.5 },
      temp: { min: 60, max: 80 },
      co2: { min: 30, max: 70 },
    },
    sensitivity: { drainage: 0.9, om: 0.8, conductivity: 0.6 },
    idealPrepDays: 35,
  },
  {
    id: "strawberries",
    name: "Strawberries",
    group: "quick-veg",
    maxPrepDays: 120,
    targets: {
      nitrogen: { min: 15, max: 30 },
      moisture: { min: 22, max: 32 },
      drainage: { min: 7, max: 10 },
      om: { min: 4, max: 8 },
      conductivity: { min: 0.4, max: 1.8 },
      temp: { min: 55, max: 78 },
      co2: { min: 30, max: 75 },
    },
    sensitivity: { drainage: 0.85, om: 0.75, conductivity: 0.7 },
    idealPrepDays: 50,
  },
];

function buildTrend(
  base: { co2: number; moisture: number },
  drift: { co2: number; moisture: number },
  noise = 4,
) {
  return Array.from({ length: 30 }, (_, i) => {
    const t = i / 29;
    const wobble = Math.sin(i * 0.7) * noise;
    return {
      day: i + 1,
      co2: Math.max(5, Math.round(base.co2 + drift.co2 * t + wobble)),
      moisture: Math.max(
        2,
        Math.round((base.moisture + drift.moisture * t + Math.cos(i * 0.5) * 1.5) * 10) / 10,
      ),
    };
  });
}

export const SCENARIOS: Scenario[] = [
  {
    id: "depleted-corn",
    name: "Depleted Corn Field",
    story:
      "A 40-acre Iowa plot worked continuously for 6 seasons of corn-on-corn. Organic matter has been mined out and microbial respiration is fading.",
    metrics: {
      nitrogen: 12,
      moisture: 18,
      drainage: 6,
      om: 1.4,
      conductivity: 0.3,
      temp: 58,
      co2: 22,
    },
    trend: buildTrend({ co2: 38, moisture: 22 }, { co2: -16, moisture: -4 }, 3),
    scanReadout: {
      soilType: "Silt Loam",
      om: 1.4,
      drainage: 6,
      confidence: 92,
    },
  },
  {
    id: "waterlogged-clay",
    name: "Waterlogged Clay",
    story:
      "Heavy clay backyard plot in a low-drainage spot. Three weeks of rain left it saturated. Roots are starving for oxygen.",
    metrics: {
      nitrogen: 22,
      moisture: 48,
      drainage: 2,
      om: 2.8,
      conductivity: 1.2,
      temp: 54,
      co2: 18,
    },
    trend: buildTrend({ co2: 22, moisture: 36 }, { co2: -4, moisture: 12 }, 4),
    scanReadout: {
      soilType: "Heavy Clay",
      om: 2.8,
      drainage: 2,
      confidence: 88,
    },
  },
  {
    id: "average-bed",
    name: "Average Raised Bed",
    story:
      "A two-year-old raised bed with store-bought topsoil. Decent baseline but uninspiring biology — typical suburban garden.",
    metrics: {
      nitrogen: 24,
      moisture: 24,
      drainage: 7,
      om: 3.2,
      conductivity: 0.9,
      temp: 64,
      co2: 38,
    },
    trend: buildTrend({ co2: 36, moisture: 24 }, { co2: 4, moisture: 0 }, 3),
    scanReadout: {
      soilType: "Loam",
      om: 3.2,
      drainage: 7,
      confidence: 95,
    },
  },
  {
    id: "healthy-managed",
    name: "Healthy Managed Soil",
    story:
      "Three years of cover cropping and compost. Living roots year-round, strong aggregate structure, microbes humming.",
    metrics: {
      nitrogen: 32,
      moisture: 26,
      drainage: 8,
      om: 5.4,
      conductivity: 1.1,
      temp: 68,
      co2: 62,
    },
    trend: buildTrend({ co2: 48, moisture: 24 }, { co2: 18, moisture: 3 }, 3),
    scanReadout: {
      soilType: "Sandy Loam",
      om: 5.4,
      drainage: 8,
      confidence: 97,
    },
  },
];

export const METRIC_BOUNDS: Record<MetricKey, { min: number; max: number; step: number }> = {
  nitrogen: { min: 0, max: 80, step: 1 },
  moisture: { min: 0, max: 70, step: 0.5 },
  drainage: { min: 0, max: 10, step: 0.1 },
  om: { min: 0, max: 10, step: 0.1 },
  conductivity: { min: 0, max: 6, step: 0.1 },
  temp: { min: 30, max: 100, step: 1 },
  co2: { min: 0, max: 100, step: 1 },
};
