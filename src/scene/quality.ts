import type { Quality } from "@/state/ui";

export interface QualityConfig {
  dpr: [number, number];
  post: boolean;
  smaa: boolean;
  godRays: boolean;
  flare: boolean;
  tex: "2k" | "4k";
  stars: number;
  particles: number;
  sphereSegments: number;
  multisampling: number;
  noise: boolean;
}

export const QUALITY_CONFIG: Record<Quality, QualityConfig> = {
  low: { dpr: [0.75, 1], post: false, smaa: false, godRays: false, flare: false, tex: "2k", stars: 3500, particles: 0.35, sphereSegments: 64, multisampling: 0, noise: false },
  medium: { dpr: [1, 1.25], post: true, smaa: false, godRays: false, flare: true, tex: "2k", stars: 7000, particles: 0.6, sphereSegments: 96, multisampling: 0, noise: false },
  high: { dpr: [1, 1.75], post: true, smaa: true, godRays: false, flare: true, tex: "4k", stars: 12000, particles: 1, sphereSegments: 160, multisampling: 0, noise: true },
  ultra: { dpr: [1, 2], post: true, smaa: true, godRays: true, flare: true, tex: "4k", stars: 18000, particles: 1.6, sphereSegments: 192, multisampling: 4, noise: true },
};

export const TEXTURES = {
  earthDay: (q: "2k" | "4k") => `/textures/${q}_earth_daymap.jpg`,
  earthNight: (q: "2k" | "4k") => `/textures/${q}_earth_nightmap.jpg`,
  earthClouds: "/textures/2k_earth_clouds.jpg",
  earthSpec: "/textures/2k_earth_specular_map.jpg",
  moon: (q: "2k" | "4k") => `/textures/${q}_moon.jpg`,
  mars: (q: "2k" | "4k") => `/textures/${q}_mars.jpg`,
  sun: "/textures/2k_sun.jpg",
  stars: (q: "2k" | "4k") => `/textures/${q}_stars_milky_way.jpg`,
};
