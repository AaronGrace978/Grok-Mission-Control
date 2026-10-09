import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sim } from "@/sim/clock";
import {
  EARTH_POS,
  MARS_C,
  MARS_POS,
  MARS_W,
  MOON_POS,
  ORBIT_B,
  ORBIT_N,
  R_EARTH,
  SCALE,
  earthQuat,
  latLonToLocal,
  PAD_LATLON,
  shipPosAt,
} from "@/sim/geometry";
import { PHASE_BY_ID, type PhaseId } from "@/sim/timeline";
import { useUi, type ViewMode } from "@/state/ui";
import { SHIP_CENTER_OFFSET_M } from "./vehicle/Vehicles";

interface Pose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  up: THREE.Vector3;
  fov: number;
}

const newPose = (): Pose => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fov: 45 });

type ShotKind =
  | { kind: "ground"; tele: boolean }
  | { kind: "chase"; back: number; up: number; side: number; dist: number; ahead?: "moon" | "mars" }
  | { kind: "lookback"; body: "earth" | "moon" | "mars" }
  | { kind: "dock" }
  | { kind: "overview" }
  | { kind: "cockpit" };

interface Shot {
  id: string;
  shot: ShotKind;
}

const DIRECTOR: Record<PhaseId, [number, Shot][]> = {
  prelaunch: [[0, { id: "pad", shot: { kind: "ground", tele: false } }]],
  ascent: [
    [0, { id: "pad", shot: { kind: "ground", tele: false } }],
    [0.12, { id: "track", shot: { kind: "ground", tele: true } }],
    [0.4, { id: "asc-side", shot: { kind: "chase", back: 0.25, up: 0.1, side: 1, dist: 1.25 } }],
    [0.68, { id: "asc-rear", shot: { kind: "chase", back: -0.85, up: 0.42, side: 0.35, dist: 1.6 } }],
  ],
  leo: [
    [0, { id: "leo-wide", shot: { kind: "chase", back: -0.6, up: 0.55, side: 0.6, dist: 5 } }],
    [0.025, { id: "dock", shot: { kind: "dock" } }],
    [0.82, { id: "leo-chase", shot: { kind: "chase", back: -0.8, up: 0.4, side: 0.45, dist: 2.2 } }],
  ],
  tli: [[0, { id: "tli", shot: { kind: "chase", back: -0.9, up: 0.28, side: 0.42, dist: 1.8 } }]],
  coast: [
    [0, { id: "earth-back", shot: { kind: "lookback", body: "earth" } }],
    [0.32, { id: "cis-over", shot: { kind: "overview" } }],
    [0.7, { id: "to-moon", shot: { kind: "lookback", body: "moon" } }],
  ],
  lunar: [
    [0, { id: "loi", shot: { kind: "chase", back: -0.75, up: 0.5, side: 0.5, dist: 2.2 } }],
    [0.22, { id: "earthrise", shot: { kind: "lookback", body: "earth" } }],
    [0.6, { id: "lunar-over", shot: { kind: "overview" } }],
  ],
  tmi: [[0, { id: "tmi", shot: { kind: "chase", back: -0.9, up: 0.3, side: 0.4, dist: 1.9 } }]],
  cruise: [
    [0, { id: "moon-back", shot: { kind: "lookback", body: "moon" } }],
    [0.25, { id: "helio-over", shot: { kind: "overview" } }],
    [0.62, { id: "to-mars", shot: { kind: "lookback", body: "mars" } }],
  ],
  aerocapture: [
    [0, { id: "aero-side", shot: { kind: "chase", back: -0.2, up: 0.35, side: 1, dist: 2.6 } }],
    [0.62, { id: "aero-exit", shot: { kind: "chase", back: -0.85, up: 0.22, side: 0.55, dist: 2.4 } }],
  ],
  mars: [
    [0, { id: "mars-chase", shot: { kind: "chase", back: -0.8, up: 0.45, side: 0.45, dist: 2.2 } }],
    [0.3, { id: "mars-over", shot: { kind: "overview" } }],
  ],
};

const MANUAL: Record<Exclude<ViewMode, "director">, Shot> = {
  chase: { id: "m-chase", shot: { kind: "chase", back: -0.82, up: 0.36, side: 0.46, dist: 1.6 } },
  orbital: { id: "m-over", shot: { kind: "overview" } },
  cockpit: { id: "m-cockpit", shot: { kind: "cockpit" } },
};

function directorShot(phase: PhaseId, u: number): Shot {
  const list = DIRECTOR[phase];
  let s = list[0][1];
  for (const [u0, shot] of list) if (u >= u0) s = shot;
  return s;
}

const PAD_LOCAL = latLonToLocal(PAD_LATLON.lat, PAD_LATLON.lon);
const PAD_FRAME_Q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), PAD_LOCAL);
const GROUND_CAM_M = new THREE.Vector3(-1500, 22, 950);
const MARS_N = new THREE.Vector3().crossVectors(MARS_C, MARS_W).normalize();

function regionFor(phase: PhaseId, u: number, out: THREE.Vector3): { dist: number; up: THREE.Vector3 } {
  switch (phase) {
    case "coast":
      out.copy(EARTH_POS).lerp(MOON_POS, 0.5);
      return { dist: 205, up: ORBIT_N };
    case "lunar":
    case "tmi":
      out.copy(MOON_POS);
      return { dist: 18, up: ORBIT_N };
    case "cruise":
      out.copy(MOON_POS).lerp(MARS_POS, 0.5);
      return { dist: 2500, up: MARS_N };
    case "aerocapture":
    case "mars":
      out.copy(MARS_POS);
      return { dist: 30, up: MARS_N };
    default:
      void u;
      out.copy(EARTH_POS);
      return { dist: 36, up: ORBIT_N };
  }
}

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const view = useUi((s) => s.view);
  const viewRef = useRef(view);
  viewRef.current = view;

  const user = useRef({ yaw: 0, pitch: 0, zoom: 1, dragging: false, lx: 0, ly: 0 });
  const blend = useRef({ fromShot: null as Shot | null, toShot: null as Shot | null, start: -1, lastJump: -1 });
  const elapsed = useRef(0);

  const tmp = useMemo(
    () => ({
      a: newPose(),
      b: newPose(),
      C: new THREE.Vector3(),
      d: new THREE.Vector3(),
      U: new THREE.Vector3(),
      S: new THREE.Vector3(),
      v: new THREE.Vector3(),
      w: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      m: new THREE.Matrix4(),
      region: new THREE.Vector3(),
      regionSmoothed: new THREE.Vector3(),
      upSmoothed: new THREE.Vector3(0, 1, 0),
      distSmoothed: 36,
    }),
    [],
  );

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      user.current.dragging = true;
      user.current.lx = e.clientX;
      user.current.ly = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const u = user.current;
      if (!u.dragging) return;
      const dx = e.clientX - u.lx;
      const dy = e.clientY - u.ly;
      u.lx = e.clientX;
      u.ly = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 0 && viewRef.current === "director") useUi.getState().setView("chase");
      u.yaw -= dx * 0.005;
      u.pitch = THREE.MathUtils.clamp(u.pitch + dy * 0.004, -1.2, 1.2);
    };
    const up = (e: PointerEvent) => {
      user.current.dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      user.current.zoom = THREE.MathUtils.clamp(user.current.zoom * Math.exp(e.deltaY * 0.001), 0.35, 6);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl]);

  useEffect(() => {
    user.current.yaw = 0;
    user.current.pitch = 0;
    user.current.zoom = 1;
  }, [view]);

  useFrame((_, dt) => {
    elapsed.current += dt;
    const f = sim.frame;
    const { phase, u } = { phase: f.tel.phase, u: f.tel.u };
    const C = tmp.C.copy(f.forward).multiplyScalar(SHIP_CENTER_OFFSET_M * SCALE).add(f.shipPos);
    const shipLen = (f.boosterAttached ? 121 : 50) * SCALE;

    // Flight-path basis: d (direction of travel), U (away from reference body), S (side).
    const d = tmp.d.copy(f.shipVel);
    if (d.lengthSq() < 1e-14) d.copy(f.forward);
    d.normalize();
    const U = tmp.U.copy(f.nadir).negate();
    if (phase.id === "cruise") U.copy(ORBIT_N);
    const vertical = THREE.MathUtils.smoothstep(Math.abs(d.dot(U)), 0.75, 0.97);
    if (vertical > 0) {
      const hf = tmp.v.copy(ORBIT_B).addScaledVector(U, -ORBIT_B.dot(U)).normalize();
      d.lerp(hf, vertical).normalize();
    }
    U.addScaledVector(d, -U.dot(d)).normalize();
    const S = tmp.S.crossVectors(d, U).normalize();

    const compute = (shot: Shot, out: Pose) => {
      const s = shot.shot;
      const usr = user.current;
      switch (s.kind) {
        case "ground": {
          const rot = f.earthRot;
          const eq = earthQuat(rot, tmp.q);
          const local = tmp.v.copy(GROUND_CAM_M).multiplyScalar(SCALE).applyQuaternion(PAD_FRAME_Q).addScaledVector(PAD_LOCAL, R_EARTH);
          out.pos.copy(local).applyQuaternion(eq).add(EARTH_POS);
          out.up.copy(out.pos).sub(EARTH_POS).normalize();
          const dist = out.pos.distanceTo(C);
          if (s.tele) {
            out.look.copy(C);
            out.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan((shipLen * 1.5) / dist)), 2.5, 30);
          } else {
            out.look.copy(C).addScaledVector(out.up, -shipLen * 0.25);
            out.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan((shipLen * 2.8) / dist)), 4, 34);
          }
          break;
        }
        case "chase": {
          const dist = shipLen * s.dist * 2.2 * usr.zoom;
          const off = tmp.w.set(0, 0, 0).addScaledVector(d, s.back).addScaledVector(U, s.up).addScaledVector(S, s.side).normalize();
          off.applyAxisAngle(U, usr.yaw);
          const pitchAxis = tmp.v.crossVectors(off, U).normalize();
          if (pitchAxis.lengthSq() > 0.5) off.applyAxisAngle(pitchAxis, -usr.pitch);
          out.pos.copy(C).addScaledVector(off, dist);
          out.look.copy(C).addScaledVector(d, shipLen * 0.2);
          if (s.ahead) {
            const body = s.ahead === "moon" ? MOON_POS : MARS_POS;
            const toBody = tmp.v.copy(body).sub(C).normalize();
            out.look.addScaledVector(toBody, shipLen * 0.9);
          }
          out.up.copy(U);
          out.fov = 42;
          break;
        }
        case "lookback": {
          const body = s.body === "earth" ? EARTH_POS : s.body === "moon" ? MOON_POS : MARS_POS;
          const toBody = tmp.v.copy(body).sub(C).normalize();
          const perp = tmp.w.copy(U).addScaledVector(toBody, -U.dot(toBody)).normalize();
          out.pos.copy(C).addScaledVector(toBody, -shipLen * 2.6 * usr.zoom).addScaledVector(perp, shipLen * 0.7).addScaledVector(S, shipLen * 0.6);
          out.look.copy(C).addScaledVector(toBody, shipLen * 2.2);
          out.up.copy(perp);
          out.fov = 36;
          break;
        }
        case "dock": {
          const mid = tmp.v.copy(f.tankerVisible ? f.tankerPos : f.shipPos).add(f.shipPos).multiplyScalar(0.5);
          const gap = f.tankerVisible ? f.tankerPos.distanceTo(f.shipPos) : 0;
          const dist = Math.max(shipLen * 3.6, gap * 1.05) * usr.zoom;
          const off = tmp.w.set(0, 0, 0).addScaledVector(S, 1).addScaledVector(U, 0.42).addScaledVector(d, 0.12).normalize();
          off.applyAxisAngle(U, usr.yaw);
          out.pos.copy(mid).addScaledVector(off, dist);
          out.look.copy(mid);
          out.up.copy(U);
          out.fov = 40;
          break;
        }
        case "overview": {
          const reg = regionFor(phase.id, u, tmp.region);
          const dist = tmp.distSmoothed * usr.zoom;
          const upv = tmp.upSmoothed;
          const ref = Math.abs(upv.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
          const e1 = new THREE.Vector3().crossVectors(upv, ref).normalize();
          const e2 = new THREE.Vector3().crossVectors(upv, e1).normalize();
          const yaw = elapsed.current * 0.035 + usr.yaw + 0.8;
          const pitch = THREE.MathUtils.clamp(0.48 + usr.pitch, -1.35, 1.35);
          const dir = e1.multiplyScalar(Math.cos(yaw) * Math.cos(pitch)).addScaledVector(e2, Math.sin(yaw) * Math.cos(pitch)).addScaledVector(upv, Math.sin(pitch));
          out.pos.copy(tmp.regionSmoothed).addScaledVector(dir, dist);
          out.look.copy(tmp.regionSmoothed);
          out.up.copy(upv);
          out.fov = 40;
          void reg;
          break;
        }
        case "cockpit": {
          const back = tmp.v.set(0, 0, -1).applyQuaternion(f.shipQuat);
          out.pos.copy(f.shipPos).addScaledVector(f.forward, 43 * SCALE).addScaledVector(back, 5.4 * SCALE);
          const look = tmp.w.copy(f.forward).addScaledVector(back, -0.16).normalize();
          look.applyAxisAngle(back, user.current.yaw * 0.5);
          out.look.copy(out.pos).addScaledVector(look, 0.01);
          out.up.copy(back);
          out.fov = 72;
          break;
        }
      }
    };

    // Smooth overview region so the framing glides between Earth, Moon and Mars.
    const reg = regionFor(phase.id, u, tmp.region);
    const k = 1 - Math.exp(-dt * 1.4);
    const jumped = blend.current.lastJump !== sim.jumpId;
    if (jumped || tmp.regionSmoothed.lengthSq() === 0) {
      tmp.regionSmoothed.copy(tmp.region);
      tmp.upSmoothed.copy(reg.up);
      tmp.distSmoothed = reg.dist;
    } else {
      tmp.regionSmoothed.lerp(tmp.region, k);
      tmp.upSmoothed.lerp(reg.up, k).normalize();
      tmp.distSmoothed += (reg.dist - tmp.distSmoothed) * k;
    }

    const shot = viewRef.current === "director" ? directorShot(phase.id, u) : MANUAL[viewRef.current];
    const b = blend.current;
    if (!b.toShot || b.toShot.id !== shot.id) {
      b.fromShot = jumped ? null : b.toShot;
      b.toShot = shot;
      b.start = elapsed.current;
    }
    if (jumped) {
      b.fromShot = null;
      b.lastJump = sim.jumpId;
    }

    const pose = tmp.a;
    compute(shot, pose);
    const T = 1.7;
    const bt = (elapsed.current - b.start) / T;
    if (b.fromShot && bt < 1) {
      compute(b.fromShot, tmp.b);
      const e = bt * bt * (3 - 2 * bt);
      pose.pos.lerpVectors(tmp.b.pos, pose.pos, e);
      pose.look.lerpVectors(tmp.b.look, pose.look, e);
      pose.up.lerpVectors(tmp.b.up, pose.up, e).normalize();
      pose.fov = THREE.MathUtils.lerp(tmp.b.fov, pose.fov, e);
    }

    // Engine vibration while thrusting in the lower atmosphere.
    const thr = Math.max(f.tel.boosterThrottle, f.tel.shipThrottle * 0.25);
    const atmo = f.tel.phase.id === "ascent" || f.tel.phase.id === "prelaunch" ? Math.exp(-((f.tel.altitude ?? 0) / 25)) : 0.15;
    const shake = thr * atmo * 0.0045 * pose.pos.distanceTo(C);
    if (shake > 0) {
      const tt = elapsed.current * 40;
      pose.look.x += Math.sin(tt * 1.3) * shake;
      pose.look.y += Math.sin(tt * 1.7 + 1) * shake;
      pose.look.z += Math.sin(tt * 1.1 + 2) * shake;
    }

    camera.position.copy(pose.pos);
    camera.up.copy(pose.up);
    camera.lookAt(pose.look);
    const nearest = Math.min(camera.position.distanceTo(C), Math.max(1e-4, camera.position.distanceTo(EARTH_POS) - R_EARTH));
    const near = THREE.MathUtils.clamp(nearest * 0.02, 2e-6, 0.5);
    if (Math.abs(camera.fov - pose.fov) > 1e-3 || Math.abs(camera.near - near) / camera.near > 0.1) {
      camera.fov = pose.fov;
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  }, -1);

  return null;
}

/** Exposed so the cockpit HUD can render a flight path marker. */
export function shipScreenAhead(camera: THREE.Camera, out: THREE.Vector3) {
  const p = shipPosAt(sim.t + 0.5, new THREE.Vector3());
  return out.copy(p).project(camera);
}

void PHASE_BY_ID;
