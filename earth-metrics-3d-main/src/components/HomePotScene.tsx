import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

/**
 * Home Garden scene — a single decorative terracotta pot on a windowsill
 * with a stylized leafy houseplant and a small Soil Compass probe.
 * Friendly, warm, room-scale (vs the field plot scene).
 */

interface SceneProps {
  metrics: {
    moisture: number;
    temperature: number;
    waterLevel: number;
    weather: string;
    weatherHumidity: number;
    orientation: number;
    depth: number;
    gps: string;
  };
  healthLevel: "thriving" | "okay" | "needs-care";
  showMetrics?: boolean;
}

const HEALTH_COLORS = {
  thriving: "#7aa84a",
  okay: "#d4a84a",
  "needs-care": "#e54d2e",
};

function TerracottaPot() {
  return (
    <group position={[0, -0.4, 0]}>
      {/* Saucer */}
      <mesh position={[0, -0.42, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.95, 0.85, 0.08, 32]} />
        <meshStandardMaterial color="#8a4a2a" roughness={0.85} />
      </mesh>
      {/* Pot body — tapered */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.82, 0.6, 0.78, 32]} />
        <meshStandardMaterial color="#b56a3a" roughness={0.9} />
      </mesh>
      {/* Rim */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.86, 0.82, 0.08, 32]} />
        <meshStandardMaterial color="#9c5a32" roughness={0.85} />
      </mesh>
      {/* Soil top */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.78, 0.78, 0.04, 32]} />
        <meshStandardMaterial color="#3a2614" roughness={1} />
      </mesh>
    </group>
  );
}

function Leaf({ angle, height, scale = 1 }: { angle: number; height: number; scale?: number }) {
  return (
    <group rotation={[0, angle, 0]}>
      <group rotation={[Math.PI / 2.6, 0, 0]} position={[0, height, 0.18 * scale]}>
        <mesh castShadow>
          <sphereGeometry args={[0.22 * scale, 12, 12]} />
          <meshStandardMaterial color="#5fa83a" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.22 * scale]} castShadow>
          <sphereGeometry args={[0.16 * scale, 10, 10]} />
          <meshStandardMaterial color="#7aa84a" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

function Houseplant() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.rotation.z = Math.sin(t * 0.6) * 0.025;
      groupRef.current.rotation.x = Math.cos(t * 0.5) * 0.02;
    }
  });

  // Deterministic leaf arrangement
  const leaves = useMemo(() => {
    const arr: { angle: number; height: number; scale: number }[] = [];
    const N = 9;
    for (let i = 0; i < N; i++) {
      arr.push({
        angle: (i / N) * Math.PI * 2,
        height: 0.55 + (i % 3) * 0.22,
        scale: 0.85 + (i % 4) * 0.08,
      });
    }
    return arr;
  }, []);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Stems */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.04, 0.55, Math.sin(a) * 0.04]}
            rotation={[Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1]}
            castShadow
          >
            <cylinderGeometry args={[0.025, 0.035, 1.0, 8]} />
            <meshStandardMaterial color="#4a6a2a" roughness={0.85} />
          </mesh>
        );
      })}
      {leaves.map((l, i) => (
        <Leaf key={i} angle={l.angle} height={l.height} scale={l.scale} />
      ))}
      {/* Flower bud accents */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        return (
          <mesh
            key={`bud${i}`}
            position={[Math.cos(a) * 0.18, 1.25, Math.sin(a) * 0.18]}
            castShadow
          >
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial
              color="#e8a84a"
              emissive="#e8a84a"
              emissiveIntensity={0.15}
              roughness={0.5}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function MiniProbe() {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ringRef.current) {
      const t = state.clock.elapsedTime;
      const s = 1 + Math.sin(t * 1.6) * 0.2;
      ringRef.current.scale.set(s, 1, s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.3 + Math.sin(t * 1.6) * 0.2;
    }
  });

  return (
    <group position={[0.4, 0.42, 0.2]}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.36, 10]} />
        <meshStandardMaterial color="#cccccc" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.09, 0.06, 0.06]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.41, 0.035]}>
        <sphereGeometry args={[0.014, 8, 8]} />
        <meshStandardMaterial color="#7aa84a" emissive="#7aa84a" emissiveIntensity={1.4} />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.07, 24]} />
        <meshBasicMaterial color="#7aa84a" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function Windowsill() {
  return (
    <group position={[0, -0.85, 0]}>
      {/* Sill plank */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[3.2, 0.12, 1.6]} />
        <meshStandardMaterial color="#c8a878" roughness={0.85} />
      </mesh>
      {/* Wall behind */}
      <mesh position={[0, 1.6, -0.85]} receiveShadow>
        <planeGeometry args={[3.2, 3.2]} />
        <meshStandardMaterial color="#1a1a14" roughness={1} />
      </mesh>
    </group>
  );
}

function MetricTag({
  position,
  label,
  value,
  color = "copper",
}: {
  position: [number, number, number];
  label: string;
  value: string;
  color?: "copper" | "cyan";
}) {
  return (
    <Html position={position} center distanceFactor={8} zIndexRange={[10, 0]}>
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
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.3;
    }
  });
  return <group ref={ref}>{children}</group>;
}

export default function HomePotScene({ metrics, healthLevel, showMetrics = true }: SceneProps) {
  const accent = HEALTH_COLORS[healthLevel];
  return (
    <Canvas
      shadows
      camera={{ position: [2.6, 2.2, 3.6], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={["#0d1108"]} />
      <fog attach="fog" args={["#0d1108", 8, 18]} />

      {/* Warm window light */}
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[4, 5, 3]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        color="#ffe2b8"
      />
      <pointLight position={[-3, 2, -1]} intensity={0.35} color="#a8c8e8" />
      <pointLight position={[1, 3, 2]} intensity={0.3} color={accent} />

      <Suspense fallback={null}>
        <GentleRotate>
          <Windowsill />
          <TerracottaPot />
          <Houseplant />
          <MiniProbe />

          {showMetrics && (
            <>
              <MetricTag
                position={[-1.3, 1.2, 0]}
                label="Soil Moisture"
                value={`${metrics.moisture.toFixed(0)}%`}
                color="cyan"
              />
              <MetricTag
                position={[1.4, 1.3, 0]}
                label="Room Temp"
                value={`${metrics.temperature.toFixed(1)}°F`}
                color="copper"
              />
              <MetricTag
                position={[-1.4, 0.1, 0.5]}
                label="Water"
                value={`${metrics.waterLevel.toFixed(0)} cm`}
                color="cyan"
              />
              <MetricTag
                position={[1.4, 0.2, 0.5]}
                label="Humidity"
                value={`${metrics.weatherHumidity.toFixed(0)}%`}
                color="copper"
              />
            </>
          )}
        </GentleRotate>

        {/* Soft floor glow */}
        <mesh position={[0, -0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 2.4, 64]} />
          <meshBasicMaterial color={accent} transparent opacity={0.08} />
        </mesh>
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={3}
        maxDistance={8}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
