import { useRef } from "react";
import { ChevronsLeft, ChevronsRight, Pause, Play, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatInt, formatKm, splitMet } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setSimTime, sim, TOTAL_DEMO } from "@/sim/clock";
import { EVENTS, PHASES } from "@/sim/timeline";
import { SPEEDS, useUi } from "@/state/ui";
import type { TelemetrySample } from "./useTelemetry";

const ARC = 0.75;
const R = 33;
const CIRC = 2 * Math.PI * R;

function Gauge({ label, value, unit, fill, sub }: { label: string; value: string; unit: string; fill: number; sub?: string }) {
  const f = Math.max(0, Math.min(1, fill));
  return (
    <div className="flex flex-col items-center">
      <div className="relative size-[84px]">
        <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-[225deg]" aria-hidden>
          <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeDasharray={`${CIRC * ARC} ${CIRC}`} strokeLinecap="round" />
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeDasharray={`${CIRC * ARC * f} ${CIRC}`}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.7))", transition: "stroke-dasharray 120ms linear" }}
          />
          {Array.from({ length: 11 }, (_, i) => {
            const a = (i / 10) * ARC * Math.PI * 2;
            return <line key={i} x1={40 + Math.cos(a) * 37} y1={40 + Math.sin(a) * 37} x2={40 + Math.cos(a) * 39} y2={40 + Math.sin(a) * 39} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="hud-value hud-glow text-[15px] font-medium leading-none">{value}</span>
          <span className="mt-1 font-mono text-[9px] text-white/45">{unit}</span>
        </div>
      </div>
      <span className="hud-label -mt-2">{label}</span>
      {sub && <span className="font-mono text-[8px] tracking-wider text-white/30">{sub}</span>}
    </div>
  );
}

const ring = (n: number, r: number, offset = 0) => Array.from({ length: n }, (_, i) => [50 + Math.cos((i / n) * Math.PI * 2 + offset) * r, 50 + Math.sin((i / n) * Math.PI * 2 + offset) * r] as const);
const BOOSTER_ENGINES = [...ring(3, 7, -Math.PI / 2).map((p) => ({ p, r: 4.2 })), ...ring(10, 20.5).map((p) => ({ p, r: 4.2 })), ...ring(20, 38).map((p) => ({ p, r: 4.2 }))];
const SHIP_ENGINES = [...ring(3, 13, -Math.PI / 2).map((p) => ({ p, r: 8, vac: false })), ...ring(3, 33, Math.PI / 2).map((p) => ({ p, r: 12, vac: true }))];

function EngineDiagram({ kind, throttle, status }: { kind: "booster" | "ship"; throttle: number; status: string }) {
  const engines = kind === "booster" ? BOOSTER_ENGINES : SHIP_ENGINES;
  const lit = throttle > 0.05;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 100 100" className="size-[62px]" aria-label={`${kind} engines ${lit ? "running" : "off"}`}>
        <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        {engines.map(({ p, r }, i) => (
          <circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r={r}
            fill={lit ? `rgba(255,255,255,${0.35 + 0.65 * throttle})` : "transparent"}
            stroke={lit ? "white" : "rgba(255,255,255,0.35)"}
            strokeWidth="1"
            style={lit ? { filter: "drop-shadow(0 0 2px rgba(255,255,255,0.9))" } : undefined}
          />
        ))}
      </svg>
      <span className="hud-label">{kind === "booster" ? "Booster" : "Ship"}</span>
      <span className={cn("font-mono text-[8px] tracking-wider", lit ? "text-white/80" : "text-white/30")}>{status}</span>
    </div>
  );
}

const SPEED_SCALE: Record<string, number> = { EARTH: 11.2, MOON: 3, SUN: 34, MARS: 6 };
const altFill = (alt: number | null) => (alt === null ? 1 : Math.log10(alt + 1) / Math.log10(400_001));

function Timeline({ tel }: { tel: TelemetrySample }) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const progress = tel.t / TOTAL_DEMO;

  const seek = (clientX: number) => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSimTime(((clientX - r.left) / r.width) * TOTAL_DEMO);
  };

  const majors = EVENTS.filter((e) => e.major);
  return (
    <div className="relative w-full select-none px-2 pt-5 pb-5">
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Mission timeline"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={tel.phase.name}
        className="group relative h-6 cursor-pointer touch-none outline-none"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          seek(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && seek(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setSimTime(sim.t + 2);
          if (e.key === "ArrowLeft") setSimTime(sim.t - 2);
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/20" />
        <div className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 bg-white" style={{ width: `${progress * 100}%`, boxShadow: "0 0 10px rgba(255,255,255,0.8)" }} />
        {PHASES.slice(1).map((p) => (
          <div key={p.id} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-white/25" style={{ left: `${(p.start / TOTAL_DEMO) * 100}%` }} />
        ))}
        {EVENTS.filter((e) => !e.major).map((e) => (
          <div key={e.id} className={cn("absolute top-1/2 size-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full", e.t <= tel.t ? "bg-white" : "bg-white/30")} style={{ left: `${(e.t / TOTAL_DEMO) * 100}%` }} />
        ))}
        {majors.map((e, i) => {
          const done = e.t <= tel.t;
          return (
            <div key={e.id} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${(e.t / TOTAL_DEMO) * 100}%` }}>
              <div className={cn("size-[9px] rounded-full border", done ? "border-white bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" : "border-white/50 bg-black")} />
              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-display text-[9px] font-semibold uppercase tracking-[0.14em]",
                  i % 2 === 0 ? "bottom-4" : "top-4",
                  done ? "text-white/85" : "text-white/40",
                )}
              >
                {e.label}
              </div>
            </div>
          );
        })}
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${progress * 100}%` }}>
          <div className="h-4 w-[3px] rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,1)]" />
        </div>
      </div>
    </div>
  );
}

function Transport() {
  const { playing, togglePlaying, speed, setSpeed, setPlaying } = useUi();
  const jump = (dir: 1 | -1) => {
    const t = sim.t;
    const majors = EVENTS.filter((e) => e.major);
    const target = dir > 0 ? majors.find((e) => e.t > t + 0.5) : [...majors].reverse().find((e) => e.t < t - 1.5);
    setSimTime(target ? Math.max(0, target.t - 1.2) : dir > 0 ? TOTAL_DEMO : 0);
  };
  const btn = "grid size-8 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white";
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={btn}
            aria-label="Restart mission"
            onClick={() => {
              setSimTime(0);
              setPlaying(true);
            }}
          >
            <RotateCcw className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Restart</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={btn} aria-label="Previous milestone" onClick={() => jump(-1)}>
            <ChevronsLeft className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Previous milestone</TooltipContent>
      </Tooltip>
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => {
          if (!playing && sim.t >= TOTAL_DEMO - 0.01) setSimTime(0);
          togglePlaying();
        }}
        className="grid size-10 place-items-center rounded-full bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.35)] transition-transform hover:scale-105 active:scale-95"
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={btn} aria-label="Next milestone" onClick={() => jump(1)}>
            <ChevronsRight className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Next milestone</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Playback speed"
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length])}
            className="h-8 min-w-11 rounded-md border border-white/15 px-2 font-mono text-[11px] text-white/80 transition-colors hover:border-white/40 hover:text-white"
          >
            {speed}×
          </button>
        </TooltipTrigger>
        <TooltipContent>Playback speed</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function WebcastBar({ tel }: { tel: TelemetrySample }) {
  const { sign, rest } = splitMet(tel.met);
  const speedKmh = tel.speed * 3600;
  const boosterPhase = tel.phase.id === "prelaunch" || tel.phase.id === "ascent";
  const boosterStatus = tel.boosterAttached ? (tel.boosterThrottle > 0.05 ? "33 RAPTOR" : "STANDBY") : tel.boosterThrottle > 0.05 ? "BOOSTBACK" : "RTLS";
  const shipStatus = tel.shipThrottle > 0.05 ? `${Math.round(tel.shipThrottle * 100)}% THRUST` : "COAST";

  return (
    <footer className="pointer-events-auto relative">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black via-black/70 to-transparent" />
      <div className="relative flex items-end gap-4 px-4 pb-3 md:px-6">
        <div className="hidden shrink-0 items-end gap-3 md:flex">
          <Gauge label="Speed" value={speedKmh >= 100_000 ? `${(speedKmh / 1000).toFixed(1)}k` : formatInt(speedKmh)} unit="KM/H" fill={tel.speed / (SPEED_SCALE[tel.speedRef] ?? 10)} sub={`REL ${tel.speedRef}`} />
          <Gauge label="Altitude" value={tel.altitude === null ? "HELIO" : formatKm(tel.altitude)} unit={tel.altitude === null ? "ORBIT" : "KM"} fill={altFill(tel.altitude)} sub={tel.altitude === null ? "SUN" : tel.altRef} />
          <EngineDiagram kind="ship" throttle={tel.shipThrottle} status={shipStatus} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center">
          <div className="font-display text-[11px] font-semibold tracking-[0.34em] text-white/50">STARSHIP · MISSION 42</div>
          <div className="hud-glow flex items-baseline font-mono text-[34px] font-medium leading-none tracking-tight text-white md:text-[42px]">
            <span className="mr-1 text-white/60">{sign}</span>
            <span className="tabular-nums">{rest}</span>
          </div>
          <div className="mt-1 font-display text-[12px] font-semibold uppercase tracking-[0.3em] text-white/85">{tel.phase.name}</div>
          <Timeline tel={tel} />
          <Transport />
        </div>

        <div className="hidden shrink-0 items-end gap-3 md:flex">
          {boosterPhase ? (
            <EngineDiagram kind="booster" throttle={tel.boosterThrottle} status={boosterStatus} />
          ) : (
            <Gauge label={`To ${tel.target}`} value={formatKm(tel.distTarget)} unit="KM" fill={1 - altFill(tel.distTarget)} sub="RANGE" />
          )}
          <Gauge label="Propellant" value={`${(tel.shipProp * 100).toFixed(1)}`} unit="% SHIP" fill={tel.shipProp} sub={tel.docked ? "TRANSFER" : "LOX/CH4"} />
          <Gauge label="G-Load" value={tel.gLoad.toFixed(2)} unit="G" fill={tel.gLoad / 4} />
        </div>
      </div>
    </footer>
  );
}
