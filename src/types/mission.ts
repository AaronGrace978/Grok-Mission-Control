export type MissionPhase = 
  | 'pre-launch'
  | 'launch'
  | 'earth-orbit'
  | 'trans-lunar-injection'
  | 'lunar-approach'
  | 'lunar-orbit'
  | 'trans-mars-injection'
  | 'mars-cruise'
  | 'mars-approach'
  | 'mars-orbit';

export interface MissionData {
  phase: MissionPhase;
  met: number; // Mission Elapsed Time in seconds
  velocity: number; // km/s
  distanceFromEarth: number; // km
  distanceToTarget: number; // km
  fuel: number; // percentage
  altitude: number; // km
}

export interface CelestialBody {
  name: string;
  radius: number;
  distance: number;
  color: string;
}
