// Visual effects: tear splats, particles, gibs, explosions, decals.
// Everything is pooled (sprites come from the gfx pool).
import { S } from '../state.js';
import { makeSprite, freeSprite, place, setTex, addShake, makeFlat, freeFlat, placeFlat } from '../render/gfx.js';
import { splatTex, particleTex, explosionTex, creepTex } from '../render/art_world.js';
import { fxRng } from '../core/rng.js';
import * as THREE from 'three';

const MAX_FX = 260;

class Fx {
  constructor() { this.alive = true; }
  destroy() { freeSprite(this.spr); this.spr = null; this.alive = false; }
}

/** Animated 4-frame tear splat at height h, tinted */
export function splat(x, z, h, color = 0xa8d4f0, scale = 1) {
  if (S.fx.length > MAX_FX) return;
  const f = new Fx();
  f.x = x; f.z = z; f.h = h; f.t = 0; f.dur = 0.22;
  f.spr = makeSprite(splatTex(0), 0.7 * scale, 0.7 * scale);
  f.spr.center.set(0.5, 0.5);
  f.spr.material.color.set(color);
  f.update = function (dt) {
    this.t += dt;
    const fr = Math.min(3, Math.floor((this.t / this.dur) * 4));
    setTex(this.spr, splatTex(fr));
    place(this.spr, this.x, this.z, this.h, 5);
    if (this.t >= this.dur) this.destroy();
  };
  f.update(0);
  S.fx.push(f);
}

/**
 * Burst of physical particles that arc and bounce. opts: count, color, kind
 * ('blob'|'gib'|'rock'|'spark'|'smoke'), speed, up, life, size, gravity
 */
export function particles(x, z, opts = {}) {
  const { count = 6, color = 0xaa1a1a, kind = 'blob', speed = 3, up = 3, life = 0.6, size = 0.22, gravity = 14, h = 0.3, decal = null } = opts;
  for (let i = 0; i < count; i++) {
    if (S.fx.length > MAX_FX) return;
    const f = new Fx();
    const a = fxRng.next() * Math.PI * 2, sp = speed * (0.4 + fxRng.next() * 0.8);
    f.x = x; f.z = z; f.h = h; f.vx = Math.cos(a) * sp; f.vz = Math.sin(a) * sp * 0.8; f.vh = up * (0.5 + fxRng.next());
    f.t = 0; f.life = life * (0.6 + fxRng.next() * 0.8); f.kind = kind; f.decal = decal;
    const s = size * (0.6 + fxRng.next() * 0.8);
    f.spr = makeSprite(particleTex(kind), s, s);
    f.spr.center.set(0.5, 0.5);
    f.spr.material.color.set(color);
    f.spr.material.rotation = fxRng.next() * 6;
    if (kind === 'smoke' || kind === 'spark') { f.spr.material.blending = kind === 'spark' ? THREE.AdditiveBlending : THREE.NormalBlending; }
    f.update = function (dt) {
      this.t += dt;
      if (this.kind === 'smoke') { this.h += dt * 0.8; this.x += this.vx * dt * 0.3; this.z += this.vz * dt * 0.3; this.spr.material.opacity = 1 - this.t / this.life; this.spr.scale.multiplyScalar(1 + dt * 1.5); }
      else {
        this.vh -= gravity * dt; this.h += this.vh * dt;
        this.x += this.vx * dt; this.z += this.vz * dt;
        if (this.h <= 0) {
          this.h = 0;
          if (this.decal && !this.landed && S.view) { S.view.decal('splat', this.x, this.z, 0.25, this.decal); this.landed = true; }
          this.vh = -this.vh * 0.35; this.vx *= 0.6; this.vz *= 0.6;
        }
        if (this.t > this.life * 0.7) this.spr.material.opacity = Math.max(0, 1 - (this.t - this.life * 0.7) / (this.life * 0.3));
      }
      place(this.spr, this.x, this.z, this.h, 4);
      if (this.t >= this.life) this.destroy();
    };
    f.update(0);
    S.fx.push(f);
  }
}

/** Big explosion visual + scorch decal + shake */
export function explosionFx(x, z, scale = 1) {
  const f = new Fx();
  f.x = x; f.z = z; f.t = 0; f.dur = 0.45;
  f.spr = makeSprite(explosionTex(0), 3.6 * scale, 3.6 * scale);
  f.spr.center.set(0.5, 0.35);
  f.update = function (dt) {
    this.t += dt;
    setTex(this.spr, explosionTex(Math.min(5, Math.floor((this.t / this.dur) * 6))));
    place(this.spr, this.x, this.z, 0, 50);
    if (this.t >= this.dur) this.destroy();
  };
  f.update(0);
  S.fx.push(f);
  if (S.view) S.view.decal('scorch', x, z, 1.4 * scale);
  particles(x, z, { count: 10, kind: 'smoke', color: 0x5a5048, life: 0.9, size: 0.9, speed: 2 });
  particles(x, z, { count: 8, kind: 'rock', color: 0x6a5a4a, speed: 5, up: 5, life: 0.8, size: 0.25 });
  addShake(0.55 * scale);
}

/** Enemy death gore */
export function gore(x, z, size = 1, color = 0x9a1414, decalColor = '#6e0f0f') {
  particles(x, z, { count: Math.round(6 + size * 6), color, kind: 'gib', speed: 3.5 * size, up: 4, life: 0.7, size: 0.28 * Math.max(0.8, size), decal: decalColor });
  if (S.view) S.view.decal('splat', x, z, 0.9 * size, decalColor);
}

/** Floating sprite effect (e.g. a heart popping, a poof) */
export function poof(x, z, color = 0xd8d0c0, size = 0.8) {
  particles(x, z, { count: 7, kind: 'smoke', color, life: 0.5, size, speed: 2.5 });
}

/** Damaging puddle on the floor. owner: 'enemy' hurts the player, 'player' hurts enemies */
export function creep(x, z, opts = {}) {
  const { color = '#6f8a1e', size = 1.0, life = 4, owner = 'enemy', dps = 6 } = opts;
  if (S.creep.length > 60) { const old = S.creep.shift(); old.destroy(); }
  const c = { x, z, r: size * 0.45, t: 0, life, owner, dps, alive: true };
  c.mesh = makeFlat(creepTex(color), size, size * 0.85, 350);
  placeFlat(c.mesh, x, z, 0.015);
  c.mesh.rotation.y = fxRng.next() * 6;
  c.update = function (dt) {
    this.t += dt;
    if (this.t > this.life - 0.8) this.mesh.material.opacity = Math.max(0, (this.life - this.t) / 0.8);
    if (this.t >= this.life) this.destroy();
  };
  c.destroy = function () { if (this.mesh) freeFlat(this.mesh); this.mesh = null; this.alive = false; };
  S.creep.push(c);
  return c;
}

export function updateFx(dt) {
  for (let i = S.fx.length - 1; i >= 0; i--) {
    const f = S.fx[i];
    if (f.alive) f.update(dt);
    if (!f.alive) S.fx.splice(i, 1);
  }
  for (let i = S.creep.length - 1; i >= 0; i--) {
    const c = S.creep[i];
    if (c.alive) c.update(dt);
    if (!c.alive) S.creep.splice(i, 1);
  }
}
