// Placed bombs: fuse, kickable, and item modifiers (big, remote, sticky, homing, poison, scatter).
import { CFG } from '../config.js';
import { S } from '../state.js';
import { audio } from '../core/audio.js';
import { makeSprite, freeSprite, place, makeShadow, freeFlat, placeFlat, setTex } from '../render/gfx.js';
import { bombTex } from '../render/art_pickups.js';
import { flashTex } from '../render/draw.js';
import { M_WALK } from '../world/room.js';
import { nearestEnemy } from './tears.js';

export class Bomb {
  constructor(x, z, flags = {}, owner = 'player') {
    this.x = x; this.z = z; this.vx = 0; this.vz = 0;
    this.flags = flags;
    this.owner = owner;
    this.r = flags.big ? 0.36 : 0.28;
    this.fuse = flags.remote && owner === 'player' ? 999 : CFG.BOMB.fuse;
    this.t = 0;
    this.alive = true;
    this.stuckTo = null;
    const key = Object.keys(flags).filter((k) => flags[k]).sort().join(',');
    this.key = key;
    this.spr = makeSprite(bombTex('single', 1, key), flags.big ? 0.95 : 0.75, flags.big ? 0.95 : 0.75);
    this.shadow = makeShadow(0.6);
    this.sync();
  }
  update(dt) {
    this.t += dt;
    this.fuse -= dt;
    if (Math.floor(this.t * 10) !== Math.floor((this.t - dt) * 10) && this.t % 0.5 < dt) audio.play('fuse');
    if (this.stuckTo) {
      if (!this.stuckTo.alive) this.stuckTo = null;
      else { this.x = this.stuckTo.x + this.stuckOff[0]; this.z = this.stuckTo.z + this.stuckOff[1]; }
    } else {
      if (this.flags.homing) {
        const e = nearestEnemy(this.x, this.z, 6);
        if (e) { const dx = e.x - this.x, dz = e.z - this.z, d = Math.hypot(dx, dz) || 1; this.vx += (dx / d) * 6 * dt; this.vz += (dz / d) * 6 * dt; }
      }
      // kicked by the player
      const p = S.player;
      if (p && !p.dead) {
        const dx = this.x - p.x, dz = this.z - p.z, d = Math.hypot(dx, dz), rr = this.r + p.r;
        if (d < rr && d > 1e-4) {
          const push = rr - d;
          this.x += (dx / d) * push; this.z += (dz / d) * push;
          const sp = Math.hypot(p.vx, p.vz);
          if (sp > 1) { this.vx = (dx / d) * Math.max(sp, CFG.BOMB.kickSpeed) * 0.9; this.vz = (dz / d) * Math.max(sp, CFG.BOMB.kickSpeed) * 0.9; }
        }
      }
      if (this.flags.sticky) {
        for (const e of S.enemies) if (e.alive && !e.untargetable && (e.x - this.x) ** 2 + (e.z - this.z) ** 2 < (e.r + this.r) ** 2) { this.stuckTo = e; this.stuckOff = [this.x - e.x, this.z - e.z]; break; }
      }
      const fr = Math.exp(-CFG.BOMB.friction * dt);
      this.vx *= fr; this.vz *= fr;
      this.x += this.vx * dt; this.z += this.vz * dt;
      if (S.room.collide(this, M_WALK, true)) { this.vx *= -0.5; this.vz *= -0.5; }
    }
    if (this.fuse <= 0) this.explode();
  }
  explode() {
    if (!this.alive) return;
    const big = this.flags.big;
    S.game.explode(this.x, this.z, {
      radius: CFG.BOMB.radius * (big ? CFG.BOMB.bigRadiusMult : 1),
      damage: CFG.BOMB.damage * (big ? 1.5 : 1) + (this.owner === 'player' && S.player ? S.player.stats.damage * 2 : 0),
      hurtsPlayer: true, bomb: this,
    });
    if (this.flags.scatter) for (let i = 0; i < 3; i++) {
      const a = Math.random() * 6.28;
      const b = spawnBomb(this.x + Math.cos(a) * 0.4, this.z + Math.sin(a) * 0.4, { small: true }, this.owner);
      b.vx = Math.cos(a) * 4; b.vz = Math.sin(a) * 4; b.fuse = 0.9; b.spr.scale.set(0.45, 0.45, 1); b.mini = true;
    }
    if (this.flags.poison) for (let i = 0; i < 6; i++) S.game.poisonCloud && S.game.poisonCloud(this.x, this.z);
    this.destroy();
  }
  sync() {
    const blink = this.fuse < 0.6 ? Math.floor(this.fuse * 16) % 2 === 0 : Math.floor(this.t * 4) % 2 === 0;
    const base = bombTex('single', 1, this.key);
    setTex(this.spr, blink ? flashTex(base) : base);
    const pulse = 1 + (this.fuse < 1 ? Math.sin(this.t * 30) * 0.06 : 0);
    const s = (this.mini ? 0.45 : this.flags.big ? 0.95 : 0.75) * pulse;
    this.spr.scale.set(s, s, 1);
    place(this.spr, this.x, this.z + 0.12, 0, 0);
    placeFlat(this.shadow, this.x, this.z);
  }
  destroy() { if (this.spr) freeSprite(this.spr); if (this.shadow) freeFlat(this.shadow); this.spr = this.shadow = null; this.alive = false; }
}

export function spawnBomb(x, z, flags = {}, owner = 'player') {
  const b = new Bomb(x, z, flags, owner);
  S.bombs.push(b);
  return b;
}
