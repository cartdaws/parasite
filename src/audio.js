// Tiny WebAudio synth: no files to load. Every sound is a few oscillators or a burst of noise.
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.5; }
  unlock() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
      this.hum();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  get ok() { return this.ctx && this.ctx.state === 'running'; }

  tone(f0, f1, dur, type = 'sine', gain = 0.3, delay = 0) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, gain = 0.3, freq = 1200, q = 0.8) {
    if (!this.ok) return;
    const t = this.ctx.currentTime, n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
    s.connect(f).connect(g).connect(this.master); s.start(t);
  }
  hum() {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 48; f.type = 'lowpass'; f.frequency.value = 160; g.gain.value = 0.05;
    o.connect(f).connect(g).connect(this.master); o.start();
  }
  shot() { this.noise(0.18, 0.55, 900, 0.6); this.tone(180, 60, 0.12, 'square', 0.12); }
  enemyShot() { this.noise(0.15, 0.35, 1400, 0.7); this.tone(260, 90, 0.1, 'square', 0.08); }
  leap() { this.tone(300, 900, 0.25, 'triangle', 0.18); this.noise(0.2, 0.15, 3000, 1.5); }
  struggle() { for (let i = 0; i < 5; i++) this.tone(120 + Math.random() * 80, 60, 0.18, 'sawtooth', 0.08, i * 0.2); this.noise(1, 0.12, 500, 2); }
  possess() { this.tone(90, 45, 0.8, 'sine', 0.35); this.tone(400, 200, 0.5, 'triangle', 0.1, 0.1); }
  eject() { this.noise(0.35, 0.3, 400, 1.5); this.tone(500, 150, 0.3, 'triangle', 0.12); }
  hit() { this.tone(140, 50, 0.2, 'square', 0.18); }
  alert() { this.tone(660, 880, 0.12, 'square', 0.12); this.tone(880, 880, 0.12, 'square', 0.1, 0.13); }
  alarm() { for (let i = 0; i < 4; i++) { this.tone(520, 780, 0.45, 'sawtooth', 0.09, i * 0.9); this.tone(780, 520, 0.45, 'sawtooth', 0.09, i * 0.9 + 0.45); } }
  win() { [0, 4, 7, 12].forEach((s, i) => this.tone(330 * 2 ** (s / 12), 330 * 2 ** (s / 12), 0.5, 'triangle', 0.2, i * 0.14)); }
  lose() { this.tone(300, 40, 1.4, 'sawtooth', 0.25); }
}
