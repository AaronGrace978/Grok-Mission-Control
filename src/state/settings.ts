import { create } from "zustand";
import { isTauri } from "@/lib/platform";

export type ApiMode = "auto" | "chat" | "responses";

export const DEFAULT_MODEL = "grok-4.7";
export const MODEL_PRESETS = ["grok-4.7", "grok-4.6", "grok-4.3", "grok-4.20-0309-non-reasoning"];

export interface GrokSettings {
  apiKey: string;
  model: string;
  apiMode: ApiMode;
}

const DEFAULTS: GrokSettings = { apiKey: "", model: DEFAULT_MODEL, apiMode: "auto" };
const LS_KEY = "gmc.grok";
const STORE_FILE = "settings.json";

async function tauriStore() {
  const { load } = await import("@tauri-apps/plugin-store");
  return load(STORE_FILE, { autoSave: false, defaults: {} });
}

async function readSettings(): Promise<GrokSettings> {
  if (isTauri()) {
    try {
      const store = await tauriStore();
      const saved = await store.get<GrokSettings>("grok");
      return { ...DEFAULTS, ...(saved ?? {}) };
    } catch (e) {
      console.warn("Tauri store unavailable, falling back to localStorage", e);
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

async function writeSettings(s: GrokSettings) {
  if (isTauri()) {
    try {
      const store = await tauriStore();
      await store.set("grok", s);
      await store.save();
      return;
    } catch (e) {
      console.warn("Tauri store write failed, using localStorage", e);
    }
  }
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

interface SettingsState extends GrokSettings {
  loaded: boolean;
  load: () => Promise<void>;
  save: (s: Partial<GrokSettings>) => Promise<void>;
  clearKey: () => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    const s = await readSettings();
    set({ ...s, loaded: true });
  },
  save: async (patch) => {
    const next: GrokSettings = {
      apiKey: patch.apiKey ?? get().apiKey,
      model: (patch.model ?? get().model).trim() || DEFAULT_MODEL,
      apiMode: patch.apiMode ?? get().apiMode,
    };
    set(next);
    await writeSettings(next);
  },
  clearKey: async () => {
    await get().save({ apiKey: "" });
  },
}));
