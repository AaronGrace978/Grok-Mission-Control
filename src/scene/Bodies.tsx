import { forwardRef, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { sim } from "@/sim/clock";
import { earthQuat, EARTH_POS, MARS_POS, MOON_POS, R_EARTH, R_MARS, R_MOON, SUN_DIR, SUN_POS } from "@/sim/geometry";
import { atmosphereFragment, cloudFragment, earthFragment, planetVertex, rockyFragment, skyFragment, skyVertex, starFragment, starVertex } from "./shaders";
import { TEXTURES, type QualityConfig } from "./quality";
import { LaunchSite } from "./vehicle/LaunchSite";

function useConfiguredTextures(urls: string[], srgb: boolean[]) {
  const gl = useThree((s) => s.gl);
  const textures = useTexture(urls) as THREE.Texture[];
  useEffect(() => {
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    textures.forEach((t, i) => {
      t.colorSpace = srgb[i] ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = aniso;
      t.wrapS = THREE.RepeatWrapping;
      t.needsUpdate = true;
    });
  }, [textures, gl, srgb]);
  return textures;
}

function atmosphereMaterial(dayColor: THREE.Color, duskColor: THREE.Color, shellRatio: number, intensity: number, sunDir: THREE.Vector3) {
  return new THREE.ShaderMaterial({
    vertexShader: planetVertex,
    fragmentShader: atmosphereFragment,
    uniforms: {
      sunDir: { value: sunDir },
      dayColor: { value: dayColor },
      duskColor: { value: duskColor },
      limb: { value: Math.sqrt(1 - 1 / (shellRatio * shellRatio)) },
      intensity: { value: intensity },
    },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}

export function Earth({ q }: { q: QualityConfig }) {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const [day, night, clouds, spec] = useConfiguredTextures(
    [TEXTURES.earthDay(q.tex), TEXTURES.earthNight(q.tex), TEXTURES.earthClouds, TEXTURES.earthSpec],
    useMemo(() => [true, true, false, false], []),
  );
  const sunDir = useMemo(() => SUN_DIR.clone(), []);

  const surface = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planetVertex,
        fragmentShader: earthFragment,
        uniforms: {
          dayMap: { value: day },
          nightMap: { value: night },
          cloudMap: { value: clouds },
          specMap: { value: spec },
          sunDir: { value: sunDir },
          cloudShift: { value: 0 },
          lowCam: { value: 0 },
          hazeColor: { value: new THREE.Color(0.19, 0.31, 0.5) },
        },
      }),
    [day, night, clouds, spec, sunDir],
  );
  const cloudMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planetVertex,
        fragmentShader: cloudFragment,
        uniforms: { cloudMap: { value: clouds }, sunDir: { value: sunDir }, cloudShift: { value: 0 } },
        transparent: true,
        depthWrite: false,
      }),
    [clouds, sunDir],
  );
  const atmo = useMemo(
    () => atmosphereMaterial(new THREE.Color(0.35, 0.62, 1.4), new THREE.Color(1.3, 0.45, 0.18), 1.028, 1.6, sunDir),
    [sunDir],
  );

  useFrame(() => {
    if (!group.current) return;
    earthQuat(sim.frame.earthRot, group.current.quaternion);
    const shift = sim.frame.earthRot * 0.004 + sim.t * 0.00015;
    surface.uniforms.cloudShift.value = shift;
    cloudMat.uniforms.cloudShift.value = shift;
    const camAlt = camera.position.distanceTo(EARTH_POS) - R_EARTH;
    atmo.uniforms.intensity.value = 1.6 * THREE.MathUtils.smoothstep(camAlt, 0.12, 0.6);
    surface.uniforms.lowCam.value = 1 - THREE.MathUtils.smoothstep(camAlt, 0.004, 0.09);
  });

  const seg = q.sphereSegments;
  return (
    <group position={EARTH_POS}>
      <group ref={group}>
        <mesh material={surface} name="earth">
          <sphereGeometry args={[R_EARTH, seg, seg / 2]} />
        </mesh>
        <mesh material={cloudMat} scale={1.0035} renderOrder={1}>
          <sphereGeometry args={[R_EARTH, seg, seg / 2]} />
        </mesh>
        <LaunchSite />
      </group>
      <mesh material={atmo} scale={1.028} renderOrder={2}>
        <sphereGeometry args={[R_EARTH, seg, seg / 2]} />
      </mesh>
    </group>
  );
}

function RockyBody({
  position,
  radius,
  url,
  q,
  exposure,
  haze,
  hazeColor,
  spin,
  orient,
  atmosphere,
}: {
  position: THREE.Vector3;
  radius: number;
  url: string;
  q: QualityConfig;
  exposure: number;
  haze: number;
  hazeColor: THREE.Color;
  spin: number;
  orient?: THREE.Quaternion;
  atmosphere?: { day: THREE.Color; dusk: THREE.Color; ratio: number; intensity: number };
}) {
  const [map] = useConfiguredTextures([url], useMemo(() => [true], []));
  const mesh = useRef<THREE.Mesh>(null);
  const sunDir = useMemo(() => SUN_POS.clone().sub(position).normalize(), [position]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planetVertex,
        fragmentShader: rockyFragment,
        uniforms: { map: { value: map }, sunDir: { value: sunDir }, exposure: { value: exposure }, haze: { value: haze }, hazeColor: { value: hazeColor } },
      }),
    [map, sunDir, exposure, haze, hazeColor],
  );
  const atmoMat = useMemo(
    () => (atmosphere ? atmosphereMaterial(atmosphere.day, atmosphere.dusk, atmosphere.ratio, atmosphere.intensity, sunDir) : null),
    [atmosphere, sunDir],
  );
  const base = useMemo(() => orient ?? new THREE.Quaternion(), [orient]);
  const spinQ = useMemo(() => new THREE.Quaternion(), []);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    if (atmoMat && atmosphere) {
      const shell = (atmosphere.ratio - 1) * radius;
      const camAlt = camera.position.distanceTo(position) - radius;
      atmoMat.uniforms.intensity.value = atmosphere.intensity * THREE.MathUtils.smoothstep(camAlt, shell * 0.8, shell * 4);
    }
    if (!mesh.current) return;
    spinQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, sim.t * spin);
    mesh.current.quaternion.copy(base).multiply(spinQ);
  });
  const seg = q.sphereSegments;
  return (
    <group position={position}>
      <mesh ref={mesh} material={mat}>
        <sphereGeometry args={[radius, seg, seg / 2]} />
      </mesh>
      {atmoMat && (
        <mesh material={atmoMat} scale={atmosphere!.ratio}>
          <sphereGeometry args={[radius, seg, seg / 2]} />
        </mesh>
      )}
    </group>
  );
}

const MOON_ORIENT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), EARTH_POS.clone().sub(MOON_POS).normalize());
const MOON_HAZE = new THREE.Color(0, 0, 0);
const MARS_HAZE = new THREE.Color(0.9, 0.5, 0.32);
const MARS_ATMO = { day: new THREE.Color(1.1, 0.62, 0.42), dusk: new THREE.Color(0.35, 0.5, 1.0), ratio: 1.022, intensity: 0.9 };

export function Moon({ q }: { q: QualityConfig }) {
  return <RockyBody position={MOON_POS} radius={R_MOON} url={TEXTURES.moon(q.tex)} q={q} exposure={1.55} haze={0} hazeColor={MOON_HAZE} spin={0} orient={MOON_ORIENT} />;
}

export function Mars({ q }: { q: QualityConfig }) {
  return (
    <RockyBody
      position={MARS_POS}
      radius={R_MARS}
      url={TEXTURES.mars(q.tex)}
      q={q}
      exposure={1.75}
      haze={0.55}
      hazeColor={MARS_HAZE}
      spin={0.006}
      atmosphere={MARS_ATMO}
    />
  );
}

function radialTexture(stops: [number, string][], size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const Sun = forwardRef<THREE.Mesh>(function Sun(_, ref) {
  const [map] = useConfiguredTextures([TEXTURES.sun], useMemo(() => [true], []));
  const glow = useMemo(
    () =>
      radialTexture([
        [0, "rgba(255,255,255,1)"],
        [0.08, "rgba(255,246,228,0.9)"],
        [0.22, "rgba(255,214,160,0.35)"],
        [0.5, "rgba(255,170,90,0.08)"],
        [1, "rgba(0,0,0,0)"],
      ]),
    [],
  );
  const halo = useMemo(
    () =>
      radialTexture([
        [0, "rgba(255,240,220,0.5)"],
        [0.3, "rgba(255,200,150,0.08)"],
        [1, "rgba(0,0,0,0)"],
      ]),
    [],
  );
  return (
    <group position={SUN_POS}>
      <mesh ref={ref}>
        <sphereGeometry args={[70, 48, 24]} />
        <meshBasicMaterial map={map} color={new THREE.Color(9, 7.4, 5.6)} toneMapped={false} />
      </mesh>
      <sprite scale={1300}>
        <spriteMaterial map={glow} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} color={new THREE.Color(3.5, 3.2, 2.9)} transparent />
      </sprite>
      <sprite scale={5200}>
        <spriteMaterial map={halo} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} color={new THREE.Color(0.7, 0.62, 0.55)} transparent />
      </sprite>
    </group>
  );
});

export function Sky({ q }: { q: QualityConfig }) {
  const [map] = useConfiguredTextures([TEXTURES.stars(q.tex)], useMemo(() => [true], []));
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        uniforms: {
          map: { value: map },
          brightness: { value: 0.22 },
          skyAmount: { value: 0 },
          camUp: { value: new THREE.Vector3(0, 1, 0) },
          sunDir: { value: SUN_DIR.clone() },
        },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [map],
  );
  useFrame(() => {
    if (!group.current) return;
    group.current.position.copy(camera.position);
    const alt = camera.position.distanceTo(EARTH_POS) - R_EARTH;
    const amount = 1 - THREE.MathUtils.smoothstep(alt, 0.004, 0.11);
    mat.uniforms.skyAmount.value = amount;
    (mat.uniforms.camUp.value as THREE.Vector3).copy(camera.position).sub(EARTH_POS).normalize();
    starsFade.value = 1 - amount;
  });
  return (
    <group ref={group}>
      <mesh material={mat} renderOrder={-10} rotation={[0.35, 0.8, 0.2]}>
        <sphereGeometry args={[30000, 64, 32]} />
      </mesh>
      <Starfield count={q.stars} />
    </group>
  );
}

const starsFade = { value: 1 };

function Starfield({ count }: { count: number }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const { geom, mat } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const v = new THREE.Vector3();
    const tints = [new THREE.Color(0.75, 0.82, 1.0), new THREE.Color(1, 1, 1), new THREE.Color(1, 0.93, 0.82), new THREE.Color(1, 0.8, 0.65)];
    for (let i = 0; i < count; i++) {
      v.randomDirection().multiplyScalar(26000);
      pos.set([v.x, v.y, v.z], i * 3);
      const m = Math.pow(Math.random(), 7);
      const b = 0.25 + m * 3.2;
      const c = tints[Math.floor(Math.random() * tints.length)];
      col.set([c.r * b, c.g * b, c.b * b], i * 3);
      size[i] = 1.4 + m * 5.5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("size", new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: { pixelRatio: { value: 1 }, time: { value: 0 }, fade: starsFade },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    return { geom: g, mat: m };
  }, [count]);
  useFrame((state) => {
    mat.uniforms.pixelRatio.value = dpr;
    mat.uniforms.time.value = state.clock.elapsedTime;
  });
  return <points geometry={geom} material={mat} renderOrder={-9} frustumCulled={false} />;
}
