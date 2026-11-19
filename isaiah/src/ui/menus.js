// DOM menus (title, character select, options, pause, death note, win) and the
// UI object the Game talks to. The HUD canvas handles in-game overlays.
import { S } from '../state.js';
import { CFG } from '../config.js';
import { save } from '../core/save.js';
import { audio } from '../core/audio.js';
import { input } from '../core/input.js';
import { randomSeedString, normalizeSeed } from '../core/rng.js';
import { makeCanvas, inkText, blob, poly, scribble, dot, eye, glow, rgba, shade, INK, FONT, wobEllipse, crayonFill, ink } from '../render/draw.js';
import { RNG } from '../core/rng.js';
import { portraitTex, CHARACTERS } from '../render/art_player.js';
import { itemIconTex } from '../render/art_items.js';
import { ITEMS } from '../items/items.js';
import { gfx } from '../render/gfx.js';
import { playPanels } from './panels.js';

export class UI {
  constructor(hud, root) {
    this.hud = hud;
    this.root = root;
    this.charId = 'isaiah';
    this.screen = null;
    this.focusIdx = 0;
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  // ---- game-facing API -------------------------------------------------------------
  floorBanner(n, c) { this.hud.floorBanner(n, c); }
  itemBanner(t, s) { this.hud.itemBanner(t, s); }
  fade(d) { this.hud.fade(d); }
  toggleMap() { this.hud.toggleMap(); }
  showBossIntro(id) { this.hud.showBossIntro(id); }
  hideBossIntro() { this.hud.hideBossIntro(); }
  restartRun() { this.startRun(randomSeedString(), this.charId); }

  // ---- screens -------------------------------------------------------------------
  clear() { this.root.innerHTML = ''; this.root.className = ''; this.screen = null; this.buttons = []; }
  panel(cls) {
    this.clear();
    const d = document.createElement('div');
    d.className = 'menu ' + cls;
    this.root.appendChild(d);
    this.root.className = 'active';
    return d;
  }
  button(parent, label, fn, extra = '') {
    const b = document.createElement('button');
    b.className = 'btn ' + extra;
    b.textContent = label;
    b.addEventListener('click', () => { audio.unlock(); audio.play('select'); fn(); });
    b.addEventListener('mouseenter', () => { this.focusIdx = this.buttons.indexOf(b); this.updateFocus(); });
    parent.appendChild(b);
    this.buttons.push(b);
    return b;
  }
  updateFocus() { this.buttons.forEach((b, i) => b.classList.toggle('focus', i === this.focusIdx)); }
  onKey(e) {
    if (!this.screen || !this.buttons.length) return;
    if (e.target instanceof HTMLInputElement && e.code !== 'Enter' && e.code !== 'Escape' && e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { this.focusIdx = (this.focusIdx + 1) % this.buttons.length; this.updateFocus(); audio.play('select'); e.preventDefault(); }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { this.focusIdx = (this.focusIdx - 1 + this.buttons.length) % this.buttons.length; this.updateFocus(); audio.play('select'); e.preventDefault(); }
    if (e.code === 'Enter' || (e.code === 'Space' && !(e.target instanceof HTMLInputElement))) { e.preventDefault(); this.buttons[this.focusIdx]?.click(); }
    if ((e.code === 'Escape' || e.code === 'KeyP') && this.onBack) { e.preventDefault(); this.onBack(); }
  }

  showTitle() {
    S.game.state = 'title';
    const d = this.panel('title');
    this.screen = 'title';
    this.onBack = null;
    const art = titleArt();
    art.className = 'title-art';
    d.appendChild(art);
    const col = document.createElement('div'); col.className = 'col';
    d.appendChild(col);
    this.button(col, 'New Run', () => this.showCharSelect());
    this.button(col, 'Options', () => this.showOptions(() => this.showTitle()));
    this.button(col, 'Watch the Beginning', () => this.playIntro(() => this.showTitle()));
    const b = save.data.best;
    const info = document.createElement('div'); info.className = 'small';
    info.textContent = `runs ${b.runs} · deepest floor ${b.floor} · wins ${b.wins}`;
    d.appendChild(info);
    const help = document.createElement('div'); help.className = 'small dim';
    help.textContent = 'WASD move · Arrows cry · E bomb · Q card/pill · Space item · Tab map · Esc pause · hold R restart';
    d.appendChild(help);
    this.focusIdx = 0; this.updateFocus();
  }

  showCharSelect() {
    const d = this.panel('chars');
    this.screen = 'chars';
    this.onBack = () => this.showTitle();
    const h = document.createElement('h2'); h.textContent = 'Who goes down?'; d.appendChild(h);
    const row = document.createElement('div'); row.className = 'row';
    d.appendChild(row);
    const chars = [['isaiah', true], ['june', save.data.unlocks.june]];
    const cards = [];
    for (const [id, unlocked] of chars) {
      const c = document.createElement('div');
      c.className = 'charcard' + (unlocked ? '' : ' locked') + (id === this.charId ? ' sel' : '');
      const img = portraitTex(id).image;
      const cv = makeCanvas(160, 160); cv.getContext('2d').drawImage(img, 0, 0, 160, 160);
      if (!unlocked) { const x = cv.getContext('2d'); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(10,6,6,0.92)'; x.fillRect(0, 0, 160, 160); }
      c.appendChild(cv);
      const n = document.createElement('div'); n.className = 'cname'; n.textContent = unlocked ? CHARACTERS[id].name : '???';
      c.appendChild(n);
      const desc = document.createElement('div'); desc.className = 'small';
      desc.textContent = !unlocked ? 'beat The Housemother' : id === 'isaiah' ? '3 hearts · steady' : '2 hearts + 2 soul · hits harder · starts with a candle';
      c.appendChild(desc);
      if (unlocked) c.addEventListener('click', () => { this.charId = id; cards.forEach((x) => x.classList.remove('sel')); c.classList.add('sel'); audio.play('select'); });
      row.appendChild(c); cards.push(c);
    }
    const seedRow = document.createElement('div'); seedRow.className = 'seedrow';
    const lab = document.createElement('label'); lab.textContent = 'Seed';
    const inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'random'; inp.maxLength = 9; inp.spellcheck = false;
    inp.addEventListener('keydown', (e) => { if (e.code === 'Enter') { e.preventDefault(); go(); } });
    seedRow.append(lab, inp);
    d.appendChild(seedRow);
    const go = () => {
      const seed = inp.value.trim() ? normalizeSeed(inp.value) : randomSeedString();
      if (!save.data.seenIntro && save.data.settings.showIntro) {
        save.data.seenIntro = true; save.write();
        this.playIntro(() => this.startRun(seed, this.charId));
      } else this.startRun(seed, this.charId);
    };
    const col = document.createElement('div'); col.className = 'col';
    d.appendChild(col);
    this.button(col, 'Go Down', go);
    this.button(col, 'Back', () => this.showTitle());
    // left/right switches character
    this.onCharKey = (e) => {
      if (this.screen !== 'chars') return;
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        const list = chars.filter((c) => c[1]).map((c) => c[0]);
        const i = (list.indexOf(this.charId) + (e.code === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
        this.charId = list[i];
        cards.forEach((x, k) => x.classList.toggle('sel', chars[k][0] === this.charId));
      }
    };
    window.removeEventListener('keydown', this._ck);
    this._ck = (e) => this.onCharKey(e);
    window.addEventListener('keydown', this._ck);
    this.focusIdx = 0; this.updateFocus();
  }

  startRun(seed, charId) {
    this.clear();
    audio.unlock();
    applySettings();
    S.game.newRun({ seed, charId });
  }

  showOptions(back) {
    const d = this.panel('options');
    this.screen = 'options';
    this.onBack = back;
    const h = document.createElement('h2'); h.textContent = 'Options'; d.appendChild(h);
    const st = save.data.settings;
    const slider = (label, key) => {
      const row = document.createElement('div'); row.className = 'optrow';
      const l = document.createElement('label'); l.textContent = label;
      const r = document.createElement('input'); r.type = 'range'; r.min = 0; r.max = 100; r.value = Math.round(st[key] * 100);
      r.addEventListener('input', () => { st[key] = r.value / 100; applySettings(); save.write(); });
      row.append(l, r); d.appendChild(row);
    };
    slider('Master volume', 'master');
    slider('Sound effects', 'sfx');
    slider('Ambient drone', 'music');
    slider('Screen shake', 'shake');
    const col = document.createElement('div'); col.className = 'col';
    d.appendChild(col);
    const muteB = this.button(col, st.mute ? 'Sound: OFF' : 'Sound: ON', () => { st.mute = !st.mute; muteB.textContent = st.mute ? 'Sound: OFF' : 'Sound: ON'; applySettings(); save.write(); });
    const introB = this.button(col, st.showIntro ? 'Intro panels: ON' : 'Intro panels: OFF', () => { st.showIntro = !st.showIntro; introB.textContent = st.showIntro ? 'Intro panels: ON' : 'Intro panels: OFF'; save.write(); });
    this.button(col, 'Fullscreen', () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); });
    this.button(col, 'Back', back);
    this.focusIdx = 0; this.updateFocus();
  }

  showPause() {
    const d = this.panel('pause');
    this.screen = 'pause';
    const resume = () => { this.clear(); S.game.resume(); };
    this.onBack = resume;
    const h = document.createElement('h2'); h.textContent = 'Paused'; d.appendChild(h);
    const seed = document.createElement('div'); seed.className = 'seed'; seed.textContent = 'Seed: ' + S.run.seed; d.appendChild(seed);
    const fl = document.createElement('div'); fl.className = 'small'; fl.textContent = CFG.FLOOR_NAMES[S.floorNum - 1] + (S.run.curse ? ' — ' + S.run.curse : ''); d.appendChild(fl);
    d.appendChild(itemGrid(S.player));
    const col = document.createElement('div'); col.className = 'col';
    d.appendChild(col);
    this.button(col, 'Resume', resume);
    this.button(col, 'Options', () => this.showOptions(() => this.showPause()));
    this.button(col, 'Quit to Title', () => { S.game.cleanupRun(); audio.stopDrone(); this.showTitle(); });
    this.focusIdx = 0; this.updateFocus();
  }

  showDeath() {
    const d = this.panel('death');
    this.screen = 'death';
    this.onBack = null;
    d.appendChild(deathNote());
    const col = document.createElement('div'); col.className = 'col row2';
    d.appendChild(col);
    this.button(col, 'Try Again', () => this.startRun(randomSeedString(), this.charId));
    this.button(col, 'Same Seed', () => this.startRun(S.run.seed, this.charId));
    this.button(col, 'Title', () => { S.game.cleanupRun(); this.showTitle(); });
    this.focusIdx = 0; this.updateFocus();
  }

  showWin(firstWin) {
    playPanels('ending', () => {
      const d = this.panel('win');
      this.screen = 'win';
      this.onBack = null;
      const h = document.createElement('h2'); h.textContent = 'Isaiah came back up.'; d.appendChild(h);
      const t = document.createElement('div'); t.className = 'small';
      t.textContent = `Seed ${S.run.seed} · ${formatTime(S.run.time)} · ${S.player.items.length} items`;
      d.appendChild(t);
      if (firstWin) { const u = document.createElement('div'); u.className = 'unlock'; u.textContent = 'Unlocked: June — a new character waits at the top of the stairs.'; d.appendChild(u); }
      d.appendChild(itemGrid(S.player));
      const col = document.createElement('div'); col.className = 'col';
      d.appendChild(col);
      this.button(col, 'Title', () => { S.game.cleanupRun(); this.showTitle(); });
      this.focusIdx = 0; this.updateFocus();
    });
  }

  playIntro(done) {
    this.clear();
    playPanels('intro', done);
  }
}

export function applySettings() {
  const st = save.data.settings;
  audio.setVolumes({ master: st.master, sfx: st.sfx, music: st.music, mute: st.mute });
  gfx.shakeScale = st.shake;
}

function formatTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; }

function itemGrid(p) {
  const g = document.createElement('div'); g.className = 'items';
  const ids = [...p.items];
  if (p.active) ids.unshift(p.active.id);
  if (!ids.length) { const n = document.createElement('div'); n.className = 'small dim'; n.textContent = 'no items yet'; g.appendChild(n); }
  for (const id of ids) {
    const def = ITEMS[id];
    const w = document.createElement('div'); w.className = 'item';
    const c = makeCanvas(48, 48); c.getContext('2d').drawImage(itemIconTex(id).image, 0, 0, 48, 48);
    w.appendChild(c);
    w.title = def ? `${def.name} — ${def.tagline}` : id;
    const tip = document.createElement('span'); tip.className = 'tip'; tip.textContent = def ? `${def.name}: ${def.tagline}` : id;
    w.appendChild(tip);
    g.appendChild(w);
  }
  return g;
}

// ---- drawn art -----------------------------------------------------------------------
function titleArt() {
  const c = makeCanvas(760, 300);
  const ctx = c.getContext('2d');
  const rng = new RNG('title');
  // crawlspace hole
  ctx.fillStyle = '#0a0606';
  wobEllipse(ctx, 380, 236, 200, 46, rng, 0.08); ctx.fill();
  glow(ctx, 380, 236, 170, '#4a1010', 0.4);
  // floorboards
  for (let i = 0; i < 9; i++) poly(ctx, [[i * 90 - 10, 182], [i * 90 + 78, 180], [i * 90 + 82, 196], [i * 90 - 6, 198]], '#5a4030', rng, { lw: 2.4, hatch: 0.3 });
  // little Isaiah peeking from the hole
  const head = portraitTex('isaiah').image;
  ctx.drawImage(head, 330, 150, 100, 100);
  ctx.fillStyle = '#0a0606'; wobEllipse(ctx, 380, 252, 120, 24, rng, 0.05); ctx.fill();
  inkText(ctx, 'The Finding of', 380, 66, 44, '#e8dcc0', { align: 'center', lw: 8, rot: -0.02 });
  inkText(ctx, 'ISAIAH', 380, 142, 92, '#c8281e', { align: 'center', lw: 10, rot: 0.015 });
  for (let i = 0; i < 6; i++) { const x = 250 + i * 50; ctx.fillStyle = 'rgba(160,20,20,0.85)'; ctx.beginPath(); ctx.ellipse(x + rng.range(-5, 5), 150 + rng.range(0, 14), 3, 6 + rng.range(0, 6), 0, 0, 7); ctx.fill(); }
  return c;
}

function deathNote() {
  const c = makeCanvas(520, 420);
  const ctx = c.getContext('2d');
  const rng = new RNG('note' + S.run.seed);
  poly(ctx, [[20, 16], [500, 10], [506, 400], [14, 408]], '#ece2c8', rng, { lw: 3, hatch: 0.1, jit: 4 });
  for (let y = 70; y < 390; y += 26) scribble(ctx, [[40, y], [480, y + rng.range(-2, 2)]], 1, 'rgba(90,120,170,0.35)', rng, 1);
  const name = S.player.charId === 'june' ? 'June' : 'Isaiah';
  inkText(ctx, 'My Last Will', 260, 56, 36, '#2a1a10', { align: 'center', lw: 0 });
  inkText(ctx, `I, ${name}, was done in by`, 44, 98, 21, '#2a1a10', { lw: 0 });
  inkText(ctx, String(S.run.killedBy || 'something'), 70, 128, 26, '#8a1a1a', { lw: 0 });
  inkText(ctx, `down in ${CFG.FLOOR_NAMES[S.floorNum - 1]}.`, 44, 158, 21, '#2a1a10', { lw: 0 });
  inkText(ctx, 'I leave behind:', 44, 196, 21, '#2a1a10', { lw: 0 });
  const ids = [...S.player.items]; if (S.player.active) ids.unshift(S.player.active.id);
  ids.slice(0, 24).forEach((id, i) => ctx.drawImage(itemIconTex(id).image, 52 + (i % 12) * 36, 206 + Math.floor(i / 12) * 38, 34, 34));
  if (!ids.length) inkText(ctx, '...nothing much. some tears.', 70, 232, 20, '#5a4a3a', { lw: 0 });
  inkText(ctx, `${S.player.coins}¢   ${S.run.kills} monsters   ${formatTime(S.run.time)}`, 44, 310, 19, '#4a3a2a', { lw: 0 });
  inkText(ctx, `seed  ${S.run.seed}`, 44, 344, 22, '#2a1a10', { lw: 0 });
  // signature: a teary scribble
  scribble(ctx, [[330, 372], [350, 360], [366, 378], [384, 358], [400, 376], [430, 364]], 2.5, '#2a1a10', rng, 2);
  ctx.fillStyle = 'rgba(120,170,220,0.35)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(rng.range(60, 460), rng.range(60, 380), rng.range(8, 18), 0, 7); ctx.fill(); }
  c.className = 'note';
  return c;
}
