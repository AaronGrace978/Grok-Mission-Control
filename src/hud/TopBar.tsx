import { Bot, Camera, Clapperboard, Eye, Orbit, Settings2, Tag, Volume2, VolumeX } from "lucide-react";
import { MissionEmblem } from "@/components/Emblem";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PHASES } from "@/sim/timeline";
import { useUi, type ViewMode } from "@/state/ui";
import type { TelemetrySample } from "./useTelemetry";

const VIEWS: { id: ViewMode; label: string; icon: typeof Camera; key: string }[] = [
  { id: "director", label: "Director", icon: Clapperboard, key: "1" },
  { id: "chase", label: "Chase", icon: Camera, key: "2" },
  { id: "orbital", label: "Orbital", icon: Orbit, key: "3" },
  { id: "cockpit", label: "Cockpit", icon: Eye, key: "4" },
];

function IconToggle({ active, label, onClick, children }: { active?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            "grid size-8 place-items-center rounded-md border transition-colors",
            active ? "border-white/25 bg-white/10 text-white" : "border-transparent text-white/55 hover:bg-white/5 hover:text-white",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

const commsColor: Record<string, string> = {
  NOMINAL: "bg-signal",
  "DEEP SPACE": "bg-sky-300",
  LOS: "bg-caution",
  BLACKOUT: "bg-warn",
};

export function TopBar({ tel }: { tel: TelemetrySample }) {
  const { view, setView, sound, setSound, showLabels, setShowLabels, grokOpen, setGrokOpen, setSettingsOpen } = useUi();
  return (
    <header className="pointer-events-auto flex items-center gap-3 px-4 pt-3 md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <MissionEmblem className="size-9 shrink-0" />
        <div className="min-w-0 leading-none">
          <div className="font-display text-[17px] font-bold tracking-[0.28em] text-white">GROK MISSION CONTROL</div>
          <div className="mt-1 hidden truncate font-mono text-[10px] tracking-[0.14em] text-white/45 sm:block">MISSION 42 · EARTH → MOON → MARS · SIMULATED TELEMETRY</div>
        </div>
      </div>

      <div className="mx-auto hidden items-center gap-3 lg:flex">
        <div className="glass flex items-center gap-3 rounded-full px-4 py-1.5">
          <span className="font-mono text-[10px] text-white/45">
            PHASE {String(tel.phase.index + 1).padStart(2, "0")}/{String(PHASES.length).padStart(2, "0")}
          </span>
          <span className="h-3 w-px bg-white/15" />
          <span className="font-display text-[13px] font-semibold uppercase tracking-[0.2em] text-white">{tel.phase.name}</span>
          <span className="h-3 w-px bg-white/15" />
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/60">
            <span className={cn("size-1.5 rounded-full", commsColor[tel.comms], tel.comms !== "NOMINAL" && "animate-blink")} />
            {tel.comms}
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="glass mr-1 hidden items-center gap-0.5 rounded-lg p-0.5 md:flex" role="radiogroup" aria-label="Camera">
          {VIEWS.map((v) => (
            <Tooltip key={v.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={view === v.id}
                  onClick={() => setView(v.id)}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-md px-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
                    view === v.id ? "bg-white text-black" : "text-white/60 hover:text-white",
                  )}
                >
                  <v.icon className="size-3.5" />
                  <span className="hidden xl:inline">{v.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {v.label} camera <kbd className="ml-1 font-mono opacity-60">{v.key}</kbd>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="md:hidden">
          <IconToggle label={`Camera: ${VIEWS.find((v) => v.id === view)?.label}`} active onClick={() => setView(VIEWS[(VIEWS.findIndex((v) => v.id === view) + 1) % VIEWS.length].id)}>
            <Camera className="size-4" />
          </IconToggle>
        </div>
        <IconToggle label={showLabels ? "Hide labels" : "Show labels"} active={showLabels} onClick={() => setShowLabels(!showLabels)}>
          <Tag className="size-4" />
        </IconToggle>
        <IconToggle label={sound ? "Mute ambience" : "Enable ambience"} active={sound} onClick={() => setSound(!sound)}>
          {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </IconToggle>
        <IconToggle label="Settings" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="size-4" />
        </IconToggle>
        <IconToggle label={grokOpen ? "Hide Grok" : "Open Grok co-pilot"} active={grokOpen} onClick={() => setGrokOpen(!grokOpen)}>
          <Bot className="size-4" />
        </IconToggle>
      </div>
    </header>
  );
}
