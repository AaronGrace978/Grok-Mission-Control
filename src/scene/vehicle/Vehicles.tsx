import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sim } from "@/sim/clock";
import { HOT_STAGE_T, SCALE, shipPosAt, SUN_DIR } from "@/sim/geometry";
import { ascentProfile } from "@/sim/geometry";
import { PHASE_BY_ID, metAt, phaseAt } from "@/sim/timeline";
import { ShipModel } from "./Ship";
import { BoosterModel } from "./Booster";
import { createPlasmaMaterial, PlumeCone } from "./Plume";
import { createPuffs, pixelScale } from "./Puffs";
import { softDot } from "./textures";
import type { QualityConfig } from "../quality";

const LIFTOFF_T = PHASE_BY_ID.ascent.start;

function atmosphereAt(t: number) {
  const { phase, u } = phaseAt(t);
  if (phase.id === "prelaunch") return 1;
  if (phase.id !== "ascent") return 0;
  return Math.exp(-ascentProfile(metAt(phase, u)).alt / 9);
}

/** Ship centre of mass, roughly mid-hull. */
export const SHIP_CENTER_OFFSET_M = 24;

export function Vehicles({ q }: { q: QualityConfig }) {
  const ship = useRef<THREE.Group>(null);
  const booster = useRef<THREE.Group>(null);
  const tanker = useRef<THREE.Group>(null);
  const plasma = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Sprite>(null);
  const beacon = useRef<THREE.Sprite>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  const getShipThrottle = useMemo(() => () => sim.frame.tel.shipThrottle ?? 0, []);
  const getBoosterThrottle = useMemo(() => () => sim.frame.tel.boosterThrottle ?? 0, []);
  const getAtmo = useMemo(() => () => atmosphereAt(sim.t), []);
  const zero = useMemo(() => () => 0, []);

  const fx = useMemo(() => {
    const dot = softDot();
    const plasmaMat = createPlasmaMaterial();
    const trailCount = Math.round(220 * Math.max(0.5, q.particles));
    const smoke = createPuffs(trailCount, new THREE.Color(0.88, 0.88, 0.9));
    return { dot, plasmaMat, smoke, trailCount };
  }, [q.particles]);

  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), q: new THREE.Quaternion() }), []);

  useFrame((state) => {
    const f = sim.frame;
    if (ship.current) {
      ship.current.position.copy(f.shipPos);
      ship.current.quaternion.copy(f.shipQuat);
    }
    if (booster.current) {
      booster.current.visible = f.boosterVisible;
      booster.current.position.copy(f.boosterPos);
      booster.current.quaternion.copy(f.boosterQuat);
    }
    if (tanker.current) {
      tanker.current.visible = f.tankerVisible;
      tanker.current.position.copy(f.tankerPos);
      tanker.current.quaternion.copy(f.tankerQuat);
    }

    const center = tmp.a.copy(f.forward).multiplyScalar(SHIP_CENTER_OFFSET_M * SCALE).add(f.shipPos);

    // Plasma sheath trails opposite the velocity vector.
    if (plasma.current) {
      const p = f.tel.plasma;
      plasma.current.visible = p > 0.01;
      if (p > 0.01) {
        const vdir = tmp.b.copy(f.shipVel).normalize();
        plasma.current.position.copy(center).addScaledVector(vdir, 6 * SCALE);
        plasma.current.quaternion.setFromUnitVectors(tmp.c.set(0, -1, 0), vdir.negate());
        fx.plasmaMat.uniforms.uIntensity.value = p;
        fx.plasmaMat.uniforms.uTime.value = state.clock.elapsedTime;
      }
    }

    if (flash.current) {
      const h = f.hotStageFlash;
      flash.current.visible = h > 0.01;
      flash.current.position.copy(f.shipPos);
      flash.current.scale.setScalar((40 + 90 * (1 - h)) * SCALE);
      (flash.current.material as THREE.SpriteMaterial).opacity = h;
    }

    if (beacon.current) {
      const d = camera.position.distanceTo(center);
      const vis = THREE.MathUtils.smoothstep(d, 0.08, 0.6);
      beacon.current.visible = vis > 0.01;
      beacon.current.position.copy(center);
      (beacon.current.material as THREE.SpriteMaterial).opacity = vis;
    }

    // Exhaust smoke column: puffs sampled along the recent ascent path while in the lower atmosphere.
    const s = fx.smoke;
    s.material.uniforms.uScale.value = pixelScale(camera, size.height);
    let n = 0;
    const now = sim.t;
    if (now > LIFTOFF_T && now < HOT_STAGE_T + 25) {
      const dt = 0.07;
      for (let i = 0; i < fx.trailCount; i++) {
        const age = i * dt + ((now / dt) % 1) * dt;
        const te = now - age;
        if (te < LIFTOFF_T || te > HOT_STAGE_T) continue;
        const ph = phaseAt(te);
        const alt = ascentProfile(metAt(ph.phase, ph.u)).alt;
        if (alt > 42) continue;
        shipPosAt(te, tmp.b);
        shipPosAt(te + 0.02, tmp.c);
        const fwd = tmp.c.sub(tmp.b).normalize();
        const p = tmp.b.addScaledVector(fwd, -(71 + 18 + age * 6) * SCALE);
        s.positions[n * 3] = p.x;
        s.positions[n * 3 + 1] = p.y;
        s.positions[n * 3 + 2] = p.z;
        s.sizes[n] = (22 + age * 30 + alt * 1.5) * SCALE;
        s.alphas[n] = Math.min(1, age * 3) * Math.max(0, 1 - age / 14) * (1 - alt / 42) * 0.5;
        n++;
      }
    }
    s.commit(n);
  }, -1);

  const sunTint = useMemo(() => new THREE.Color(1, 1, 1).multiplyScalar(0.9 + 0.1 * SUN_DIR.y), []);

  return (
    <>
      <group ref={ship}>
        <group scale={SCALE}>
          <ShipModel variant="crew" getThrottle={getShipThrottle} />
        </group>
      </group>
      <group ref={booster}>
        <group scale={SCALE}>
          <BoosterModel getThrottle={getBoosterThrottle} getAtmo={getAtmo} />
        </group>
      </group>
      <group ref={tanker} visible={false}>
        <group scale={SCALE}>
          <ShipModel variant="tanker" getThrottle={zero} />
        </group>
      </group>
      <group ref={plasma} visible={false}>
        <group scale={SCALE}>
          <PlumeCone material={fx.plasmaMat} renderOrder={8} />
        </group>
      </group>
      <sprite ref={flash} visible={false}>
        <spriteMaterial map={fx.dot} color={new THREE.Color(6, 4.2, 2.6)} blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite ref={beacon} scale={[0.014, 0.014, 1]}>
        <spriteMaterial map={fx.dot} color={new THREE.Color(2.4, 2.4, 2.6).multiply(sunTint)} sizeAttenuation={false} transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </sprite>
      <points geometry={fx.smoke.geometry} material={fx.smoke.material} frustumCulled={false} renderOrder={4} />
    </>
  );
}
