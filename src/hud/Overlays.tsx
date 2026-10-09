import { useEffect, useRef } from "react";
import { overlay, type ScreenPoint } from "@/scene/OverlayProbe";
import { QUALITY_CONFIG } from "@/scene/quality";
import { sim } from "@/sim/clock";
import { useUi } from "@/state/ui";

const GHOSTS = [
  { at: 0.35, size: 46, color: "rgba(150,180,255,0.16)" },
  { at: 0.62, size: 22, color: "rgba(255,210,160,0.2)" },
  { at: 0.9, size: 90, color: "rgba(120,160,255,0.07)" },
  { at: 1.25, size: 34, color: "rgba(180,255,220,0.12)" },
  { at: 1.6, size: 140, color: "rgba(255,255,255,0.045)" },
];

type LabelKey = "earth" | "moon" | "mars" | "ship";
const LABELS: { key: LabelKey; name: string }[] = [
  { key: "earth", name: "EARTH" },
  { key: "moon", name: "MOON" },
  { key: "mars", name: "MARS" },
  { key: "ship", name: "STARSHIP" },
];

export function Overlays() {
  const flare = useRef<HTMLDivElement>(null);
  const ghosts = useRef<(HTMLDivElement | null)[]>([]);
  const labels = useRef<Record<string, HTMLDivElement | null>>({});
  const dist = useRef<Record<string, HTMLSpanElement | null>>({});
  const plasma = useRef<HTMLDivElement>(null);
  const cockpit = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const place = (el: HTMLElement | null, p: ScreenPoint, alpha: number) => {
      if (!el) return;
      const show = p.visible && alpha > 0.01;
      el.style.opacity = show ? String(alpha) : "0";
      if (show) el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const ui = useUi.getState();
      const q = QUALITY_CONFIG[ui.quality];

      const s = overlay.sun;
      const cx = overlay.width / 2;
      const cy = overlay.height / 2;
      const edge = Math.max(0, 1 - Math.hypot((s.x - cx) / cx, (s.y - cy) / cy) * 0.55);
      const a = q.flare && s.visible ? s.strength * edge : 0;
      if (flare.current) {
        flare.current.style.opacity = String(a);
        flare.current.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
      }
      GHOSTS.forEach((g, i) => {
        const el = ghosts.current[i];
        if (!el) return;
        el.style.opacity = String(a);
        const x = s.x + (cx - s.x) * g.at * 2;
        const y = s.y + (cy - s.y) * g.at * 2;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });

      for (const { key } of LABELS) {
        const p = overlay[key];
        const alpha = ui.showLabels && ui.view !== "cockpit" ? p.strength : 0;
        place(labels.current[key], p, alpha);
        const d = dist.current[key];
        if (d && key === "ship") d.textContent = sim.frame.tel.phase.short;
      }

      const tel = sim.frame.tel;
      if (plasma.current) plasma.current.style.opacity = String(tel.plasma * (ui.view === "cockpit" ? 1 : 0.55));
      if (cockpit.current) cockpit.current.style.opacity = ui.view === "cockpit" ? "1" : "0";
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div ref={flare} className="absolute left-0 top-0 opacity-0" style={{ mixBlendMode: "screen" }}>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: 360, height: 360, background: "radial-gradient(circle, rgba(255,250,240,0.55) 0%, rgba(255,235,210,0.18) 18%, rgba(255,220,190,0.05) 42%, transparent 70%)" }}
        />
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            width: 900,
            height: 900,
            background:
              "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.16) 2deg, transparent 4deg, transparent 58deg, rgba(255,255,255,0.1) 60deg, transparent 62deg, transparent 118deg, rgba(255,255,255,0.14) 120deg, transparent 122deg, transparent 178deg, rgba(255,255,255,0.16) 180deg, transparent 182deg, transparent 238deg, rgba(255,255,255,0.1) 240deg, transparent 242deg, transparent 298deg, rgba(255,255,255,0.14) 300deg, transparent 302deg)",
            maskImage: "radial-gradient(circle, black 0%, transparent 60%)",
            WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 60%)",
          }}
        />
        <div className="absolute h-px -translate-x-1/2 -translate-y-1/2" style={{ width: 1100, background: "linear-gradient(90deg, transparent, rgba(170,200,255,0.35), rgba(255,255,255,0.7), rgba(170,200,255,0.35), transparent)" }} />
      </div>
      {GHOSTS.map((g, i) => (
        <div key={i} ref={(el) => void (ghosts.current[i] = el)} className="absolute left-0 top-0 opacity-0" style={{ mixBlendMode: "screen" }}>
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ width: g.size, height: g.size, background: `radial-gradient(circle, transparent 40%, ${g.color} 70%, transparent 100%)`, border: `1px solid ${g.color}` }}
          />
        </div>
      ))}

      {LABELS.map(({ key, name }) => (
        <div key={key} ref={(el) => void (labels.current[key] = el)} className="absolute left-0 top-0 opacity-0 transition-opacity duration-300">
          {key === "ship" ? (
            <div className="relative -translate-x-1/2 -translate-y-1/2">
              <div className="size-7 border border-white/70" style={{ clipPath: "polygon(0 0,30% 0,30% 2px,2px 2px,2px 30%,0 30%,0 70%,2px 70%,2px calc(100% - 2px),30% calc(100% - 2px),30% 100%,70% 100%,70% calc(100% - 2px),calc(100% - 2px) calc(100% - 2px),calc(100% - 2px) 70%,100% 70%,100% 30%,calc(100% - 2px) 30%,calc(100% - 2px) 2px,70% 2px,70% 0,100% 0,100% 100%,0 100%)" }} />
              <div className="absolute left-full top-0 ml-2 whitespace-nowrap font-mono text-[10px] leading-tight text-white">
                <div className="font-display font-semibold tracking-[0.2em]">{name}</div>
                <span ref={(el) => void (dist.current[key] = el)} className="text-white/50" />
              </div>
            </div>
          ) : (
            <div className="flex -translate-y-1/2 items-center gap-2">
              <span className="block h-px w-6 bg-white/50" />
              <span className="font-display text-[11px] font-semibold tracking-[0.3em] text-white/80">{name}</span>
            </div>
          )}
        </div>
      ))}

      <div ref={plasma} className="absolute inset-0 opacity-0" style={{ background: "radial-gradient(ellipse at 50% 120%, rgba(255,120,60,0.55), rgba(255,80,40,0.15) 45%, transparent 70%)", mixBlendMode: "screen" }} />

      <div ref={cockpit} className="absolute inset-0 opacity-0 transition-opacity duration-500">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.85) 100%)" }} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative size-40 rounded-full border border-white/20">
            <div className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-white/60" />
            <div className="absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 bg-white/60" />
            <div className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/60" />
            <div className="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/60" />
            <div className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          </div>
        </div>
        <div className="absolute left-1/2 top-[28%] w-[42vw] -translate-x-1/2">
          <div className="flex justify-between font-mono text-[9px] tracking-widest text-white/40">
            {["-20", "-10", "0", "+10", "+20"].map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
          <div className="mt-1 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>
        <div className="absolute bottom-[34%] left-[18%] font-mono text-[10px] tracking-widest text-white/45">CDR WINDOW 2 · FWD</div>
      </div>
    </div>
  );
}
