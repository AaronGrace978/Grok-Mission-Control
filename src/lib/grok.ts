import type { ApiMode } from "@/state/settings";
import { isTauri } from "./platform";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamOptions {
  apiKey: string;
  model: string;
  apiMode: ApiMode;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

export class GrokError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

const BROWSER_BASE = "/api/xai/v1";

function describeHttpError(status: number, body: string) {
  let detail = body.trim();
  try {
    const j = JSON.parse(body);
    detail = j?.error?.message ?? j?.error ?? j?.message ?? detail;
    if (typeof detail !== "string") detail = JSON.stringify(detail);
  } catch {
    /* plain text body */
  }
  if (status === 401 || status === 403 || /api key/i.test(detail)) return `Authentication failed (${status}). Check the API key in Settings. ${detail}`.trim();
  if (status === 404) return `Model or endpoint not found (404). Try another model in Settings. ${detail}`.trim();
  if (status === 429) return `Rate limited (429). Give it a moment. ${detail}`.trim();
  return `xAI API error ${status}: ${detail || "no details"}`;
}

/** Parses an SSE byte stream, invoking onData for each `data:` payload. */
async function readSse(body: ReadableStream<Uint8Array>, onData: (data: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, "");
      const data = chunk
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) onData(data);
    }
  }
}

function chatBody(o: StreamOptions) {
  return JSON.stringify({ model: o.model, messages: o.messages, stream: true, temperature: 0.6 });
}

function responsesBody(o: StreamOptions) {
  const system = o.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const input = o.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
  return JSON.stringify({ model: o.model, instructions: system, input, stream: true, store: false });
}

function extractChatDelta(data: string): string {
  const j = JSON.parse(data);
  if (j.error) throw new GrokError(j.error.message ?? String(j.error));
  return j.choices?.[0]?.delta?.content ?? "";
}

function extractResponsesDelta(data: string): string {
  const j = JSON.parse(data);
  if (j.type === "response.output_text.delta") return j.delta ?? "";
  if (j.type === "error" || j.type === "response.failed") throw new GrokError(j.error?.message ?? j.message ?? "Responses API failed");
  return "";
}

async function browserStream(o: StreamOptions, endpoint: "chat" | "responses") {
  const res = await fetch(`${BROWSER_BASE}/${endpoint === "chat" ? "chat/completions" : "responses"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${o.apiKey}`, Accept: "text/event-stream" },
    body: endpoint === "chat" ? chatBody(o) : responsesBody(o),
    signal: o.signal,
  });
  if (!res.ok || !res.body) throw new GrokError(describeHttpError(res.status, await res.text().catch(() => "")), res.status);
  const extract = endpoint === "chat" ? extractChatDelta : extractResponsesDelta;
  await readSse(res.body, (data) => {
    if (data === "[DONE]") return;
    let text = "";
    try {
      text = extract(data);
    } catch (e) {
      if (e instanceof GrokError) throw e;
      return;
    }
    if (text) o.onDelta(text);
  });
}

type TauriEvent = { type: "delta"; text: string } | { type: "error"; message: string; status?: number } | { type: "done" };

async function tauriStream(o: StreamOptions, endpoint: "chat" | "responses") {
  const { invoke, Channel } = await import("@tauri-apps/api/core");
  const channel = new Channel<TauriEvent>();
  let failure: GrokError | null = null;
  channel.onmessage = (ev) => {
    if (o.signal?.aborted) return;
    if (ev.type === "delta") o.onDelta(ev.text);
    else if (ev.type === "error") failure = new GrokError(ev.status ? describeHttpError(ev.status, ev.message) : ev.message, ev.status);
  };
  const requestId = crypto.randomUUID();
  const abort = () => void invoke("grok_cancel", { requestId }).catch(() => {});
  o.signal?.addEventListener("abort", abort, { once: true });
  try {
    await invoke("grok_stream", {
      requestId,
      apiKey: o.apiKey,
      endpoint,
      body: endpoint === "chat" ? chatBody(o) : responsesBody(o),
      onEvent: channel,
    });
  } catch (e) {
    throw new GrokError(String(e));
  } finally {
    o.signal?.removeEventListener("abort", abort);
  }
  if (failure) throw failure;
}

/**
 * Streams a completion from the xAI API. In "auto" mode, tries Chat Completions first and falls
 * back to the Responses API when the model or endpoint rejects the request before any text arrives.
 */
export async function streamGrok(o: StreamOptions) {
  const run = isTauri() ? tauriStream : browserStream;
  if (o.apiMode !== "auto") return run(o, o.apiMode);
  let received = false;
  const wrapped = { ...o, onDelta: (t: string) => ((received = true), o.onDelta(t)) };
  try {
    await run(wrapped, "chat");
  } catch (e) {
    if (received || o.signal?.aborted) throw e;
    const status = e instanceof GrokError ? e.status : undefined;
    if (status === 401 || status === 403 || status === 429 || (e instanceof Error && /api key/i.test(e.message))) throw e;
    await run(wrapped, "responses");
  }
}
