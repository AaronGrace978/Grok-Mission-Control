import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { advanceSim, sim, TOTAL_DEMO } from "@/sim/clock";
import { SUN_DIR } from "@/sim/geometry";
import { useUi, type Quality } from "@/state/ui";
import { Earth, Mars, Moon, Sky, Sun } from "./Bodies";
import { CameraRig } from "./CameraRig";
import { OverlayProbe } from "./OverlayProbe";
import { QUALITY_CONFIG, type QualityConfig } from "./quality";
import { Trajectory } from "./Trajectory";
import { Vehicles } from "./vehicle/Vehicles";

/** Render-loop stats read by the HUD without React updates. */
export const perf = { fps: 60 };

const LADDER: Quality[] = ["low", "medium", "high", "ultra"];

function SimDriver() {
  const frames = useRef({ n: 0, acc: 0 });
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    const f = frames.current;
    f.n++;
    f.acc += dt;
    if (f.acc > 0.5) {
      perf.fps = f.n / f.acc;
      f.n = 0;
      f.acc = 0;
    }
    const { playing, speed, setPlaying, booted } = useUi.getState();
    if (!playing || !booted) return;
    advanceSim(step * speed);
    if (sim.t >= TOTAL_DEMO) setPlaying(false);
  }, -2);
  return null;
}

function RendererSettings({ post }: { post: boolean }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1;
  }, [gl, post]);
  return null;
}

function Lights() {
  const sunPos = useMemo(() => SUN_DIR.clone().multiplyScalar(100), []);
  return (
    <>
      <directionalLight position={sunPos} intensity={3.2} color="#fff6ea" />
      <ambientLight intensity={0.03} color="#c9d2e3" />
      <Environment resolution={128} frames={1} environmentIntensity={0.55}>
        <Lightformer form="rect" intensity={6} color="#fff3e2" position={sunPos.clone().normalize().multiplyScalar(10)} scale={[6, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.35} color="#9aa6bb" position={[0, -10, 0]} scale={[20, 20, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.2} color="#ffffff" position={[-8, 4, -6]} scale={4} target={[0, 0, 0]} />
      </Environment>
    </>
  );
}

function Post({ q }: { q: QualityConfig }) {
  if (!q.post) return null;
  return (
    <EffectComposer multisampling={q.multisampling} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.82} luminanceSmoothing={0.18} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.22} darkness={0.72} />
      {q.noise ? <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.035} /> : <></>}
      {q.smaa ? <SMAA /> : <></>}
    </EffectComposer>
  );
}

function World({ q }: { q: QualityConfig }) {
  return (
    <>
      <Lights />
      <Sky q={q} />
      <Sun />
      <Suspense fallback={null}>
        <Earth q={q} />
      </Suspense>
      <Suspense fallback={null}>
        <Moon q={q} />
        <Mars q={q} />
      </Suspense>
      <Trajectory />
      <Vehicles q={q} />
    </>
  );
}

export function Scene() {
  const quality = useUi((s) => s.quality);
  const q = QUALITY_CONFIG[quality];

  const step = (dir: 1 | -1) => {
    const { autoQuality, quality, setQuality } = useUi.getState();
    if (!autoQuality) return;
    const i = LADDER.indexOf(quality) + dir;
    const ceiling = LADDER.indexOf("high");
    if (i < 0 || i > ceiling) return;
    setQuality(LADDER[i], true);
  };

  return (
    <Canvas
      className="!absolute inset-0"
      dpr={q.dpr}
      gl={{ logarithmicDepthBuffer: true, antialias: !q.post, powerPreference: "high-performance", alpha: false, stencil: false }}
      camera={{ fov: 50, near: 1e-5, far: 1e6, position: [0, 0, 40] }}
      onCreated={({ gl }) => gl.setClearColor("#000000")}
    >
      <RendererSettings post={q.post} />
      <PerformanceMonitor ms={400} iterations={8} threshold={0.75} bounds={(r) => (r > 90 ? [50, 90] : [48, 58])} flipflops={3} onDecline={() => step(-1)} onIncline={() => step(1)} />
      <SimDriver />
      <World q={q} />
      <CameraRig />
      <OverlayProbe />
      <Post q={q} />
    </Canvas>
  );
}
