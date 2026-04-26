import { useEffect, useState } from "react";

export interface HistoryPoint {
  label: string;
  moisture: number;
  temperature: number;
  waterLevel: number;
}

interface RawReading {
  id: number;
  timestamp: string;
  soil_moisture: number;
  air_temperature: number;
  water_level: number;
}

const API_BASE = "http://localhost:8081";
const FETCH_LIMIT = 200;

function labelFor(ts: string, spanMs: number): string {
  const d = new Date(ts);
  if (spanMs < 2 * 60 * 60 * 1000) {
    // < 2 hours: show HH:MM
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (spanMs < 3 * 24 * 60 * 60 * 1000) {
    // < 3 days: show "Mon 14:00"
    return d.toLocaleDateString([], { weekday: "short" }) + " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  // >= 3 days: show "Apr 21"
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Reduce to at most `maxPoints` evenly-spaced samples
function downsample(rows: RawReading[], maxPoints: number): RawReading[] {
  if (rows.length <= maxPoints) return rows;
  const step = rows.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, i) => rows[Math.round(i * step)]);
}

export function useHistoricalReadings(maxPoints = 24) {
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `${API_BASE}/api/db/readings?order_by=timestamp&order_desc=false&limit=${FETCH_LIMIT}&select=id,timestamp,soil_moisture,air_temperature,water_level`
        );
        if (!res.ok || cancelled) return;
        const json: { success: boolean; data: RawReading[] } = await res.json();
        const rows = json.data ?? [];
        if (!rows.length) return;

        const first = new Date(rows[0].timestamp).getTime();
        const last = new Date(rows[rows.length - 1].timestamp).getTime();
        const spanMs = last - first;

        const sampled = downsample(rows, maxPoints);
        setData(
          sampled.map((r) => ({
            label: labelFor(r.timestamp, spanMs),
            moisture: Math.round(r.soil_moisture),
            temperature: Math.round(r.air_temperature * 10) / 10,
            waterLevel: Math.round(r.water_level),
          }))
        );
      } catch {
        // backend unreachable — chart will show generated placeholder data
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [maxPoints]);

  return { data, loading };
}
