import { useEffect, useRef, useState } from "react";
import deviceImg from "@/assets/soil-compass-device.png";

/**
 * Cinematic device reveal:
 *  Stage 0 — wide view of the whole device
 *  Stage 1 — zoom + highlight solar panel
 *  Stage 2 — zoom + highlight controller body
 *  Stage 3 — zoom + highlight probe sensor slits
 *  Stage 4 — zoom + highlight ground-piercing tip
 *  Loops every 20s with smooth scale + translate transitions.
 *
 * Each stage emits a `cinema-stage` window event so the page can
 * sync a side panel with the device part being inspected.
 */

interface Stage {
  label: string;
  sub: string;
  // Focus point in % of image (0–100)
  fx: number;
  fy: number;
  scale: number;
  // Overlay highlight box in % of original image
  box: { x: number; y: number; w: number; h: number };
  parts: { name: string; spec: string }[];
}

const STAGES: Stage[] = [
  {
    label: "Soil Compass · Model 01",
    sub: "Field-ready solar sensor probe",
    fx: 50,
    fy: 50,
    scale: 1,
    box: { x: 30, y: 8, w: 40, h: 84 },
    parts: [
      { name: "Solar collector", spec: "12-cell monocrystalline" },
      { name: "Controller body", spec: "IP67 sealed enclosure" },
      { name: "Sensor probe", spec: "TDR moisture + temp" },
      { name: "Anchoring tip", spec: "ABS · 14 cm depth" },
    ],
  },
  {
    label: "Solar collector",
    sub: "Powers the unit indefinitely in daylight",
    fx: 50,
    fy: 18,
    scale: 2.4,
    box: { x: 32, y: 8, w: 36, h: 22 },
    parts: [
      { name: "Cells", spec: "12 × monocrystalline silicon" },
      { name: "Output", spec: "5V · 220mA peak" },
      { name: "Tilt frame", spec: "fixed 15° south-facing" },
    ],
  },
  {
    label: "Controller body",
    sub: "Brain of the device — radio + battery",
    fx: 50,
    fy: 38,
    scale: 2.6,
    box: { x: 38, y: 28, w: 24, h: 22 },
    parts: [
      { name: "MCU", spec: "ESP32-S3 · LoRa 868 MHz" },
      { name: "Battery", spec: "Li-ion 1200 mAh" },
      { name: "Sensors", spec: "BME280 air temp · humidity" },
    ],
  },
  {
    label: "Sensor probe",
    sub: "Reads what's happening underground",
    fx: 50,
    fy: 62,
    scale: 2.8,
    box: { x: 40, y: 50, w: 20, h: 30 },
    parts: [
      { name: "Moisture slits", spec: "TDR dielectric · 0–100%" },
      { name: "Soil temp", spec: "DS18B20 · ±0.5°C" },
      { name: "EC sensor", spec: "0–10 mS/cm fertility index" },
    ],
  },
  {
    label: "Anchoring tip",
    sub: "Pierces compacted soil at planting",
    fx: 50,
    fy: 88,
    scale: 3.2,
    box: { x: 44, y: 80, w: 12, h: 16 },
    parts: [
      { name: "Material", spec: "Reinforced ABS polymer" },
      { name: "Depth marker", spec: "calibrated to 14 cm" },
    ],
  },
];

const LOOP_MS = 20000;
const STAGE_MS = LOOP_MS / STAGES.length;

export default function DeviceCinematic() {
  const [stage, setStage] = useState(0);
  const [ready, setReady] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    // Mark ready on next frame so the first paint shows stage 0 instantly
    // without playing the long zoom transition from a default state.
    const id = requestAnimationFrame(() => {
      setReady(true);
      startRef.current = performance.now();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - startRef.current) % LOOP_MS;
      const next = Math.floor(t / STAGE_MS);
      setStage((curr) => (curr !== next ? next : curr));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  // Dispatch stage change in an effect (not during render) to avoid
  // "Cannot update a component while rendering a different component".
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("cinema-stage", { detail: stage }));
  }, [stage]);

  const s = STAGES[stage];

  // Translate so focus point lands at center of viewport, then scale.
  // We use transform-origin: top-left and apply translate first.
  const tx = 50 - s.fx * s.scale;
  const ty = 50 - s.fy * s.scale;

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Subtle radial vignette */}
      <div className="absolute inset-0 radial-vignette pointer-events-none" />
      <div className="absolute inset-0 topo-grid opacity-30 pointer-events-none" />

      {/* Device image — animated zoom */}
      <div
        className="absolute inset-0 transition-transform duration-[2400ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
        style={{
          transform: `translate(${tx}%, ${ty}%) scale(${s.scale})`,
          transformOrigin: "0% 0%",
        }}
      >
        <img
          src={deviceImg}
          alt="Soil Compass device — solar panel, controller body, sensor probe and tip"
          fetchPriority="high"
          decoding="async"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[95%] w-auto object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
        />

        {/* Highlight ring around current part */}
        <div
          className="absolute border border-copper/70 rounded-[2px] transition-all duration-[2400ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
          style={{
            left: `${s.box.x}%`,
            top: `${s.box.y}%`,
            width: `${s.box.w}%`,
            height: `${s.box.h}%`,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45) inset, 0 0 30px rgba(122,168,74,0.25)",
          }}
        />
        {/* Corner ticks on the highlight */}
        {(["tl", "tr", "bl", "br"] as const).map((corner) => {
          const map = {
            tl: { left: s.box.x, top: s.box.y, b: "border-l border-t" },
            tr: { left: s.box.x + s.box.w, top: s.box.y, b: "border-r border-t" },
            bl: { left: s.box.x, top: s.box.y + s.box.h, b: "border-l border-b" },
            br: { left: s.box.x + s.box.w, top: s.box.y + s.box.h, b: "border-r border-b" },
          }[corner];
          const offset = corner.includes("r") ? "-translate-x-full" : "";
          const offsetY = corner.includes("b") ? "-translate-y-full" : "";
          return (
            <div
              key={corner}
              className={`absolute w-3 h-3 ${map.b} border-copper transition-all duration-[2400ms] ${offset} ${offsetY}`}
              style={{ left: `${map.left}%`, top: `${map.top}%` }}
            />
          );
        })}
      </div>

      {/* Stage progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-border/40">
        <div
          key={`p${stage}`}
          className="h-full bg-copper"
          style={{ animation: `cinema-progress ${STAGE_MS}ms linear forwards` }}
        />
      </div>

      {/* Top-center stage label — backdrop pill so it stays readable over the white device */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 text-center fade-up" key={`label${stage}`}>
        <div className="inline-block backdrop-blur-md bg-black/70 border border-border rounded-sm px-4 py-2">
          <div className="text-[10px] font-mono-tight tracking-[0.4em] uppercase text-copper">
            ◦ Stage {String(stage + 1).padStart(2, "0")} / {String(STAGES.length).padStart(2, "0")}
          </div>
          <div className="font-display font-light text-xl md:text-2xl mt-1 text-foreground">
            {s.label}
          </div>
          <div className="text-[10px] font-mono-tight tracking-[0.2em] uppercase text-muted-foreground mt-1">
            {s.sub}
          </div>
        </div>
      </div>

      {/* Stage dots (bottom center) — click to jump */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-row gap-3">
        {STAGES.map((st, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Jump to stage ${i + 1}: ${st.label}`}
            onClick={() => {
              setStage(i);
              startRef.current = performance.now() - i * STAGE_MS;
            }}
            className={`h-1.5 transition-all duration-500 rounded-full cursor-pointer hover:bg-copper ${
              i === stage ? "w-10 bg-copper" : "w-4 bg-muted-foreground/40"
            }`}
          />
        ))}
      </div>

      <style>{`
        @keyframes cinema-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes scan-sweep {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.7; }
          100% { top: 100%; opacity: 0; }
        }
        .scan-sweep {
          animation: scan-sweep ${STAGE_MS}ms linear;
        }
      `}</style>
    </div>
  );
}
