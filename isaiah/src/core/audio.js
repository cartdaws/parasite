// Web Audio synthesized SFX + a generative ambient drone per floor.
// Everything here is generated at runtime: no sound files.

let ctx = null, master, sfxBus, musicBus, noiseBuf;
const state = { master: 0.8, sfx: 0.9, music: 0.5, mute: false };
let drone = null;
const lastPlayed = {};

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  return ctx;
}
function applyVolumes() {
  if (!ctx) return;
  master.gain.value = state.mute ? 0 : state.master;
  sfxBus.gain.value = state.sfx;
  musicBus.gain.value = state.music * 0.6;
}

// ---- building blocks -------------------------------------------------------
function env(g, t, a, peak, dcy, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + dcy);
}
function tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.15, vol = 0.3, attack = 0.005, delay = 0, detune = 0, out = sfxBus }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.detune.value = detune;
  o.frequency.setValueAtTime(f0, t);
  if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, attack, vol, dur);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + attack + dur + 0.05);
  return o;
}
function noise({ dur = 0.2, vol = 0.3, f0 = 2000, f1 = null, q = 1, type = 'lowpass', attack = 0.003, delay = 0, out = sfxBus }) {
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 != null) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain();
  env(g, t, attack, vol, dur);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t, Math.random() * 0.5); s.stop(t + attack + dur + 0.05);
}
const rnd = (a, b) => a + Math.random() * (b - a);

// ---- recipes ---------------------------------------------------------------
const SFX = {
  tear() { tone({ type: 'sine', f0: rnd(520, 640), f1: 260, dur: 0.09, vol: 0.18 }); noise({ dur: 0.04, vol: 0.05, f0: 3000 }); },
  splat() { noise({ dur: 0.09, vol: 0.14, f0: rnd(900, 1400), f1: 300, q: 2 }); },
  enemyShot() { tone({ type: 'triangle', f0: rnd(260, 320), f1: 140, dur: 0.12, vol: 0.16 }); },
  hit() { noise({ dur: 0.06, vol: 0.18, f0: 700, f1: 200, q: 3 }); tone({ type: 'sine', f0: 160, f1: 80, dur: 0.07, vol: 0.18 }); },
  enemyDie() {
    noise({ dur: 0.28, vol: 0.28, f0: 1200, f1: 120, q: 4 });
    tone({ type: 'sawtooth', f0: rnd(180, 240), f1: 50, dur: 0.25, vol: 0.12 });
  },
  hurt() {
    tone({ type: 'square', f0: 520, f1: 210, dur: 0.22, vol: 0.14 });
    tone({ type: 'sawtooth', f0: 300, f1: 120, dur: 0.28, vol: 0.12, delay: 0.03 });
    noise({ dur: 0.15, vol: 0.12, f0: 900, f1: 300 });
  },
  coin() { tone({ type: 'square', f0: 988, dur: 0.06, vol: 0.09 }); tone({ type: 'square', f0: 1319, dur: 0.18, vol: 0.09, delay: 0.06 }); },
  heart() { tone({ type: 'sine', f0: 392, f1: 523, dur: 0.18, vol: 0.2 }); tone({ type: 'sine', f0: 523, f1: 784, dur: 0.2, vol: 0.15, delay: 0.08 }); },
  soul() { tone({ type: 'triangle', f0: 660, f1: 990, dur: 0.35, vol: 0.18 }); tone({ type: 'sine', f0: 1320, dur: 0.3, vol: 0.06, delay: 0.1 }); },
  key() { [1400, 1700, 1500].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.08, vol: 0.1, delay: i * 0.05 })); },
  bombPickup() { tone({ type: 'sine', f0: 200, f1: 400, dur: 0.12, vol: 0.2 }); noise({ dur: 0.05, vol: 0.06, f0: 2000 }); },
  fuse() { noise({ dur: 0.12, vol: 0.05, f0: 5000, type: 'highpass' }); },
  explosion() {
    noise({ dur: 0.9, vol: 0.6, f0: 1800, f1: 60, q: 0.7 });
    tone({ type: 'sine', f0: 90, f1: 30, dur: 0.7, vol: 0.5 });
    noise({ dur: 0.25, vol: 0.3, f0: 4000, f1: 800, type: 'bandpass', delay: 0.02 });
  },
  doorOpen() { tone({ type: 'sawtooth', f0: 90, f1: 60, dur: 0.18, vol: 0.18 }); noise({ dur: 0.25, vol: 0.15, f0: 500, f1: 150 }); tone({ type: 'triangle', f0: 880, dur: 0.25, vol: 0.06, delay: 0.12 }); tone({ type: 'triangle', f0: 1175, dur: 0.35, vol: 0.06, delay: 0.2 }); },
  doorClose() { noise({ dur: 0.2, vol: 0.32, f0: 600, f1: 80 }); tone({ type: 'sine', f0: 110, f1: 45, dur: 0.22, vol: 0.35 }); },
  fanfare() {
    const notes = [392, 494, 587, 784, 740, 784];
    notes.forEach((f, i) => { tone({ type: 'square', f0: f, dur: i === 5 ? 0.5 : 0.12, vol: 0.08, delay: i * 0.1 }); tone({ type: 'triangle', f0: f / 2, dur: 0.14, vol: 0.12, delay: i * 0.1 }); });
  },
  badFanfare() { [330, 311, 294, 220].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.22, vol: 0.08, delay: i * 0.16 })); },
  roar() {
    const o = tone({ type: 'sawtooth', f0: 110, f1: 55, dur: 1.1, vol: 0.32 });
    const lfo = ctx.createOscillator(); const lg = ctx.createGain();
    lfo.frequency.value = 22; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency); lfo.start(); lfo.stop(ctx.currentTime + 1.2);
    tone({ type: 'square', f0: 82, f1: 41, dur: 1.0, vol: 0.18, detune: 15 });
    noise({ dur: 1.0, vol: 0.25, f0: 900, f1: 200, q: 2 });
  },
  slam() { noise({ dur: 0.5, vol: 0.5, f0: 600, f1: 40 }); tone({ type: 'sine', f0: 70, f1: 25, dur: 0.5, vol: 0.55 }); },
  rock() { noise({ dur: 0.25, vol: 0.32, f0: 1500, f1: 200, q: 1.5 }); tone({ type: 'triangle', f0: 140, f1: 60, dur: 0.15, vol: 0.2 }); },
  poop() { noise({ dur: 0.12, vol: 0.2, f0: 400, f1: 120, q: 3 }); },
  fireOut() { noise({ dur: 0.45, vol: 0.2, f0: 3000, f1: 600, type: 'highpass' }); },
  chest() { tone({ type: 'triangle', f0: 300, f1: 600, dur: 0.15, vol: 0.18 }); noise({ dur: 0.15, vol: 0.1, f0: 1500 }); [784, 988, 1175].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.15, vol: 0.08, delay: 0.12 + i * 0.06 })); },
  card() { noise({ dur: 0.15, vol: 0.12, f0: 4000, f1: 1500, type: 'bandpass', q: 3 }); tone({ type: 'sine', f0: 660, f1: 1320, dur: 0.3, vol: 0.12, delay: 0.05 }); },
  pill() { tone({ type: 'sine', f0: 300, f1: 900, dur: 0.15, vol: 0.15 }); tone({ type: 'sine', f0: 200, f1: 100, dur: 0.15, vol: 0.12, delay: 0.15 }); },
  active() { tone({ type: 'square', f0: 220, f1: 880, dur: 0.25, vol: 0.1 }); noise({ dur: 0.3, vol: 0.12, f0: 3000, f1: 500, type: 'bandpass' }); },
  charged() { tone({ type: 'triangle', f0: 880, dur: 0.1, vol: 0.12 }); tone({ type: 'triangle', f0: 1320, dur: 0.15, vol: 0.1, delay: 0.07 }); },
  laser() { tone({ type: 'sawtooth', f0: 140, f1: 70, dur: 0.6, vol: 0.22 }); noise({ dur: 0.6, vol: 0.2, f0: 2500, f1: 400, type: 'bandpass', q: 1.5 }); },
  clear() { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.4, vol: 0.09, delay: i * 0.07 })); },
  trapdoor() { tone({ type: 'sine', f0: 300, f1: 60, dur: 0.6, vol: 0.25 }); noise({ dur: 0.5, vol: 0.15, f0: 800, f1: 100 }); },
  select() { tone({ type: 'square', f0: 660, dur: 0.05, vol: 0.07 }); },
  back() { tone({ type: 'square', f0: 440, dur: 0.05, vol: 0.07 }); },
  bargain() { [147, 156, 147, 110].forEach((f, i) => tone({ type: 'sawtooth', f0: f, dur: 0.3, vol: 0.1, delay: i * 0.18 })); },
  chapel() { [523, 659, 784].forEach((f) => { tone({ type: 'sine', f0: f, dur: 1.2, vol: 0.07, attack: 0.3 }); tone({ type: 'sine', f0: f * 2, dur: 1.0, vol: 0.03, attack: 0.4 }); }); },
  bossDie() { SFX.roar(); setTimeout(() => ctx && SFX.explosion(), 500); },
  spawn() { noise({ dur: 0.18, vol: 0.08, f0: 800, f1: 2000, type: 'bandpass', q: 2 }); },
  burrow() { noise({ dur: 0.3, vol: 0.16, f0: 300, f1: 100 }); },
  splash() { noise({ dur: 0.3, vol: 0.18, f0: 2000, f1: 300, type: 'bandpass', q: 1 }); },
  heartbeat() { tone({ type: 'sine', f0: 60, f1: 40, dur: 0.15, vol: 0.4 }); tone({ type: 'sine', f0: 55, f1: 35, dur: 0.18, vol: 0.32, delay: 0.2 }); },
  buzz() { tone({ type: 'sawtooth', f0: 180, f1: 200, dur: 0.15, vol: 0.04, detune: rnd(-30, 30) }); },
  death() { [392, 370, 349, 330, 196].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.4, vol: 0.12, delay: i * 0.22 })); },
};

const THROTTLE = { tear: 0.03, splat: 0.03, hit: 0.03, coin: 0.04, enemyShot: 0.04, buzz: 0.25, fuse: 0.1 };

export const audio = {
  unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
  play(name) {
    if (!ctx || state.mute || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const th = THROTTLE[name] || 0.015;
    if (lastPlayed[name] && now - lastPlayed[name] < th) return;
    lastPlayed[name] = now;
    try { SFX[name] && SFX[name](); } catch (e) { /* never let audio break the game */ }
  },
  setVolumes(v) { Object.assign(state, v); applyVolumes(); },
  /** Start a slow generative drone for a floor: [f1, f2] base frequencies. */
  setDrone(freqs) {
    if (!ctx) return;
    this.stopDrone();
    const t = ctx.currentTime;
    const out = ctx.createGain(); out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.5, t + 3);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 380; filt.Q.value = 3;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 220; lfo.connect(lg); lg.connect(filt.frequency); lfo.start();
    filt.connect(out); out.connect(musicBus);
    const oscs = [lfo];
    freqs.forEach((f, i) => {
      for (const det of [-7, 6]) {
        const o = ctx.createOscillator(); o.type = i ? 'triangle' : 'sawtooth';
        o.frequency.value = f; o.detune.value = det + i * 3;
        const g = ctx.createGain(); g.gain.value = i ? 0.12 : 0.16;
        o.connect(g); g.connect(filt); o.start(); oscs.push(o);
      }
    });
    // a sparse, eerie melodic plink every few seconds
    const notes = [1, 1.2, 1.5, 1.335, 1.78, 2, 0.75];
    const timer = setInterval(() => {
      if (!ctx || state.mute || Math.random() < 0.35) return;
      const f = freqs[0] * 4 * notes[Math.floor(Math.random() * notes.length)];
      tone({ type: 'sine', f0: f, f1: f * 0.995, dur: 2.2, vol: 0.05, attack: 0.02, out: musicBus });
    }, 2600);
    drone = { out, oscs, timer };
  },
  stopDrone() {
    if (!drone || !ctx) return;
    const d = drone; drone = null;
    clearInterval(d.timer);
    const t = ctx.currentTime;
    d.out.gain.cancelScheduledValues(t);
    d.out.gain.setValueAtTime(d.out.gain.value, t);
    d.out.gain.linearRampToValueAtTime(0, t + 1);
    setTimeout(() => d.oscs.forEach((o) => { try { o.stop(); } catch { /* */ } }), 1200);
  },
};
