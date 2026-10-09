import { clamp } from "./math";

export type PhaseId =
  | "prelaunch"
  | "ascent"
  | "leo"
  | "tli"
  | "coast"
  | "lunar"
  | "tmi"
  | "cruise"
  | "aerocapture"
  | "mars";

export type TargetBody = "MOON" | "MARS";

export interface Phase {
  id: PhaseId;
  index: number;
  name: string;
  short: string;
  blurb: string;
  target: TargetBody;
  /** Demo seconds at 1x playback. */
  demo: number;
  /** Simulated mission elapsed time span, seconds. */
  met0: number;
  met1: number;
  /** MET = met0 + (met1 - met0) * u^metCurve, so slow phases can play near real-time early on. */
  metCurve: number;
  start: number;
  end: number;
}

const DAY = 86400;
const CRUISE_DAYS = 259;
const CRUISE_START = 353_400;
const ARRIVAL = CRUISE_START + CRUISE_DAYS * DAY;

type PhaseDef = Omit<Phase, "index" | "start" | "end">;

const DEFS: PhaseDef[] = [
  { id: "prelaunch", name: "Terminal Count", short: "COUNT", blurb: "Final GO/NO-GO poll at the orbital launch mount. Propellant load complete.", target: "MOON", demo: 9, met0: -10, met1: 0, metCurve: 1 },
  { id: "ascent", name: "Liftoff & Ascent", short: "ASCENT", blurb: "33 booster engines to MECO, hot staging, then six ship engines to orbit.", target: "MOON", demo: 32, met0: 0, met1: 510, metCurve: 2.2 },
  { id: "leo", name: "Earth Orbit · Prop Transfer", short: "LEO", blurb: "Rendezvous with an orbital tanker and refill the main tanks for the deep-space legs.", target: "MOON", demo: 24, met0: 510, met1: 16_200, metCurve: 1 },
  { id: "tli", name: "Trans-Lunar Injection", short: "TLI", blurb: "Six-minute burn raises apogee to lunar distance.", target: "MOON", demo: 9, met0: 16_200, met1: 16_560, metCurve: 1 },
  { id: "coast", name: "Translunar Coast", short: "COAST", blurb: "Three-day ballistic coast toward the Moon with one mid-course correction.", target: "MOON", demo: 18, met0: 16_560, met1: 266_400, metCurve: 1 },
  { id: "lunar", name: "Lunar Orbit", short: "LUNAR", blurb: "Lunar orbit insertion on the far side, 100 km circular orbit, Earthrise.", target: "MOON", demo: 22, met0: 266_400, met1: 352_800, metCurve: 1 },
  { id: "tmi", name: "Trans-Mars Injection", short: "TMI", blurb: "Departure burn out of lunar orbit onto a Hohmann-class transfer to Mars.", target: "MARS", demo: 10, met0: 352_800, met1: CRUISE_START, metCurve: 1 },
  { id: "cruise", name: "Interplanetary Cruise", short: "CRUISE", blurb: "259-day heliocentric transfer. Light-time to Earth grows past 13 minutes.", target: "MARS", demo: 26, met0: CRUISE_START, met1: ARRIVAL, metCurve: 1 },
  { id: "aerocapture", name: "Mars Aerocapture", short: "AEROCAPTURE", blurb: "Belly-first pass through the Martian atmosphere sheds ~2 km/s without a burn.", target: "MARS", demo: 16, met0: ARRIVAL, met1: ARRIVAL + 2_400, metCurve: 1 },
  { id: "mars", name: "Mars Orbit", short: "MARS ORBIT", blurb: "Periapsis raise burn and capture into a 400 km parking orbit.", target: "MARS", demo: 16, met0: ARRIVAL + 2_400, met1: ARRIVAL + 2_400 + 21_600, metCurve: 1 },
];

export const PHASES: Phase[] = (() => {
  let t = 0;
  return DEFS.map((d, index) => {
    const p: Phase = { ...d, index, start: t, end: t + d.demo };
    t += d.demo;
    return p;
  });
})();

export const TOTAL_DEMO = PHASES[PHASES.length - 1].end;
export const PHASE_BY_ID = Object.fromEntries(PHASES.map((p) => [p.id, p])) as Record<PhaseId, Phase>;

export function phaseAt(t: number): { phase: Phase; u: number } {
  const tc = clamp(t, 0, TOTAL_DEMO);
  for (const phase of PHASES) {
    if (tc < phase.end || phase.index === PHASES.length - 1) {
      return { phase, u: clamp((tc - phase.start) / phase.demo) };
    }
  }
  return { phase: PHASES[0], u: 0 };
}

export function metAt(phase: Phase, u: number) {
  return phase.met0 + (phase.met1 - phase.met0) * Math.pow(u, phase.metCurve);
}

export function uForMet(phase: Phase, met: number) {
  return Math.pow(clamp((met - phase.met0) / (phase.met1 - phase.met0)), 1 / phase.metCurve);
}

export function demoTimeFor(phaseId: PhaseId, u: number) {
  const p = PHASE_BY_ID[phaseId];
  return p.start + p.demo * u;
}

export interface MissionEvent {
  id: string;
  label: string;
  detail: string;
  phase: PhaseId;
  u: number;
  t: number;
  met: number;
  /** Shown as a major tick on the webcast timeline. */
  major?: boolean;
}

type EventDef = { id: string; label: string; detail: string; phase: PhaseId; met?: number; u?: number; major?: boolean };

const EVENT_DEFS: EventDef[] = [
  { id: "ignition", label: "Engine Ignition", detail: "Booster engine startup sequence", phase: "prelaunch", met: -3 },
  { id: "liftoff", label: "Liftoff", detail: "Vehicle has cleared the tower", phase: "ascent", met: 0.4, major: true },
  { id: "maxq", label: "Max-Q", detail: "Maximum aerodynamic pressure", phase: "ascent", met: 62 },
  { id: "meco", label: "MECO", detail: "Booster main engine cutoff", phase: "ascent", met: 159 },
  { id: "hotstage", label: "Hot Staging", detail: "Ship engines lit, stage separation confirmed", phase: "ascent", met: 162, major: true },
  { id: "boostback", label: "Boostback", detail: "Booster flips for return to launch site", phase: "ascent", met: 175 },
  { id: "seco", label: "SECO", detail: "Ship engine cutoff, nominal orbit", phase: "ascent", met: 506, major: true },
  { id: "rendezvous", label: "Tanker Rendezvous", detail: "Orbital tanker in proximity", phase: "leo", u: 0.12 },
  { id: "dock", label: "Docking", detail: "Hard dock, tail to tail", phase: "leo", u: 0.36 },
  { id: "prop", label: "Prop Transfer", detail: "LOX/CH4 transfer in progress", phase: "leo", u: 0.42, major: true },
  { id: "undock", label: "Undock", detail: "Tanker separation, clear to maneuver", phase: "leo", u: 0.78 },
  { id: "tli-start", label: "TLI Burn", detail: "Trans-lunar injection ignition", phase: "tli", u: 0.03, major: true },
  { id: "tli-end", label: "TLI Cutoff", detail: "On lunar transfer trajectory", phase: "tli", u: 0.97 },
  { id: "mcc1", label: "MCC-1", detail: "Mid-course correction, 4.2 m/s", phase: "coast", u: 0.44 },
  { id: "loi", label: "Lunar Orbit Insertion", detail: "Far-side capture burn", phase: "lunar", u: 0.01, major: true },
  { id: "los", label: "Loss of Signal", detail: "Behind the Moon, no Earth link", phase: "lunar", u: 0.04 },
  { id: "aos", label: "Acquisition of Signal", detail: "Earthrise, link restored", phase: "lunar", u: 0.3 },
  { id: "tmi-start", label: "TMI Burn", detail: "Trans-Mars injection ignition", phase: "tmi", u: 0.03, major: true },
  { id: "tmi-end", label: "TMI Cutoff", detail: "Heliocentric transfer achieved", phase: "tmi", u: 0.97 },
  { id: "mcc2", label: "MCC-2", detail: "Deep-space trajectory trim", phase: "cruise", u: 0.12 },
  { id: "dsn", label: "Deep Space Handover", detail: "Comms on deep-space antenna network", phase: "cruise", u: 0.4 },
  { id: "mcc3", label: "MCC-3", detail: "Final approach targeting", phase: "cruise", u: 0.8 },
  { id: "entry", label: "Entry Interface", detail: "Atmospheric entry, belly first", phase: "aerocapture", u: 0.08, major: true },
  { id: "blackout", label: "Plasma Blackout", detail: "Peak heating, comms degraded", phase: "aerocapture", u: 0.24 },
  { id: "exit", label: "Atmospheric Exit", detail: "Captured into elliptical orbit", phase: "aerocapture", u: 0.6 },
  { id: "raise", label: "Periapsis Raise", detail: "Circularization burn", phase: "mars", u: 0.2 },
  { id: "orbit", label: "Mars Orbit", detail: "Welcome to Mars", phase: "mars", u: 0.42, major: true },
];

export const EVENTS: MissionEvent[] = EVENT_DEFS.map((d) => {
  const phase = PHASE_BY_ID[d.phase];
  const u = d.u ?? uForMet(phase, d.met ?? phase.met0);
  return { id: d.id, label: d.label, detail: d.detail, phase: d.phase, u, t: phase.start + phase.demo * u, met: metAt(phase, u), major: d.major };
});

export interface Burn {
  phase: PhaseId;
  u0: number;
  u1: number;
  engine: "booster" | "ship";
  throttle: number;
}

const ascent = PHASE_BY_ID.ascent;
const pre = PHASE_BY_ID.prelaunch;

export const BURNS: Burn[] = [
  { phase: "prelaunch", u0: uForMet(pre, -3), u1: 1, engine: "booster", throttle: 1 },
  { phase: "ascent", u0: 0, u1: uForMet(ascent, 159), engine: "booster", throttle: 1 },
  { phase: "ascent", u0: uForMet(ascent, 160.5), u1: uForMet(ascent, 506), engine: "ship", throttle: 1 },
  { phase: "tli", u0: 0.03, u1: 0.97, engine: "ship", throttle: 1 },
  { phase: "coast", u0: 0.44, u1: 0.475, engine: "ship", throttle: 0.35 },
  { phase: "lunar", u0: 0.0, u1: 0.075, engine: "ship", throttle: 0.85 },
  { phase: "tmi", u0: 0.03, u1: 0.97, engine: "ship", throttle: 1 },
  { phase: "cruise", u0: 0.12, u1: 0.135, engine: "ship", throttle: 0.3 },
  { phase: "cruise", u0: 0.8, u1: 0.812, engine: "ship", throttle: 0.3 },
  { phase: "mars", u0: 0.2, u1: 0.34, engine: "ship", throttle: 0.8 },
];

/** Engine throttle (0..1) at demo time t with soft spool-up/down edges. */
export function throttleAt(t: number, engine: "booster" | "ship") {
  let v = 0;
  for (const b of BURNS) {
    if (b.engine !== engine) continue;
    const p = PHASE_BY_ID[b.phase];
    const t0 = p.start + p.demo * b.u0;
    const t1 = p.start + p.demo * b.u1;
    if (t < t0 - 0.4 || t > t1 + 0.4) continue;
    const ramp = 0.25;
    const up = clamp((t - t0) / ramp);
    const down = clamp((t1 - t) / ramp);
    v = Math.max(v, Math.min(up, down) * b.throttle);
  }
  return v;
}

export function nextEvent(t: number) {
  return EVENTS.find((e) => e.t > t + 1e-3) ?? null;
}

export function lastEvent(t: number) {
  let last: MissionEvent | null = null;
  for (const e of EVENTS) if (e.t <= t) last = e;
  return last;
}
