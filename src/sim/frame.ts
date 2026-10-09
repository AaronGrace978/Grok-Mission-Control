import { Matrix4, Quaternion, Vector3 } from "three";
import { clamp, easeInOut, gauss, lerp, smoothstep, TAU } from "./math";
import {
  EVENTS,
  PHASES,
  PHASE_BY_ID,
  TOTAL_DEMO,
  lastEvent,
  metAt,
  nextEvent,
  phaseAt,
  throttleAt,
  type MissionEvent,
  type Phase,
  type PhaseId,
  type TargetBody,
} from "./timeline";
import {
  EARTH_POS,
  HOT_STAGE_T,
  MARS_POS,
  MOON_POS,
  ORBIT_B,
  PAD_DIR,
  R_EARTH,
  R_LEO,
  R_LUNAR_ORBIT,
  R_MARS,
  R_MOON,
  SCALE,
  SUN_DIR,
  aeroRadius,
  ascentProfile,
  earthRotation,
  shipPosAt,
} from "./geometry";
import { helioState, type HelioState } from "./helio";

export type RefBody = "EARTH" | "MOON" | "SUN" | "MARS";
export type CommsState = "NOMINAL" | "LOS" | "BLACKOUT" | "DEEP SPACE";

export interface Telemetry {
  met: number;
  phase: Phase;
  u: number;
  progress: number;
  speed: number;
  speedRef: RefBody;
  altitude: number | null;
  altRef: RefBody;
  distEarth: number;
  distTarget: number;
  target: TargetBody;
  shipProp: number;
  lox: number;
  ch4: number;
  boosterProp: number | null;
  gLoad: number;
  q: number | null;
  lightTime: number;
  comms: CommsState;
  shipThrottle: number;
  boosterThrottle: number;
  plasma: number;
  helio: HelioState;
  next: MissionEvent | null;
  last: MissionEvent | null;
  docked: boolean;
}

export interface SimFrame {
  t: number;
  shipPos: Vector3;
  shipQuat: Quaternion;
  shipVel: Vector3;
  forward: Vector3;
  /** Unit vector from the ship toward the current reference body centre. */
  nadir: Vector3;
  refCenter: Vector3;
  refRadius: number;
  boosterAttached: boolean;
  boosterVisible: boolean;
  boosterPos: Vector3;
  boosterQuat: Quaternion;
  tankerVisible: boolean;
  tankerPos: Vector3;
  tankerQuat: Quaternion;
  hotStageFlash: number;
  earthRot: number;
  tel: Telemetry;
}

const C_KM_S = 299_792.458;
const MU_E = 398_600.4;
const MU_M = 4_902.8;
const MOON_DIST = 384_400;
const MOON_R = 1_737.4;
const LUNAR_ORBIT_R = MOON_R + 100;
const MARS_R = 3_389.5;
const COAST_RP_KM = 6371 + 420;
const COAST_RA_KM = MOON_DIST + LUNAR_ORBIT_R;
const COAST_A_KM = (COAST_RP_KM + COAST_RA_KM) / 2;
/** Hyperbolic excess speed relative to the Moon at arrival (Moon orbital speed minus apogee speed). */
const LUNAR_VINF = 1.022 - Math.sqrt(MU_E * (2 / COAST_RA_KM - 1 / COAST_A_KM));

const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpC = new Vector3();
const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const mHat = MOON_POS.clone().normalize();

// --- Propellant consumption segments (fraction of ship main tanks).
type PropSeg = { phase: PhaseId; u0: number; u1: number; to: number };
const SHIP_PROP: PropSeg[] = [
  { phase: "ascent", u0: 0.533, u1: 0.997, to: 0.09 },
  { phase: "leo", u0: 0.2, u1: 0.76, to: 1 },
  { phase: "tli", u0: 0.03, u1: 0.97, to: 0.74 },
  { phase: "coast", u0: 0.44, u1: 0.475, to: 0.735 },
  { phase: "lunar", u0: 0.0, u1: 0.075, to: 0.66 },
  { phase: "tmi", u0: 0.03, u1: 0.97, to: 0.31 },
  { phase: "cruise", u0: 0.12, u1: 0.135, to: 0.305 },
  { phase: "cruise", u0: 0.8, u1: 0.812, to: 0.3 },
  { phase: "mars", u0: 0.2, u1: 0.34, to: 0.26 },
];
const SHIP_PROP_T = SHIP_PROP.map((s) => {
  const p = PHASE_BY_ID[s.phase];
  return { t0: p.start + p.demo * s.u0, t1: p.start + p.demo * s.u1, to: s.to };
});
// The ship's own ascent burn starts at hot staging, regardless of the table's nominal u0.
SHIP_PROP_T[0].t0 = HOT_STAGE_T;

function shipPropAt(t: number) {
  let v = 1;
  for (const s of SHIP_PROP_T) {
    if (t < s.t0) break;
    v = lerp(v, s.to, clamp((t - s.t0) / (s.t1 - s.t0)));
  }
  return v;
}

// --- Booster separation reference state.
const SEP_POS = shipPosAt(HOT_STAGE_T);
const SEP_VEL = shipPosAt(HOT_STAGE_T + 0.02).sub(shipPosAt(HOT_STAGE_T - 0.02)).divideScalar(0.04);
const SEP_UP = SEP_POS.clone().normalize();

function refBodyFor(phaseId: PhaseId, u: number, pos: Vector3, outCenter: Vector3) {
  switch (phaseId) {
    case "coast":
      return u < 0.6 ? (outCenter.copy(EARTH_POS), R_EARTH) : (outCenter.copy(MOON_POS), R_MOON);
    case "lunar":
    case "tmi":
      return outCenter.copy(MOON_POS), R_MOON;
    case "cruise":
      return u < 0.55 ? (outCenter.copy(SUN_DIR).multiplyScalar(14000), 60) : (outCenter.copy(MARS_POS), R_MARS);
    case "aerocapture":
    case "mars":
      return outCenter.copy(MARS_POS), R_MARS;
    default:
      void pos;
      return outCenter.copy(EARTH_POS), R_EARTH;
  }
}

function attitude(phaseId: PhaseId, u: number, t: number, _pos: Vector3, vel: Vector3, nadir: Vector3, out: Quaternion) {
  const f = tmpA;
  if (vel.lengthSq() < 1e-14) f.copy(PAD_DIR);
  else f.copy(vel).normalize();

  const belly = tmpB.copy(nadir).addScaledVector(f, -nadir.dot(f));
  if (phaseId === "prelaunch" || phaseId === "ascent" || phaseId === "leo" || phaseId === "tli") {
    const fb = tmpC.copy(ORBIT_B).negate();
    fb.addScaledVector(f, -fb.dot(f));
    belly.addScaledVector(fb, 0.35);
  }
  if (belly.lengthSq() < 1e-10) belly.set(0, 0, 1).addScaledVector(f, -f.z);
  belly.normalize();
  const x = tmpC.crossVectors(f, belly).normalize();
  tmpM.makeBasis(x, f, belly);
  out.setFromRotationMatrix(tmpM);

  if (phaseId === "aerocapture") {
    const alpha = (70 * Math.PI) / 180 * smoothstep(0.0, 0.1, u) * (1 - smoothstep(0.6, 0.78, u));
    out.multiply(tmpQ.setFromAxisAngle(X_AXIS, -alpha));
  } else if (phaseId === "cruise") {
    // Slow thermal "barbecue" roll that lands back on zero at both ends of the phase.
    const roll = TAU * 2 * easeInOut(u);
    out.multiply(tmpQ.setFromAxisAngle(Y_AXIS, roll));
  }
  void t;
  return out;
}

function shipQuatAt(t: number, out: Quaternion) {
  const { phase, u } = phaseAt(t);
  const p = shipPosAt(t, new Vector3());
  const v = shipPosAt(t + 0.01, new Vector3()).sub(shipPosAt(t - 0.01, new Vector3()));
  const c = new Vector3();
  refBodyFor(phase.id, u, p, c);
  const n = c.sub(p).normalize();
  return attitude(phase.id, u, t, p, v, n, out);
}

const SEP_QUAT = shipQuatAt(HOT_STAGE_T, new Quaternion());
const SEP_FORWARD = new Vector3(0, 1, 0).applyQuaternion(SEP_QUAT);

/** Lunar AOS is where the ship clears the lunar limb as seen from Earth. */
(() => {
  const lunar = PHASE_BY_ID.lunar;
  for (let i = 1; i <= 400; i++) {
    const u = i / 400;
    const p = shipPosAt(lunar.start + lunar.demo * u);
    const rel = p.sub(MOON_POS);
    const along = rel.dot(mHat);
    const perp = rel.addScaledVector(mHat, -along).length() * (LUNAR_ORBIT_R / R_LUNAR_ORBIT);
    if (along < 0 || perp > MOON_R) {
      const ev = EVENTS.find((e) => e.id === "aos");
      if (ev) {
        ev.u = u;
        ev.t = lunar.start + lunar.demo * u;
        ev.met = metAt(lunar, u);
      }
      break;
    }
  }
  EVENTS.sort((a, b) => a.t - b.t);
})();

export function createFrame(): SimFrame {
  return {
    t: 0,
    shipPos: new Vector3(),
    shipQuat: new Quaternion(),
    shipVel: new Vector3(),
    forward: new Vector3(0, 1, 0),
    nadir: new Vector3(0, -1, 0),
    refCenter: new Vector3(),
    refRadius: R_EARTH,
    boosterAttached: true,
    boosterVisible: true,
    boosterPos: new Vector3(),
    boosterQuat: new Quaternion(),
    tankerVisible: false,
    tankerPos: new Vector3(),
    tankerQuat: new Quaternion(),
    hotStageFlash: 0,
    earthRot: 0,
    tel: {} as Telemetry,
  };
}

const p1 = new Vector3();
const p2 = new Vector3();
const realPos = new Vector3();

export function computeFrame(t: number, f: SimFrame): SimFrame {
  const { phase, u } = phaseAt(t);
  const met = metAt(phase, u);
  f.t = t;

  shipPosAt(t, f.shipPos);
  shipPosAt(t + 0.01, p1);
  shipPosAt(t - 0.01, p2);
  f.shipVel.copy(p1).sub(p2).divideScalar(0.02);

  f.refRadius = refBodyFor(phase.id, u, f.shipPos, f.refCenter);
  f.nadir.copy(f.refCenter).sub(f.shipPos).normalize();
  attitude(phase.id, u, t, f.shipPos, f.shipVel, f.nadir, f.shipQuat);
  f.forward.set(0, 1, 0).applyQuaternion(f.shipQuat);

  // --- Booster
  const tau = t - HOT_STAGE_T;
  f.boosterAttached = tau < 0;
  if (f.boosterAttached) {
    f.boosterVisible = true;
    f.boosterPos.copy(f.shipPos);
    f.boosterQuat.copy(f.shipQuat);
  } else {
    f.boosterVisible = tau < 16;
    const tt = Math.min(tau, 9);
    f.boosterPos
      .copy(SEP_POS)
      .addScaledVector(SEP_VEL, tt - 0.08 * tt * tt)
      .addScaledVector(SEP_FORWARD, -8 * SCALE * Math.min(tau, 1.5))
      .addScaledVector(SEP_UP, -0.0004 * tt * tt);
    const flip = Math.PI * smoothstep(0.6, 3.8, tau);
    f.boosterQuat.copy(SEP_QUAT).multiply(tmpQ.setFromAxisAngle(X_AXIS, flip));
  }
  f.hotStageFlash = tau > -0.25 && tau < 2 ? Math.exp(-Math.max(0, tau) * 2.4) * smoothstep(-0.25, 0, tau) : 0;

  // --- Orbital tanker (LEO prop transfer), docked tail-to-tail.
  f.tankerVisible = phase.id === "leo" && u > 0.03 && u < 0.99;
  if (f.tankerVisible) {
    const approach = 1 - smoothstep(0.03, 0.15, u);
    const depart = smoothstep(0.8, 0.98, u);
    const gapM = 9.5 + 520 * approach * approach + 450 * depart * depart;
    f.tankerPos.copy(f.shipPos).addScaledVector(f.forward, -gapM * SCALE);
    const belly = tmpB.set(0, 0, 1).applyQuaternion(f.shipQuat);
    const nose = tmpA.copy(f.forward).negate();
    const x = tmpC.crossVectors(nose, belly).normalize();
    tmpM.makeBasis(x, nose, belly);
    f.tankerQuat.setFromRotationMatrix(tmpM);
  }

  f.earthRot = earthRotation(t, met);

  // --- Telemetry
  const tel = f.tel;
  tel.met = met;
  tel.phase = phase;
  tel.u = u;
  tel.progress = t / TOTAL_DEMO;
  tel.target = phase.target;
  tel.shipThrottle = throttleAt(t, "ship");
  tel.boosterThrottle = f.boosterAttached || (tau > 3.9 && tau < 7) ? (f.boosterAttached ? throttleAt(t, "booster") : 0.55) : 0;
  tel.plasma = 0;
  tel.q = null;
  tel.boosterProp = null;
  tel.gLoad = 0;
  tel.docked = phase.id === "leo" && u > 0.15 && u < 0.8;
  tel.comms = "NOMINAL";

  const sceneDirFromEarth = tmpA.copy(f.shipPos).normalize();
  const cruiseTau = met - PHASE_BY_ID.cruise.met0;
  tel.helio = helioState(cruiseTau);

  let distEarth = R_EARTH;
  switch (phase.id) {
    case "prelaunch":
    case "ascent": {
      const prof = ascentProfile(Math.max(0, met));
      const prev = ascentProfile(Math.max(0, met - 1));
      tel.speed = prof.vel;
      tel.speedRef = "EARTH";
      tel.altitude = prof.alt;
      distEarth = 6371 + prof.alt;
      const rho = 1.225 * Math.exp(-prof.alt / 8.5);
      tel.q = (0.5 * rho * (prof.vel * 1000) ** 2) / 1000;
      const accel = (prof.vel - prev.vel) * 1000 / 9.81;
      const powered = Math.max(tel.boosterThrottle, tel.shipThrottle);
      tel.gLoad = phase.id === "prelaunch" ? 1 : powered > 0.1 ? clamp(accel + 0.9 * (1 - met / 510), 0.4, 4) : 0.05;
      tel.boosterProp = f.boosterAttached ? lerp(1, 0.075, clamp(met / 159)) : null;
      break;
    }
    case "leo":
      tel.speed = 7.79;
      tel.speedRef = "EARTH";
      tel.altitude = 200 + 1.5 * Math.sin(u * 9);
      distEarth = 6371 + tel.altitude;
      break;
    case "tli": {
      const k = smoothstep(0.03, 0.97, u);
      tel.speed = lerp(7.79, 10.93, k);
      tel.speedRef = "EARTH";
      tel.altitude = lerp(200, 420, k * k);
      distEarth = 6371 + tel.altitude;
      tel.gLoad = tel.shipThrottle * 0.9;
      break;
    }
    case "coast": {
      const a = COAST_A_KM;
      const e = (COAST_RA_KM - COAST_RP_KM) / (COAST_RA_KM + COAST_RP_KM);
      const rScene = f.shipPos.length();
      const eS = (R_LUNAR_ORBIT + MOON_POS.length() - R_LEO) / (R_LUNAR_ORBIT + MOON_POS.length() + R_LEO);
      const pS = R_LEO * (1 + eS);
      const cosNu = clamp((pS / rScene - 1) / eS, -1, 1);
      const r = (a * (1 - e * e)) / (1 + e * cosNu);
      distEarth = r;
      realPos.copy(sceneDirFromEarth).multiplyScalar(r);
      const dMoon = realPos.distanceTo(tmpB.copy(mHat).multiplyScalar(MOON_DIST));
      const vEarth = Math.sqrt(MU_E * (2 / r - 1 / a));
      if (dMoon < 66_100) {
        tel.speed = Math.sqrt(LUNAR_VINF * LUNAR_VINF + (2 * MU_M) / dMoon);
        tel.speedRef = "MOON";
        tel.altitude = dMoon - MOON_R;
        tel.altRef = "MOON";
      } else {
        tel.speed = vEarth;
        tel.speedRef = "EARTH";
        tel.altitude = r - 6371;
      }
      tel.gLoad = tel.shipThrottle * 0.05;
      break;
    }
    case "lunar":
    case "tmi": {
      const rel = tmpB.copy(f.shipPos).sub(MOON_POS);
      const rScene = rel.length();
      const dMoon = phase.id === "lunar" ? LUNAR_ORBIT_R : LUNAR_ORBIT_R * Math.pow(rScene / R_LUNAR_ORBIT, 1.6);
      realPos.copy(mHat).multiplyScalar(MOON_DIST).addScaledVector(rel.normalize(), dMoon);
      distEarth = realPos.length();
      const vCirc = Math.sqrt(MU_M / LUNAR_ORBIT_R);
      if (phase.id === "lunar") {
        const vArr = Math.sqrt(LUNAR_VINF * LUNAR_VINF + (2 * MU_M) / LUNAR_ORBIT_R);
        tel.speed = lerp(vArr, vCirc, smoothstep(0, 0.075, u));
        tel.gLoad = tel.shipThrottle * 0.6;
      } else {
        tel.speed = lerp(vCirc, 3.05, smoothstep(0.03, 0.97, u));
        tel.gLoad = tel.shipThrottle * 1.1;
      }
      tel.speedRef = "MOON";
      tel.altitude = dMoon - MOON_R;
      tel.altRef = "MOON";
      const along = tmpC.copy(realPos).sub(tmpB.copy(mHat).multiplyScalar(MOON_DIST));
      const a = along.dot(mHat);
      const perp = along.addScaledVector(mHat, -a).length();
      if (a > 0 && perp < MOON_R) tel.comms = "LOS";
      break;
    }
    case "cruise": {
      distEarth = tel.helio.earthDist + 390_000 * (1 - smoothstep(0, 0.04, u));
      tel.speed = tel.helio.shipSpeed;
      tel.speedRef = "SUN";
      tel.altitude = null;
      tel.gLoad = tel.shipThrottle * 0.05;
      break;
    }
    case "aerocapture": {
      tel.speed = lerp(5.62, 3.48, smoothstep(0.1, 0.56, u));
      tel.speedRef = "MARS";
      tel.altitude = MARS_R * (aeroRadius(u) / R_MARS - 1);
      tel.altRef = "MARS";
      tel.plasma = smoothstep(0.07, 0.2, u) * (1 - smoothstep(0.4, 0.58, u));
      tel.gLoad = 3.4 * gauss(u, 0.3, 0.075) + 0.02;
      distEarth = tel.helio.earthDist;
      if (tel.plasma > 0.55) tel.comms = "BLACKOUT";
      else tel.comms = "DEEP SPACE";
      break;
    }
    case "mars": {
      const raise = smoothstep(0.2, 0.34, u);
      tel.speed = lerp(3.44, 3.41, raise);
      tel.speedRef = "MARS";
      tel.altitude = lerp(407, 441, raise) + 2 * Math.sin(u * 7);
      tel.altRef = "MARS";
      tel.gLoad = tel.shipThrottle * 0.4;
      distEarth = tel.helio.earthDist;
      tel.comms = "DEEP SPACE";
      break;
    }
  }
  if (phase.id !== "coast" && phase.id !== "lunar" && phase.id !== "tmi" && phase.id !== "aerocapture" && phase.id !== "mars") {
    tel.altRef = "EARTH";
  }
  if (phase.id === "coast" && tel.speedRef !== "MOON") tel.altRef = "EARTH";
  if (phase.id === "cruise") {
    tel.altRef = "SUN";
    if (u > 0.4) tel.comms = "DEEP SPACE";
  }

  tel.distEarth = distEarth;
  if (phase.target === "MOON") {
    if (phase.id === "lunar" || (phase.id === "coast" && tel.altRef === "MOON")) {
      tel.distTarget = tel.altitude ?? 0;
    } else {
      realPos.copy(sceneDirFromEarth).multiplyScalar(distEarth);
      tel.distTarget = Math.max(0, realPos.distanceTo(tmpB.copy(mHat).multiplyScalar(MOON_DIST)) - MOON_R);
    }
  } else if (phase.id === "aerocapture" || phase.id === "mars") {
    tel.distTarget = tel.altitude ?? 0;
  } else if (phase.id === "cruise") {
    tel.distTarget = Math.max(tel.helio.marsDist, 850 + (1 - u) * 1e6);
  } else {
    tel.distTarget = tel.helio.marsDist + 2_000_000 * (1 - u);
  }
  tel.lightTime = distEarth / C_KM_S;

  tel.shipProp = shipPropAt(t);
  tel.lox = clamp(tel.shipProp * 1.004 + 0.002);
  tel.ch4 = clamp(tel.shipProp * 0.992);
  tel.next = nextEvent(t);
  tel.last = lastEvent(t);
  return f;
}

export { PHASES, TOTAL_DEMO };
