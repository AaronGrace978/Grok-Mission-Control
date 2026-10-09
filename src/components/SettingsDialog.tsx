import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { streamGrok } from "@/lib/grok";
import { isTauri } from "@/lib/platform";
import { DEFAULT_MODEL, MODEL_PRESETS, useSettings, type ApiMode } from "@/state/settings";
import { QUALITY_LABEL, useUi, type Quality } from "@/state/ui";

const CUSTOM = "__custom__";

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="hud-label">{label}</div>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-white/45">{hint}</p>}
    </div>
  );
}

function CopilotTab() {
  const settings = useSettings();
  const [key, setKey] = useState(settings.apiKey);
  const [reveal, setReveal] = useState(false);
  const [model, setModel] = useState(settings.model);
  const [custom, setCustom] = useState(!MODEL_PRESETS.includes(settings.model));
  const [mode, setMode] = useState<ApiMode>(settings.apiMode);
  const [test, setTest] = useState<{ state: "idle" | "running" | "ok" | "fail"; text?: string }>({ state: "idle" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setKey(settings.apiKey);
    setModel(settings.model);
    setMode(settings.apiMode);
    setCustom(!MODEL_PRESETS.includes(settings.model));
  }, [settings.apiKey, settings.model, settings.apiMode]);

  const save = async () => {
    await settings.save({ apiKey: key.trim(), model: model.trim() || DEFAULT_MODEL, apiMode: mode });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const runTest = async () => {
    if (!key.trim()) return setTest({ state: "fail", text: "Enter a key first." });
    setTest({ state: "running" });
    let out = "";
    try {
      await streamGrok({
        apiKey: key.trim(),
        model: model.trim() || DEFAULT_MODEL,
        apiMode: mode,
        messages: [
          { role: "system", content: "You are a flight controller. Reply in at most six words." },
          { role: "user", content: "Radio check. Confirm you read me." },
        ],
        onDelta: (d) => (out += d),
      });
      setTest({ state: "ok", text: out.trim() || "Connected (empty reply)." });
    } catch (e) {
      setTest({ state: "fail", text: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="space-y-5">
      <Field
        label="xAI API key"
        hint={
          <>
            Stored only on this device ({isTauri() ? "app data store" : "browser localStorage"}) and sent only to the xAI API{isTauri() ? " from the native Rust backend" : " via the local dev proxy"}. Create one at{" "}
            <a href="https://console.x.ai" target="_blank" rel="noreferrer" className="text-white underline underline-offset-2">
              console.x.ai
            </a>
            .
          </>
        }
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input type={reveal ? "text" : "password"} value={key} onChange={(e) => setKey(e.target.value)} placeholder="xai-…" autoComplete="off" spellCheck={false} className="pr-9 font-mono text-[13px]" />
            <button type="button" onClick={() => setReveal((r) => !r)} aria-label={reveal ? "Hide key" : "Show key"} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/45 hover:text-white">
              {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {settings.apiKey && (
            <Button variant="outline" onClick={() => void settings.clearKey().then(() => setKey(""))}>
              Remove
            </Button>
          )}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Model">
          <Select
            value={custom ? CUSTOM : model}
            onValueChange={(v) => {
              if (v === CUSTOM) setCustom(true);
              else {
                setCustom(false);
                setModel(v);
              }
            }}
          >
            <SelectTrigger className="w-full font-mono text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_PRESETS.map((m) => (
                <SelectItem key={m} value={m} className="font-mono text-[13px]">
                  {m}
                  {m === DEFAULT_MODEL && <span className="ml-2 text-white/40">default</span>}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM}>Custom model id…</SelectItem>
            </SelectContent>
          </Select>
          {custom && <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="model id" className="mt-2 font-mono text-[13px]" spellCheck={false} />}
        </Field>
        <Field label="API">
          <Select value={mode} onValueChange={(v) => setMode(v as ApiMode)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (Chat → Responses)</SelectItem>
              <SelectItem value="chat">Chat Completions</SelectItem>
              <SelectItem value="responses">Responses</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {test.state !== "idle" && (
        <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] ${test.state === "fail" ? "border-warn/40 bg-warn/5 text-white/80" : "border-white/10 bg-white/[0.03] text-white/80"}`}>
          {test.state === "running" ? <Loader2 className="mt-0.5 size-3.5 animate-spin" /> : test.state === "ok" ? <Check className="mt-0.5 size-3.5 text-signal" /> : <X className="mt-0.5 size-3.5 text-warn" />}
          <span className="break-words">{test.state === "running" ? "Calling Grok…" : test.text}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={runTest} disabled={test.state === "running"}>
          Test connection
        </Button>
        <Button onClick={save} className="min-w-24 font-semibold">
          {saved ? (
            <>
              <Check className="size-4" /> Saved
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}

function DisplayTab() {
  const { quality, autoQuality, setQuality, setAutoQuality, sound, setSound, showLabels, setShowLabels } = useUi();
  const value = autoQuality ? "auto" : quality;
  return (
    <div className="space-y-5">
      <Field label="Render quality" hint={autoQuality ? `Auto adapts to frame rate. Currently ${QUALITY_LABEL[quality]}.` : "Ultra enables 4x MSAA and a heavier particle budget. Tuned for RTX 4060-class GPUs."}>
        <Select
          value={value}
          onValueChange={(v) => {
            if (v === "auto") setAutoQuality(true);
            else setQuality(v as Quality);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            {(Object.keys(QUALITY_LABEL) as Quality[]).map((q) => (
              <SelectItem key={q} value={q}>
                {QUALITY_LABEL[q]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-[13px] text-white">Ambient sound</span>
          <span className="block text-[11px] text-white/45">Cabin drone, engine rumble, and milestone chimes.</span>
        </span>
        <Switch checked={sound} onCheckedChange={setSound} />
      </label>
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-[13px] text-white">Body and vehicle labels</span>
          <span className="block text-[11px] text-white/45">On-screen markers for Earth, Moon, Mars, and Starship.</span>
        </span>
        <Switch checked={showLabels} onCheckedChange={setShowLabels} />
      </label>
      <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 font-mono text-[11px] leading-relaxed text-white/55">
        SPACE play/pause · ← → milestones · 1-4 cameras · G Grok · drag to orbit · scroll to zoom
      </div>
    </div>
  );
}

function CreditsTab() {
  return (
    <div className="space-y-4 text-[13px] leading-relaxed text-white/70">
      <p>
        Planet, Moon, Sun, and star-field textures by{" "}
        <a className="text-white underline underline-offset-2" href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">
          Solar System Scope
        </a>{" "}
        (based on NASA imagery), licensed{" "}
        <a className="text-white underline underline-offset-2" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>
        .
      </p>
      <p>Vehicle, launch site, plume, and HUD art are procedural and original to this project. The mission emblem and Grok core mark are original abstract designs.</p>
      <p className="flex items-start gap-2 rounded-md border border-white/10 bg-white/[0.02] p-3 text-[12px] text-white/55">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Fan-made hackathon project. Not affiliated with or endorsed by SpaceX or xAI. All telemetry is simulated for illustration.
      </p>
    </div>
  );
}

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const setOpen = useUi((s) => s.setSettingsOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="glass max-h-[90vh] overflow-y-auto border-white/10 bg-black/80 sm:max-w-lg" onKeyDown={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="font-display text-[18px] font-bold tracking-[0.24em]">SETTINGS</DialogTitle>
          <DialogDescription className="text-white/50">Co-pilot link, display, and credits.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="copilot" className="mt-1">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="copilot">Grok</TabsTrigger>
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="credits">Credits</TabsTrigger>
          </TabsList>
          <TabsContent value="copilot">
            <CopilotTab />
          </TabsContent>
          <TabsContent value="display">
            <DisplayTab />
          </TabsContent>
          <TabsContent value="credits">
            <CreditsTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
