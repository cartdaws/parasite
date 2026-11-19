// Art for pickups, bombs, chests, pedestals, shop and machines.
import { tex, blob, poly, scribble, dot, eye, glow, inkText, shade, rgba, INK, wobEllipse, crayonFill, ink } from './draw.js';

export function coinTex(kind = 'penny', frame = 0) {
  return tex(`coin:${kind}:${frame}`, 40, 40, (ctx, w, h, rng) => {
    const col = { penny: '#c8823a', nickel: '#b8bcc4', dime: '#d8c060', lucky: '#6ac85a' }[kind];
    const sx = [1, 0.7, 0.25, 0.7][frame % 4];
    blob(ctx, w / 2, h / 2, 14 * sx + 1, 14, col, rng, { lw: 2.6, hatch: 0.15 });
    if (sx > 0.5) {
      ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 9 * sx, 9, 0, 0, 7); ctx.stroke();
      inkText(ctx, kind === 'nickel' ? '5' : kind === 'dime' ? '10' : '¢', w / 2, h / 2 + 5, 13, shade(col, 0.4), { align: 'center', lw: 2 });
    }
    dot(ctx, w / 2 - 6 * sx, h / 2 - 7, 2.2, 'rgba(255,255,255,0.7)');
  });
}
export function heartTex(kind = 'full') {
  return tex(`heart:${kind}`, 44, 40, (ctx, w, h, rng) => {
    const col = { full: '#c81e1e', half: '#c81e1e', soul: '#6a8ae0', black: '#2a1e2a', double: '#c81e1e', halfsoul: '#6a8ae0', gold: '#e0b030', eternal: '#f0f0f0' }[kind];
    const draw = (ox, oy, s, c) => {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = (i / 24) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3), y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        pts.push([ox + x * s * 0.9, oy + y * s * 0.9]);
      }
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      if (kind === 'half' || kind === 'halfsoul') {
        ctx.save(); ctx.clip(); ctx.fillStyle = c; ctx.fillRect(0, 0, ox, h); ctx.restore();
        crayonFill(ctx, 'rgba(0,0,0,0)', rng, { hatch: 0 });
      } else crayonFill(ctx, c, rng, { hatch: 0.18 });
      ink(ctx, 2.6);
      if (kind !== 'black') dot(ctx, ox - 6 * s, oy - 5 * s, 2.5 * s, 'rgba(255,255,255,0.6)');
      if (kind === 'black') { dot(ctx, ox - 5 * s, oy - 2 * s, 2 * s, '#e03030'); dot(ctx, ox + 5 * s, oy - 2 * s, 2 * s, '#e03030'); }
    };
    if (kind === 'double') { draw(w / 2 - 6, h / 2 + 1, 0.85, col); draw(w / 2 + 6, h / 2 + 3, 0.85, col); }
    else draw(w / 2, h / 2 + 1, 1, col);
  });
}
export function keyTex(golden = false) {
  return tex(`key:${golden}`, 40, 40, (ctx, w, h, rng) => {
    const c = golden ? '#ffd860' : '#c8b07a';
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-0.7);
    blob(ctx, -9, 0, 7, 7, c, rng, { lw: 2.4, hatch: 0.1 });
    dot(ctx, -9, 0, 2.5, INK);
    poly(ctx, [[-3, -2.5], [14, -2.5], [14, 2.5], [-3, 2.5]], c, rng, { lw: 2.2, hatch: 0 });
    poly(ctx, [[8, 2], [8, 7], [11, 7], [11, 2]], c, rng, { lw: 2, hatch: 0 });
    poly(ctx, [[12, 2], [12, 6], [14, 6], [14, 2]], c, rng, { lw: 2, hatch: 0 });
    ctx.restore();
  });
}
export function bombTex(kind = 'single', lit = 0, flags = '') {
  return tex(`bomb:${kind}:${lit}:${flags}`, 48, 48, (ctx, w, h, rng) => {
    const one = (ox, oy, s) => {
      const col = flags.includes('sticky') ? '#5a7a2a' : flags.includes('homing') ? '#6a3a8a' : flags.includes('big') ? '#2a2a3a' : '#2a2a30';
      blob(ctx, ox, oy, 12 * s, 12 * s, col, rng, { lw: 2.6, hatch: 0.15 });
      poly(ctx, [[ox - 4 * s, oy - 11 * s], [ox + 4 * s, oy - 11 * s], [ox + 4 * s, oy - 15 * s], [ox - 4 * s, oy - 15 * s]], '#5a5a60', rng, { lw: 2, hatch: 0 });
      scribble(ctx, [[ox, oy - 15 * s], [ox + 4 * s, oy - 19 * s], [ox + 2 * s, oy - 22 * s]], 2, '#8a6a3a', rng);
      dot(ctx, ox - 4 * s, oy - 4 * s, 3 * s, 'rgba(255,255,255,0.45)');
      if (lit) { glow(ctx, ox + 2 * s, oy - 22 * s, 8, '#ffcc40', 0.9); dot(ctx, ox + 2 * s, oy - 22 * s, 2.5, '#fff0a0'); }
      if (flags.includes('remote')) dot(ctx, ox + 5 * s, oy + 2 * s, 2.5, '#e03030');
    };
    if (kind === 'double') { one(w / 2 - 7, h / 2 + 6, 0.8); one(w / 2 + 7, h / 2 + 8, 0.8); }
    else one(w / 2, h / 2 + 6, flags.includes('big') ? 1.2 : 1);
  });
}
export function chestTex(kind = 'normal', open = false) {
  return tex(`chest:${kind}:${open}`, 52, 48, (ctx, w, h, rng) => {
    const col = { normal: '#8a5a2a', locked: '#c9a13a', red: '#9a2a22', stone: '#7a7a7a' }[kind];
    poly(ctx, [[8, h - 6], [8, h - 24], [44, h - 24], [44, h - 6]], col, rng, { lw: 2.6, hatch: 0.25 });
    if (open) { poly(ctx, [[8, h - 24], [12, h - 40], [40, h - 40], [44, h - 24]], shade(col, -0.25), rng, { lw: 2.4 }); poly(ctx, [[11, h - 23], [41, h - 23], [41, h - 19], [11, h - 19]], '#120a06', rng, { lw: 1.5, hatch: 0 }); return; }
    poly(ctx, [[8, h - 24], [10, h - 34], [42, h - 34], [44, h - 24]], shade(col, 0.12), rng, { lw: 2.6, hatch: 0.2 });
    scribble(ctx, [[8, h - 24], [44, h - 24]], 2.6, INK, rng);
    poly(ctx, [[22, h - 28], [30, h - 28], [30, h - 18], [22, h - 18]], kind === 'locked' ? '#5a4a2a' : '#c9b06a', rng, { lw: 2, hatch: 0 });
    if (kind === 'locked') dot(ctx, 26, h - 23, 2, INK);
    if (kind === 'red') { scribble(ctx, [[14, h - 10], [20, h - 16]], 2, '#3a0a0a', rng); }
  });
}
export function batteryTex() {
  return tex('battery', 40, 40, (ctx, w, h, rng) => {
    poly(ctx, [[12, 10], [28, 10], [28, 34], [12, 34]], '#3a8a3a', rng, { lw: 2.4, hatch: 0.15 });
    poly(ctx, [[16, 6], [24, 6], [24, 10], [16, 10]], '#b8b8b8', rng, { lw: 2, hatch: 0 });
    poly(ctx, [[21, 13], [15, 23], [20, 23], [18, 31], [25, 20], [20, 20]], '#ffe060', rng, { lw: 1.6, hatch: 0 });
  });
}
export function cardBackTex() {
  return tex('cardback', 36, 48, (ctx, w, h, rng) => {
    poly(ctx, [[5, 4], [31, 4], [31, 44], [5, 44]], '#e8dcc0', rng, { lw: 2.4, hatch: 0.1 });
    poly(ctx, [[9, 8], [27, 8], [27, 40], [9, 40]], '#7a2a3a', rng, { lw: 1.6, hatch: 0.2 });
    eye(ctx, 18, 24, 5, rng, 0, 0, { lw: 1.4 });
  });
}
export const PILL_COLORS = [
  ['#e8e0d0', '#3a6ad8'], ['#e8e0d0', '#d83a3a'], ['#3a3a3a', '#e8e0d0'], ['#e8d040', '#e8e0d0'],
  ['#4ab84a', '#e8e0d0'], ['#d86ab8', '#e8e0d0'], ['#e88a3a', '#6a3a1a'], ['#6ad8d8', '#3a3a8a'],
  ['#a83a3a', '#3a3a3a'], ['#e8e0d0', '#e8e0d0'], ['#8ad83a', '#d83a8a'], ['#3a8ad8', '#e8d040'],
];
export function pillTex(colorIdx) {
  return tex(`pill:${colorIdx}`, 40, 40, (ctx, w, h, rng) => {
    const [a, b] = PILL_COLORS[colorIdx % PILL_COLORS.length];
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-0.6);
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(-8, -7); ctx.arc(-8, 0, 7, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(0, 7); ctx.closePath();
    crayonFill(ctx, a, rng, { hatch: 0.1 }); ink(ctx, 2.2);
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(8, -7); ctx.arc(8, 0, 7, -Math.PI / 2, Math.PI / 2); ctx.lineTo(0, 7); ctx.closePath();
    crayonFill(ctx, b, rng, { hatch: 0.1 }); ink(ctx, 2.2);
    dot(ctx, -8, -3, 2, 'rgba(255,255,255,0.7)');
    ctx.restore();
  });
}
export function pedestalTex(kind = 'stone') {
  return tex(`pedestal:${kind}`, 64, 56, (ctx, w, h, rng) => {
    const col = kind === 'gold' ? '#b8963a' : kind === 'red' ? '#5a1a1a' : kind === 'white' ? '#d8d0c0' : '#7a7068';
    blob(ctx, w / 2, h - 10, 24, 7, 'rgba(0,0,0,0.35)', rng, { ink: false, hatch: 0 });
    poly(ctx, [[14, h - 10], [18, h - 32], [46, h - 32], [50, h - 10]], col, rng, { lw: 2.8, hatch: 0.2 });
    blob(ctx, w / 2, h - 33, 18, 6, shade(col, 0.15), rng, { lw: 2.6, hatch: 0.1 });
    scribble(ctx, [[20, h - 22], [30, h - 20], [44, h - 23]], 1.5, rgba(INK, 0.5), rng);
  });
}
export function shopkeeperTex(dead = false) {
  return tex(`shopkeeper:${dead}`, 72, 72, (ctx, w, h, rng) => {
    // a stooped, sackcloth-hooded figure with a coin-slot mouth
    poly(ctx, [[14, h - 4], [20, h - 40], [52, h - 40], [58, h - 4]], '#5a4a3a', rng, { lw: 3, hatch: 0.3 });
    blob(ctx, w / 2, h - 46, 20, 18, '#8a7a5a', rng, { lw: 3, hatch: 0.25 });
    if (dead) { scribble(ctx, [[28, h - 50], [34, h - 44]], 2.5, INK, rng); scribble(ctx, [[34, h - 50], [28, h - 44]], 2.5, INK, rng); scribble(ctx, [[40, h - 50], [46, h - 44]], 2.5, INK, rng); scribble(ctx, [[46, h - 50], [40, h - 44]], 2.5, INK, rng); return; }
    dot(ctx, 30, h - 48, 3, INK); dot(ctx, 44, h - 48, 3, INK);
    poly(ctx, [[30, h - 38], [42, h - 38], [42, h - 35], [30, h - 35]], '#1a1010', rng, { lw: 1.6, hatch: 0 });
    scribble(ctx, [[20, h - 58], [36, h - 66], [52, h - 58]], 2.5, '#3a2a1a', rng);
  });
}
export function trapdoorTex(kind = 'normal') {
  return tex(`trapdoor:${kind}`, 80, 64, (ctx, w, h, rng) => {
    poly(ctx, [[8, 10], [72, 10], [72, 54], [8, 54]], '#3a2a1a', rng, { lw: 3, hatch: 0.25 });
    poly(ctx, [[14, 16], [66, 16], [66, 48], [14, 48]], kind === 'light' ? '#fff6d0' : '#050303', rng, { lw: 2.6, hatch: 0 });
    if (kind === 'light') glow(ctx, w / 2, h / 2, 34, '#fff8c0', 0.8);
    for (let i = 0; i < 3; i++) scribble(ctx, [[18, 22 + i * 9], [62, 22 + i * 9]], 1.2, rgba('#5a4a3a', 0.5), rng);
  });
}
export function machineTex(kind, broken = false) {
  return tex(`machine:${kind}:${broken}`, 72, 88, (ctx, w, h, rng) => {
    const col = { slot: '#6a3a8a', blood: '#9a2a2a', fortune: '#3a6a5a' }[kind];
    poly(ctx, [[12, h - 6], [12, h - 64], [60, h - 64], [60, h - 6]], broken ? shade(col, -0.4) : col, rng, { lw: 3, hatch: 0.25 });
    blob(ctx, w / 2, h - 66, 24, 10, shade(col, 0.2), rng, { lw: 3 });
    if (broken) { for (let i = 0; i < 4; i++) scribble(ctx, [[18 + i * 10, h - 56], [22 + i * 9, h - 20]], 2, INK, rng, 4); return; }
    if (kind === 'slot') {
      poly(ctx, [[18, h - 52], [54, h - 52], [54, h - 36], [18, h - 36]], '#efe6cc', rng, { lw: 2, hatch: 0 });
      inkText(ctx, '7 ¢ ☠', w / 2, h - 39, 12, '#8a2a2a', { align: 'center', lw: 0 });
      poly(ctx, [[30, h - 24], [42, h - 24], [42, h - 20], [30, h - 20]], '#1a1010', rng, { lw: 1.6, hatch: 0 });
    } else if (kind === 'blood') {
      heartish(ctx, w / 2, h - 42, rng);
      scribble(ctx, [[w / 2, h - 30], [w / 2, h - 14]], 3, '#5a0a0a', rng);
    } else {
      blob(ctx, w / 2, h - 44, 12, 12, '#a8e0d0', rng, { lw: 2.4, hatch: 0.1 });
      glow(ctx, w / 2, h - 44, 16, '#c0fff0', 0.6);
      eye(ctx, w / 2, h - 44, 5, rng, 0, 0, { lw: 1.4 });
    }
  });
}
function heartish(ctx, x, y, rng) {
  blob(ctx, x - 5, y - 2, 7, 7, '#d82020', rng, { lw: 2 }); blob(ctx, x + 5, y - 2, 7, 7, '#d82020', rng, { lw: 2 });
  poly(ctx, [[x - 11, y], [x + 11, y], [x, y + 12]], '#d82020', rng, { lw: 2 });
}
export function priceTex(text, color = '#f1e6cc') {
  return tex(`price:${text}:${color}`, 96, 36, (ctx, w, h) => {
    inkText(ctx, text, w / 2, h - 9, 22, color, { align: 'center', lw: 4 });
  });
}
export function heartPriceTex(n) {
  return tex(`hprice:${n}`, 96, 36, (ctx, w, h, rng) => {
    for (let i = 0; i < n; i++) {
      const x = w / 2 + (i - (n - 1) / 2) * 22;
      ctx.save(); ctx.translate(x - 11, 4); ctx.drawImage(heartTex('full').image, 0, 0, 24, 22); ctx.restore();
    }
  });
}
