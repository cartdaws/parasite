// In-game HUD drawn on a 2D canvas over the WebGL view: hearts, pickups,
// stats, minimap, active/pocket/trinket slots, banners, boss bar, vignette.
import { CFG } from '../config.js';
import { S } from '../state.js';
import { gfx, worldToScreen } from '../render/gfx.js';
import { tex, inkText, blob, poly, scribble, dot, rgba, shade, INK, FONT, glow } from '../render/draw.js';
import { heartTex, coinTex, bombTex, keyTex, cardBackTex, pillTex } from '../render/art_pickups.js';
import { itemIconTex, trinketIconTex, cardTex } from '../render/art_items.js';
import { portraitTex } from '../render/art_player.js';
import { BOSS_INFO } from '../entities/bosses.js';
import { ITEMS } from '../items/items.js';
import { CURSES } from '../run.js';
import { input } from '../core/input.js';

const VW0 = 960, VH0 = 540;

export class HUD {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.banners = [];     // item / pickup banners
    this.floorB = null;
    this.fadeT = 0; this.fadeDur = 0;
    this.mapOpen = false;
    this.intro = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.c.width = Math.floor(window.innerWidth * dpr);
    this.c.height = Math.floor(window.innerHeight * dpr);
    this.c.style.width = window.innerWidth + 'px';
    this.c.style.height = window.innerHeight + 'px';
    this.dpr = dpr;
    this.scale = Math.min(window.innerWidth / VW0, window.innerHeight / VH0) * dpr;
    this.VW = this.c.width / this.scale; this.VH = this.c.height / this.scale;
  }

  itemBanner(title, sub) {
    this.banners = [{ title, sub, t: 0, dur: 2.8 }];
  }
  floorBanner(name, curse) { this.floorB = { name, curse, t: 0, dur: 3.2 }; }
  fade(dur) { this.fadeT = 0; this.fadeDur = dur; }
  showBossIntro(id) { this.intro = { id, t: 0 }; }
  hideBossIntro() { this.intro = null; }

  draw(dt) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.c.width, this.c.height);
    if (!S.run || !S.player) return;
    this.drawVignette(ctx, dt);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const p = S.player;
    if (S.game.state !== 'title') {
      this.drawHearts(ctx, p);
      this.drawCounts(ctx, p);
      this.drawStats(ctx, p);
      if (S.run.curse !== 'lost') this.drawMinimap(ctx);
      else inkText(ctx, '?', this.VW - 60, 60, 40, '#8a7a6a', { align: 'center' });
      this.drawSlots(ctx, p);
      this.drawBossBar(ctx);
      this.drawBanners(ctx, dt);
      if (this.mapOpen) this.drawBigMap(ctx);
      if (S.game.restartHold > 0) this.drawRestartHold(ctx, S.game.restartHold);
    }
    if (this.intro) this.drawBossIntro(ctx, dt);
    // fade overlay
    if (this.fadeDur > 0) {
      this.fadeT += dt;
      const k = this.fadeT / this.fadeDur;
      const a = k < 0.5 ? k * 2 : Math.max(0, 2 - k * 2);
      ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, this.VW, this.VH);
      if (k >= 1) this.fadeDur = 0;
    }
  }

  // ---- vignette / darkness ------------------------------------------------------
  drawVignette(ctx) {
    const w = this.c.width, h = this.c.height;
    const p = S.player;
    const sp = worldToScreen(S.room.originX + p.x, 0.5, S.room.originZ + p.z);
    const px = sp.x * this.dpr, py = sp.y * this.dpr;
    const fl = S.floorNum;
    const dark = S.run.curse === 'darkness';
    // room-edge darkness (always on, stronger on deeper floors)
    const cx = w / 2, cy = h / 2;
    const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.35, cx, cy, Math.max(w, h) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.55 + fl * 0.06})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (dark || fl >= 4) {
      const r = (dark ? 0.22 : 0.42) * Math.min(w, h);
      const g2 = ctx.createRadialGradient(px, py, r * 0.3, px, py, r * 2.2);
      g2.addColorStop(0, 'rgba(0,0,0,0)');
      g2.addColorStop(1, `rgba(0,0,0,${dark ? 0.94 : 0.35})`);
      ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
    }
  }

  // ---- hearts -------------------------------------------------------------------
  drawHearts(ctx, p) {
    const x0 = 18, y0 = 14, s = 22, per = 6;
    if (S.run.curse === 'unknown') { inkText(ctx, '? ? ?', x0, y0 + 18, 22, '#c81e1e'); return; }
    const icons = [];
    const full = Math.floor(p.red / 2), half = p.red % 2;
    const containers = Math.ceil(p.maxRed / 2);
    for (let i = 0; i < containers; i++) icons.push(i < full ? 'full' : i === full && half ? 'half' : 'empty');
    for (let i = 0; i < p.soul.length; i += 2) {
      const t = p.soul[i], whole = i + 1 < p.soul.length;
      icons.push(t === 'b' ? (whole ? 'black' : 'halfblack') : whole ? 'soul' : 'halfsoul');
    }
    icons.forEach((k, i) => {
      const x = x0 + (i % per) * (s + 2), y = y0 + Math.floor(i / per) * (s + 1);
      // pulse on low health
      const pulse = (p.red <= 2 && i === 0 && p.soul.length === 0) ? 1 + Math.sin(performance.now() / 120) * 0.08 : 1;
      if (k === 'half' || k === 'halfsoul' || k === 'halfblack') ctx.drawImage(heartTexHud('empty').image, x, y, s, s * 0.9);
      ctx.drawImage(heartTexHud(k).image, x + (s - s * pulse) / 2, y + (s * 0.9 - s * 0.9 * pulse) / 2, s * pulse, s * 0.9 * pulse);
    });
  }
  drawCounts(ctx, p) {
    const rows = Math.ceil((Math.ceil(p.maxRed / 2) + Math.ceil(p.soul.length / 2)) / 6);
    let y = 22 + Math.max(1, rows) * 23;
    const row = (img, n) => {
      ctx.drawImage(img, 18, y - 4, 20, 20);
      inkText(ctx, String(n).padStart(2, '0'), 42, y + 12, 17, '#f1e6cc');
      y += 22;
    };
    row(coinTex('penny', 0).image, p.coins);
    row(bombTex('single', 0, '').image, p.bombs);
    row(keyTex(false).image, p.keys);
    this.statsY = y + 8;
  }
  drawStats(ctx, p) {
    const st = p.stats;
    let y = this.statsY || 120;
    const items = [
      ['speed', st.speed.toFixed(2)], ['tears', st.tears.toFixed(2)], ['damage', st.damage.toFixed(2)],
      ['range', st.range.toFixed(2)], ['shotspeed', st.shotSpeed.toFixed(2)], ['luck', st.luck.toFixed(0)],
    ];
    ctx.globalAlpha = 0.85;
    for (const [k, v] of items) {
      ctx.drawImage(statIcon(k).image, 16, y - 2, 18, 18);
      inkText(ctx, v, 38, y + 12, 14, '#e8dcc0', { lw: 3 });
      y += 19;
    }
    ctx.globalAlpha = 1;
  }

  // ---- minimap ----------------------------------------------------------------
  drawMinimap(ctx) {
    const fl = S.floor;
    const cw = 13, ch = 10;
    const boxW = 124, boxH = 96;
    const bx = this.VW - boxW - 14, by = 12;
    ctx.save();
    ctx.fillStyle = 'rgba(10,6,6,0.55)';
    ctx.strokeStyle = rgba('#e8dcc0', 0.25); ctx.lineWidth = 2;
    roundRect(ctx, bx, by, boxW, boxH, 6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(bx + 2, by + 2, boxW - 4, boxH - 4); ctx.clip();
    const cur = S.room;
    const ccx = cur.offgrid ? 6.5 : cur.gx + cur.cw / 2, ccy = cur.offgrid ? 6.5 : cur.gy + cur.ch / 2;
    const ox = bx + boxW / 2 - ccx * cw, oy = by + boxH / 2 - ccy * ch;
    this.drawRooms(ctx, fl, ox, oy, cw, ch, 1);
    ctx.restore();
  }
  drawRooms(ctx, fl, ox, oy, cw, ch, sc) {
    const cur = S.room;
    const revealAll = S.player && S.player.mapRevealed;
    for (const r of fl.rooms) {
      if (r.offgrid) continue;
      const known = r.seen || (revealAll && (r.type !== 'secret' || S.player.secretsRevealed));
      if (!known) continue;
      const visited = r.visited;
      const x = ox + r.gx * cw, y = oy + r.gy * ch;
      ctx.fillStyle = r === cur ? '#f4ecd8' : visited ? '#9a8a78' : (r.seen === 'adjacent' || revealAll) ? 'rgba(60,50,45,0.85)' : '#5a4e46';
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5 * sc;
      // draw each cell, merged for big rooms
      if (r.cells.length > 1) {
        for (const [gx, gy] of r.cells) { ctx.fillRect(ox + gx * cw + 1, oy + gy * ch + 1, cw - 1, ch - 1); }
        ctx.strokeRect(x + 0.5, y + 0.5, r.cw * cw, r.ch * ch);
      } else { ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2); ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2); }
      if (!visited && (r.seen === 'adjacent' || revealAll)) { ctx.strokeStyle = rgba('#e8dcc0', 0.5); ctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3); }
      const icon = r.type !== 'normal' && r.type !== 'start' ? r.type : null;
      if (icon && (visited || r.seen || revealAll)) ctx.drawImage(roomIcon(icon).image, x + cw / 2 - 5 * sc, y + ch / 2 - 5 * sc, 10 * sc, 10 * sc);
    }
  }
  toggleMap() { this.mapOpen = !this.mapOpen; }
  drawBigMap(ctx) {
    if (S.run.curse === 'lost') return;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, this.VW, this.VH);
    const cw = 30, ch = 23;
    const fl = S.floor;
    const ox = this.VW / 2 - 6.5 * cw, oy = this.VH / 2 - 6.5 * ch;
    this.drawRooms(ctx, fl, ox, oy, cw, ch, 2);
    inkText(ctx, CFG.FLOOR_NAMES[S.floorNum - 1], this.VW / 2, 40, 28, '#f1e6cc', { align: 'center' });
  }

  // ---- slots --------------------------------------------------------------------
  drawSlots(ctx, p) {
    const by = this.VH - 70;
    // active item + charge bar
    if (p.active) {
      const def = ITEMS[p.active.id];
      ctx.drawImage(itemIconTex(p.active.id).image, 16, by, 54, 54);
      if (def && def.charge) {
        const bx = 74, bh = 50, bw = 9;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by + 2, bw, bh);
        const k = Math.min(1, p.active.charge / def.charge);
        ctx.fillStyle = k >= 1 ? '#f0e060' : '#c8a838';
        ctx.fillRect(bx + 1, by + 2 + bh * (1 - k), bw - 2, bh * k);
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(bx, by + 2, bw, bh);
        for (let i = 1; i < def.charge; i++) { const yy = by + 2 + (bh / def.charge) * i; ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(bx + bw, yy); ctx.stroke(); }
      }
    }
    // pocket (card / pill)
    const px = this.VW - 62;
    if (p.pocket) {
      const img = p.pocket.type === 'card' ? cardTex(p.pocket.id).image : pillTex(S.run.pillColorOf(p.pocket.id)).image;
      ctx.drawImage(img, px, by + 4, p.pocket.type === 'card' ? 36 : 44, p.pocket.type === 'card' ? 48 : 44);
      const name = p.pocket.type === 'card' ? S.game.cardName(p.pocket.id) : S.game.pillName(p.pocket.id);
      inkText(ctx, name, px - 8, by + 50, 13, '#e8dcc0', { align: 'right', lw: 3 });
      inkText(ctx, 'Q', px + 40, by + 50, 13, '#a89a88', { lw: 3 });
    }
    if (p.trinket) {
      ctx.drawImage(trinketIconTex(p.trinket).image, px - 54, by + 6, 40, 40);
    }
    if (p.charge > 0 && p.weapon !== 'tears') { // charge meter above the player
      const sp = worldToScreen(S.room.originX + p.x + 0.55, 1.4, S.room.originZ + p.z);
      const x = sp.x * this.dpr / this.scale, y = sp.y * this.dpr / this.scale;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y - 24, 7, 26);
      ctx.fillStyle = p.charge >= 1 ? '#ff4040' : '#e8dcc0'; ctx.fillRect(x + 1, y + 1 - 24 * p.charge, 5, 24 * p.charge);
    }
  }

  // ---- boss bar -----------------------------------------------------------------
  drawBossBar(ctx) {
    let hp = 0, max = 0;
    for (const e of S.enemies) if (e.isBoss && e.alive && !e.noBar) { hp += Math.max(0, e.hp); max += e.maxHp; }
    if (S.bossBarMax && hp > 0) max = Math.max(max, S.bossBarMax);
    if (max <= 0 || hp <= 0) return;
    const w = 300, h = 16, x = this.VW / 2 - w / 2, y = this.VH - 34;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 6); ctx.fill();
    ctx.fillStyle = '#3a0a0a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#c81e1e'; ctx.fillRect(x, y, w * (hp / max), h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w * (hp / max), h / 3);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, w, h);
    ctx.drawImage(roomIcon('boss').image, x - 26, y - 4, 22, 22);
  }

  // ---- banners -------------------------------------------------------------------
  drawBanners(ctx, dt) {
    const b = this.banners[0];
    if (b) {
      b.t += dt;
      const k = b.t / b.dur;
      const a = k < 0.1 ? k / 0.1 : k > 0.85 ? Math.max(0, (1 - k) / 0.15) : 1;
      ctx.globalAlpha = a;
      const y = 74 + (k < 0.1 ? -20 * (1 - k / 0.1) : 0);
      ctx.drawImage(parchment().image, this.VW / 2 - 230, y - 44, 460, 86);
      inkText(ctx, b.title, this.VW / 2, y + 2, 32, '#2a1a10', { align: 'center', outline: '#f1e6cc', lw: 4 });
      if (b.sub) inkText(ctx, b.sub, this.VW / 2, y + 28, 17, '#4a3a2a', { align: 'center', outline: '#f1e6cc', lw: 3 });
      ctx.globalAlpha = 1;
      if (k >= 1) this.banners.shift();
    }
    const f = this.floorB;
    if (f) {
      f.t += dt;
      const k = f.t / f.dur;
      const a = k < 0.15 ? k / 0.15 : k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1;
      ctx.globalAlpha = a;
      const y = this.VH * 0.36;
      ctx.drawImage(parchment().image, this.VW / 2 - 260, y - 50, 520, 100);
      inkText(ctx, f.name, this.VW / 2, y + 12, 44, '#2a1a10', { align: 'center', outline: '#f1e6cc', lw: 5 });
      if (f.curse) inkText(ctx, f.curse, this.VW / 2, y + 74, 26, '#c03a3a', { align: 'center', lw: 5 });
      ctx.globalAlpha = 1;
      if (k >= 1) this.floorB = null;
    }
  }
  drawRestartHold(ctx, t) {
    const k = Math.min(1, t / 1.0);
    inkText(ctx, 'restarting...', this.VW / 2, this.VH - 60, 22, '#f1e6cc', { align: 'center' });
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.VW / 2 - 80, this.VH - 50, 160, 10);
    ctx.fillStyle = '#c81e1e'; ctx.fillRect(this.VW / 2 - 80, this.VH - 50, 160 * k, 10);
  }

  // ---- boss intro card ------------------------------------------------------------
  drawBossIntro(ctx, dt) {
    const it = this.intro;
    it.t += dt;
    const W = this.VW, H = this.VH;
    const slide = Math.min(1, it.t / 0.25);
    const ease = 1 - Math.pow(1 - slide, 3);
    ctx.save();
    // left panel (Isaiah)
    ctx.fillStyle = '#1a1020';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.56 * ease, 0); ctx.lineTo(W * 0.44 * ease, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // right panel (boss)
    ctx.fillStyle = '#3a0a0a';
    ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W - W * 0.44 * ease, 0); ctx.lineTo(W - W * 0.56 * ease, H); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    // scribble texture
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 40; i++) { ctx.strokeStyle = i % 2 ? '#000' : '#fff'; ctx.lineWidth = 2; ctx.beginPath(); const yy = (i / 40) * H; ctx.moveTo(0, yy); ctx.lineTo(W, yy + 30); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const pp = portraitTex(S.player.charId).image;
    const ps = Math.min(H * 0.62, 320);
    ctx.drawImage(pp, W * 0.25 - ps / 2 - (1 - ease) * 300, H * 0.18, ps, ps);
    const info = BOSS_INFO[it.id];
    if (info && info.portrait) { const bp = info.portrait().image; ctx.drawImage(bp, W * 0.75 - ps / 2 + (1 - ease) * 300, H * 0.14, ps, ps); }
    inkText(ctx, S.player.charId === 'june' ? 'JUNE' : 'ISAIAH', W * 0.25, H * 0.86, 40, '#f1e6cc', { align: 'center', lw: 6 });
    inkText(ctx, (info ? info.name : it.id).toUpperCase(), W * 0.75, H * 0.86, 40, '#ffd0a0', { align: 'center', lw: 6 });
    const vs = 1 + Math.max(0, 0.6 - it.t) * 2;
    inkText(ctx, 'VS', W / 2, H * 0.55, 70 * vs, '#e8c040', { align: 'center', lw: 8, rot: -0.12 });
    ctx.restore();
  }
}

// ---- small cached HUD art ------------------------------------------------------------
function heartTexHud(kind) {
  if (kind === 'empty') return tex('hudheart:empty', 44, 40, (ctx, w, h) => { ctx.globalAlpha = 0.85; ctx.drawImage(heartTex('full').image, 0, 0); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(25,12,12,0.85)'; ctx.fillRect(0, 0, w, h); });
  if (kind === 'halfblack') return tex('hudheart:halfblack', 44, 40, (ctx, w, h) => { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w / 2, h); ctx.clip(); ctx.drawImage(heartTex('black').image, 0, 0); ctx.restore(); });
  return heartTex(kind);
}
function statIcon(k) {
  return tex('stat:' + k, 36, 36, (ctx, w, h, rng) => {
    const c = '#e8dcc0';
    if (k === 'speed') { poly(ctx, [[8, 24], [8, 12], [18, 12], [20, 20], [28, 22], [28, 26], [8, 26]], '#c86a3a', rng, { lw: 2.2, hatch: 0 }); }
    if (k === 'tears') { poly(ctx, [[18, 6], [26, 20], [18, 28], [10, 20]], '#8ac8f0', rng, { lw: 2.2, hatch: 0 }); }
    if (k === 'damage') { poly(ctx, [[18, 4], [22, 14], [32, 14], [24, 20], [28, 30], [18, 24], [8, 30], [12, 20], [4, 14], [14, 14]], '#e04040', rng, { lw: 2.2, hatch: 0 }); }
    if (k === 'range') { scribble(ctx, [[6, 26], [16, 10], [28, 26]], 3, c, rng); dot(ctx, 28, 26, 3, c); }
    if (k === 'shotspeed') { scribble(ctx, [[6, 18], [28, 18]], 3, c, rng); poly(ctx, [[24, 12], [32, 18], [24, 24]], c, rng, { lw: 2, hatch: 0 }); scribble(ctx, [[6, 12], [14, 12]], 2, c, rng); scribble(ctx, [[6, 24], [14, 24]], 2, c, rng); }
    if (k === 'luck') { for (const [x, y] of [[12, 12], [22, 12], [12, 22], [22, 22]]) blob(ctx, x, y, 6, 6, '#5ab84a', rng, { lw: 1.8, hatch: 0 }); }
  });
}
export function roomIcon(type) {
  return tex('roomicon:' + type, 32, 32, (ctx, w, h, rng) => {
    switch (type) {
      case 'boss': blob(ctx, 16, 14, 11, 10, '#e8e0d0', rng, { lw: 2.4, hatch: 0 }); dot(ctx, 12, 14, 3, INK); dot(ctx, 20, 14, 3, INK); poly(ctx, [[10, 22], [22, 22], [20, 28], [12, 28]], '#e8e0d0', rng, { lw: 2, hatch: 0 }); break;
      case 'treasure': poly(ctx, [[4, 24], [6, 10], [12, 18], [16, 6], [20, 18], [26, 10], [28, 24]], '#f0c040', rng, { lw: 2.4, hatch: 0 }); break;
      case 'shop': blob(ctx, 16, 16, 11, 11, '#d8a040', rng, { lw: 2.4, hatch: 0 }); inkText(ctx, '¢', 16, 22, 16, '#5a3a10', { align: 'center', lw: 0 }); break;
      case 'secret': inkText(ctx, '?', 16, 26, 26, '#c8c0b0', { align: 'center', lw: 4 }); break;
      case 'sacrifice': poly(ctx, [[6, 26], [10, 8], [14, 26], [18, 8], [22, 26], [26, 8], [28, 26]], '#b8b0a8', rng, { lw: 2, hatch: 0 }); break;
      case 'challenge': scribble(ctx, [[6, 6], [26, 26]], 4, '#c8c8d8', rng); scribble(ctx, [[26, 6], [6, 26]], 4, '#c8c8d8', rng); break;
      case 'arcade': poly(ctx, [[6, 6], [26, 6], [26, 26], [6, 26]], '#e8e0d0', rng, { lw: 2.4, hatch: 0 }); dot(ctx, 11, 11, 2.5, INK); dot(ctx, 21, 21, 2.5, INK); dot(ctx, 16, 16, 2.5, INK); break;
      case 'library': poly(ctx, [[6, 8], [26, 8], [26, 26], [6, 26]], '#8a4a8a', rng, { lw: 2.4, hatch: 0 }); scribble(ctx, [[16, 8], [16, 26]], 2, INK, rng); break;
      case 'bargain': poly(ctx, [[6, 10], [10, 2], [12, 12], [20, 12], [22, 2], [26, 10], [24, 26], [8, 26]], '#a02020', rng, { lw: 2.2, hatch: 0 }); break;
      case 'chapel': scribble(ctx, [[16, 4], [16, 28]], 4, '#fff0b0', rng); scribble(ctx, [[8, 12], [24, 12]], 4, '#fff0b0', rng); break;
      default: dot(ctx, 16, 16, 5, '#e8dcc0');
    }
  });
}
function parchment() {
  return tex('parchment', 460, 86, (ctx, w, h, rng) => {
    poly(ctx, [[10, 8], [w - 12, 4], [w - 4, h / 2], [w - 14, h - 6], [8, h - 4], [16, h / 2]], '#e8dcc0', rng, { lw: 3, hatch: 0.12, jit: 3 });
  });
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
