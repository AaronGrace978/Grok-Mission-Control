import type { TelemetrySample } from "@/hud/useTelemetry";
import { formatKm, formatLightTime, formatMet, formatPct } from "@/lib/format";
import { PHASES } from "@/sim/timeline";

export function telemetryLine(t: TelemetrySample) {
  const alt = t.altitude === null ? "n/a" : `${formatKm(t.altitude)} km (${t.altRef})`;
  return [
    `MET ${formatMet(t.met)}`,
    `phase ${t.phase.index + 1}/${PHASES.length} ${t.phase.name}`,
    `v ${t.speed.toFixed(2)} km/s rel ${t.speedRef}`,
    `alt ${alt}`,
    `dist Earth ${formatKm(t.distEarth)} km`,
    `dist ${t.target} ${formatKm(t.distTarget)} km`,
    `prop ${formatPct(t.shipProp)}`,
    `g ${t.gLoad.toFixed(2)}`,
    `comms ${t.comms}`,
    `light-time ${formatLightTime(t.lightTime)}`,
  ].join(" · ");
}

export function buildSystemPrompt(t: TelemetrySample) {
  const alt = t.altitude === null ? "not applicable (heliocentric)" : `${formatKm(t.altitude)} km above ${t.altRef}`;
  const engines =
    t.boosterThrottle > 0.05 ? `Booster at ${Math.round(t.boosterThrottle * 100)}% throttle.` : t.shipThrottle > 0.05 ? `Ship engines burning at ${Math.round(t.shipThrottle * 100)}%.` : "Engines off, ballistic.";
  return `You are Grok, the onboard AI co-pilot of a crewed Starship-class vehicle flying a simulated Earth → Moon → Mars mission ("Mission 42") in the Grok Mission Control app.

Voice: calm, sharp, a little witty, like a seasoned flight controller who happens to be an AI. Be concise: 2-5 short sentences unless the crew asks for detail. Use real orbital mechanics. Telemetry below is simulated; treat it as ground truth for this flight and do not claim to be on a real spacecraft. If asked about something you cannot know, say so plainly.

LIVE TELEMETRY (simulated)
- Mission elapsed time: ${formatMet(t.met)}
- Phase: ${t.phase.index + 1} of ${PHASES.length}, ${t.phase.name}. ${t.phase.blurb}
- Velocity: ${t.speed.toFixed(3)} km/s relative to ${t.speedRef}
- Altitude: ${alt}
- Distance from Earth: ${formatKm(t.distEarth)} km
- Distance to ${t.target}: ${formatKm(t.distTarget)} km
- Ship propellant: ${formatPct(t.shipProp)} (LOX ${formatPct(t.lox)}, CH4 ${formatPct(t.ch4)})${t.boosterProp !== null ? `\n- Booster propellant: ${formatPct(t.boosterProp)}` : ""}
- G-load: ${t.gLoad.toFixed(2)} g${t.q !== null ? `\n- Dynamic pressure: ${t.q.toFixed(1)} kPa` : ""}
- Propulsion: ${engines}
- Comms: ${t.comms}, one-way light-time to Earth ${formatLightTime(t.lightTime)}
- Last event: ${t.last ? `${t.last.label} (${formatMet(t.last.met)})` : "none yet"}
- Next event: ${t.next ? `${t.next.label} at ${formatMet(t.next.met)}` : "mission complete"}

Mission plan: launch from a Gulf Coast pad, hot staging, LEO with orbital propellant transfer from a tanker, trans-lunar injection, 3-day coast, far-side lunar orbit insertion, trans-Mars injection from lunar orbit, ~259-day Hohmann-class cruise, belly-first Mars aerocapture, then a 400 km Mars parking orbit.`;
}

/** Offline co-pilot lines for milestones, so Grok narrates even without an API key. */
export const CALLOUTS: Record<string, string> = {
  ignition: "Engine chill complete, ignition sequence started. 33 Raptors coming up to thrust. Hold on to something.",
  liftoff: "Liftoff. Tower cleared. Roll program nominal and we're heading downrange over the Gulf.",
  maxq: "Max-Q. This is peak aerodynamic stress on the stack. Vehicle is handling it fine.",
  meco: "MECO. Booster engines shut down. Stand by for hot staging.",
  hotstage: "Hot staging confirmed. Ship engines lit while still attached, and we're clean off the booster.",
  boostback: "Booster is flipping for boostback. It's headed home to the tower; we keep climbing.",
  seco: "SECO. Nominal orbit insertion. Welcome to low Earth orbit, crew.",
  rendezvous: "Tanker has us on its sensors. Closing at a few meters per second.",
  dock: "Hard dock, tail to tail. Structural latches engaged.",
  prop: "Propellant transfer flowing. We're topping off for the deep-space legs. This is the step that makes Mars possible.",
  undock: "Undock confirmed. Tanker is backing away. Clear to maneuver.",
  "tli-start": "TLI ignition. Six-minute burn to raise apogee to the Moon's distance.",
  "tli-end": "TLI cutoff. We are on a free-flight path to the Moon. Three days to go.",
  mcc1: "Mid-course correction, four meters per second. Small trim, big payoff.",
  loi: "Lunar orbit insertion burn on the far side. Executing without Earth contact, so this one is all us.",
  los: "Loss of signal. We're behind the Moon. Quietest place in the inner solar system.",
  aos: "Acquisition of signal. Earthrise out the window. Worth a look.",
  "tmi-start": "Trans-Mars injection. Lighting the engines to leave the Earth-Moon system for good.",
  "tmi-end": "TMI cutoff. Heliocentric trajectory achieved. Next stop: Mars, about 259 days out.",
  mcc2: "Deep-space trajectory trim complete. Arrival corridor looking good.",
  dsn: "Handing over to the deep-space network. Light-time is growing; replies from Earth will lag.",
  mcc3: "Final approach targeting burn. Entry corridor locked in.",
  entry: "Entry interface. Belly first, heat shield forward. Let the atmosphere do the braking.",
  blackout: "Plasma blackout. Comms will drop for a bit. Peak heating now.",
  exit: "Atmospheric exit. Aerocapture worked; we're bound to Mars.",
  raise: "Periapsis raise burn. Circularizing into the parking orbit.",
  orbit: "Mars orbit achieved. Crew, you are the first humans in orbit around another planet. Simulated, but still.",
};

export const QUICK_PROMPTS = [
  { label: "Status report", prompt: "Give me a crisp status report for this phase of flight." },
  { label: "What's next?", prompt: "What's the next major event and what should the crew watch for?" },
  { label: "Explain this burn", prompt: "Explain the physics of what the vehicle is doing right now, in plain language." },
  { label: "Risk check", prompt: "What are the top risks in this phase and how are they mitigated?" },
];

export function offlineReply(t: TelemetrySample) {
  return `I'm running in offline mode, so I can only read you telemetry. ${t.phase.name}: ${t.speed.toFixed(2)} km/s relative to ${t.speedRef}, ${formatKm(t.distEarth)} km from Earth, propellant ${formatPct(t.shipProp)}. Add an xAI API key in Settings and I'll actually think about it.`;
}
