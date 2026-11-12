import * as THREE from 'three';
import { buildMap, CELL, W, H, WALL, VENT, DOOR, LABDOOR, toCell } from './map.js';
import { World, WALL_H } from './world.js';
import { Actor } from './actors.js';
import { Player } from './player.js';
import { FX } from './fx.js';

const ALARM_TIME = 40;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), RED = new THREE.Color(1, 0.12, 0.08);

// One run on the deck: owns the scene, the actors and the rules (alarm, shooting, noise, winning and losing).
export class Game {
  constructor({ renderer, input, hud, audio, onEnd }) {
    this.renderer = renderer; this.input = input; this.hud = hud; this.audio = audio; this.onEnd = onEnd;
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 120);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e13);
    this.scene.fog = new THREE.Fog(0x0a0e13, 22, 60);
    this.scene.add(new THREE.HemisphereLight(0xa8bccf, 0x232833, 1.5));
    const sun = new THREE.DirectionalLight(0xcfd8ff, 0.5); sun.position.set(20, 40, 10); this.scene.add(sun);
    this.fx = new FX(this.scene);
    const map = buildMap();
    this.world = new World(this.scene, map);
    this.actors = [];
    const worm = new Actor('worm', this.scene, ...map.spawns.worm, null);
    worm.yaw = Math.PI * 0.6;
    this.actors.push(worm);
    for (const n of map.spawns.npcs) this.actors.push(new Actor(n.type, this.scene, n.at[0], n.at[1], n.room));
    this.player = new Player(this, worm);
    this.turret = this.makeTurret(map.spawns.turret);
    this.alarm = 0; this.alarmAt = null; this.wanted = null; this.alarms = 0;
    this.t = 0; this.time = 0;
    this.state = 'menu';
    this.roomBase = this.world.group.children.filter((o) => o.isPointLight).map((l) => ({ l, c: l.color.clone(), i: l.intensity }));
    if (new URLSearchParams(location.search).has('debug')) window.__g = this;
  }

  dispose() {
    this.scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose(); }); });
  }

  // ---- rules --------------------------------------------------------------------------------------------------------
  kill(a, from, silent) {
    if (!a.alive) return;
    a.alive = false; a.hp = 0; a.vel.set(0, 0, 0); a.state = 'dead'; a.found = false;
    this.fx.hideLaser(a.id);
    if (a === this.player.worm) return this.lose('THE PARASITE WAS KILLED');
    if (a === this.player.host && !silent) this.player.hostDied();
    if (a === this.wanted) this.wanted = null;
    if (!silent && a.role !== 'bot') this.audio.hit();
  }

  flag(target, by) {
    if (target === this.player.body) this.wanted = target;
  }

  raiseAlarm(wanted, by, msg) {
    if (wanted && wanted === this.player.body) this.wanted = wanted;
    const fresh = this.alarm <= 0;
    this.alarm = ALARM_TIME;
    this.alarmAt = (wanted ? wanted.pos : by ? by.pos : this.player.body.pos).clone();
    if (fresh) { this.alarms++; this.audio.alarm(); this.hud.toast(msg || 'ALARM RAISED'); }
  }

  noise(pos, radius) {
    for (const a of this.actors) {
      if (!a.alive || a.player || a.role === 'bot' || a.type === 'worm') continue;
      if (a.state === 'attack' || a.state === 'flee' || a.state === 'possessing') continue;
      if (a.pos.distanceTo(pos) > radius) continue;
      a.susp = Math.max(a.susp, 0.5);
      a.setState('investigate');
      a.goTo(this.world, pos.x, pos.z);
    }
  }

  // player shots: march the ray through walls, crew and the turret
  hitscan(shooter, from, dir, dmg) {
    const p = _a.copy(from);
    let hit = null, hitTurret = false;
    for (let s = 0; s < 32; s += 0.15) {
      p.copy(from).addScaledVector(dir, s);
      if (p.y < 0) break;
      const k = this.world.kind(toCell(p.x), toCell(p.z));
      if (p.y < WALL_H && (k === WALL || k === VENT || ((k === DOOR || k === LABDOOR) && (this.world.door(toCell(p.x), toCell(p.z))?.open ?? 0) < 0.6))) break;
      for (const a of this.actors) {
        if (!a.alive || a === shooter || a.type === 'worm') continue;
        if (p.y < a.fig.height && Math.hypot(p.x - a.pos.x, p.z - a.pos.z) < a.spec.r + 0.12) { hit = a; break; }
      }
      const tu = this.turret;
      if (tu.alive && p.y < 2.3 && Math.hypot(p.x - tu.x, p.z - tu.z) < 0.55) hitTurret = true;
      if (hit || hitTurret) break;
    }
    this.fx.tracer(from, p);
    if (hit) hit.hurt(dmg, this, shooter);
    else if (hitTurret) this.hurtTurret(1);
    else this.fx.sparks(p, 0xffd27a, 5);
  }

  npcShoot(npc, target) {
    const d = npc.pos.distanceTo(target.pos);
    let acc = 0.85 - d * 0.035;
    if (target.speed > 3) acc -= 0.15;
    if (target.body === 'worm') acc -= 0.2;
    acc = THREE.MathUtils.clamp(acc, 0.2, 0.9);
    npc.recoil = 1;
    const from = npc.fig.muzzle(_a).clone();
    const to = _b.set(target.pos.x, target.fig.height * 0.6, target.pos.z);
    if (Math.random() < acc) {
      this.fx.tracer(from, to, 0xff7a5a);
      this.damagePlayerBody(target, target.body === 'worm' ? 10 : 14, npc);
    } else {
      to.x += (Math.random() - 0.5) * 2.5; to.y += Math.random() * 0.8; to.z += (Math.random() - 0.5) * 2.5;
      this.fx.tracer(from, to, 0xff7a5a);
    }
    this.audio.enemyShot();
  }

  damagePlayerBody(target, dmg, from) {
    if (target.player || target === this.player.worm) { this.hud.hurt(); this.audio.hit(); }
    target.hurt(dmg, this, from);
  }

  // ---- the turret guarding the scanner exit -------------------------------------------------------------------------
  makeTurret({ at, facing }) {
    const x = at[0] * CELL + CELL / 2, z = at[1] * CELL + CELL / 2;
    const g = new THREE.Group();
    const m = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.6, metalness: 0.3 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.4, 6), m(0x3a434b)); base.position.y = 0.7;
    const head = new THREE.Group(); head.position.y = 1.6;
    head.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), m(0x59636d)));
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), m(0x1d2126)); barrel.position.set(0, 0, 0.5); head.add(barrel);
    const lampM = new THREE.MeshBasicMaterial({ color: 0x40ff80 });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.04), lampM); lamp.position.set(0, 0.06, 0.31); head.add(lamp);
    g.add(base, head); g.position.set(x, 0, z);
    this.scene.add(g);
    const yaw = Math.atan2(facing[0], facing[1]);
    head.rotation.y = yaw;
    return { x, z, g, head, lampM, barrel, yaw0: yaw, yaw, hp: 6, alive: true, fireT: 0, lock: 0 };
  }

  hurtTurret(n) {
    const tu = this.turret;
    if (!tu.alive) return;
    tu.hp -= n;
    this.fx.sparks(_a.set(tu.x, 1.6, tu.z), 0xffd040, 8);
    if (tu.hp <= 0) {
      tu.alive = false; tu.lampM.color.setHex(0x220000);
      tu.head.rotation.x = 0.5;
      this.fx.sparks(_a.set(tu.x, 1.6, tu.z), 0xffa040, 30);
      this.hud.toast('TURRET DESTROYED');
      this.audio.hit();
      this.fx.hideLaser('turret');
    }
  }

  updateTurret(dt) {
    const tu = this.turret;
    if (!tu.alive) return;
    const b = this.player.body;
    let target = null;
    // the turret fires on the parasite itself, and during an alarm on anything that is not a bot
    const hostile = b.body === 'worm' || (this.alarm > 0 && b.role !== 'bot');
    if (hostile && b.alive) {
      const dx = b.pos.x - tu.x, dz = b.pos.z - tu.z, d = Math.hypot(dx, dz);
      let off = Math.atan2(dx, dz) - tu.yaw0; off = Math.atan2(Math.sin(off), Math.cos(off));
      if (d < 13 && Math.abs(off) < 1.1 && this.world.sight(tu.x, tu.z, b.pos.x, b.pos.z)) target = b;
    }
    if (target) {
      let want = Math.atan2(target.pos.x - tu.x, target.pos.z - tu.z), d = want - tu.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      tu.yaw += d * Math.min(1, dt * 6);
      tu.lock += dt;
      tu.lampM.color.setHex(0xff2a2a);
      tu.fireT -= dt;
      const from = _a.set(tu.x + Math.sin(tu.yaw) * 0.8, 1.6, tu.z + Math.cos(tu.yaw) * 0.8);
      this.fx.laser('turret', from, _b.set(target.pos.x, target.fig.height * 0.6, target.pos.z), Math.min(1, tu.lock * 2));
      if (tu.lock > 0.7 && tu.fireT <= 0) {
        tu.fireT = 0.32;
        const from2 = from.clone(), to = new THREE.Vector3(target.pos.x, target.fig.height * 0.6, target.pos.z);
        if (Math.random() < (target.body === 'worm' ? 0.5 : 0.7)) { this.fx.tracer(from2, to, 0xff5a3a); this.damagePlayerBody(target, target.body === 'worm' ? 8 : 12, null); }
        else { to.x += (Math.random() - 0.5) * 2; to.z += (Math.random() - 0.5) * 2; this.fx.tracer(from2, to, 0xff5a3a); }
        this.audio.enemyShot();
      }
    } else {
      tu.lock = 0;
      tu.yaw = tu.yaw0 + Math.sin(this.t * 0.8) * 0.9;
      tu.lampM.color.setHex(this.alarm > 0 ? 0xffa020 : 0x40ff80);
      this.fx.hideLaser('turret');
    }
    tu.head.rotation.y = tu.yaw;
  }

  // ---- end states ---------------------------------------------------------------------------------------------------
  win() {
    if (this.state !== 'play') return;
    this.player.phase = 'won';
    this.state = 'end';
    this.audio.win();
    this.onEnd({ won: true, time: this.time, hosts: this.player.hosts, alarms: this.alarms, form: this.player.host ? this.player.host.spec.label : 'PARASITE' });
  }
  lose(msg) {
    if (this.state !== 'play') return;
    this.player.phase = 'dead';
    this.state = 'end';
    this.audio.lose();
    this.onEnd({ won: false, msg, time: this.time, hosts: this.player.hosts, alarms: this.alarms });
  }

  // ---- frame --------------------------------------------------------------------------------------------------------
  update(dt) {
    this.t += dt;
    const pl = this.player;
    if (this.state === 'menu') return this.menuCamera(dt);
    if (this.state === 'play') {
      this.time += dt;
      this.input.update();
      pl.update(dt, this.input);
      for (const a of this.actors) {
        if (a === pl.leapTarget && (pl.phase === 'leap' || pl.phase === 'struggle')) continue;
        a.think(dt, this);
        // guards radio it in once they open fire
        if (a.alive && !a.player && a.state === 'attack' && a.stateT > 1.5 && this.alarm <= 0) this.raiseAlarm(this.wanted, a, 'A GUARD CALLED IT IN');
      }
      for (const a of this.actors) if (!(a === pl.worm && pl.phase !== 'free')) a.integrate(dt, this.world);
      this.separate();
      this.updateTurret(dt);
      if (this.alarm > 0) {
        this.alarm -= dt;
        if (this.alarm <= 0) { this.alarm = 0; this.wanted = null; this.hud.toast('ALARM OVER'); }
      }
    }
    this.world.updateDoors(dt, this.actors.filter((a) => !(a === pl.worm && pl.phase !== 'free') && !(a === pl.worm && pl.host)), this.t);
    // alarm lights
    const red = this.alarm > 0 ? 0.5 + 0.5 * Math.sin(this.t * 6) : 0;
    for (const r of this.roomBase) { r.l.color.copy(r.c).lerp(RED, red * 0.85); r.l.intensity = r.i * (1 + red * 0.3); }
    // animate everyone
    for (const a of this.actors) {
      const extra = {};
      if (a === pl.host) { extra.aim = a.role === 'guard' && (this.input.held('fire') || pl.shotT < 0.8) ? 1 : 0; extra.aimPitch = -pl.pitch * 0.3; }
      if (a === pl.leapTarget && pl.phase === 'struggle') extra.struggle = 1;
      if (a === pl.worm) extra.air = pl.phase === 'leap' || pl.phase === 'struggle' ? pl.air : 0;
      a.animate(dt, this.t, extra);
      if (a.alive && !a.player && a.state === 'attack' && a.aimT > 0.05 && a.role === 'guard') {
        const tgt = pl.body;
        this.fx.laser(a.id, a.fig.muzzle(_a), _b.set(tgt.pos.x, tgt.fig.height * 0.6, tgt.pos.z), Math.min(1, a.aimT * 1.6));
      } else this.fx.hideLaser(a.id);
    }
    this.fx.update(dt);
    pl.updateCamera(this.camera, dt);
    this.hud.update(dt, this, this.camera);
    this.input.endFrame();
  }

  separate() {
    const A = this.actors;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = A[i], b = A[j];
      if (!a.alive || !b.alive || a.type === 'worm' || b.type === 'worm') continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.spec.r + b.spec.r;
      if (d < m && d > 1e-4) { const p = (m - d) / 2; a.pos.x -= (dx / d) * p; a.pos.z -= (dz / d) * p; b.pos.x += (dx / d) * p; b.pos.z += (dz / d) * p; }
    }
  }

  menuCamera(dt) {
    const cx = (W * CELL) / 2, cz = (H * CELL) / 2, a = this.t * 0.06;
    this.camera.position.set(cx + Math.sin(a) * 36, 30, cz + Math.cos(a) * 26);
    this.camera.lookAt(cx, 0, cz);
    const quiet = { ...this, player: { body: null }, alarm: 0, raiseAlarm() {}, flag() {} };
    for (const x of this.actors) { if (x.type !== 'worm') { x.think(dt, quiet); x.integrate(dt, this.world); } x.animate(dt, this.t); }
    this.world.updateDoors(dt, this.actors.filter((a) => a.type !== 'worm'), this.t);
  }

  render() { this.renderer.render(this.scene, this.camera); }
  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
}
