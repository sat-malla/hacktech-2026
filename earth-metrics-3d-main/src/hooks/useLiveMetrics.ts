import { useEffect, useState } from "react";

export interface LiveMetrics {
  moisture: number;
  temperature: number;
  waterLevel: number;
  weather: string;
  weatherHumidity: number;
  weatherWind: number;
  orientation: number;
  depth: number;
  gps: string;
  history: { moisture: number; temperature: number }[];
}

const WEATHER_CONDITIONS = ["Clear", "Cloudy", "Light rain", "Overcast", "Sunny"];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function drift(value: number, amount: number, min: number, max: number) {
  const next = value + (Math.random() - 0.5) * amount;
  return clamp(next, min, max);
}

export function useLiveMetrics(intervalMs = 1800): LiveMetrics {
  const [m, setM] = useState<LiveMetrics>({
    moisture: 42,
    temperature: 18.4,
    waterLevel: 26,
    weather: "Clear",
    weatherHumidity: 64,
    weatherWind: 8,
    orientation: 142,
    depth: 45,
    gps: "52.37°N · 4.89°E",
    history: Array.from({ length: 20 }, (_, i) => ({
      moisture: 40 + Math.sin(i / 3) * 5,
      temperature: 18 + Math.sin(i / 4) * 1.2,
    })),
  });

  useEffect(() => {
    const id = setInterval(() => {
      setM((prev) => {
        const moisture = drift(prev.moisture, 2.5, 25, 75);
        const temperature = drift(prev.temperature, 0.4, 12, 26);
        const waterLevel = drift(prev.waterLevel, 1.2, 10, 60);
        const orientation = (prev.orientation + (Math.random() - 0.5) * 4 + 360) % 360;
        const depth = drift(prev.depth, 0.6, 30, 70);
        const weather =
          Math.random() < 0.06
            ? WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)]
            : prev.weather;
        const weatherHumidity = drift(prev.weatherHumidity, 3, 40, 95);
        const weatherWind = drift(prev.weatherWind, 1.5, 0, 25);

        return {
          moisture,
          temperature,
          waterLevel,
          weather,
          weatherHumidity,
          weatherWind,
          orientation,
          depth,
          gps: prev.gps,
          history: [...prev.history.slice(1), { moisture, temperature }],
        };
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return m;
}
