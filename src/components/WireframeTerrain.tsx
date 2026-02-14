"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null);

  // Store the base heights so we can animate on top of them
  const { geometry, baseHeights } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(32, 18, 90, 50);
    const positions = geo.attributes.position;
    const heights: number[] = [];

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      const height =
        Math.sin(x * 0.25 + 1.2) * Math.cos(y * 0.35) * 2.0 +
        Math.sin(x * 0.12 + y * 0.18) * 1.5 +
        Math.cos(x * 0.4 - y * 0.25 + 2.0) * 0.9 +
        Math.sin(x * 0.6 + y * 0.5) * 0.35 +
        Math.sin(x * 0.04) * Math.cos(y * 0.06) * 3.0;

      heights.push(height);
      positions.setZ(i, height);
    }

    geo.computeVertexNormals();
    return { geometry: geo, baseHeights: heights };
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;

    const t = state.clock.elapsedTime;
    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      // Layered slow wind waves
      const wave =
        Math.sin(x * 0.15 + t * 0.4) * 0.3 +
        Math.sin(y * 0.2 + t * 0.3 + 1.0) * 0.2 +
        Math.cos(x * 0.1 + y * 0.1 + t * 0.25) * 0.15;

      positions.setZ(i, baseHeights[i] + wave);
    }

    positions.needsUpdate = true;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={[-1.05, 0, -0.12]}
      position={[3.5, -3, -3]}
    >
      <meshBasicMaterial
        wireframe
        color="#2a2a2a"
        wireframeLinewidth={1}
        transparent
        opacity={0.35}
      />
    </mesh>
  );
}

export default function WireframeTerrain() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{
          position: [0, 5, 12],
          fov: 45,
          near: 0.1,
          far: 100,
        }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Terrain />
      </Canvas>
    </div>
  );
}
