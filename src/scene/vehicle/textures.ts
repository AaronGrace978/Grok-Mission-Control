import * as THREE from "three";

let cache: ReturnType<typeof build> | null = null;

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Steel and heat-shield textures. U wraps around the hull with u=0 on the belly (+Z). */
function build() {
  const W = 2048;
  const H = 2048;
  const color = document.createElement("canvas");
  color.width = W;
  color.height = H;
  const mr = document.createElement("canvas");
  mr.width = W;
  mr.height = H;
  const c = color.getContext("2d")!;
  const m = mr.getContext("2d")!;
  const r = rand(42);

  // Brushed stainless base with faint vertical streaks.
  c.fillStyle = "#c9ccd0";
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) {
    const x = r() * W;
    const a = 0.025 + r() * 0.05;
    c.fillStyle = r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(60,64,70,${a})`;
    c.fillRect(x, 0, 1 + r() * 3, H);
  }
  // Ring welds every ~1.8 m (hull circumference 28.3 m spans the texture height too).
  const ringPx = (1.8 / 28.3) * H;
  for (let y = ringPx; y < H; y += ringPx) {
    c.fillStyle = "rgba(70,72,78,0.55)";
    c.fillRect(0, y, W, 2);
    c.fillStyle = "rgba(255,255,255,0.18)";
    c.fillRect(0, y + 2, W, 1);
  }
  // Metal/roughness: G = roughness, B = metalness.
  m.fillStyle = "rgb(0,90,255)";
  m.fillRect(0, 0, W, H);
  for (let i = 0; i < 600; i++) {
    m.fillStyle = `rgba(0,${60 + r() * 70},255,0.25)`;
    m.fillRect(r() * W, r() * H, 20 + r() * 200, 4 + r() * 60);
  }

  const steelColor = new THREE.CanvasTexture(color);
  const steelMR = new THREE.CanvasTexture(mr);

  // --- Tiled variant: hex tiles over the belly half.
  const tc = document.createElement("canvas");
  tc.width = W;
  tc.height = H;
  const t = tc.getContext("2d")!;
  t.drawImage(color, 0, 0);
  const tm = document.createElement("canvas");
  tm.width = W;
  tm.height = H;
  const tmc = tm.getContext("2d")!;
  tmc.drawImage(mr, 0, 0);

  const hexR = 10;
  const hexW = Math.sqrt(3) * hexR;
  const rowH = 1.5 * hexR;
  const belly = (u: number) => {
    const d = Math.min(u, 1 - u);
    return d < 0.255;
  };
  const hexPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rad: number) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      const px = cx + rad * Math.cos(a);
      const py = cy + rad * Math.sin(a);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  for (let row = -1; row * rowH < H + rowH; row++) {
    for (let col = -1; col * hexW < W + hexW; col++) {
      const cx = col * hexW + (row % 2 ? hexW / 2 : 0);
      const cy = row * rowH;
      const u = ((cx % W) + W) % W / W;
      if (!belly(u)) continue;
      const roll = r();
      const shade = roll > 0.985 ? 150 + r() * 40 : 18 + r() * 14;
      t.fillStyle = "#3a3c40";
      hexPath(t, cx, cy, hexR);
      t.fill();
      t.fillStyle = `rgb(${shade},${shade},${shade + 2})`;
      hexPath(t, cx, cy, hexR - 1.6);
      t.fill();
      tmc.fillStyle = `rgb(0,${200 + r() * 40},0)`;
      hexPath(tmc, cx, cy, hexR);
      tmc.fill();
    }
  }
  const tileColor = new THREE.CanvasTexture(tc);
  const tileMR = new THREE.CanvasTexture(tm);

  // --- Hot-stage ring vents.
  const vc = document.createElement("canvas");
  vc.width = 1024;
  vc.height = 128;
  const v = vc.getContext("2d")!;
  v.fillStyle = "#2b2d31";
  v.fillRect(0, 0, 1024, 128);
  for (let x = 6; x < 1024; x += 24) {
    v.fillStyle = "#08090a";
    v.fillRect(x, 22, 12, 84);
  }
  const vent = new THREE.CanvasTexture(vc);

  // --- Lattice (grid fins and tower trusses), alpha-tested.
  const lc = document.createElement("canvas");
  lc.width = 256;
  lc.height = 256;
  const l = lc.getContext("2d")!;
  l.fillStyle = "#000";
  l.fillRect(0, 0, 256, 256);
  l.strokeStyle = "#fff";
  l.lineWidth = 9;
  l.strokeRect(4, 4, 248, 248);
  l.lineWidth = 6;
  l.beginPath();
  l.moveTo(0, 0);
  l.lineTo(256, 256);
  l.moveTo(256, 0);
  l.lineTo(0, 256);
  l.stroke();
  const lattice = new THREE.CanvasTexture(lc);
  lattice.wrapS = lattice.wrapT = THREE.RepeatWrapping;

  const gc = document.createElement("canvas");
  gc.width = 256;
  gc.height = 256;
  const g = gc.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#fff";
  g.lineWidth = 5;
  for (let i = -256; i < 512; i += 26) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 256, 256);
    g.moveTo(i + 256, 0);
    g.lineTo(i, 256);
    g.stroke();
  }
  g.lineWidth = 14;
  g.strokeRect(0, 0, 256, 256);
  const grid = new THREE.CanvasTexture(gc);

  for (const tex of [steelColor, tileColor, vent]) tex.colorSpace = THREE.SRGBColorSpace;
  for (const tex of [steelColor, steelMR, tileColor, tileMR, vent]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
  }
  return { steelColor, steelMR, tileColor, tileMR, vent, lattice, grid };
}

export function vehicleTextures() {
  if (!cache) cache = build();
  return cache;
}

export function softDot() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}
