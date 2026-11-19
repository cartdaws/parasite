// Crayon-style canvas drawing helpers. All game art is drawn with these at
// startup (or lazily) and uploaded as textures.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';

export const INK = '#1b120e';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

// ---- colors ----------------------------------------------------------------
export function hexToRgb(hex) {
  if (typeof hex === 'number') return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
/** amt > 0 lightens toward white, < 0 darkens toward black */
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex([r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt]);
  return rgbToHex([r * (1 + amt), g * (1 + amt), b * (1 + amt)]);
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
export function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }

// ---- wobbly shapes -----------------------------------------------------------
/** Build a wobbly ellipse path. */
export function wobEllipse(ctx, cx, cy, rx, ry, rng, wob = 0.07, n = 20, rot = 0) {
  ctx.beginPath();
  const ph = rng.next() * 6.28;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (Math.sin(a * 3 + ph) * 0.5 + (rng.next() - 0.5)) * wob;
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    const px = cx + x * Math.cos(rot) - y * Math.sin(rot);
    const py = cy + x * Math.sin(rot) + y * Math.cos(rot);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
/** Build a wobbly polygon path from points [[x,y],...] */
export function wobPoly(ctx, pts, rng, jit = 1.2, closed = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = x + (rng.next() - 0.5) * jit, py = y + (rng.next() - 0.5) * jit;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  if (closed) ctx.closePath();
}
/** Fill the current path with a base color + crayon hatching, clipped to the path. */
export function crayonFill(ctx, color, rng, opts = {}) {
  const { hatch = 0.22, light = 0.22, dark = -0.25, spacing = 3, angle = -0.8, shadeDir = true } = opts;
  ctx.save();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.clip();
  const w = ctx.canvas.width, h = ctx.canvas.height;
  // soft shading: darker at the bottom right, lighter top left
  if (shadeDir) {
    const g = ctx.createLinearGradient(0, 0, w * 0.6, h);
    g.addColorStop(0, rgba(shade(color, light), 0.35));
    g.addColorStop(0.55, rgba(color, 0));
    g.addColorStop(1, rgba(shade(color, dark), 0.45));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (hatch > 0) {
    ctx.lineWidth = 1.2;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const L = w + h;
    for (let d = -L; d < L; d += spacing + rng.next() * spacing) {
      ctx.strokeStyle = rgba(rng.next() < 0.5 ? shade(color, light) : shade(color, dark), hatch * (0.5 + rng.next()));
      ctx.beginPath();
      const ox = w / 2 + d * -sa, oy = h / 2 + d * ca;
      ctx.moveTo(ox - ca * L, oy - sa * L);
      ctx.lineTo(ox + ca * L, oy + sa * L);
      ctx.stroke();
    }
  }
  ctx.restore();
}
/** Crayon outline on the current path: a thick dark pass and a thin rough pass. */
export function ink(ctx, w = 3, color = INK) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.globalAlpha = 0.35; ctx.lineWidth = Math.max(1, w * 0.4);
  ctx.translate(0.8, 0.6); ctx.stroke();
  ctx.restore();
}
export function blob(ctx, x, y, rx, ry, color, rng, opts = {}) {
  wobEllipse(ctx, x, y, rx, ry, rng, opts.wob ?? 0.07, opts.n ?? 20, opts.rot ?? 0);
  if (color) crayonFill(ctx, color, rng, opts);
  if (opts.ink !== false) ink(ctx, opts.lw ?? 3, opts.inkColor);
}
export function poly(ctx, pts, color, rng, opts = {}) {
  wobPoly(ctx, pts, rng, opts.jit ?? 1.2);
  if (color) crayonFill(ctx, color, rng, opts);
  if (opts.ink !== false) ink(ctx, opts.lw ?? 3, opts.inkColor);
}
/** Wobbly stroked polyline */
export function scribble(ctx, pts, w, color, rng, jit = 0.8) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = x + (rng.next() - 0.5) * jit, py = y + (rng.next() - 0.5) * jit;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.restore();
}
/** A cartoon eye: white, pupil looking (lx,ly) in -1..1 */
export function eye(ctx, x, y, r, rng, lx = 0, ly = 0, opts = {}) {
  const { white = '#f2ead8', pupil = INK, iris = null, lw = 2, lid = 0 } = opts;
  blob(ctx, x, y, r, r * (opts.squash ?? 1.05), white, rng, { hatch: 0.08, lw, wob: 0.05 });
  if (iris) { ctx.fillStyle = iris; ctx.beginPath(); ctx.arc(x + lx * r * 0.35, y + ly * r * 0.35, r * 0.58, 0, 7); ctx.fill(); }
  ctx.fillStyle = pupil;
  ctx.beginPath(); ctx.arc(x + lx * r * 0.4, y + ly * r * 0.4, r * (opts.pupilR ?? 0.42), 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(x + lx * r * 0.4 - r * 0.15, y + ly * r * 0.4 - r * 0.18, r * 0.13, 0, 7); ctx.fill();
  if (lid > 0) { // droopy eyelid
    ctx.save(); wobEllipse(ctx, x, y, r, r * 1.05, rng, 0.03); ctx.clip();
    ctx.fillStyle = opts.lidColor || '#c99a7c'; ctx.fillRect(x - r - 2, y - r - 2, r * 2 + 4, r * 2 * lid + 2);
    ctx.restore();
    scribble(ctx, [[x - r, y - r + r * 2 * lid], [x + r, y - r + r * 2 * lid]], lw, INK, rng, 0.4);
  }
}
export function dot(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }

/** Soft circular glow */
export function glow(ctx, x, y, r, color, a = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Hand-lettered text with an ink outline */
export const FONT = '"Patrick Hand", "Comic Neue", "Comic Sans MS", "Chalkboard SE", "Marker Felt", "Segoe Print", cursive';
export function inkText(ctx, text, x, y, size, color = '#f1e6cc', opts = {}) {
  ctx.save();
  ctx.font = `${opts.weight || 'bold'} ${size}px ${FONT}`;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'alphabetic';
  if (opts.rot) { ctx.translate(x, y); ctx.rotate(opts.rot); x = 0; y = 0; }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = opts.outline || INK;
  ctx.lineWidth = opts.lw ?? Math.max(2, size * 0.18);
  if (opts.lw !== 0) ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ---- texture cache -----------------------------------------------------------
const cache = new Map();
export function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.userData.canvas = canvas;
  return t;
}
/**
 * Get or build a cached texture. fn(ctx, w, h, rng) draws into a w×h canvas.
 * The rng is seeded from the key so art is stable between runs.
 */
export function tex(key, w, h, fn) {
  let t = cache.get(key);
  if (t) return t;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  fn(ctx, w, h, new RNG(key));
  t = toTexture(c);
  t.userData.key = key;
  t.userData.aspect = w / h;
  cache.set(key, t);
  return t;
}
export function hasTex(key) { return cache.has(key); }
/** White silhouette version of a texture (hit flash) */
export function flashTex(t) {
  if (t.userData.flash) return t.userData.flash;
  const src = t.userData.canvas || t.image;
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  const f = toTexture(c);
  t.userData.flash = f;
  return f;
}
/** Horizontally mirrored copy (for left/right facing) */
export function mirrorTex(key, t) {
  return tex(key + '|mirror', t.image.width, t.image.height, (ctx, w) => {
    ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(t.image, 0, 0);
  });
}
export function clearTexCache(prefix) {
  for (const [k, t] of cache) if (k.startsWith(prefix)) { t.dispose(); if (t.userData.flash) t.userData.flash.dispose(); cache.delete(k); }
}
