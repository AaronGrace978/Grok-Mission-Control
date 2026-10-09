import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sim } from "@/sim/clock";
import { EARTH_POS, MARS_POS, MOON_POS, R_EARTH, R_MARS, R_MOON, SCALE, SUN_POS } from "@/sim/geometry";
import { SHIP_CENTER_OFFSET_M } from "./vehicle/Vehicles";

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
  dist: number;
  /** 0..1 for fading. */
  strength: number;
}

const mk = (): ScreenPoint => ({ x: 0, y: 0, visible: false, dist: 0, strength: 0 });

/** Screen-space positions written by the scene and read by DOM overlays (labels, lens flare). */
export const overlay = {
  width: 1,
  height: 1,
  sun: mk(),
  earth: mk(),
  moon: mk(),
  mars: mk(),
  ship: mk(),
};

const BODIES = [
  { c: EARTH_POS, r: R_EARTH },
  { c: MOON_POS, r: R_MOON },
  { c: MARS_POS, r: R_MARS },
];

function occlusion(cam: THREE.Vector3, target: THREE.Vector3, tmp: THREE.Vector3) {
  const dir = tmp.copy(target).sub(cam);
  const len = dir.length();
  dir.divideScalar(len);
  let vis = 1;
  for (const b of BODIES) {
    const oc = b.c.clone().sub(cam);
    const along = oc.dot(dir);
    if (along < 0 || along > len) continue;
    const perp = Math.sqrt(Math.max(0, oc.lengthSq() - along * along));
    const soft = b.r * 0.012 + 1e-4;
    vis *= THREE.MathUtils.smoothstep(perp - b.r, -soft, soft);
  }
  return vis;
}

export function OverlayProbe() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), d: new THREE.Vector3(), c: new THREE.Vector3() }), []);

  useFrame(() => {
    overlay.width = size.width;
    overlay.height = size.height;
    const project = (world: THREE.Vector3, out: ScreenPoint, radius = 0) => {
      tmp.v.copy(world).project(camera);
      const camDir = tmp.d.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const inFront = tmp.c.copy(world).sub(camera.position).dot(camDir) > 0;
      out.x = (tmp.v.x * 0.5 + 0.5) * size.width;
      out.y = (-tmp.v.y * 0.5 + 0.5) * size.height;
      out.dist = camera.position.distanceTo(world) - radius;
      out.visible = inFront && Math.abs(tmp.v.x) < 1.2 && Math.abs(tmp.v.y) < 1.2;
    };
    project(SUN_POS, overlay.sun);
    overlay.sun.strength = overlay.sun.visible ? occlusion(camera.position, SUN_POS, tmp.c) : 0;

    project(EARTH_POS, overlay.earth, R_EARTH);
    project(MOON_POS, overlay.moon, R_MOON);
    project(MARS_POS, overlay.mars, R_MARS);
    const f = sim.frame;
    const center = tmp.v.copy(f.forward).multiplyScalar(SHIP_CENTER_OFFSET_M * SCALE).add(f.shipPos).clone();
    project(center, overlay.ship);
    overlay.ship.strength = THREE.MathUtils.smoothstep(overlay.ship.dist, 0.1, 0.8);
    overlay.earth.strength = THREE.MathUtils.smoothstep(overlay.earth.dist, 20, 60);
    overlay.moon.strength = THREE.MathUtils.smoothstep(overlay.moon.dist, 8, 30);
    overlay.mars.strength = THREE.MathUtils.smoothstep(overlay.mars.dist, 14, 50);
  });
  return null;
}
