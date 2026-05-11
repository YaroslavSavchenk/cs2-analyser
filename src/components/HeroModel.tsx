import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { Color, MeshStandardMaterial } from "three";

type OperatorProps = {
  hover?: number;
};

function useMatcap() {
  const charcoal = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#1d2025"),
        roughness: 0.78,
        metalness: 0.18,
      }),
    [],
  );
  const charcoalDark = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#15171b"),
        roughness: 0.92,
        metalness: 0.05,
      }),
    [],
  );
  const accentOrange = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#fe6e2c"),
        emissive: new Color("#fe6e2c"),
        emissiveIntensity: 0.35,
        roughness: 0.45,
        metalness: 0.6,
      }),
    [],
  );
  const visor = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#f5a623"),
        emissive: new Color("#fe6e2c"),
        emissiveIntensity: 0.95,
        roughness: 0.2,
        metalness: 0.7,
      }),
    [],
  );
  const armor = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#23262c"),
        roughness: 0.55,
        metalness: 0.35,
      }),
    [],
  );
  const skin = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#3a3e46"),
        roughness: 0.7,
        metalness: 0.1,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      charcoal.dispose();
      charcoalDark.dispose();
      accentOrange.dispose();
      visor.dispose();
      armor.dispose();
      skin.dispose();
    };
  }, [charcoal, charcoalDark, accentOrange, visor, armor, skin]);

  return { charcoal, charcoalDark, accentOrange, visor, armor, skin };
}

function Operator({ hover = 0 }: OperatorProps) {
  const root = useRef<Group>(null);
  const torsoTwist = useRef<Group>(null);
  const visorRef = useRef<Mesh>(null);
  const m = useMatcap();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (root.current) {
      const breathe = Math.sin(t * 1.1) * 0.045;
      root.current.position.y = -0.05 + breathe + hover;
      root.current.rotation.y = Math.sin(t * 0.22) * 0.32 + 0.18;
    }
    if (torsoTwist.current) {
      torsoTwist.current.rotation.y = Math.sin(t * 0.55) * 0.06;
      torsoTwist.current.rotation.z = Math.sin(t * 0.7) * 0.015;
    }
    if (visorRef.current) {
      const pulse = 0.7 + Math.sin(t * 2.2) * 0.25;
      const mat = visorRef.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = pulse;
    }
  });

  return (
    <group ref={root}>
      <group ref={torsoTwist}>
        <mesh material={m.armor} position={[0, 1.05, 0]} castShadow>
          <boxGeometry args={[0.95, 1.05, 0.55]} />
        </mesh>
        <mesh material={m.charcoal} position={[0, 1.45, 0.255]}>
          <boxGeometry args={[0.78, 0.55, 0.08]} />
        </mesh>
        <mesh material={m.accentOrange} position={[0, 1.46, 0.3]}>
          <boxGeometry args={[0.16, 0.16, 0.02]} />
        </mesh>
        <mesh material={m.charcoalDark} position={[0, 0.82, 0.275]}>
          <boxGeometry args={[0.6, 0.18, 0.06]} />
        </mesh>

        <mesh material={m.armor} position={[-0.62, 1.32, 0]} castShadow>
          <boxGeometry args={[0.32, 0.28, 0.5]} />
        </mesh>
        <mesh material={m.accentOrange} position={[-0.62, 1.47, 0]}>
          <boxGeometry args={[0.34, 0.04, 0.52]} />
        </mesh>
        <mesh material={m.armor} position={[0.62, 1.32, 0]} castShadow>
          <boxGeometry args={[0.32, 0.28, 0.5]} />
        </mesh>
        <mesh material={m.accentOrange} position={[0.62, 1.47, 0]}>
          <boxGeometry args={[0.34, 0.04, 0.52]} />
        </mesh>

        <mesh material={m.charcoal} position={[-0.62, 0.95, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.12, 0.55, 12]} />
        </mesh>
        <mesh material={m.skin} position={[-0.62, 0.6, 0]}>
          <cylinderGeometry args={[0.115, 0.115, 0.36, 12]} />
        </mesh>
        <mesh material={m.charcoal} position={[0.62, 0.95, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.12, 0.55, 12]} />
        </mesh>
        <mesh material={m.skin} position={[0.62, 0.6, 0]}>
          <cylinderGeometry args={[0.115, 0.115, 0.36, 12]} />
        </mesh>

        <group position={[0.62, 0.36, 0.18]} rotation={[0, 0, -0.05]}>
          <mesh material={m.charcoalDark}>
            <boxGeometry args={[0.14, 0.5, 0.08]} />
          </mesh>
          <mesh material={m.charcoalDark} position={[0.32, -0.05, 0]}>
            <boxGeometry args={[0.58, 0.1, 0.1]} />
          </mesh>
          <mesh material={m.accentOrange} position={[0.55, -0.05, 0]}>
            <boxGeometry args={[0.08, 0.04, 0.04]} />
          </mesh>
          <mesh material={m.charcoal} position={[-0.05, -0.32, 0]}>
            <boxGeometry args={[0.16, 0.18, 0.16]} />
          </mesh>
        </group>
      </group>

      <mesh material={m.skin} position={[0, 1.85, 0]} castShadow>
        <boxGeometry args={[0.55, 0.6, 0.55]} />
      </mesh>
      <mesh material={m.charcoalDark} position={[0, 2.06, 0]}>
        <boxGeometry args={[0.62, 0.22, 0.6]} />
      </mesh>
      <mesh
        ref={visorRef}
        material={m.visor}
        position={[0, 1.88, 0.275]}
        castShadow
      >
        <boxGeometry args={[0.5, 0.14, 0.04]} />
      </mesh>
      <mesh material={m.armor} position={[0, 1.65, 0.05]}>
        <boxGeometry args={[0.4, 0.18, 0.48]} />
      </mesh>
      <mesh material={m.charcoal} position={[-0.32, 1.95, 0.08]}>
        <boxGeometry args={[0.05, 0.32, 0.45]} />
      </mesh>
      <mesh material={m.charcoal} position={[0.32, 1.95, 0.08]}>
        <boxGeometry args={[0.05, 0.32, 0.45]} />
      </mesh>

      <mesh material={m.charcoal} position={[-0.22, 0.05, 0]} castShadow>
        <boxGeometry args={[0.3, 0.95, 0.32]} />
      </mesh>
      <mesh material={m.charcoal} position={[0.22, 0.05, 0]} castShadow>
        <boxGeometry args={[0.3, 0.95, 0.32]} />
      </mesh>
      <mesh material={m.armor} position={[-0.22, 0.32, 0.17]}>
        <boxGeometry args={[0.28, 0.18, 0.06]} />
      </mesh>
      <mesh material={m.armor} position={[0.22, 0.32, 0.17]}>
        <boxGeometry args={[0.28, 0.18, 0.06]} />
      </mesh>
      <mesh material={m.charcoalDark} position={[-0.22, -0.5, 0.04]} castShadow>
        <boxGeometry args={[0.34, 0.18, 0.42]} />
      </mesh>
      <mesh material={m.charcoalDark} position={[0.22, -0.5, 0.04]} castShadow>
        <boxGeometry args={[0.34, 0.18, 0.42]} />
      </mesh>

      <mesh position={[0, -0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.65, 0.95, 48]} />
        <meshBasicMaterial color={new Color("#fe6e2c")} transparent opacity={0.08} />
      </mesh>
      <mesh position={[0, -0.61, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.96, 0.99, 48]} />
        <meshBasicMaterial color={new Color("#fe6e2c")} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function FallbackSilhouette() {
  return (
    <svg
      viewBox="0 0 200 260"
      className="h-full w-full"
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <linearGradient id="cs-fallback-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d2025" />
          <stop offset="100%" stopColor="#0d0e10" />
        </linearGradient>
      </defs>
      <rect width="200" height="260" fill="url(#cs-fallback-grad)" />
      <g fill="#15171b" stroke="#2a2d33" strokeWidth="1">
        <rect x="78" y="32" width="44" height="46" />
        <rect x="74" y="26" width="52" height="14" />
        <rect x="60" y="80" width="80" height="78" />
        <rect x="54" y="84" width="20" height="22" />
        <rect x="126" y="84" width="20" height="22" />
        <rect x="62" y="106" width="22" height="52" />
        <rect x="116" y="106" width="22" height="52" />
        <rect x="72" y="158" width="22" height="62" />
        <rect x="106" y="158" width="22" height="62" />
      </g>
      <g fill="#fe6e2c">
        <rect x="82" y="52" width="36" height="6" />
        <rect x="56" y="80" width="20" height="3" />
        <rect x="124" y="80" width="20" height="3" />
      </g>
    </svg>
  );
}

type HeroModelProps = {
  className?: string;
};

export function HeroModel({ className }: HeroModelProps) {
  const [webglOk, setWebglOk] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");
      return !!gl;
    } catch {
      return false;
    }
  });

  if (!webglOk) {
    return (
      <div className={className} aria-hidden="true">
        <FallbackSilhouette />
      </div>
    );
  }

  return (
    <div className={className}>
      <Canvas
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        camera={{ position: [2.3, 1.1, 3.8], fov: 32 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        onError={() => setWebglOk(false)}
      >
        <fog attach="fog" args={["#0d0e10", 4.5, 9]} />
        <ambientLight intensity={0.35} color="#5e98d9" />
        <directionalLight position={[-3, 2.5, 2.5]} intensity={0.4} color="#ffffff" />
        <directionalLight position={[3, 3, -2]} intensity={1.2} color="#fe6e2c" />
        <pointLight position={[1.5, 0.5, 2]} intensity={0.6} color="#f5a623" />
        <Operator />
      </Canvas>
    </div>
  );
}
