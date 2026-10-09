import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Line2, LineSegments2 } from "three-stdlib";
import { sim } from "@/sim/clock";
import { sampleTrajectory } from "@/sim/geometry";
import { useUi } from "@/state/ui";

export function Trajectory() {
  const { pts, times } = useMemo(sampleTrajectory, []);
  const flown = useRef<Line2 | LineSegments2>(null);
  const ahead = useRef<Line2 | LineSegments2>(null);
  const view = useUi((s) => s.view);

  useFrame(() => {
    let idx = 0;
    while (idx < times.length - 1 && times[idx + 1] <= sim.t) idx++;
    const close = view === "chase" || view === "cockpit";
    if (flown.current) {
      const g = flown.current.geometry as unknown as THREE.InstancedBufferGeometry;
      g.instanceCount = Math.max(0, idx);
      (flown.current.material as unknown as { opacity: number }).opacity = close ? 0.35 : 0.9;
    }
    if (ahead.current) {
      (ahead.current.material as unknown as { opacity: number }).opacity = close ? 0.12 : 0.32;
    }
  });

  return (
    <group>
      <Line ref={ahead as never} points={pts} color="#9aa3ad" lineWidth={1.1} transparent opacity={0.32} dashed dashSize={0.6} gapSize={0.6} depthWrite={false} />
      <Line ref={flown as never} points={pts} color="#ffffff" lineWidth={1.8} transparent opacity={0.9} depthWrite={false} />
    </group>
  );
}
