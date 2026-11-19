// Tears (player projectiles), enemy shots, and lasers.
import { CFG } from '../config.js';
import { S } from '../state.js';
import { makeSprite, freeSprite, place, makeShadow, freeFlat, placeFlat, COS_T, setTex } from '../render/gfx.js';
import { tearTex } from '../render/art_world.js';
import { tex, glow, rgba } from '../render/draw.js';
import { splat, particles } from './effects.js';
import { M_TEAR, M_SPECTRAL } from '../world/room.js';
import { runHook } from '../items/hooks.js';
import { audio } from '../core/audio.js';
import * as THREE from 'three';

export const TEAR_COLORS = {
  default: 0xb4dcf6, enemy: 0xd23a2a, poison: 0x7ad04a, burn: 0xff9a3a, slow: 0x9a9aa8, fear: 0x8a3aa0,
  charm: 0xff88cc, homing: 0xc87aff, blood: 0xc82020, holy: 0xfff2b0, bile: 0xd8c840, dark: 0x4a2a4a,
};

let tearId = 0;
export class Tear {
  /**
   * opts: x, z, vx, vz, dmg, range (tiles), owner ('player'|'enemy'|'familiar'),
   * scale, color, flags {}, height, lob (initial vertical speed), style
   */
  constructor(o) {
    this.id = ++tearId;
    this.x = o.x; this.z = o.z; this.vx = o.vx; this.vz = o.vz;
    this.owner = o.owner || 'player';
    this.dmg = o.dmg ?? 3.5;
    this.scale = o.scale ?? 1;
    this.flags = o.flags ? { ...o.flags } : {};
    this.color = o.color ?? (this.owner === 'enemy' ? TEAR_COLORS.enemy : TEAR_COLORS.default);
    const speed = Math.hypot(this.vx, this.vz) || 1;
    this.life = o.life ?? ((o.range ?? 6.5) / speed);
    this.h0 = o.height ?? CFG.STATS.tearHeight;
    this.h = this.h0;
    this.lob = o.lob || 0;      // lobbed shots arc with gravity instead
    this.vh = this.lob;
    this.age = 0;
    this.r = 0.13 * this.scale + (this.owner === 'enemy' ? 0.04 : 0);
    this.hit = new Set();
    this.alive = true;
    this.bounces = this.flags.bounce ? 2 : 0;
    this.style = o.style || (this.owner === 'enemy' ? 'blood' : 'round');
    this.knock = o.knock ?? CFG.STATS.knockback;
    this.source = o.source || null;  // enemy that fired (for death notes)
    this.noSplit = !!o.noSplit;
    this.spr = makeSprite(tearTex(this.style), 0.5 * this.scale, 0.5 * this.scale);
    this.spr.center.set(0.5, 0.5);
    this.spr.material.color.set(this.color);
    this.shadow = makeShadow(0.38 * this.scale);
    this.wigglePhase = Math.random() * 6;
    this.sync();
  }
  sync() {
    place(this.spr, this.x, this.z, this.h + 0.12 * this.scale, 10);
    placeFlat(this.shadow, this.x, this.z);
  }
  destroy() {
    if (this.spr) freeSprite(this.spr);
    if (this.shadow) freeFlat(this.shadow);
    this.spr = this.shadow = null;
    this.alive = false;
  }
  /** pop: visual splat; floor: landed on the floor */
  pop(floor = false) {
    if (!this.alive) return;
    splat(this.x, this.z, floor ? 0.05 : this.h, this.color, this.scale);
    if (this.owner === 'player') audio.play('splat');
    if (this.flags.explosive && S.game) S.game.explode(this.x, this.z, { radius: 1.2, damage: this.dmg * 1.5 + 10, hurtsPlayer: false, small: true });
    if (this.flags.creepTrail && S.game) S.game.playerCreep(this.x, this.z);
    this.destroy();
  }

  update(dt) {
    const p = S.player;
    this.age += dt;
    // homing steers toward the nearest enemy
    if (this.flags.homing && this.owner !== 'enemy') {
      const t = nearestEnemy(this.x, this.z, 5.5, this.hit);
      if (t) {
        const sp = Math.hypot(this.vx, this.vz);
        const dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz) || 1;
        const k = Math.min(1, dt * 7);
        this.vx += ((dx / d) * sp - this.vx) * k;
        this.vz += ((dz / d) * sp - this.vz) * k;
        const ns = Math.hypot(this.vx, this.vz) || 1;
        this.vx *= sp / ns; this.vz *= sp / ns;
      }
    }
    if (this.homingPlayer && p) { // enemy homing shots
      const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz) || 1, sp = Math.hypot(this.vx, this.vz);
      const k = Math.min(1, dt * this.homingPlayer);
      this.vx += ((dx / d) * sp - this.vx) * k; this.vz += ((dz / d) * sp - this.vz) * k;
    }
    let vx = this.vx, vz = this.vz;
    if (this.flags.wiggle) {
      const w = Math.cos(this.age * 16 + this.wigglePhase) * 0.9;
      const sp = Math.hypot(vx, vz) || 1;
      vx += (-this.vz / sp) * w * sp * 0.6; vz += (this.vx / sp) * w * sp * 0.6;
    }
    if (this.curve) { // slowly rotate velocity (spiral patterns)
      const c = Math.cos(this.curve * dt), s = Math.sin(this.curve * dt);
      const nx = this.vx * c - this.vz * s; this.vz = this.vx * s + this.vz * c; this.vx = nx;
    }
    if (this.accel) { const k = 1 + this.accel * dt; this.vx *= k; this.vz *= k; }
    this.x += vx * dt; this.z += vz * dt;
    if (this.owner === 'player' && p) runHook(p, 'onTearUpdate', this, p, dt);

    // height: straight flight then an arc to the floor at the end of range
    if (this.lob) {
      this.vh -= 18 * dt; this.h += this.vh * dt;
      if (this.h <= 0) { this.h = 0; this.landLob(); return; }
    } else {
      const fall = Math.min(this.life * 0.5, CFG.STATS.tearFallTime * (this.owner === 'enemy' ? 1.6 : 1));
      const rem = this.life - this.age;
      if (rem < fall) { const k = 1 - rem / fall; this.h = this.h0 * (1 - k * k); }
      if (this.age >= this.life) { this.pop(true); return; }
    }

    // obstacles & walls
    const room = S.room;
    const mask = this.flags.spectral ? M_SPECTRAL : M_TEAR;
    const outside = this.x < 0 || this.z < 0 || this.x > room.W || this.z > room.H;
    if (outside || (!this.lob && room.blocksAt(this.x, this.z, mask))) {
      if (!outside && S.game) S.game.tearHitTile(this, Math.floor(this.x), Math.floor(this.z));
      if (this.bounces > 0 && this.alive) {
        this.bounces--;
        // reflect along the axis we came in from
        const px = this.x - vx * dt, pz = this.z - vz * dt;
        const blockX = outside ? (this.x < 0 || this.x > room.W) : room.blocksAt(this.x, pz, mask);
        const blockZ = outside ? (this.z < 0 || this.z > room.H) : room.blocksAt(px, this.z, mask);
        if (blockX || !blockZ) this.vx = -this.vx;
        if (blockZ) this.vz = -this.vz;
        this.x = px; this.z = pz;
      } else { this.pop(); return; }
    }

    // hits
    if (this.owner === 'enemy') {
      if (p && !p.dead && this.h < 1.2) {
        // familiars that block shots
        for (const f of S.familiars) {
          if (f.blocksShots && f.alive && (f.x - this.x) ** 2 + (f.z - this.z) ** 2 < (f.r + this.r) ** 2) { f.onBlock && f.onBlock(this); this.pop(); return; }
        }
        const rr = p.r * 0.75 + this.r;
        if ((p.x - this.x) ** 2 + (p.z - this.z) ** 2 < rr * rr) {
          p.hurt(S.game.dmgAmount(this.source && this.source.isBoss), this.source || 'a tear');
          this.pop();
          return;
        }
      }
    } else {
      for (const e of S.enemies) {
        if (!e.alive || e.untargetable || this.hit.has(e.uid)) continue;
        if (e.flying === false && this.h < -1) continue;
        const rr = e.r + this.r;
        if ((e.x - this.x) ** 2 + (e.z - this.z) ** 2 < rr * rr) {
          this.hitEnemy(e);
          if (!this.alive) return;
        }
      }
    }
    this.sync();
  }

  hitEnemy(e) {
    this.hit.add(e.uid);
    const sp = Math.hypot(this.vx, this.vz) || 1;
    e.hurt(this.dmg, { tear: this, kx: (this.vx / sp) * this.knock, kz: (this.vz / sp) * this.knock, flags: this.flags });
    if (this.owner === 'player' && S.player) runHook(S.player, 'onTearHit', this, e, S.player);
    if (this.flags.split && !this.noSplit) {
      const n = 2 + Math.min(2, this.flags.split - 1);
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(this.vz, this.vx) + Math.PI / 2 + (i / n) * Math.PI * 2;
        spawnTear({ x: this.x, z: this.z, vx: Math.cos(a) * sp * 0.8, vz: Math.sin(a) * sp * 0.8, dmg: this.dmg * 0.5, range: 3, scale: this.scale * 0.6, color: this.color, flags: { ...this.flags, split: 0 }, owner: this.owner, noSplit: true, height: this.h });
        S.tears[S.tears.length - 1].hit.add(e.uid);
      }
    }
    if (!this.flags.piercing) this.pop();
  }

  landLob() {
    // lobbed shots: burst into a small ring or creep when they land
    if (this.onLand) this.onLand(this);
    this.pop(true);
  }
}

export function nearestEnemy(x, z, maxDist = 99, exclude = null) {
  let best = null, bd = maxDist * maxDist;
  for (const e of S.enemies) {
    if (!e.alive || e.untargetable || e.friendly || (exclude && exclude.has(e.uid))) continue;
    const d = (e.x - x) ** 2 + (e.z - z) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function spawnTear(o) {
  const t = new Tear(o);
  if (t.owner === 'enemy') S.shots.push(t); else S.tears.push(t);
  return t;
}

/** Enemy shot helper: angle in radians or (dx,dz). */
export function enemyShot(src, angle, opts = {}) {
  const speed = opts.speed ?? CFG.ENEMY_SHOT_SPEED;
  if (S.shots.length > 220) return null;
  return spawnTear({
    x: opts.x ?? src.x, z: opts.z ?? src.z, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed,
    range: opts.range ?? CFG.ENEMY_SHOT_RANGE, owner: 'enemy', scale: opts.scale ?? 1, color: opts.color ?? TEAR_COLORS.enemy,
    height: opts.height ?? 0.5, lob: opts.lob, source: src, life: opts.life, style: opts.style,
  });
}
export function angleTo(a, b) { return Math.atan2(b.z - a.z, b.x - a.x); }

// ---- lasers ------------------------------------------------------------------
function beamTex(color) {
  return tex('beam:' + color, 64, 32, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.25, rgba(color, 0.85)); g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.75, rgba(color, 0.85)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(40,0,0,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, h * 0.2); ctx.lineTo(w, h * 0.2); ctx.moveTo(0, h * 0.8); ctx.lineTo(w, h * 0.8); ctx.stroke();
  });
}

/**
 * A beam from (x,z) along angle. Follows `follow` (entity) if given.
 * opts: owner, dmg, duration, width, tick, color, length (default: until wall)
 */
export class Laser {
  constructor(o) {
    Object.assign(this, { owner: 'player', dmg: 3.5, duration: 0.4, width: 0.75, tick: 1 / 15, color: '#d82020', flags: {}, follow: null, angle: 0, offset: 0 });
    Object.assign(this, o);
    this.t = 0; this.acc = this.tick; this.alive = true;
    this.spr = makeSprite(beamTex(this.color), 1, this.width);
    this.spr.center.set(0, 0.5);
    this.spr.material.blending = THREE.NormalBlending;
    this.update(0);
  }
  computeLength() {
    if (this.length) return this.length;
    const room = S.room;
    const dx = Math.cos(this.angle), dz = Math.sin(this.angle);
    let L = 0;
    while (L < 40) {
      L += 0.25;
      const x = this.x + dx * L, z = this.z + dz * L;
      if (x < 0 || z < 0 || x > room.W || z > room.H) break;
      if (this.blockedByRocks && room.blocksAt(x, z, M_TEAR)) break;
    }
    return L;
  }
  update(dt) {
    this.t += dt;
    if (this.follow) { this.x = this.follow.x + Math.cos(this.angle) * this.offset; this.z = this.follow.z + Math.sin(this.angle) * this.offset; }
    const L = this.computeLength();
    const dx = Math.cos(this.angle), dz = Math.sin(this.angle);
    // screen-space: vertical components shrink by cos(tilt)
    const sx = dx, sz = dz * COS_T;
    this.spr.material.rotation = -Math.atan2(sz, sx);
    this.spr.scale.set(L * Math.hypot(sx, sz), this.width * (1 + Math.sin(this.t * 60) * 0.08) * (this.t > this.duration - 0.1 ? Math.max(0.1, (this.duration - this.t) / 0.1) : 1), 1);
    place(this.spr, this.x, this.z, 0.45, 60);
    this.spr.renderOrder = 1000 + Math.round(Math.max(this.z, this.z + dz * L) * 24) + 5;
    this.acc += dt;
    if (this.acc >= this.tick && this.t < this.duration) {
      this.acc -= this.tick;
      this.damageAlong(L, dx, dz);
    }
    if (this.t >= this.duration) this.destroy();
  }
  damageAlong(L, dx, dz) {
    const w = this.width * 0.5;
    const hitTest = (ex, ez, er) => {
      const rx = ex - this.x, rz = ez - this.z;
      const along = rx * dx + rz * dz;
      if (along < -er || along > L + er) return false;
      const perp = Math.abs(rx * -dz + rz * dx);
      return perp < w + er;
    };
    if (this.owner === 'enemy') {
      const p = S.player;
      if (p && !p.dead && hitTest(p.x, p.z, p.r * 0.7)) p.hurt(S.game.dmgAmount(true), this.source || 'a beam');
      return;
    }
    for (const e of S.enemies) {
      if (!e.alive || e.untargetable) continue;
      if (hitTest(e.x, e.z, e.r)) {
        e.hurt(this.dmg, { kx: dx * 0.6, kz: dz * 0.6, flags: this.flags, laser: true });
        if (S.player) runHook(S.player, 'onTearHit', { x: e.x, z: e.z, dmg: this.dmg, flags: this.flags, laser: true }, e, S.player);
      }
    }
    // lasers burn through muck and fireplaces
    if (S.game) for (let l = 0.5; l < L; l += 0.5) S.game.laserHitTile(Math.floor(this.x + dx * l), Math.floor(this.z + dz * l));
  }
  destroy() { if (this.spr) freeSprite(this.spr); this.spr = null; this.alive = false; }
}
export function spawnLaser(o) { const l = new Laser(o); S.lasers.push(l); return l; }
