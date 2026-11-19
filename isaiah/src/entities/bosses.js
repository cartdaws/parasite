// Bosses: 8 floor bosses (2 phases each) + The Housemother (final).
// Bosses are Enemy instances registered into DEFS / ENEMY_ART at load time.
import { CFG } from '../config.js';
import { S } from '../state.js';
import { audio } from '../core/audio.js';
import { fxRng } from '../core/rng.js';
import { DEFS, spawnEnemy, Enemy } from './enemies.js';
import { ENEMY_ART, enemyTex } from '../render/art_enemies.js';
import { tex, blob, poly, scribble, dot, eye, glow, shade, rgba, INK, wobEllipse } from '../render/draw.js';
import { makeFlat, freeFlat, placeFlat, makeSprite, freeSprite, place, setTex, addShake, glowTex } from '../render/gfx.js';
import { enemyShot, spawnLaser, angleTo } from './tears.js';
import { creep, particles, gore, explosionFx, poof } from './effects.js';
import { M_WALK } from '../world/room.js';

const TAU = Math.PI * 2;

// ---- telegraph: a red circle / strip on the floor that fills before an attack -----
function markTex(kind) {
  return tex('mark:' + kind, 64, 64, (ctx, w, h) => {
    if (kind === 'strip') { ctx.fillStyle = 'rgba(200,20,20,0.45)'; ctx.fillRect(0, 8, w, h - 16); ctx.strokeStyle = 'rgba(255,60,60,0.9)'; ctx.lineWidth = 3; ctx.strokeRect(1, 9, w - 2, h - 18); return; }
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(10,0,0,0.75)'); g.addColorStop(0.8, 'rgba(60,0,0,0.55)'); g.addColorStop(1, 'rgba(200,30,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, 7); ctx.fill();
  });
}
function telegraph(x, z, w, d, dur, kind = 'circle') {
  const m = { x, z, t: 0, dur, alive: true, persist: false };
  m.mesh = makeFlat(markTex(kind), w, d, 360);
  placeFlat(m.mesh, x, z, 0.02);
  m.update = function (dt) { this.t += dt; const k = Math.min(1, this.t / this.dur); this.mesh.material.opacity = 0.3 + k * 0.7; if (kind === 'circle') this.mesh.scale.set(w * (0.4 + 0.6 * k), 1, d * (0.4 + 0.6 * k)); if (this.t >= this.dur) this.destroy(); };
  m.sync = () => {};
  m.destroy = function () { freeFlat(this.mesh); this.alive = false; };
  S.misc.push(m);
  return m;
}

// ---- boss art ----------------------------------------------------------------------
const ART = {
  lump: { w: 192, h: 160, frames: 3, draw(ctx, w, h, rng, f) {
    const sq = [0, 6, -8][f];
    blob(ctx, w / 2, h - 52 + sq / 2, 80 + sq, 50 - sq, '#8a6a5a', rng, { lw: 4, hatch: 0.35, wob: 0.1 });
    for (let i = 0; i < 7; i++) blob(ctx, w / 2 - 55 + rng.range(0, 110), h - 70 + rng.range(-20, 25), rng.range(5, 10), rng.range(4, 8), '#a8806a', rng, { lw: 2, hatch: 0 });
    for (const d of [-1, 1]) eye(ctx, w / 2 + d * 26, h - 76 + sq / 2, 12, rng, 0, 0.3, { iris: '#c8a020', lw: 3, lid: f === 2 ? 0 : 0.35, lidColor: '#8a6a5a' });
    blob(ctx, w / 2, h - 40 + sq / 2, f === 2 ? 26 : 30, f === 2 ? 18 : 8, '#3a0a0a', rng, { lw: 3, hatch: 0 });
    for (let i = 0; i < 5; i++) poly(ctx, [[w / 2 - 22 + i * 11, h - 46 + sq / 2], [w / 2 - 18 + i * 11, h - 36 + sq / 2], [w / 2 - 14 + i * 11, h - 46 + sq / 2]], '#e6dcc4', rng, { lw: 1.4, hatch: 0, jit: 0.4 });
  } },
  mildew: { w: 176, h: 176, frames: 2, draw(ctx, w, h, rng, f) {
    for (const d of [-1, 1]) for (let k = 0; k < 2; k++) { ctx.save(); ctx.globalAlpha = 0.7; blob(ctx, w / 2 + d * (44 + k * 14), h / 2 - 30 + (f ? -8 : 2) + k * 20, 34 - k * 8, 18 - k * 4, '#d8e0d0', rng, { lw: 2.4, hatch: 0.1, rot: d * 0.5 }); ctx.restore(); }
    blob(ctx, w / 2, h / 2 + 10, 50, 46, '#5a6a4a', rng, { lw: 4, hatch: 0.35 });
    for (let i = 0; i < 9; i++) blob(ctx, w / 2 - 34 + rng.range(0, 68), h / 2 - 10 + rng.range(0, 50), rng.range(4, 9), rng.range(4, 9), '#9aaa7a', rng, { lw: 1.6, hatch: 0 });
    for (let i = 0; i < 6; i++) blob(ctx, w / 2 - 24 + (i % 3) * 24, h / 2 + 18 + Math.floor(i / 3) * 18, 6, 6, '#1a0a0a', rng, { lw: 2, hatch: 0 });
    blob(ctx, w / 2, h / 2 - 30, 26, 22, '#7a8a6a', rng, { lw: 3.5, hatch: 0.2 });
    for (const d of [-1, 1]) eye(ctx, w / 2 + d * 11, h / 2 - 34, 8, rng, 0, 0.3, { iris: '#c02020', lw: 2.4 });
    scribble(ctx, [[w / 2 - 10, h / 2 - 18], [w / 2, h / 2 - 22], [w / 2 + 10, h / 2 - 18]], 3, INK, rng);
  } },
  taproot: { w: 128, h: 144, frames: 3, draw(ctx, w, h, rng, f) {
    // f0 dirt mound, f1 head up, f2 mouth open
    blob(ctx, w / 2, h - 18, 46, 14, '#4a3a2a', rng, { lw: 3, hatch: 0.4 });
    if (f === 0) { for (let i = 0; i < 5; i++) scribble(ctx, [[w / 2 - 30 + i * 15, h - 22], [w / 2 - 26 + i * 15, h - 34]], 3, '#2a1a10', rng); return; }
    for (let i = 0; i < 4; i++) blob(ctx, w / 2 + Math.sin(i * 1.4) * 6, h - 30 - i * 18, 30 - i * 2, 20, i % 2 ? '#8a6a4a' : '#9a7a5a', rng, { lw: 3, hatch: 0.3 });
    blob(ctx, w / 2, h - 102, 34, 30, '#a8845a', rng, { lw: 3.5, hatch: 0.25 });
    for (let i = 0; i < 6; i++) scribble(ctx, [[w / 2 - 30 + i * 12, h - 126], [w / 2 - 34 + i * 13, h - 140 + (i % 2) * 6]], 2.4, '#5a3a1a', rng);
    blob(ctx, w / 2, h - 92, f === 2 ? 22 : 14, f === 2 ? 18 : 6, '#2a0606', rng, { lw: 3, hatch: 0 });
    if (f === 2) for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; poly(ctx, [[w / 2 + Math.cos(a) * 20, h - 92 + Math.sin(a) * 16], [w / 2 + Math.cos(a) * 10, h - 92 + Math.sin(a) * 8], [w / 2 + Math.cos(a + 0.3) * 20, h - 92 + Math.sin(a + 0.3) * 16]], '#e6dcc4', rng, { lw: 1.4, hatch: 0 }); }
    for (const d of [-1, 1]) dot(ctx, w / 2 + d * 16, h - 112, 5, '#ffd040');
  } },
  segment: { w: 80, h: 64, frames: 1, draw(ctx, w, h, rng) { blob(ctx, w / 2, h / 2, 30, 20, '#8a6a4a', rng, { lw: 3, hatch: 0.3 }); scribble(ctx, [[w / 2 - 20, h / 2], [w / 2 + 20, h / 2]], 1.6, rgba(INK, 0.5), rng); } },
  gristle: { w: 120, h: 128, frames: 2, mirror: true, draw(ctx, w, h, rng, f) {
    const st = f ? 4 : -4;
    for (const d of [-1, 1]) poly(ctx, [[w / 2 + d * 14 - 6, h - 30], [w / 2 + d * 14 + 6, h - 30], [w / 2 + d * 14 + 6 + st, h - 6], [w / 2 + d * 14 - 6 + st, h - 6]], '#7a3a3a', rng, { lw: 3 });
    blob(ctx, w / 2, h - 52, 36, 30, '#9a4a3a', rng, { lw: 3.5, hatch: 0.3 });
    blob(ctx, w / 2 + 10, h - 84, 26, 22, '#b05a4a', rng, { lw: 3.5, hatch: 0.25 });
    dot(ctx, w / 2 + 18, h - 90, 4.5, INK); dot(ctx, w / 2 + 4, h - 90, 4.5, INK);
    blob(ctx, w / 2 + 12, h - 74, 12, 6, '#2a0606', rng, { lw: 2.4, hatch: 0 });
    for (let i = 0; i < 4; i++) scribble(ctx, [[w / 2 - 28 + i * 10, h - 70], [w / 2 - 24 + i * 10, h - 40]], 2, rgba(INK, 0.4), rng);
  } },
  marrow: { w: 112, h: 128, frames: 2, draw(ctx, w, h, rng, f) {
    poly(ctx, [[w / 2 - 26, h - 6], [w / 2 - 20, h - 64], [w / 2 + 20, h - 64], [w / 2 + 26, h - 6]], '#c8c0a0', rng, { lw: 3.5, hatch: 0.3 });
    for (let i = 0; i < 4; i++) scribble(ctx, [[w / 2 - 18, h - 54 + i * 10], [w / 2 + 18, h - 54 + i * 10]], 2, '#8a8060', rng);
    blob(ctx, w / 2, h - 82, 28, 26, '#e0d8bc', rng, { lw: 3.5, hatch: 0.2 });
    for (const d of [-1, 1]) blob(ctx, w / 2 + d * 10, h - 86, 7, 8, '#1a0a0a', rng, { lw: 2, hatch: 0 });
    if (f) for (const d of [-1, 1]) glow(ctx, w / 2 + d * 10, h - 86, 10, '#ff3030', 0.8);
    blob(ctx, w / 2, h - 66, 9, f ? 9 : 4, '#2a0606', rng, { lw: 2.4, hatch: 0 });
  } },
  hog: { w: 176, h: 144, frames: 3, mirror: true, draw(ctx, w, h, rng, f) {
    const st = f === 1 ? 4 : f === 2 ? 0 : -4;
    for (const x of [44, 64, 112, 132]) poly(ctx, [[x - 6, h - 34], [x + 6, h - 34], [x + 6 + st, h - 6], [x - 6 + st, h - 6]], '#3a4a50', rng, { lw: 3 });
    blob(ctx, w / 2 - 6, h - 58, 64, 36, '#5a7a80', rng, { lw: 4, hatch: 0.35 });
    for (let i = 0; i < 6; i++) blob(ctx, w / 2 - 50 + i * 16, h - 70 + (i % 2) * 18, 6, 5, '#8ab0b0', rng, { lw: 1.6, hatch: 0 });
    blob(ctx, w - 40, h - 66, 30, 26, '#6a8a90', rng, { lw: 3.5, hatch: 0.25 });
    blob(ctx, w - 16, h - 58, 12, 10, '#9ab8b8', rng, { lw: 3, hatch: 0 });
    dot(ctx, w - 20, h - 58, 3, INK); dot(ctx, w - 12, h - 58, 3, INK);
    poly(ctx, [[w - 30, h - 46], [w - 14, h - 30], [w - 24, h - 48]], '#e6dcc4', rng, { lw: 2.4 });
    eye(ctx, w - 42, h - 80, 7, rng, 0.6, 0, { iris: f === 2 ? '#ff2020' : '#c8a020', lw: 2.4, lid: 0.3, lidColor: '#6a8a90' });
    ctx.fillStyle = 'rgba(150,200,230,0.6)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(30 + i * 24, h - 26, 4, 7, 0, 0, 7); ctx.fill(); }
  } },
  wellkeeper: { w: 176, h: 192, frames: 2, draw(ctx, w, h, rng, f) {
    // a hooded figure sitting in a bucket, many eyes under the hood
    poly(ctx, [[w / 2 - 56, h - 8], [w / 2 - 48, h - 64], [w / 2 + 48, h - 64], [w / 2 + 56, h - 8]], '#5a5a5a', rng, { lw: 4, hatch: 0.35 });
    for (const y of [h - 22, h - 48]) scribble(ctx, [[w / 2 - 54, y], [w / 2 + 54, y]], 4, '#3a3a3a', rng);
    poly(ctx, [[w / 2 - 44, h - 64], [w / 2 - 30, h - 160], [w / 2, h - 182], [w / 2 + 30, h - 160], [w / 2 + 44, h - 64]], '#2a3a4a', rng, { lw: 4, hatch: 0.3 });
    blob(ctx, w / 2, h - 128, 28, 32, '#0a0a12', rng, { lw: 3, hatch: 0 });
    for (const [x, y, r] of [[-12, -136, 6], [12, -136, 6], [0, -118, 8], [-16, -114, 4], [16, -114, 4]]) eye(ctx, w / 2 + x, h + y, r, rng, 0, 0.2, { iris: f ? '#40e0ff' : '#3a8aa0', lw: 1.8 });
    for (const d of [-1, 1]) scribble(ctx, [[w / 2 + d * 40, h - 96], [w / 2 + d * 66, h - (f ? 130 : 84)], [w / 2 + d * 76, h - (f ? 140 : 80)]], 6, '#c8b8a8', rng);
  } },
  kilnfather: { w: 192, h: 208, frames: 2, draw(ctx, w, h, rng, f) {
    poly(ctx, [[w / 2 - 70, h - 8], [w / 2 - 62, h - 120], [w / 2 + 62, h - 120], [w / 2 + 70, h - 8]], '#5a2a1a', rng, { lw: 4, hatch: 0.35 });
    for (let y = h - 110; y < h - 10; y += 18) for (let x = w / 2 - 60 + ((y / 18) % 2) * 15; x < w / 2 + 55; x += 30) poly(ctx, [[x, y], [x + 26, y], [x + 26, y + 14], [x, y + 14]], shade('#7a3a22', rng.range(-0.15, 0.1)), rng, { lw: 1.6, hatch: 0.2 });
    poly(ctx, [[w / 2 - 34, h - 26], [w / 2 - 34, h - 76], [w / 2 + 34, h - 76], [w / 2 + 34, h - 26]], '#1a0606', rng, { lw: 3.5, hatch: 0 });
    glow(ctx, w / 2, h - 50, 50, '#ff7a1a', f ? 0.9 : 0.6);
    for (let i = 0; i < 4; i++) poly(ctx, [[w / 2 - 26 + i * 16, h - 28], [w / 2 - 18 + i * 16, h - 60 - f * 8 - (i % 2) * 6], [w / 2 - 10 + i * 16, h - 28]], i % 2 ? '#ffd040' : '#ff7a1a', rng, { lw: 1.6, hatch: 0, jit: 2 });
    blob(ctx, w / 2, h - 150, 42, 36, '#6a3a2a', rng, { lw: 4, hatch: 0.3 });
    poly(ctx, [[w / 2 - 18, h - 186], [w / 2 - 14, h - 206], [w / 2 + 14, h - 206], [w / 2 + 18, h - 186]], '#3a2a2a', rng, { lw: 3 });
    for (const d of [-1, 1]) { blob(ctx, w / 2 + d * 16, h - 156, 9, 7, '#ffcc40', rng, { lw: 2.4, hatch: 0 }); glow(ctx, w / 2 + d * 16, h - 156, 14, '#ffa020', 0.6); }
    poly(ctx, [[w / 2 - 20, h - 132], [w / 2 + 20, h - 132], [w / 2 + 14, h - 124], [w / 2 - 14, h - 124]], '#1a0606', rng, { lw: 2.4, hatch: 0 });
  } },
  ashhound: { w: 176, h: 128, frames: 3, mirror: true, draw(ctx, w, h, rng, f) {
    const st = f === 1 ? 6 : f === 2 ? 0 : -6;
    for (const x of [46, 62, 112, 128]) scribble(ctx, [[x, h - 40], [x + st, h - 6]], 7, '#2a2020', rng);
    blob(ctx, w / 2 - 8, h - 54, 56, 26, '#4a3a3a', rng, { lw: 4, hatch: 0.4 });
    for (let i = 0; i < 8; i++) { const x = w / 2 - 54 + i * 13; glow(ctx, x, h - 74, 10, '#ff7a1a', 0.5); scribble(ctx, [[x, h - 76], [x + 3, h - 92 - (i % 3) * 4]], 3, '#ff9a3a', rng, 2); }
    blob(ctx, w - 40, h - 70, 28, 22, '#5a4a4a', rng, { lw: 3.5, hatch: 0.3 });
    poly(ctx, [[w - 24, h - 66], [w - 2, h - 60], [w - 6, h - 50], [w - 26, h - 52]], '#3a2a2a', rng, { lw: 3 });
    for (let i = 0; i < 3; i++) poly(ctx, [[w - 22 + i * 6, h - 54], [w - 19 + i * 6, h - 46], [w - 16 + i * 6, h - 54]], '#e6dcc4', rng, { lw: 1.2, hatch: 0 });
    blob(ctx, w - 36, h - 80, 6, 5, '#ffcc30', rng, { lw: 2, hatch: 0 }); glow(ctx, w - 36, h - 80, 12, '#ff9a20', 0.7);
    poly(ctx, [[w - 52, h - 88], [w - 44, h - 110], [w - 38, h - 86]], '#2a2020', rng, { lw: 2.6 });
  } },
  hm_foot: { w: 256, h: 224, frames: 1, draw(ctx, w, h, rng) {
    // a huge grey slipper-foot with yellowed toenails
    poly(ctx, [[60, h - 10], [40, h - 80], [70, h - 190], [186, h - 190], [216, h - 80], [196, h - 10]], '#8a8478', rng, { lw: 5, hatch: 0.35 });
    for (let i = 0; i < 5; i++) blob(ctx, 66 + i * 31, h - 22, 16, 12, '#c8b08a', rng, { lw: 3, hatch: 0.2 });
    poly(ctx, [[64, h - 150], [192, h - 150], [196, h - 120], [60, h - 120]], '#b06a8a', rng, { lw: 3.5, hatch: 0.3 });
    for (let i = 0; i < 6; i++) dot(ctx, 76 + i * 21, h - 135, 4, '#f0d0e0');
  } },
  hm_arm: { w: 320, h: 112, frames: 1, draw(ctx, w, h, rng) {
    poly(ctx, [[0, 30], [220, 22], [250, 14], [300, 26], [316, 56], [300, 90], [250, 98], [220, 88], [0, 82]], '#9a9080', rng, { lw: 5, hatch: 0.35 });
    for (let i = 0; i < 4; i++) poly(ctx, [[262 + i * 4, 20 + i * 20], [312, 22 + i * 21], [312, 34 + i * 21], [262 + i * 4, 32 + i * 20]], '#a89c8a', rng, { lw: 2.4, hatch: 0.2 });
    poly(ctx, [[0, 34], [150, 30], [150, 78], [0, 78]], '#5a3a5a', rng, { lw: 3, hatch: 0.3 });
    for (let i = 0; i < 6; i++) dot(ctx, 16 + i * 24, 54, 5, '#c890c0');
  } },
  hm_eye: { w: 144, h: 112, frames: 2, draw(ctx, w, h, rng, f) {
    blob(ctx, w / 2, h / 2, 64, 46, '#1a0606', rng, { lw: 4, hatch: 0 });
    eye(ctx, w / 2, h / 2, f ? 34 : 26, rng, 0, 0.2, { iris: '#7a5a2a', lw: 3.5, pupilR: f ? 0.45 : 0.3 });
    for (let i = 0; i < 6; i++) scribble(ctx, [[w / 2 - 50 + i * 20, h / 2 - 40], [w / 2 - 54 + i * 21, h / 2 - 54]], 3, INK, rng);
  } },
  hm_heart: { w: 224, h: 224, frames: 2, draw(ctx, w, h, rng, f) {
    const s = f ? 1.08 : 1;
    glow(ctx, w / 2, h / 2, 110, '#ff2020', f ? 0.5 : 0.25);
    blob(ctx, w / 2 - 30 * s, h / 2 - 20, 54 * s, 52 * s, '#a01818', rng, { lw: 5, hatch: 0.35 });
    blob(ctx, w / 2 + 34 * s, h / 2 - 14, 50 * s, 50 * s, '#b02020', rng, { lw: 5, hatch: 0.35 });
    poly(ctx, [[w / 2 - 80 * s, h / 2], [w / 2 + 80 * s, h / 2], [w / 2, h / 2 + 90 * s]], '#a01818', rng, { lw: 5, hatch: 0.35 });
    for (const [x, y] of [[-20, -70], [20, -78], [44, -66]]) poly(ctx, [[w / 2 + x - 8, h / 2 + y + 20], [w / 2 + x - 6, h / 2 + y - 10], [w / 2 + x + 8, h / 2 + y - 10], [w / 2 + x + 8, h / 2 + y + 20]], '#c8a0a0', rng, { lw: 3 });
    for (let i = 0; i < 6; i++) scribble(ctx, [[w / 2 - 50 + i * 20, h / 2 - 30], [w / 2 - 40 + i * 18, h / 2 + 20], [w / 2 - 30 + i * 12, h / 2 + 50]], 2.4, '#5a0606', rng, 3);
    for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(w / 2 - 50 + i * 30, h / 2 + 10); ctx.scale(0.8, 0.8); ctx.restore(); }
    // stitches: it has been sewn shut
    for (let i = 0; i < 5; i++) scribble(ctx, [[w / 2 - 10, h / 2 - 20 + i * 14], [w / 2 + 10, h / 2 - 14 + i * 14]], 3, '#e8dcc0', rng);
  } },
  housemother: { w: 256, h: 256, frames: 1, draw(ctx, w, h, rng) {
    // portrait only: a tall silhouette in a housecoat, face hidden by curlers & shadow
    poly(ctx, [[60, h], [80, 110], [176, 110], [196, h]], '#5a3a5a', rng, { lw: 5, hatch: 0.35 });
    for (let i = 0; i < 6; i++) dot(ctx, 92 + (i % 3) * 36, 150 + Math.floor(i / 3) * 50, 7, '#c890c0');
    blob(ctx, w / 2, 76, 46, 52, '#8a8478', rng, { lw: 5, hatch: 0.3 });
    for (let i = 0; i < 5; i++) blob(ctx, w / 2 - 40 + i * 20, 32 + (i % 2) * 6, 10, 9, '#d8a0c0', rng, { lw: 3 });
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; wobEllipse(ctx, w / 2, 86, 36, 34, rng, 0.08); ctx.fill();
    dot(ctx, w / 2 - 14, 80, 5, '#ffe0a0'); dot(ctx, w / 2 + 14, 80, 5, '#ffe0a0');
    scribble(ctx, [[w / 2 - 18, 104], [w / 2, 112], [w / 2 + 18, 104]], 3, '#ffe0a0', rng);
  } },
};
Object.assign(ENEMY_ART, ART);

export const BOSS_INFO = {
  lump: { name: 'The Lump', art: 'lump' },
  mildew: { name: 'Mother Mildew', art: 'mildew' },
  taproot: { name: 'Taproot', art: 'taproot', portraitFrame: 2 },
  rottwins: { name: 'The Rot Twins', art: 'gristle', art2: 'marrow' },
  hog: { name: 'The Drowned Hog', art: 'hog' },
  wellkeeper: { name: 'The Well-Keeper', art: 'wellkeeper' },
  kilnfather: { name: 'The Kiln Father', art: 'kilnfather' },
  ashhound: { name: 'The Ash Hound', art: 'ashhound' },
  housemother: { name: 'The Housemother', art: 'housemother' },
};
for (const [id, info] of Object.entries(BOSS_INFO)) {
  info.portrait = () => tex('bossportrait:' + id, 256, 256, (ctx, w, h) => {
    const a = enemyTex(info.art, info.portraitFrame || 0).image;
    const s = Math.min(230 / a.width, 230 / a.height);
    if (info.art2) {
      const b = enemyTex(info.art2, 0).image;
      ctx.drawImage(a, 4, h - a.height * s * 0.8 - 6, a.width * s * 0.8, a.height * s * 0.8);
      ctx.drawImage(b, w - b.width * s * 0.8 - 4, h - b.height * s * 0.8 - 20, b.width * s * 0.8, b.height * s * 0.8);
    } else ctx.drawImage(a, (w - a.width * s) / 2, h - a.height * s - 6, a.width * s, a.height * s);
  });
}

// ---- helpers --------------------------------------------------------------------------
function bossHp(id) { return CFG.BOSS[id].hp * CFG.BOSS.hpFloorScale[Math.min(S.floorNum, 5)]; }
function phase2(e) { return e.hp < e.maxHp * 0.5; }
function enterPhase2(e) { if (!e.p2 && phase2(e)) { e.p2 = true; audio.play('roar'); addShake(0.4); poof(e.x, e.z, 0xaa2222, 1.5); return true; } return false; }
function clampToRoom(x, z, m = 1.2) { const r = S.room; return [Math.max(m, Math.min(r.W - m, x)), Math.max(m, Math.min(r.H - m, z))]; }
function landRing(e, n, speed = 4.2, off = 0) { e.ring(n, off, { speed }); addShake(0.4); audio.play('slam'); }

function bossDef(base) {
  return Object.assign({ noChampion: true, mass: 8, gore: 2.2 }, base);
}

// ---- floor bosses ---------------------------------------------------------------------
DEFS.boss_lump = bossDef({ name: 'The Lump', art: 'lump', r: 1.05, wsize: [3.0, 2.5], shadow: 2.6,
  frame(e) { return e.state === 'air' ? 1 : e.state === 'spew' ? 2 : 0; },
  update(e, dt) {
    enterPhase2(e);
    if (e.state === 'idle') {
      e.stop(); e.h = 0;
      if (e.t > (e.p2 ? 0.7 : 1.1)) {
        e.t = 0;
        e.state = e.rng.chance(0.35) ? 'spew' : 'crouch';
      }
    } else if (e.state === 'crouch') {
      e.squashY = 0.85; e.squashX = 1.12;
      if (e.t > 0.35) {
        e.state = 'air'; e.t = 0; e.squashX = e.squashY = 1;
        const [tx, tz] = clampToRoom(S.player.x, S.player.z, 1.4);
        e.from = [e.x, e.z]; e.to = [tx, tz]; e.mark = telegraph(tx, tz, 2.6, 1.6, 0.85);
        e.noContact = true;
      }
    } else if (e.state === 'air') {
      const k = Math.min(1, e.t / 0.85);
      e.x = e.from[0] + (e.to[0] - e.from[0]) * k; e.z = e.from[1] + (e.to[1] - e.from[1]) * k;
      e.h = Math.sin(k * Math.PI) * 3.2;
      if (k >= 1) {
        e.state = 'idle'; e.t = 0; e.h = 0; e.noContact = false;
        landRing(e, e.p2 ? 12 : 8, 4.2, e.rng.range(0, 1));
        if (e.p2 && S.enemies.filter((o) => o.alive && o.type === 'clotlet').length < 4) for (let i = 0; i < 2; i++) spawnEnemy('clotlet', e.x + (i ? 1 : -1), e.z + 0.5);
      }
    } else if (e.state === 'spew') {
      e.stop();
      if (e.t > 0.4 && !e.spewed) { e.spewed = true; e.spread(e.angleToPlayer(), e.p2 ? 7 : 5, 0.2, { speed: 5, scale: 1.2 }); }
      if (e.p2 && e.t > 0.75 && !e.spewed2) { e.spewed2 = true; e.spread(e.angleToPlayer(), 6, 0.22, { speed: 4.2 }); }
      if (e.t > 1.1) { e.state = 'idle'; e.t = 0; e.spewed = e.spewed2 = false; }
    }
    e.flying = e.state === 'air';
  } });

DEFS.boss_mildew = bossDef({ name: 'Mother Mildew', art: 'mildew', r: 0.95, flying: true, height: 0.6, wsize: [2.7, 2.7], shadow: 2.2, fps: 8,
  update(e, dt) {
    if (enterPhase2(e)) for (let i = 0; i < 3; i++) spawnEnemy('halogn', e.x, e.z, { host: e, angle: (i / 3) * TAU });
    if (e.state === 'dash') {
      e.vx = e.dash[0] * 7.5; e.vz = e.dash[1] * 7.5;
      if (e.t > 0.55 || e.wallHit) { e.state = 'idle'; e.t = 0; }
      return;
    }
    const a = e.angleToPlayer() + Math.sin(e.age * 0.8) * 1.2;
    const sp = e.distToPlayer() > 3 ? 1.3 : 0.4;
    e.vx = Math.cos(a) * sp; e.vz = Math.sin(a) * sp;
    const flies = S.enemies.filter((o) => o.alive && (o.type === 'gnat' || o.type === 'twitchfly')).length;
    if (e.t > (e.p2 ? 2.2 : 3.0)) {
      e.t = 0;
      const r = e.rng.next();
      if (r < 0.45 && flies < (e.p2 ? 7 : 5)) { for (let i = 0; i < 2; i++) { const g = spawnEnemy(e.p2 && i ? 'twitchfly' : 'gnat', e.x + (i ? 0.6 : -0.6), e.z + 0.4); if (g) g.spawnGrace = 0.2; } audio.play('spawn'); }
      else if (r < 0.8 || !e.p2) { e.spread(e.angleToPlayer(), 3, 0.3, { speed: 4.4 }); if (e.p2) setTimeout(() => e.alive && e.ring(8, 0.2, { speed: 3.4 }), 300); }
      else { const ang = e.angleToPlayer(); e.dash = [Math.cos(ang), Math.sin(ang)]; e.state = 'dash'; e.t = 0; audio.play('roar'); }
    }
  },
  onDeath(e) { for (let i = 0; i < 4; i++) spawnEnemy('gnat', e.x + Math.cos(i) * 0.8, e.z + Math.sin(i) * 0.8); } });

DEFS.boss_taproot = bossDef({ name: 'Taproot', art: 'taproot', r: 0.75, wsize: [2.0, 2.25], shadow: 1.6,
  frame(e) { return e.state === 'under' ? 0 : e.state === 'rise' ? 0 : e.mouth ? 2 : 1; },
  init(e) { e.state = 'under'; e.untargetable = true; e.noContact = true; e.segs = []; for (let i = 0; i < 5; i++) e.segs.push({ x: e.x, z: e.z, h: 0 }); e.extra = e.segs.map(() => makeSprite(enemyTex('segment', 0), 1.25, 1.0)); },
  update(e, dt) {
    enterPhase2(e);
    const p = S.player;
    if (e.state === 'under') {
      e.hidden = true; e.hideShadow = true; e.untargetable = true; e.noContact = true;
      // circle around the player underground, leaving dirt puffs
      e.orbitA = (e.orbitA ?? 0) + dt * (e.p2 ? 1.6 : 1.1);
      const [tx, tz] = clampToRoom(p.x + Math.cos(e.orbitA) * 3.2, p.z + Math.sin(e.orbitA) * 2.4, 1.3);
      e.toward(tx, tz, e.p2 ? 6 : 4.5);
      if (Math.floor(e.age * 8) !== Math.floor((e.age - dt) * 8)) particles(e.x, e.z, { count: 1, kind: 'rock', color: 0x5a4a3a, speed: 1, up: 2, life: 0.5, size: 0.25 });
      if (e.t > (e.p2 ? 1.6 : 2.2)) { e.state = 'rise'; e.t = 0; e.stop(); e.mark = telegraph(e.x, e.z, 1.8, 1.4, 0.6); audio.play('burrow'); }
    } else if (e.state === 'rise') {
      e.hidden = e.t < 0.3; e.hideShadow = false;
      if (e.t > 0.6) {
        e.state = 'lunge'; e.t = 0; e.hidden = false; e.untargetable = false; e.noContact = false;
        const a = angleTo(e, p); e.dir = [Math.cos(a), Math.sin(a)];
        e.from = [e.x, e.z]; e.lungeT = 1.2;
        addShake(0.3); audio.play('roar');
        if (e.p2) e.ring(10, 0, { speed: 3.6 });
      }
    } else if (e.state === 'lunge') {
      // arcing leap across the room in a line, head high
      const k = e.t / e.lungeT;
      e.vx = e.dir[0] * 5.2; e.vz = e.dir[1] * 5.2;
      e.h = Math.sin(Math.min(1, k) * Math.PI) * 1.8;
      e.mouth = k > 0.2 && k < 0.7;
      if (e.mouth && !e.spat) { e.spat = true; e.spread(angleTo(e, p), e.p2 ? 5 : 3, 0.3, { speed: 4.8 }); }
      if (k >= 1 || e.wallHit) { e.state = 'dive'; e.t = 0; e.h = 0; e.spat = false; e.mouth = false; }
    } else if (e.state === 'dive') {
      e.stop();
      if (e.t > 0.5) { e.state = 'under'; e.t = 0; audio.play('burrow'); }
    }
    e.noCollide = e.state === 'under';
    // body segments trail behind
    let prev = { x: e.x, z: e.z, h: e.h };
    e.segs.forEach((s, i) => {
      const dx = prev.x - s.x, dz = prev.z - s.z, d = Math.hypot(dx, dz);
      if (d > 0.55) { s.x += (dx / d) * (d - 0.55); s.z += (dz / d) * (d - 0.55); }
      s.h += (prev.h * 0.75 - s.h) * Math.min(1, dt * 10);
      prev = s;
    });
  },
  onHurt(e, dmg) { return dmg; } });
// taproot segments render
const baseSync = Enemy.prototype.sync;
Enemy.prototype.sync = function () {
  baseSync.call(this);
  if (this.segs && this.extra) {
    const vis = this.state === 'lunge' || this.state === 'dive';
    this.segs.forEach((s, i) => { const spr = this.extra[i]; spr.visible = vis; place(spr, s.x, s.z, s.h, -1 - i); spr.material.color.set(this.flash > 0 ? 0xffaaaa : 0xffffff); });
  }
};

// Rot Twins: Gristle charges, Marrow shoots. When one dies, the other enrages.
DEFS.boss_gristle = bossDef({ name: 'Gristle', art: 'gristle', r: 0.7, wsize: [1.9, 2.0], shadow: 1.6, fps: 6,
  update(e, dt) {
    const twin = S.enemies.find((o) => o.alive && o.type === 'boss_marrow');
    const rage = !twin || phase2(e);
    if (e.state === 'charge') {
      e.vx = e.dir[0] * (rage ? 8.5 : 7); e.vz = e.dir[1] * (rage ? 8.5 : 7);
      if (e.wallHit && e.t > 0.1) { e.state = 'idle'; e.t = 0; addShake(0.3); audio.play('slam'); if (rage) e.ring(8, 0, { speed: 3.8 }); }
      return;
    }
    e.chase(rage ? 2.2 : 1.5);
    if (e.t > (rage ? 1.4 : 2.2) && e.aligned(0.9) >= 0) { e.state = 'charge'; e.t = 0; const a = e.angleToPlayer(); e.dir = [Math.cos(a), Math.sin(a)]; audio.play('roar'); }
  } });
DEFS.boss_marrow = bossDef({ name: 'Marrow', art: 'marrow', r: 0.65, wsize: [1.75, 2.0], shadow: 1.4,
  frame(e) { return e.fireT != null && e.fireT < 0.4 ? 1 : 0; },
  update(e, dt) {
    const twin = S.enemies.find((o) => o.alive && o.type === 'boss_gristle');
    const rage = !twin || phase2(e);
    const d = e.distToPlayer();
    const a = e.angleToPlayer() + (d < 4 ? Math.PI : 0.6);
    e.vx = Math.cos(a) * 1.3; e.vz = Math.sin(a) * 1.3;
    e.fireT = (e.fireT ?? 1.5) - dt;
    if (e.fireT <= 0) {
      e.fireT = rage ? 1.0 : 1.6;
      if (rage && e.rng.chance(0.4)) e.ring(10, e.rng.range(0, 1), { speed: 3.6, color: 0xe6dcc4 });
      else e.spread(e.angleToPlayer(), rage ? 5 : 3, 0.25, { speed: 4.8, color: 0xe6dcc4, style: 'tooth' });
    }
  } });

DEFS.boss_hog = bossDef({ name: 'The Drowned Hog', art: 'hog', r: 1.0, wsize: [2.75, 2.25], shadow: 2.6,
  frame(e) { return e.state === 'charge' ? 2 : e.state === 'windup' ? (Math.floor(e.age * 20) % 2) : Math.floor(e.age * 5) % 2; },
  update(e, dt) {
    enterPhase2(e);
    if (e.state === 'idle') {
      e.chase(1.0);
      if (e.t > (e.p2 ? 1.0 : 1.6)) { e.state = 'windup'; e.t = 0; e.charges = e.p2 ? 3 : 1; }
    } else if (e.state === 'windup') {
      e.stop();
      const a = e.angleToPlayer(); e.face = Math.cos(a) > 0 ? 1 : -1;
      e.squashX = 1 + Math.sin(e.t * 50) * 0.04;
      if (e.t > 0.55) { e.state = 'charge'; e.t = 0; e.dir = [Math.cos(a), Math.sin(a)]; audio.play('roar'); e.squashX = 1; }
    } else if (e.state === 'charge') {
      e.vx = e.dir[0] * 9; e.vz = e.dir[1] * 9;
      if (e.p2 && Math.floor(e.age * 10) !== Math.floor((e.age - dt) * 10)) creep(e.x, e.z, { color: '#4a7a9a', size: 1, life: 3.5 });
      if (e.wallHit && e.t > 0.1) {
        addShake(0.5); audio.play('slam');
        e.ring(e.p2 ? 10 : 8, e.rng.range(0, 1), { speed: 3.8, color: 0x60a0c0 });
        e.charges--;
        if (e.charges > 0) { e.state = 'windup'; e.t = 0.25; } else { e.state = 'stun'; e.t = 0; }
      }
    } else if (e.state === 'stun') {
      e.stop();
      if (e.t > 0.9) { e.state = 'idle'; e.t = 0; }
    }
  } });

DEFS.boss_wellkeeper = bossDef({ name: 'The Well-Keeper', art: 'wellkeeper', r: 0.95, wsize: [2.75, 3.0], shadow: 2.4, stationary: true, mass: 99,
  frame(e) { return e.attack ? 1 : 0; },
  update(e, dt) {
    enterPhase2(e);
    // slides slowly along the top half of the room
    const room = S.room;
    e.vx = Math.sin(e.age * 0.5) * 1.0; e.vz = ((room.H * 0.32) - e.z) * 1.5;
    e.atkT = (e.atkT ?? 1.2) - dt;
    if (e.attack) {
      e.attack.t += dt;
      const a = e.attack;
      if (a.kind === 'spiral') {
        a.acc = (a.acc || 0) + dt;
        while (a.acc > (e.p2 ? 0.07 : 0.1)) { a.acc -= e.p2 ? 0.07 : 0.1; a.ang += 0.37; e.shoot(a.ang, { speed: 3.4, color: 0x60c0e0 }); if (e.p2) e.shoot(-a.ang + Math.PI, { speed: 3.0, color: 0x3a80c0 }); }
        if (a.t > 2.6) e.attack = null;
      } else if (a.kind === 'burst') {
        if (a.t > a.n * 0.35 && a.n < (e.p2 ? 4 : 3)) { a.n++; e.spread(e.angleToPlayer(), 5, 0.16, { speed: 5.2, color: 0x60c0e0 }); }
        if (a.n >= (e.p2 ? 4 : 3) && a.t > 1.4) e.attack = null;
      } else if (a.kind === 'wall') {
        // a falling wall of shots with one gap
        if (!a.done) { a.done = true; const gap = e.rng.int(1, room.W - 2); for (let x = 0.5; x < room.W; x += 0.9) if (Math.abs(x - gap) > 1.1) enemyShot(e, Math.PI / 2, { x, z: 0.6, speed: 2.6, color: 0x3a80c0, range: 12 }); }
        if (a.t > 1.2) e.attack = null;
      }
    } else if (e.atkT <= 0) {
      e.atkT = e.p2 ? 0.8 : 1.3;
      const opts = e.p2 ? ['spiral', 'burst', 'wall', 'burst'] : ['spiral', 'burst', 'burst'];
      e.attack = { kind: e.rng.pick(opts), t: 0, n: 0, ang: e.rng.range(0, TAU) };
    }
  } });

DEFS.boss_kilnfather = bossDef({ name: 'The Kiln Father', art: 'kilnfather', r: 1.1, wsize: [3.0, 3.25], shadow: 2.6, mass: 99, stationary: true,
  frame(e) { return e.attack ? 1 : 0; },
  update(e, dt) {
    enterPhase2(e);
    const room = S.room;
    // lumbers slowly toward the player
    e.chase(e.p2 ? 0.8 : 0.55);
    e.atkT = (e.atkT ?? 1.5) - dt;
    if (e.attack) {
      const a = e.attack; a.t += dt;
      if (a.kind === 'fireballs') {
        if (a.t > a.n * 0.45 && a.n < 4) { a.n++; const s = e.shoot(e.angleToPlayer(), { speed: 4.6, color: 0xff8a2a, scale: 1.8 }); if (s) s.onLand = null; }
        if (a.n >= 4 && a.t > 2) e.attack = null;
      } else if (a.kind === 'spiral') {
        a.acc = (a.acc || 0) + dt;
        while (a.acc > 0.09) { a.acc -= 0.09; a.ang += 0.5; for (let k = 0; k < (e.p2 ? 3 : 2); k++) e.shoot(a.ang + k * TAU / (e.p2 ? 3 : 2), { speed: 3.2, color: 0xff7a1a }); }
        if (a.t > 2.4) e.attack = null;
      } else if (a.kind === 'beam') {
        // telegraphed blood-fire beams in a cross that rotates
        if (!a.marks) { a.marks = true; a.base = e.rng.chance(0.5) ? 0 : Math.PI / 4; for (let i = 0; i < 4; i++) { const ang = a.base + i * Math.PI / 2; for (let l = 1; l < 9; l += 1.2) { const x = e.x + Math.cos(ang) * l, z = e.z + Math.sin(ang) * l; if (x > 0 && z > 0 && x < room.W && z < room.H) telegraph(x, z, 0.7, 0.6, 0.8); } } audio.play('charged'); }
        if (a.t > 0.85 && !a.fired) { a.fired = true; for (let i = 0; i < 4; i++) spawnLaser({ owner: 'enemy', x: e.x, z: e.z, angle: a.base + i * Math.PI / 2, follow: e, offset: 0.6, duration: 0.9, width: 0.8, color: '#ff6a1a', source: e }); audio.play('laser'); addShake(0.3); }
        if (a.t > 2) e.attack = null;
      } else if (a.kind === 'embers') {
        if (!a.done) { a.done = true; const n = S.enemies.filter((o) => o.alive && o.type === 'ember').length; for (let i = 0; i < Math.max(0, 3 - n); i++) spawnEnemy('ember', e.x + (i - 1), e.z + 1); audio.play('spawn'); }
        if (a.t > 0.8) e.attack = null;
      }
      if (e.attack) e.stop();
    } else if (e.atkT <= 0) {
      e.atkT = e.p2 ? 0.9 : 1.4;
      const opts = e.p2 ? ['fireballs', 'spiral', 'beam', 'beam', 'embers'] : ['fireballs', 'spiral', 'embers'];
      e.attack = { kind: e.rng.pick(opts), t: 0, n: 0, ang: e.rng.range(0, TAU) };
    }
  } });

DEFS.boss_ashhound = bossDef({ name: 'The Ash Hound', art: 'ashhound', r: 0.95, wsize: [2.75, 2.0], shadow: 2.4,
  frame(e) { return e.state === 'dash' || e.state === 'air' ? 2 : Math.floor(e.age * 8) % 2; },
  update(e, dt) {
    if (enterPhase2(e)) for (let i = 0; i < 2; i++) spawnEnemy('ember', e.x, e.z);
    const p = S.player;
    if (e.state === 'idle') {
      e.chase(e.p2 ? 2.4 : 1.8);
      if (e.t > (e.p2 ? 1.1 : 1.6)) { e.t = 0; e.state = e.rng.chance(0.5) ? 'leapPrep' : 'dashPrep'; }
    } else if (e.state === 'dashPrep') {
      e.stop(); e.squashY = 0.9;
      if (e.t > 0.45) { e.squashY = 1; e.state = 'dash'; e.t = 0; const a = e.angleToPlayer(); e.dir = [Math.cos(a), Math.sin(a)]; audio.play('roar'); }
    } else if (e.state === 'dash') {
      e.vx = e.dir[0] * 9.5; e.vz = e.dir[1] * 9.5;
      if (Math.floor(e.age * 12) !== Math.floor((e.age - dt) * 12)) creep(e.x, e.z, { color: '#ff6a1a', size: 0.9, life: 3 });
      if (e.wallHit || e.t > 1.2) { e.state = 'idle'; e.t = 0; if (e.wallHit) { addShake(0.3); audio.play('slam'); } }
    } else if (e.state === 'leapPrep') {
      e.stop();
      if (e.t > 0.3) { e.state = 'air'; e.t = 0; const [tx, tz] = clampToRoom(p.x, p.z, 1.2); e.from = [e.x, e.z]; e.to = [tx, tz]; telegraph(tx, tz, 2.4, 1.5, 0.75); e.noContact = true; }
    } else if (e.state === 'air') {
      const k = Math.min(1, e.t / 0.75);
      e.x = e.from[0] + (e.to[0] - e.from[0]) * k; e.z = e.from[1] + (e.to[1] - e.from[1]) * k; e.h = Math.sin(k * Math.PI) * 2.5;
      if (k >= 1) { e.state = 'idle'; e.t = 0; e.h = 0; e.noContact = false; landRing(e, e.p2 ? 12 : 8, 4, 0); for (let i = 0; i < 4; i++) { const a = i * TAU / 4; creep(e.x + Math.cos(a), e.z + Math.sin(a), { color: '#ff6a1a', size: 0.9, life: 2.5 }); } }
    }
    e.flying = e.state === 'air';
  } });

// ---- The Housemother ------------------------------------------------------------------
// The main body is invisible & untargetable; her foot, arms and eyes are parts that
// forward damage to it. Below 50% her heart is exposed in the middle of the room.
DEFS.boss_housemother = bossDef({ name: 'The Housemother', art: 'housemother', r: 0.1, wsize: [0.01, 0.01], shadow: 0.01, stationary: true, mass: 999,
  init(e) { e.untargetable = true; e.noContact = true; e.hidden = true; e.hideShadow = true; e.noCollide = true; e.phase = 1; e.atkT = 1.5; S.bossBarMax = e.maxHp + CFG.BOSS.housemother.heartHp * CFG.BOSS.hpFloorScale[Math.min(S.floorNum, 5)]; },
  update(e, dt) {
    e.stop();
    if (e.phase === 1 && e.hp < e.maxHp * 0.02 + 1) {
      // phase 2: the heart is exposed
      e.phase = 2; e.atkT = 2.5;
      for (const o of S.enemies) if (o.alive && o.hmPart) o.destroy();
      const room = S.room;
      const h = spawnEnemy('hm_heart', room.W / 2, room.H / 2 - 0.3, { hp: CFG.BOSS.housemother.heartHp * CFG.BOSS.hpFloorScale[Math.min(S.floorNum, 5)] / CFG.ENEMY_HP_FLOOR_SCALE[Math.min(S.floorNum, 5)] });
      if (h) { h.isBoss = true; h.main = e; }
      e.noBar = true;
      audio.play('roar'); addShake(1); audio.play('heartbeat');
      S.game.banner('Her heart is showing', 'end it');
      return;
    }
    if (e.phase === 2) {
      // the heart handles phase 2; keep stomping occasionally
      e.atkT -= dt;
      const heart = S.enemies.find((o) => o.alive && o.type === 'hm_heart');
      if (!heart) { e.hp = 0; e.die({}); return; }
      if (e.atkT <= 0) { e.atkT = heart.hp < heart.maxHp * 0.5 ? 3.2 : 4.5; hmStomp(e); }
      return;
    }
    e.atkT -= dt;
    const busy = S.enemies.some((o) => o.alive && o.hmPart);
    if (e.atkT <= 0 && !busy) {
      const k = e.hp / e.maxHp;
      e.atkT = 0.6 + k * 0.8;
      const r = e.rng.next();
      if (r < 0.42) hmStomp(e);
      else if (r < 0.72) hmArm(e);
      else hmEye(e);
    }
  },
  onDeath(e) {
    S.bossBarMax = 0;
  } });

function hmStomp(e) {
  const p = S.player;
  const [x, z] = clampToRoom(p.x, p.z, 1.2);
  const f = spawnEnemy('hm_foot', x, z, {});
  if (f) { f.main = e; f.hmPart = true; f.noBar = true; f.isBoss = true; }
}
function hmArm(e) {
  const room = S.room;
  const row = Math.max(1.2, Math.min(room.H - 1.2, S.player.z + e.rng.range(-0.4, 0.4)));
  const fromLeft = S.player.x > room.W / 2 ? true : false;
  const a = spawnEnemy('hm_arm', fromLeft ? -2.5 : room.W + 2.5, row, { props: { fromLeft } });
  if (a) { a.main = e; a.hmPart = true; a.noBar = true; a.isBoss = true; }
}
function hmEye(e) {
  const room = S.room;
  const spots = [[room.W / 2, 0.35], [0.4, room.H / 2], [room.W - 0.4, room.H / 2], [room.W / 2, room.H - 0.35]];
  const [x, z] = e.rng.pick(spots);
  const a = spawnEnemy('hm_eye', x, z, {});
  if (a) { a.main = e; a.hmPart = true; a.noBar = true; a.isBoss = true; }
}
function forward(part, dmg) {
  const m = part.main;
  if (!m || !m.alive) return 0;
  m.hp -= dmg;
  m.flash = 0.08;
  if (m.hp <= 0 && m.phase === 1) m.hp = 1; // the heart must be destroyed
  return 0;
}

DEFS.hm_foot = bossDef({ name: "the Housemother's foot", art: 'hm_foot', r: 1.35, wsize: [4.0, 3.5], shadow: 3.2, stationary: true, mass: 999, noGore: true,
  init(e) { e.state = 'mark'; e.untargetable = true; e.noContact = true; e.hidden = true; e.mark = telegraph(e.x, e.z, 3.2, 2.2, 1.0); e.h = 9; e.hp = 9999; },
  update(e, dt) {
    e.stop();
    if (e.state === 'mark') {
      e.hidden = e.t < 0.55;
      e.h = Math.max(0, 9 * (1 - Math.max(0, e.t - 0.55) / 0.45));
      if (e.t > 1.0) {
        e.state = 'down'; e.t = 0; e.h = 0; e.untargetable = false;
        addShake(0.9); audio.play('slam'); S.hitStop = Math.max(S.hitStop, 3);
        const p = S.player;
        if (Math.hypot(p.x - e.x, (p.z - e.z) * 1.3) < 1.7) p.hurt(2, e.main || 'The Housemother');
        const k = e.main ? e.main.hp / e.main.maxHp : 1;
        const n = e.main && e.main.phase === 2 ? 10 : k < 0.6 ? 10 : 6;
        e.ring(n, e.rng.range(0, 1), { speed: 3.6, z: e.z });
        particles(e.x, e.z, { count: 12, kind: 'smoke', color: 0x6a5a4a, life: 0.9, size: 1.1, speed: 4 });
      }
    } else if (e.state === 'down') {
      if (e.t > 1.25) { e.state = 'up'; e.t = 0; e.untargetable = true; }
    } else if (e.state === 'up') {
      e.h = e.t / 0.4 * 9;
      if (e.t > 0.4) e.destroy();
    }
  },
  onHurt(e, dmg) { forward(e, dmg); e.hp = 9999; return 0; } });

DEFS.hm_arm = bossDef({ name: "the Housemother's arm", art: 'hm_arm', r: 0.75, wsize: [5.0, 1.75], shadow: 0.01, stationary: true, mass: 999, noGore: true,
  init(e) { e.state = 'mark'; e.untargetable = true; e.noContact = true; e.noCollide = true; e.hp = 9999; e.face = e.fromLeft ? 1 : -1; e.homeX = e.x; e.mark = telegraph(S.room.W / 2, e.z, S.room.W, 1.3, 0.9, 'strip'); audio.play('roar'); },
  update(e, dt) {
    e.stop();
    const room = S.room;
    const dir = e.fromLeft ? 1 : -1;
    if (e.state === 'mark') { if (e.t > 0.9) { e.state = 'sweep'; e.t = 0; e.untargetable = false; e.noContact = false; addShake(0.3); } }
    else if (e.state === 'sweep') {
      const k = Math.min(1, e.t / 0.45);
      e.x = e.homeX + dir * k * (room.W * 0.68);
      if (k >= 1 && e.t > 1.3) { e.state = 'back'; e.t = 0; }
    } else if (e.state === 'back') {
      e.x = e.homeX + dir * (1 - Math.min(1, e.t / 0.6)) * (room.W * 0.68);
      e.noContact = true;
      if (e.t > 0.6) e.destroy();
    }
    // the arm is long: hit the player anywhere along it
    const p = S.player;
    if (!e.noContact) {
      const tip = e.x + dir * 2.3, tail = e.x - dir * 2.5;
      const minX = Math.min(tip, tail), maxX = Math.max(tip, tail);
      if (p.x > minX - p.r && p.x < maxX + p.r && Math.abs(p.z - e.z) < 0.7 + p.r * 0.5) p.hurt(2, e.main || 'The Housemother');
    }
    e.noContact2 = true;
  },
  onTouchPlayer() {},
  onHurt(e, dmg) { forward(e, dmg); e.hp = 9999; return 0; } });

DEFS.hm_eye = bossDef({ name: "the Housemother's eye", art: 'hm_eye', r: 0.75, wsize: [2.25, 1.75], shadow: 0.01, stationary: true, mass: 999, noGore: true,
  frame(e) { return e.state === 'open' ? 1 : 0; },
  init(e) { e.state = 'appear'; e.hp = 9999; e.noContact = true; e.noCollide = true; e.opacity = 0; },
  update(e, dt) {
    e.stop();
    if (e.state === 'appear') { e.opacity = Math.min(1, e.t / 0.4); if (e.t > 0.5) { e.state = 'open'; e.t = 0; } }
    else if (e.state === 'open') {
      e.shotT = (e.shotT ?? 0.4) - dt;
      if (e.shotT <= 0) {
        e.shotT = 0.75;
        e.n = (e.n || 0) + 1;
        if (e.n === 3 && e.main && e.main.hp < e.main.maxHp * 0.6) {
          spawnLaser({ owner: 'enemy', x: e.x, z: e.z, angle: e.angleToPlayer(), duration: 0.6, width: 0.7, color: '#c01818', source: e.main });
          audio.play('laser');
        } else e.spread(e.angleToPlayer(), 3, 0.28, { speed: 4.6 });
      }
      if (e.t > 3.0) { e.state = 'close'; e.t = 0; }
    } else if (e.state === 'close') { e.opacity = 1 - e.t / 0.4; if (e.t > 0.4) e.destroy(); }
  },
  onHurt(e, dmg) { forward(e, dmg); e.hp = 9999; return 0; } });

DEFS.hm_heart = bossDef({ name: "the Housemother's heart", art: 'hm_heart', r: 1.25, wsize: [3.5, 3.5], shadow: 2.5, stationary: true, mass: 999,
  frame(e) { return e.beat > 0 ? 1 : 0; },
  init(e) { e.atkT = 1.5; e.beat = 0; e.beatT = 0; },
  update(e, dt) {
    e.stop();
    const k = e.hp / e.maxHp;
    e.beatT -= dt; e.beat -= dt;
    if (e.beatT <= 0) { e.beatT = 0.5 + k * 0.6; e.beat = 0.12; audio.play('heartbeat'); e.squashX = e.squashY = 1.08; }
    e.squashX = e.squashY = 1 + ((e.squashX || 1) - 1) * 0.85;
    e.atkT -= dt;
    if (e.attack) {
      const a = e.attack; a.t += dt;
      if (a.kind === 'pulse') {
        if (a.t > a.n * 0.5 && a.n < 3) { a.n++; e.ring(k < 0.5 ? 14 : 12, a.n * 0.13, { speed: 3.3 }); }
        if (a.n >= 3 && a.t > 1.6) e.attack = null;
      } else if (a.kind === 'sweep') {
        if (!a.lasers) {
          a.lasers = [];
          const n = k < 0.5 ? 3 : 2;
          for (let i = 0; i < n; i++) a.lasers.push(spawnLaser({ owner: 'enemy', x: e.x, z: e.z, angle: a.ang + i * TAU / n, duration: 3.2, width: 0.75, color: '#b01010', source: e }));
          audio.play('laser');
        }
        a.ang += dt * (k < 0.5 ? 0.85 : 0.65);
        a.lasers.forEach((l, i) => { l.angle = a.ang + i * TAU / a.lasers.length; });
        if (a.t > 3.3) e.attack = null;
      } else if (a.kind === 'clots') {
        if (!a.done) { a.done = true; const n = S.enemies.filter((o) => o.alive && (o.type === 'clot' || o.type === 'clotlet')).length; if (n < 3) for (let i = 0; i < 2; i++) spawnEnemy('clot', e.x + (i ? 2 : -2), e.z + 1.2); }
        if (a.t > 1) e.attack = null;
      } else if (a.kind === 'aimed') {
        if (a.t > a.n * 0.3 && a.n < 5) { a.n++; e.spread(e.angleToPlayer(), 3, 0.2, { speed: 5.4 }); }
        if (a.n >= 5) e.attack = null;
      }
    } else if (e.atkT <= 0) {
      e.atkT = 0.7 + k * 0.7;
      // sweeping beams only start once the heart has taken a beating
      const opts = k < 0.75 ? ['pulse', 'sweep', 'aimed', 'clots', 'pulse', 'sweep'] : ['pulse', 'aimed', 'clots', 'pulse'];
      e.attack = { kind: e.rng.pick(opts), t: 0, n: 0, ang: e.rng.range(0, TAU) };
    }
  },
  onDeath(e) {
    for (const l of S.lasers) l.destroy();
    for (const s of S.shots) s.pop();
    for (const o of S.enemies) if (o.alive && o !== e) o.die({});
    if (e.main && e.main.alive) { e.main.hp = 0; e.main.die({}); }
    for (let i = 0; i < 6; i++) setTimeout(() => { if (S.room) { gore(e.x + fxRng.range(-1.5, 1.5), e.z + fxRng.range(-1, 1), 1.5); addShake(0.6); audio.play('explosion'); } }, i * 250);
    audio.play('bossDie');
    S.game.state = 'cutscene';
    setTimeout(() => S.game.onWin(), 2600);
  } });

// ---- spawning -------------------------------------------------------------------------
export function spawnBoss(id, x, z) {
  const out = [];
  const mk = (type, bx, bz, hp) => {
    const e = spawnEnemy(type, bx, bz, { hp: hp / CFG.ENEMY_HP_FLOOR_SCALE[Math.min(S.floorNum, 5)] });
    if (e) { e.isBoss = true; e.spawnGrace = 0.3; out.push(e); }
    return e;
  };
  const hp = bossHp(id);
  if (id === 'rottwins') { mk('boss_gristle', x - 2.5, z, hp); mk('boss_marrow', x + 2.5, z - 0.5, hp); }
  else if (id === 'housemother') { const e = mk('boss_housemother', x, z, hp); }
  else mk('boss_' + id, x, z, hp);
  S.bossBarMax = id === 'housemother' ? S.bossBarMax : 0;
  return out;
}
