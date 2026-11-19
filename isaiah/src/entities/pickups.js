// Pickups and interactive props: coins, hearts, keys, bombs, chests, batteries,
// cards, pills, trinkets, item pedestals, shop goods, trapdoors.
import { CFG } from '../config.js';
import { S } from '../state.js';
import { audio } from '../core/audio.js';
import { makeSprite, freeSprite, place, makeShadow, freeFlat, placeFlat, setTex, makeFlat, glowTex } from '../render/gfx.js';
import { coinTex, heartTex, keyTex, bombTex, chestTex, batteryTex, cardBackTex, pillTex, pedestalTex, trapdoorTex, priceTex, heartPriceTex } from '../render/art_pickups.js';
import { itemIconTex, trinketIconTex, cardTex } from '../render/art_items.js';
import { M_WALK } from '../world/room.js';
import { poof, particles } from './effects.js';
import * as THREE from 'three';

let uid = 0;
const SIZES = { coin: 0.55, heart: 0.6, key: 0.6, bomb: 0.7, chest: 0.85, battery: 0.6, card: 0.5, pill: 0.55, trinket: 0.6 };

export class Pickup {
  constructor(kind, x, z, o = {}) {
    this.uid = ++uid;
    this.kind = kind; this.sub = o.sub;
    this.x = x; this.z = z; this.vx = o.vx || 0; this.vz = o.vz || 0;
    this.h = o.h ?? 0; this.vh = o.vh ?? 0;
    this.r = kind === 'chest' ? 0.35 : kind === 'pedestal' ? 0.45 : kind === 'trapdoor' ? 0.4 : 0.26;
    this.price = o.price || 0;          // coins
    this.heartPrice = o.heartPrice || 0; // red containers (bargain room)
    this.itemId = o.itemId || null;
    this.pool = o.pool || null;
    this.choice = o.choice || null;     // taking one item removes others with the same choice id
    this.persist = o.persist ?? true;
    this.opened = !!o.opened;
    this.alive = true;
    this.t = Math.random() * 6;
    this.delay = o.delay ?? 0.35;       // can't collect for a moment after spawning
    this.shopGood = o.shopGood || null; // what this shop slot sells
    this.fixed = !!this.shopGood;       // shop goods don't slide around
    this.makeSprites();
  }
  texture() {
    switch (this.kind) {
      case 'coin': return coinTex(this.sub || 'penny', Math.floor(this.t * 6) % 4);
      case 'heart': return heartTex(this.sub || 'full');
      case 'key': return keyTex(this.sub === 'golden');
      case 'bomb': return bombTex(this.sub || 'single');
      case 'chest': return chestTex(this.sub || 'normal', this.opened);
      case 'battery': return batteryTex();
      case 'card': return cardBackTex();
      case 'pill': return pillTex(S.run ? S.run.pillColorOf(this.sub) : 0);
      case 'trinket': return trinketIconTex(this.sub);
      case 'pedestal': return pedestalTex(this.pool === 'bargain' ? 'red' : this.pool === 'chapel' ? 'white' : this.pool === 'boss' ? 'gold' : 'stone');
      case 'trapdoor': return trapdoorTex(this.sub || 'normal');
      default: return heartTex('full');
    }
  }
  makeSprites() {
    const sz = SIZES[this.kind] || 0.6;
    if (this.kind === 'trapdoor') {
      this.flat = makeFlat(this.texture(), 1.5, 1.2, 320);
      placeFlat(this.flat, this.x, this.z);
      return;
    }
    const t = this.texture();
    const asp = t.userData.aspect || 1;
    this.spr = makeSprite(t, this.kind === 'pedestal' ? 1.05 : sz * asp, this.kind === 'pedestal' ? 0.92 : sz);
    if (this.kind !== 'pedestal') this.shadow = makeShadow(sz * 0.9);
    if (this.kind === 'pedestal') {
      this.glow = makeSprite(glowTex('#fff6c8'), 1.4, 1.4);
      this.glow.center.set(0.5, 0.5);
      this.glow.material.blending = THREE.AdditiveBlending;
      this.glow.material.opacity = 0.35;
      this.icon = makeSprite(this.itemId ? itemIconTex(this.itemId) : coinTex(), 0.8, 0.8);
      this.icon.visible = !!this.itemId;
      this.glow.visible = !!this.itemId;
    }
    if (this.price || this.heartPrice) {
      this.tag = makeSprite(this.heartPrice ? heartPriceTex(this.heartPrice) : priceTex(this.price + '¢'), 1.2, 0.45);
      this.tag.center.set(0.5, 0.5);
    }
    this.sync();
  }
  sync() {
    if (this.flat) return;
    if (this.kind === 'coin') setTex(this.spr, this.texture());
    if (this.shopGood && this.kind !== 'pedestal' && this.spr) this.spr.scale.set(0.7, 0.7, 1);
    place(this.spr, this.x, this.z, this.h, 0);
    if (this.shadow) placeFlat(this.shadow, this.x, this.z);
    if (this.icon) {
      const bob = Math.sin(this.t * 2.2) * 0.06;
      place(this.icon, this.x, this.z + 0.02, 0.78 + bob, 2);
      place(this.glow, this.x, this.z + 0.01, 1.15 + bob, 1);
      this.glow.material.opacity = 0.28 + Math.sin(this.t * 3) * 0.08;
    }
    if (this.tag) place(this.tag, this.x, this.z + 0.6, -0.2, 3);
  }
  destroy() {
    for (const s of [this.spr, this.icon, this.glow, this.tag]) if (s) freeSprite(s);
    if (this.shadow) freeFlat(this.shadow);
    if (this.flat) freeFlat(this.flat);
    this.spr = this.icon = this.glow = this.tag = this.shadow = this.flat = null;
    this.alive = false;
  }
  serialize() {
    return { kind: this.kind, sub: this.sub, x: this.x, z: this.z, price: this.price, heartPrice: this.heartPrice, itemId: this.itemId, pool: this.pool, choice: this.choice, opened: this.opened, shopGood: this.shopGood };
  }

  update(dt) {
    this.t += dt;
    if (this.delay > 0) this.delay -= dt;
    if (this.kind === 'pedestal' || this.kind === 'trapdoor') {
      this.checkTouch();
      return;
    }
    if (this.fixed) { this.checkTouch(); return; }
    // physics: pop arc + sliding
    if (this.h > 0 || this.vh > 0) {
      this.vh -= 22 * dt; this.h += this.vh * dt;
      if (this.h <= 0) { this.h = 0; this.vh = Math.abs(this.vh) > 2 ? -this.vh * 0.35 : 0; }
    }
    const fr = Math.exp(-5 * dt);
    this.vx *= fr; this.vz *= fr;
    this.x += this.vx * dt; this.z += this.vz * dt;
    if (S.room.collide(this, M_WALK, true)) { this.vx *= -0.4; this.vz *= -0.4; }
    // pickups gently push apart
    if (Math.abs(this.vx) + Math.abs(this.vz) < 0.5) {
      for (const o of S.pickups) {
        if (o === this || !o.alive || o.kind === 'pedestal' || o.kind === 'trapdoor') continue;
        const dx = this.x - o.x, dz = this.z - o.z, d2 = dx * dx + dz * dz, rr = this.r + o.r;
        if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), p = (rr - d) * 0.5; this.x += (dx / d) * p; this.z += (dz / d) * p; }
      }
    }
    this.checkTouch();
  }

  checkTouch() {
    const p = S.player;
    if (!p || p.dead || this.delay > 0 || S.game.state !== 'play') return;
    const rr = p.r + this.r;
    const dx = p.x - this.x, dz = p.z - this.z;
    if (dx * dx + dz * dz > rr * rr) { this.touching = false; return; }
    if (this.touching && (this.kind === 'pedestal' || this.price)) return; // must step off and back on
    this.touching = true;
    const ok = this.collect(p);
    if (ok === 'keep') return;
    if (ok) {
      if (this.kind === 'pedestal' || this.kind === 'trapdoor' || (this.kind === 'chest')) return;
      this.destroy();
    } else if (this.kind !== 'pedestal' && this.kind !== 'trapdoor' && !this.fixed) {
      // can't use it: nudge it away like the original
      const d = Math.hypot(dx, dz) || 1;
      this.vx -= (dx / d) * 2.5; this.vz -= (dz / d) * 2.5;
    }
  }

  /** Returns true if consumed */
  collect(p) {
    const g = S.game;
    if (this.price) {
      if (p.coins < this.price) return false;
      // check the good can actually be used before charging (hearts when full)
      if (this.kind === 'heart' && !canUseHeart(p, this.sub)) return false;
      p.coins -= this.price;
      this.price = 0;
      if (this.tag) { freeSprite(this.tag); this.tag = null; }
      audio.play('coin');
    }
    switch (this.kind) {
      case 'coin': {
        const v = { penny: 1, nickel: 5, dime: 10, lucky: 1 }[this.sub || 'penny'];
        p.coins = Math.min(99, p.coins + v);
        if (this.sub === 'lucky') { p.buffs.push({ stats: { luck: 1 } }); p.refresh(); }
        audio.play('coin');
        particles(this.x, this.z, { count: 4, kind: 'spark', color: 0xffe080, speed: 2, up: 3, life: 0.3, size: 0.15 });
        g.onPickup && g.onPickup(p, 'coin', v);
        return true;
      }
      case 'heart': {
        if (!canUseHeart(p, this.sub)) return false;
        const s = this.sub || 'full';
        if (s === 'full') p.heal(2); else if (s === 'half') p.heal(1); else if (s === 'double') p.heal(4);
        else if (s === 'soul') p.addSoul(2, 's'); else if (s === 'halfsoul') p.addSoul(1, 's'); else if (s === 'black') p.addSoul(2, 'b');
        audio.play(s === 'soul' || s === 'halfsoul' || s === 'black' ? 'soul' : 'heart');
        return true;
      }
      case 'key': p.keys = Math.min(99, p.keys + 1); audio.play('key'); return true;
      case 'bomb': p.bombs = Math.min(99, p.bombs + (this.sub === 'double' ? 2 : 1)); audio.play('bombPickup'); return true;
      case 'battery':
        if (!p.active) return false;
        g.chargeActive(p, 99); audio.play('active'); return true;
      case 'card': case 'pill': {
        const old = p.pocket;
        p.pocket = { type: this.kind, id: this.sub };
        if (old) spawnPickup(old.type, this.x, this.z, { sub: old.id, vh: 3, delay: 1 });
        audio.play(this.kind);
        g.banner(this.kind === 'card' ? g.cardName(this.sub) : g.pillName(this.sub), this.kind === 'card' ? 'press Q to use' : '');
        return true;
      }
      case 'trinket': {
        const old = p.trinket;
        p.trinket = this.sub;
        p.refresh();
        if (old) spawnPickup('trinket', this.x, this.z, { sub: old, vh: 3, delay: 1 });
        g.announceTrinket(this.sub);
        return true;
      }
      case 'chest': {
        if (this.opened) return 'keep';
        if (this.sub === 'locked') { if (p.keys <= 0) return 'keep'; p.keys--; }
        this.opened = true;
        setTex(this.spr, this.texture());
        audio.play('chest');
        g.openChest(this);
        return 'keep';
      }
      case 'pedestal': {
        if (!this.itemId) return 'keep';
        if (this.heartPrice) {
          if (p.maxRed < this.heartPrice * 2 && !(p.maxRed === 0 && p.soul.length >= 6)) return 'keep';
          if (p.maxRed >= this.heartPrice * 2) { p.addContainers(-this.heartPrice); if (p.red > p.maxRed) p.red = p.maxRed; }
          else p.soul.splice(p.soul.length - 6, 6);
          this.heartPrice = 0; if (this.tag) { freeSprite(this.tag); this.tag = null; }
          g.onBargainTaken();
          if (p.totalHalves <= 0) { p.die(); return 'keep'; }
        }
        const id = this.itemId;
        const swapped = g.giveItem(p, id, this);
        this.itemId = swapped || null;
        if (this.icon) {
          this.icon.visible = !!this.itemId; this.glow.visible = !!this.itemId;
          if (this.itemId) setTex(this.icon, itemIconTex(this.itemId));
        }
        if (this.choice) for (const o of S.pickups) if (o !== this && o.choice === this.choice && o.kind === 'pedestal') { o.itemId = null; if (o.icon) { o.icon.visible = false; o.glow.visible = false; } if (o.tag) { freeSprite(o.tag); o.tag = null; } poof(o.x, o.z); }
        return 'keep';
      }
      case 'trapdoor':
        g.enterTrapdoor(this);
        return 'keep';
      default: return false;
    }
  }
}

export function canUseHeart(p, sub = 'full') {
  if (sub === 'soul' || sub === 'halfsoul' || sub === 'black') return p.canAddSoul();
  return p.red < p.maxRed;
}

export function spawnPickup(kind, x, z, o = {}) {
  const pk = new Pickup(kind, x, z, o);
  S.pickups.push(pk);
  return pk;
}

/** Resolve a generic reward kind ('coin', 'heart', ...) into a concrete pickup with a pop. */
export function spawnReward(kind, x, z, rng, o = {}) {
  const a = rng.next() * Math.PI * 2, sp = o.spread ?? 1.5;
  const base = { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vh: o.vh ?? 4, h: 0.1, ...o };
  switch (kind) {
    case 'coin': return spawnPickup('coin', x, z, { ...base, sub: rng.weighted(CFG.COIN_VALUES) });
    case 'heart': return spawnPickup('heart', x, z, { ...base, sub: rng.weighted(CFG.HEART_TYPES) });
    case 'soul': return spawnPickup('heart', x, z, { ...base, sub: 'soul' });
    case 'black': return spawnPickup('heart', x, z, { ...base, sub: 'black' });
    case 'key': return spawnPickup('key', x, z, { ...base, sub: rng.chance(0.03) ? 'golden' : 'normal' });
    case 'bomb': return spawnPickup('bomb', x, z, { ...base, sub: rng.chance(0.12) ? 'double' : 'single' });
    case 'chest': return spawnPickup('chest', x, z, { ...base, sub: rng.chance(0.12) ? 'red' : 'normal' });
    case 'lockedchest': return spawnPickup('chest', x, z, { ...base, sub: 'locked' });
    case 'battery': return spawnPickup('battery', x, z, base);
    case 'card': return spawnPickup('card', x, z, { ...base, sub: S.game.randomCard(rng) });
    case 'pill': return spawnPickup('pill', x, z, { ...base, sub: S.game.randomPill(rng) });
    case 'trinket': { const t = S.game.randomTrinket(rng); return t ? spawnPickup('trinket', x, z, { ...base, sub: t }) : spawnReward('coin', x, z, rng, o); }
    default: return spawnPickup('coin', x, z, base);
  }
}
