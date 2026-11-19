// Familiars: orbitals that block shots, followers that cry with you,
// a chaser, a laser finger, and temporary blue flies.
import { S } from '../state.js';
import { ITEMS } from '../items/items.js';
import { input, DIRS } from '../core/input.js';
import { makeSprite, freeSprite, place, makeShadow, freeFlat, placeFlat, setTex, gfx } from '../render/gfx.js';
import { tex, blob, poly, scribble, dot, eye, glow, shade, INK } from '../render/draw.js';
import { SHAPES } from '../render/art_items.js';
import { spawnTear, spawnLaser, nearestEnemy } from './tears.js';
import { audio } from '../core/audio.js';
import { particles } from './effects.js';

function famTex(kind, f = 0) {
  return tex(`fam:${kind}:${f}`, 48, 48, (ctx, w, h, rng) => {
    const C = 24;
    switch (kind) {
      case 'moth': ctx.scale(0.75, 0.75); SHAPES.moth(ctx, rng); break;
      case 'choirfly': case 'bluefly':
        for (const d of [-1, 1]) blob(ctx, C + d * 7, C - 6 + (f ? -3 : 1), 6, 4, '#dfe8f0', rng, { lw: 1.4 });
        blob(ctx, C, C, 7, 6, kind === 'bluefly' ? '#3a5ac8' : '#2a2224', rng, { lw: 2 });
        if (kind === 'choirfly') { ctx.strokeStyle = '#fff2a0'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(C, C - 10, 5, 1.6, 0, 0, 7); ctx.stroke(); }
        break;
      case 'lint': ctx.scale(0.75, 0.75); SHAPES.lint(ctx, rng); break;
      case 'doll': ctx.scale(0.75, 0.75); SHAPES.doll(ctx, rng); break;
      case 'puppet': ctx.scale(0.75, 0.75); SHAPES.puppet(ctx, rng); break;
      case 'bunny': ctx.scale(0.75, 0.75); SHAPES.bunny(ctx, rng); break;
      case 'finger': blob(ctx, C, C + 6, 6, 12, '#d8b8a0', rng, { lw: 2.2 }); blob(ctx, C, C - 6, 5, 4, '#f0e0d0', rng, { lw: 1.6 }); scribble(ctx, [[C - 5, C + 2], [C + 5, C + 2]], 1.4, INK, rng); glow(ctx, C, C - 8, 10, '#ff4040', f ? 0.6 : 0.2); break;
      default: blob(ctx, C, C, 10, 10, '#c8c8c8', rng);
    }
  });
}

const KINDS = {
  moth: { orbit: { r: 1.15, speed: 2.0 }, blocks: true, contact: 2, size: 0.55 },
  choirfly: { orbit: { r: 0.95, speed: 3.0 }, blocks: true, contact: 3, size: 0.4 },
  lint: { orbit: { r: 1.5, speed: -1.4 }, blocks: true, contact: 1.5, size: 0.5 },
  doll: { follow: true, shoot: { dmg: 3.5, rate: 0.55, style: 'round' }, size: 0.6 },
  puppet: { follow: true, shoot: { dmg: 5.5, rate: 0.9, style: 'tooth' }, size: 0.6 },
  bunny: { chase: 4.2, contact: 6, size: 0.55 },
  finger: { follow: true, laser: { dmg: 6, rate: 1.4 }, size: 0.5 },
  bluefly: { chase: 5.5, explode: 9, size: 0.38, temp: true },
};

class Familiar {
  constructor(kind, p, idx = 0) {
    this.kind = kind; this.k = KINDS[kind];
    this.x = p.x; this.z = p.z; this.idx = idx;
    this.r = this.k.size * 0.45;
    this.alive = true; this.t = Math.random() * 6; this.cd = 0.5;
    this.angle = idx * 2.1;
    this.blocksShots = !!this.k.blocks;
    this.spr = makeSprite(famTex(kind), this.k.size * 1.4, this.k.size * 1.4, S.view ? S.view.layer : gfx.layer);
    this.shadow = makeShadow(this.k.size, S.view ? S.view.layer : gfx.layer);
    this.spr.userData.keep = this.shadow.userData.keep = true;
    this.h = this.k.orbit || this.k.chase ? 0.45 : 0.15;
  }
  attach(layer, p) {
    for (const s of [this.spr, this.shadow]) { if (s.parent) s.parent.remove(s); layer.add(s); }
    this.x = p.x; this.z = p.z;
  }
  destroy() { freeSprite(this.spr); freeFlat(this.shadow); this.alive = false; }
  update(dt, p, list) {
    this.t += dt; this.cd -= dt;
    const k = this.k;
    if (k.orbit) {
      const same = list.filter((f) => f.kind === this.kind || (f.k.orbit && f.k.orbit.r === k.orbit.r));
      const i = same.indexOf(this), n = same.length;
      this.angle += dt * k.orbit.speed;
      const a = this.angle + (i / Math.max(1, n)) * Math.PI * 2;
      this.x = p.x + Math.cos(a) * k.orbit.r; this.z = p.z + Math.sin(a) * k.orbit.r * 0.85;
    } else if (k.follow) {
      const followers = list.filter((f) => f.k.follow);
      const i = followers.indexOf(this);
      const lead = i === 0 ? p : followers[i - 1];
      const dx = lead.x - this.x, dz = lead.z - this.z, d = Math.hypot(dx, dz);
      if (d > 0.7) { this.x += (dx / d) * (d - 0.7) * Math.min(1, dt * 8); this.z += (dz / d) * (d - 0.7) * Math.min(1, dt * 8); }
      const sd = input.shootDir;
      if (k.shoot && sd >= 0 && this.cd <= 0 && S.game.state === 'play') {
        this.cd = k.shoot.rate;
        const [vx, vz] = DIRS[sd];
        const t = spawnTear({ x: this.x, z: this.z, vx: vx * 8.5, vz: vz * 8.5, dmg: k.shoot.dmg, range: 6, scale: 0.8, owner: 'familiar', style: k.shoot.style, color: k.shoot.style === 'tooth' ? 0xe8dcc0 : 0xb4dcf6, flags: {} });
        t.owner = 'player';
      }
      if (k.laser && this.cd <= 0) {
        const e = nearestEnemy(this.x, this.z, 6);
        if (e) {
          this.cd = k.laser.rate;
          spawnLaser({ x: this.x, z: this.z, angle: Math.atan2(e.z - this.z, e.x - this.x), dmg: k.laser.dmg, duration: 0.12, tick: 1, width: 0.25, color: '#ff4040', length: Math.hypot(e.x - this.x, e.z - this.z) + 0.3, owner: 'player' });
          audio.play('enemyShot');
        }
      }
    } else if (k.chase) {
      const e = nearestEnemy(this.x, this.z, 30);
      const tx = e ? e.x : p.x + Math.cos(this.t) * 1.2, tz = e ? e.z : p.z + Math.sin(this.t) * 1.2;
      const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz) || 1;
      const sp = e ? k.chase : Math.min(k.chase, d * 3);
      this.x += (dx / d) * sp * dt; this.z += (dz / d) * sp * dt;
      if (k.explode && e && d < e.r + 0.25) {
        e.hurt(k.explode, { flags: {} });
        particles(this.x, this.z, { count: 6, color: 0x3a5ac8, kind: 'blob', speed: 2, up: 2, life: 0.4, size: 0.15 });
        this.destroy(); return;
      }
      if (k.temp && !e && this.t > 20) { this.destroy(); return; }
    }
    // contact damage
    if (k.contact && this.cd <= 0) {
      for (const e of S.enemies) {
        if (!e.alive || e.untargetable) continue;
        if ((e.x - this.x) ** 2 + (e.z - this.z) ** 2 < (e.r + this.r) ** 2) { e.hurt(k.contact, { flags: {} }); this.cd = 0.25; break; }
      }
    }
  }
  sync() {
    const f = Math.floor(this.t * 10) % 2;
    setTex(this.spr, famTex(this.kind, this.kind === 'finger' ? (this.cd > 1 ? 1 : 0) : f));
    place(this.spr, this.x, this.z, this.h + Math.sin(this.t * 4) * 0.04, 3);
    placeFlat(this.shadow, this.x, this.z);
  }
}

/** Make the set of item familiars match the player's items. */
export function syncFamiliars(p) {
  const want = [];
  for (const id of p.items) { const fams = ITEMS[id]?.familiars; if (fams) want.push(...fams); }
  const have = S.familiars.filter((f) => !f.k.temp);
  const counts = {};
  for (const k of want) counts[k] = (counts[k] || 0) + 1;
  for (const f of have) {
    if ((counts[f.kind] || 0) > 0) counts[f.kind]--;
    else { f.destroy(); }
  }
  for (const [k, n] of Object.entries(counts)) for (let i = 0; i < n; i++) S.familiars.push(new Familiar(k, p, i));
  for (let i = S.familiars.length - 1; i >= 0; i--) if (!S.familiars[i].alive) S.familiars.splice(i, 1);
}
export function spawnBlueFly(p) { S.familiars.push(new Familiar('bluefly', p, S.familiars.length)); }
export function updateFamiliars(dt) {
  const p = S.player;
  for (const f of S.familiars) if (f.alive) f.update(dt, p, S.familiars);
  for (let i = S.familiars.length - 1; i >= 0; i--) if (!S.familiars[i].alive) S.familiars.splice(i, 1);
}
