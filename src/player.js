import * as THREE from 'three';
import { CELL, GATE, POD, ROOMS, roomAt, toCell } from './map.js';
import { WALL_H } from './world.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const WORM_LIFE = 45;       // seconds the worm survives outside a host
const LEAP_RANGE = 5;
const LEAP_TIME = 0.45, STRUGGLE_TIME = 1.1;

// The parasite: owns the worm, the current host, possession, and the third-person camera.
export class Player {
  constructor(game, worm) {
    this.game = game;
    this.worm = worm;
    worm.player = true;
    this.host = null;
    this.phase = 'free';      // free | leap | struggle | dead | won
    this.phaseT = 0;
    this.life = WORM_LIFE;
    this.yaw = Math.PI * 0.6;
    this.pitch = 0.5;
    this.camDist = 3.4;
    this.camPos = new THREE.Vector3();
    this.target = null;       // leap candidate
    this.shotT = 9;           // seconds since the host last fired
    this.fireCD = 0;
    this.hosts = 0;
    this.lastRoom = null;
    this.inGate = false;
  }

  get body() { return this.host || this.worm; }

  // what the crew make of what they see this body doing (rate per second, or instant)
  suspicion(b, viewer) {
    if (b.body === 'worm') return { rate: 1.7, instant: this.phase === 'leap' };
    if (this.phase === 'struggle' && b === this.leapTarget) return { instant: true };
    if (b === this.game.wanted) return { instant: true };
    if (this.shotT < 0.6) return { instant: true };
    let rate = 0;
    if (b.speed > b.spec.walk * 1.25) rate += 0.55;                       // running
    const r = roomAt(toCell(b.pos.x), toCell(b.pos.z));
    if (r && r.restricted && r.restricted.includes(b.role)) rate += 0.5;  // somewhere this role should not be
    if (b.possessed > 0.7) rate += 0.6 * (b.possessed - 0.7) / 0.3 + 0.2; // the host is visibly rotting
    if (b.role === 'bot') rate *= 0.3;
    return { rate, instant: false };
  }

  update(dt, input) {
    const g = this.game, world = g.world;
    this.phaseT += dt;
    this.shotT += dt;
    this.fireCD -= dt;
    const look = input.takeLook();
    this.yaw -= look.x; this.pitch = THREE.MathUtils.clamp(this.pitch + look.y, -0.25, 1.15);
    if (this.phase === 'dead' || this.phase === 'won') { this.vel0(); return; }

    // timers: the host rots, the worm dries out
    if (this.host) {
      this.host.decay -= dt;
      this.host.possessed = 1 - this.host.decay / this.host.spec.decay;
      if (this.host.decay <= 0) { g.hud.toast('THE HOST GAVE OUT'); this.eject(true); }
    } else if (this.phase === 'free') {
      this.life -= dt;
      if (this.life <= 0) return g.lose('YOU DRIED OUT');
    }

    if (this.phase === 'leap') return this.updateLeap(dt);
    if (this.phase === 'struggle') return this.updateStruggle(dt);

    // movement relative to the camera
    const b = this.body;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const mx = input.move.x, my = input.move.y, mag = Math.min(1, Math.hypot(mx, my));
    const run = input.run && mag > 0.1;
    const speed = (run ? b.spec.run : b.spec.walk) * mag;
    // camera right is (-fz, fx) when forward is (fx, fz)... with yaw measured from +z
    const dx = fx * my - fz * mx, dz = fz * my + fx * mx, dl = Math.hypot(dx, dz) || 1;
    const vx = (dx / dl) * speed, vz = (dz / dl) * speed;
    b.vel.x += (vx - b.vel.x) * Math.min(1, dt * 12);
    b.vel.z += (vz - b.vel.z) * Math.min(1, dt * 12);
    const aiming = this.host && this.host.role === 'guard' && (input.held('fire') || this.shotT < 0.8);
    if (aiming) b.turnTo(this.yaw, dt, 16);
    else if (mag > 0.1) b.turnTo(Math.atan2(dx, dz), dt, 12);

    // leap candidates: unaware crew within reach, roughly ahead
    this.target = this.findTarget();
    if (input.pressed('use') && this.target) this.startLeap(this.target);
    else if (input.pressed('leave') && this.host) this.eject(false);

    if (aiming && input.held('fire') && this.fireCD <= 0) this.fire();

    // scanner: anything but a bot walking through it is reported
    const cell = world.kind(toCell(b.pos.x), toCell(b.pos.z));
    if (cell === GATE) { if (!this.inGate && b.role !== 'bot') { g.fx.flashGate(); g.raiseAlarm(b, null, 'SCANNER TRIPPED'); } this.inGate = true; }
    else this.inGate = false;
    if (world.pod && Math.hypot(b.pos.x - world.pod.x, b.pos.z - world.pod.z) < 1.6) g.win();

    // room name when entering
    const r = roomAt(toCell(b.pos.x), toCell(b.pos.z));
    if (r && r !== this.lastRoom) { this.lastRoom = r; g.hud.room(r.name); }
  }

  vel0() { this.body.vel.multiplyScalar(0.8); }

  findTarget() {
    const b = this.body, g = this.game;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let best = null, bs = 1e9;
    for (const a of g.actors) {
      if (!a.alive || a.player || a.type === 'worm') continue;
      const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z, d = Math.hypot(dx, dz);
      if (d > LEAP_RANGE || d < 0.1) continue;
      const ahead = (dx * fx + dz * fz) / d;
      if (ahead < 0.35) continue;
      if (!g.world.sight(b.pos.x, b.pos.z, a.pos.x, a.pos.z)) continue;
      // a crew member who is aiming at you will swat you out of the air
      if (a.state === 'attack' && a.canSee(b, g.world, g)) continue;
      const score = d * (1.6 - ahead);
      if (score < bs) { bs = score; best = a; }
    }
    return best;
  }

  startLeap(a) {
    const g = this.game;
    if (this.host) {
      // burst out of the current host: it drops dead
      const old = this.host;
      this.worm.pos.copy(old.pos).y = 0;
      this.worm.pos.x += Math.sin(old.yaw) * 0.4; this.worm.pos.z += Math.cos(old.yaw) * 0.4;
      this.release(old);
    }
    this.phase = 'leap'; this.phaseT = 0;
    this.leapFrom = this.worm.pos.clone();
    this.leapTarget = a;
    this.worm.fig.root.visible = true;
    g.audio.leap();
  }

  updateLeap(dt) {
    const a = this.leapTarget, w = this.worm, k = Math.min(1, this.phaseT / LEAP_TIME);
    if (!a.alive) { this.phase = 'free'; return; }
    // land on the back of the neck
    _v.set(a.pos.x - Math.sin(a.yaw) * 0.15, 0, a.pos.z - Math.cos(a.yaw) * 0.15);
    w.pos.lerpVectors(this.leapFrom, _v, k);
    w.yaw = Math.atan2(_v.x - this.leapFrom.x, _v.z - this.leapFrom.z);
    this.air = Math.sin(Math.PI * k) * 1.1 + k * (a.spec.eye - 0.2);
    a.vel.multiplyScalar(0.5);
    if (k >= 1) {
      this.phase = 'struggle'; this.phaseT = 0;
      a.state = 'possessing'; a.path = null;
      this.game.audio.struggle();
    }
  }

  updateStruggle(dt) {
    const a = this.leapTarget, w = this.worm;
    a.vel.set(0, 0, 0);
    w.pos.set(a.pos.x - Math.sin(a.yaw) * 0.12, 0, a.pos.z - Math.cos(a.yaw) * 0.12);
    w.yaw = a.yaw;
    this.air = a.spec.eye - 0.15 - (this.phaseT / STRUGGLE_TIME) * 0.4;
    if (this.phaseT >= STRUGGLE_TIME) this.possess(a);
  }

  possess(a) {
    const g = this.game;
    this.host = a;
    a.player = true; a.state = 'possessed'; a.susp = 0; a.path = null;
    a.decay = a.spec.decay; a.possessed = 0;
    this.worm.fig.root.visible = false;
    this.phase = 'free'; this.phaseT = 0;
    this.life = WORM_LIFE;
    this.hosts++;
    if (g.wanted && g.wanted !== a) g.hud.toast('NEW FACE — THEY ARE LOOKING FOR SOMEONE ELSE');
    g.hud.possessed(a);
    g.audio.possess();
    this.yaw = a.yaw;
  }

  // leave the host: it does not survive
  release(old) {
    const g = this.game;
    old.player = false;
    this.host = null;
    g.kill(old, null, true);
  }

  eject(dead) {
    const old = this.host;
    if (!old) return;
    this.worm.pos.set(old.pos.x - Math.sin(old.yaw) * 0.7, 0, old.pos.z - Math.cos(old.yaw) * 0.7);
    this.game.world.collide(this.worm.pos, this.worm.spec.r, 'worm', null);
    this.worm.fig.reset(this.worm.pos);
    this.worm.fig.root.visible = true;
    this.worm.hp = this.worm.spec.hp;
    this.release(old);
    this.phase = 'free';
    this.game.audio.eject();
    this.game.hud.possessed(null);
  }

  // the host was killed under us
  hostDied() {
    if (!this.host) return;
    this.eject(true);
    this.game.hud.toast('YOUR HOST WAS KILLED');
  }

  fire() {
    const g = this.game, h = this.host;
    this.fireCD = 0.3; this.shotT = 0; h.recoil = 1;
    const from = h.fig.muzzle(_v).clone();
    const cp = Math.cos(this.pitch * 0.6);
    const dir = _w.set(Math.sin(this.yaw) * cp, -Math.sin(this.pitch * 0.6 - 0.12), Math.cos(this.yaw) * cp).normalize().clone();
    g.hitscan(h, from, dir, 50);
    g.noise(h.pos, 18);
    g.audio.shot();
  }

  // third-person camera: orbit behind the body, pulled in by walls
  updateCamera(camera, dt) {
    const b = this.body;
    const worm = !this.host;
    const height = worm ? 0.9 : b.fig.height * 0.92;
    const dist = worm ? 3.4 : this.host.role === 'bot' ? 3.8 : 4.0;
    this.camDist += (dist - this.camDist) * Math.min(1, dt * 4);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const air = (this.phase === 'leap' || this.phase === 'struggle') ? (this.air || 0) * 0.6 : 0;
    const pivot = _v.set(b.pos.x, height + air, b.pos.z);
    const shoulder = worm ? 0 : 0.45;
    pivot.x += -fz * shoulder; pivot.z += fx * shoulder;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const back = _w.set(-fx * cp, sp, -fz * cp);
    // march outward; stop short of walls below the wall tops
    let d = this.camDist;
    const world = this.game.world;
    for (let s = 0.2; s <= this.camDist; s += 0.1) {
      const x = pivot.x + back.x * s, y = pivot.y + back.y * s, z = pivot.z + back.z * s;
      const cx = toCell(x), cz = toCell(z), k = world.kind(cx, cz);
      const top = world.crateSet.has(cz * 40 + cx) ? 2.2 : WALL_H + 0.3;   // crates are only waist-high stacks
      if (y < top && k !== 3 && k !== 4 && !world.open(cx, cz, 'human', 'guard')) { d = Math.max(0.3, s - 0.35); break; }
      if (y < 0.15) { d = s; break; }
    }
    const want = new THREE.Vector3(pivot.x + back.x * d, pivot.y + back.y * d, pivot.z + back.z * d);
    if (this.camPos.lengthSq() === 0) this.camPos.copy(want);
    this.camPos.lerp(want, Math.min(1, dt * 14));
    camera.position.copy(this.camPos);
    camera.lookAt(pivot.x + fx * 2, pivot.y + 0.1 - sp * 0.6, pivot.z + fz * 2);
  }
}

export { WORM_LIFE, ROOMS, CELL, POD };
