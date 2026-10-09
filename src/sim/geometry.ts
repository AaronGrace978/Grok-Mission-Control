import { Quaternion, Vector3 } from "three";
import { DEG, TAU, clamp, hermite1, lerp, smoothstep, trueAnomaly, wrapAbove } from "./math";
import { PHASE_BY_ID, phaseAt, metAt, uForMet, type PhaseId } from "./timeline";

/**
 * Scene layout. Distances between bodies are compressed for cinematography; vehicle
 * dimensions are modelled in meters and scaled by SCALE (exaggerated ~13x relative to Earth).
 */
export const SCALE = 2e-5;
export const R_EARTH = 10;
export const R_MOON = 2.73;
export const R_MARS = 5.32;

export const EARTH_POS = new Vector3(0, 0, 0);
export const MOON_POS = new Vector3(118, 14, -96);
/** Placed so the arrival leg runs ~60° off the Sun line: aerocapture over the dayside, exit at the terminator. */
export const MARS_POS = new Vector3(1463, 239, 1078);
export const SUN_DIR = new Vector3(-0.2, 0.25, 0.95).normalize();
export const SUN_DISTANCE = 14000;
export const SUN_POS = SUN_DIR.clone().multiplyScalar(SUN_DISTANCE);

export const EARTH_TILT = 23.44 * DEG;
export const PAD_LATLON = { lat: 25.997, lon: -97.157 };

/** Ship engine plane sits this high above the pad when stacked (mount + booster). */
export const STACK_HEIGHT_M = 20 + 71;
export const SHIP_LENGTH_M = 50;
export const BOOSTER_LENGTH_M = 71;

const Y = new Vector3(0, 1, 0);
const tiltQ = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), EARTH_TILT);

export function latLonToLocal(lat: number, lon: number, out = new Vector3()) {
  const phi = ((lon + 180) / 360) * TAU;
  const la = lat * DEG;
  return out.set(-Math.cos(phi) * Math.cos(la), Math.sin(la), Math.sin(phi) * Math.cos(la));
}

export function earthQuat(rot: number, out = new Quaternion()) {
  return out.setFromAxisAngle(Y, rot).premultiply(tiltQ);
}

const PAD_LOCAL = latLonToLocal(PAD_LATLON.lat, PAD_LATLON.lon);

/** Earth spin angle at launch, chosen so Starbase is in mid-morning sunlight. */
export const EARTH_ROT_LAUNCH = (() => {
  let best = 0;
  let bestDot = -2;
  const q = new Quaternion();
  const p = new Vector3();
  for (let i = 0; i < 1440; i++) {
    const rot = (i / 1440) * TAU;
    p.copy(PAD_LOCAL).applyQuaternion(earthQuat(rot, q));
    const d = p.dot(SUN_DIR);
    if (d > bestDot) {
      bestDot = d;
      best = rot;
    }
  }
  return best - 0.5;
})();

const EARTH_OMEGA = 7.2921e-5;
const leoEndT = PHASE_BY_ID.leo.end;
const leoEndMet = PHASE_BY_ID.leo.met1;

/** Real sidereal rate through Earth orbit, then a slow visual spin so long phases don't strobe. */
export function earthRotation(t: number, met: number) {
  if (t <= leoEndT) return EARTH_ROT_LAUNCH + EARTH_OMEGA * Math.max(0, met);
  return EARTH_ROT_LAUNCH + EARTH_OMEGA * leoEndMet + 0.02 * (t - leoEndT);
}

export const PAD_DIR = PAD_LOCAL.clone().applyQuaternion(earthQuat(EARTH_ROT_LAUNCH)).normalize();

// ---- Orbit plane: contains the pad and the Moon so the transfer ellipse lands behind the Moon.
const mHat = MOON_POS.clone().normalize();
export const ORBIT_A = PAD_DIR.clone();
export const ORBIT_B = mHat.clone().sub(ORBIT_A.clone().multiplyScalar(mHat.dot(ORBIT_A))).normalize();
export const ORBIT_N = new Vector3().crossVectors(ORBIT_A, ORBIT_B).normalize();

export const R_LEO = R_EARTH * 1.035;
export const R_LUNAR_ORBIT = R_MOON * 1.058;
const PAD_R = R_EARTH + STACK_HEIGHT_M * SCALE;

const THETA_ASCENT = 0.95;
const TLI_SWEEP = 0.5;
const THETA_DEP = wrapAbove(Math.atan2(-mHat.dot(ORBIT_B), -mHat.dot(ORBIT_A)), THETA_ASCENT + TLI_SWEEP + 1.4);
const THETA_TLI0 = THETA_DEP - TLI_SWEEP;

const COAST_RA = MOON_POS.length() + R_LUNAR_ORBIT;
const COAST_E = (COAST_RA - R_LEO) / (COAST_RA + R_LEO);
const COAST_P = R_LEO * (1 + COAST_E);

// ---- Lunar orbit and departure toward Mars.
const marsFromMoon = MARS_POS.clone().sub(MOON_POS).normalize();
const PSI0 = THETA_DEP + Math.PI;
const TMI_SWEEP = 1.15;
const PSI_TMI1 = wrapAbove(Math.atan2(marsFromMoon.dot(ORBIT_B), marsFromMoon.dot(ORBIT_A)) - Math.PI / 2, PSI0 + 3.6 + TMI_SWEEP);
const PSI_TMI0 = PSI_TMI1 - TMI_SWEEP;
const TMI_R1 = R_LUNAR_ORBIT * 1.7;

function inPlane(center: Vector3, r: number, angle: number, out: Vector3) {
  return out
    .copy(ORBIT_A)
    .multiplyScalar(Math.cos(angle) * r)
    .addScaledVector(ORBIT_B, Math.sin(angle) * r)
    .add(center);
}

function tmiPos(u: number, out: Vector3) {
  const psi = lerp(PSI_TMI0, PSI_TMI1, u);
  const r = lerp(R_LUNAR_ORBIT, TMI_R1, u * u);
  return inPlane(MOON_POS, r, psi, out);
}

const CRUISE_P0 = tmiPos(1, new Vector3());
const CRUISE_T0 = tmiPos(1, new Vector3()).sub(tmiPos(0.995, new Vector3())).normalize();
const marsApproach = MARS_POS.clone().sub(CRUISE_P0).normalize();
export const MARS_C = SUN_DIR.clone().sub(marsApproach.clone().multiplyScalar(SUN_DIR.dot(marsApproach))).normalize();
export const MARS_W = marsApproach.clone();
const R_MARS_ENTRY = R_MARS * 1.25;
const CRUISE_P1 = MARS_POS.clone().addScaledVector(MARS_C, R_MARS_ENTRY);
const CRUISE_L = CRUISE_P1.distanceTo(CRUISE_P0);
const CRUISE_BULGE = MARS_C.clone().multiplyScalar(-0.1 * CRUISE_L);

const AERO_SWEEP = 2.3;
const MARS_ORBIT_SWEEP = TAU * 0.85;

function marsPlane(r: number, phi: number, out: Vector3) {
  return out
    .copy(MARS_C)
    .multiplyScalar(Math.cos(phi) * r)
    .addScaledVector(MARS_W, Math.sin(phi) * r)
    .add(MARS_POS);
}

/** Real ascent profile (km, km/s) by MET seconds. */
export function ascentProfile(met: number) {
  const t = clamp(met, 0, 510);
  if (t < 159) {
    const x = t / 159;
    return { alt: 65 * Math.pow(x, 1.9), vel: 1.5 * Math.pow(x, 1.6) };
  }
  const y = (t - 159) / 351;
  return { alt: 65 + 135 * (1 - (1 - y) ** 2), vel: 1.5 + 6.3 * Math.pow(y, 1.25) };
}

function ascentTheta(x: number) {
  return THETA_ASCENT * Math.pow(x, 2.5);
}

const ascentPhase = PHASE_BY_ID.ascent;
const leoPhase = PHASE_BY_ID.leo;
const tliPhase = PHASE_BY_ID.tli;
// dθ/du at the end of ascent (θ = Θ·x^2.5 with x = u^metCurve).
const ASCENT_END_RATE = (THETA_ASCENT * 2.5 * ascentPhase.metCurve) / ascentPhase.demo;
const TLI_RATE = TLI_SWEEP / tliPhase.demo;

function coastNu(u: number) {
  const kep = trueAnomaly(Math.PI * u, COAST_E);
  return lerp(kep, Math.PI * u, 0.55);
}

/** Vehicle reference point (ship engine plane) in scene coordinates for a phase/u. */
export function shipPos(phaseId: PhaseId, u: number, out = new Vector3()): Vector3 {
  switch (phaseId) {
    case "prelaunch":
      return out.copy(PAD_DIR).multiplyScalar(PAD_R);
    case "ascent": {
      const met = metAt(ascentPhase, u);
      const { alt } = ascentProfile(met);
      const r = lerp(PAD_R, R_LEO, alt / 200);
      return inPlane(EARTH_POS, r, ascentTheta(met / 510), out);
    }
    case "leo": {
      const theta = hermite1(THETA_ASCENT, THETA_TLI0, ASCENT_END_RATE * leoPhase.demo, TLI_RATE * leoPhase.demo, u);
      return inPlane(EARTH_POS, R_LEO, theta, out);
    }
    case "tli":
      return inPlane(EARTH_POS, R_LEO, lerp(THETA_TLI0, THETA_DEP, u), out);
    case "coast": {
      const nu = coastNu(u);
      const r = COAST_P / (1 + COAST_E * Math.cos(nu));
      return inPlane(EARTH_POS, r, THETA_DEP + nu, out);
    }
    case "lunar":
      return inPlane(MOON_POS, R_LUNAR_ORBIT, lerp(PSI0, PSI_TMI0, u), out);
    case "tmi":
      return tmiPos(u, out);
    case "cruise": {
      const s = lerp(u, u * u * (3 - 2 * u), 0.35);
      const L = CRUISE_L * 0.9;
      out.set(
        hermite1(CRUISE_P0.x, CRUISE_P1.x, CRUISE_T0.x * L, MARS_W.x * L, s),
        hermite1(CRUISE_P0.y, CRUISE_P1.y, CRUISE_T0.y * L, MARS_W.y * L, s),
        hermite1(CRUISE_P0.z, CRUISE_P1.z, CRUISE_T0.z * L, MARS_W.z * L, s),
      );
      const bump = Math.sin(Math.PI * s) ** 2;
      return out.addScaledVector(CRUISE_BULGE, bump);
    }
    case "aerocapture": {
      const r = aeroRadius(u);
      return marsPlane(r, AERO_SWEEP * u, out);
    }
    case "mars": {
      const raise = smoothstep(0.2, 0.34, u);
      return marsPlane(R_MARS * lerp(1.12, 1.13, raise), AERO_SWEEP + MARS_ORBIT_SWEEP * u, out);
    }
  }
}

export function aeroRadius(u: number) {
  if (u < 0.35) return R_MARS * (1.015 + 0.235 * (0.5 + 0.5 * Math.cos((Math.PI * u) / 0.35)));
  return R_MARS * (1.015 + 0.105 * smoothstep(0.35, 0.9, u));
}

export function shipPosAt(t: number, out = new Vector3()) {
  const { phase, u } = phaseAt(t);
  return shipPos(phase.id, u, out);
}

export const HOT_STAGE_T = ascentPhase.start + ascentPhase.demo * uForMet(ascentPhase, 162);

/** Sample the full mission path for trajectory rendering. */
export function sampleTrajectory() {
  const counts: Record<PhaseId, number> = {
    prelaunch: 1,
    ascent: 120,
    leo: 220,
    tli: 50,
    coast: 260,
    lunar: 260,
    tmi: 80,
    cruise: 360,
    aerocapture: 140,
    mars: 200,
  };
  const pts: Vector3[] = [];
  const times: number[] = [];
  for (const id of Object.keys(counts) as PhaseId[]) {
    const p = PHASE_BY_ID[id];
    const n = counts[id];
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : i / (n - 1);
      pts.push(shipPos(id, u));
      times.push(p.start + p.demo * u);
    }
  }
  return { pts, times };
}
