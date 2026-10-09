import { useEffect, useRef } from "react";
import { sim } from "@/sim/clock";
import { MOON_POS, ORBIT_A, ORBIT_B, sampleTrajectory } from "@/sim/geometry";
import { HELIO, transferEllipsePoint } from "@/sim/helio";
import { PHASE_BY_ID } from "@/sim/timeline";

const W = 260;
const H = 168;

const traj = sampleTrajectory();
const CISLUNAR_END = PHASE_BY_ID.tmi.end;

const moonAngle = Math.atan2(MOON_POS.dot(ORBIT_B), MOON_POS.dot(ORBIT_A));
const moonPlaneDist = Math.hypot(MOON_POS.dot(ORBIT_A), MOON_POS.dot(ORBIT_B));
const cosR = Math.cos(-moonAngle);
const sinR = Math.sin(-moonAngle);

function planeXY(p: { dot: (v: typeof ORBIT_A) => number }) {
  const a = p.dot(ORBIT_A);
  const b = p.dot(ORBIT_B);
  return [a * cosR - b * sinR, a * sinR + b * cosR] as const;
}

const cislunarPts = traj.pts.map((p, i) => ({ xy: planeXY(p), t: traj.times[i] })).filter((p) => p.t <= CISLUNAR_END);
const transferPts = Array.from({ length: 121 }, (_, i) => transferEllipsePoint((i / 120) * Math.PI));

export function MiniMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let lastDraw = 0;

    const dot = (x: number, y: number, r: number, fill: string, glow = 0) => {
      ctx.save();
      if (glow) {
        ctx.shadowColor = fill;
        ctx.shadowBlur = glow;
      }
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    const label = (text: string, x: number, y: number, align: CanvasTextAlign = "left") => {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "500 9px 'JetBrains Mono', monospace";
      ctx.textAlign = align;
      ctx.fillText(text, x, y);
    };

    const drawCislunar = () => {
      const x0 = 38;
      const scale = (W - 38 - 44) / moonPlaneDist;
      const cy = H / 2 + 4;
      const map = (xy: readonly [number, number]) => [x0 + xy[0] * scale, cy - xy[1] * scale] as const;
      const [mx, my] = map([moonPlaneDist, 0]);

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(x0, cy, moonPlaneDist * scale, -0.5, 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.lineWidth = 1;
      for (const flown of [false, true]) {
        ctx.beginPath();
        let started = false;
        for (const p of cislunarPts) {
          if (flown && p.t > sim.t) break;
          const [x, y] = map(p.xy);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = flown ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)";
        if (!flown) ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      dot(x0, cy, 7, "#7fa8ff", 10);
      label("EARTH", x0, cy + 20, "center");
      dot(mx, my, 3.2, "#d8d8d8", 6);
      label("MOON", mx, my + 15, "center");
      const [sx, sy] = map(planeXY(sim.frame.shipPos));
      dot(sx, sy, 2.6, "#ffffff", 10);
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.strokeRect(sx - 5, sy - 5, 10, 10);
    };

    const drawHelio = () => {
      const cx = W / 2;
      const cy = H / 2 + 6;
      const scale = (H / 2 - 12) / HELIO.A_M;
      const map = (p: readonly [number, number]) => [cx + p[0] * scale, cy - p[1] * scale] as const;
      ctx.lineWidth = 1;
      for (const [r, a] of [
        [HELIO.A_E, 0.18],
        [HELIO.A_M, 0.14],
      ] as const) {
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      const tel = sim.frame.tel;
      const cruise = PHASE_BY_ID.cruise;
      const progress = tel.phase.id === "cruise" ? tel.u : sim.t < cruise.start ? 0 : 1;
      const split = Math.round(progress * (transferPts.length - 1));
      for (const flown of [false, true]) {
        ctx.beginPath();
        const pts = flown ? transferPts.slice(0, split + 1) : transferPts;
        pts.forEach((p, i) => {
          const [x, y] = map(p);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = flown ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.25)";
        if (!flown) ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      dot(cx, cy, 5, "#fff3d6", 14);
      const [ex, ey] = map(tel.helio.earth);
      dot(ex, ey, 3, "#7fa8ff", 6);
      label("EARTH", ex, ey - 7, "center");
      const [mx, my] = map(tel.helio.mars);
      dot(mx, my, 2.8, "#e0866a", 6);
      label("MARS", mx, my - 7, "center");
      const [sx, sy] = map(tel.helio.ship);
      dot(sx, sy, 2.2, "#ffffff", 10);
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.strokeRect(sx - 5, sy - 5, 10, 10);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastDraw < 33) return;
      lastDraw = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const helio = sim.t > CISLUNAR_END;
      if (helio) drawHelio();
      else drawCislunar();
      if (modeRef.current) modeRef.current.textContent = helio ? "HELIOCENTRIC" : "CISLUNAR";
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="glass corner-frame w-[260px] overflow-hidden rounded-lg" aria-label="Mission mini-map">
      <div className="flex items-center justify-between px-3.5 pt-2.5">
        <span className="font-display text-[11px] font-bold tracking-[0.26em] text-white">NAV</span>
        <span ref={modeRef} className="font-mono text-[9px] tracking-wider text-white/45">
          CISLUNAR
        </span>
      </div>
      <canvas ref={ref} style={{ width: W, height: H }} className="block" />
    </section>
  );
}
