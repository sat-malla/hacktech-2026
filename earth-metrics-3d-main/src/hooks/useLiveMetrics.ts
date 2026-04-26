import { useEffect, useState } from "react";

export interface LiveMetrics {
  moisture: number;
  temperature: number;
  soilTemperature: number;
  waterLevel: number;
  drainage: number;
  humidity: number;
  methane: number;
  weather: string;
  weatherHumidity: number;
  weatherWind: number;
  orientation: number;
  depth: number;
  gps: string;
  history: { moisture: number; temperature: number; waterLevel: number }[];
  stale: boolean;
}

interface Reading {
  id: number;
  timestamp: string;
  monitor_id: number;
  soil_moisture: number;
  air_temperature: number;
  soil_temperature: number;
  water_level: number;
  drainage: number;
  humidity: number | null;
  methane: number | null;
  plant_species: string;
}

const API_BASE = "http://localhost:8081";
const POLL_MS = 5_000;
const HISTORY_SIZE = 20;

const PLACEHOLDER: LiveMetrics = {
  moisture: 0,
  temperature: 0,
  soilTemperature: 0,
  waterLevel: 0,
  drainage: 0,
  humidity: 0,
  methane: 0,
  weather: "—",
  weatherHumidity: 0,
  weatherWind: 0,
  orientation: 0,
  depth: 0,
  gps: "—",
  history: Array.from({ length: HISTORY_SIZE }, () => ({ moisture: 0, temperature: 0, waterLevel: 0 })),
  stale: true,
};

function toMetrics(rows: Reading[], prev: LiveMetrics): LiveMetrics {
  if (!rows.length) return prev;
  const latest = rows[0];
  const chrono = [...rows].reverse();
  const history = chrono.map((r) => ({ moisture: r.soil_moisture, temperature: r.air_temperature, waterLevel: r.water_level }));
  while (history.length < HISTORY_SIZE) history.unshift(history[0]);
  return {
    ...prev,
    moisture: latest.soil_moisture,
    temperature: latest.air_temperature,
    soilTemperature: latest.soil_temperature,
    waterLevel: latest.water_level,
    drainage: latest.drainage,
    humidity: latest.humidity ?? 0,
    methane: latest.methane ?? 0,
    history: history.slice(-HISTORY_SIZE),
    stale: false,
  };
}

export function useLiveMetrics(_intervalMs?: number): LiveMetrics {
  const [metrics, setMetrics] = useState<LiveMetrics>(PLACEHOLDER);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(
          `${API_BASE}/api/db/readings?order_by=timestamp&order_desc=true&limit=${HISTORY_SIZE}`
        );
        if (!res.ok || cancelled) return;
        const json: { success: boolean; data: Reading[] } = await res.json();
        const rows = json.data ?? [];
        if (rows.length) setMetrics((prev) => toMetrics(rows, prev));
      } catch (e) {
        console.error("[useLiveMetrics] poll failed:", e);
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return metrics;
}
