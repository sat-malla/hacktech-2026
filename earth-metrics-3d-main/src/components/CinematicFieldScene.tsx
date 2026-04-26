import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Sky, ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";

/**
 * Auto-looping cinematic camera that flies:
 *   Stage 0 (0–25%):  Wide field view
 *   Stage 1 (25–50%): Zoom into a single plant
 *   Stage 2 (50–80%): Dive underground into a soil cross-section
 *   Stage 3 (80–100%): Pull out back to wide
 *
 * Cross-section reveals soil layers, roots, and animated water droplets
 * percolating down. A live moisture bar reacts to the device reading.
 */

interface SceneProps {
  metrics: {
    moisture: number;
    temperature: number;
    waterLevel: number;
    weather: string;
    gps: string;
  };
}

const LOOP_SECONDS = 18;

/* ---------- Crop plant ---------- */
function CropPlant({
  position,
  scale = 1,
  seed = 0,
  hero = false,
}: {
  position: [number, number, number];
  scale?: number;
  seed?: number;
  hero?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) {
      const t = state.clock.elapsedTime;
      group.current.rotation.z = Math.sin(t * 0.8 + seed) * 0.05;
      group.current.rotation.x = Math.cos(t * 0.6 + seed * 1.3) * 0.03;
    }
  });

  const leaves = useMemo(() => {
    const arr: { y: number; rotY: number; tilt: number; size: number }[] = [];
    const count = hero ? 8 : 5;
    for (let i = 0; i < count; i++) {
      arr.push({
        y: 0.08 + i * 0.06,
        rotY: (i / count) * Math.PI * 2 + seed,
        tilt: 0.5 + Math.sin(i + seed) * 0.15,
        size: 0.09 + ((i * 13 + seed * 7) % 5) * 0.012,
      });
    }
    return arr;
  }, [seed, hero]);

  return (
    <group ref={group} position={position} scale={scale}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.018, 0.36, 8]} />
        <meshStandardMaterial color="#4a7a28" roughness={0.9} />
      </mesh>
      {leaves.map((l, i) => (
        <mesh
          key={i}
          position={[Math.cos(l.rotY) * 0.04, l.y, Math.sin(l.rotY) * 0.04]}
          rotation={[l.tilt, l.rotY, 0]}
          castShadow
        >
          <coneGeometry args={[l.size * 0.5, l.size * 2.2, 4]} />
          <meshStandardMaterial color="#5fa83a" roughness={0.75} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 0.4, 0]} castShadow>
        <coneGeometry args={[0.04, 0.14, 6]} />
        <meshStandardMaterial color="#5fa83a" roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ---------- Field ---------- */
function FieldPlot() {
  const soilGeom = useMemo(() => {
    const g = new THREE.PlaneGeometry(8, 8, 80, 80);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const ridge = Math.sin(x * 6) * 0.025;
      const noise = (Math.random() - 0.5) * 0.012;
      pos.setZ(i, ridge + noise);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  const plants = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: number; seed: number }[] = [];
    const rows = 10;
    const perRow = 18;
    for (let r = 0; r < rows; r++) {
      for (let p = 0; p < perRow; p++) {
        const x = (r - rows / 2 + 0.5) * 0.55;
        const z = (p - perRow / 2 + 0.5) * 0.34;
        // skip the hero plant location — we'll place a special one there
        if (Math.abs(x) < 0.3 && Math.abs(z) < 0.3) continue;
        arr.push({
          pos: [x + (Math.random() - 0.5) * 0.06, 0, z + (Math.random() - 0.5) * 0.06],
          scale: 0.85 + Math.random() * 0.3,
          seed: Math.random() * 10,
        });
      }
    }
    return arr;
  }, []);

  return (
    <group position={[0, -0.6, 0]}>
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <boxGeometry args={[8.2, 0.32, 8.2]} />
        <meshStandardMaterial color="#2a1a0e" roughness={1} />
      </mesh>
      <mesh
        geometry={soilGeom}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <meshStandardMaterial color="#3d2814" roughness={1} flatShading />
      </mesh>
      {plants.map((p, i) => (
        <CropPlant key={`p${i}`} position={p.pos} scale={p.scale} seed={p.seed} />
      ))}
      {/* Hero plant — the one we zoom into */}
      <CropPlant position={[0, 0, 0]} scale={1.1} seed={3.7} hero />
    </group>
  );
}

/* ---------- Underground cross-section ---------- */
function SoilCrossSection({ moisture }: { moisture: number }) {
  // moisture 0..100 → 0..1
  const wetness = THREE.MathUtils.clamp(moisture / 100, 0, 1);

  // Animated water droplets percolating down
  const dropletCount = 18;
  const droplets = useRef<THREE.Mesh[]>([]);
  const dropletData = useMemo(
    () =>
      Array.from({ length: dropletCount }, () => ({
        x: (Math.random() - 0.5) * 1.6,
        startY: 0.4 + Math.random() * 0.3,
        speed: 0.3 + Math.random() * 0.4,
        offset: Math.random() * 4,
      })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    droplets.current.forEach((m, i) => {
      if (!m) return;
      const d = dropletData[i];
      const cycle = ((t * d.speed + d.offset) % 4) / 4; // 0..1
      m.position.y = d.startY - cycle * 1.6;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.opacity = (1 - cycle) * 0.85 * wetness;
    });
  });

  // Layer colors blended with wetness — wetter = darker
  const topColor = useMemo(
    () => new THREE.Color("#5a3a1c").lerp(new THREE.Color("#2a1408"), wetness * 0.6),
    [wetness],
  );
  const midColor = useMemo(
    () => new THREE.Color("#4a2a14").lerp(new THREE.Color("#1f0f04"), wetness * 0.6),
    [wetness],
  );
  const subColor = useMemo(
    () => new THREE.Color("#3a2410").lerp(new THREE.Color("#180c02"), wetness * 0.6),
    [wetness],
  );

  // Root system — branching lines from the plant base
  const roots = useMemo(() => {
    const lines: { from: [number, number, number]; to: [number, number, number] }[] = [];
    function branch(
      from: [number, number, number],
      depth: number,
      angle: number,
      length: number,
    ) {
      if (depth === 0) return;
      const to: [number, number, number] = [
        from[0] + Math.cos(angle) * length,
        from[1] - Math.abs(Math.sin(angle) * length) - 0.05,
        from[2] + (Math.random() - 0.5) * 0.05,
      ];
      lines.push({ from, to });
      branch(to, depth - 1, angle - 0.4 + Math.random() * 0.2, length * 0.7);
      branch(to, depth - 1, angle + 0.4 - Math.random() * 0.2, length * 0.7);
    }
    branch([0, 0, 0], 4, -Math.PI / 2 - 0.3, 0.25);
    branch([0, 0, 0], 4, -Math.PI / 2 + 0.3, 0.25);
    branch([0, 0, 0], 3, -Math.PI / 2, 0.3);
    return lines;
  }, []);

  return (
    <group>
      {/* Top soil layer */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[2.2, 0.2, 0.08]} />
        <meshStandardMaterial color={topColor} roughness={1} />
      </mesh>
      {/* Mid layer */}
      <mesh position={[0, -0.45, 0]}>
        <boxGeometry args={[2.2, 0.5, 0.08]} />
        <meshStandardMaterial color={midColor} roughness={1} />
      </mesh>
      {/* Subsoil */}
      <mesh position={[0, -0.95, 0]}>
        <boxGeometry args={[2.2, 0.5, 0.08]} />
        <meshStandardMaterial color={subColor} roughness={1} />
      </mesh>
      {/* Bedrock */}
      <mesh position={[0, -1.35, 0]}>
        <boxGeometry args={[2.2, 0.3, 0.08]} />
        <meshStandardMaterial color="#1a1208" roughness={1} />
      </mesh>

      {/* Layer dividers (thin lines) */}
      {[-0.2, -0.7, -1.2].map((y, i) => (
        <mesh key={`div${i}`} position={[0, y, 0.045]}>
          <boxGeometry args={[2.2, 0.005, 0.005]} />
          <meshBasicMaterial color="#000" transparent opacity={0.4} />
        </mesh>
      ))}

      {/* Roots */}
      {roots.map((r, i) => {
        const dx = r.to[0] - r.from[0];
        const dy = r.to[1] - r.from[1];
        const len = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        return (
          <mesh
            key={`root${i}`}
            position={[(r.from[0] + r.to[0]) / 2, (r.from[1] + r.to[1]) / 2, 0.05]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[len, 0.012, 0.012]} />
            <meshStandardMaterial color="#d4b878" roughness={0.8} />
          </mesh>
        );
      })}

      {/* Animated water droplets */}
      {dropletData.map((_, i) => (
        <mesh
          key={`drop${i}`}
          ref={(el) => {
            if (el) droplets.current[i] = el;
          }}
          position={[dropletData[i].x, dropletData[i].startY, 0.06]}
        >
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial
            color="#6ec3e8"
            emissive="#3a8ab8"
            emissiveIntensity={0.4}
            transparent
            opacity={wetness * 0.85}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>
      ))}

      {/* Moisture saturation overlay — gets darker/bluer with wetness */}
      <mesh position={[0, -0.5, 0.041]}>
        <planeGeometry args={[2.2, 1.4]} />
        <meshBasicMaterial color="#1a4868" transparent opacity={wetness * 0.18} />
      </mesh>

      {/* Surface grass + plant base */}
      <mesh position={[0, 0.005, 0.05]}>
        <boxGeometry args={[2.2, 0.02, 0.02]} />
        <meshStandardMaterial color="#3d6a18" roughness={0.9} />
      </mesh>
      {/* Plant stalk poking up */}
      <mesh position={[0, 0.2, 0.05]}>
        <cylinderGeometry args={[0.014, 0.02, 0.4, 8]} />
        <meshStandardMaterial color="#4a7a28" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.42, 0.05]}>
        <coneGeometry args={[0.05, 0.16, 6]} />
        <meshStandardMaterial color="#5fa83a" roughness={0.7} />
      </mesh>

      {/* HUD labels for layers */}
      <Html position={[1.25, -0.1, 0]} zIndexRange={[10, 0]}>
        <div className="font-mono-tight text-[9px] tracking-[0.2em] uppercase text-copper whitespace-nowrap">
          Topsoil
        </div>
      </Html>
      <Html position={[1.25, -0.45, 0]} zIndexRange={[10, 0]}>
        <div className="font-mono-tight text-[9px] tracking-[0.2em] uppercase text-copper whitespace-nowrap">
          Subsoil · Roots
        </div>
      </Html>
      <Html position={[1.25, -0.95, 0]} zIndexRange={[10, 0]}>
        <div className="font-mono-tight text-[9px] tracking-[0.2em] uppercase text-cyan-data whitespace-nowrap">
          Moisture {moisture.toFixed(0)}%
        </div>
      </Html>
      <Html position={[1.25, -1.35, 0]} zIndexRange={[10, 0]}>
        <div className="font-mono-tight text-[9px] tracking-[0.2em] uppercase text-muted-foreground whitespace-nowrap">
          Bedrock
        </div>
      </Html>
    </group>
  );
}

/* ---------- Cinematic camera ---------- */
function CinematicCamera({ onStageChange }: { onStageChange: (s: number) => void }) {
  const { camera } = useThree();
  const lastStage = useRef(-1);

  useFrame((state) => {
    const t = (state.clock.elapsedTime % LOOP_SECONDS) / LOOP_SECONDS; // 0..1

    // Easing helper
    const ease = (x: number) => x * x * (3 - 2 * x); // smoothstep

    // Define keyframe positions
    const KF = [
      { t: 0.0, pos: [5, 4.5, 6], look: [0, -0.2, 0], stage: 0 }, // wide field
      { t: 0.22, pos: [5, 4.5, 6], look: [0, -0.2, 0], stage: 0 },
      { t: 0.38, pos: [0.6, 0.8, 1.2], look: [0, 0.1, 0], stage: 1 }, // zoom to plant
      { t: 0.5, pos: [0.4, 0.4, 0.9], look: [0, 0.05, 0], stage: 1 },
      { t: 0.62, pos: [0, -0.5, 2.2], look: [0, -0.6, 0], stage: 2 }, // underground
      { t: 0.82, pos: [0, -0.5, 2.2], look: [0, -0.6, 0], stage: 2 },
      { t: 1.0, pos: [5, 4.5, 6], look: [0, -0.2, 0], stage: 0 }, // pull out
    ];

    // Find current segment
    let i = 0;
    for (let k = 0; k < KF.length - 1; k++) {
      if (t >= KF[k].t && t < KF[k + 1].t) {
        i = k;
        break;
      }
    }
    const a = KF[i];
    const b = KF[i + 1] ?? KF[KF.length - 1];
    const segT = (t - a.t) / Math.max(0.0001, b.t - a.t);
    const e = ease(segT);

    const px = a.pos[0] + (b.pos[0] - a.pos[0]) * e;
    const py = a.pos[1] + (b.pos[1] - a.pos[1]) * e;
    const pz = a.pos[2] + (b.pos[2] - a.pos[2]) * e;
    const lx = a.look[0] + (b.look[0] - a.look[0]) * e;
    const ly = a.look[1] + (b.look[1] - a.look[1]) * e;
    const lz = a.look[2] + (b.look[2] - a.look[2]) * e;

    camera.position.set(px, py, pz);
    camera.lookAt(lx, ly, lz);

    if (a.stage !== lastStage.current) {
      lastStage.current = a.stage;
      onStageChange(a.stage);
    }
  });

  return null;
}

export default function CinematicFieldScene({ metrics }: SceneProps) {
  const stageRef = useRef(0);
  const setStage = (s: number) => {
    stageRef.current = s;
    // dispatch a tiny custom event so the overlay can react without re-rendering Canvas
    window.dispatchEvent(new CustomEvent("cinema-stage", { detail: s }));
  };

  return (
    <Canvas
      shadows
      camera={{ position: [5, 4.5, 6], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <Sky distance={450000} sunPosition={[8, 6, 4]} turbidity={6} rayleigh={2.2} />
      <fog attach="fog" args={["#b8c4a8", 14, 30]} />

      <ambientLight intensity={0.55} />
      <directionalLight
        position={[8, 10, 4]}
        intensity={2.2}
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
        <FieldPlot />

        {/* Underground cross-section, positioned right under the hero plant */}
        <group position={[0, -0.6, 0]}>
          <SoilCrossSection moisture={metrics.moisture} />
        </group>

        <ContactShadows
          position={[0, -0.78, 0]}
          opacity={0.5}
          scale={14}
          blur={2.5}
          far={3}
          color="#000"
        />
      </Suspense>

      <CinematicCamera onStageChange={setStage} />
    </Canvas>
  );
}
