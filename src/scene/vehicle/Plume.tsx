import { useMemo } from "react";
import * as THREE from "three";
import { plasmaFragment, plumeFragment, plumeVertex, sparkFragment, sparkVertex } from "../shaders";

/** Unit cone along -Y (y in [-1, 0]); radius/length are applied in the vertex shader. */
const UNIT_CONE = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 40, 40, true);
  g.translate(0, -0.5, 0);
  return g;
})();

export interface PlumeOptions {
  length: number;
  r0: number;
  r1: number;
  curve?: number;
  core: THREE.Color;
  edge: THREE.Color;
  diamonds?: number;
  intensity?: number;
  falloff?: number;
}

export function createPlumeMaterial(o: PlumeOptions) {
  return new THREE.ShaderMaterial({
    vertexShader: plumeVertex,
    fragmentShader: plumeFragment,
    uniforms: {
      uLength: { value: o.length },
      uR0: { value: o.r0 },
      uR1: { value: o.r1 },
      uCurve: { value: o.curve ?? 0.6 },
      uTime: { value: 0 },
      uThrottle: { value: 0 },
      uCore: { value: o.core },
      uEdge: { value: o.edge },
      uDiamonds: { value: o.diamonds ?? 0 },
      uIntensity: { value: o.intensity ?? 1 },
      uFalloff: { value: o.falloff ?? 1.4 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

export function createPlasmaMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: plumeVertex,
    fragmentShader: plasmaFragment,
    uniforms: {
      uLength: { value: 70 },
      uR0: { value: 9 },
      uR1: { value: 3 },
      uCurve: { value: 0.8 },
      uTime: { value: 0 },
      uIntensity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

export function PlumeCone({ material, renderOrder = 5 }: { material: THREE.ShaderMaterial; renderOrder?: number }) {
  return <mesh geometry={UNIT_CONE} material={material} renderOrder={renderOrder} frustumCulled={false} />;
}

export function createSparkMaterial(color: THREE.Color, length: number, spread: number, size: number) {
  return new THREE.ShaderMaterial({
    vertexShader: sparkVertex,
    fragmentShader: sparkFragment,
    uniforms: {
      uTime: { value: 0 },
      uLength: { value: length },
      uSpread: { value: spread },
      uSize: { value: size },
      uScale: { value: 800 },
      uThrottle: { value: 0 },
      uColor: { value: color },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

export function Sparks({ material, count }: { material: THREE.ShaderMaterial; count: number }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    return g;
  }, [count]);
  return <points geometry={geom} material={material} frustumCulled={false} renderOrder={6} />;
}
