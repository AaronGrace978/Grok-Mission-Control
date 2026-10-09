import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronDown, KeyRound, Radio, Square, Trash2, X } from "lucide-react";
import { GrokCore, type CoreState } from "@/components/Emblem";
import { Button } from "@/components/ui/button";
import type { TelemetrySample } from "@/hud/useTelemetry";
import { formatMet } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSettings } from "@/state/settings";
import { useUi } from "@/state/ui";
import { useChat, type Message } from "./chat";
import { QUICK_PROMPTS, telemetryLine } from "./prompt";

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="rounded bg-white/10 px-1 font-mono text-[12px]">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

function MessageView({ m }: { m: Message }) {
  if (m.role === "user") {
    return (
      <div className="animate-fade-up flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-white px-3 py-2 text-[13px] leading-snug text-black">{m.content}</div>
      </div>
    );
  }
  const tag = m.kind === "callout" ? "AUTO CALLOUT" : m.kind === "error" ? "LINK ERROR" : m.kind === "offline" ? "OFFLINE MODE" : "GROK";
  return (
    <div className={cn("animate-fade-up border-l pl-3", m.kind === "error" ? "border-warn/70" : m.kind === "callout" ? "border-white/25" : "border-white/70")}>
      <div className="mb-0.5 flex items-center gap-2 font-mono text-[9px] tracking-[0.18em]">
        <span className={cn(m.kind === "error" ? "text-warn" : "text-white/55")}>{tag}</span>
        <span className="text-white/30">{formatMet(m.met)}</span>
      </div>
      <div className={cn("whitespace-pre-wrap text-[13px] leading-relaxed", m.kind === "callout" ? "text-white/70" : m.kind === "error" ? "text-white/80" : "text-white/92")}>
        {renderInline(m.content)}
        {m.streaming && <span className="animate-blink ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-white" />}
        {m.streaming && !m.content && <span className="font-mono text-[11px] text-white/45">thinking</span>}
      </div>
    </div>
  );
}

export function GrokPanel({ tel, className }: { tel: TelemetrySample; className?: string }) {
  const { messages, busy, send, stop, clear } = useChat();
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const loaded = useSettings((s) => s.loaded);
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const setGrokOpen = useUi((s) => s.setGrokOpen);
  const [draft, setDraft] = useState("");
  const [showContext, setShowContext] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const online = !!apiKey;

  const streaming = messages.some((m) => m.streaming);
  const coreState: CoreState = !online ? "offline" : streaming ? (messages[messages.length - 1]?.content ? "speaking" : "thinking") : "idle";

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const context = useMemo(() => telemetryLine(tel), [tel]);

  const submit = (text: string) => {
    if (!text.trim()) return;
    stick.current = true;
    void send(text);
    setDraft("");
  };

  return (
    <aside className={cn("glass pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-xl", className)} aria-label="Grok co-pilot">
      <div className="relative flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.08),transparent_60%)]" />
        <GrokCore state={coreState} className="size-11 shrink-0" />
        <div className="min-w-0 flex-1 leading-none">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[20px] font-bold tracking-[0.3em] text-white">GROK</span>
            <span className="font-display text-[10px] font-semibold tracking-[0.24em] text-white/45">AI CO-PILOT</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-white/55">
            <span className={cn("size-1.5 rounded-full", online ? "bg-signal shadow-[0_0_6px_var(--signal)]" : "bg-white/30")} />
            {online ? <span className="truncate">LINK UP · {model}</span> : <span>OFFLINE · CALLOUTS ONLY</span>}
          </div>
        </div>
        <button type="button" onClick={clear} aria-label="Clear conversation" className="grid size-7 place-items-center rounded-md text-white/40 hover:bg-white/10 hover:text-white">
          <Trash2 className="size-3.5" />
        </button>
        <button type="button" onClick={() => setGrokOpen(false)} aria-label="Close Grok panel" className="grid size-7 place-items-center rounded-md text-white/40 hover:bg-white/10 hover:text-white">
          <X className="size-4" />
        </button>
      </div>

      <button type="button" onClick={() => setShowContext((v) => !v)} className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-1.5 text-left">
        <Radio className="size-3 shrink-0 text-white/50" />
        <span className="font-mono text-[9px] tracking-[0.16em] text-white/45">LIVE CONTEXT → SYSTEM PROMPT</span>
        <ChevronDown className={cn("ml-auto size-3 text-white/40 transition-transform", showContext && "rotate-180")} />
      </button>
      {showContext && <div className="border-b border-white/5 px-4 py-2 font-mono text-[10px] leading-relaxed text-white/55">{context}</div>}

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="scrollbar-thin min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-4"
      >
        {loaded && !online && (
          <div className="corner-frame rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 font-display text-[13px] font-semibold tracking-[0.18em] text-white">
              <KeyRound className="size-4" /> CONNECT GROK
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/65">
              Grok is calling milestones in offline mode. Add your xAI API key to talk to the co-pilot live. It sees the same telemetry you do.
            </p>
            <Button size="sm" className="mt-3 h-8 font-display text-[11px] font-semibold tracking-[0.18em]" onClick={() => setSettingsOpen(true)}>
              ADD API KEY
            </Button>
            <p className="mt-2 font-mono text-[9px] leading-relaxed text-white/35">Stored only on this device. Get a key at console.x.ai.</p>
          </div>
        )}
        {messages.length === 0 && (
          <div className="pt-2 text-[13px] leading-relaxed text-white/50">
            <span className="font-mono text-[9px] tracking-[0.18em] text-white/35">GROK · STANDBY</span>
            <p className="mt-1">Co-pilot standing by. I'll call out milestones as we fly. Ask me anything about the mission, the physics, or what happens next.</p>
          </div>
        )}
        {messages.map((m) => (
          <MessageView key={m.id} m={m} />
        ))}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="scrollbar-thin mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={busy}
              onClick={() => submit(p.prompt)}
              className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-white/50 hover:text-white disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2 rounded-lg border border-white/12 bg-black/40 p-1.5 focus-within:border-white/35"
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(draft);
              }
            }}
            rows={1}
            placeholder={online ? "Ask Grok…" : "Ask Grok (offline mode)…"}
            aria-label="Message Grok"
            className="max-h-28 min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-white outline-none placeholder:text-white/35"
          />
          {busy ? (
            <button type="button" onClick={stop} aria-label="Stop response" className="grid size-8 shrink-0 place-items-center rounded-md bg-white/15 text-white hover:bg-white/25">
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button type="submit" disabled={!draft.trim()} aria-label="Send" className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-black transition-opacity disabled:opacity-30">
              <ArrowUp className="size-4" />
            </button>
          )}
        </form>
      </div>
    </aside>
  );
}
