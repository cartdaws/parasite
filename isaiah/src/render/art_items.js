// Item / trinket / card icons, drawn from a library of crayon "shape" primitives.
// Items declare icon: [shape, colorA, colorB].
import { tex, blob, poly, scribble, dot, eye, glow, inkText, shade, rgba, INK, wobEllipse, crayonFill, ink } from './draw.js';
import { ITEMS, TRINKETS } from '../items/items.js';
import { CARDS } from '../items/consumables.js';

const C = 32; // center of a 64px icon

export const SHAPES = {
  thimble(ctx, r, a = '#b7b2a8') { poly(ctx, [[18, 50], [46, 50], [42, 16], [22, 16]], a, r, { lw: 3 }); blob(ctx, C, 16, 10, 4, shade(a, 0.2), r, { lw: 2.5 }); for (let y = 24; y < 48; y += 6) for (let x = 24; x < 42; x += 6) dot(ctx, x, y, 1.6, shade(a, -0.4)); },
  matchbook(ctx, r, a = '#c83a2a') { poly(ctx, [[14, 50], [50, 50], [50, 24], [14, 24]], a, r, { lw: 3 }); for (let i = 0; i < 4; i++) { scribble(ctx, [[20 + i * 8, 26], [20 + i * 8, 10]], 3, '#e8d8b0', r); dot(ctx, 20 + i * 8, 10, 3.5, '#6a2a1a'); } ctx.fillStyle = 'rgba(90,140,200,0.5)'; ctx.beginPath(); ctx.ellipse(36, 44, 8, 4, 0, 0, 7); ctx.fill(); },
  eyepatch(ctx, r, a = '#2a2a2a') { scribble(ctx, [[6, 22], [C, 34], [58, 20]], 3, INK, r); blob(ctx, C, 36, 14, 12, a, r, { lw: 3 }); eye(ctx, C, 18, 7, r, 0, 0, { iris: '#7a2a8a', lw: 2 }); },
  moth(ctx, r, a = '#c8b890', b = '#8a7a5a') { for (const d of [-1, 1]) { blob(ctx, C + d * 13, 26, 13, 11, a, r, { lw: 2.5, rot: d * 0.4 }); blob(ctx, C + d * 10, 42, 9, 8, b, r, { lw: 2.5 }); dot(ctx, C + d * 13, 26, 3.5, shade(b, -0.3)); } blob(ctx, C, C, 4, 14, '#5a4a3a', r, { lw: 2 }); scribble(ctx, [[C - 2, 18], [C - 8, 8]], 1.6, INK, r); scribble(ctx, [[C + 2, 18], [C + 8, 8]], 1.6, INK, r); },
  tooth(ctx, r, a = '#e8dcc0') { poly(ctx, [[16, 14], [48, 14], [44, 34], [40, 54], [34, 38], [30, 38], [24, 54], [20, 34]], a, r, { lw: 3 }); ctx.fillStyle = 'rgba(120,140,60,0.5)'; ctx.beginPath(); ctx.arc(38, 22, 5, 0, 7); ctx.fill(); },
  rosary(ctx, r, a = '#8a5a3a', b = '#b07a4a') { for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 1.6 + 0.8; dot(ctx, C + Math.cos(t) * 18, 24 + Math.sin(t) * 16, 3.5, i % 3 ? a : b); } scribble(ctx, [[C, 40], [C, 58]], 4, a, r); scribble(ctx, [[C - 6, 46], [C + 6, 46]], 4, a, r); },
  coin(ctx, r, a = '#8a6a3a') { blob(ctx, C, C, 18, 18, a, r, { lw: 3 }); scribble(ctx, [[C - 8, C - 6], [C + 6, C + 8]], 3, shade(a, -0.4), r); inkText(ctx, '¢', C, C + 8, 22, shade(a, 0.4), { align: 'center', lw: 2 }); },
  flies(ctx, r) { for (let i = 0; i < 3; i++) { const x = 18 + i * 14, y = 24 + (i % 2) * 14; blob(ctx, x - 4, y - 4, 4, 3, '#dfe8f0', r, { lw: 1.4 }); blob(ctx, x + 4, y - 4, 4, 3, '#dfe8f0', r, { lw: 1.4 }); blob(ctx, x, y, 5, 4, '#2a2224', r, { lw: 2 }); } scribble(ctx, [[10, 52], [20, 46], [30, 52], [40, 46], [54, 52]], 2, '#f0e090', r); },
  slingshot(ctx, r, a = '#8a5a2a') { scribble(ctx, [[C, 56], [C, 34], [18, 12]], 5, a, r); scribble(ctx, [[C, 34], [46, 12]], 5, a, r); scribble(ctx, [[18, 14], [C, 28], [46, 14]], 2, '#c8a080', r); },
  jar(ctx, r, a = '#c83020', b = '#9ab0b8') { blob(ctx, C, 38, 16, 18, rgba(b, 0.6), r, { lw: 3, hatch: 0.05 }); blob(ctx, C, 42, 13, 11, a, r, { lw: 0, ink: false }); poly(ctx, [[20, 16], [44, 16], [44, 24], [20, 24]], '#7a6a5a', r, { lw: 2.5 }); dot(ctx, 24, 32, 3, 'rgba(255,255,255,0.6)'); },
  eye(ctx, r, a = '#a02020', b = '#f2ead8') { eye(ctx, C, C, 18, r, 0.1, 0.1, { iris: a, white: b, lw: 3, pupilR: 0.36 }); for (let i = 0; i < 4; i++) scribble(ctx, [[14 + i * 3, 22 + i * 6], [20 + i * 2, 26 + i * 5]], 1.4, '#c03030', r); },
  kettle(ctx, r, a = '#4a4a52') { blob(ctx, C, 38, 18, 15, a, r, { lw: 3 }); poly(ctx, [[48, 36], [60, 24], [58, 30], [50, 42]], a, r, { lw: 2.5 }); scribble(ctx, [[20, 24], [C, 10], [44, 24]], 3.5, INK, r); blob(ctx, C, 23, 8, 3, shade(a, 0.2), r, { lw: 2 }); },
  sock(ctx, r, a = '#c84a3a', b = '#e8dcc0') { poly(ctx, [[22, 8], [40, 8], [40, 38], [52, 46], [48, 56], [26, 52], [22, 40]], a, r, { lw: 3 }); scribble(ctx, [[22, 16], [40, 16]], 3, b, r); scribble(ctx, [[22, 22], [40, 22]], 3, b, r); dot(ctx, 28, 34, 2.5, INK); dot(ctx, 34, 34, 2.5, INK); scribble(ctx, [[26, 42], [34, 40]], 2.4, INK, r); },
  onion(ctx, r, a = '#d8b0c8') { blob(ctx, C, 38, 18, 17, a, r, { lw: 3 }); poly(ctx, [[C - 4, 22], [C, 6], [C + 4, 22]], '#7aa04a', r, { lw: 2.4 }); for (const d of [-8, 0, 8]) scribble(ctx, [[C + d, 24], [C + d * 1.4, 40], [C + d, 54]], 1.4, shade(a, -0.3), r); },
  salt(ctx, r, a = '#e8e8f0') { poly(ctx, [[20, 54], [44, 54], [42, 18], [22, 18]], a, r, { lw: 3 }); blob(ctx, C, 16, 11, 5, '#9a9aa4', r, { lw: 2.5 }); for (let i = 0; i < 3; i++) dot(ctx, C - 4 + i * 4, 14, 1.4, INK); inkText(ctx, 'S', C, 44, 18, '#4a6ab0', { align: 'center', lw: 0 }); },
  bib(ctx, r, a = '#e8d8e8') { blob(ctx, C, 36, 18, 18, a, r, { lw: 3 }); ctx.fillStyle = '#050304'; ctx.beginPath(); ctx.arc(C, 18, 8, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(120,180,230,0.7)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(24 + i * 8, 40, 2.5, 5, 0, 0, 7); ctx.fill(); } },
  fork(ctx, r, a = '#c0c0c8') { scribble(ctx, [[20, 56], [C, 30]], 5, a, r); scribble(ctx, [[C, 30], [44, 12], [40, 8]], 5, a, r); for (let i = 0; i < 3; i++) scribble(ctx, [[C - 4 + i * 4, 28], [C + 2 + i * 5, 10]], 2.5, a, r); },
  rod(ctx, r, a = '#8a6a3a') { scribble(ctx, [[C, 58], [C, 30], [16, 8]], 4, a, r); scribble(ctx, [[C, 30], [48, 8]], 4, a, r); glow(ctx, C, 30, 14, '#80c0ff', 0.6); },
  needle(ctx, r, a = '#c0c0c8') { scribble(ctx, [[10, 54], [54, 10]], 4, a, r); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(48, 16, 4, 2, -0.8, 0, 7); ctx.stroke(); scribble(ctx, [[48, 16], [56, 30], [44, 44], [52, 56]], 2, '#c84a6a', r, 2); },
  marble(ctx, r, a = '#4a8ac8', b = '#e8d040') { blob(ctx, C, C, 17, 17, a, r, { lw: 3, hatch: 0.1 }); scribble(ctx, [[20, 30], [C, 22], [44, 34], [C, 44]], 3, b, r); scribble(ctx, [[22, 24], [44, 44]], 1.6, INK, r); dot(ctx, 24, 24, 4, 'rgba(255,255,255,0.7)'); },
  blood(ctx, r, a = '#a01010') { poly(ctx, [[C, 6], [48, 34], [44, 50], [C, 56], [20, 50], [16, 34]], a, r, { lw: 3 }); dot(ctx, 26, 34, 4, 'rgba(255,200,200,0.5)'); },
  can(ctx, r, a = '#a8a8b0') { poly(ctx, [[18, 54], [18, 22], [40, 22], [40, 54]], a, r, { lw: 3 }); blob(ctx, 29, 22, 11, 4, shade(a, 0.2), r, { lw: 2.5 }); scribble(ctx, [[29, 22], [40, 12], [52, 18], [58, 8]], 2, '#c8a060', r, 2); },
  straw(ctx, r, a = '#e84a4a', b = '#f0e8e0') { for (let i = 0; i < 6; i++) scribble(ctx, [[14 + i * 6, 54 - i * 6], [20 + i * 6, 48 - i * 6]], 6, i % 2 ? a : b, r, 0.5); scribble(ctx, [[48, 18], [52, 8]], 6, a, r); },
  lint(ctx, r, a = '#a8a0b0') { blob(ctx, C, C, 16, 15, a, r, { lw: 2.5, wob: 0.3, n: 14, hatch: 0.5 }); for (let i = 0; i < 8; i++) { const t = r.range(0, 6.28); scribble(ctx, [[C + Math.cos(t) * 14, C + Math.sin(t) * 14], [C + Math.cos(t) * 20, C + Math.sin(t) * 20]], 1.4, shade(a, -0.3), r, 2); } dot(ctx, 28, 30, 2, INK); dot(ctx, 36, 30, 2, INK); },
  doll(ctx, r, a = '#e8dcc0') { poly(ctx, [[C, 8], [42, 18], [38, 28], [54, 30], [52, 36], [40, 36], [46, 56], [38, 56], [C, 42], [26, 56], [18, 56], [24, 36], [12, 36], [10, 30], [26, 28], [22, 18]], a, r, { lw: 2.6 }); dot(ctx, 28, 18, 2, INK); dot(ctx, 36, 18, 2, INK); scribble(ctx, [[28, 24], [36, 24]], 1.6, INK, r); },
  puppet(ctx, r, a = '#6a8ac8') { poly(ctx, [[16, 58], [16, 26], [48, 26], [48, 58]], a, r, { lw: 3 }); blob(ctx, C, 22, 17, 12, shade(a, 0.1), r, { lw: 3 }); eye(ctx, 26, 16, 5, r, 0, 0, { lw: 1.6 }); eye(ctx, 40, 16, 5, r, 0, 0, { lw: 1.6 }); scribble(ctx, [[18, 28], [C, 34], [46, 28]], 3, '#3a0a0a', r); },
  bunny(ctx, r, a = '#9a9090') { blob(ctx, C, 40, 17, 14, a, r, { lw: 2.6, wob: 0.25, hatch: 0.5 }); for (const d of [-1, 1]) blob(ctx, C + d * 8, 18, 4, 11, a, r, { lw: 2.4, hatch: 0.4 }); dot(ctx, 26, 38, 2.5, '#d02020'); dot(ctx, 38, 38, 2.5, '#d02020'); },
  dandelion(ctx, r) { scribble(ctx, [[C, 58], [C - 2, 30]], 3, '#5a8a3a', r); for (let i = 0; i < 16; i++) { const t = (i / 16) * 6.28; scribble(ctx, [[C - 2, 24], [C - 2 + Math.cos(t) * 16, 24 + Math.sin(t) * 16]], 1.4, '#e8e8e0', r); dot(ctx, C - 2 + Math.cos(t) * 16, 24 + Math.sin(t) * 16, 2, '#f8f8f0'); } },
  wings(ctx, r, a = '#e8e8f0') { for (const d of [-1, 1]) poly(ctx, [[C + d * 4, 34], [C + d * 26, 10], [C + d * 28, 24], [C + d * 22, 34], [C + d * 24, 44], [C + d * 8, 44]], a, r, { lw: 2.6 }); },
  collar(ctx, r, a = '#c83a3a') { ctx.lineWidth = 7; ctx.strokeStyle = a; ctx.beginPath(); ctx.ellipse(C, 28, 20, 14, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); blob(ctx, C, 46, 7, 7, '#e8c040', r, { lw: 2.4 }); },
  ghost(ctx, r, a = '#d8e0ec') { poly(ctx, [[14, 54], [14, 26], [C, 8], [50, 26], [50, 54], [42, 48], [C, 56], [22, 48]], a, r, { lw: 3 }); dot(ctx, 26, 28, 3.5, INK); dot(ctx, 38, 28, 3.5, INK); blob(ctx, C, 40, 4, 5, INK, r, { lw: 0, ink: false }); },
  firework(ctx, r, a = '#c83a2a') { for (let i = 0; i < 3; i++) poly(ctx, [[12 + i * 14, 56], [12 + i * 14, 22], [22 + i * 14, 22], [22 + i * 14, 56]], i % 2 ? '#3a5ac8' : a, r, { lw: 2.4 }); for (let i = 0; i < 3; i++) scribble(ctx, [[17 + i * 14, 22], [19 + i * 14, 10]], 2, INK, r); glow(ctx, 47, 8, 8, '#ffd040', 0.9); },
  doorbell(ctx, r, a = '#c8a040') { poly(ctx, [[16, 54], [16, 12], [48, 12], [48, 54]], '#6a5a4a', r, { lw: 3 }); blob(ctx, C, C, 10, 10, a, r, { lw: 3 }); blob(ctx, C, C, 4, 4, '#e83030', r, { lw: 1.6 }); },
  gum(ctx, r, a = '#e890c0') { blob(ctx, C, 34, 18, 14, a, r, { lw: 3, wob: 0.25 }); scribble(ctx, [[C, 22], [C - 6, 10], [C + 4, 6]], 3, a, r); dot(ctx, 26, 30, 3, 'rgba(255,255,255,0.6)'); },
  egg(ctx, r, a = '#d8d0a8') { blob(ctx, C, 36, 15, 19, a, r, { lw: 3 }); scribble(ctx, [[22, 30], [28, 36], [34, 28], [40, 36]], 2, INK, r); for (let i = 0; i < 3; i++) scribble(ctx, [[24 + i * 8, 16], [26 + i * 8, 6]], 2, '#8ab030', r, 2); },
  seeds(ctx, r, a = '#8a6a3a') { for (let i = 0; i < 7; i++) blob(ctx, 16 + (i % 4) * 10 + (i > 3 ? 5 : 0), 24 + Math.floor(i / 4) * 16, 5, 7, a, r, { lw: 2, rot: r.range(-1, 1) }); },
  apron(ctx, r, a = '#c8c0b0') { poly(ctx, [[18, 14], [46, 14], [52, 56], [12, 56]], a, r, { lw: 3 }); scribble(ctx, [[18, 14], [10, 4]], 2.5, INK, r); scribble(ctx, [[46, 14], [54, 4]], 2.5, INK, r); for (let i = 0; i < 4; i++) dot(ctx, 22 + r.range(0, 20), 26 + r.range(0, 24), 4, '#2a2a2a'); },
  map(ctx, r, a = '#e8dcc0') { poly(ctx, [[8, 14], [24, 10], [40, 14], [56, 10], [56, 52], [40, 56], [24, 52], [8, 56]], a, r, { lw: 3 }); for (const [x, y] of [[18, 24], [30, 24], [30, 36], [42, 36], [42, 46]]) poly(ctx, [[x - 4, y - 4], [x + 4, y - 4], [x + 4, y + 4], [x - 4, y + 4]], '#7a6a5a', r, { lw: 1.6, hatch: 0 }); scribble(ctx, [[38, 42], [46, 50]], 2.5, '#c83030', r); scribble(ctx, [[46, 42], [38, 50]], 2.5, '#c83030', r); },
  shell(ctx, r, a = '#e8c0a8') { poly(ctx, [[C, 8], [54, 44], [C, 54], [10, 44]], a, r, { lw: 3 }); for (let i = -2; i <= 2; i++) scribble(ctx, [[C, 10], [C + i * 9, 50]], 1.6, shade(a, -0.3), r); scribble(ctx, [[C, 30], [C, 14]], 3, '#c83030', r); },
  bug(ctx, r, a = '#e8d040') { glow(ctx, C, 40, 20, '#fff080', 0.7); blob(ctx, C, 40, 9, 11, a, r, { lw: 2.5 }); blob(ctx, C, 24, 8, 8, '#3a3a2a', r, { lw: 2.5 }); for (const d of [-1, 1]) blob(ctx, C + d * 11, 28, 7, 4, 'rgba(220,230,255,0.8)', r, { lw: 1.4, rot: d * 0.5 }); },
  plate(ctx, r, a = '#e8e8e0') { blob(ctx, C, 38, 24, 12, a, r, { lw: 3 }); blob(ctx, 26, 34, 8, 5, '#f0e8c0', r, { lw: 2 }); dot(ctx, 26, 34, 3.5, '#f0c040'); poly(ctx, [[36, 32], [48, 30], [48, 38], [36, 40]], '#c89a5a', r, { lw: 2 }); },
  pie(ctx, r, a = '#c8904a', b = '#8a2a2a') { blob(ctx, C, 38, 22, 13, a, r, { lw: 3 }); blob(ctx, C, 34, 18, 8, shade(a, 0.15), r, { lw: 2 }); for (let i = 0; i < 3; i++) scribble(ctx, [[20 + i * 10, 30], [24 + i * 10, 38]], 2, b, r); },
  heart(ctx, r, a = '#c81e1e') { const pts = []; for (let i = 0; i <= 24; i++) { const t = (i / 24) * Math.PI * 2; pts.push([C + 16 * Math.pow(Math.sin(t), 3) * 1.2, 34 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 1.2]); } poly(ctx, pts, a, r, { lw: 3, jit: 0.5 }); dot(ctx, 22, 26, 4, 'rgba(255,255,255,0.5)'); },
  cube(ctx, r, a = '#f0ece0') { poly(ctx, [[14, 24], [C, 14], [50, 24], [C, 34]], shade(a, 0.1), r, { lw: 2.6 }); poly(ctx, [[14, 24], [C, 34], [C, 54], [14, 44]], a, r, { lw: 2.6 }); poly(ctx, [[C, 34], [50, 24], [50, 44], [C, 54]], shade(a, -0.15), r, { lw: 2.6 }); },
  bottle(ctx, r, a = '#60a0e0', b = '#b8c8d0') { blob(ctx, C, 40, 15, 16, rgba(b, 0.7), r, { lw: 3, hatch: 0.05 }); blob(ctx, C, 44, 12, 10, a, r, { lw: 0, ink: false }); poly(ctx, [[27, 24], [37, 24], [37, 10], [27, 10]], rgba(b, 0.8), r, { lw: 2.5 }); poly(ctx, [[26, 10], [38, 10], [38, 4], [26, 4]], '#8a5a3a', r, { lw: 2 }); dot(ctx, 25, 36, 3, 'rgba(255,255,255,0.7)'); },
  book(ctx, r, a = '#6a2a5a', b = '#e8c040') { poly(ctx, [[14, 8], [48, 8], [48, 56], [14, 56]], a, r, { lw: 3 }); scribble(ctx, [[18, 8], [18, 56]], 2.5, shade(a, -0.4), r); poly(ctx, [[26, 20], [42, 20], [42, 36], [26, 36]], b, r, { lw: 2, hatch: 0 }); },
  ice(ctx, r, a = '#a8e0f8') { for (let i = 0; i < 4; i++) poly(ctx, [[12 + (i % 2) * 22, 12 + Math.floor(i / 2) * 22], [30 + (i % 2) * 22, 12 + Math.floor(i / 2) * 22], [30 + (i % 2) * 22, 30 + Math.floor(i / 2) * 22], [12 + (i % 2) * 22, 30 + Math.floor(i / 2) * 22]], a, r, { lw: 2.4, hatch: 0.1 }); },
  ball(ctx, r, a = '#e84a4a', b = '#f0e040') { blob(ctx, C, C, 18, 18, a, r, { lw: 3 }); scribble(ctx, [[14, C], [50, C]], 4, b, r); dot(ctx, 24, 22, 4, 'rgba(255,255,255,0.6)'); },
  die(ctx, r, a = '#f0e8d8') { poly(ctx, [[12, 14], [50, 12], [52, 50], [14, 52]], a, r, { lw: 3 }); for (const [x, y] of [[22, 22], [42, 22], [C, C], [22, 42], [42, 42], [22, C]]) dot(ctx, x, y, 3.5, '#a01818'); },
  photo(ctx, r, a = '#e8e0d0') { poly(ctx, [[10, 12], [54, 10], [56, 54], [12, 56]], a, r, { lw: 3 }); poly(ctx, [[16, 16], [50, 16], [50, 44], [16, 44]], '#8a9aa0', r, { lw: 2 }); blob(ctx, 28, 34, 5, 6, '#5a4a40', r, { lw: 1.6 }); blob(ctx, 40, 32, 5, 7, '#5a4a40', r, { lw: 1.6 }); },
  shoe(ctx, r, a = '#7a4a2a') { poly(ctx, [[10, 46], [10, 22], [26, 22], [30, 34], [54, 38], [54, 48]], a, r, { lw: 3 }); scribble(ctx, [[10, 50], [56, 50]], 3, INK, r); scribble(ctx, [[18, 46], [10, 58], [4, 52]], 2.5, '#c8c8c8', r); },
  cup(ctx, r, a = '#80c0f0') { poly(ctx, [[16, 22], [48, 22], [44, 56], [20, 56]], a, r, { lw: 3 }); blob(ctx, C, 22, 16, 5, '#e8e0f0', r, { lw: 2.4 }); scribble(ctx, [[36, 22], [42, 6]], 3, '#e84a4a', r); },
  rocket(ctx, r, a = '#c83a2a') { poly(ctx, [[C, 6], [42, 22], [42, 46], [22, 46], [22, 22]], a, r, { lw: 3 }); for (const d of [-1, 1]) poly(ctx, [[C + d * 10, 36], [C + d * 18, 52], [C + d * 10, 46]], '#e8dcc0', r, { lw: 2 }); glow(ctx, C, 54, 10, '#ffa020', 0.9); },
  hammer(ctx, r, a = '#8a8a90') { scribble(ctx, [[C, 58], [C, 24]], 6, '#8a5a2a', r); poly(ctx, [[14, 12], [50, 12], [50, 26], [14, 26]], a, r, { lw: 3 }); },
  crystal(ctx, r, a = '#c0a0f0') { glow(ctx, C, 28, 22, '#e0c8ff', 0.6); blob(ctx, C, 28, 16, 16, rgba(a, 0.8), r, { lw: 3, hatch: 0.05 }); poly(ctx, [[18, 48], [46, 48], [50, 58], [14, 58]], '#6a4a3a', r, { lw: 2.6 }); dot(ctx, 25, 22, 4, 'rgba(255,255,255,0.8)'); },
  wand(ctx, r, a = '#f0a0d0') { scribble(ctx, [[12, 56], [40, 24]], 4, '#8a6a4a', r); ctx.lineWidth = 4; ctx.strokeStyle = a; ctx.beginPath(); ctx.arc(46, 18, 10, 0, 7); ctx.stroke(); for (let i = 0; i < 3; i++) { ctx.strokeStyle = rgba('#a0d0ff', 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(20 + i * 10, 14 + i * 4, 4, 0, 7); ctx.stroke(); } },
  globe(ctx, r, a = '#c0e0f8') { blob(ctx, C, 28, 18, 18, rgba(a, 0.7), r, { lw: 3, hatch: 0.05 }); poly(ctx, [[14, 46], [50, 46], [46, 58], [18, 58]], '#6a3a2a', r, { lw: 2.6 }); for (let i = 0; i < 8; i++) dot(ctx, 20 + r.range(0, 24), 18 + r.range(0, 20), 1.6, '#ffffff'); poly(ctx, [[26, 40], [C, 28], [38, 40]], '#3a6a3a', r, { lw: 1.6 }); },
  skull(ctx, r, a = '#e8e0d0') { blob(ctx, C, 26, 18, 16, a, r, { lw: 3 }); poly(ctx, [[22, 38], [42, 38], [40, 52], [24, 52]], a, r, { lw: 2.6 }); blob(ctx, 25, 26, 5, 6, INK, r, { lw: 0, ink: false }); blob(ctx, 39, 26, 5, 6, INK, r, { lw: 0, ink: false }); for (let i = 0; i < 3; i++) scribble(ctx, [[27 + i * 5, 44], [27 + i * 5, 52]], 1.6, INK, r); },
  candle(ctx, r, a = '#efe4c4') { glow(ctx, C, 14, 16, '#ffcc55', 0.8); poly(ctx, [[24, 56], [24, 24], [40, 24], [40, 56]], a, r, { lw: 3 }); poly(ctx, [[C, 4], [36, 16], [C, 22], [28, 16]], '#ffb030', r, { lw: 1.6, hatch: 0 }); scribble(ctx, [[26, 30], [28, 38]], 3, shade(a, -0.2), r); },
  halo(ctx, r, a = '#ffe98a') { glow(ctx, C, C, 26, '#fff2a0', 0.5); ctx.lineWidth = 6; ctx.strokeStyle = a; ctx.beginPath(); ctx.ellipse(C, C, 20, 9, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(C, C, 23, 12, 0, 0, 7); ctx.stroke(); },
  feather(ctx, r, a = '#f0f0f8') { poly(ctx, [[14, 54], [24, 34], [40, 14], [52, 8], [48, 22], [34, 40]], a, r, { lw: 2.6 }); scribble(ctx, [[12, 58], [48, 12]], 2, INK, r); },
  horns(ctx, r, a = '#4a1010') { for (const d of [-1, 1]) poly(ctx, [[C + d * 6, 50], [C + d * 24, 30], [C + d * 22, 6], [C + d * 14, 30], [C + d * 2, 40]], a, r, { lw: 3 }); },
  chalk(ctx, r, a = '#f0f0f0') { ctx.strokeStyle = rgba('#e8e8e8', 0.8); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(C, C, 20, 0, 7); ctx.stroke(); for (let i = 0; i < 5; i++) { const t1 = (i / 5) * 6.28 - 1.57, t2 = ((i + 2) / 5) * 6.28 - 1.57; scribble(ctx, [[C + Math.cos(t1) * 20, C + Math.sin(t1) * 20], [C + Math.cos(t2) * 20, C + Math.sin(t2) * 20]], 2.4, '#c03030', r); } },
  scroll(ctx, r, a = '#e8dcc0') { poly(ctx, [[14, 12], [50, 12], [50, 52], [14, 52]], a, r, { lw: 3 }); for (let y = 20; y < 48; y += 6) scribble(ctx, [[20, y], [44, y]], 1.4, rgba(INK, 0.6), r); },
  key(ctx, r, a = '#d8d0c0') { blob(ctx, 20, 20, 10, 10, a, r, { lw: 3 }); dot(ctx, 20, 20, 3.5, INK); scribble(ctx, [[26, 26], [52, 52]], 5, a, r); scribble(ctx, [[44, 44], [50, 38]], 4, a, r); scribble(ctx, [[48, 48], [54, 42]], 4, a, r); },
  bag(ctx, r, a = '#7a5a3a') { blob(ctx, C, 40, 19, 16, a, r, { lw: 3 }); poly(ctx, [[24, 24], [40, 24], [44, 14], [20, 14]], shade(a, 0.1), r, { lw: 2.5 }); scribble(ctx, [[22, 24], [42, 24]], 3, '#c8a040', r); blob(ctx, C, 42, 6, 6, '#2a2a30', r, { lw: 2 }); },
  button(ctx, r, a = '#c84a8a') { blob(ctx, C, C, 16, 16, a, r, { lw: 3 }); for (const [x, y] of [[27, 27], [37, 27], [27, 37], [37, 37]]) dot(ctx, x, y, 3, shade(a, -0.5)); },
  clip(ctx, r, a = '#c0c0c8') { scribble(ctx, [[22, 50], [22, 16], [40, 16], [40, 46], [28, 46], [28, 22], [34, 22], [34, 40]], 3, a, r); },
  arm(ctx, r, a = '#e8c8b0') { poly(ctx, [[12, 50], [36, 24], [42, 30], [18, 56]], a, r, { lw: 3 }); blob(ctx, 44, 20, 8, 8, a, r, { lw: 2.6 }); scribble(ctx, [[18, 44], [22, 48]], 1.6, INK, r); },
  cap(ctx, r, a = '#c83a3a') { blob(ctx, C, C, 18, 18, a, r, { lw: 3 }); for (let i = 0; i < 12; i++) { const t = (i / 12) * 6.28; dot(ctx, C + Math.cos(t) * 18, C + Math.sin(t) * 18, 2.5, shade(a, -0.4)); } inkText(ctx, '★', C, C + 7, 18, '#f0e040', { align: 'center', lw: 0 }); },
  hairpin(ctx, r, a = '#3a3a3a') { scribble(ctx, [[16, 10], [44, 54]], 3, a, r); scribble(ctx, [[24, 10], [48, 50], [44, 54]], 3, a, r); blob(ctx, 18, 12, 6, 5, '#e84a8a', r, { lw: 2 }); },
  hook(ctx, r, a = '#a0a0a8') { scribble(ctx, [[C, 6], [C, 40]], 3, a, r); ctx.lineWidth = 3.5; ctx.strokeStyle = a; ctx.beginPath(); ctx.arc(C - 8, 40, 8, 0, Math.PI); ctx.stroke(); scribble(ctx, [[C - 16, 40], [C - 12, 34]], 3, a, r); },
  mushroom(ctx, r, a = '#b3302a') { poly(ctx, [[26, 56], [26, 34], [38, 34], [38, 56]], '#e8dcc0', r, { lw: 3 }); blob(ctx, C, 30, 22, 14, a, r, { lw: 3 }); for (const [x, y] of [[22, 26], [36, 22], [42, 32]]) dot(ctx, x, y, 3.5, '#f0e4cf'); },
  crown(ctx, r, a = '#c9a02a') { poly(ctx, [[10, 50], [10, 18], [22, 32], [C, 12], [42, 32], [54, 18], [54, 50]], a, r, { lw: 3 }); for (const x of [20, C, 44]) dot(ctx, x, 42, 3.5, '#c83030'); },
  star(ctx, r, a = '#f0d040') { const p = []; for (let i = 0; i < 10; i++) { const t = (i / 10) * 6.28 - 1.57, rr = i % 2 ? 9 : 22; p.push([C + Math.cos(t) * rr, C + Math.sin(t) * rr]); } poly(ctx, p, a, r, { lw: 3 }); },
  leaf(ctx, r, a = '#5ab84a') { for (const [x, y] of [[22, 22], [42, 22], [22, 42], [42, 42]]) blob(ctx, x, y, 11, 11, a, r, { lw: 2.6 }); scribble(ctx, [[C, C], [C + 6, 58]], 3, '#3a6a2a', r); },
  bell(ctx, r, a = '#d8b040') { poly(ctx, [[14, 48], [20, 20], [C, 10], [44, 20], [50, 48]], a, r, { lw: 3 }); dot(ctx, C, 52, 5, INK); },
  lantern(ctx, r, a = '#e8a040') { glow(ctx, C, 36, 24, '#ffc060', 0.7); blob(ctx, C, 36, 15, 18, rgba(a, 0.9), r, { lw: 3 }); for (const d of [-6, 0, 6]) scribble(ctx, [[C + d, 20], [C + d * 1.5, 36], [C + d, 52]], 1.4, shade(a, -0.4), r); scribble(ctx, [[C, 18], [C, 6]], 2.5, INK, r); },
  spider(ctx, r, a = '#2a2020') { for (let i = 0; i < 4; i++) for (const d of [-1, 1]) scribble(ctx, [[C, 36], [C + d * 16, 24 + i * 6], [C + d * 26, 32 + i * 7]], 2.4, INK, r); blob(ctx, C, 36, 12, 10, a, r, { lw: 2.6 }); for (const [x, y] of [[26, 32], [38, 32], [29, 38], [35, 38]]) dot(ctx, x, y, 2.4, '#e04040'); },
  worm(ctx, r, a = '#d07a8a') { for (let i = 0; i < 6; i++) blob(ctx, 12 + i * 8, C + Math.sin(i * 1.3) * 10, 7, 7, a, r, { lw: 2.4 }); dot(ctx, 52, C + Math.sin(6.5) * 10 - 2, 2, INK); },
  kaleido(ctx, r) { const cols = ['#e84a4a', '#f0d040', '#4ab84a', '#4a8ae8', '#c84ae8', '#e8904a']; for (let i = 0; i < 6; i++) { const t1 = (i / 6) * 6.28, t2 = ((i + 1) / 6) * 6.28; poly(ctx, [[C, C], [C + Math.cos(t1) * 22, C + Math.sin(t1) * 22], [C + Math.cos(t2) * 22, C + Math.sin(t2) * 22]], cols[i], r, { lw: 2, hatch: 0 }); } },
  drawer(ctx, r, a = '#8a6a4a') { poly(ctx, [[8, 28], [56, 28], [56, 54], [8, 54]], a, r, { lw: 3 }); dot(ctx, C, 41, 3.5, '#c8a040'); scribble(ctx, [[14, 28], [20, 14], [24, 26]], 3, '#c0c0c8', r); blob(ctx, 38, 22, 6, 6, '#e84a4a', r, { lw: 2 }); scribble(ctx, [[46, 28], [50, 12]], 3, '#e8d040', r); },
  ball8(ctx, r) { blob(ctx, C, C, 19, 19, '#1a1a22', r, { lw: 3 }); blob(ctx, C, C - 2, 8, 8, '#f0f0f0', r, { lw: 2 }); inkText(ctx, '8', C, C + 3, 13, INK, { align: 'center', lw: 0 }); },
  pill(ctx, r, a = '#e84a4a', b = '#f0f0f0') { ctx.save(); ctx.translate(C, C); ctx.rotate(-0.7); poly(ctx, [[-20, -8], [0, -8], [0, 8], [-20, 8]], a, r, { lw: 3 }); poly(ctx, [[0, -8], [20, -8], [20, 8], [0, 8]], b, r, { lw: 3 }); ctx.restore(); },
  fist(ctx, r, a = '#e8c0a0') { blob(ctx, C, 34, 18, 16, a, r, { lw: 3 }); for (let i = 0; i < 3; i++) scribble(ctx, [[22 + i * 9, 22], [22 + i * 9, 32]], 2, INK, r); poly(ctx, [[20, 46], [44, 46], [42, 58], [22, 58]], '#c84a3a', r, { lw: 2.4 }); },
  bone(ctx, r, a = '#e6dcc4') { scribble(ctx, [[16, 48], [48, 16]], 8, a, r); for (const [x, y] of [[12, 46], [18, 52], [46, 12], [52, 18]]) blob(ctx, x, y, 6, 6, a, r, { lw: 2.4 }); },
  pepper(ctx, r, a = '#c82a1a') { poly(ctx, [[20, 54], [44, 54], [42, 20], [22, 20]], 'rgba(220,220,230,0.7)', r, { lw: 3 }); blob(ctx, C, 42, 10, 10, a, r, { lw: 0, ink: false }); blob(ctx, C, 18, 11, 5, '#4a4a4a', r, { lw: 2.5 }); },
};
// letter: heart on an envelope
SHAPES.letter = function (ctx, r, a = '#f0e4e8') { poly(ctx, [[8, 18], [56, 18], [56, 50], [8, 50]], a, r, { lw: 3 }); scribble(ctx, [[8, 18], [C, 36], [56, 18]], 2.5, INK, r); ctx.save(); ctx.translate(C, 38); ctx.scale(0.35, 0.35); ctx.translate(-C, -C); SHAPES.heart(ctx, r, '#e84a7a'); ctx.restore(); };

export function drawIcon(ctx, icon, rng) {
  const [shape, a, b] = icon || ['jar'];
  (SHAPES[shape] || SHAPES.jar)(ctx, rng, a, b);
}
export function itemIconTex(id) {
  return tex('item:' + id, 64, 64, (ctx, w, h, rng) => drawIcon(ctx, ITEMS[id]?.icon, rng));
}
export function trinketIconTex(id) {
  return tex('trinket:' + id, 64, 64, (ctx, w, h, rng) => {
    ctx.translate(6, 6); ctx.scale(0.82, 0.82);
    drawIcon(ctx, TRINKETS[id]?.icon || ['button'], rng);
  });
}
export function cardTex(id) {
  return tex('card:' + id, 72, 96, (ctx, w, h, rng) => {
    const c = CARDS[id] || {};
    poly(ctx, [[6, 6], [66, 4], [68, 90], [4, 92]], '#ece2c8', rng, { lw: 3, hatch: 0.1 });
    poly(ctx, [[12, 12], [60, 11], [61, 84], [11, 85]], c.bg || '#3a2a4a', rng, { lw: 2, hatch: 0.25 });
    ctx.save(); ctx.translate(36 - 25, 44 - 25); ctx.scale(0.78, 0.78);
    drawIcon(ctx, c.icon || ['star'], rng);
    ctx.restore();
    inkText(ctx, c.numeral || '', 36, 82, 13, '#f1e6cc', { align: 'center', lw: 3 });
  });
}
