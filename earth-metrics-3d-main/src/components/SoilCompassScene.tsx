import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Environment, ContactShadows, Sky } from "@react-three/drei";
import * as THREE from "three";

/**
 * Realistic farm field visualization:
 * - Tilled soil plot with displaced furrows
 * - Layered crop plants (stalks + leaves) growing in rows
 * - Sensor probes with metal/plastic PBR materials
 * - Sky + environment lighting + soft contact shadows
 * - Subtle wind sway on the crops
 */

interface SceneProps {
  metrics: {
    moisture: number;
    temperature: number;
    waterLevel: number;
    weather: string;
    orientation: number;
    depth: number;
    gps: string;
  };
  riskLevel: "low" | "medium" | "high";
  showMetrics?: boolean;
  compact?: boolean;
}

const RISK_COLORS = {
  low: "#7aa84a",
  medium: "#d4a84a",
  high: "#e54d2e",
};

/* ---------- A single realistic crop plant ---------- */
function CropPlant({
  position,
  scale = 1,
  health = 1,
  seed = 0,
}: {
  position: [number, number, number];
  scale?: number;
  health?: number; // 0..1 (1 = healthy green, 0 = dry yellow)
  seed?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const stalkColor = useMemo(() => {
    const healthy = new THREE.Color("#4a7a28");
    const dry = new THREE.Color("#9a8838");
    return healthy.clone().lerp(dry, 1 - health);
  }, [health]);
  const leafColor = useMemo(() => {
    const healthy = new THREE.Color("#5fa83a");
    const dry = new THREE.Color("#b09838");
    return healthy.clone().lerp(dry, 1 - health);
  }, [health]);

  useFrame((state) => {
    if (group.current) {
      const t = state.clock.elapsedTime;
      group.current.rotation.z = Math.sin(t * 0.8 + seed) * 0.05;
      group.current.rotation.x = Math.cos(t * 0.6 + seed * 1.3) * 0.03;
    }
  });

  // Pre-compute leaf placements
  const leaves = useMemo(() => {
    const arr: { y: number; rotY: number; tilt: number; size: number }[] = [];
    const count = 4 + Math.floor((seed * 7) % 3);
    for (let i = 0; i < count; i++) {
      arr.push({
        y: 0.08 + i * 0.06,
        rotY: (i / count) * Math.PI * 2 + seed,
        tilt: 0.5 + Math.sin(i + seed) * 0.15,
        size: 0.09 + ((i * 13 + seed * 7) % 5) * 0.012,
      });
    }
    return arr;
  }, [seed]);

  return (
    <group ref={group} position={position} scale={scale}>
      {/* Main stalk */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.018, 0.36, 6]} />
        <meshStandardMaterial color={stalkColor} roughness={0.9} />
      </mesh>
      {/* Leaves */}
      {leaves.map((l, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(l.rotY) * 0.04,
            l.y,
            Math.sin(l.rotY) * 0.04,
          ]}
          rotation={[l.tilt, l.rotY, 0]}
          castShadow
        >
          <coneGeometry args={[l.size * 0.5, l.size * 2.2, 4]} />
          <meshStandardMaterial
            color={leafColor}
            roughness={0.75}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* Top sprout */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <coneGeometry args={[0.04, 0.14, 6]} />
        <meshStandardMaterial color={leafColor} roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ---------- The tilled field ---------- */
function FieldPlot() {
  // Soil noise displacement
  const soilGeom = useMemo(() => {
    const g = new THREE.PlaneGeometry(5, 5, 60, 60);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      // ridges along z (rows) + noise
      const ridge = Math.sin(x * 6) * 0.025;
      const noise = (Math.random() - 0.5) * 0.012;
      pos.setZ(i, ridge + noise);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  // Generate plant positions in 8 rows
  const plants = useMemo(() => {
    const arr: {
      pos: [number, number, number];
      scale: number;
      health: number;
      seed: number;
    }[] = [];
    const rows = 8;
    const perRow = 14;
    for (let r = 0; r < rows; r++) {
      for (let p = 0; p < perRow; p++) {
        const x = (r - rows / 2 + 0.5) * 0.55;
        const z = (p - perRow / 2 + 0.5) * 0.34;
        // hotspot near +x, -z corner
        const distFromHotspot = Math.hypot(r - 6.5, p - 1.5) / 9;
        const health = Math.min(1, Math.max(0.25, distFromHotspot * 1.1));
        arr.push({
          pos: [x + (Math.random() - 0.5) * 0.06, 0, z + (Math.random() - 0.5) * 0.06],
          scale: 0.85 + Math.random() * 0.3,
          health,
          seed: Math.random() * 10,
        });
      }
    }
    return arr;
  }, []);

  return (
    <group position={[0, -0.6, 0]}>
      {/* Sub-soil slab */}
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <boxGeometry args={[5.2, 0.32, 5.2]} />
        <meshStandardMaterial color="#2a1a0e" roughness={1} />
      </mesh>

      {/* Tilled soil top with ridges */}
      <mesh
        geometry={soilGeom}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color="#3d2814"
          roughness={1}
          metalness={0}
          flatShading
        />
      </mesh>

      {/* Damp patches (darker spots) */}
      {Array.from({ length: 6 }).map((_, i) => {
        const x = (Math.random() - 0.5) * 4;
        const z = (Math.random() - 0.5) * 4;
        const s = 0.4 + Math.random() * 0.5;
        return (
          <mesh
            key={`damp${i}`}
            position={[x, 0.005, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[s, 16]} />
            <meshStandardMaterial
              color="#1f1408"
              roughness={1}
              transparent
              opacity={0.55}
            />
          </mesh>
        );
      })}

      {/* Crops */}
      {plants.map((p, i) => (
        <CropPlant
          key={`p${i}`}
          position={p.pos}
          scale={p.scale}
          health={p.health}
          seed={p.seed}
        />
      ))}

      {/* Wooden field posts at corners */}
      {[
        [-2.55, -2.55],
        [2.55, -2.55],
        [-2.55, 2.55],
        [2.55, 2.55],
      ].map((p, i) => (
        <mesh key={`post${i}`} position={[p[0], 0.2, p[1]]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.5, 8]} />
          <meshStandardMaterial color="#5a3a1c" roughness={0.95} />
        </mesh>
      ))}

      {/* Wire between posts */}
      {[
        [[-2.55, -2.55], [2.55, -2.55]],
        [[2.55, -2.55], [2.55, 2.55]],
        [[2.55, 2.55], [-2.55, 2.55]],
        [[-2.55, 2.55], [-2.55, -2.55]],
      ].map((seg, i) => {
        const [a, b] = seg;
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const len = Math.hypot(dx, dz);
        const cx = (a[0] + b[0]) / 2;
        const cz = (a[1] + b[1]) / 2;
        const angle = Math.atan2(dz, dx);
        return (
          <mesh
            key={`wire${i}`}
            position={[cx, 0.32, cz]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[len, 0.005, 0.005]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ---------- Risk heatmap overlay ---------- */
function RiskHeatmap() {
  const tiles = useMemo(() => {
    const arr: { pos: [number, number, number]; risk: number }[] = [];
    const N = 10;
    for (let x = 0; x < N; x++) {
      for (let z = 0; z < N; z++) {
        const distFromHotspot = Math.hypot(x - 8, z - 1.5) / 10;
        const risk = Math.max(0, 1 - distFromHotspot);
        if (risk < 0.18) continue;
        arr.push({
          pos: [(x - N / 2 + 0.5) * 0.5, 0, (z - N / 2 + 0.5) * 0.5],
          risk,
        });
      }
    }
    return arr;
  }, []);

  return (
    <group position={[0, -0.58, 0]}>
      {tiles.map((t, i) => {
        const color =
          t.risk > 0.65
            ? RISK_COLORS.high
            : t.risk > 0.38
            ? RISK_COLORS.medium
            : RISK_COLORS.low;
        return (
          <mesh
            key={`heat${i}`}
            position={[t.pos[0], 0.04, t.pos[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.45, 0.45]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={t.risk * 0.28}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/* ---------- Sensor probe ---------- */
function SensorProbe({
  position,
  active = false,
}: {
  position: [number, number, number];
  active?: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ringRef.current && active) {
      const t = state.clock.elapsedTime;
      const s = 1 + Math.sin(t * 1.6) * 0.2;
      ringRef.current.scale.set(s, 1, s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.3 + Math.sin(t * 1.6) * 0.2;
    }
  });

  return (
    <group position={position}>
      {/* Buried section (visible band) */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.028, 0.1, 12]} />
        <meshStandardMaterial color="#888" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* Pole */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.4, 12]} />
        <meshStandardMaterial color="#d8d8d8" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Sensor head */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.14, 0.1, 0.1]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Solar panel on top */}
      <mesh position={[0, 0.56, 0]} rotation={[-0.2, 0, 0]} castShadow>
        <boxGeometry args={[0.16, 0.005, 0.12]} />
        <meshStandardMaterial color="#1a3658" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* LED */}
      <mesh position={[0, 0.51, 0.052]}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshStandardMaterial
          color={active ? "#7aff4a" : "#a8c8e8"}
          emissive={active ? "#7aff4a" : "#a8c8e8"}
          emissiveIntensity={active ? 2 : 1}
        />
      </mesh>
      {/* Pulsing ring on active */}
      {active && (
        <mesh
          ref={ringRef}
          position={[0, 0.52, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.07, 0.095, 24]} />
          <meshBasicMaterial color="#7aff4a" transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  );
}

interface MetricTagProps {
  position: [number, number, number];
  label: string;
  value: string;
  color?: string;
}

function MetricTag({ position, label, value, color = "copper" }: MetricTagProps) {
  return (
    <Html position={position} center distanceFactor={9} zIndexRange={[10, 0]}>
      <div className="pointer-events-none select-none">
        <div
          className={`px-2.5 py-1 rounded-sm border bg-background/85 backdrop-blur-sm whitespace-nowrap ${
            color === "cyan" ? "border-cyan-data/40" : "border-copper/40"
          }`}
        >
          <div className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </div>
          <div
            className={`font-mono-tight text-[11px] ${
              color === "cyan" ? "text-cyan-data" : "text-copper"
            }`}
          >
            {value}
          </div>
        </div>
      </div>
    </Html>
  );
}

function GentleRotate({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.4;
    }
  });
  return <group ref={ref}>{children}</group>;
}

export default function SoilCompassScene({
  metrics,
  riskLevel,
  showMetrics = true,
  compact = false,
}: SceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [4.5, 4.2, 5.5], fov: 36 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
    >
      <Sky
        distance={450000}
        sunPosition={[8, 6, 4]}
        inclination={0.48}
        azimuth={0.25}
        turbidity={6}
        rayleigh={2.2}
      />
      <fog attach="fog" args={["#b8c4a8", 14, 30]} />

      {/* Sun + sky fill */}
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[8, 10, 4]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        color="#fff4d8"
      />
      <hemisphereLight args={["#a8c8e8", "#3d2818", 0.5]} />

      <Suspense fallback={null}>
        <Environment preset="park" />

        <GentleRotate>
          <FieldPlot />
          <RiskHeatmap />

          {/* Sensor probes scattered across the field */}
          <SensorProbe position={[-1.7, -0.55, -1.3]} active />
          <SensorProbe position={[1.4, -0.55, 0.4]} />
          <SensorProbe position={[0.2, -0.55, 1.7]} />
          <SensorProbe position={[1.8, -0.55, -1.6]} />

          {showMetrics && (
            <>
              <MetricTag
                position={[-2.8, 1.2, -1.5]}
                label="Soil Moisture"
                value={`${metrics.moisture.toFixed(0)}%`}
                color="cyan"
              />
              <MetricTag
                position={[2.8, 1.4, -1.5]}
                label="Air Temp"
                value={`${metrics.temperature.toFixed(1)}°F`}
                color="copper"
              />
              <MetricTag
                position={[-2.8, 0.6, 1.5]}
                label="Water Level"
                value={`${metrics.waterLevel.toFixed(0)} cm`}
                color="cyan"
              />
              <MetricTag
                position={[2.8, 0.7, 1.5]}
                label="Weather"
                value={metrics.weather}
                color="copper"
              />
              {!compact && (
                <MetricTag
                  position={[0, 2.6, 0]}
                  label={`${riskLevel.toUpperCase()} RISK ZONE`}
                  value={metrics.gps}
                  color={riskLevel === "high" ? "copper" : "cyan"}
                />
              )}
            </>
          )}
        </GentleRotate>

        {/* Soft contact shadow under everything */}
        <ContactShadows
          position={[0, -0.78, 0]}
          opacity={0.55}
          scale={12}
          blur={2.5}
          far={3}
          color="#000"
        />
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={!compact}
        minDistance={5}
        maxDistance={12}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
      />
    </Canvas>
  );
}
