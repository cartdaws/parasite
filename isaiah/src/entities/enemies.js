// Enemy base class + behaviors for every regular enemy archetype.
import { CFG } from '../config.js';
import { S } from '../state.js';
import { audio } from '../core/audio.js';
import { fxRng } from '../core/rng.js';
import { makeSprite, freeSprite, place, makeShadow, freeFlat, placeFlat, setTex, addShake } from '../render/gfx.js';
import { enemyTex, ENEMY_ART } from '../render/art_enemies.js';
import { flashTex } from '../render/draw.js';
import { M_WALK, M_FLY, SIDE_VEC } from '../world/room.js';
import { enemyShot, angleTo, TEAR_COLORS } from './tears.js';
import { gore, particles, poof, creep, splat } from './effects.js';
import { spawnReward } from './pickups.js';
import { runHook } from '../items/hooks.js';

let uidCounter = 0;
const TAU = Math.PI * 2;

// ---- shared pathing: BFS flow field toward the player, cached briefly ----------
let flow = null, flowT = -1, flowTile = -1, flowRoom = null;
function flowField() {
  const p = S.player, room = S.room;
  const tx = Math.floor(p.x), tz = Math.floor(p.z), key = tz * room.W + tx;
  if (flow && flowRoom === room && (key === flowTile || S.time - flowT < 0.25)) return flow;
  flow = room.flowField(tx, tz, M_WALK); flowT = S.time; flowTile = key; flowRoom = room;
  return flow;
}
/** Direction (unit vector) a ground walker should take toward the player */
export function pathDir(e) {
  const p = S.player, room = S.room;
  const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1;
  if (e.flying || room.lineClear(e.x, e.z, p.x, p.z, M_WALK) && d < 6) return [dx / d, dz / d];
  const f = flowField();
  const tx = Math.floor(e.x), tz = Math.floor(e.z);
  const cur = f[tz * room.W + tx];
  let best = null, bv = cur < 0 ? 1e9 : cur;
  for (const [ox, oz] of [...SIDE_VEC, [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = tx + ox, nz = tz + oz;
    if (!room.inBounds(nx, nz)) continue;
    const v = f[nz * room.W + nx];
    if (v < 0 || v >= bv) continue;
    if (ox && oz && (f[tz * room.W + nx] < 0 || f[nz * room.W + tx] < 0)) continue; // no corner cutting
    bv = v; best = [nx + 0.5, nz + 0.5];
  }
  if (!best) return [dx / d, dz / d];
  const bx = best[0] - e.x, bz = best[1] - e.z, bd = Math.hypot(bx, bz) || 1;
  return [bx / bd, bz / bd];
}

// ---- base class ------------------------------------------------------------------
export class Enemy {
  constructor(type, x, z, o = {}) {
    const def = DEFS[type];
    const cfg = CFG.ENEMY[type] || {};
    this.uid = ++uidCounter;
    this.type = type; this.def = def; this.cfg = cfg;
    this.name = def.name;
    this.x = x; this.z = z; this.vx = 0; this.vz = 0; this.kx = 0; this.kz = 0;
    const fl = Math.min(S.floorNum, 5);
    this.champion = o.champion && !def.noChampion ? o.champion : null;
    const hpMult = this.champion?.hpMult || 1;
    this.maxHp = this.hp = (o.hp ?? cfg.hp ?? 10) * CFG.ENEMY_HP_FLOOR_SCALE[fl] * hpMult;
    this.speed = (cfg.speed ?? 1) * (this.champion?.speedMult || 1);
    this.r = def.r ?? 0.35;
    this.flying = !!def.flying;
    this.mass = def.mass ?? 1;
    this.h = def.height ?? 0;
    this.state = 'idle'; this.t = 0; this.age = 0;
    this.status = { poison: 0, burn: 0, slow: 0, fear: 0, charm: 0, freeze: 0, dotTick: 0, dotDmg: 0 };
    this.flash = 0;
    this.alive = true;
    this.spawnGrace = 0;
    this.face = 1;
    this.frame = 0;
    this.isBoss = false;
    const art = ENEMY_ART[def.art || type];
    this.wsize = def.wsize || (art ? [art.w / 64, art.h / 64] : [1, 1]);
    if (this.champion) { this.wsize = [this.wsize[0] * 1.12, this.wsize[1] * 1.12]; this.r *= 1.1; }
    this.spr = makeSprite(enemyTex(def.art || type, 0), this.wsize[0], this.wsize[1]);
    if (this.champion) this.spr.material.color.set(this.champion.tint);
    this.shadow = makeShadow(def.shadow ?? this.r * 2.4);
    Object.assign(this, o.props || {});
    if (def.init) def.init(this, o);
    this.sync();
  }
  get rng() { return S.run ? S.run.aiRng : fxRng; }
  // movement helpers -----------------------------------------------------------
  toward(tx, tz, speed) { const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz) || 1; this.vx = (dx / d) * speed; this.vz = (dz / d) * speed; return d; }
  chase(speed) { const [dx, dz] = pathDir(this); this.vx = dx * speed; this.vz = dz * speed; }
  stop() { this.vx = this.vz = 0; }
  distToPlayer() { return Math.hypot(S.player.x - this.x, S.player.z - this.z); }
  angleToPlayer() { return angleTo(this, S.player); }
  aligned(tol = 0.45) { const p = S.player; return Math.abs(p.x - this.x) < tol ? (p.z > this.z ? 2 : 0) : Math.abs(p.z - this.z) < tol ? (p.x > this.x ? 1 : 3) : -1; }
  shoot(angle, o = {}) { audio.play('enemyShot'); return enemyShot(this, angle, { speed: o.speed, ...o }); }
  ring(n, offset = 0, o = {}) { for (let i = 0; i < n; i++) this.shoot(offset + (i / n) * TAU, o); }
  spread(angle, n, step, o = {}) { for (let i = 0; i < n; i++) this.shoot(angle + (i - (n - 1) / 2) * step, o); }

  update(dt) {
    this.age += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.spawnGrace > 0) { this.spawnGrace -= dt; return; }
    const st = this.status;
    // damage over time (poison / burn)
    if (st.poison > 0 || st.burn > 0) {
      st.poison -= dt; st.burn -= dt; st.dotTick -= dt;
      if (st.dotTick <= 0) {
        st.dotTick = 0.5;
        this.hurt(st.dotDmg, { flags: {}, dot: true });
        if (!this.alive) return;
        if (st.burn > 0) particles(this.x, this.z, { count: 2, kind: 'spark', color: 0xff8a2a, speed: 1, up: 2, life: 0.4, size: 0.2, h: 0.5 });
      }
    }
    if (st.slow > 0) st.slow -= dt;
    if (st.fear > 0) st.fear -= dt;
    if (st.charm > 0) st.charm -= dt;
    if (st.freeze > 0) { st.freeze -= dt; this.vx = this.vz = 0; this.applyMotion(dt); return; }
    const edt = st.slow > 0 ? dt * 0.5 : dt;
    this.t += edt;
    this.def.update(this, edt);
    if (!this.alive) return;
    if (st.fear > 0 && !this.isBoss && !this.def.stationary) { // run away
      const a = angleTo(S.player, this); const sp = Math.max(1.2, this.speed);
      this.vx = Math.cos(a) * sp; this.vz = Math.sin(a) * sp;
    }
    if (st.charm > 0 && !this.def.stationary) { // wander confused, don't hurt the player
      if (this.t % 1 < edt) { const a = fxRng.range(0, TAU); this.cvx = Math.cos(a); this.cvz = Math.sin(a); }
      this.vx = (this.cvx || 0) * this.speed; this.vz = (this.cvz || 0) * this.speed;
    }
    if (st.slow > 0) { this.vx *= 0.5; this.vz *= 0.5; }
    this.applyMotion(edt);
    if (this.champion?.creep && this.age % 0.5 < dt) creep(this.x, this.z, { color: '#6f8a1e', size: 0.8, life: 2.5 });
    // contact damage
    const p = S.player;
    if (!this.noContact && !this.untargetable && !p.dead && st.charm <= 0) {
      const rr = this.r * 0.85 + p.r * 0.7;
      if ((p.x - this.x) ** 2 + (p.z - this.z) ** 2 < rr * rr) {
        if (this.def.onTouchPlayer) this.def.onTouchPlayer(this);
        else p.hurt(Math.min(2, S.game.dmgAmount(this.isBoss, true) * (this.champion?.dmgMult || 1)), this);
      }
    }
  }
  applyMotion(dt) {
    const decay = Math.exp(-8 * dt);
    this.kx *= decay; this.kz *= decay;
    this.x += (this.vx + this.kx) * dt;
    this.z += (this.vz + this.kz) * dt;
    if (!this.noCollide) {
      this.wallHit = S.room.collide(this, this.flying || this.phasing ? M_FLY : M_WALK, true);
      // soft separation from other enemies
      if (!this.flying && !this.untargetable) {
        for (const o of S.enemies) {
          if (o === this || !o.alive || o.flying || o.untargetable || o.isBoss) continue;
          const dx = this.x - o.x, dz = this.z - o.z, rr = (this.r + o.r) * 0.8;
          const d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), push = (rr - d) * 0.25; this.x += (dx / d) * push; this.z += (dz / d) * push; }
        }
      }
    }
    if (Math.abs(this.vx) > 0.05) this.face = this.vx > 0 ? 1 : -1;
  }

  hurt(dmg, info = {}) {
    if (!this.alive || this.invulnerable || this.untargetable) return;
    if (this.def.blockHit && this.def.blockHit(this, info)) { splat(this.x, this.z, 0.5, 0xcccccc, 0.8); return; }
    if (this.def.onHurt) dmg = this.def.onHurt(this, dmg, info) ?? dmg;
    this.hp -= dmg;
    this.flash = 0.09;
    if (info.kx != null && !this.def.stationary) { this.kx += (info.kx || 0) / this.mass; this.kz += (info.kz || 0) / this.mass; }
    const f = info.flags || {};
    const st = this.status;
    if (f.poison) { st.poison = 3; st.dotDmg = Math.max(st.dotDmg, (S.player?.stats.damage || 3.5) * 0.5); }
    if (f.burn) { st.burn = 3; st.dotDmg = Math.max(st.dotDmg, (S.player?.stats.damage || 3.5) * 0.5); }
    if (f.slow) st.slow = 2.5;
    if (f.fear && !this.isBoss) st.fear = 2.5;
    if (f.charm && !this.isBoss) st.charm = 3;
    if (f.freeze && !this.isBoss) st.freeze = 1.2;
    if (!info.dot) audio.play('hit');
    if (this.hp <= 0) this.die(info);
  }
  die(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    S.run && S.run.kills++;
    const big = this.def.gore ?? Math.max(0.6, this.r * 2.2);
    if (this.def.noGore) poof(this.x, this.z, 0xc8c0b0, big);
    else gore(this.x, this.z, big, this.def.bloodTint ?? 0x9a1414, this.def.decal ?? '#6e0f0f');
    audio.play('enemyDie');
    if (this.def.onDeath) this.def.onDeath(this, info);
    const ch = this.champion;
    if (ch) {
      if (ch.deathShots) this.ring(ch.deathShots, 0, { speed: 4 });
      if (ch.drop) spawnReward(ch.drop, this.x, this.z, S.run.dropRng);
    }
    if (S.player) runHook(S.player, 'onEnemyKill', this, S.player);
    this.destroy();
  }
  destroy() {
    this.alive = false;
    if (this.spr) freeSprite(this.spr);
    if (this.shadow) freeFlat(this.shadow);
    if (this.extra) for (const s of this.extra) freeSprite(s);
    this.spr = this.shadow = null; this.extra = null;
  }
  sync() {
    if (!this.spr) return;
    const def = this.def;
    const art = ENEMY_ART[def.art || this.type];
    const frame = def.frame ? def.frame(this) : Math.floor(this.age * (def.fps || 6)) % (art ? art.frames : 1);
    const left = art && art.mirror ? (art.facesLeft ? this.face > 0 : this.face < 0) : false;
    let t = enemyTex(def.art || this.type, frame, left);
    if (this.flash > 0) t = flashTex(t);
    setTex(this.spr, t);
    const st = this.status;
    const col = this.flash > 0 ? 0xffffff : st.freeze > 0 ? 0x9a9aaa : st.poison > 0 ? 0x8ae070 : st.burn > 0 ? 0xffa060 : st.slow > 0 ? 0xa0a0b0 : st.charm > 0 ? 0xff9ad0 : st.fear > 0 ? 0xb07ad0 : (this.champion ? this.champion.tint : 0xffffff);
    this.spr.material.color.set(col);
    this.spr.material.opacity = this.opacity ?? 1;
    const grace = this.spawnGrace > 0 ? 1 - this.spawnGrace / CFG.ENEMY_SPAWN_GRACE : 1;
    const sx = this.wsize[0] * (this.squashX || 1), sy = this.wsize[1] * (this.squashY || 1);
    this.spr.scale.set(sx * (0.6 + 0.4 * grace), sy * (0.6 + 0.4 * grace), 1);
    const bob = this.flying ? Math.sin(this.age * 6 + this.uid) * 0.06 : 0;
    place(this.spr, this.x, this.z, (this.h || 0) + bob, 0);
    if (this.shadow) {
      placeFlat(this.shadow, this.x, this.z);
      const s = (def.shadow ?? this.r * 2.4) * (1 - Math.min(0.5, (this.h || 0) * 0.3));
      this.shadow.scale.set(s, 1, s * 0.55);
      this.shadow.visible = !this.hideShadow;
    }
    this.spr.visible = !this.hidden;
  }
}

export function spawnEnemy(type, x, z, o = {}) {
  if (!DEFS[type]) { console.warn('unknown enemy', type); return null; }
  if (S.enemies.length > 60) return null;
  const e = new Enemy(type, x, z, o);
  S.enemies.push(e);
  return e;
}

// ---- small behavior helpers ---------------------------------------------------------
function wander(e, speed, turn = 1.5) {
  if (!e.wdir || e.t > e.wNext || e.wallHit) { const a = e.rng.range(0, TAU); e.wdir = [Math.cos(a), Math.sin(a)]; e.wNext = e.t + e.rng.range(turn * 0.6, turn * 1.4); }
  e.vx = e.wdir[0] * speed; e.vz = e.wdir[1] * speed;
}
function every(e, key, period) {
  e[key] = (e[key] ?? period * (0.5 + e.rng.next() * 0.5)) - CFG.TICK;
  if (e[key] <= 0) { e[key] = period; return true; }
  return false;
}
function hop(e, dt, o) {
  // generic hopping: state 'ground' -> 'air'
  if (e.state !== 'air') {
    e.stop(); e.h = 0;
    if (e.t > (e.restT ?? 0.6)) {
      e.state = 'air'; e.t = 0;
      const p = S.player;
      const tx = o.random ? e.x + e.rng.range(-2.5, 2.5) : p.x + e.rng.range(-0.6, 0.6);
      const tz = o.random ? e.z + e.rng.range(-2, 2) : p.z + e.rng.range(-0.6, 0.6);
      const d = Math.min(o.maxDist ?? 4, Math.hypot(tx - e.x, tz - e.z));
      const a = Math.atan2(tz - e.z, tx - e.x);
      e.airTime = o.airTime ?? 0.55;
      e.vx = Math.cos(a) * d / e.airTime; e.vz = Math.sin(a) * d / e.airTime;
      e.restT = o.rest ?? e.rng.range(0.4, 0.9);
    }
  } else {
    const k = e.t / e.airTime;
    e.h = Math.sin(Math.min(1, k) * Math.PI) * (o.height ?? 0.9);
    if (k >= 1) { e.state = 'ground'; e.t = 0; e.h = 0; e.stop(); if (o.onLand) o.onLand(e); }
  }
  e.flying = e.state === 'air';
  e.noContact = e.state === 'air' && (o.height ?? 0.9) > 1.2;
}

// ---- enemy definitions ----------------------------------------------------------------
export const DEFS = {
  gnat: { name: 'a dust gnat', r: 0.22, flying: true, height: 0.5, mass: 0.4, gore: 0.4, fps: 14,
    update(e) { const a = e.angleToPlayer() + Math.sin(e.age * 3 + e.uid) * 0.9; e.vx = Math.cos(a) * e.speed; e.vz = Math.sin(a) * e.speed; if (e.age % 3 < CFG.TICK) audio.play('buzz'); } },
  twitchfly: { name: 'a twitchfly', r: 0.25, flying: true, height: 0.55, mass: 0.5, gore: 0.45, fps: 16,
    update(e) {
      if (e.t > (e.next ?? 0)) {
        const a = e.angleToPlayer() + e.rng.range(-1.4, 1.4);
        e.dir = [Math.cos(a), Math.sin(a)]; e.next = e.t + e.rng.range(0.15, 0.45);
      }
      e.vx = e.dir[0] * e.speed; e.vz = e.dir[1] * e.speed;
    } },
  halogn: { name: 'a halo gnat', r: 0.2, flying: true, height: 0.6, mass: 0.4, gore: 0.35, fps: 14,
    init(e, o) { e.host = o.host || null; e.orbitA = o.angle ?? e.rng.range(0, TAU); },
    update(e, dt) {
      if (!e.host || !e.host.alive) {
        e.host = S.enemies.find((o) => o.alive && o !== e && !o.flying && !o.isBoss) || null;
        if (!e.host) { const a = e.angleToPlayer(); e.vx = Math.cos(a) * 1.4; e.vz = Math.sin(a) * 1.4; return; }
      }
      e.orbitA += dt * e.speed * 0.9;
      const R = e.host.r + 0.7;
      const tx = e.host.x + Math.cos(e.orbitA) * R, tz = e.host.z + Math.sin(e.orbitA) * R * 0.85;
      e.vx = (tx - e.x) * 10; e.vz = (tz - e.z) * 10;
    } },
  bloat: { name: 'a bloat', r: 0.5, flying: true, height: 0.45, mass: 2.5, fps: 10, gore: 1.1,
    init(e) { for (let i = 0; i < 2; i++) spawnEnemy('halogn', e.x, e.z, { host: e, angle: i * Math.PI }); },
    update(e) {
      const a = e.angleToPlayer() + Math.sin(e.age * 0.7) * 0.8;
      e.vx = Math.cos(a) * e.speed; e.vz = Math.sin(a) * e.speed;
      if (every(e, 'shootT', 3.2) && e.distToPlayer() < 7) e.shoot(e.angleToPlayer(), { speed: 3.8, scale: 1.2 });
    },
    onDeath(e) { for (let i = 0; i < 2; i++) spawnEnemy('gnat', e.x + (i ? 0.3 : -0.3), e.z); } },
  moaner: { name: 'a moaner', r: 0.34, mass: 1, fps: 7,
    update(e) { e.chase(e.speed); } },
  sprinter: { name: 'a sprinter', r: 0.34, mass: 1, fps: 10,
    update(e) { e.chase(e.speed * (e.distToPlayer() < 3 ? 1.25 : 1)); } },
  tusk: { name: 'a tusk', r: 0.42, mass: 2.2, gore: 1.1,
    frame(e) { return e.state === 'charge' ? 2 : Math.floor(e.age * 6) % 2; },
    update(e) {
      if (e.state === 'charge') {
        e.vx = e.cdir[0] * e.cfg.charge; e.vz = e.cdir[1] * e.cfg.charge;
        if (e.t > 0.15 && e.wallHit) { e.state = 'stun'; e.t = 0; e.stop(); addShake(0.15); audio.play('rock'); }
        return;
      }
      if (e.state === 'stun') { e.stop(); if (e.t > 0.7) { e.state = 'idle'; e.t = 0; } return; }
      wander(e, e.speed, 1.2);
      const al = e.aligned(0.5);
      if (al >= 0 && e.t > 0.5 && S.room.lineClear(e.x, e.z, S.player.x, S.player.z, M_WALK)) {
        e.state = 'charge'; e.t = 0; e.cdir = SIDE_VEC[al]; audio.play('roar');
      }
    } },
  pipe: { name: 'a pipe mouth', r: 0.42, mass: 99, stationary: true, gore: 0.9, bloodTint: 0x6a5040, decal: '#3a2a1a',
    frame(e) { return e.windup ? 1 : 0; },
    update(e) {
      e.stop();
      e.windup = e.fireT != null && e.fireT < 0.35;
      if (every(e, 'fireT', e.cfg.fireRate)) { for (let i = 0; i < 4; i++) e.shoot(i * Math.PI / 2, { speed: 4.2 }); e.squashY = 1.25; }
      e.squashY = 1 + ((e.squashY || 1) - 1) * 0.85;
    } },
  wellspout: { name: 'a wellspout', r: 0.45, mass: 99, stationary: true, gore: 0.9, bloodTint: 0x5a7a7a, decal: '#2a3a3a',
    frame(e) { return e.fireT != null && e.fireT < 0.35 ? 1 : 0; },
    update(e) {
      e.stop();
      if (every(e, 'fireT', e.cfg.fireRate)) { e.alt = !e.alt; for (let i = 0; i < 4; i++) e.shoot(i * Math.PI / 2 + (e.alt ? Math.PI / 4 : 0), { speed: 4.4, color: 0x60a0c0 }); }
    } },
  peeper: { name: 'a peeper', r: 0.38, mass: 1.4,
    update(e) {
      wander(e, e.speed, 2);
      if (e.aligned(0.4) >= 0 && every(e, 'shootT', e.cfg.fireRate)) { e.stop(); e.shoot(e.angleToPlayer(), { speed: 5.5 }); }
    } },
  tick: { name: 'a hopping tick', r: 0.3, mass: 0.8, gore: 0.6,
    frame(e) { return e.state === 'air' ? 1 : 0; },
    update(e, dt) { hop(e, dt, { maxDist: 3.2, airTime: 0.45, height: 0.7, rest: 0.35 }); } },
  toadsack: { name: 'a toad sack', r: 0.55, mass: 3, gore: 1.4,
    frame(e) { return e.state === 'air' ? 1 : 0; },
    update(e, dt) { hop(e, dt, { maxDist: 5, airTime: 0.8, height: 2.2, rest: 1.2, onLand: (e) => { e.ring(8, 0, { speed: 4 }); addShake(0.25); audio.play('slam'); } }); } },
  molemite: { name: 'a mole mite', r: 0.36, mass: 99, stationary: true, gore: 0.8,
    frame(e) { return e.state === 'under' ? 0 : e.state === 'emerge' ? 1 : 2; },
    init(e) { e.state = 'under'; e.untargetable = true; e.noContact = true; },
    update(e) {
      e.stop();
      if (e.state === 'under') {
        e.hidden = e.t < 0.4; e.hideShadow = true;
        if (e.t > 1.6) {
          const p = S.player; const room = S.room;
          // pop up near the player
          for (let i = 0; i < 10; i++) {
            const a = e.rng.range(0, TAU), d = e.rng.range(1.8, 3.2);
            const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
            if (x > 0.6 && z > 0.6 && x < room.W - 0.6 && z < room.H - 0.6 && room.isFree(Math.floor(x), Math.floor(z))) { e.x = x; e.z = z; break; }
          }
          e.state = 'emerge'; e.t = 0; e.hidden = false; audio.play('burrow');
        }
      } else if (e.state === 'emerge') {
        if (e.t > 0.35) { e.state = 'up'; e.t = 0; e.untargetable = false; e.noContact = false; e.hideShadow = false; }
      } else if (e.state === 'up') {
        if (e.t > 0.3 && !e.shot) { e.shot = true; e.spread(e.angleToPlayer(), 3, 0.3, { speed: 4.5 }); }
        if (e.t > 1.4) { e.state = 'under'; e.t = 0; e.untargetable = true; e.noContact = true; e.shot = false; audio.play('burrow'); }
      }
    } },
  spider: { name: 'a cellar spider', r: 0.25, mass: 0.5, gore: 0.45, fps: 12,
    update(e) {
      if (e.t > (e.next ?? 0)) {
        const toward = e.rng.chance(0.6);
        const a = toward ? e.angleToPlayer() + e.rng.range(-0.6, 0.6) : e.rng.range(0, TAU);
        e.dir = [Math.cos(a), Math.sin(a)]; e.next = e.t + e.rng.range(0.5, 1.0); e.moveT = e.t + e.rng.range(0.2, 0.35);
      }
      const go = e.t < e.moveT ? e.speed : 0;
      e.vx = e.dir[0] * go; e.vz = e.dir[1] * go;
    } },
  broodsp: { name: 'a brood spider', r: 0.45, mass: 1.6, gore: 1.0, fps: 10,
    update(e) {
      if (e.t > (e.next ?? 0)) {
        const a = e.angleToPlayer() + e.rng.range(-0.8, 0.8);
        e.dir = [Math.cos(a), Math.sin(a)]; e.next = e.t + e.rng.range(0.6, 1.1); e.moveT = e.t + e.rng.range(0.25, 0.4);
      }
      const go = e.t < e.moveT ? e.speed : 0;
      e.vx = e.dir[0] * go; e.vz = e.dir[1] * go;
    },
    onDeath(e) { const n = 2 + (e.rng.chance(0.5) ? 1 : 0); for (let i = 0; i < n; i++) { const s = spawnEnemy('spider', e.x + e.rng.range(-0.3, 0.3), e.z + e.rng.range(-0.3, 0.3)); if (s) s.spawnGrace = 0.2; } } },
  clot: { name: 'a clot', r: 0.45, mass: 1.6, gore: 1.0, fps: 4,
    update(e) { e.chase(e.speed); e.squashX = 1 + Math.sin(e.age * 6) * 0.06; e.squashY = 1 - Math.sin(e.age * 6) * 0.06; },
    onDeath(e) { for (let i = 0; i < 2; i++) { const c = spawnEnemy('clotlet', e.x + (i ? 0.35 : -0.35), e.z, { champion: e.champion }); if (c) { c.kx = (i ? 3 : -3); c.spawnGrace = 0.15; } } } },
  clotlet: { name: 'a clotlet', r: 0.28, mass: 0.8, gore: 0.6, fps: 5,
    update(e) { e.chase(e.speed); } },
  gasbag: { name: 'a gasbag', r: 0.45, flying: true, height: 0.35, mass: 1.5, fps: 3, bloodTint: 0x9aa83a, decal: '#5a6a1a',
    update(e) { const a = e.angleToPlayer(); e.vx = Math.cos(a) * e.speed; e.vz = Math.sin(a) * e.speed; e.squashX = e.squashY = 1 + Math.sin(e.age * 4) * 0.05; },
    onTouchPlayer(e) { e.die({}); },
    onDeath(e) { S.game.explode(e.x, e.z, { radius: 1.4, damage: 20, hurtsPlayer: true, small: false }); } },
  drooler: { name: 'a drooler', r: 0.38, mass: 1.3, fps: 6, bloodTint: 0x8a9a3a, decal: '#4a5a1a',
    update(e) {
      if (e.rng.chance(0.004) || !e.wdir) wander(e, e.speed, 2);
      else e.chase(e.speed);
      if (every(e, 'creepT', 0.45)) creep(e.x, e.z, { color: '#a0b030', size: 0.85, life: 4 });
    } },
  spitter: { name: 'a spitter', r: 0.34, mass: 1, fps: 7,
    update(e) {
      if (e.distToPlayer() > 3.5) e.chase(e.speed); else wander(e, e.speed * 0.7, 1);
      if (every(e, 'shootT', e.cfg.fireRate) && S.room.lineClear(e.x, e.z, S.player.x, S.player.z)) { e.stop(); e.shoot(e.angleToPlayer(), { speed: 5 }); }
    } },
  hive: { name: 'a hive', r: 0.5, mass: 99, stationary: true, gore: 1.0, bloodTint: 0x8a6a3a, decal: '#4a3a1a',
    update(e) {
      e.stop();
      if (every(e, 'spawnT', e.cfg.spawnRate)) {
        const n = S.enemies.filter((o) => o.alive && o.type === 'gnat').length;
        if (n < 4) { const g = spawnEnemy('gnat', e.x, e.z + 0.3); if (g) g.spawnGrace = 0.2; audio.play('spawn'); e.squashY = 1.2; }
      }
      e.squashY = 1 + ((e.squashY || 1) - 1) * 0.9;
    },
    onDeath(e) { spawnEnemy('gnat', e.x, e.z); } },
  draft: { name: 'a draft', r: 0.36, flying: true, height: 0.5, mass: 0.8, noGore: true, gore: 0.8,
    init(e) { e.phasing = true; },
    update(e) {
      const a = e.angleToPlayer() + Math.sin(e.age * 1.3) * 0.6;
      e.vx = Math.cos(a) * e.speed; e.vz = Math.sin(a) * e.speed;
      // fades in and out; can't be hit while faded
      const k = (Math.sin(e.age * 1.4 + e.uid) + 1) / 2;
      e.opacity = 0.2 + k * 0.75;
      e.untargetable = k < 0.18; e.noContact = k < 0.18;
    } },
  wailhead: { name: 'a wailing head', r: 0.42, flying: true, height: 0.55, mass: 1.4,
    frame(e) { return e.fireT != null && e.fireT < 0.4 ? 1 : 0; },
    update(e) {
      const d = e.distToPlayer();
      const a = e.angleToPlayer() + (d < 3.5 ? Math.PI : 0) + Math.sin(e.age) * 0.5;
      e.vx = Math.cos(a) * e.speed; e.vz = Math.sin(a) * e.speed;
      if (every(e, 'fireT', e.cfg.fireRate)) e.spread(e.angleToPlayer(), 3, 0.28, { speed: 4.2 });
    } },
  grub: { name: 'a grub', r: 0.32, mass: 1, fps: 4, bloodTint: 0xd8c8a8, decal: '#8a7a50',
    update(e) { wander(e, e.speed, 2.5); } },
  leech: { name: 'a leech', r: 0.3, mass: 0.8, fps: 10,
    update(e) {
      if (!e.dir || e.t > e.next || e.wallHit) {
        const p = S.player;
        const dx = p.x - e.x, dz = p.z - e.z;
        e.dir = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
        if (e.wallHit && e.rng.chance(0.5)) e.dir = [e.dir[1], e.dir[0]];
        e.next = e.t + e.rng.range(0.5, 1.0);
      }
      e.vx = e.dir[0] * e.speed; e.vz = e.dir[1] * e.speed;
    } },
  shellback: { name: 'a shellback', r: 0.45, mass: 3, gore: 1.1,
    update(e) {
      if (!e.dir || e.t > e.next) {
        const p = S.player; const dx = p.x - e.x, dz = p.z - e.z;
        e.dir = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
        e.next = e.t + e.rng.range(1.0, 1.8);
      }
      e.vx = e.dir[0] * e.speed; e.vz = e.dir[1] * e.speed;
      if (e.dir[0]) e.face = e.dir[0];
    },
    // the shield blocks tears coming at its front
    blockHit(e, info) {
      if (!info.tear || !e.dir) return false;
      const t = info.tear; const sp = Math.hypot(t.vx, t.vz) || 1;
      const dot = (t.vx / sp) * e.dir[0] + (t.vz / sp) * e.dir[1];
      return dot < -0.5;
    } },
  bonethrow: { name: 'a bone thrower', r: 0.34, mass: 1, noGore: false, bloodTint: 0xe6dcc4, decal: '#5a5040',
    frame(e) { return e.throwT != null && e.throwT < 0.3 ? 2 : Math.floor(e.age * 5) % 2; },
    update(e) {
      wander(e, e.speed, 1.8);
      if (every(e, 'throwT', e.cfg.fireRate)) {
        const p = S.player, d = e.distToPlayer();
        const a = e.angleToPlayer();
        const sp = Math.min(6, d / 0.9);
        const t = e.shoot(a, { speed: sp, lob: 7, height: 0.6, style: 'tooth', color: 0xe6dcc4, scale: 1.2, range: 30 });
        if (t) t.onLand = (t) => { for (let i = 0; i < 4; i++) enemyShot(e, i * Math.PI / 2 + Math.PI / 4, { x: t.x, z: t.z, speed: 3.2, scale: 0.8, color: 0xe6dcc4, style: 'tooth' }); };
      }
    } },
  ember: { name: 'an ember', r: 0.3, flying: true, height: 0.45, mass: 0.6, noGore: true, gore: 0.6, fps: 10,
    update(e) {
      const a = e.angleToPlayer() + Math.sin(e.age * 2 + e.uid) * 0.7;
      e.vx = Math.cos(a) * e.speed; e.vz = Math.sin(a) * e.speed;
      if (every(e, 'trailT', 0.6)) creep(e.x, e.z, { color: '#ff7a1a', size: 0.6, life: 1.8 });
    },
    onDeath(e) { for (let i = 0; i < 4; i++) e.shoot(i * Math.PI / 2 + Math.PI / 4, { speed: 4, color: 0xff8a2a }); particles(e.x, e.z, { count: 8, kind: 'spark', color: 0xff9a3a, speed: 3, up: 3, life: 0.5, size: 0.25 }); } },
  nun: { name: 'a hollow nun', r: 0.4, mass: 2, noGore: false, gore: 1,
    frame(e) { return e.state === 'cast' ? 1 : 0; },
    update(e) {
      e.stop();
      if (e.state === 'idle' && e.t > 1.4) { e.state = 'cast'; e.t = 0; }
      else if (e.state === 'cast') {
        if (e.t > 0.5 && !e.cast) { e.cast = true; e.ring(8, e.rng.range(0, 1), { speed: 3.6, color: 0x8a3ab0 }); }
        if (e.t > 0.9) { e.state = 'fade'; e.t = 0; e.cast = false; }
      } else if (e.state === 'fade') {
        e.opacity = 1 - e.t / 0.4; e.untargetable = true; e.noContact = true;
        if (e.t > 0.4) { const pos = S.room.randomFree(e.rng, 1); e.x = pos.x; e.z = pos.z; e.state = 'appear'; e.t = 0; }
      } else if (e.state === 'appear') {
        e.opacity = e.t / 0.4;
        if (e.t > 0.4) { e.opacity = 1; e.untargetable = false; e.noContact = false; e.state = 'idle'; e.t = 0; }
      }
    } },
  nightcrawl: { name: 'a night crawler', r: 0.36, mass: 99, stationary: true,
    frame(e) { return e.state === 'under' ? 0 : e.state === 'rise' ? 1 : 2; },
    init(e) { e.state = 'under'; e.untargetable = true; e.noContact = true; },
    update(e) {
      e.stop();
      if (e.state === 'under') {
        // tunnel toward the player
        const a = e.angleToPlayer(); e.vx = Math.cos(a) * e.speed; e.vz = Math.sin(a) * e.speed;
        e.hidden = false; e.noCollide = false;
        if (e.t > 1.6 && e.distToPlayer() < 1.6 || e.t > 3.2) { e.state = 'rise'; e.t = 0; e.stop(); audio.play('burrow'); }
      } else if (e.state === 'rise') {
        if (e.t > 0.45) { e.state = 'up'; e.t = 0; e.untargetable = false; e.noContact = false; addShake(0.1); }
      } else if (e.state === 'up') {
        if (e.t > 1.3) { e.state = 'under'; e.t = 0; e.untargetable = true; e.noContact = true; }
      }
    } },
  kilnimp: { name: 'a kiln imp', r: 0.34, mass: 1, fps: 8,
    update(e) {
      if (!e.dir || e.t > e.next || e.wallHit) {
        const a = e.angleToPlayer() + (e.rng.chance(0.5) ? 1 : -1) * e.rng.range(0.6, 1.2);
        e.dir = [Math.cos(a), Math.sin(a)]; e.next = e.t + e.rng.range(0.6, 1.1);
      }
      e.vx = e.dir[0] * e.speed; e.vz = e.dir[1] * e.speed;
      if (every(e, 'fireT', 2.2)) e.shoot(e.angleToPlayer(), { speed: 5.2, color: 0xff8a2a, scale: 1.2 });
    } },
};
