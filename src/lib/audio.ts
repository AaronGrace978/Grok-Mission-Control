/** Procedural WebAudio soundscape: cabin drone, throttle-driven engine rumble, and UI chimes. */
class Soundscape {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private rumble!: GainNode;
  private rumbleFilter!: BiquadFilterNode;
  private enabled = false;

  private ensure() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    const drone = ctx.createGain();
    drone.gain.value = 0.05;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 420;
    drone.connect(droneFilter).connect(this.master);
    for (const [f, d] of [
      [55, 0],
      [55.4, 7],
      [82.5, -4],
      [110.2, 3],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = d;
      const g = ctx.createGain();
      g.gain.value = f > 100 ? 0.25 : 0.5;
      o.connect(g).connect(drone);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(droneFilter.frequency);
    lfo.start();

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    this.rumbleFilter = ctx.createBiquadFilter();
    this.rumbleFilter.type = "lowpass";
    this.rumbleFilter.frequency.value = 180;
    this.rumble = ctx.createGain();
    this.rumble.gain.value = 0;
    noise.connect(this.rumbleFilter).connect(this.rumble).connect(this.master);
    noise.start();
    return ctx;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on && !this.ctx) return;
    const ctx = this.ensure();
    if (on && ctx.state === "suspended") void ctx.resume();
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.4);
  }

  /** throttle 0..1 (booster counts heavier), atmo 0..1 for how much air carries the sound. */
  setEngine(throttle: number, atmo: number) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    this.rumble.gain.setTargetAtTime(throttle * (0.25 + 0.75 * atmo) * 0.9, t, 0.15);
    this.rumbleFilter.frequency.setTargetAtTime(120 + 260 * throttle * (0.4 + 0.6 * atmo), t, 0.2);
  }

  chime(kind: "event" | "major" | "ui" = "event") {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const notes = kind === "major" ? [880, 1320] : kind === "event" ? [1046] : [1568];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      const s = t0 + i * 0.11;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(kind === "ui" ? 0.03 : 0.06, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + (kind === "ui" ? 0.12 : 0.6));
      o.connect(g).connect(this.master);
      o.start(s);
      o.stop(s + 0.7);
    });
  }
}

export const audio = new Soundscape();
