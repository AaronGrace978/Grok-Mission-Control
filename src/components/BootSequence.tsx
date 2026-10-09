import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { MissionEmblem } from "@/components/Emblem";
import { cn } from "@/lib/utils";
import { useSettings } from "@/state/settings";
import { useUi } from "@/state/ui";

const POLL = ["FLIGHT", "BOOSTER", "SHIP", "PROPULSION", "GNC", "COMMS", "GROK CO-PILOT", "RANGE"];
const LOG = [
  "GMC/OS 4.2 · flight software image verified",
  "Ephemeris loaded · Earth · Moon · Mars · Sun",
  "Trajectory solver online · Kepler / vis-viva / Hohmann",
  "Propellant load complete · LOX 100% · CH4 100%",
  "Range clear · Gulf of Mexico closure active",
  "Co-pilot core initialized · telemetry bus linked",
];

export function BootSequence() {
  const setBooted = useUi((s) => s.setBooted);
  const booted = useUi((s) => s.booted);
  const apiKey = useSettings((s) => s.apiKey);
  const { progress, active } = useProgress();
  const [step, setStep] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => s + 1), 210);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!booted) return;
    const id = window.setTimeout(() => setGone(true), 1000);
    return () => window.clearTimeout(id);
  }, [booted]);

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), 15000);
    return () => window.clearTimeout(id);
  }, []);
  const loaded = (!active && progress >= 100) || timedOut;
  const pollDone = step > LOG.length + POLL.length + 2;
  const ready = loaded && pollDone;

  useEffect(() => {
    if (!ready || booted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") setBooted(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, booted, setBooted]);

  if (gone) return null;

  return (
    <div className={cn("absolute inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-1000", booted && "pointer-events-none opacity-0")}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />

      <div className="relative flex w-full max-w-3xl flex-col items-center px-6">
        <MissionEmblem className="size-20 animate-fade-up md:size-24" />
        <h1 className="hud-glow mt-6 text-center font-display text-[30px] font-bold tracking-[0.42em] text-white md:text-[44px]">GROK MISSION CONTROL</h1>
        <div className="mt-2 font-mono text-[11px] tracking-[0.3em] text-white/45">MISSION 42 · EARTH → MOON → MARS</div>

        <div className="mt-10 grid w-full gap-8 md:grid-cols-[1.3fr_1fr]">
          <div className="min-h-[150px] space-y-1.5 font-mono text-[11px] text-white/55">
            {LOG.slice(0, step).map((l, i) => (
              <div key={i} className="animate-fade-up flex gap-2">
                <span className="text-white/30">{String(i + 1).padStart(2, "0")}</span>
                <span>{l}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="hud-label mb-2">GO / NO-GO POLL</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {POLL.map((p, i) => {
                const go = step > LOG.length + i;
                const note = p === "GROK CO-PILOT" && go && !apiKey ? "OFFLINE" : null;
                return (
                  <div key={p} className="flex items-center justify-between font-mono text-[11px]">
                    <span className={go ? "text-white/80" : "text-white/30"}>{p}</span>
                    <span className={cn("font-semibold", go ? "text-signal" : "animate-blink text-white/30")}>{go ? (note ? `GO·${note}` : "GO") : "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-10 w-full max-w-md">
          <div className="mb-1.5 flex justify-between font-mono text-[10px] tracking-widest text-white/40">
            <span>{loaded ? "ASSETS NOMINAL" : "LOADING PLANETARY DATA"}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-[2px] overflow-hidden bg-white/10">
            <div className="h-full bg-white shadow-[0_0_10px_white] transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <button
          type="button"
          disabled={!ready}
          onClick={() => setBooted(true)}
          className={cn(
            "mt-10 rounded-full border px-8 py-3 font-display text-[13px] font-bold tracking-[0.36em] transition-all duration-500",
            ready ? "border-white bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.35)] hover:scale-[1.03]" : "border-white/15 text-white/30",
          )}
        >
          {ready ? "ENTER MISSION CONTROL" : "POLLING STATIONS…"}
        </button>
        <p className="mt-4 font-mono text-[10px] tracking-wider text-white/30">Simulated mission · fan project · not affiliated with SpaceX or xAI</p>
      </div>
    </div>
  );
}
