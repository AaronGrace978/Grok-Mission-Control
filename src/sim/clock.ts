import { clamp } from "./math";
import { computeFrame, createFrame, TOTAL_DEMO } from "./frame";

type Listener = () => void;

/**
 * Mutable simulation singleton. Read every frame by the 3D scene, sampled at a lower rate
 * by the HUD, so React never re-renders on the render loop.
 */
export const sim = {
  t: 0,
  frame: computeFrame(0, createFrame()),
  /** Incremented when time jumps (scrub, restart) so smoothed systems can snap. */
  jumpId: 0,
};

const jumpListeners = new Set<Listener>();

export function setSimTime(t: number) {
  sim.t = clamp(t, 0, TOTAL_DEMO);
  computeFrame(sim.t, sim.frame);
  sim.jumpId++;
  jumpListeners.forEach((l) => l());
}

export function advanceSim(dt: number) {
  sim.t = clamp(sim.t + dt, 0, TOTAL_DEMO);
  computeFrame(sim.t, sim.frame);
}

export function onSimJump(l: Listener) {
  jumpListeners.add(l);
  return () => jumpListeners.delete(l);
}

export { TOTAL_DEMO };
