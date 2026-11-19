// Enemy art. Each entry: { w, h (canvas px), frames, draw(ctx, w, h, rng, frame) }.
// World size = canvas px / 64 unless the enemy def overrides it.
import { tex, blob, poly, scribble, dot, eye, glow, shade, rgba, INK, wobEllipse, crayonFill, ink, mirrorTex } from './draw.js';

const SKIN = '#c9b0a0', PALE = '#d8c8b8', ROT = '#8a9a6a', BLOOD = '#8a1414', BONE = '#e6dcc4';

function wings(ctx, x, y, rng, f, s = 1) {
  const up = f % 2 ? -4 : 2;
  for (const d of [-1, 1]) {
    ctx.save(); ctx.globalAlpha = 0.75;
    blob(ctx, x + d * 9 * s, y - 6 * s + up, 8 * s, 5 * s, '#dfe8f0', rng, { lw: 1.6, hatch: 0, rot: d * 0.5 });
    ctx.restore();
  }
}
function legs(ctx, x, y, n, len, rng, f, color = INK) {
  for (let i = 0; i < n; i++) {
    for (const d of [-1, 1]) {
      const a = (i / (n - 1) - 0.5) * 1.6;
      const k = ((f + i) % 2) * 3;
      scribble(ctx, [[x, y], [x + d * len * 0.6, y - 4 + a * 6 - k], [x + d * len, y + 4 + a * 10]], 2.4, color, rng);
    }
  }
}
function mouth(ctx, x, y, w, h, rng, teeth = true) {
  blob(ctx, x, y, w, h, '#3a0a0a', rng, { lw: 2.2, hatch: 0 });
  if (teeth) for (let i = 0; i < 3; i++) poly(ctx, [[x - w * 0.6 + i * w * 0.6 - 2, y - h * 0.7], [x - w * 0.6 + i * w * 0.6, y - h * 0.1], [x - w * 0.6 + i * w * 0.6 + 2, y - h * 0.7]], BONE, rng, { lw: 1, hatch: 0, jit: 0.3 });
}
function hollowEyes(ctx, x, y, sp, r, rng, tear = BLOOD) {
  for (const d of [-1, 1]) {
    blob(ctx, x + d * sp, y, r, r * 1.15, '#140808', rng, { lw: 2, hatch: 0 });
    ctx.strokeStyle = rgba(tear, 0.8); ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x + d * sp, y + r); ctx.lineTo(x + d * sp + rng.range(-2, 2), y + r + 8); ctx.stroke();
  }
}

export const ENEMY_ART = {
  gnat: { w: 48, h: 48, frames: 2, draw(ctx, w, h, rng, f) {
    wings(ctx, w / 2, h / 2, rng, f, 0.9);
    blob(ctx, w / 2, h / 2 + 2, 8, 7, '#2a2224', rng, { lw: 2.2, hatch: 0.2 });
    dot(ctx, w / 2 - 3, h / 2, 2.2, '#c83030'); dot(ctx, w / 2 + 3, h / 2, 2.2, '#c83030');
  } },
  twitchfly: { w: 48, h: 48, frames: 2, draw(ctx, w, h, rng, f) {
    wings(ctx, w / 2, h / 2, rng, f, 1);
    blob(ctx, w / 2, h / 2 + 2, 9, 8, '#5a2a1a', rng, { lw: 2.2, hatch: 0.2 });
    poly(ctx, [[w / 2 - 3, h / 2 + 9], [w / 2, h / 2 + 15], [w / 2 + 3, h / 2 + 9]], '#3a1a0a', rng, { lw: 1.5, hatch: 0 });
    eye(ctx, w / 2 - 3, h / 2, 3, rng, f ? 0.5 : -0.5, 0, { lw: 1.2 }); eye(ctx, w / 2 + 3, h / 2, 3, rng, f ? -0.5 : 0.5, 0, { lw: 1.2 });
  } },
  halogn: { w: 44, h: 44, frames: 2, draw(ctx, w, h, rng, f) {
    wings(ctx, w / 2, h / 2, rng, f, 0.8);
    blob(ctx, w / 2, h / 2 + 2, 7, 7, '#e8d890', rng, { lw: 2, hatch: 0.1 });
    ctx.strokeStyle = '#fff2a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(w / 2, h / 2 - 8, 6, 2, 0, 0, 7); ctx.stroke();
    dot(ctx, w / 2 - 2, h / 2 + 1, 1.6, INK); dot(ctx, w / 2 + 2, h / 2 + 1, 1.6, INK);
  } },
  bloat: { w: 80, h: 80, frames: 2, draw(ctx, w, h, rng, f) {
    wings(ctx, w / 2, h / 2 - 4, rng, f, 1.6);
    blob(ctx, w / 2, h / 2 + 6, 22, 20 + f, '#6a5a3a', rng, { lw: 3, hatch: 0.3 });
    blob(ctx, w / 2 + 4, h / 2 + 12, 10, 8, '#8a7a4a', rng, { lw: 2, hatch: 0.1 });
    hollowEyes(ctx, w / 2, h / 2, 8, 4, rng, '#6a8a2a');
    mouth(ctx, w / 2, h / 2 + 12, 6, 4, rng, false);
  } },
  moaner: { w: 64, h: 72, frames: 4, mirror: true, draw(ctx, w, h, rng, f) {
    const st = [0, 1, 0, -1][f];
    for (const d of [-1, 1]) poly(ctx, [[w / 2 + d * 7 - 3, h - 22], [w / 2 + d * 7 + 3, h - 22], [w / 2 + d * 7 + 3 + d * st, h - 4 - st * d * 2], [w / 2 + d * 7 - 3 + d * st, h - 4 - st * d * 2]], SKIN, rng, { lw: 2.2, hatch: 0 });
    poly(ctx, [[w / 2 - 12, h - 20], [w / 2 - 10, h - 40], [w / 2 + 10, h - 40], [w / 2 + 12, h - 20]], '#7a6a5a', rng, { lw: 2.6, hatch: 0.3 });
    for (const d of [-1, 1]) scribble(ctx, [[w / 2 + d * 11, h - 38], [w / 2 + d * 18, h - 30 + st * d], [w / 2 + d * 20, h - 22]], 4, SKIN, rng);
    blob(ctx, w / 2, h - 50, 16, 15, PALE, rng, { lw: 3, hatch: 0.15 });
    hollowEyes(ctx, w / 2, h - 52, 6, 4, rng);
    blob(ctx, w / 2, h - 41, 5, 4 + (f % 2), '#2a0a0a', rng, { lw: 2, hatch: 0 });
  } },
  sprinter: { w: 64, h: 72, frames: 4, mirror: true, draw(ctx, w, h, rng, f) {
    const st = [0, 2, 0, -2][f];
    for (const d of [-1, 1]) poly(ctx, [[w / 2 + d * 7 - 3, h - 22], [w / 2 + d * 7 + 3, h - 22], [w / 2 + d * 7 + 3 + d * st, h - 4], [w / 2 + d * 7 - 3 + d * st, h - 4]], '#b8a090', rng, { lw: 2.2, hatch: 0 });
    poly(ctx, [[w / 2 - 12, h - 20], [w / 2 - 10, h - 40], [w / 2 + 10, h - 40], [w / 2 + 12, h - 20]], '#5a3a3a', rng, { lw: 2.6, hatch: 0.3 });
    for (const d of [-1, 1]) scribble(ctx, [[w / 2 + d * 11, h - 38], [w / 2 + d * 20, h - 44 + st], [w / 2 + d * 24, h - 50]], 4, '#b8a090', rng);
    blob(ctx, w / 2, h - 50, 16, 15, '#c8a898', rng, { lw: 3, hatch: 0.15 });
    for (const d of [-1, 1]) { eye(ctx, w / 2 + d * 6, h - 53, 4, rng, 0, 0.3, { lw: 1.6 }); scribble(ctx, [[w / 2 + d * 10, h - 60], [w / 2 + d * 2, h - 57]], 2.2, INK, rng); }
    mouth(ctx, w / 2, h - 41, 7, 4, rng);
  } },
  tusk: { w: 88, h: 72, frames: 3, mirror: true, draw(ctx, w, h, rng, f) {
    // a rooting boar-pig made of dirt and tusks
    const st = f === 2 ? 0 : f ? 2 : -2;
    for (const x of [22, 34, 54, 66]) poly(ctx, [[x - 3, h - 20], [x + 3, h - 20], [x + 3 + st, h - 4], [x - 3 + st, h - 4]], '#4a3020', rng, { lw: 2, hatch: 0 });
    blob(ctx, w / 2, h - 30, 32, 17, '#7a5a3a', rng, { lw: 3, hatch: 0.35 });
    blob(ctx, w - 20, h - 34, 15, 13, '#8a6a4a', rng, { lw: 3, hatch: 0.2 });
    poly(ctx, [[w - 14, h - 28], [w - 2, h - 38], [w - 8, h - 26]], BONE, rng, { lw: 2, hatch: 0 });
    dot(ctx, w - 16, h - 40, 3, f === 2 ? '#ff3030' : INK);
    blob(ctx, w - 8, h - 32, 5, 4, '#a0705a', rng, { lw: 2, hatch: 0 });
    for (let i = 0; i < 5; i++) scribble(ctx, [[24 + i * 8, h - 46], [26 + i * 8, h - 52]], 2, INK, rng);
  } },
  pipe: { w: 64, h: 64, frames: 2, draw(ctx, w, h, rng, f) {
    // a rusted drain pipe stub with a wet mouth on top
    poly(ctx, [[14, h - 6], [16, h - 40], [48, h - 40], [50, h - 6]], '#6a5040', rng, { lw: 3, hatch: 0.3 });
    blob(ctx, w / 2, h - 40, 18, 7, '#8a6a50', rng, { lw: 3, hatch: 0.2 });
    blob(ctx, w / 2, h - 41, 12 + f * 3, 4 + f * 2, '#2a0606', rng, { lw: 2, hatch: 0 });
    for (const d of [-1, 1]) eye(ctx, w / 2 + d * 9, h - 24, 4, rng, 0, 0.2, { lw: 1.6, iris: '#a02020' });
    for (let i = 0; i < 3; i++) dot(ctx, 18 + i * 13, h - 12, 2, '#3a2a20');
  } },
  wellspout: { w: 72, h: 72, frames: 2, draw(ctx, w, h, rng, f) {
    blob(ctx, w / 2, h - 18, 26, 14, '#5a6a6a', rng, { lw: 3, hatch: 0.3 });
    blob(ctx, w / 2, h - 30, 20, 16 + f * 2, '#7a8a8a', rng, { lw: 3, hatch: 0.25 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; dot(ctx, w / 2 + Math.cos(a) * 14, h - 30 + Math.sin(a) * 10, 2.4, '#1a2a2a'); }
    eye(ctx, w / 2, h - 32, 7, rng, 0, 0, { iris: '#3a7a7a', lw: 2 });
  } },
  peeper: { w: 64, h: 64, frames: 2, draw(ctx, w, h, rng, f) {
    // a lumpy sack that is mostly one huge eye
    blob(ctx, w / 2, h - 24, 22, 19, '#9a7a8a', rng, { lw: 3, hatch: 0.3 });
    eye(ctx, w / 2, h - 28, 13, rng, 0, f ? 0.3 : 0, { iris: '#7a1a1a', lw: 2.4 });
    for (let i = 0; i < 4; i++) scribble(ctx, [[w / 2 - 14 + i * 9, h - 8], [w / 2 - 15 + i * 9, h - 2]], 3, '#6a4a5a', rng);
  } },
  tick: { w: 56, h: 56, frames: 2, draw(ctx, w, h, rng, f) {
    legs(ctx, w / 2, h - 18, 3, 16, rng, f, '#3a1a1a');
    blob(ctx, w / 2, h - 20, 14, 11, '#6a2a2a', rng, { lw: 2.6, hatch: 0.3 });
    blob(ctx, w / 2, h - 28, 7, 5, '#4a1a1a', rng, { lw: 2, hatch: 0 });
    dot(ctx, w / 2 - 3, h - 29, 1.8, '#ffd040'); dot(ctx, w / 2 + 3, h - 29, 1.8, '#ffd040');
  } },
  toadsack: { w: 96, h: 88, frames: 2, draw(ctx, w, h, rng, f) {
    blob(ctx, w / 2, h - 30, 36, 26 - f * 4, '#6a7a3a', rng, { lw: 3.2, hatch: 0.3 });
    for (let i = 0; i < 6; i++) blob(ctx, w / 2 - 22 + i * 9, h - 38 + (i % 2) * 8, 4, 4, '#8a9a4a', rng, { lw: 1.5, hatch: 0 });
    for (const d of [-1, 1]) eye(ctx, w / 2 + d * 14, h - 50 + f * 4, 7, rng, 0, 0.3, { iris: '#c8a020', lw: 2, lid: 0.3, lidColor: '#6a7a3a' });
    scribble(ctx, [[w / 2 - 22, h - 26], [w / 2, h - 20], [w / 2 + 22, h - 26]], 3, INK, rng);
    for (const d of [-1, 1]) poly(ctx, [[w / 2 + d * 26, h - 14], [w / 2 + d * 40, h - 6], [w / 2 + d * 22, h - 4]], '#5a6a2a', rng, { lw: 2.4 });
  } },
  molemite: { w: 64, h: 64, frames: 3, draw(ctx, w, h, rng, f) {
    // f0 dirt mound, f1 emerging, f2 up
    blob(ctx, w / 2, h - 12, 24, 9, '#4a3a2a', rng, { lw: 2.6, hatch: 0.35 });
    if (f === 0) { for (let i = 0; i < 4; i++) dot(ctx, w / 2 - 12 + i * 8, h - 16, 2.5, '#2a1a10'); return; }
    const up = f === 1 ? 10 : 22;
    blob(ctx, w / 2, h - 12 - up, 14, up * 0.7 + 4, '#8a6a7a', rng, { lw: 2.6, hatch: 0.2 });
    for (const d of [-1, 1]) dot(ctx, w / 2 + d * 5, h - 18 - up, 2.5, INK);
    blob(ctx, w / 2, h - 10 - up * 0.6, 5, 3, '#ffc0c0', rng, { lw: 1.6, hatch: 0 });
    blob(ctx, w / 2, h - 12, 24, 7, '#4a3a2a', rng, { lw: 2.6, hatch: 0.35 });
  } },
  spider: { w: 48, h: 48, frames: 2, draw(ctx, w, h, rng, f) {
    legs(ctx, w / 2, h / 2 + 4, 4, 15, rng, f);
    blob(ctx, w / 2, h / 2 + 4, 9, 7, '#2a2020', rng, { lw: 2.2, hatch: 0.2 });
    dot(ctx, w / 2 - 3, h / 2 + 2, 2, '#e04040'); dot(ctx, w / 2 + 3, h / 2 + 2, 2, '#e04040');
  } },
  broodsp: { w: 80, h: 72, frames: 2, draw(ctx, w, h, rng, f) {
    legs(ctx, w / 2, h / 2 + 6, 4, 26, rng, f, '#2a1a1a');
    blob(ctx, w / 2, h / 2 + 12, 20, 15, '#4a3a3a', rng, { lw: 3, hatch: 0.3 });
    blob(ctx, w / 2, h / 2 - 2, 12, 9, '#3a2a2a', rng, { lw: 2.6, hatch: 0.2 });
    for (let i = 0; i < 6; i++) dot(ctx, w / 2 - 7 + (i % 3) * 7, h / 2 - 4 + Math.floor(i / 3) * 4, 1.8, '#ff5050');
    for (let i = 0; i < 4; i++) blob(ctx, w / 2 - 10 + i * 7, h / 2 + 14, 3, 3, '#e8e0c8', rng, { lw: 1.2, hatch: 0 });
  } },
  clot: { w: 72, h: 64, frames: 2, draw(ctx, w, h, rng, f) {
    blob(ctx, w / 2, h - 22, 24 + f * 2, 18 - f * 2, '#8a1a1a', rng, { lw: 3, hatch: 0.25, wob: 0.15 });
    blob(ctx, w / 2 - 8, h - 30, 6, 4, '#c84040', rng, { lw: 0, ink: false, hatch: 0 });
    hollowEyes(ctx, w / 2, h - 26, 8, 3.5, rng, '#3a0000');
    blob(ctx, w / 2, h - 16, 6, 3, '#2a0000', rng, { lw: 1.6, hatch: 0 });
  } },
  clotlet: { w: 44, h: 40, frames: 2, draw(ctx, w, h, rng, f) {
    blob(ctx, w / 2, h - 14, 13 + f, 10 - f, '#a02020', rng, { lw: 2.4, hatch: 0.2, wob: 0.15 });
    dot(ctx, w / 2 - 4, h - 16, 2.2, INK); dot(ctx, w / 2 + 4, h - 16, 2.2, INK);
  } },
  gasbag: { w: 72, h: 80, frames: 2, draw(ctx, w, h, rng, f) {
    blob(ctx, w / 2, h / 2, 24 + f * 2, 22 + f * 2, '#9aa83a', rng, { lw: 3, hatch: 0.3 });
    for (let i = 0; i < 5; i++) blob(ctx, w / 2 - 14 + rng.range(0, 28), h / 2 - 12 + rng.range(0, 24), 3, 3, '#c8d860', rng, { lw: 1.2, hatch: 0 });
    for (const d of [-1, 1]) { scribble(ctx, [[w / 2 + d * 10, h / 2 - 6], [w / 2 + d * 4, h / 2 - 2]], 2.4, INK, rng); scribble(ctx, [[w / 2 + d * 4, h / 2 - 6], [w / 2 + d * 10, h / 2 - 2]], 2.4, INK, rng); }
    scribble(ctx, [[w / 2 - 6, h / 2 + 10], [w / 2, h / 2 + 7], [w / 2 + 6, h / 2 + 10]], 2.4, INK, rng);
    scribble(ctx, [[w / 2, h / 2 + 24], [w / 2 + 3, h / 2 + 32], [w / 2 - 2, h / 2 + 38]], 2, '#5a6a1a', rng);
  } },
  drooler: { w: 72, h: 72, frames: 4, mirror: true, draw(ctx, w, h, rng, f) {
    const st = [0, 1, 0, -1][f];
    for (const d of [-1, 1]) poly(ctx, [[w / 2 + d * 8 - 3, h - 18], [w / 2 + d * 8 + 3, h - 18], [w / 2 + d * 8 + 3 + st, h - 4], [w / 2 + d * 8 - 3 + st, h - 4]], '#7a8a5a', rng, { lw: 2.2, hatch: 0 });
    blob(ctx, w / 2, h - 30, 20, 16, '#7a8a5a', rng, { lw: 3, hatch: 0.3 });
    blob(ctx, w / 2, h - 50, 14, 13, '#a0b080', rng, { lw: 3, hatch: 0.2 });
    hollowEyes(ctx, w / 2, h - 52, 5, 3.5, rng, '#c8d040');
    blob(ctx, w / 2, h - 42, 6, 4, '#3a3a0a', rng, { lw: 2, hatch: 0 });
    ctx.fillStyle = 'rgba(200,210,60,0.8)'; ctx.beginPath(); ctx.ellipse(w / 2, h - 34 + f, 3, 6 + f, 0, 0, 7); ctx.fill();
  } },
  spitter: { w: 64, h: 72, frames: 4, mirror: true, draw(ctx, w, h, rng, f) {
    const st = [0, 1, 0, -1][f];
    for (const d of [-1, 1]) poly(ctx, [[w / 2 + d * 7 - 3, h - 22], [w / 2 + d * 7 + 3, h - 22], [w / 2 + d * 7 + 3 + st, h - 4], [w / 2 + d * 7 - 3 + st, h - 4]], '#9a7a6a', rng, { lw: 2.2, hatch: 0 });
    poly(ctx, [[w / 2 - 12, h - 20], [w / 2 - 10, h - 40], [w / 2 + 10, h - 40], [w / 2 + 12, h - 20]], '#4a4a6a', rng, { lw: 2.6, hatch: 0.3 });
    blob(ctx, w / 2, h - 50, 16, 15, '#c8a090', rng, { lw: 3, hatch: 0.15 });
    for (const d of [-1, 1]) dot(ctx, w / 2 + d * 6, h - 54, 3, INK);
    blob(ctx, w / 2, h - 42, 7, 6, '#4a0a0a', rng, { lw: 2.2, hatch: 0 });
    blob(ctx, w / 2 - 4, h - 40, 3, 4, BLOOD, rng, { lw: 1, hatch: 0 });
  } },
  hive: { w: 80, h: 80, frames: 2, draw(ctx, w, h, rng, f) {
    blob(ctx, w / 2, h - 30, 26, 28, '#8a6a3a', rng, { lw: 3, hatch: 0.35 });
    for (let i = 0; i < 4; i++) scribble(ctx, [[w / 2 - 24, h - 48 + i * 10], [w / 2 + 24, h - 46 + i * 10]], 2, rgba(INK, 0.6), rng);
    for (let i = 0; i < 5; i++) blob(ctx, w / 2 - 14 + (i % 3) * 14, h - 44 + Math.floor(i / 3) * 18, 4, 4 + f, '#1a0a0a', rng, { lw: 1.6, hatch: 0 });
  } },
  draft: { w: 64, h: 72, frames: 2, draw(ctx, w, h, rng, f) {
    ctx.globalAlpha = 0.85;
    poly(ctx, [[w / 2 - 18, h / 2], [w / 2 - 14, h - 10 - f * 3], [w / 2 - 6, h - 16], [w / 2, h - 6 - f * 2], [w / 2 + 6, h - 16], [w / 2 + 14, h - 10 + f * 2], [w / 2 + 18, h / 2]], '#c8d0e0', rng, { lw: 2.4, hatch: 0.1 });
    blob(ctx, w / 2, h / 2 - 4, 18, 18, '#d8e0ec', rng, { lw: 2.6, hatch: 0.1 });
    blob(ctx, w / 2 - 7, h / 2 - 6, 4, 6, '#1a1a2a', rng, { lw: 1.6, hatch: 0 });
    blob(ctx, w / 2 + 7, h / 2 - 6, 4, 6, '#1a1a2a', rng, { lw: 1.6, hatch: 0 });
    blob(ctx, w / 2, h / 2 + 6, 4, 5, '#1a1a2a', rng, { lw: 1.6, hatch: 0 });
  } },
  wailhead: { w: 72, h: 72, frames: 2, draw(ctx, w, h, rng, f) {
    blob(ctx, w / 2, h / 2, 24, 22, '#b8a8a0', rng, { lw: 3, hatch: 0.2 });
    for (let i = 0; i < 6; i++) scribble(ctx, [[w / 2 - 20 + i * 8, h / 2 - 20], [w / 2 - 24 + i * 9, h / 2 - 32 - (i % 2) * 4]], 2.4, '#3a2a2a', rng);
    hollowEyes(ctx, w / 2, h / 2 - 4, 9, 5, rng, '#8a1a1a');
    blob(ctx, w / 2, h / 2 + 11, 7, 6 + f * 3, '#1a0606', rng, { lw: 2.4, hatch: 0 });
  } },
  grub: { w: 72, h: 48, frames: 2, mirror: true, facesLeft: true, draw(ctx, w, h, rng, f) {
    for (let i = 0; i < 4; i++) blob(ctx, 18 + i * 12, h - 16 - (i + f) % 2 * 2, 10 - i, 9 - i * 0.5, i ? '#d8c8a8' : '#e8d8b8', rng, { lw: 2.2, hatch: 0.15 });
    dot(ctx, 14, h - 19, 2, INK); dot(ctx, 20, h - 19, 2, INK);
    blob(ctx, 11, h - 13, 3, 2, '#5a2a2a', rng, { lw: 1, hatch: 0 });
  } },
  leech: { w: 64, h: 40, frames: 2, mirror: true, facesLeft: true, draw(ctx, w, h, rng, f) {
    blob(ctx, w / 2, h - 14, 24 - f * 2, 8 + f, '#3a1a2a', rng, { lw: 2.4, hatch: 0.3 });
    blob(ctx, w / 2 - 20, h - 14, 6, 6, '#5a2a3a', rng, { lw: 2, hatch: 0 });
    blob(ctx, w / 2 - 22, h - 14, 3, 3, '#c83030', rng, { lw: 1, hatch: 0 });
    for (let i = 0; i < 4; i++) scribble(ctx, [[w / 2 - 10 + i * 7, h - 20], [w / 2 - 10 + i * 7, h - 8]], 1.4, rgba('#8a5a6a', 0.7), rng);
  } },
  shellback: { w: 80, h: 80, frames: 2, mirror: true, draw(ctx, w, h, rng, f) {
    // a hunched thing hiding behind a cracked bathtub-enamel shield
    const st = f ? 2 : -2;
    for (const d of [-1, 1]) poly(ctx, [[w / 2 + d * 8 - 3, h - 20], [w / 2 + d * 8 + 3, h - 20], [w / 2 + d * 8 + 3 + st, h - 4], [w / 2 + d * 8 - 3 + st, h - 4]], '#5a4a4a', rng, { lw: 2.2, hatch: 0 });
    blob(ctx, w / 2 - 4, h - 38, 18, 20, '#6a5a5a', rng, { lw: 3, hatch: 0.3 });
    dot(ctx, w / 2 - 8, h - 48, 3, '#ff6030');
    poly(ctx, [[w / 2 + 8, h - 66], [w / 2 + 28, h - 58], [w / 2 + 28, h - 14], [w / 2 + 8, h - 8]], '#d8d4c8', rng, { lw: 3, hatch: 0.2 });
    scribble(ctx, [[w / 2 + 14, h - 50], [w / 2 + 20, h - 40], [w / 2 + 16, h - 30]], 1.6, INK, rng);
  } },
  bonethrow: { w: 64, h: 76, frames: 3, mirror: true, draw(ctx, w, h, rng, f) {
    const st = [0, 2, 0][f];
    for (const d of [-1, 1]) scribble(ctx, [[w / 2 + d * 5, h - 24], [w / 2 + d * 7 + st * d, h - 4]], 3.5, BONE, rng);
    poly(ctx, [[w / 2 - 9, h - 24], [w / 2 - 8, h - 44], [w / 2 + 8, h - 44], [w / 2 + 9, h - 24]], '#4a3a3a', rng, { lw: 2.4, hatch: 0.3 });
    for (let i = 0; i < 3; i++) scribble(ctx, [[w / 2 - 7, h - 40 + i * 5], [w / 2 + 7, h - 40 + i * 5]], 1.6, BONE, rng);
    scribble(ctx, [[w / 2 + 9, h - 42], [w / 2 + 18, h - (f === 2 ? 60 : 36)]], 3.5, BONE, rng);
    blob(ctx, w / 2, h - 54, 13, 12, BONE, rng, { lw: 2.6, hatch: 0.15 });
    blob(ctx, w / 2 - 5, h - 56, 3.5, 4, '#1a1010', rng, { lw: 1.4, hatch: 0 }); blob(ctx, w / 2 + 5, h - 56, 3.5, 4, '#1a1010', rng, { lw: 1.4, hatch: 0 });
    scribble(ctx, [[w / 2 - 5, h - 47], [w / 2 + 5, h - 47]], 2, INK, rng);
  } },
  ember: { w: 56, h: 64, frames: 3, draw(ctx, w, h, rng, f) {
    glow(ctx, w / 2, h / 2 + 4, 26, '#ff8a2a', 0.5);
    poly(ctx, [[w / 2 - 14, h / 2 + 12], [w / 2 - 6 + f * 2, h / 2 - 20], [w / 2, h / 2 - 4], [w / 2 + 6 - f * 2, h / 2 - 24], [w / 2 + 14, h / 2 + 12]], '#ff7a1a', rng, { lw: 2.4, hatch: 0.1, jit: 2.5 });
    blob(ctx, w / 2, h / 2 + 10, 12, 10, '#ffc040', rng, { lw: 2.2, hatch: 0 });
    dot(ctx, w / 2 - 4, h / 2 + 8, 2.4, INK); dot(ctx, w / 2 + 4, h / 2 + 8, 2.4, INK);
  } },
  nun: { w: 72, h: 88, frames: 2, draw(ctx, w, h, rng, f) {
    poly(ctx, [[w / 2 - 20, h - 4], [w / 2 - 14, h - 56], [w / 2 + 14, h - 56], [w / 2 + 20, h - 4]], '#1a1a22', rng, { lw: 3, hatch: 0.2 });
    blob(ctx, w / 2, h - 60, 16, 17, '#26262e', rng, { lw: 3, hatch: 0.2 });
    blob(ctx, w / 2, h - 58, 10, 12, '#e8e0d8', rng, { lw: 2.4, hatch: 0.1 });
    blob(ctx, w / 2, h - 58, 6, 8, '#0a0a0a', rng, { lw: 1.6, hatch: 0 });
    if (f) glow(ctx, w / 2, h - 58, 16, '#a040ff', 0.6);
    scribble(ctx, [[w / 2, h - 44], [w / 2, h - 28]], 3, '#c8b040', rng); scribble(ctx, [[w / 2 - 6, h - 38], [w / 2 + 6, h - 38]], 3, '#c8b040', rng);
  } },
  nightcrawl: { w: 72, h: 72, frames: 3, draw(ctx, w, h, rng, f) {
    blob(ctx, w / 2, h - 12, 24, 9, '#3a2a2a', rng, { lw: 2.6, hatch: 0.35 });
    if (f === 0) return;
    const up = f === 1 ? 14 : 34;
    for (let i = 0; i < 4; i++) blob(ctx, w / 2 + Math.sin(i) * 3, h - 14 - i * up / 4, 10 - i, 8, '#b06a7a', rng, { lw: 2.4, hatch: 0.2 });
    blob(ctx, w / 2, h - 16 - up, 11, 10, '#c07a8a', rng, { lw: 2.6, hatch: 0.15 });
    mouth(ctx, w / 2, h - 14 - up, 7, 6, rng);
  } },
  kilnimp: { w: 64, h: 72, frames: 2, mirror: true, draw(ctx, w, h, rng, f) {
    for (const d of [-1, 1]) scribble(ctx, [[w / 2 + d * 5, h - 22], [w / 2 + d * 9, h - 4 - f * 2]], 3.5, '#5a1a10', rng);
    blob(ctx, w / 2, h - 30, 13, 12, '#8a2a1a', rng, { lw: 2.6, hatch: 0.3 });
    blob(ctx, w / 2, h - 48, 14, 12, '#a8382a', rng, { lw: 2.8, hatch: 0.2 });
    for (const d of [-1, 1]) poly(ctx, [[w / 2 + d * 8, h - 56], [w / 2 + d * 16, h - 70], [w / 2 + d * 12, h - 54]], '#2a0a0a', rng, { lw: 2 });
    dot(ctx, w / 2 - 5, h - 50, 2.6, '#ffd040'); dot(ctx, w / 2 + 5, h - 50, 2.6, '#ffd040');
    scribble(ctx, [[w / 2 - 6, h - 42], [w / 2 + 6, h - 42]], 2.4, INK, rng);
    glow(ctx, w / 2 + 14, h - 30, 10, '#ff9a2a', f ? 0.9 : 0.4);
  } },
};

/** Texture for an enemy frame (mirrored when facing left) */
export function enemyTex(type, frame, left = false) {
  const art = ENEMY_ART[type];
  const f = frame % art.frames;
  const t = tex(`enemy:${type}:${f}`, art.w, art.h, (ctx, w, h, rng) => art.draw(ctx, w, h, rng, f));
  return left && art.mirror ? mirrorTex(`enemy:${type}:${f}`, t) : t;
}
