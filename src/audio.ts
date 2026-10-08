type SfxName =
  | 'pick'
  | 'drop'
  | 'coin'
  | 'harvest'
  | 'unlock'
  | 'levelup'
  | 'click'
  | 'error'
  | 'moo'
  | 'cluck'
  | 'baa'
  | 'pay'
  | 'quest';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// Cosy loop in C major: C – Am – F – G, eighth-note melody.
const MELODY: (number | null)[][] = [
  [76, null, 79, 81, 79, null, 76, 74],
  [72, null, 76, null, 74, 72, 69, null],
  [69, 72, 74, null, 76, null, 74, 72],
  [74, null, 71, 74, 79, null, null, null],
  [79, null, 81, 79, 76, null, 79, 76],
  [74, 76, 72, null, 69, null, 72, null],
  [77, null, 76, 74, 72, null, 74, null],
  [71, 74, 72, null, null, null, null, null],
];
const CHORDS = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
];
const BASS = [48, 45, 41, 43];

class AudioSystem {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  soundOn = true;
  musicOn = true;
  private muted = false;
  private last: Record<string, number> = {};
  private noise: AudioBuffer | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private timer: number | null = null;

  unlock() {
    if (!this.ctx) {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctx();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.connect(this.master);
      this.applyGains();
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startMusic();
    }
    if (this.ctx.state === 'suspended' && !this.muted) this.ctx.resume().catch(() => undefined);
  }

  private applyGains() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(this.soundOn ? 0.55 : 0, now, 0.02);
    this.music.gain.setTargetAtTime(this.musicOn ? 0.22 : 0, now, 0.05);
  }

  setSound(on: boolean) {
    this.soundOn = on;
    this.applyGains();
  }
  setMusic(on: boolean) {
    this.musicOn = on;
    this.applyGains();
  }

  /** Global mute used for tab visibility and ads. */
  setMuted(m: boolean) {
    this.muted = m;
    if (!this.ctx) return;
    if (m) this.ctx.suspend().catch(() => undefined);
    else this.ctx.resume().catch(() => undefined);
  }

  private startMusic() {
    if (!this.ctx || this.timer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.2;
    this.timer = window.setInterval(() => this.schedule(), 90);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const eighth = 60 / 100 / 2;
    if (this.nextNoteTime < ctx.currentTime - 1) this.nextNoteTime = ctx.currentTime + 0.05;
    while (this.nextNoteTime < ctx.currentTime + 0.35) {
      const t = this.nextNoteTime;
      const bar = Math.floor(this.step / 8) % 8;
      const pos = this.step % 8;
      const chordIdx = bar % 4;
      const note = MELODY[bar][pos];
      if (note !== null) this.tone(this.music, midi(note), t, 0.32, 'triangle', 0.16, 0.005);
      if (pos === 0 || pos === 4) {
        const b = BASS[chordIdx] + (pos === 4 ? 7 : 0);
        this.tone(this.music, midi(b), t, 0.5, 'sine', 0.32, 0.01);
      }
      if (pos === 0) {
        for (const c of CHORDS[chordIdx]) this.tone(this.music, midi(c), t, eighth * 8, 'sine', 0.045, 0.3);
      }
      if (pos % 2 === 1) this.noiseHit(this.music, t, 0.04, 7000, 0.05);
      this.nextNoteTime += eighth;
      this.step++;
    }
  }

  private tone(
    dest: AudioNode,
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    attack = 0.005,
    freqEnd?: number,
  ) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseHit(dest: AudioNode, t: number, dur: number, freq: number, vol: number, type: BiquadFilterType = 'highpass') {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(t, Math.random() * 0.3);
    s.stop(t + dur + 0.02);
  }

  play(name: SfxName, param = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.soundOn || this.muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const minGap = name === 'coin' || name === 'pick' || name === 'drop' ? 0.045 : 0.08;
    if (this.last[name] && now - this.last[name] < minGap) return;
    this.last[name] = now;
    const d = this.sfx;
    switch (name) {
      case 'pick':
        this.tone(d, 520 + Math.min(param, 30) * 22, now, 0.09, 'sine', 0.35, 0.004, 900 + Math.min(param, 30) * 25);
        break;
      case 'drop':
        this.tone(d, 620, now, 0.08, 'triangle', 0.3, 0.004, 380);
        break;
      case 'coin':
        this.tone(d, 1320, now, 0.07, 'square', 0.08);
        this.tone(d, 1760, now + 0.06, 0.14, 'square', 0.08);
        break;
      case 'pay':
        this.tone(d, 900 + param * 400, now, 0.06, 'triangle', 0.18);
        break;
      case 'harvest':
        this.noiseHit(d, now, 0.09, 2500, 0.3, 'bandpass');
        this.tone(d, 300, now, 0.06, 'sine', 0.2, 0.003, 500);
        break;
      case 'unlock':
        [72, 76, 79, 84].forEach((n, i) => this.tone(d, midi(n), now + i * 0.07, 0.28, 'triangle', 0.3));
        this.noiseHit(d, now, 0.35, 6000, 0.08);
        break;
      case 'levelup':
        [67, 72, 76, 79, 84, 88].forEach((n, i) => this.tone(d, midi(n), now + i * 0.08, 0.35, 'square', 0.09));
        [60, 64, 67].forEach((n) => this.tone(d, midi(n), now + 0.48, 0.7, 'triangle', 0.18, 0.02));
        break;
      case 'quest':
        [76, 79, 84].forEach((n, i) => this.tone(d, midi(n), now + i * 0.09, 0.3, 'triangle', 0.25));
        break;
      case 'click':
        this.tone(d, 880, now, 0.05, 'sine', 0.25, 0.002, 660);
        break;
      case 'error':
        this.tone(d, 220, now, 0.18, 'sawtooth', 0.08, 0.005, 160);
        break;
      case 'moo': {
        const ctx2 = ctx;
        const o = ctx2.createOscillator();
        const f = ctx2.createBiquadFilter();
        const g = ctx2.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(150, now);
        o.frequency.linearRampToValueAtTime(185, now + 0.2);
        o.frequency.linearRampToValueAtTime(120, now + 0.75);
        f.type = 'lowpass';
        f.frequency.value = 700;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.18, now + 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        o.connect(f);
        f.connect(g);
        g.connect(d);
        o.start(now);
        o.stop(now + 0.85);
        break;
      }
      case 'cluck':
        this.tone(d, 700, now, 0.06, 'square', 0.06, 0.003, 1100);
        this.tone(d, 650, now + 0.09, 0.07, 'square', 0.06, 0.003, 1000);
        break;
      case 'baa': {
        const o = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.value = 330;
        lfo.frequency.value = 22;
        lg.gain.value = 25;
        lfo.connect(lg);
        lg.connect(o.frequency);
        f.type = 'lowpass';
        f.frequency.value = 1400;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.1, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
        o.connect(f);
        f.connect(g);
        g.connect(d);
        o.start(now);
        lfo.start(now);
        o.stop(now + 0.6);
        lfo.stop(now + 0.6);
        break;
      }
    }
  }
}

export const audio = new AudioSystem();
