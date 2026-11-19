// Isaiah (and June) — head and body drawn separately so the head can face the
// shooting direction while the body faces the walking direction.
// Cosmetics from items are layered on procedurally.
import { tex, blob, poly, scribble, eye, dot, ink, wobEllipse, crayonFill, shade, INK, glow, rgba } from './draw.js';

export const CHARACTERS = {
  isaiah: {
    name: 'Isaiah', skin: '#e9c6a5', hair: '#3b2a20', shirt: '#7d8a3c', stripe: '#c9b458', pants: '#3e3a4a',
    eyes: '#2a1a14', freckles: false, bandage: true, hairStyle: 'mess',
  },
  june: {
    name: 'June', skin: '#f0cfb2', hair: '#b4532a', shirt: '#4f6e8c', stripe: '#d9d2bd', pants: '#5a3d2e',
    eyes: '#2b3a4a', freckles: true, bandage: false, hairStyle: 'pigtails',
  },
};

const HEAD = 72; // canvas px
const BODY_W = 56, BODY_H = 44;

function cosKey(c) { return c ? JSON.stringify(c) : ''; }

/** dir: 0 up, 1 right, 2 down, 3 left. mode: 'idle' | 'shoot' | 'hurt' | 'happy' */
export function headTex(charId, dir, mode, cos) {
  const key = `head:${charId}:${dir}:${mode}:${cosKey(cos)}`;
  return tex(key, HEAD, HEAD, (ctx, w, h, rng) => {
    const ch = CHARACTERS[charId];
    const skin = cos && cos.skin ? cos.skin : ch.skin;
    if (dir === 3) { ctx.translate(w, 0); ctx.scale(-1, 1); dir = 1; }
    const cx = w / 2, cy = h * 0.54, r = w * 0.36;
    // behind-head cosmetics
    if (cos?.halo) { ctx.save(); ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx, cy - r - 6, r * 0.7, 5, 0, 0, 7); ctx.stroke(); ctx.restore(); glow(ctx, cx, cy - r - 6, r, '#fff2a0', 0.25); }
    if (cos?.wings) {
      for (const s of [-1, 1]) poly(ctx, [[cx + s * r * 0.6, cy], [cx + s * r * 1.35, cy - r * 0.9], [cx + s * r * 1.3, cy - r * 0.2], [cx + s * r * 0.9, cy + r * 0.3]], cos.wings, rng, { lw: 2, hatch: 0.1 });
    }
    if (ch.hairStyle === 'pigtails' && dir !== 1) {
      for (const s of [-1, 1]) blob(ctx, cx + s * r * 1.05, cy + r * 0.15, r * 0.28, r * 0.38, ch.hair, rng, { lw: 2.5 });
    }
    if (ch.hairStyle === 'pigtails' && dir === 1) blob(ctx, cx - r * 1.0, cy + r * 0.1, r * 0.3, r * 0.4, ch.hair, rng, { lw: 2.5 });
    // horns (behind the hair outline)
    if (cos?.horns) for (const s of (dir === 1 ? [1] : [-1, 1])) poly(ctx, [[cx + s * r * 0.35, cy - r * 0.7], [cx + s * r * 0.9, cy - r * 1.35], [cx + s * r * 0.7, cy - r * 0.55]], cos.horns, rng, { lw: 2 });
    // head
    blob(ctx, cx, cy, r, r * 0.95, skin, rng, { hatch: 0.12, lw: 3.2 });
    // hair
    const hair = cos?.hair || ch.hair;
    if (dir === 0) {
      ctx.save(); wobEllipse(ctx, cx, cy, r, r * 0.95, rng, 0.04); ctx.clip();
      blob(ctx, cx, cy - r * 0.1, r * 1.1, r * 0.95, hair, rng, { ink: false, hatch: 0.3 });
      ctx.restore();
      wobEllipse(ctx, cx, cy, r, r * 0.95, rng, 0.04); ink(ctx, 3.2);
      scribble(ctx, [[cx - 4, cy - r * 0.2], [cx, cy - r * 0.45], [cx + 5, cy - r * 0.1]], 2, shade(hair, -0.4), rng);
    } else {
      ctx.save(); wobEllipse(ctx, cx, cy, r, r * 0.95, rng, 0.04); ctx.clip();
      if (dir === 2) blob(ctx, cx, cy - r * 0.95, r * 1.2, r * 0.62, hair, rng, { ink: false, hatch: 0.3 });
      else { blob(ctx, cx - r * 0.25, cy - r * 0.8, r * 1.1, r * 0.65, hair, rng, { ink: false, hatch: 0.3 }); blob(ctx, cx - r * 0.95, cy - r * 0.1, r * 0.45, r * 0.8, hair, rng, { ink: false }); }
      ctx.restore();
      wobEllipse(ctx, cx, cy, r, r * 0.95, rng, 0.04); ink(ctx, 3.2);
    }
    // cowlick tufts
    if (ch.hairStyle === 'mess') {
      scribble(ctx, [[cx - 6, cy - r * 0.9], [cx - 10, cy - r * 1.25], [cx - 3, cy - r * 1.05]], 3, INK, rng);
      scribble(ctx, [[cx + 2, cy - r * 0.92], [cx + 7, cy - r * 1.3], [cx + 9, cy - r * 1.0]], 3, INK, rng);
    }
    if (dir === 0) { drawHeadCos(ctx, cos, cx, cy, r, 0, rng); return; }

    // ---- face ----
    const fx = dir === 1 ? r * 0.35 : 0;
    const eyeY = cy + r * 0.08;
    const eyeR = r * 0.26;
    const look = dir === 1 ? [0.6, 0.1] : [0, 0.2];
    const eyeCol = cos?.eyeColor || ch.eyes;
    const eyeList = dir === 1 ? [cx + fx + r * 0.2] : [cx - r * 0.38, cx + r * 0.38];
    if (mode === 'shoot') {
      // squeezed eyes (crying hard)
      for (const ex of eyeList) {
        scribble(ctx, [[ex - eyeR, eyeY - 2], [ex, eyeY + 3], [ex + eyeR, eyeY - 2]], 3, INK, rng);
      }
    } else if (mode === 'hurt') {
      for (const ex of eyeList) {
        scribble(ctx, [[ex - eyeR * 0.8, eyeY - eyeR * 0.8], [ex + eyeR * 0.8, eyeY + eyeR * 0.8]], 3, INK, rng);
        scribble(ctx, [[ex + eyeR * 0.8, eyeY - eyeR * 0.8], [ex - eyeR * 0.8, eyeY + eyeR * 0.8]], 3, INK, rng);
      }
    } else {
      for (const ex of eyeList) eye(ctx, ex, eyeY, eyeR, rng, look[0], look[1], { iris: eyeCol, pupilR: 0.32, lw: 2.2 });
    }
    // tear streaks
    ctx.strokeStyle = rgba(cos?.tearColor || '#9cc8e8', 0.75); ctx.lineWidth = 2.2;
    for (const ex of eyeList) { ctx.beginPath(); ctx.moveTo(ex - 1, eyeY + eyeR); ctx.quadraticCurveTo(ex - 3, eyeY + eyeR + 6, ex - 1, eyeY + eyeR + 11); ctx.stroke(); }
    // brows (worried)
    for (const ex of eyeList) {
      const s = ex < cx + fx ? -1 : 1;
      scribble(ctx, [[ex - eyeR * 0.9, eyeY - eyeR * 1.35 + (dir === 1 ? 0 : s * 2)], [ex + eyeR * 0.9, eyeY - eyeR * 1.35 - (dir === 1 ? 0 : s * 2)]], 2.4, INK, rng);
    }
    // mouth
    const mx = dir === 1 ? cx + fx + r * 0.45 : cx, my = cy + r * 0.56;
    if (mode === 'shoot' || mode === 'hurt') blob(ctx, mx, my, r * 0.16, r * 0.14, '#4a1a1a', rng, { lw: 2, hatch: 0 });
    else if (mode === 'happy') scribble(ctx, [[mx - 6, my - 2], [mx, my + 3], [mx + 6, my - 2]], 2.4, INK, rng);
    else scribble(ctx, [[mx - 5, my + 1], [mx - 1, my - 1], [mx + 4, my + 1]], 2.2, INK, rng);
    // freckles / bandage
    if (ch.freckles) for (let i = 0; i < 5; i++) dot(ctx, cx - r * 0.5 + (i % 3) * 3 + (dir === 1 ? r * 0.5 : 0), cy + r * 0.38 + (i > 2 ? 3 : 0), 1, '#a5643d');
    if (ch.bandage && dir === 2) {
      ctx.save(); ctx.translate(cx + r * 0.55, cy + r * 0.4); ctx.rotate(-0.5);
      poly(ctx, [[-7, -3], [7, -3], [7, 3], [-7, 3]], '#efe2c2', rng, { lw: 1.6, hatch: 0 });
      dot(ctx, -2, 0, 0.8, '#b8a37c'); dot(ctx, 2, 0, 0.8, '#b8a37c');
      ctx.restore();
    }
    drawHeadCos(ctx, cos, cx, cy, r, dir, rng, eyeList, eyeY);
  });
}

function drawHeadCos(ctx, cos, cx, cy, r, dir, rng, eyeList = [], eyeY = 0) {
  if (!cos) return;
  if (cos.blood) { // bloody face streaks
    ctx.strokeStyle = 'rgba(150,20,20,0.75)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); const x = cx - r * 0.5 + i * r * 0.5; ctx.moveTo(x, cy - r * 0.8); ctx.lineTo(x + rng.range(-3, 3), cy - r * 0.2); ctx.stroke(); }
  }
  if (cos.stitches && dir !== 0) scribble(ctx, [[cx - r * 0.7, cy - r * 0.3], [cx + r * 0.1, cy - r * 0.55]], 2, INK, rng);
  if (cos.patch && dir !== 0) { // eye patch over first eye
    const ex = eyeList[0];
    blob(ctx, ex, eyeY, r * 0.32, r * 0.3, '#222', rng, { lw: 2, hatch: 0.1 });
    scribble(ctx, [[cx - r, cy - r * 0.5], [ex, eyeY], [cx + r, cy - r * 0.2]], 2, INK, rng);
  }
  if (cos.thirdEye && dir !== 0) eye(ctx, dir === 1 ? cx + r * 0.45 : cx, cy - r * 0.45, r * 0.2, rng, 0, 0.2, { iris: '#7a2a8a', lw: 2 });
  if (cos.extraEyes && dir !== 0) for (const [ox, oy] of [[-0.55, -0.4], [0.6, -0.35], [0.1, 0.4]]) eye(ctx, cx + ox * r * (dir === 1 ? 0.6 : 1) + (dir === 1 ? r * 0.3 : 0), cy + oy * r, r * 0.12, rng, 0, 0, { lw: 1.4 });
  if (cos.glasses && dir !== 0) {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
    for (const ex of eyeList) { ctx.beginPath(); ctx.arc(ex, eyeY, r * 0.33, 0, 7); ctx.stroke(); }
    if (eyeList.length === 2) scribble(ctx, [[eyeList[0] + r * 0.33, eyeY], [eyeList[1] - r * 0.33, eyeY]], 2, INK, rng);
  }
  if (cos.mask && dir !== 0) {
    poly(ctx, [[cx - r * 0.85, cy + r * 0.25], [cx + r * 0.85, cy + r * 0.25], [cx + r * 0.6, cy + r * 0.85], [cx - r * 0.6, cy + r * 0.85]], cos.mask, rng, { lw: 2 });
  }
  if (cos.bandana) {
    ctx.save(); wobEllipse(ctx, cx, cy, r, r * 0.95, rng, 0.03); ctx.clip();
    ctx.fillStyle = cos.bandana; ctx.fillRect(cx - r - 2, cy - r * 0.7, r * 2 + 4, r * 0.32);
    ctx.restore();
    scribble(ctx, [[cx - r, cy - r * 0.7], [cx + r, cy - r * 0.7]], 2, INK, rng);
  }
  if (cos.antennae) for (const s of (dir === 1 ? [1] : [-1, 1])) { scribble(ctx, [[cx + s * r * 0.3, cy - r * 0.85], [cx + s * r * 0.55, cy - r * 1.35], [cx + s * r * 0.8, cy - r * 1.45]], 2, INK, rng); dot(ctx, cx + s * r * 0.8, cy - r * 1.45, 3, '#d6c9a0'); }
  if (cos.hat === 'thimble') poly(ctx, [[cx - r * 0.45, cy - r * 0.75], [cx + r * 0.45, cy - r * 0.75], [cx + r * 0.32, cy - r * 1.35], [cx - r * 0.32, cy - r * 1.35]], '#b7b2a8', rng, { lw: 2.4 });
  if (cos.hat === 'cap') { blob(ctx, cx, cy - r * 0.75, r * 0.85, r * 0.42, cos.hatColor || '#a13a2a', rng, { lw: 2.4 }); if (dir !== 0) blob(ctx, cx + (dir === 1 ? r * 0.7 : 0), cy - r * 0.55, r * 0.55, r * 0.15, shade(cos.hatColor || '#a13a2a', -0.2), rng, { lw: 2 }); }
  if (cos.hat === 'crown') poly(ctx, [[cx - r * 0.6, cy - r * 0.7], [cx - r * 0.6, cy - r * 1.25], [cx - r * 0.3, cy - r * 0.95], [cx, cy - r * 1.35], [cx + r * 0.3, cy - r * 0.95], [cx + r * 0.6, cy - r * 1.25], [cx + r * 0.6, cy - r * 0.7]], cos.hatColor || '#c9a02a', rng, { lw: 2.4 });
  if (cos.hat === 'mushroom') { blob(ctx, cx, cy - r * 0.8, r * 1.05, r * 0.5, '#b3302a', rng, { lw: 2.4 }); for (let i = 0; i < 4; i++) dot(ctx, cx - r * 0.6 + i * r * 0.4, cy - r * 0.9 + (i % 2) * 5, 3, '#f0e4cf'); }
  if (cos.hat === 'candle') { poly(ctx, [[cx - 4, cy - r * 0.85], [cx + 4, cy - r * 0.85], [cx + 4, cy - r * 1.4], [cx - 4, cy - r * 1.4]], '#efe4c4', rng, { lw: 2 }); glow(ctx, cx, cy - r * 1.55, 10, '#ffcc55', 0.8); dot(ctx, cx, cy - r * 1.52, 3, '#ffdd66'); }
  if (cos.flies) for (let i = 0; i < 3; i++) dot(ctx, cx + Math.cos(i * 2.1) * r * 0.9, cy - r * 1.05 + Math.sin(i * 2.1) * 4, 2.5, INK);
}

/** frame 0..3 walk, 'hold' arms up, 'dead' lying */
export function bodyTex(charId, dir, frame, cos) {
  const key = `body:${charId}:${dir}:${frame}:${cosKey(cos)}`;
  return tex(key, BODY_W, BODY_H, (ctx, w, h, rng) => {
    const ch = CHARACTERS[charId];
    const skin = cos && cos.skin ? cos.skin : ch.skin;
    const shirt = cos?.shirt || ch.shirt;
    if (dir === 3) { ctx.translate(w, 0); ctx.scale(-1, 1); dir = 1; }
    const cx = w / 2;
    const step = frame === 'hold' ? 0 : [0, 1, 0, -1][frame] || 0;
    // legs
    if (dir === 1) {
      const a = step * 5;
      poly(ctx, [[cx - 4 + a, h - 16], [cx + a, h - 16], [cx + 1 + a, h - 4], [cx - 5 + a, h - 4]], ch.pants, rng, { lw: 2.2, hatch: 0 });
      poly(ctx, [[cx - 2 - a, h - 16], [cx + 3 - a, h - 16], [cx + 4 - a, h - 4], [cx - 2 - a, h - 4]], shade(ch.pants, -0.2), rng, { lw: 2.2, hatch: 0 });
      blob(ctx, cx + a + 1, h - 4, 5, 3, '#e8e0d0', rng, { lw: 1.8, hatch: 0 });
      blob(ctx, cx - a + 2, h - 4, 5, 3, '#ddd4c2', rng, { lw: 1.8, hatch: 0 });
    } else {
      for (const s of [-1, 1]) {
        const lift = step * s * 3;
        poly(ctx, [[cx + s * 7 - 3, h - 17], [cx + s * 7 + 3, h - 17], [cx + s * 7 + 3, h - 5 - lift], [cx + s * 7 - 3, h - 5 - lift]], ch.pants, rng, { lw: 2.2, hatch: 0 });
        blob(ctx, cx + s * 7, h - 4 - lift, 4.5, 3, '#e8e0d0', rng, { lw: 1.8, hatch: 0 });
      }
    }
    // sweater torso (oversized)
    const tw = dir === 1 ? 13 : 16;
    poly(ctx, [[cx - tw, h - 14], [cx - tw + 3, h - 36], [cx + tw - 3, h - 36], [cx + tw, h - 14], [cx, h - 12]], shirt, rng, { lw: 2.6, hatch: 0.12 });
    // stripes
    ctx.save(); wobEllipse(ctx, cx, h - 24, tw, 12, rng, 0.02); ctx.clip();
    ctx.strokeStyle = rgba(cos?.stripe || ch.stripe, 0.8); ctx.lineWidth = 2.6;
    for (let y = h - 31; y < h - 12; y += 6) { ctx.beginPath(); ctx.moveTo(cx - tw, y + rng.range(-1, 1)); ctx.lineTo(cx + tw, y + rng.range(-1, 1)); ctx.stroke(); }
    ctx.restore();
    // arms
    if (frame === 'hold') {
      for (const s of [-1, 1]) { poly(ctx, [[cx + s * (tw - 2), h - 34], [cx + s * (tw + 3), h - 34], [cx + s * (tw + 1), h - 44], [cx + s * (tw - 4), h - 44]], shirt, rng, { lw: 2.2, hatch: 0 }); }
    } else if (dir === 1) {
      const a = -step * 3;
      poly(ctx, [[cx - 3 + a, h - 33], [cx + 3 + a, h - 33], [cx + 4 + a, h - 20], [cx - 2 + a, h - 20]], shade(shirt, -0.15), rng, { lw: 2.2, hatch: 0 });
      blob(ctx, cx + 1 + a, h - 19, 3, 3, skin, rng, { lw: 1.8, hatch: 0 });
    } else {
      for (const s of [-1, 1]) {
        const sw = step * s * 2;
        poly(ctx, [[cx + s * tw - 2, h - 33], [cx + s * (tw + 4), h - 30], [cx + s * (tw + 3), h - 19 + sw], [cx + s * (tw - 2), h - 20 + sw]], shade(shirt, -0.12), rng, { lw: 2.2, hatch: 0 });
        blob(ctx, cx + s * (tw + 1), h - 18 + sw, 3, 3, skin, rng, { lw: 1.8, hatch: 0 });
      }
    }
    if (cos?.belt) scribble(ctx, [[cx - tw + 1, h - 16], [cx + tw - 1, h - 16]], 3, cos.belt, rng);
    if (cos?.rosary && dir !== 0) { ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, h - 33, 7, 0.2, Math.PI - 0.2); ctx.stroke(); dot(ctx, cx, h - 25, 2, '#8a5a3a'); }
  });
}

export function deadTex(charId) {
  return tex(`dead:${charId}`, 80, 48, (ctx, w, h, rng) => {
    const ch = CHARACTERS[charId];
    blob(ctx, w * 0.62, h * 0.6, 20, 9, ch.shirt, rng, { lw: 2.4 });
    blob(ctx, w * 0.3, h * 0.55, 17, 15, ch.skin, rng, { lw: 3 });
    blob(ctx, w * 0.24, h * 0.42, 12, 7, ch.hair, rng, { lw: 2 });
    for (const ex of [w * 0.26, w * 0.36]) { scribble(ctx, [[ex - 3, h * 0.55 - 3], [ex + 3, h * 0.55 + 3]], 2, INK, rng); scribble(ctx, [[ex + 3, h * 0.55 - 3], [ex - 3, h * 0.55 + 3]], 2, INK, rng); }
    ctx.fillStyle = 'rgba(140,200,240,0.5)'; ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.85, 22, 5, 0, 0, 7); ctx.fill();
  });
}

/** Portrait used on the boss intro card and menus. */
export function portraitTex(charId) {
  return tex(`portrait:${charId}`, 256, 256, (ctx, w, h, rng) => {
    const head = headTex(charId, 2, 'idle', null).image;
    const body = bodyTex(charId, 2, 0, null).image;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(body, w / 2 - 84, h * 0.58, 168, 132);
    ctx.drawImage(head, w / 2 - 110, h * 0.04, 220, 220);
  });
}
