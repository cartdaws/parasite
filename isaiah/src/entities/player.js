// Isaiah: movement with acceleration/friction, 4-way crying, hearts, items.
import { CFG } from '../config.js';
import { S } from '../state.js';
import { input, DIRS } from '../core/input.js';
import { audio } from '../core/audio.js';
import { makeSprite, freeSprite, place, makeShadow, freeFlat, placeFlat, setTex, addShake } from '../render/gfx.js';
import { headTex, bodyTex, deadTex } from '../render/art_player.js';
import { M_WALK, M_FLY } from '../world/room.js';
import { recalcStats, CHAR_BASE } from '../items/stats.js';
import { runHook } from '../items/hooks.js';
import { ITEMS, TRINKETS } from '../items/items.js';
import { spawnTear, spawnLaser, TEAR_COLORS } from './tears.js';
import { flashTex } from '../render/draw.js';
import { particles } from './effects.js';

const PC = CFG.PLAYER;

export class Player {
  constructor(charId = 'isaiah') {
    const base = CHAR_BASE[charId];
    this.charId = charId;
    this.x = 6.5; this.z = 3.5; this.vx = 0; this.vz = 0;
    this.r = PC.radius;
    this.alive = true; this.dead = false;
    // hearts are counted in halves
    this.maxRed = base.hearts * 2;
    this.red = base.hearts * 2;
    this.soul = [];            // array of 's' | 'b' halves, last one is lost first
    for (let i = 0; i < base.soul * 2; i++) this.soul.push('s');
    this.coins = 0; this.bombs = base.bombs ?? 0; this.keys = 0;
    this.items = [];           // passive + collected item ids in pickup order
    this.active = null;        // { id, charge }
    this.trinket = null;
    this.pocket = base.startPocket ? { ...base.startPocket } : null; // { type: 'card'|'pill', id }
    this.buffs = [];           // temporary stat sources: { stats, until: 'room'|'floor', ... }
    this.extraLives = 0;
    this.bodyDir = 2; this.headDir = 2; this.walkT = 0;
    this.fireCd = 0; this.eye = 0;
    this.charge = 0;           // laser / charged-shot charge (0..1)
    this.invuln = 0;
    this.holding = null;       // { tex, t }
    this.flash = 0;
    this.hurtFace = 0;
    this.cosmetics = {};
    this.cosVersion = 0;
    this.damageTakenFloor = false;
    this.damageTakenBoss = false;
    this.lastHitBy = null;
    this.fireTimer = 0;        // time since last shot (for head pose)
    this.spr = makeSprite(bodyTex(charId, 2, 0, null), 0.9, 0.71);
    this.head = makeSprite(headTex(charId, 2, 'idle', null), 1.15, 1.15);
    this.held = makeSprite(bodyTex(charId, 2, 0, null), 0.8, 0.8); this.held.visible = false;
    this.shadow = makeShadow(0.75);
    for (const id of base.startItems) if (ITEMS[id]) this.items.push(id);
    recalcStats(this);
    this.rebuildCosmetics();
  }

  /** Move sprites into a room's entity layer (on room change) */
  attach(layer) {
    for (const s of [this.spr, this.head, this.held, this.shadow]) { if (s.parent) s.parent.remove(s); layer.add(s); }
  }
  destroy() { freeSprite(this.spr); freeSprite(this.head); freeSprite(this.held); freeFlat(this.shadow); }

  // ---- health ----------------------------------------------------------------
  get totalHalves() { return this.red + this.soul.length; }
  get heartSlots() { return Math.ceil(this.maxRed / 2) + Math.ceil(this.soul.length / 2); }
  canAddSoul() { return this.heartSlots < PC.maxHearts || this.soul.length % 2 === 1; }
  addContainers(n, fill = true) {
    for (let i = 0; i < n; i++) {
      if (Math.ceil(this.maxRed / 2) >= PC.maxHearts) break;
      this.maxRed += 2;
      if (fill) this.red += 2;
      // trim soul hearts that no longer fit
      while (this.heartSlots > PC.maxHearts && this.soul.length) this.soul.pop();
    }
    if (n < 0) { this.maxRed = Math.max(0, this.maxRed + n * 2); this.red = Math.min(this.red, this.maxRed); }
  }
  heal(halves) { const before = this.red; this.red = Math.min(this.maxRed, this.red + halves); return this.red - before; }
  addSoul(halves, type = 's') {
    let added = 0;
    for (let i = 0; i < halves; i++) {
      if (!this.canAddSoul()) break;
      this.soul.push(type); added++;
    }
    return added;
  }
  /** amount in halves. Returns true if damage was taken. */
  hurt(amount, source = 'something', opts = {}) {
    if (this.dead || S.game.state !== 'play') return false;
    if (this.invuln > 0 && !opts.ignoreInvuln) return false;
    if (this.holyShield) { this.holyShield = false; this.invuln = 0.6; audio.play('chapel'); return false; }
    for (let i = 0; i < amount; i++) {
      if (this.soul.length && !opts.redFirst) {
        const t = this.soul.pop();
        if (t === 'b' && this.soul.length % 2 === 0) S.game.blackHeartBurst();
      } else if (this.red > 0) {
        this.red--;
        this.damageTakenFloor = true;
        if (S.room && S.room.type === 'boss') this.damageTakenBoss = true;
      } else if (this.soul.length) {
        this.soul.pop();
      }
    }
    this.lastHitBy = typeof source === 'string' ? source : (source && source.name) || 'something';
    this.invuln = opts.invuln ?? PC.invulnTime;
    this.hurtFace = 0.35;
    this.flash = 0.12;
    addShake(0.35);
    S.hitStop = Math.max(S.hitStop, 3);
    audio.play('hurt');
    particles(this.x, this.z, { count: 6, color: 0xaa1a1a, kind: 'blob', speed: 2.5, up: 3, life: 0.5, size: 0.18, decal: '#6e0f0f' });
    runHook(this, 'onHurt', this, amount, source);
    if (this.totalHalves <= 0) this.die();
    return true;
  }
  die() {
    if (this.extraLives > 0 || this.items.some((id) => ITEMS[id]?.extraLife && !this.usedLives?.includes(id))) {
      // consume an extra life item (first unused)
      const id = this.items.find((x) => ITEMS[x]?.extraLife && !(this.usedLives || []).includes(x));
      if (id) { (this.usedLives = this.usedLives || []).push(id); ITEMS[id].extraLife(this); }
      else { this.extraLives--; this.maxRed = Math.max(2, this.maxRed); this.red = Math.max(2, this.maxRed / 2); }
      if (this.totalHalves <= 0) this.red = Math.min(2, Math.max(2, this.maxRed));
      if (this.maxRed === 0 && this.soul.length === 0) this.soul.push('s', 's');
      this.invuln = 2;
      audio.play('soul');
      S.game.banner('Not yet...', 'something pulled you back');
      return;
    }
    this.dead = true;
    S.game.onPlayerDeath(this.lastHitBy);
  }

  // ---- items -----------------------------------------------------------------
  hasItem(id) { return this.items.includes(id); }
  itemCount(id) { return this.items.filter((x) => x === id).length; }
  rebuildCosmetics() {
    const c = {};
    for (const id of this.items) { const d = ITEMS[id]; if (d && d.cosmetic) Object.assign(c, d.cosmetic); }
    if (this.trinket && TRINKETS[this.trinket]?.cosmetic) Object.assign(c, TRINKETS[this.trinket].cosmetic);
    if (this.flying && !c.wings) c.wings = c.wings || null;
    this.cosmetics = Object.keys(c).length ? c : null;
    this.cosVersion++;
  }
  refresh() { recalcStats(this); this.rebuildCosmetics(); }
  showHeld(texture, time = PC.holdItemTime) {
    this.holding = { tex: texture, t: time };
  }

  // ---- update ----------------------------------------------------------------
  update(dt) {
    if (this.dead) return;
    const st = this.stats;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtFace > 0) this.hurtFace -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.holding) { this.holding.t -= dt; if (this.holding.t <= 0) this.holding = null; }
    this.fireTimer += dt;

    // movement: accelerate toward the input direction, friction otherwise
    const maxSp = PC.baseSpeed * st.speed;
    const mx = input.move.x, mz = input.move.z;
    const tx = mx * maxSp, tz = mz * maxSp;
    const moving = Math.abs(mx) + Math.abs(mz) > 0.05;
    const k = 1 - Math.exp(-(moving ? PC.accelRate : PC.frictionRate) * dt);
    this.vx += (tx - this.vx) * k;
    this.vz += (tz - this.vz) * k;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    const mask = this.flying ? M_FLY : M_WALK;
    S.room.collide(this, mask, true);
    S.game.checkDoors(this, mx, mz);

    // facing
    const sp = Math.hypot(this.vx, this.vz);
    if (moving) {
      this.bodyDir = Math.abs(mx) > Math.abs(mz) ? (mx > 0 ? 1 : 3) : (mz > 0 ? 2 : 0);
      this.walkT += dt * (6 + sp * 1.3);
    } else this.walkT = 0;

    // shooting
    const sd = input.shootDir;
    if (sd >= 0) this.headDir = sd; else if (moving && this.fireTimer > 0.3) this.headDir = this.bodyDir;
    this.fireCd -= dt;
    this.updateWeapon(dt, sd);

    // actions
    if (input.pressed('bomb')) S.game.playerPlaceBomb(this);
    if (input.pressed('active')) S.game.useActive(this);
    if (input.pressed('card')) S.game.usePocket(this);
    if (input.pressed('drop')) S.game.dropTrinket(this);

    // spikes / fire damage
    const t = S.room.tile(Math.floor(this.x), Math.floor(this.z));
    if (t && t.t === 'spikes' && !this.flying && S.room.type !== 'sacrifice') this.hurt(S.game.dmgAmount(false), 'spikes');
    runHook(this, 'onUpdate', this, dt);
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const b = this.buffs[i];
      if (b.time != null) { b.time -= dt; if (b.time <= 0) { this.buffs.splice(i, 1); this.refresh(); } }
    }
  }

  updateWeapon(dt, sd) {
    const st = this.stats;
    const w = this.weapon;
    if (w === 'laser' || w === 'charged') {
      const chargeTime = w === 'laser' ? st.fireDelay * 3.2 : st.fireDelay * 2.6;
      if (sd >= 0) {
        const before = this.charge;
        this.charge = Math.min(1, this.charge + dt / chargeTime);
        this.chargeDir = sd;
        if (before < 1 && this.charge >= 1) audio.play('charged');
      } else if (this.charge > 0) {
        if (w === 'laser') { if (this.charge >= 1) this.fireLaser(this.chargeDir); }
        else this.fireVolley(this.chargeDir, 0.35 + this.charge * 2.8, this.charge);
        this.charge = 0;
      }
      return;
    }
    if (sd >= 0 && this.fireCd <= 0) {
      this.fireCd = st.fireDelay;
      if (w === 'tech') this.fireTech(sd); else this.fireVolley(sd, 1, 0);
    }
  }

  /** Fire one volley of tears (respects multishot); dmgMult for charged shots */
  fireVolley(dir, dmgMult = 1, charge = 0) {
    const st = this.stats;
    const [dx, dz] = DIRS[dir];
    const speed = CFG.STATS.tearBaseSpeed * st.shotSpeed;
    const n = this.shots;
    const base = Math.atan2(dz, dx);
    const tears = [];
    this.eye ^= 1;
    for (let i = 0; i < n; i++) {
      let a = base, off = 0;
      if (n > 1) {
        if (this.spreadMode === 'parallel') off = (i - (n - 1) / 2) * 0.28;
        else a = base + (i - (n - 1) / 2) * (n > 4 ? 0.13 : 0.17);
      } else off = (this.eye ? 1 : -1) * 0.13;
      const px = -dz, pz = dx; // perpendicular
      const t = spawnTear({
        x: this.x + px * off + dx * 0.15, z: this.z + pz * off + dz * 0.15 - 0.02,
        vx: Math.cos(a) * speed + this.vx * PC.tearInheritVel,
        vz: Math.sin(a) * speed + this.vz * PC.tearInheritVel,
        dmg: st.damage * dmgMult,
        range: st.range * (charge ? 0.8 + charge * 0.5 : 1),
        scale: this.tearScale * (charge ? 0.8 + charge * 0.9 : 1),
        flags: this.tearFlags,
        color: this.tearColor ?? tearColorFromFlags(this.tearFlags),
        style: this.tearStyle,
        owner: 'player',
        height: CFG.STATS.tearHeight + (this.flying ? 0.2 : 0),
        knock: CFG.STATS.knockback * (charge ? 1 + charge : 1),
      });
      runHook(this, 'modifyTear', t, this);
      t.spr.material.color.set(t.color);
      tears.push(t);
    }
    runHook(this, 'onFire', this, dir, tears);
    this.fireTimer = 0;
    audio.play('tear');
  }
  fireLaser(dir) {
    const st = this.stats;
    const n = Math.min(4, this.shots);
    const base = Math.atan2(DIRS[dir][1], DIRS[dir][0]);
    for (let i = 0; i < n; i++) {
      const a = base + (n > 1 ? (i - (n - 1) / 2) * 0.22 : 0);
      spawnLaser({ follow: this, x: this.x, z: this.z, angle: a, offset: 0.3, dmg: st.damage * 0.95, duration: 0.42, width: 0.8 * Math.min(1.6, this.tearScale), color: this.tearColor ? '#' + this.tearColor.toString(16).padStart(6, '0') : '#d01818', flags: this.tearFlags, owner: 'player' });
    }
    addShake(0.15);
    this.fireTimer = 0;
    audio.play('laser');
  }
  fireTech(dir) {
    const st = this.stats;
    const n = this.shots;
    const base = Math.atan2(DIRS[dir][1], DIRS[dir][0]);
    for (let i = 0; i < n; i++) {
      const a = base + (n > 1 ? (i - (n - 1) / 2) * 0.17 : 0);
      spawnLaser({ x: this.x, z: this.z, angle: a, dmg: st.damage, duration: 0.09, tick: 1, width: 0.28, color: '#6ad8ff', length: st.range * 1.1, flags: this.tearFlags, owner: 'player' });
    }
    this.fireTimer = 0;
    audio.play('enemyShot');
  }

  // ---- render ----------------------------------------------------------------
  sync() {
    if (this.dead) {
      setTex(this.spr, deadTex(this.charId)); this.spr.scale.set(1.3, 0.78, 1);
      place(this.spr, this.x, this.z + 0.2, 0, 0);
      this.head.visible = false; this.held.visible = false;
      placeFlat(this.shadow, this.x, this.z);
      return;
    }
    const cos = this.cosmetics;
    const holding = !!this.holding;
    const frame = holding ? 'hold' : this.walkT > 0 ? Math.floor(this.walkT) % 4 : 0;
    let mode = 'idle';
    if (this.hurtFace > 0) mode = 'hurt';
    else if (holding) mode = 'happy';
    else if (this.fireTimer < 0.12 || this.charge > 0) mode = 'shoot';
    let btex = bodyTex(this.charId, holding ? 2 : this.bodyDir, frame, cos);
    let htex = headTex(this.charId, holding ? 2 : this.headDir, mode, cos);
    if (this.flash > 0) { btex = flashTex(btex); htex = flashTex(htex); }
    setTex(this.spr, btex); setTex(this.head, htex);
    this.spr.scale.set(0.9, 0.71, 1);
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    this.spr.visible = this.head.visible = !blink;
    const fly = this.flying ? 0.22 + Math.sin(S.time * 5) * 0.06 : 0;
    const bob = this.walkT > 0 ? Math.abs(Math.sin(this.walkT * Math.PI / 2)) * 0.03 : 0;
    place(this.spr, this.x, this.z, fly, 0);
    place(this.head, this.x, this.z, fly + 0.42 + bob - (this.charge > 0 ? 0.03 * Math.sin(S.time * 40) * this.charge : 0), 1);
    // charging squash
    const sq = this.charge > 0 ? 1 + this.charge * 0.08 : 1;
    this.head.scale.set(1.15 * sq, 1.15 / sq, 1);
    if (holding) {
      this.held.visible = true;
      setTex(this.held, this.holding.tex);
      this.held.scale.set(0.8, 0.8, 1);
      place(this.held, this.x, this.z, fly + 1.25 + Math.sin(S.time * 6) * 0.04, 2);
    } else this.held.visible = false;
    placeFlat(this.shadow, this.x, this.z);
    this.shadow.scale.set(0.75 - fly * 0.6, 1, (0.75 - fly * 0.6) * 0.55);
  }
}

export function tearColorFromFlags(f) {
  if (f.burn) return TEAR_COLORS.burn;
  if (f.poison) return TEAR_COLORS.poison;
  if (f.charm) return TEAR_COLORS.charm;
  if (f.fear) return TEAR_COLORS.fear;
  if (f.slow) return TEAR_COLORS.slow;
  if (f.homing) return TEAR_COLORS.homing;
  return TEAR_COLORS.default;
}
