import { useEffect, useState } from "react";
import { CALLOUTS } from "@/grok/prompt";
import { useChat } from "@/grok/chat";
import { audio } from "@/lib/audio";
import { formatMet } from "@/lib/format";
import { sim } from "@/sim/clock";
import type { MissionEvent } from "@/sim/timeline";
import { useUi } from "@/state/ui";

interface Toast {
  key: number;
  event: MissionEvent;
}

/** Watches the sim for milestone crossings: toasts, Grok callouts, chimes, and engine audio. */
export function EventFeed() {
  const [toast, setToast] = useState<Toast | null>(null);
  const sound = useUi((s) => s.sound);
  const booted = useUi((s) => s.booted);

  useEffect(() => audio.setEnabled(sound && booted), [sound, booted]);

  useEffect(() => {
    let lastId = sim.frame.tel.last?.id ?? null;
    let lastJump = sim.jumpId;
    let key = 0;
    let hide = 0;
    const id = window.setInterval(() => {
      const tel = sim.frame.tel;
      const atmo = tel.altitude !== null && tel.altRef === "EARTH" ? Math.exp(-tel.altitude / 12) : 0;
      audio.setEngine(Math.max(tel.boosterThrottle * 1.0, tel.shipThrottle * 0.55), Math.max(atmo, 0.12));

      const ev = tel.last;
      const evId = ev?.id ?? null;
      if (sim.jumpId !== lastJump) {
        lastJump = sim.jumpId;
        lastId = evId;
        return;
      }
      if (evId === lastId || !ev) return;
      lastId = evId;
      if (!useUi.getState().booted) return;
      setToast({ key: ++key, event: ev });
      audio.chime(ev.major ? "major" : "event");
      const line = CALLOUTS[ev.id];
      if (line) useChat.getState().callout(line);
      window.clearTimeout(hide);
      hide = window.setTimeout(() => setToast(null), 4200);
    }, 100);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(hide);
    };
  }, []);

  if (!toast) return null;
  return (
    <div key={toast.key} className="animate-toast-in pointer-events-none flex flex-col items-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="h-px w-10 bg-gradient-to-r from-transparent to-white/60" />
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/55">{formatMet(toast.event.met)}</span>
        <span className="h-px w-10 bg-gradient-to-l from-transparent to-white/60" />
      </div>
      <div className="hud-glow mt-1 font-display text-[26px] font-bold uppercase leading-none tracking-[0.32em] text-white md:text-[30px]">{toast.event.label}</div>
      <div className="mt-1.5 font-display text-[12px] uppercase tracking-[0.24em] text-white/60">{toast.event.detail}</div>
    </div>
  );
}
