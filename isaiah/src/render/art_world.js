// World art: floors, walls, obstacles, doors, tears, splats, decals.
import { tex, makeCanvas, blob, poly, scribble, dot, ink, wobEllipse, wobPoly, crayonFill, shade, mix, rgba, INK, glow, inkText } from './draw.js';
import { RNG } from '../core/rng.js';

export const TILE_PX = 32; // floor canvas pixels per tile

// ---- floor -------------------------------------------------------------------
/**
 * Paint a room's floor canvas. grid: room tile grid (for pits / spikes / void).
 * Returns the canvas (decals are stamped onto it later).
 */
export function paintFloor(room, palette, seed) {
  const W = room.W, H = room.H, P = TILE_PX;
  const c = makeCanvas(W * P, H * P);
  const ctx = c.getContext('2d');
  const rng = new RNG(seed);
  // base dirt with mottling
  ctx.fillStyle = palette.floor;
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < W * H * 1.4; i++) {
    const x = rng.range(0, c.width), y = rng.range(0, c.height);
    ctx.fillStyle = rgba(rng.chance(0.5) ? palette.floor2 : shade(palette.floor, 0.12), rng.range(0.15, 0.45));
    wobEllipse(ctx, x, y, rng.range(8, 30), rng.range(5, 18), rng, 0.3, 10, rng.range(0, 3));
    ctx.fill();
  }
  // crayon hatch across the floor
  ctx.lineWidth = 1;
  for (let i = 0; i < W * H * 3; i++) {
    const x = rng.range(0, c.width), y = rng.range(0, c.height), l = rng.range(4, 12);
    ctx.strokeStyle = rgba(rng.chance(0.5) ? shade(palette.floor, -0.35) : shade(palette.floor, 0.25), 0.25);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y - l * 0.6); ctx.stroke();
  }
  // faint plank / flagstone lines
  ctx.strokeStyle = rgba(shade(palette.floor, -0.45), 0.35); ctx.lineWidth = 1.5;
  for (let y = P * 2; y < c.height; y += P * 2) {
    ctx.beginPath(); ctx.moveTo(0, y + rng.range(-2, 2));
    for (let x = 0; x <= c.width; x += 24) ctx.lineTo(x, y + rng.range(-2, 2));
    ctx.stroke();
  }
  // cracks
  for (let i = 0; i < 3 + W * H / 40; i++) {
    let x = rng.range(0, c.width), y = rng.range(0, c.height);
    const pts = [[x, y]];
    for (let k = 0; k < 5; k++) { x += rng.range(-14, 14); y += rng.range(-14, 14); pts.push([x, y]); }
    scribble(ctx, pts, 1.4, rgba(INK, 0.45), rng, 1);
  }
  // pebbles & bits of debris
  for (let i = 0; i < W * H * 0.5; i++) {
    const x = rng.range(0, c.width), y = rng.range(0, c.height);
    blob(ctx, x, y, rng.range(1.5, 3.5), rng.range(1.2, 2.5), shade(palette.accent, rng.range(-0.2, 0.2)), rng, { lw: 1, hatch: 0, shadeDir: false });
  }
  // void (L-room missing corner) is drawn black; pits and spikes on top
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const t = room.grid[ty * W + tx];
    if (t.t === 'void') { ctx.fillStyle = '#050304'; ctx.fillRect(tx * P, ty * P, P, P); }
  }
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const t = room.grid[ty * W + tx];
    if (t.t === 'pit') paintPit(ctx, room, tx, ty, rng);
    if (t.t === 'spikes') paintSpikes(ctx, tx, ty, rng);
  }
  // darkened edges near walls (soft ambient occlusion)
  const g1 = ctx.createLinearGradient(0, 0, 0, P * 1.5);
  g1.addColorStop(0, 'rgba(0,0,0,0.55)'); g1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, c.width, P * 1.5);
  const g2 = ctx.createLinearGradient(0, c.height, 0, c.height - P);
  g2.addColorStop(0, 'rgba(0,0,0,0.4)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, c.height - P, c.width, P);
  const g3 = ctx.createLinearGradient(0, 0, P * 1.2, 0);
  g3.addColorStop(0, 'rgba(0,0,0,0.45)'); g3.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g3; ctx.fillRect(0, 0, P * 1.2, c.height);
  const g4 = ctx.createLinearGradient(c.width, 0, c.width - P * 1.2, 0);
  g4.addColorStop(0, 'rgba(0,0,0,0.45)'); g4.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g4; ctx.fillRect(c.width - P * 1.2, 0, P * 1.2, c.height);
  return c;
}

function paintPit(ctx, room, tx, ty, rng) {
  const P = TILE_PX, W = room.W;
  const isPit = (x, y) => x >= 0 && y >= 0 && x < room.W && y < room.H && room.grid[y * W + x].t === 'pit';
  const x0 = tx * P, y0 = ty * P;
  const l = isPit(tx - 1, ty) ? 0 : 3, r = isPit(tx + 1, ty) ? 0 : 3, t = isPit(tx, ty - 1) ? 0 : 3, b = isPit(tx, ty + 1) ? 0 : 3;
  ctx.fillStyle = '#0a0606';
  ctx.beginPath();
  ctx.rect(x0 + l + rng.range(-1, 1), y0 + t + rng.range(-1, 1), P - l - r, P - t - b);
  ctx.fill();
  // inner lip shadow at the top edge
  if (!isPit(tx, ty - 1)) {
    ctx.fillStyle = 'rgba(70,50,40,0.9)'; ctx.fillRect(x0 + l, y0 + t, P - l - r, 6);
    ctx.fillStyle = 'rgba(30,20,15,0.9)'; ctx.fillRect(x0 + l, y0 + t + 6, P - l - r, 4);
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (t) { ctx.moveTo(x0 + l, y0 + t); ctx.lineTo(x0 + P - r, y0 + t); }
  if (b) { ctx.moveTo(x0 + l, y0 + P - b); ctx.lineTo(x0 + P - r, y0 + P - b); }
  if (l) { ctx.moveTo(x0 + l, y0 + t); ctx.lineTo(x0 + l, y0 + P - b); }
  if (r) { ctx.moveTo(x0 + P - r, y0 + t); ctx.lineTo(x0 + P - r, y0 + P - b); }
  ctx.stroke();
}
function paintSpikes(ctx, tx, ty, rng) {
  const P = TILE_PX, x0 = tx * P, y0 = ty * P;
  ctx.fillStyle = 'rgba(30,20,18,0.6)'; ctx.fillRect(x0 + 2, y0 + 2, P - 4, P - 4);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const cx = x0 + 6 + i * 10 + rng.range(-1, 1), cy = y0 + 9 + j * 9;
    poly(ctx, [[cx - 3.5, cy + 3], [cx, cy - 6], [cx + 3.5, cy + 3]], '#b9b3a8', rng, { lw: 1.4, hatch: 0, jit: 0.5 });
  }
}

/** Stamp a blood / goop splatter decal onto a floor canvas. */
export function stampSplat(ctx, x, y, size, color, rng) {
  const P = TILE_PX;
  const px = x * P, py = y * P, s = size * P;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = color;
  wobEllipse(ctx, px, py, s * 0.45, s * 0.32, rng, 0.35, 14, rng.range(0, 3)); ctx.fill();
  for (let i = 0; i < 6 + size * 6; i++) {
    const a = rng.range(0, 6.28), d = rng.range(0.3, 1.1) * s * 0.7;
    ctx.globalAlpha = rng.range(0.5, 0.9);
    ctx.fillStyle = rng.chance(0.3) ? shade(color, -0.35) : color;
    ctx.beginPath(); ctx.arc(px + Math.cos(a) * d, py + Math.sin(a) * d * 0.7, rng.range(1, 4) * Math.max(0.6, size), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = shade(color, -0.4);
  wobEllipse(ctx, px + 2, py + 2, s * 0.22, s * 0.16, rng, 0.3, 10); ctx.fill();
  ctx.restore();
}
export function stampScorch(ctx, x, y, size, rng) {
  const P = TILE_PX, px = x * P, py = y * P, s = size * P;
  ctx.save();
  const g = ctx.createRadialGradient(px, py, 0, px, py, s);
  g.addColorStop(0, 'rgba(10,6,4,0.75)'); g.addColorStop(0.7, 'rgba(20,10,6,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, s, s * 0.8, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 10; i++) { const a = rng.range(0, 6.28); scribble(ctx, [[px, py], [px + Math.cos(a) * s * 0.9, py + Math.sin(a) * s * 0.7]], 1.5, 'rgba(0,0,0,0.4)', rng, 3); }
  ctx.restore();
}

// ---- walls -------------------------------------------------------------------
export function wallFaceTex(palette) {
  return tex('wallface:' + palette.wall, 256, 64, (ctx, w, h, rng) => {
    ctx.fillStyle = palette.wall; ctx.fillRect(0, 0, w, h);
    // rough stacked stones / roots
    for (let y = 0; y < h; y += 16) {
      for (let x = (y / 16) % 2 ? -12 : 0; x < w; x += 26 + rng.range(-4, 4)) {
        wobPoly(ctx, [[x + 1, y + 1], [x + 24, y + 1], [x + 24, y + 15], [x + 1, y + 15]], rng, 2);
        crayonFill(ctx, shade(palette.wall, rng.range(-0.15, 0.12)), rng, { hatch: 0.25, spacing: 3 });
        ink(ctx, 1.6, rgba(INK, 0.8));
      }
    }
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}
export function wallTopTex(palette) {
  return tex('walltop:' + palette.wallTop, 128, 128, (ctx, w, h, rng) => {
    ctx.fillStyle = palette.wallTop; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      blob(ctx, rng.range(0, w), rng.range(0, h), rng.range(6, 16), rng.range(5, 12), shade(palette.wallTop, rng.range(-0.1, 0.25)), rng, { lw: 1.5, hatch: 0.2, inkColor: rgba(INK, 0.7) });
    }
    // dangling roots
    for (let i = 0; i < 5; i++) { const x = rng.range(0, w); scribble(ctx, [[x, 0], [x + rng.range(-8, 8), h * 0.4], [x + rng.range(-12, 12), h * 0.8]], 2, rgba('#5a3b22', 0.7), rng, 3); }
  });
}

// ---- obstacles ---------------------------------------------------------------
export function rockTex(variant, tinted, floor = 1) {
  return tex(`rock:${variant}:${tinted ? 1 : 0}:${floor}`, 64, 60, (ctx, w, h, rng) => {
    const base = ['#8d8478', '#7d7a6e', '#6e7478', '#8a6e62', '#6e5e6e'][floor - 1] || '#8d8478';
    blob(ctx, w / 2, h - 18, 26, 9, 'rgba(0,0,0,0.35)', rng, { ink: false, hatch: 0 });
    const n = 2 + (variant % 3);
    for (let i = 0; i < n; i++) {
      const ox = (i - (n - 1) / 2) * 14 + rng.range(-3, 3);
      blob(ctx, w / 2 + ox, h - 24 - (i % 2) * 6, 15 - (i % 2) * 2, 14, shade(base, rng.range(-0.12, 0.12)), rng, { lw: 3, wob: 0.18, n: 9, hatch: 0.25 });
    }
    blob(ctx, w / 2 + rng.range(-4, 4), h - 32, 17, 15, base, rng, { lw: 3, wob: 0.2, n: 8, hatch: 0.25 });
    scribble(ctx, [[w / 2 - 8, h - 38], [w / 2 - 2, h - 42], [w / 2 + 6, h - 40]], 2.5, rgba('#ffffff', 0.35), rng);
    scribble(ctx, [[w / 2 + 2, h - 30], [w / 2 + 6, h - 24], [w / 2 + 3, h - 18]], 1.6, rgba(INK, 0.7), rng);
    if (tinted) {
      ctx.save(); ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(120,150,255,0.28)'; ctx.fillRect(0, 0, w, h);
      ctx.restore();
      for (let i = 0; i < 3; i++) dot(ctx, w / 2 - 6 + i * 6, h - 28 + (i % 2) * 4, 2.2, '#9fd0ff');
    }
  });
}
export function metalTex() {
  return tex('metal', 64, 64, (ctx, w, h, rng) => {
    poly(ctx, [[8, h - 6], [8, h - 46], [56, h - 46], [56, h - 6]], '#4a4a52', rng, { lw: 3, hatch: 0.2 });
    poly(ctx, [[8, h - 46], [16, h - 56], [62, h - 56], [56, h - 46]], '#6a6a74', rng, { lw: 3, hatch: 0.15 });
    poly(ctx, [[56, h - 46], [62, h - 56], [62, h - 14], [56, h - 6]], '#34343a', rng, { lw: 3, hatch: 0.15 });
    for (const [x, y] of [[14, 12], [50, 12], [14, 40], [50, 40]]) dot(ctx, x, h - 6 - y + 4, 2.5, '#9a9aa4');
  });
}
/** Muck mound: stage 0 = full, 3 = nearly gone */
export function poopTex(stage, variant = 'muck') {
  return tex(`poop:${variant}:${stage}`, 64, 60, (ctx, w, h, rng) => {
    const col = variant === 'golden' ? '#c9a13a' : variant === 'red' ? '#7a2a22' : '#6a5a2c';
    const s = 1 - stage * 0.2;
    blob(ctx, w / 2, h - 14, 24 * s, 8 * s, 'rgba(0,0,0,0.3)', rng, { ink: false, hatch: 0 });
    blob(ctx, w / 2, h - 19, 22 * s, 11 * s, shade(col, -0.1), rng, { lw: 3, wob: 0.15 });
    if (stage < 3) blob(ctx, w / 2 + 1, h - 28 * s, 16 * s, 9 * s, col, rng, { lw: 3, wob: 0.15 });
    if (stage < 2) blob(ctx, w / 2 - 1, h - 36 * s, 10 * s, 7 * s, shade(col, 0.1), rng, { lw: 3, wob: 0.15 });
    if (stage < 1) poly(ctx, [[w / 2 - 4, h - 42], [w / 2 + 3, h - 50], [w / 2 + 5, h - 41]], shade(col, 0.15), rng, { lw: 2.5 });
    // a fly speck or two
    dot(ctx, w / 2 + 12, h - 40 * s, 1.6, INK); dot(ctx, w / 2 - 14, h - 32 * s, 1.6, INK);
  });
}
export function fireplaceTex(frame, lit, blue = false) {
  return tex(`fire:${frame}:${lit ? 1 : 0}:${blue ? 1 : 0}`, 64, 80, (ctx, w, h, rng) => {
    // logs
    poly(ctx, [[10, h - 12], [52, h - 20], [54, h - 12], [12, h - 4]], '#5a3a22', rng, { lw: 2.5 });
    poly(ctx, [[12, h - 20], [54, h - 12], [52, h - 4], [10, h - 12]], '#6e4628', rng, { lw: 2.5 });
    if (!lit) { for (let i = 0; i < 3; i++) scribble(ctx, [[24 + i * 8, h - 22], [26 + i * 8, h - 34 - i * 3], [22 + i * 8, h - 44]], 2, 'rgba(160,160,160,0.5)', rng, 2); return; }
    const c1 = blue ? '#6fb8ff' : '#ff9a2a', c2 = blue ? '#c8ecff' : '#ffe27a', c0 = blue ? '#2a5aff' : '#e2401a';
    glow(ctx, w / 2, h - 34, 32, c1, 0.4);
    const sway = [0, 3, -2][frame % 3];
    poly(ctx, [[14, h - 16], [w / 2 + sway, h - 68], [50, h - 16]], c0, rng, { lw: 2.5, hatch: 0.1, jit: 3 });
    poly(ctx, [[20, h - 16], [w / 2 - sway, h - 54], [44, h - 16]], c1, rng, { lw: 2, hatch: 0.1, jit: 3 });
    poly(ctx, [[26, h - 16], [w / 2 + sway * 0.5, h - 38], [38, h - 16]], c2, rng, { lw: 1.5, hatch: 0, jit: 2 });
  });
}
export function tntTex() {
  return tex('tnt', 64, 64, (ctx, w, h, rng) => {
    blob(ctx, w / 2, h - 8, 18, 6, 'rgba(0,0,0,0.3)', rng, { ink: false, hatch: 0 });
    poly(ctx, [[14, h - 8], [12, h - 46], [52, h - 46], [50, h - 8]], '#9a2a1e', rng, { lw: 3, hatch: 0.2 });
    blob(ctx, w / 2, h - 46, 20, 6, '#b8442e', rng, { lw: 3, hatch: 0.1 });
    scribble(ctx, [[13, h - 20], [51, h - 20]], 3, '#3a2214', rng); scribble(ctx, [[13, h - 36], [51, h - 36]], 3, '#3a2214', rng);
    inkText(ctx, '!!', w / 2, h - 23, 16, '#f2d25a', { align: 'center', lw: 3 });
    scribble(ctx, [[w / 2, h - 48], [w / 2 + 4, h - 56], [w / 2 + 1, h - 60]], 2, INK, rng);
  });
}
export function urnTex() {
  return tex('urn', 64, 64, (ctx, w, h, rng) => {
    blob(ctx, w / 2, h - 22, 16, 18, '#7a6a5a', rng, { lw: 3 });
    blob(ctx, w / 2, h - 42, 10, 4, '#5a4a3a', rng, { lw: 2.5 });
  });
}

// ---- doors -------------------------------------------------------------------
export const DOOR_STYLE = {
  normal: { frame: '#6a5038', inner: '#120a08', leaf: '#4a3020' },
  treasure: { frame: '#c9a13a', inner: '#1a1206', leaf: '#8a6a20', trim: '#ffe48a' },
  boss: { frame: '#5a1a14', inner: '#0e0303', leaf: '#3a0e0a', teeth: true },
  shop: { frame: '#5a6a3a', inner: '#0c0e06', leaf: '#3a4422' },
  secret: { frame: '#3a2d26', inner: '#050303', leaf: '#3a2d26', hole: true },
  bargain: { frame: '#2a0a0a', inner: '#300404', leaf: '#200606', horns: true },
  chapel: { frame: '#e8e2d0', inner: '#f8f2dc', leaf: '#cfc6a8', trim: '#fff6c0' },
  challenge: { frame: '#7a1e1e', inner: '#120404', leaf: '#4a1010', trim: '#c94a3a' },
  arcade: { frame: '#3a3a7a', inner: '#08081a', leaf: '#2a2a5a', trim: '#e0d04a' },
  library: { frame: '#5a3a5a', inner: '#0e0610', leaf: '#3a2440', trim: '#d0b0e0' },
  sacrifice: { frame: '#4a4a4a', inner: '#0a0a0a', leaf: '#2a2a2a' },
};
/** state: 'open' | 'closed' | 'locked' | 'hidden'(unused) — drawn facing "top" then rotated by side */
export function doorTex(kind, state, side) {
  return tex(`door:${kind}:${state}:${side}`, 96, 96, (ctx, w, h, rng) => {
    const st = DOOR_STYLE[kind] || DOOR_STYLE.normal;
    ctx.translate(w / 2, h / 2);
    ctx.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][side]);
    ctx.translate(-w / 2, -h / 2);
    // drawn as a "top" door: the opening at the bottom
    if (st.hole) {
      if (state === 'open') {
        blob(ctx, w / 2, h * 0.62, 26, 30, '#050303', rng, { lw: 3, wob: 0.25, n: 12, hatch: 0 });
        for (let i = 0; i < 6; i++) { const a = rng.range(Math.PI, Math.PI * 2); scribble(ctx, [[w / 2 + Math.cos(a) * 24, h * 0.62 + Math.sin(a) * 28], [w / 2 + Math.cos(a) * 38, h * 0.62 + Math.sin(a) * 40]], 2, INK, rng, 2); }
      } else {
        for (let i = 0; i < 4; i++) { const a = rng.range(Math.PI * 1.1, Math.PI * 1.9); scribble(ctx, [[w / 2, h * 0.7], [w / 2 + Math.cos(a) * 18, h * 0.7 + Math.sin(a) * 22], [w / 2 + Math.cos(a) * 28, h * 0.7 + Math.sin(a) * 30]], 1.6, rgba(INK, 0.6), rng, 2); }
      }
      return;
    }
    // frame arch
    const fw = 40, top = 14, bot = h - 6;
    wobPoly(ctx, [[w / 2 - fw, bot], [w / 2 - fw, top + 18], [w / 2 - fw + 10, top], [w / 2 + fw - 10, top], [w / 2 + fw, top + 18], [w / 2 + fw, bot]], rng, 1.5);
    crayonFill(ctx, st.frame, rng, { hatch: 0.25 }); ink(ctx, 3);
    // inner opening
    const iw = 24;
    wobPoly(ctx, [[w / 2 - iw, bot + 2], [w / 2 - iw, top + 24], [w / 2 - iw + 8, top + 12], [w / 2 + iw - 8, top + 12], [w / 2 + iw, top + 24], [w / 2 + iw, bot + 2]], rng, 1);
    crayonFill(ctx, st.inner, rng, { hatch: kind === 'chapel' ? 0.2 : 0.05 }); ink(ctx, 2.5);
    if (kind === 'chapel' && state === 'open') glow(ctx, w / 2, h * 0.6, 34, '#fff8d0', 0.7);
    if (kind === 'bargain' && state === 'open') glow(ctx, w / 2, h * 0.6, 30, '#ff2a1a', 0.5);
    if (st.trim) { scribble(ctx, [[w / 2 - fw + 4, bot], [w / 2 - fw + 4, top + 20], [w / 2 - fw + 12, top + 5], [w / 2 + fw - 12, top + 5], [w / 2 + fw - 4, top + 20], [w / 2 + fw - 4, bot]], 2.5, st.trim, rng); }
    if (st.teeth) {
      for (let i = 0; i < 5; i++) { const x = w / 2 - iw + 6 + i * 9; poly(ctx, [[x - 4, top + 14], [x, top + 26], [x + 4, top + 14]], '#efe6cc', rng, { lw: 1.6, hatch: 0, jit: 0.6 }); }
      for (const s of [-1, 1]) { dot(ctx, w / 2 + s * 30, top + 10, 5, '#ffd84a'); dot(ctx, w / 2 + s * 30, top + 10, 2.2, INK); }
    }
    if (st.horns) for (const s of [-1, 1]) poly(ctx, [[w / 2 + s * 30, top + 14], [w / 2 + s * 46, top - 10], [w / 2 + s * 40, top + 18]], '#4a0a0a', rng, { lw: 2.4 });
    if (state !== 'open') {
      // closed leaves / bars
      wobPoly(ctx, [[w / 2 - iw + 2, bot], [w / 2 - iw + 2, top + 26], [w / 2 - iw + 9, top + 14], [w / 2 + iw - 9, top + 14], [w / 2 + iw - 2, top + 26], [w / 2 + iw - 2, bot]], rng, 1);
      crayonFill(ctx, st.leaf, rng, { hatch: 0.3 }); ink(ctx, 2.5);
      scribble(ctx, [[w / 2, top + 14], [w / 2, bot]], 2.5, INK, rng);
      for (let y = top + 30; y < bot; y += 12) scribble(ctx, [[w / 2 - iw + 4, y], [w / 2 + iw - 4, y + 1]], 1.4, rgba(INK, 0.5), rng);
      if (state === 'locked') {
        blob(ctx, w / 2, top + 50, 9, 8, '#c9a13a', rng, { lw: 2.5 });
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w / 2, top + 42, 6, Math.PI, 0); ctx.stroke();
        dot(ctx, w / 2, top + 51, 2.2, INK);
      }
    }
  });
}

// ---- tears & splats ----------------------------------------------------------
/** Near-white tear; tinted per item with material.color */
export function tearTex(style = 'round') {
  return tex('tear:' + style, 40, 40, (ctx, w, h, rng) => {
    if (style === 'blood') {
      blob(ctx, w / 2, h / 2, 13, 13, '#ffffff', rng, { lw: 2.5, inkColor: '#7a7a7a', hatch: 0.1, wob: 0.12 });
    } else if (style === 'tooth') {
      poly(ctx, [[w / 2 - 10, h / 2 - 8], [w / 2 + 10, h / 2 - 8], [w / 2 + 7, h / 2 + 8], [w / 2 + 2, h / 2 + 2], [w / 2 - 2, h / 2 + 2], [w / 2 - 7, h / 2 + 8]], '#ffffff', rng, { lw: 2.5, inkColor: '#6a6a6a', hatch: 0.1 });
      return;
    } else {
      blob(ctx, w / 2, h / 2, 13, 13, '#ffffff', rng, { lw: 2.5, inkColor: '#58687a', hatch: 0.08, wob: 0.06 });
    }
    // shading + highlight
    const g = ctx.createRadialGradient(w / 2 - 4, h / 2 - 5, 1, w / 2, h / 2, 13);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(60,80,110,0.35)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w / 2, h / 2, 12, 0, 7); ctx.fill();
    dot(ctx, w / 2 - 4, h / 2 - 5, 3, '#ffffff');
  });
}
export function splatTex(frame) {
  return tex('splat:' + frame, 48, 48, (ctx, w, h, rng) => {
    const k = (frame + 1) / 4;
    ctx.globalAlpha = 1 - frame * 0.18;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.28 + rng.range(-0.3, 0.3), d = 6 + k * 14;
      blob(ctx, w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d * 0.8, 4 - frame * 0.7, 4 - frame * 0.7, '#ffffff', rng, { lw: 1.5, inkColor: '#7a8696', hatch: 0 });
    }
    if (frame < 2) blob(ctx, w / 2, h / 2, 8 - frame * 3, 7 - frame * 2, '#ffffff', rng, { lw: 2, inkColor: '#7a8696', hatch: 0 });
  });
}
/** Generic particle: blob of color (tinted) */
export function particleTex(kind) {
  return tex('part:' + kind, 24, 24, (ctx, w, h, rng) => {
    if (kind === 'smoke') { const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12); g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); return; }
    if (kind === 'spark') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(12, 1); ctx.lineTo(15, 12); ctx.lineTo(12, 23); ctx.lineTo(9, 12); ctx.closePath(); ctx.fill(); return; }
    if (kind === 'gib') { blob(ctx, 12, 12, 7, 5, '#ffffff', rng, { lw: 2, inkColor: '#5a5a5a', hatch: 0.1, wob: 0.3 }); return; }
    if (kind === 'rock') { blob(ctx, 12, 12, 6, 5, '#ffffff', rng, { lw: 2, inkColor: '#3a3a3a', hatch: 0.2, wob: 0.35, n: 7 }); return; }
    blob(ctx, 12, 12, 6, 6, '#ffffff', rng, { lw: 1.6, inkColor: '#666666', hatch: 0 });
  });
}
export function explosionTex(frame) {
  return tex('boom:' + frame, 128, 128, (ctx, w, h, rng) => {
    const k = frame / 5;
    ctx.globalAlpha = 1 - k * 0.8;
    glow(ctx, w / 2, h / 2, 64, '#ffb040', 0.9 - k * 0.6);
    for (let i = 0; i < 9; i++) {
      const a = rng.range(0, 6.28), d = 8 + k * 38;
      blob(ctx, w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 18 - k * 8, 16 - k * 8, k < 0.4 ? '#ffd860' : k < 0.7 ? '#e86020' : '#5a4a44', rng, { lw: 2.5, wob: 0.25, hatch: 0.2 });
    }
    if (frame < 3) blob(ctx, w / 2, h / 2, 26 - frame * 6, 24 - frame * 6, '#fff6c0', rng, { lw: 2, wob: 0.2, hatch: 0 });
  });
}
export function creepTex(color) {
  return tex('creep:' + color, 64, 64, (ctx, w, h, rng) => {
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = color;
    wobEllipse(ctx, w / 2, h / 2, 26, 24, rng, 0.3, 14); ctx.fill();
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(w / 2 + rng.range(-22, 22), h / 2 + rng.range(-22, 22), rng.range(3, 8), 0, 7); ctx.fill(); }
    ctx.globalAlpha = 0.5; ctx.fillStyle = shade(color, 0.4);
    ctx.beginPath(); ctx.arc(w / 2 - 6, h / 2 - 6, 5, 0, 7); ctx.fill();
  });
}
