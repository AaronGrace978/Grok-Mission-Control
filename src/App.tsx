import { useEffect, useState } from "react";
import { BootSequence } from "@/components/BootSequence";
import { SettingsDialog } from "@/components/SettingsDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GrokPanel } from "@/grok/GrokPanel";
import { EventFeed } from "@/hud/EventFeed";
import { MiniMap } from "@/hud/MiniMap";
import { Overlays } from "@/hud/Overlays";
import { TelemetryPanel } from "@/hud/TelemetryPanel";
import { TopBar } from "@/hud/TopBar";
import { useTelemetry } from "@/hud/useTelemetry";
import { WebcastBar } from "@/hud/WebcastBar";
import { cn } from "@/lib/utils";
import { perf, Scene } from "@/scene/Scene";
import { setSimTime, sim, TOTAL_DEMO } from "@/sim/clock";
import { EVENTS } from "@/sim/timeline";
import { useSettings } from "@/state/settings";
import { QUALITY_LABEL, useUi, type ViewMode } from "@/state/ui";

function PerfReadout() {
  const quality = useUi((s) => s.quality);
  const auto = useUi((s) => s.autoQuality);
  const [fps, setFps] = useState(60);
  useEffect(() => {
    const id = window.setInterval(() => setFps(perf.fps), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="px-1 font-mono text-[9px] tracking-[0.16em] text-white/35">
      RENDER {QUALITY_LABEL[quality].toUpperCase()}
      {auto ? " (AUTO)" : ""} · {Math.round(fps)} FPS
    </div>
  );
}

function Hud() {
  const tel = useTelemetry(15);
  const booted = useUi((s) => s.booted);
  const grokOpen = useUi((s) => s.grokOpen);
  return (
    <div className={cn("pointer-events-none absolute inset-0 flex flex-col transition-opacity duration-1000", booted ? "opacity-100" : "opacity-0")}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="relative">
        <TopBar tel={tel} />
      </div>
      <div className="relative flex min-h-0 flex-1 gap-4 px-4 pt-3 md:px-5">
        <div className="pointer-events-auto hidden min-h-0 flex-col gap-3 overflow-y-auto md:flex scrollbar-thin">
          <TelemetryPanel tel={tel} />
          <MiniMap />
          <PerfReadout />
        </div>
        <div className="flex min-w-0 flex-1 justify-center pt-2">
          <EventFeed />
        </div>
        {grokOpen && <GrokPanel tel={tel} className="absolute inset-x-3 bottom-2 top-1 z-30 lg:static lg:w-[380px] lg:shrink-0" />}
      </div>
      <WebcastBar tel={tel} />
    </div>
  );
}

const VIEW_KEYS: Record<string, ViewMode> = { "1": "director", "2": "chase", "3": "orbital", "4": "cockpit" };

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=dialog], [role=listbox]")) return;
      const ui = useUi.getState();
      if (!ui.booted) return;
      if (e.key === " ") {
        e.preventDefault();
        if (!ui.playing && sim.t >= TOTAL_DEMO - 0.01) setSimTime(0);
        ui.togglePlaying();
      } else if (VIEW_KEYS[e.key]) ui.setView(VIEW_KEYS[e.key]);
      else if (e.key === "g" || e.key === "G") ui.setGrokOpen(!ui.grokOpen);
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (target.getAttribute("role") === "slider") return;
        const majors = EVENTS.filter((ev) => ev.major);
        const next = e.key === "ArrowRight" ? majors.find((ev) => ev.t > sim.t + 0.5) : [...majors].reverse().find((ev) => ev.t < sim.t - 1.5);
        setSimTime(next ? Math.max(0, next.t - 1.2) : e.key === "ArrowRight" ? TOTAL_DEMO : 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export default function App() {
  const load = useSettings((s) => s.load);
  useEffect(() => void load(), [load]);
  useShortcuts();
  return (
    <TooltipProvider delayDuration={300}>
      <main className="dark relative h-full w-full overflow-hidden bg-black text-white">
        <Scene />
        <Overlays />
        <Hud />
        <SettingsDialog />
        <BootSequence />
      </main>
    </TooltipProvider>
  );
}
