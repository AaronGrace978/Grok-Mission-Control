import { MissionPhase } from '../types/mission';
import * as THREE from 'three';

export const SCALE_FACTOR = 0.00001;

export const BODY_DATA = {
  sun: { radius: 696000, position: new THREE.Vector3(0, 0, 0) },
  earth: { radius: 6371, orbitRadius: 149600000 },
  moon: { radius: 1737, orbitRadius: 384400 },
  mars: { radius: 3389, orbitRadius: 227900000 },
};

export function calculateRocketPosition(missionTime: number, phase: MissionPhase): THREE.Vector3 {
  const earthAngle = (missionTime * 0.000001) % (Math.PI * 2);
  const earthPos = new THREE.Vector3(
    Math.cos(earthAngle) * BODY_DATA.earth.orbitRadius * SCALE_FACTOR,
    0,
    Math.sin(earthAngle) * BODY_DATA.earth.orbitRadius * SCALE_FACTOR
  );
  
  const moonAngle = (missionTime * 0.00001) % (Math.PI * 2);
  const moonOffset = new THREE.Vector3(
    Math.cos(moonAngle) * BODY_DATA.moon.orbitRadius * SCALE_FACTOR,
    0,
    Math.sin(moonAngle) * BODY_DATA.moon.orbitRadius * SCALE_FACTOR
  );
  
  const marsAngle = (missionTime * 0.0000005) % (Math.PI * 2);
  const marsPos = new THREE.Vector3(
    Math.cos(marsAngle) * BODY_DATA.mars.orbitRadius * SCALE_FACTOR,
    0,
    Math.sin(marsAngle) * BODY_DATA.mars.orbitRadius * SCALE_FACTOR
  );
  
  switch (phase) {
    case 'pre-launch':
    case 'launch':
      return earthPos.clone().add(new THREE.Vector3(0, BODY_DATA.earth.radius * SCALE_FACTOR * 1.1, 0));
    
    case 'earth-orbit':
      const orbitAngle = (missionTime * 0.001) % (Math.PI * 2);
      return earthPos.clone().add(new THREE.Vector3(
        Math.cos(orbitAngle) * BODY_DATA.earth.radius * SCALE_FACTOR * 1.5,
        0,
        Math.sin(orbitAngle) * BODY_DATA.earth.radius * SCALE_FACTOR * 1.5
      ));
    
    case 'trans-lunar-injection':
    case 'lunar-approach': {
      const progress = Math.min((missionTime - 900) / 229500, 1);
      const moonTargetPos = earthPos.clone().add(moonOffset);
      return earthPos.clone().lerp(moonTargetPos, progress);
    }
    
    case 'lunar-orbit': {
      const lunarOrbitAngle = (missionTime * 0.002) % (Math.PI * 2);
      const moonPos = earthPos.clone().add(moonOffset);
      return moonPos.clone().add(new THREE.Vector3(
        Math.cos(lunarOrbitAngle) * BODY_DATA.moon.radius * SCALE_FACTOR * 2,
        0,
        Math.sin(lunarOrbitAngle) * BODY_DATA.moon.radius * SCALE_FACTOR * 2
      ));
    }
    
    case 'trans-mars-injection':
    case 'mars-cruise':
    case 'mars-approach': {
      const progress = Math.min((missionTime - 345600) / 19699200, 1);
      return earthPos.clone().lerp(marsPos, progress);
    }
    
    case 'mars-orbit': {
      const marsOrbitAngle = (missionTime * 0.001) % (Math.PI * 2);
      return marsPos.clone().add(new THREE.Vector3(
        Math.cos(marsOrbitAngle) * BODY_DATA.mars.radius * SCALE_FACTOR * 2,
        0,
        Math.sin(marsOrbitAngle) * BODY_DATA.mars.radius * SCALE_FACTOR * 2
      ));
    }
    
    default:
      return earthPos;
  }
}

export function calculateTelemetry(missionTime: number, phase: MissionPhase, rocketPos: THREE.Vector3) {
  const earthAngle = (missionTime * 0.000001) % (Math.PI * 2);
  const earthPos = new THREE.Vector3(
    Math.cos(earthAngle) * BODY_DATA.earth.orbitRadius * SCALE_FACTOR,
    0,
    Math.sin(earthAngle) * BODY_DATA.earth.orbitRadius * SCALE_FACTOR
  );
  
  const marsAngle = (missionTime * 0.0000005) % (Math.PI * 2);
  const marsPos = new THREE.Vector3(
    Math.cos(marsAngle) * BODY_DATA.mars.orbitRadius * SCALE_FACTOR,
    0,
    Math.sin(marsAngle) * BODY_DATA.mars.orbitRadius * SCALE_FACTOR
  );
  
  const distanceFromEarth = rocketPos.distanceTo(earthPos) / SCALE_FACTOR;
  const distanceToTarget = phase.includes('mars') 
    ? rocketPos.distanceTo(marsPos) / SCALE_FACTOR
    : rocketPos.distanceTo(earthPos) / SCALE_FACTOR;
  
  let velocity = 0;
  let fuel = 100;
  
  switch (phase) {
    case 'pre-launch':
      velocity = 0;
      break;
    case 'launch':
      velocity = 7.8;
      fuel = 95;
      break;
    case 'earth-orbit':
      velocity = 7.8;
      fuel = 90;
      break;
    case 'trans-lunar-injection':
      velocity = 11;
      fuel = 80;
      break;
    case 'lunar-approach':
      velocity = 1.5;
      fuel = 75;
      break;
    case 'lunar-orbit':
      velocity = 1.6;
      fuel = 70;
      break;
    case 'trans-mars-injection':
      velocity = 12;
      fuel = 60;
      break;
    case 'mars-cruise':
      velocity = 24;
      fuel = 55;
      break;
    case 'mars-approach':
      velocity = 5.5;
      fuel = 45;
      break;
    case 'mars-orbit':
      velocity = 3.5;
      fuel = 40;
      break;
  }
  
  return {
    phase,
    met: missionTime,
    velocity,
    distanceFromEarth,
    distanceToTarget,
    fuel,
    altitude: Math.max(0, distanceFromEarth - 6371),
  };
}

export function formatMET(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDistance(km: number): string {
  if (km > 1000000) {
    return `${(km / 1000000).toFixed(2)} million km`;
  } else if (km > 1000) {
    return `${(km / 1000).toFixed(0)} thousand km`;
  }
  return `${km.toFixed(0)} km`;
}

export function getPhaseDescription(phase: MissionPhase): string {
  const descriptions: Record<MissionPhase, string> = {
    'pre-launch': 'Pre-Launch Sequence',
    'launch': 'Launch & Ascent',
    'earth-orbit': 'Low Earth Orbit',
    'trans-lunar-injection': 'Trans-Lunar Injection',
    'lunar-approach': 'Lunar Approach',
    'lunar-orbit': 'Lunar Orbit',
    'trans-mars-injection': 'Trans-Mars Injection',
    'mars-cruise': 'Mars Cruise Phase',
    'mars-approach': 'Mars Approach',
    'mars-orbit': 'Mars Orbit',
  };
  return descriptions[phase];
}
