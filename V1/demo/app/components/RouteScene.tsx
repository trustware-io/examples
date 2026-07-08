"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, QuadraticBezierLine, Sparkles, Text } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

const GOLD = "#d7b56d";
const CYAN = "#7fd9c9";
const BG = "#08090b";

type ChainNode = {
  name: string;
  position: [number, number, number];
};

// Six chains arranged on a Fibonacci sphere around the routing core — an
// illustrative "always-on" network, not a literal support matrix.
const CHAINS: ChainNode[] = (() => {
  const names = ["Ethereum", "Base", "Arbitrum", "Optimism", "Polygon", "Solana"];
  const radius = 3.4;
  return names.map((name, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / names.length);
    const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
    return {
      name,
      position: [
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta) * 0.6,
        radius * Math.cos(phi),
      ] as [number, number, number],
    };
  });
})();

function Core() {
  const shell = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (shell.current) shell.current.rotation.y += delta * 0.12;
    if (shell.current) shell.current.rotation.x += delta * 0.04;
    if (inner.current) inner.current.rotation.y -= delta * 0.2;
  });

  return (
    <group>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={1.4}
          roughness={0.25}
          metalness={0.6}
        />
      </mesh>
      <mesh ref={shell}>
        <icosahedronGeometry args={[0.95, 0]} />
        <meshBasicMaterial color={GOLD} wireframe transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function Route({ node, index }: { node: ChainNode; index: number }) {
  const start = useMemo(() => new THREE.Vector3(...node.position), [node.position]);
  const end = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const mid = useMemo(() => {
    const m = start.clone().lerp(end, 0.5);
    m.y += 1.3;
    return m;
  }, [start, end]);

  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(start, mid, end), [start, mid, end]);

  const particleA = useRef<THREE.Mesh>(null);
  const particleB = useRef<THREE.Mesh>(null);
  const phase = (index / CHAINS.length) * Math.PI * 2;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const ta = (Math.sin(t * 0.6 + phase) + 1) / 2;
    const tb = (Math.sin(t * 0.6 + phase + Math.PI) + 1) / 2;
    if (particleA.current) particleA.current.position.copy(curve.getPoint(ta));
    if (particleB.current) particleB.current.position.copy(curve.getPoint(tb));
  });

  return (
    <group>
      <QuadraticBezierLine
        start={start}
        end={end}
        mid={mid}
        color={CYAN}
        lineWidth={1}
        transparent
        opacity={0.28}
        dashed={false}
      />
      <mesh ref={particleA}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color={GOLD} />
      </mesh>
      <mesh ref={particleB}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color={CYAN} />
      </mesh>
      <Float speed={1.4} floatIntensity={0.6} rotationIntensity={0}>
        <mesh position={node.position}>
          <sphereGeometry args={[0.12, 20, 20]} />
          <meshStandardMaterial
            color={CYAN}
            emissive={CYAN}
            emissiveIntensity={0.7}
            roughness={0.35}
          />
        </mesh>
        <Text
          position={[node.position[0], node.position[1] + 0.32, node.position[2]]}
          fontSize={0.18}
          color="#c8cad2"
          anchorX="center"
          anchorY="bottom"
        >
          {node.name}
        </Text>
      </Float>
    </group>
  );
}

function Rig() {
  useFrame(({ camera, clock }) => {
    camera.position.y = Math.sin(clock.getElapsedTime() * 0.15) * 0.3;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function RouteScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 1.1, 7.5], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "default" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 6, 14]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[4, 4, 4]} intensity={30} color={GOLD} />
      <pointLight position={[-5, -2, -3]} intensity={20} color={CYAN} />

      <Core />
      {CHAINS.map((node, i) => (
        <Route key={node.name} node={node} index={i} />
      ))}
      <Sparkles count={80} scale={9} size={1.4} speed={0.25} color={"#ffffff"} opacity={0.25} />

      <Rig />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.6}
        minPolarAngle={Math.PI / 2 - 0.5}
        maxPolarAngle={Math.PI / 2 + 0.5}
      />

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.9} luminanceThreshold={0.2} luminanceSmoothing={0.9} />
      </EffectComposer>
    </Canvas>
  );
}
