import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sim } from "@/sim/clock";
import { EVENTS } from "@/sim/timeline";
import { latLonToLocal, PAD_LATLON, R_EARTH, SCALE } from "@/sim/geometry";
import { vehicleTextures } from "./textures";
import { createPuffs, pixelScale } from "./Puffs";

const PAD_LOCAL = latLonToLocal(PAD_LATLON.lat, PAD_LATLON.lon);
const PAD_QUAT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), PAD_LOCAL);
const IGNITION_T = EVENTS.find((e) => e.id === "ignition")!.t;
const STEAM_COUNT = 360;

function groundTexture() {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x - S / 2) / (S / 2);
      const dy = (y - S / 2) / (S / 2);
      const d = Math.sqrt(dx * dx + dy * dy);
      const n = rnd() * 18;
      const i = (y * S + x) * 4;
      let r = 150 + n, g = 140 + n, b = 112 + n;
      if (d < 0.16) {
        r = g = b = 128 + n * 0.5;
      } else if (Math.abs(dx) < 0.012 || Math.abs(dy + 0.35) < 0.01) {
        r = g = b = 92 + n * 0.4;
      } else if (dx > 0.45 && dy < -0.1) {
        r = 60 + n; g = 92 + n; b = 112 + n;
      }
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255 * (1 - THREE.MathUtils.smoothstep(d, 0.55, 1));
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Orbital launch site, parented to the rotating Earth. Units: meters (scaled). */
export function LaunchSite() {
  const t = vehicleTextures();
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const res = useMemo(() => {
    const ground = new THREE.MeshStandardMaterial({ map: groundTexture(), transparent: true, roughness: 0.95, metalness: 0, depthWrite: false });
    const lattice = t.lattice.clone();
    lattice.repeat.set(1, 14);
    lattice.needsUpdate = true;
    const tower = new THREE.MeshStandardMaterial({ color: "#6b6e73", alphaMap: lattice, alphaTest: 0.5, roughness: 0.7, metalness: 0.6, side: THREE.DoubleSide });
    const steel = new THREE.MeshStandardMaterial({ color: "#b9bcc1", roughness: 0.35, metalness: 0.9 });
    const concrete = new THREE.MeshStandardMaterial({ color: "#8d8d8b", roughness: 0.9, metalness: 0.05 });
    const dark = new THREE.MeshStandardMaterial({ color: "#2b2d31", roughness: 0.6, metalness: 0.7 });
    const steam = createPuffs(STEAM_COUNT, new THREE.Color(0.95, 0.95, 0.97));
    const seeds = Array.from({ length: STEAM_COUNT }, () => ({ birth: Math.random() * 14, ang: Math.random() * Math.PI * 2, k: 0.5 + Math.random() * 0.9, up: Math.random() }));
    return { ground, tower, steel, concrete, dark, steam, seeds };
  }, [t]);

  useFrame(() => {
    const age = sim.t - IGNITION_T;
    const s = res.steam;
    s.material.uniforms.uScale.value = pixelScale(camera, size.height) * SCALE;
    let n = 0;
    if (age > 0 && age < 40) {
      for (const p of res.seeds) {
        const a = age - p.birth * 0.6;
        if (a <= 0) continue;
        const spread = 30 + 160 * p.k * (1 - Math.exp(-a * 0.35));
        const h = 6 + (18 + 50 * p.up) * (1 - Math.exp(-a * 0.25)) + a * 1.2;
        s.positions[n * 3] = Math.cos(p.ang) * spread;
        s.positions[n * 3 + 1] = h;
        s.positions[n * 3 + 2] = Math.sin(p.ang) * spread;
        s.sizes[n] = 40 + a * 9 * p.k;
        s.alphas[n] = Math.min(1, a * 2) * Math.max(0, 1 - a / 34) * 0.55;
        n++;
      }
    }
    s.commit(n);
  });

  return (
    <group position={PAD_LOCAL.clone().multiplyScalar(R_EARTH)} quaternion={PAD_QUAT} scale={SCALE}>
      <mesh material={res.ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.4, 0]} renderOrder={1}>
        <circleGeometry args={[900, 96]} />
      </mesh>
      {/* Launch mount */}
      <mesh material={res.concrete} position={[0, 1, 0]}>
        <cylinderGeometry args={[14, 16, 2, 48]} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} material={res.dark} position={[Math.sin(a) * 7.5, 9, Math.cos(a) * 7.5]}>
            <boxGeometry args={[2.2, 16, 2.2]} />
          </mesh>
        );
      })}
      <mesh material={res.dark} position={[0, 17.5, 0]}>
        <torusGeometry args={[6.6, 1.3, 12, 48]} />
      </mesh>
      {/* Tower + arms */}
      <group position={[30, 0, 0]}>
        <mesh material={res.tower} position={[0, 73, 0]}>
          <boxGeometry args={[10, 146, 10]} />
        </mesh>
        <mesh material={res.dark} position={[0, 147, 0]}>
          <boxGeometry args={[11, 2, 11]} />
        </mesh>
        {[-5.5, 5.5].map((z) => (
          <mesh key={z} material={res.dark} position={[-15, 112, z]}>
            <boxGeometry args={[24, 2.4, 1.6]} />
          </mesh>
        ))}
        <mesh material={res.dark} position={[-11, 138, 0]}>
          <boxGeometry args={[14, 1.6, 2.4]} />
        </mesh>
      </group>
      {/* Tank farm */}
      {[
        [-160, 120],
        [-175, 135],
        [-190, 120],
        [-205, 135],
        [-150, -170],
        [-170, -170],
      ].map(([x, z], i) => (
        <mesh key={i} material={res.steel} position={[x, 14, z]}>
          <cylinderGeometry args={[5, 5, 28, 32]} />
        </mesh>
      ))}
      <points geometry={res.steam.geometry} material={res.steam.material} frustumCulled={false} renderOrder={3} />
    </group>
  );
}
