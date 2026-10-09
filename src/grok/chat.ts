import { create } from "zustand";
import { snapshot } from "@/hud/useTelemetry";
import { formatMet } from "@/lib/format";
import { streamGrok, type ChatMessage } from "@/lib/grok";
import { useSettings } from "@/state/settings";
import { buildSystemPrompt, offlineReply } from "./prompt";

export type MessageKind = "chat" | "callout" | "error" | "offline";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind: MessageKind;
  met: number;
  streaming?: boolean;
}

interface ChatState {
  messages: Message[];
  busy: boolean;
  send: (text: string) => Promise<void>;
  callout: (text: string) => void;
  stop: () => void;
  clear: () => void;
}

let controller: AbortController | null = null;
const uid = () => Math.random().toString(36).slice(2, 10);
const HISTORY = 12;

export const useChat = create<ChatState>((set, get) => ({
  messages: [],
  busy: false,

  callout: (text) => {
    const met = snapshot().met;
    set((s) => ({ messages: [...s.messages, { id: uid(), role: "assistant", content: text, kind: "callout", met } satisfies Message].slice(-80) }));
  },

  stop: () => {
    controller?.abort();
    controller = null;
    set((s) => ({ busy: false, messages: s.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)) }));
  },

  clear: () => {
    get().stop();
    set({ messages: [] });
  },

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().busy) return;
    const tel = snapshot();
    const user: Message = { id: uid(), role: "user", content: trimmed, kind: "chat", met: tel.met };
    const { apiKey, model, apiMode } = useSettings.getState();

    if (!apiKey) {
      set((s) => ({ messages: [...s.messages, user, { id: uid(), role: "assistant", content: offlineReply(tel), kind: "offline", met: tel.met }] }));
      return;
    }

    const replyId = uid();
    const history: ChatMessage[] = get()
      .messages.filter((m) => m.kind === "chat" || m.kind === "callout")
      .slice(-HISTORY)
      .map((m) => ({ role: m.role, content: m.kind === "callout" ? `[auto callout at ${formatMet(m.met)}] ${m.content}` : m.content }));

    set((s) => ({
      busy: true,
      messages: [...s.messages, user, { id: replyId, role: "assistant", content: "", kind: "chat", met: tel.met, streaming: true }],
    }));

    controller = new AbortController();
    const signal = controller.signal;
    let buffer = "";
    let raf = 0;
    const flush = () => {
      raf = 0;
      const content = buffer;
      set((s) => ({ messages: s.messages.map((m) => (m.id === replyId ? { ...m, content } : m)) }));
    };

    try {
      await streamGrok({
        apiKey,
        model,
        apiMode,
        signal,
        messages: [{ role: "system", content: buildSystemPrompt(tel) }, ...history, { role: "user", content: trimmed }],
        onDelta: (d) => {
          buffer += d;
          if (!raf) raf = requestAnimationFrame(flush);
        },
      });
      if (raf) cancelAnimationFrame(raf);
      flush();
      set((s) => ({
        messages: s.messages.map((m) => (m.id === replyId ? { ...m, streaming: false, content: m.content || "(no response text)" } : m)),
      }));
    } catch (e) {
      if (signal.aborted) return;
      if (raf) cancelAnimationFrame(raf);
      const message = e instanceof Error ? e.message : String(e);
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === replyId ? { ...m, streaming: false, kind: buffer ? "chat" : "error", content: buffer ? `${buffer}\n\n[stream interrupted: ${message}]` : message } : m,
        ),
      }));
    } finally {
      if (controller?.signal === signal) controller = null;
      set({ busy: false });
    }
  },
}));
