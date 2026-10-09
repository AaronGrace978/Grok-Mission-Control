import { useEffect, useState } from "react";
import { sim } from "@/sim/clock";
import type { Telemetry } from "@/sim/frame";

export interface TelemetrySample extends Telemetry {
  t: number;
  boosterAttached: boolean;
}

export function snapshot(): TelemetrySample {
  return { ...sim.frame.tel, helio: { ...sim.frame.tel.helio }, t: sim.t, boosterAttached: sim.frame.boosterAttached };
}

/** Samples the mutable sim at a fixed rate so the DOM HUD updates without touching the render loop. */
export function useTelemetry(hz = 15) {
  const [tel, setTel] = useState(snapshot);
  useEffect(() => {
    const id = window.setInterval(() => setTel(snapshot()), 1000 / hz);
    return () => window.clearInterval(id);
  }, [hz]);
  return tel;
}
