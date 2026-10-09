import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { vehicleTextures } from "./textures";
import { bellGeometry, SL_BELL, useHullMaterials } from "./Ship";
import { createPlumeMaterial, createSparkMaterial, PlumeCone, Sparks } from "./Plume";
import { SCALE } from "@/sim/geometry";

const HULL_R = 4.5;
const LEN = 71;
const RING_H = 2.6;

const CORE = new THREE.Color(3.4, 2.6, 1.55);
const EDGE = new THREE.Color(1.7, 0.55, 0.12);

function engineLayout() {
  const out: THREE.Vector3[] = [];
  const ring = (n: number, r: number, off = 0) => {
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      out.push(new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r));
    }
  };
  ring(3, 0.95);
  ring(10, 2.45, 0.2);
  ring(20, 3.82, 0.05);
  return out;
}

interface BoosterProps {
  getThrottle: () => number;
  getAtmo: () => number;
}

/** Super-heavy-class booster. Origin at the top of the hot-stage ring, extends to -71 m. */
export function BoosterModel({ getThrottle, getAtmo }: BoosterProps) {
  const mats = useHullMaterials();
  const t = vehicleTextures();
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const geo = useMemo(() => {
    const body = new THREE.CylinderGeometry(HULL_R, HULL_R, LEN - RING_H, 128, 1, true);
    body.translate(0, -RING_H - (LEN - RING_H) / 2, 0);
    const ring = new THREE.CylinderGeometry(HULL_R - 0.04, HULL_R - 0.04, RING_H, 128, 1, true);
    ring.translate(0, -RING_H / 2, 0);
    const top = new THREE.CircleGeometry(HULL_R, 64).rotateX(-Math.PI / 2);
    const aft = new THREE.CircleGeometry(HULL_R, 64).rotateX(Math.PI / 2).translate(0, -LEN, 0);
    const fin = new THREE.BoxGeometry(4.2, 0.5, 3.0);
    fin.translate(0, 0, 1.5);
    const chine = new THREE.BoxGeometry(0.35, 30, 1.1);
    return { body, ring, top, aft, fin, chine, bell: bellGeometry(SL_BELL, 24), exitDisc: new THREE.CircleGeometry(0.62, 20).rotateX(Math.PI / 2) };
  }, []);

  const local = useMemo(() => {
    const steel = mats.bodySteel.clone();
    const map = (steel.map as THREE.Texture).clone();
    map.repeat.set(1, (LEN - RING_H) / 28.3);
    map.needsUpdate = true;
    steel.map = map;
    const vent = t.vent.clone();
    vent.repeat.set(1, 1);
    vent.needsUpdate = true;
    const ring = new THREE.MeshStandardMaterial({ map: vent, roughness: 0.6, metalness: 0.6 });
    const fin = new THREE.MeshStandardMaterial({ color: "#2a2c30", alphaMap: t.grid, alphaTest: 0.5, roughness: 0.55, metalness: 0.8, side: THREE.DoubleSide });
    return { steel, ring, fin };
  }, [mats, t]);

  const engines = useMemo(engineLayout, []);
  const bells = useRef<THREE.InstancedMesh>(null);
  const discs = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    engines.forEach((p, i) => {
      m.makeTranslation(p.x, -LEN - 0.3, p.z);
      bells.current?.setMatrixAt(i, m);
      m.makeTranslation(p.x, -LEN - 2.62, p.z);
      discs.current?.setMatrixAt(i, m);
    });
    if (bells.current) bells.current.instanceMatrix.needsUpdate = true;
    if (discs.current) discs.current.instanceMatrix.needsUpdate = true;
  }, [engines]);

  const fx = useMemo(() => {
    const outer = createPlumeMaterial({ length: 90, r0: 4.4, r1: 7, curve: 0.7, core: CORE, edge: EDGE, diamonds: 1, intensity: 1.15, falloff: 1.25 });
    const core = createPlumeMaterial({ length: 42, r0: 3.6, r1: 2.6, curve: 1, core: new THREE.Color(5, 4.4, 3.4), edge: new THREE.Color(2.4, 1.4, 0.5), diamonds: 1, intensity: 1.2, falloff: 1.1 });
    const exit = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.8, 3.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 });
    const sparks = createSparkMaterial(new THREE.Color(2.6, 1.6, 0.7), 70, 6, 0.9);
    return { outer, core, exit, sparks };
  }, []);

  const light = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const thr = getThrottle();
    const atmo = getAtmo();
    const time = state.clock.elapsedTime;
    fx.outer.uniforms.uThrottle.value = thr;
    fx.core.uniforms.uThrottle.value = thr;
    fx.outer.uniforms.uTime.value = time;
    fx.core.uniforms.uTime.value = time;
    fx.outer.uniforms.uR1.value = THREE.MathUtils.lerp(30, 7, atmo);
    fx.outer.uniforms.uLength.value = THREE.MathUtils.lerp(150, 90, atmo);
    fx.outer.uniforms.uDiamonds.value = atmo;
    fx.core.uniforms.uDiamonds.value = atmo;
    fx.exit.opacity = Math.min(1, thr * 1.5);
    fx.sparks.uniforms.uThrottle.value = thr;
    fx.sparks.uniforms.uTime.value = time;
    fx.sparks.uniforms.uScale.value = (size.height * SCALE) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    if (light.current) light.current.intensity = thr * 3;
  });

  return (
    <group>
      <mesh geometry={geo.body} material={local.steel} />
      <mesh geometry={geo.ring} material={local.ring} />
      <mesh geometry={geo.top} material={mats.dark} />
      <mesh geometry={geo.aft} material={mats.dark} />
      {[0.25, 0.75, 1.25, 1.75].map((k) => (
        <mesh key={k} geometry={geo.fin} material={local.fin} position={[Math.sin(k * Math.PI) * (HULL_R - 0.1), -RING_H - 4.2, Math.cos(k * Math.PI) * (HULL_R - 0.1)]} rotation={[0, k * Math.PI, 0]} />
      ))}
      {[Math.PI / 2, -Math.PI / 2].map((a) => (
        <mesh key={a} geometry={geo.chine} material={mats.dark} position={[Math.sin(a) * (HULL_R + 0.2), -LEN + 18, Math.cos(a) * (HULL_R + 0.2)]} rotation={[0, a, 0]} />
      ))}
      <instancedMesh ref={bells} args={[geo.bell, mats.engine, engines.length]} />
      <instancedMesh ref={discs} args={[geo.exitDisc, fx.exit, engines.length]} />
      <group position={[0, -LEN - 2.6, 0]}>
        <PlumeCone material={fx.outer} />
        <PlumeCone material={fx.core} renderOrder={6} />
        <Sparks material={fx.sparks} count={420} />
        <pointLight ref={light} color="#ffb070" distance={0.02} decay={0} intensity={0} position={[0, -20, 0]} />
      </group>
    </group>
  );
}
