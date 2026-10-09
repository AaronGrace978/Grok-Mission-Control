import { cn } from "@/lib/utils";

/** Original mission mark: a tilted transfer orbit threaded by an ascent vector. */
export function MissionEmblem({ className, glow = true }: { className?: string; glow?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("text-white", className)} fill="none" aria-hidden>
      {glow && (
        <defs>
          <filter id="emblem-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      <g filter={glow ? "url(#emblem-glow)" : undefined} stroke="currentColor">
        <circle cx="32" cy="32" r="29" strokeOpacity="0.35" strokeWidth="1" />
        <ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(-28 32 32)" strokeWidth="1.6" />
        <circle cx="32" cy="32" r="6.5" fill="currentColor" stroke="none" />
        <path d="M12 52 L50 14" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M44 13.5 L50.5 13.5 L50.5 20" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="52.6" cy="44.4" r="2.6" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

export type CoreState = "idle" | "thinking" | "speaking" | "offline";

/** Animated co-pilot core: rotating telemetry rings around a pulsing singularity. */
export function GrokCore({ state = "idle", className }: { state?: CoreState; className?: string }) {
  const active = state === "thinking" || state === "speaking";
  return (
    <div className={cn("relative grid place-items-center", className)}>
      {active && <span className="absolute inset-0 rounded-full border border-white/40" style={{ animation: "pulse-ring 1.6s ease-out infinite" }} />}
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full animate-spin-slow" style={{ animationDuration: active ? "3s" : "14s" }} aria-hidden>
        <circle cx="32" cy="32" r="29" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 5" />
        <path d="M32 3 A29 29 0 0 1 61 32" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full animate-spin-rev" style={{ animationDuration: active ? "2.2s" : "9s" }} aria-hidden>
        <circle cx="32" cy="32" r="21" fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="1" />
        <path d="M11 32 A21 21 0 0 1 32 11" fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="53" cy="32" r="1.6" fill="white" />
      </svg>
      <span
        className={cn("relative block rounded-full bg-white", state === "offline" ? "opacity-40" : "")}
        style={{
          width: "26%",
          height: "26%",
          boxShadow: state === "offline" ? "none" : "0 0 12px 2px rgba(255,255,255,0.65), 0 0 30px 6px rgba(160,190,255,0.25)",
          animation: active ? "blink 0.9s ease-in-out infinite" : undefined,
        }}
      />
    </div>
  );
}
