import { formatKm, formatLightTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TelemetrySample } from "./useTelemetry";

function Row({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: string; tone?: "warn" | "caution" | "signal" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[5px]">
      <span className="hud-label">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className={cn("hud-value text-[13px]", tone === "warn" && "text-warn", tone === "caution" && "text-caution", tone === "signal" && "text-signal")}>{value}</span>
        {unit && <span className="font-mono text-[10px] text-white/40">{unit}</span>}
        {sub && <span className="ml-1 font-mono text-[9px] text-white/35">{sub}</span>}
      </span>
    </div>
  );
}

function Bar({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 font-mono text-[10px] text-white/50">{label}</span>
      <div className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={cn("absolute inset-y-0 left-0 rounded-full", tone ?? "bg-white")} style={{ width: `${value * 100}%`, boxShadow: "0 0 8px rgba(255,255,255,0.5)" }} />
      </div>
      <span className="w-11 text-right font-mono text-[10px] tabular-nums text-white/80">{(value * 100).toFixed(1)}%</span>
    </div>
  );
}

export function TelemetryPanel({ tel }: { tel: TelemetrySample }) {
  const speedKmh = tel.speed * 3600;
  const qTone = tel.q !== null && tel.q > 28 ? "caution" : undefined;
  const commsTone = tel.comms === "BLACKOUT" ? "warn" : tel.comms === "LOS" ? "caution" : tel.comms === "NOMINAL" ? "signal" : undefined;
  return (
    <section className="glass corner-frame w-[260px] rounded-lg px-3.5 pb-3 pt-2.5" aria-label="Vehicle telemetry">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-display text-[11px] font-bold tracking-[0.26em] text-white">TELEMETRY</span>
        <span className="rounded-sm border border-white/15 px-1.5 py-px font-mono text-[9px] tracking-wider text-white/50">SIMULATED</span>
      </div>
      <div className="hairline mb-1" />
      <Row label="Velocity" value={tel.speed.toFixed(3)} unit="km/s" sub={`REL ${tel.speedRef}`} />
      <Row label="Speed" value={Math.round(speedKmh).toLocaleString("en-US")} unit="km/h" />
      <Row label="Altitude" value={tel.altitude === null ? "—" : formatKm(tel.altitude)} unit={tel.altitude === null ? undefined : "km"} sub={tel.altitude === null ? "HELIO" : tel.altRef} />
      <Row label="From Earth" value={formatKm(tel.distEarth)} unit="km" />
      <Row label={`To ${tel.target}`} value={formatKm(tel.distTarget)} unit="km" />
      <Row label="G-Load" value={tel.gLoad.toFixed(2)} unit="g" />
      {tel.q !== null && <Row label="Dyn. Press." value={tel.q.toFixed(1)} unit="kPa" tone={qTone} />}
      <Row label="Light-Time" value={formatLightTime(tel.lightTime)} />
      <Row label="Comms" value={tel.comms} tone={commsTone} />
      <div className="hairline my-2" />
      <div className="space-y-1.5">
        <div className="hud-label mb-1">Ship propellant</div>
        <Bar label="LOX" value={tel.lox} />
        <Bar label="CH4" value={tel.ch4} tone="bg-white/70" />
        {tel.boosterProp !== null && (
          <>
            <div className="hud-label mb-1 mt-2">Booster</div>
            <Bar label="PROP" value={tel.boosterProp} tone="bg-white/60" />
          </>
        )}
      </div>
    </section>
  );
}
