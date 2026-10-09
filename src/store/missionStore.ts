import { create } from 'zustand';
import { MissionPhase, MissionData } from '../types/mission';

interface MissionStore {
  currentPhase: MissionPhase;
  isPlaying: boolean;
  playbackSpeed: number;
  missionTime: number;
  telemetry: MissionData;
  cameraView: 'chase' | 'orbital' | 'cockpit';
  
  setPhase: (phase: MissionPhase) => void;
  togglePlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  updateMissionTime: (time: number) => void;
  updateTelemetry: (data: Partial<MissionData>) => void;
  setCameraView: (view: 'chase' | 'orbital' | 'cockpit') => void;
  resetMission: () => void;
}

const PHASE_TIMELINE = {
  'pre-launch': 0,
  'launch': 10,
  'earth-orbit': 600,
  'trans-lunar-injection': 900,
  'lunar-approach': 230400,
  'lunar-orbit': 259200,
  'trans-mars-injection': 345600,
  'mars-cruise': 15552000,
  'mars-approach': 19958400,
  'mars-orbit': 20044800,
} as const;

export const useMissionStore = create<MissionStore>((set, get) => ({
  currentPhase: 'pre-launch',
  isPlaying: true,
  playbackSpeed: 1,
  missionTime: 0,
  cameraView: 'chase',
  telemetry: {
    phase: 'pre-launch',
    met: 0,
    velocity: 0,
    distanceFromEarth: 6371,
    distanceToTarget: 384400,
    fuel: 100,
    altitude: 0,
  },
  
  setPhase: (phase) => set({ currentPhase: phase }),
  
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  
  updateMissionTime: (time) => {
    const phases = Object.entries(PHASE_TIMELINE);
    let currentPhase: MissionPhase = 'pre-launch';
    
    for (let i = phases.length - 1; i >= 0; i--) {
      if (time >= phases[i][1]) {
        currentPhase = phases[i][0] as MissionPhase;
        break;
      }
    }
    
    set({ missionTime: time, currentPhase });
  },
  
  updateTelemetry: (data) => 
    set((state) => ({
      telemetry: { ...state.telemetry, ...data },
    })),
  
  setCameraView: (view) => set({ cameraView: view }),
  
  resetMission: () => set({
    currentPhase: 'pre-launch',
    isPlaying: false,
    missionTime: 0,
    telemetry: {
      phase: 'pre-launch',
      met: 0,
      velocity: 0,
      distanceFromEarth: 6371,
      distanceToTarget: 384400,
      fuel: 100,
      altitude: 0,
    },
  }),
}));
