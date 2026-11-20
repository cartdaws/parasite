// Opening and closing vignettes: crayon panels drawn in code, one caption each.
// Any key / click advances; Esc skips.
import { makeCanvas, blob, poly, scribble, dot, eye, glow, inkText, rgba, shade, INK, wobEllipse, crayonFill, ink } from '../render/draw.js';
import { RNG } from '../core/rng.js';
import { headTex, bodyTex } from '../render/art_player.js';
import { enemyTex } from '../render/art_enemies.js';
import { audio } from '../core/audio.js';
import { touch } from '../core/touch.js';

const W = 800, H = 500;

function frame(ctx, rng) {
  ctx.fillStyle = '#e8dcc0'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.strokeRect(14 + rng.range(-2, 2), 14 + rng.range(-2, 2), W - 28, H - 110);
}
function caption(ctx, text) {
  inkText(ctx, text, W / 2, H - 46, 30, '#2a1a10', { align: 'center', lw: 0 });
}
function kid(ctx, x, y, s, dir = 2, mode = 'idle', who = 'isaiah') {
  const b = bodyTex(who, dir, 0, null).image, h = headTex(who, dir, mode, null).image;
  ctx.drawImage(b, x - 28 * s, y - 44 * s, 56 * s, 44 * s);
  ctx.drawImage(h, x - 36 * s, y - 92 * s, 72 * s, 72 * s);
}
function house(ctx, rng, x, y, s, lit = true) {
  poly(ctx, [[x - 120 * s, y], [x - 120 * s, y - 130 * s], [x + 120 * s, y - 130 * s], [x + 120 * s, y]], '#4a3a4a', rng, { lw: 5, hatch: 0.3 });
  poly(ctx, [[x - 140 * s, y - 128 * s], [x, y - 220 * s], [x + 140 * s, y - 128 * s]], '#2a1a2a', rng, { lw: 5, hatch: 0.3 });
  for (const [wx, wy, on] of [[-70, -95, lit], [50, -95, false], [-70, -40, false]]) {
    poly(ctx, [[x + (wx - 22) * s, y + (wy - 22) * s], [x + (wx + 22) * s, y + (wy - 22) * s], [x + (wx + 22) * s, y + (wy + 22) * s], [x + (wx - 22) * s, y + (wy + 22) * s]], on ? '#f0c860' : '#1a1418', rng, { lw: 4, hatch: 0.1 });
    if (on) glow(ctx, x + wx * s, y + wy * s, 50 * s, '#f0c860', 0.4);
  }
  poly(ctx, [[x + 20 * s, y], [x + 20 * s, y - 60 * s], [x + 70 * s, y - 60 * s], [x + 70 * s, y]], '#2a1a14', rng, { lw: 4 });
}

const PANELS = {
  intro: [
    { text: "It was a quiet night at Grandma's. Then something went THUMP.", draw(ctx, rng) {
      ctx.fillStyle = '#1a1830'; ctx.fillRect(18, 18, W - 36, H - 118);
      for (let i = 0; i < 30; i++) dot(ctx, rng.range(30, W - 30), rng.range(30, 200), rng.range(1, 2.5), '#e8e0c0');
      blob(ctx, 660, 80, 34, 34, '#e8e0c0', rng, { lw: 3, hatch: 0.1 });
      poly(ctx, [[18, 330], [W - 18, 310], [W - 18, H - 100], [18, H - 100]], '#2a3a2a', rng, { lw: 4, hatch: 0.4 });
      house(ctx, rng, 400, 340, 1);
      inkText(ctx, 'THUMP', 520, 150, 44, '#e0352a', { rot: 0.2, lw: 5, display: true });
    } },
    { text: "Something upstairs was calling his name. It didn't sound like Grandma.", draw(ctx, rng) {
      ctx.fillStyle = '#3a2a2a'; ctx.fillRect(18, 18, W - 36, H - 118);
      for (let i = 0; i < 7; i++) poly(ctx, [[200 + i * 60, 380 - i * 45], [320 + i * 60, 380 - i * 45], [320 + i * 60, 400 - i * 45], [200 + i * 60, 400 - i * 45]], '#5a4030', rng, { lw: 3, hatch: 0.3 });
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; wobEllipse(ctx, 640, 120, 70, 110, rng, 0.15); ctx.fill();
      for (const d of [-1, 1]) { dot(ctx, 640 + d * 20, 100, 7, '#ffe0a0'); glow(ctx, 640 + d * 20, 100, 20, '#ffe0a0', 0.4); }
      kid(ctx, 150, 390, 1.6, 1, 'hurt');
      inkText(ctx, 'Isaaaaiah...', 520, 260, 30, '#e8dcc0', { rot: -0.1, lw: 4, display: true });
    } },
    { text: 'So Isaiah hid in the one place nobody ever goes.', draw(ctx, rng) {
      ctx.fillStyle = '#2a1e18'; ctx.fillRect(18, 18, W - 36, H - 118);
      for (let i = 0; i < 9; i++) poly(ctx, [[18 + i * 88, 200], [100 + i * 88, 198], [104 + i * 88, 226], [18 + i * 88, 228]], '#6a4a34', rng, { lw: 3, hatch: 0.3 });
      ctx.fillStyle = '#050304'; wobEllipse(ctx, 400, 300, 150, 60, rng, 0.06); ctx.fill();
      kid(ctx, 400, 320, 1.4, 0, 'idle');
      ctx.fillStyle = '#050304'; ctx.fillRect(250, 320, 300, 60);
      poly(ctx, [[540, 200], [660, 160], [668, 190], [548, 230]], '#6a4a34', rng, { lw: 3, hatch: 0.3 });
    } },
    { text: 'The crawlspace went down a lot farther than it should have.', draw(ctx, rng) {
      ctx.fillStyle = '#0a0606'; ctx.fillRect(18, 18, W - 36, H - 118);
      for (let i = 0; i < 6; i++) { ctx.strokeStyle = rgba('#5a3a2a', 0.8 - i * 0.12); ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(400, 200, 320 - i * 50, 150 - i * 24, 0, 0, 7); ctx.stroke(); }
      kid(ctx, 400, 300, 0.9, 2, 'idle');
      for (let i = 0; i < 4; i++) dot(ctx, 120 + i * 180, 120 + (i % 2) * 180, 4, '#c03030');
    } },
  ],
  ending: [
    { text: 'The heart under the house finally stopped beating.', draw(ctx, rng) {
      ctx.fillStyle = '#2a0a0a'; ctx.fillRect(18, 18, W - 36, H - 118);
      const h = enemyTex('hm_heart', 0).image;
      ctx.globalAlpha = 0.7; ctx.drawImage(h, 260, 50, 280, 280); ctx.globalAlpha = 1;
      for (let i = 0; i < 20; i++) scribble(ctx, [[rng.range(40, 760), rng.range(30, 380)], [rng.range(40, 760), rng.range(30, 380)]], 1.5, rgba('#000000', 0.4), rng, 4);
      kid(ctx, 140, 380, 1.3, 1, 'shoot');
    } },
    { text: 'Isaiah climbed back up just as the sun came up.', draw(ctx, rng) {
      const g = ctx.createLinearGradient(0, 18, 0, 380); g.addColorStop(0, '#f0c890'); g.addColorStop(1, '#e8a070');
      ctx.fillStyle = g; ctx.fillRect(18, 18, W - 36, H - 118);
      blob(ctx, 620, 120, 50, 50, '#fff0a0', rng, { lw: 3, hatch: 0.1 });
      poly(ctx, [[18, 320], [W - 18, 300], [W - 18, H - 100], [18, H - 100]], '#5a8a4a', rng, { lw: 4, hatch: 0.4 });
      house(ctx, rng, 300, 330, 0.9, false);
      kid(ctx, 560, 380, 1.3, 2, 'happy');
    } },
    { text: 'The house was quiet again. The good kind of quiet.', draw(ctx, rng) {
      ctx.fillStyle = '#e8d8b8'; ctx.fillRect(18, 18, W - 36, H - 118);
      poly(ctx, [[200, 300], [600, 300], [620, 380], [180, 380]], '#8a5a3a', rng, { lw: 4, hatch: 0.3 });
      blob(ctx, 400, 290, 40, 12, '#e8e8e8', rng, { lw: 3 });
      scribble(ctx, [[380, 285], [400, 272], [420, 285]], 2, '#8a6a3a', rng);
      // grandma's glasses, folded neatly
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(330, 296, 14, 0, 7); ctx.arc(368, 296, 14, 0, 7); ctx.stroke();
      kid(ctx, 520, 290, 1.1, 3, 'idle');
      inkText(ctx, '(Grandma always said he was brave)', 400, 120, 26, '#5a4a3a', { align: 'center', lw: 0, rot: -0.03 });
    } },
  ],
};

export function playPanels(which, done) {
  const root = document.getElementById('panels');
  const list = PANELS[which];
  if (!list || !list.length) { done(); return; }
  let i = 0;
  const c = makeCanvas(W, H);
  const hint = document.createElement('div'); hint.className = 'hint'; hint.textContent = touch.active ? 'tap to continue' : 'any key to continue · Esc to skip';
  root.innerHTML = ''; root.appendChild(c); root.appendChild(hint); root.classList.add('active');
  const show = () => {
    const ctx = c.getContext('2d');
    const rng = new RNG(which + i);
    ctx.clearRect(0, 0, W, H);
    frame(ctx, rng);
    ctx.save(); ctx.beginPath(); ctx.rect(18, 18, W - 36, H - 118); ctx.clip();
    list[i].draw(ctx, rng);
    ctx.restore();
    caption(ctx, list[i].text);
    audio.play('select');
  };
  let ready = 0;
  const finish = () => { window.removeEventListener('keydown', onKey); root.removeEventListener('pointerdown', onClick); root.classList.remove('active'); root.innerHTML = ''; done(); };
  const next = () => { if (performance.now() < ready) return; ready = performance.now() + 350; i++; if (i >= list.length) finish(); else show(); };
  const onKey = (e) => { e.preventDefault(); if (e.code === 'Escape') finish(); else next(); };
  const onClick = () => next();
  window.addEventListener('keydown', onKey);
  root.addEventListener('pointerdown', onClick);
  ready = performance.now() + 400;
  show();
}
