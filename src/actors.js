import * as THREE from 'three';
import { CELL, FLOOR, ROOMS, roomAt, toCell } from './map.js';
import { makeFigure } from './characters.js';

// What each body can do. view: sight range (m); fov: cosine of the half-angle of the vision cone; decay: seconds a host lasts.
export const SPECS = {
  worm: { body: 'worm', role: null, walk: 2.7, run: 4.8, r: 0.22, hp: 30, eye: 0.3, decay: 0 },
  guard: { body: 'human', role: 'guard', walk: 2.0, run: 4.3, r: 0.32, hp: 100, eye: 1.68, view: 12, fov: Math.cos(0.9), decay: 75, label: 'GUARD' },
  scientist: { body: 'human', role: 'scientist', walk: 2.1, run: 4.5, r: 0.3, hp: 60, eye: 1.68, view: 10, fov: Math.cos(0.9), decay: 90, label: 'SCIENTIST' },
  bot: { body: 'bot', role: 'bot', walk: 1.6, run: 2.3, r: 0.4, hp: 90, eye: 0.9, view: 0, fov: 1, decay: 110, label: 'MAINTENANCE BOT' },
};

const _v = new THREE.Vector3();
let nextId = 1;

export class Actor {
  constructor(type, scene, cx, cy, home) {
    this.id = nextId++;
    this.type = type;
    this.spec = SPECS[type];
    this.body = this.spec.body;
    this.role = this.spec.role;
    this.pos = new THREE.Vector3(cx * CELL + CELL / 2, 0, cy * CELL + CELL / 2);
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.hp = this.spec.hp;
    this.alive = true;
    this.player = false;          // controlled by the parasite
    this.possessed = 0;           // 0..1 how far gone the host is (drives the green glow)
    this.decay = this.spec.decay;
    this.home = home;
    this.fig = makeFigure(type, scene);
    if (type !== 'worm') scene.add(this.fig.root);
    this.pose = { speed: 0, t: 0 };
    // brain
    this.state = 'patrol';
    this.susp = 0;
    this.wait = Math.random() * 2;
    this.path = null;
    this.goal = null;
    this.lastSeen = new THREE.Vector3();
    this.unseen = 0;
    this.aimT = 0;
    this.fireT = 0;
    this.stateT = 0;
    this.found = false;           // as a body: already reported
    this.look = 0;
    this.recoil = 0;
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  forward(out) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  eyePos(out) { return out.set(this.pos.x, this.spec.eye, this.pos.z); }

  // steer toward a world point; returns true on arrival
  steer(dt, world, tx, tz, speed) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { this.vel.multiplyScalar(Math.max(0, 1 - dt * 10)); return true; }
    const vx = (dx / d) * speed, vz = (dz / d) * speed;
    this.vel.x += (vx - this.vel.x) * Math.min(1, dt * 8);
    this.vel.z += (vz - this.vel.z) * Math.min(1, dt * 8);
    this.turnTo(Math.atan2(dx, dz), dt, 8);
    return false;
  }
  turnTo(yaw, dt, rate) {
    let d = yaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * rate);
  }
  // follow the current path; returns true when done
  follow(dt, world, speed) {
    if (!this.path || !this.path.length) return true;
    const p = this.path[0];
    const last = this.path.length === 1;
    if (this.steer(dt, world, p.x, p.z, speed) || (!last && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 0.6)) this.path.shift();
    return !this.path.length;
  }
  goTo(world, x, z) { this.path = world.path(this.pos.x, this.pos.z, x, z, this.body, this.role); this.goal = this.path ? { x, z } : null; return !!this.path; }

  integrate(dt, world) {
    if (!this.alive) { this.vel.set(0, 0, 0); return; }
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    world.collide(this.pos, this.spec.r, this.body, this.role);
  }

  hurt(dmg, game, from) {
    if (!this.alive) return;
    this.hp -= dmg;
    game.fx.sparks(_v.set(this.pos.x, this.spec.eye * 0.75, this.pos.z), this.body === 'bot' ? 0xffd040 : 0xff4a3a, 10);
    if (this.hp <= 0) game.kill(this, from);
    else if (!this.player && this.alive) { this.susp = 1; this.lastSeen.copy(from ? from.pos : this.pos); this.alert(game, from); }
  }

  alert(game, target) {
    if (this.role === 'bot' || this.player) return;
    if (this.role === 'guard') this.setState('attack');
    else if (this.role === 'scientist') this.setState('flee');
    if (target && target.player) game.flag(target, this);
  }

  setState(s) { if (this.state !== s) { this.state = s; this.stateT = 0; this.path = null; this.aimT = 0; } }

  // ---- NPC brain -----------------------------------------------------------------------------------------------------
  think(dt, game) {
    if (!this.alive || this.player) return;
    const { world } = game;
    this.stateT += dt;
    this.fireT -= dt;
    if (this.role === 'bot') return this.botThink(dt, game);

    // perception of the parasite's current body
    const tgt = game.player.body;
    const sees = tgt && tgt.alive && this.canSee(tgt, world, game);
    if (sees) {
      this.lastSeen.copy(tgt.pos); this.unseen = 0;
      const d = this.pos.distanceTo(tgt.pos), prox = THREE.MathUtils.clamp(1 - d / this.spec.view, 0.25, 1);
      let rate = 0, instant = false;
      const why = game.player.suspicion(tgt, this);
      if (why.instant) instant = true;
      rate += why.rate * prox;
      if (instant) this.susp = 1;
      else this.susp = Math.min(1, this.susp + rate * dt);
      if (this.susp >= 1 && this.state !== 'attack' && this.state !== 'flee') this.alert(game, tgt);
      else if (this.susp > 0.2 && (this.state === 'patrol' || this.state === 'investigate')) this.setState('suspicious');
    } else {
      this.unseen += dt;
      if (this.state !== 'attack' && this.state !== 'flee') this.susp = Math.max(0, this.susp - dt * 0.18);
    }

    // bodies on the floor
    if (this.state === 'patrol' || this.state === 'suspicious' || this.state === 'hunt') {
      for (const b of game.actors) {
        if (b.alive || b.found || b === this || b.type === 'worm') continue;
        if (this.pos.distanceTo(b.pos) < this.spec.view && this.inCone(b.pos) && world.sight(this.pos.x, this.pos.z, b.pos.x, b.pos.z)) {
          b.found = true; this.bodyAt = b; this.setState('body'); this.goTo(world, b.pos.x, b.pos.z);
          game.hud.bark(this, '!');
          break;
        }
      }
    }

    const walk = this.spec.walk, run = this.spec.run;
    switch (this.state) {
      case 'patrol': {
        if (game.alarm > 0 && this.role === 'guard') { this.setState('hunt'); break; }
        if (this.path && this.path.length) { this.follow(dt, world, walk * 0.75); break; }
        this.vel.multiplyScalar(Math.max(0, 1 - dt * 8));
        this.wait -= dt;
        this.look = Math.sin(this.stateT * 0.9) * 0.6;
        if (this.wait <= 0) {
          const c = randomCellIn(this.home, game);
          if (c) this.goTo(world, c.x, c.z);
          this.wait = 1.5 + Math.random() * 3;
        }
        break;
      }
      case 'suspicious': {
        // stop and stare; if it keeps up, wander over to look
        this.look = 0;
        if (sees) { this.vel.multiplyScalar(Math.max(0, 1 - dt * 8)); this.turnTo(Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z), dt, 5); }
        else if (this.stateT > 1) {
          if (!this.path) this.goTo(world, this.lastSeen.x, this.lastSeen.z);
          if (this.follow(dt, world, walk * 0.7)) this.vel.multiplyScalar(0.8);
        }
        if (this.susp <= 0.02) this.setState('patrol');
        break;
      }
      case 'investigate': {
        if (this.path && this.path.length) this.follow(dt, world, walk);
        else { this.vel.multiplyScalar(0.8); this.look = Math.sin(this.stateT * 2) * 1.1; }
        if (this.stateT > 9) this.setState(game.alarm > 0 && this.role === 'guard' ? 'hunt' : 'patrol');
        break;
      }
      case 'body': {
        // walk to the body, crouch-stare, then raise the alarm
        const b = this.bodyAt;
        const close = b && this.pos.distanceTo(b.pos) < 2.2;
        if (!close && this.path && this.path.length) this.follow(dt, world, run * 0.8);
        else this.vel.multiplyScalar(0.8);
        if (close || this.stateT > 4) {
          if (this.stateT > 1.2) { game.raiseAlarm(null, this); this.setState(this.role === 'guard' ? 'hunt' : 'flee'); }
        }
        break;
      }
      case 'attack': {
        this.look = 0;
        const target = sees ? tgt : null;
        if (target) {
          const d = this.pos.distanceTo(target.pos);
          this.turnTo(Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z), dt, 10);
          this.aimT += dt;
          // hold distance: close in when far, stand when in range
          if (d > 7) this.steer(dt, world, target.pos.x, target.pos.z, walk * 1.2);
          else this.vel.multiplyScalar(Math.max(0, 1 - dt * 8));
          if (this.aimT > 0.6 && this.fireT <= 0) { game.npcShoot(this, target); this.fireT = 0.55 + Math.random() * 0.25; }
          this.path = null;
        } else {
          this.aimT = Math.max(0, this.aimT - dt * 2);
          if (!this.path) this.goTo(world, this.lastSeen.x, this.lastSeen.z);
          if (this.follow(dt, world, run * 0.85)) this.look = Math.sin(this.stateT * 3) * 1.2;
          if (this.unseen > 7) { this.susp = 0.5; this.setState(game.alarm > 0 ? 'hunt' : 'investigate'); this.goTo(world, this.lastSeen.x, this.lastSeen.z); }
        }
        break;
      }
      case 'hunt': {
        // alarm: sweep toward wherever the intruder was last reported
        if (game.alarm <= 0) { this.setState('patrol'); break; }
        const w = game.wanted;
        if (sees && w && tgt === w) { this.alert(game, tgt); break; }
        if (!this.path || this.stateT > 3) {
          const at = w && w.alive ? w.pos : game.alarmAt;
          if (at) { this.goTo(world, at.x + (Math.random() - 0.5) * 4, at.z + (Math.random() - 0.5) * 4); }
          this.stateT = 0;
        }
        this.follow(dt, world, run * 0.75);
        break;
      }
      case 'flee': {
        // scientists run for the nearest guard and raise the alarm
        this.replan = (this.replan || 0) - dt;
        if (!this.path || this.replan <= 0) {
          let best = null, bd = 1e9;
          for (const a of game.actors) if (a.alive && !a.player && a.role === 'guard') { const d = a.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = a; } }
          if (best) this.goTo(world, best.pos.x, best.pos.z);
          this.replan = 2.5;
        }
        if (this.stateT > 2.5 && !this.raised) { this.raised = true; game.raiseAlarm(game.wanted, this); }
        this.follow(dt, world, run);
        if (this.raised && game.alarm <= 0) { this.raised = false; this.susp = 0; this.setState('patrol'); }
        break;
      }
    }
  }

  botThink(dt, game) {
    // maintenance bots trundle between tasks in their room and notice nothing
    if (this.path && this.path.length) { this.follow(dt, game.world, this.spec.walk * 0.7); return; }
    this.vel.multiplyScalar(0.8);
    this.wait -= dt;
    if (this.wait <= 0) { const c = randomCellIn(this.home, game); if (c) this.goTo(game.world, c.x, c.z); this.wait = 2 + Math.random() * 4; }
  }

  inCone(p) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
    const yaw = this.yaw + this.look;
    return (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d > this.spec.fov || d < 1.2;
  }
  canSee(t, world, game) {
    if (!this.spec.view) return false;
    const d = this.pos.distanceTo(t.pos);
    let range = this.spec.view * (game.alarm > 0 ? 1.25 : 1);
    if (t.body === 'worm') range *= 0.7;      // small and low to the ground
    if (d > range || !this.inCone(t.pos)) return false;
    return world.sight(this.pos.x, this.pos.z, t.pos.x, t.pos.z);
  }

  animate(dt, t, extra = {}) {
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 8);
    const p = this.pose;
    p.speed = this.speed; p.t = t; p.dead = !this.alive; p.look = this.look;
    p.possessed = this.player ? Math.max(0.15, this.possessed) : 0;
    p.aim = extra.aim ?? (this.state === 'attack' && this.aimT > 0 ? Math.min(1, this.aimT * 3) : 0);
    p.aimPitch = extra.aimPitch || 0;
    p.recoil = this.recoil;
    p.struggle = extra.struggle || 0;
    p.alarmed = this.state === 'attack';
    if (this.type === 'worm') { p.pos = this.pos; p.yaw = this.yaw; p.air = extra.air || 0; }
    else { this.fig.root.position.copy(this.pos); this.fig.root.rotation.y = this.yaw; }
    this.fig.update(dt, p);
  }
}

// a random open floor cell inside a room (for patrols)
export function randomCellIn(roomId, game) {
  const r = ROOMS.find((q) => q.id === roomId);
  if (!r) return null;
  for (let i = 0; i < 20; i++) {
    const cx = r.x0 + Math.floor(Math.random() * (r.x1 - r.x0 + 1)), cy = r.y0 + Math.floor(Math.random() * (r.y1 - r.y0 + 1));
    if (game.world.kind(cx, cy) === FLOOR && game.world.kind(cx + 1, cy) !== 0 && game.world.kind(cx - 1, cy) !== 0) return { x: cx * CELL + CELL / 2, z: cy * CELL + CELL / 2 };
  }
  return null;
}

export { roomAt, toCell };
