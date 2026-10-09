import * as THREE from "three";
import { puffFragment, puffVertex } from "../shaders";

export interface PuffSystem {
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  positions: Float32Array;
  sizes: Float32Array;
  alphas: Float32Array;
  commit: (count: number) => void;
}

/** CPU-driven soft billboard puffs (steam, smoke). Sizes are in local units. */
export function createPuffs(max: number, color: THREE.Color): PuffSystem {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(max * 3);
  const sizes = new Float32Array(max);
  const alphas = new Float32Array(max);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({
    vertexShader: puffVertex,
    fragmentShader: puffFragment,
    uniforms: { uScale: { value: 800 }, uColor: { value: color } },
    transparent: true,
    depthWrite: false,
  });
  return {
    geometry,
    material,
    positions,
    sizes,
    alphas,
    commit(count) {
      geometry.setDrawRange(0, count);
      (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    },
  };
}

export function pixelScale(camera: THREE.PerspectiveCamera, heightPx: number) {
  return heightPx / (2 * Math.tan((camera.fov * Math.PI) / 360));
}
