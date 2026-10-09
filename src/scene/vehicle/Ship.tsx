import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { vehicleTextures } from "./textures";
import { createPlumeMaterial, createSparkMaterial, PlumeCone, Sparks } from "./Plume";
import { SCALE } from "@/sim/geometry";

const HULL_R = 4.5;
const BODY_H = 34;
const NOSE_H = 16;
const WINDOW_R = HULL_R * Math.pow(1 - Math.pow(4.6 / NOSE_H, 2.1), 0.62) + 0.05;

export const SL_BELL: [number, number][] = [
  [0.5, 0.4],
  [0.42, 0.1],
  [0.36, -0.15],
  [0.44, -0.6],
  [0.55, -1.3],
  [0.63, -2.0],
  [0.67, -2.35],
];
const VAC_BELL: [number, number][] = [
  [0.55, 0.4],
  [0.45, 0.1],
  [0.4, -0.2],
  [0.6, -0.9],
  [0.85, -1.9],
  [1.05, -3.0],
  [1.18, -3.9],
];

export function bellGeometry(pts: [number, number][], segments = 40) {
  return new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

function flapGeometry(pts: [number, number][], depth: number) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return g;
}

const dirAt = (theta: number) => new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));

export function useHullMaterials() {
  return useMemo(() => {
    const t = vehicleTextures();
    const make = (repeatY: number, tiles: boolean) => {
      const map = (tiles ? t.tileColor : t.steelColor).clone();
      const mr = (tiles ? t.tileMR : t.steelMR).clone();
      for (const tex of [map, mr]) {
        tex.repeat.set(1, repeatY);
        tex.needsUpdate = true;
      }
      return new THREE.MeshStandardMaterial({ map, metalnessMap: mr, roughnessMap: mr, metalness: 1, roughness: 1, envMapIntensity: 1.25 });
    };
    return {
      bodyTiled: make(BODY_H / 28.3, true),
      noseTiled: make(NOSE_H / 28.3, true),
      bodySteel: make(BODY_H / 28.3, false),
      noseSteel: make(NOSE_H / 28.3, false),
      flap: new THREE.MeshStandardMaterial({ color: "#1c1d20", roughness: 0.82, metalness: 0.1 }),
      engine: new THREE.MeshStandardMaterial({ color: "#45474c", roughness: 0.42, metalness: 0.9, side: THREE.DoubleSide }),
      dark: new THREE.MeshStandardMaterial({ color: "#16171a", roughness: 0.7, metalness: 0.4 }),
      window: new THREE.MeshStandardMaterial({ color: "#05070a", roughness: 0.08, metalness: 0.9, emissive: new THREE.Color(1.0, 0.82, 0.55), emissiveIntensity: 0.35 }),
    };
  }, []);
}

const SHIP_CORE = new THREE.Color(1.5, 1.45, 2.1);
const SHIP_EDGE = new THREE.Color(0.22, 0.28, 0.95);

interface ShipProps {
  variant: "crew" | "tanker";
  getThrottle: () => number;
}

export function ShipModel({ variant, getThrottle }: ShipProps) {
  const mats = useHullMaterials();
  const size = useThree((s) => s.size);

  const geo = useMemo(() => {
    const body = new THREE.CylinderGeometry(HULL_R, HULL_R, BODY_H, 128, 1, true);
    body.translate(0, BODY_H / 2, 0);
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 40; i++) {
      const s = i / 40;
      prof.push(new THREE.Vector2(HULL_R * Math.pow(Math.max(0, 1 - Math.pow(s, 2.1)), 0.62), NOSE_H * s));
    }
    const nose = new THREE.LatheGeometry(prof, 128);
    nose.translate(0, BODY_H, 0);
    const base = new THREE.CircleGeometry(HULL_R, 64);
    base.rotateX(Math.PI / 2);
    base.translate(0, 0.02, 0);
    const skirt = new THREE.CylinderGeometry(HULL_R + 0.03, HULL_R + 0.03, 0.9, 128, 1, true);
    skirt.translate(0, 0.45, 0);
    return {
      body,
      nose,
      base,
      skirt,
      aftFlap: flapGeometry([[0, 0], [3.6, 0.7], [3.9, 7.6], [0, 11]], 0.35),
      fwdFlap: flapGeometry([[0, 0], [2.3, 1.2], [2.5, 5.8], [0, 8]], 0.3),
      sl: bellGeometry(SL_BELL),
      vac: bellGeometry(VAC_BELL),
      exitDisc: new THREE.CircleGeometry(1, 32).rotateX(Math.PI / 2),
      window: new THREE.PlaneGeometry(0.9, 0.55),
    };
  }, []);

  const engines = useMemo(() => {
    const list: { pos: THREE.Vector3; vac: boolean }[] = [];
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI / 2) + (i * Math.PI * 2) / 3;
      list.push({ pos: new THREE.Vector3(Math.sin(a) * 1.55, 0, Math.cos(a) * 1.55), vac: false });
      const b = Math.PI / 6 + (i * Math.PI * 2) / 3;
      list.push({ pos: new THREE.Vector3(Math.sin(b) * 3.05, 0, Math.cos(b) * 3.05), vac: true });
    }
    return list;
  }, []);

  const fx = useMemo(() => {
    const slPlume = createPlumeMaterial({ length: 30, r0: 0.6, r1: 3.2, core: SHIP_CORE, edge: SHIP_EDGE, intensity: 1.3, falloff: 1.6 });
    const vacPlume = createPlumeMaterial({ length: 46, r0: 1.05, r1: 5.2, core: SHIP_CORE, edge: SHIP_EDGE, intensity: 1.1, falloff: 1.5 });
    const mach = createPlumeMaterial({ length: 5, r0: 0.5, r1: 0.25, curve: 1, core: new THREE.Color(4, 3.6, 4.2), edge: new THREE.Color(1.5, 1.2, 2.6), intensity: 1.4, falloff: 1.1 });
    const exit = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4, 5.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 });
    const sparks = createSparkMaterial(new THREE.Color(1.6, 1.4, 2.4), 36, 3.5, 0.45);
    return { slPlume, vacPlume, mach, exit, sparks };
  }, []);

  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame((state) => {
    const thr = getThrottle();
    const time = state.clock.elapsedTime;
    for (const m of [fx.slPlume, fx.vacPlume, fx.mach]) {
      m.uniforms.uThrottle.value = thr;
      m.uniforms.uTime.value = time;
    }
    fx.exit.opacity = Math.min(1, thr * 1.5);
    fx.sparks.uniforms.uThrottle.value = thr;
    fx.sparks.uniforms.uTime.value = time;
    fx.sparks.uniforms.uScale.value = (size.height * SCALE) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  });

  const tiled = true;
  const crew = variant === "crew";
  return (
    <group>
      <mesh geometry={geo.body} material={tiled ? mats.bodyTiled : mats.bodySteel} />
      <mesh geometry={geo.nose} material={tiled ? mats.noseTiled : mats.noseSteel} />
      <mesh geometry={geo.skirt} material={mats.bodySteel} />
      <mesh geometry={geo.base} material={mats.dark} />

      {[Math.PI / 2, -Math.PI / 2].map((th) => (
        <mesh key={`a${th}`} geometry={geo.aftFlap} material={mats.flap} position={dirAt(th).multiplyScalar(HULL_R - 0.15).setY(1.4)} rotation={[0, th - Math.PI / 2, 0]} />
      ))}
      {[Math.PI / 2 + 0.38, -Math.PI / 2 - 0.38].map((th) => (
        <mesh key={`f${th}`} geometry={geo.fwdFlap} material={mats.flap} position={dirAt(th).multiplyScalar(4.05).setY(BODY_H + 1.2)} rotation={[0, th - Math.PI / 2, 0.12 * Math.sign(th)]} />
      ))}

      {crew &&
        [-0.22, -0.11, 0, 0.11, 0.22].map((d, i) => {
          const th = Math.PI + d;
          const p = dirAt(th).multiplyScalar(WINDOW_R).setY(BODY_H + 4.6);
          return <mesh key={i} geometry={geo.window} material={mats.window} position={p} rotation={[-0.32, th, 0, "YXZ"]} />;
        })}

      {engines.map((e, i) => (
        <group key={i} position={e.pos}>
          <mesh geometry={e.vac ? geo.vac : geo.sl} material={mats.engine} />
          <mesh geometry={geo.exitDisc} material={fx.exit} position={[0, e.vac ? -3.85 : -2.3, 0]} scale={e.vac ? 1.1 : 0.62} />
          <group position={[0, e.vac ? -3.9 : -2.35, 0]}>
            <PlumeCone material={e.vac ? fx.vacPlume : fx.slPlume} />
            <PlumeCone material={fx.mach} renderOrder={7} />
          </group>
        </group>
      ))}
      <group position={[0, -3, 0]}>
        <Sparks material={fx.sparks} count={260} />
      </group>
    </group>
  );
}
