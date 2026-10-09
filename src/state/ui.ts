import { create } from "zustand";

export type ViewMode = "director" | "chase" | "orbital" | "cockpit";
export type Quality = "low" | "medium" | "high" | "ultra";

export const QUALITY_LABEL: Record<Quality, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  ultra: "Ultra",
};

export const SPEEDS = [0.5, 1, 2, 4, 8] as const;

interface UiState {
  booted: boolean;
  playing: boolean;
  speed: number;
  view: ViewMode;
  quality: Quality;
  autoQuality: boolean;
  sound: boolean;
  settingsOpen: boolean;
  grokOpen: boolean;
  showLabels: boolean;
  fps: number;
  setBooted: (v: boolean) => void;
  setPlaying: (v: boolean) => void;
  togglePlaying: () => void;
  setSpeed: (v: number) => void;
  setView: (v: ViewMode) => void;
  setQuality: (q: Quality, auto?: boolean) => void;
  setAutoQuality: (v: boolean) => void;
  setSound: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setGrokOpen: (v: boolean) => void;
  setShowLabels: (v: boolean) => void;
  setFps: (v: number) => void;
}

const QUALITY_KEY = "gmc.quality";

function initialQuality(): Quality {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(QUALITY_KEY) : null;
  if (saved === "low" || saved === "medium" || saved === "high" || saved === "ultra") return saved;
  const mobile = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  return mobile ? "medium" : "high";
}

export const useUi = create<UiState>((set) => ({
  booted: false,
  playing: true,
  speed: 1,
  view: "director",
  quality: initialQuality(),
  autoQuality: typeof localStorage === "undefined" || localStorage.getItem(QUALITY_KEY) === null,
  sound: true,
  settingsOpen: false,
  grokOpen: typeof window === "undefined" || window.innerWidth >= 1024,
  showLabels: true,
  fps: 60,
  setBooted: (booted) => set({ booted }),
  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
  setSpeed: (speed) => set({ speed }),
  setView: (view) => set({ view }),
  setQuality: (quality, auto = false) => {
    if (!auto) localStorage.setItem(QUALITY_KEY, quality);
    set(auto ? { quality } : { quality, autoQuality: false });
  },
  setAutoQuality: (autoQuality) => {
    if (autoQuality) localStorage.removeItem(QUALITY_KEY);
    set({ autoQuality });
  },
  setSound: (sound) => set({ sound }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setGrokOpen: (grokOpen) => set({ grokOpen }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setFps: (fps) => set({ fps }),
}));
