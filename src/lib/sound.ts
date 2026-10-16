import type { Cue } from "@/game/sound-cues";

export type SoundSettings = {
  /** Effects, engine noise and radio beeps. */
  enabled: boolean;
  /** Read team radio aloud with the browser's speech synthesis. */
  voice: boolean;
};

export const DEFAULT_SOUND: SoundSettings = { enabled: true, voice: true };

/** Overall loudness of everything the board plays. */
const MASTER_VOLUME = 0.5;
/** The same effect is not repeated more often than this (s), so 16× doesn't turn into noise. */
const CUE_GAP = 0.6;
/** At most this many radio messages wait to be read out; older ones are dropped. */
const VOICE_QUEUE = 2;

/**
 * All game audio, synthesised with the Web Audio API: no recordings. Team radio gets the
 * broadcast-style "bip" before and after and (optionally) the message read by the speech
 * synthesiser; the race gets short effects for the start, passes, stops, the Safety Car and the
 * flag. No engine noise and no static under the radio: both were too tiring to listen to.
 *
 * Browsers only start audio after a user gesture, so call `unlock()` from a click or key press.
 */
export class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastCue = new Map<string, number>();
  private settings: SoundSettings = DEFAULT_SOUND;
  private voices = 0;
  private lang = "en-GB";

  /** Create or resume the audio context; must run inside a user gesture the first time. */
  unlock(): void {
    if (typeof window === "undefined" || !this.settings.enabled) return;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER_VOLUME;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  configure(settings: SoundSettings, lang: string): void {
    this.settings = settings;
    this.lang = lang === "uk" ? "uk-UA" : "en-GB";
    if (!settings.voice) this.stopVoice();
    if (!this.ctx) return;
    if (settings.enabled && this.ctx.state === "suspended")
      void this.ctx.resume();
  }

  play(cue: Cue): void {
    const ctx = this.ready();
    if (!ctx || !this.throttle(cue)) return;
    const t = ctx.currentTime + 0.01;
    switch (cue) {
      case "lightsOut":
        // Five red lights, then lights out.
        for (let i = 0; i < 5; i++)
          this.tone(t + i * 0.18, 0.09, 520, "square", 0.08);
        this.tone(t + 1.0, 0.25, 1040, "square", 0.08);
        break;
      case "overtakeGain":
        this.whoosh(t, 400, 2600, 0.5);
        this.tone(t + 0.25, 0.08, 880, "triangle", 0.12);
        this.tone(t + 0.34, 0.14, 1320, "triangle", 0.12);
        break;
      case "overtakeLoss":
        this.whoosh(t, 2400, 500, 0.5);
        this.tone(t + 0.25, 0.1, 440, "triangle", 0.1);
        this.tone(t + 0.36, 0.18, 300, "triangle", 0.1);
        break;
      case "pitStop":
        // Four wheel guns, then the release.
        for (let i = 0; i < 4; i++) this.wheelGun(t + 0.15 + i * 0.22);
        this.tone(t + 1.15, 0.12, 990, "sine", 0.1);
        break;
      case "safetyCar":
        for (let i = 0; i < 3; i++) {
          this.tone(t + i * 0.5, 0.22, 880, "triangle", 0.12);
          this.tone(t + i * 0.5 + 0.24, 0.22, 660, "triangle", 0.12);
        }
        break;
      case "green":
        [660, 880, 1175].forEach((f, i) =>
          this.tone(t + i * 0.1, 0.12, f, "triangle", 0.1),
        );
        break;
      case "boost":
        this.sweep(t, 0.4, 180, 1800, "sawtooth", 0.07);
        this.whoosh(t + 0.05, 800, 4000, 0.35, 0.12);
        break;
      case "rain":
        [784, 659].forEach((f, i) =>
          this.tone(t + i * 0.18, 0.2, f, "sine", 0.08),
        );
        break;
      case "fastestLap":
        [1046, 1318].forEach((f, i) =>
          this.tone(t + i * 0.12, 0.16, f, "sine", 0.09),
        );
        break;
      case "chequered":
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone(t + i * 0.16, 0.22, f, "triangle", 0.14),
        );
        [523, 659, 784].forEach((f) =>
          this.tone(t + 0.7, 1.1, f, "triangle", 0.09),
        );
        break;
    }
  }

  /** A decision prompt (auto-pause). */
  alert(): void {
    const ctx = this.ready();
    if (!ctx || !this.throttle("alert")) return;
    const t = ctx.currentTime + 0.01;
    this.tone(t, 0.12, 1320, "sine", 0.12);
    this.tone(t + 0.14, 0.2, 1760, "sine", 0.1);
  }

  /**
   * Team radio: the broadcast "bip", the message (read out when voice is on), and the closing
   * "bip".
   */
  radio(text: string, from: "driver" | "engineer"): void {
    const ctx = this.ready();
    if (!ctx || !this.throttle("radio", 0.8)) return;
    const t = ctx.currentTime + 0.01;
    this.radioBip(t, true);

    const speak =
      this.settings.voice &&
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      this.voices < VOICE_QUEUE;
    if (!speak) {
      this.radioBip(t + Math.min(2.2, 0.5 + text.length * 0.02), false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.lang;
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.replace("_", "-").startsWith(this.lang.slice(0, 2)));
    if (voice) utterance.voice = voice;
    utterance.rate = from === "driver" ? 1.15 : 1.05;
    utterance.pitch = from === "driver" ? 1.05 : 0.9;
    utterance.volume = 0.9;
    this.voices++;
    const done = () => {
      this.voices = Math.max(0, this.voices - 1);
      if (this.ctx) this.radioBip(this.ctx.currentTime + 0.08, false);
    };
    utterance.onend = done;
    utterance.onerror = done;
    // Start speaking just after the opening bip.
    setTimeout(() => window.speechSynthesis.speak(utterance), 180);
  }

  dispose(): void {
    this.stopVoice();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  // ------------------------------------------------------------------ internals

  private ready(): AudioContext | null {
    if (!this.settings.enabled || !this.ctx || this.ctx.state !== "running")
      return null;
    return this.ctx;
  }

  private throttle(key: string, gap = CUE_GAP): boolean {
    const now = performance.now() / 1000;
    const last = this.lastCue.get(key) ?? -Infinity;
    if (now - last < gap) return false;
    this.lastCue.set(key, now);
    return true;
  }

  private stopVoice() {
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      window.speechSynthesis.cancel();
    this.voices = 0;
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private envelope(
    start: number,
    duration: number,
    peak: number,
    attack = 0.01,
  ): GainNode {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(this.master!);
    return gain;
  }

  private tone(
    start: number,
    duration: number,
    frequency: number,
    type: OscillatorType,
    peak: number,
  ) {
    const osc = this.ctx!.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(this.envelope(start, duration, peak));
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private sweep(
    start: number,
    duration: number,
    from: number,
    to: number,
    type: OscillatorType,
    peak: number,
  ) {
    const osc = this.ctx!.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + duration);
    osc.connect(this.envelope(start, duration, peak, 0.03));
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noiseSource(start: number, duration: number): AudioBufferSourceNode {
    const source = this.ctx!.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    source.start(start, Math.random());
    source.stop(start + duration + 0.05);
    return source;
  }

  private whoosh(
    start: number,
    from: number,
    to: number,
    duration: number,
    peak = 0.25,
  ) {
    const filter = this.ctx!.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    this.noiseSource(start, duration).connect(filter);
    filter.connect(this.envelope(start, duration, peak, duration * 0.4));
  }

  /** A pneumatic wheel gun: a short, rattling burst of noise. */
  private wheelGun(start: number) {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1800;
    const rattle = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = 55;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    rattle.gain.value = 0.5;
    lfo.connect(depth).connect(rattle.gain);
    this.noiseSource(start, 0.16).connect(filter).connect(rattle);
    rattle.connect(this.envelope(start, 0.16, 0.3, 0.005));
    lfo.start(start);
    lfo.stop(start + 0.2);
  }

  /** The F1 broadcast radio "bip": two quick digital tones, rising in and falling out. */
  private radioBip(start: number, opening: boolean) {
    const [a, b] = opening ? [1450, 1950] : [1950, 1450];
    this.tone(start, 0.05, a, "square", 0.05);
    this.tone(start + 0.06, 0.07, b, "square", 0.05);
  }
}
