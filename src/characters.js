import * as THREE from 'three';

// Procedural low-poly figures. Every figure faces +z locally; the actor sets root.position and root.rotation.y.
// update() takes a pose description and animates limbs: walking, running, aiming, struggling, possessed glow, collapse.

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, flatShading: true, ...o });
const glow = (color) => new THREE.MeshBasicMaterial({ color });
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); g.position.set(x, y, z); return g; };
const pivot = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
const POSSESSED = new THREE.Color(0x5dff7a);

function blobShadow(r) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02;
  return m;
}

class Figure {
  constructor() {
    this.root = new THREE.Group();
    this.tint = [];        // materials that glow green while possessed
    this.eyes = [];        // eye materials
    this.eyeBase = [];
    this.phase = 0;
    this.deadT = 0;
  }
  setPossessed(amount, t) {
    // amount 0..1: how far the parasite has spread through the host
    const pulse = 0.5 + 0.5 * Math.sin(t * (3 + amount * 6));
    for (const m of this.tint) { m.emissive.copy(POSSESSED); m.emissiveIntensity = amount * (0.12 + 0.18 * pulse); }
    this.eyes.forEach((m, i) => m.color.copy(this.eyeBase[i]).lerp(POSSESSED, amount > 0 ? 1 : 0));
  }
}

// guards and scientists share one rig
class Human extends Figure {
  constructor(kind) {
    super();
    const guard = kind === 'guard';
    const pants = mat(guard ? 0x26324d : 0x4a5560), shirt = mat(guard ? 0x2f4370 : 0xe8ecef), skin = mat(0xd9a07a);
    const boots = mat(0x1c1f24), accent = guard ? mat(0x45598a) : mat(0x2ec4b6);
    this.tint.push(pants, shirt, skin, accent);
    this.root.add(blobShadow(0.5));
    const body = this.body = pivot(this.root, 0, 0, 0);
    const hips = this.hips = pivot(body, 0, 0.95, 0);
    hips.add(box(0.4, 0.18, 0.24, pants, 0, 0, 0));
    const torso = this.torso = pivot(hips, 0, 0.08, 0);
    if (guard) {
      torso.add(box(0.5, 0.56, 0.3, shirt, 0, 0.3, 0));
      torso.add(box(0.54, 0.34, 0.34, accent, 0, 0.38, 0.01));          // chest plate
      torso.add(box(0.2, 0.08, 0.05, glow(0xffa040), 0.1, 0.44, 0.18)); // badge light
    } else {
      // lab coat: tapered and open at the hem
      const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.86, 4, 1), shirt);
      coat.rotation.y = Math.PI / 4; coat.scale.set(1, 1, 0.68); coat.position.y = 0.15;
      torso.add(coat);
      torso.add(box(0.2, 0.3, 0.04, accent, 0, 0.34, 0.12));           // shirt under the coat
      torso.add(box(0.08, 0.1, 0.03, glow(0x2ec4b6), 0.15, 0.38, 0.17)); // id badge
    }
    const head = this.head = pivot(torso, 0, 0.66, 0);
    head.add(box(0.26, 0.28, 0.26, skin, 0, 0.14, 0));
    const eyeM = glow(guard ? 0xffa040 : 0x203038);
    this.eyes.push(eyeM); this.eyeBase.push(eyeM.color.clone());
    if (guard) {
      head.add(box(0.32, 0.17, 0.32, mat(0x1f2a44), 0, 0.27, -0.01));  // helmet
      head.add(box(0.3, 0.07, 0.04, eyeM, 0, 0.16, 0.15));               // visor
    } else {
      head.add(box(0.28, 0.08, 0.28, mat(0x3a2a20), 0, 0.3, -0.01));    // hair
      head.add(box(0.06, 0.04, 0.03, eyeM, -0.06, 0.16, 0.135));
      head.add(box(0.06, 0.04, 0.03, eyeM, 0.06, 0.16, 0.135));
      head.add(box(0.24, 0.02, 0.02, accent, 0, 0.17, 0.14));           // glasses
    }
    const limb = (side) => {
      const sh = pivot(torso, side * 0.31, 0.5, 0);
      sh.add(box(0.13, 0.32, 0.14, shirt, 0, -0.15, 0));
      const el = pivot(sh, 0, -0.3, 0);
      el.add(box(0.11, 0.28, 0.12, guard ? accent : shirt, 0, -0.13, 0));
      el.add(box(0.1, 0.1, 0.1, skin, 0, -0.3, 0));
      const hp = pivot(hips, side * 0.11, -0.06, 0);
      hp.add(box(0.16, 0.44, 0.18, pants, 0, -0.21, 0));
      const kn = pivot(hp, 0, -0.43, 0);
      kn.add(box(0.14, 0.38, 0.16, pants, 0, -0.18, 0));
      kn.add(box(0.15, 0.1, 0.26, boots, 0, -0.4, 0.04));
      return { sh, el, hp, kn };
    };
    this.L = limb(-1); this.R = limb(1);
    if (guard) {
      const gun = this.gun = new THREE.Group();
      gun.add(box(0.08, 0.12, 0.5, mat(0x1d2126, { metalness: 0.4 }), 0, 0, 0.12));
      gun.add(box(0.06, 0.14, 0.08, mat(0x1d2126), 0, -0.1, 0.02));
      this.muzzleLamp = box(0.05, 0.05, 0.04, glow(0xffa040), 0, 0.02, 0.38);
      gun.add(this.muzzleLamp);
      gun.position.set(0, -0.32, 0.04);
      this.R.el.add(gun);
    }
    this.height = 1.85;
  }

  // world position of the muzzle, for tracers
  muzzle(out) { return this.gun ? this.muzzleLamp.getWorldPosition(out) : this.head.getWorldPosition(out); }

  update(dt, p) {
    const { speed = 0, t = 0 } = p;
    if (p.dead) return this.collapse(dt);
    const move = Math.min(1, speed / 2.2), run = Math.max(0, Math.min(1, (speed - 2.6) / 2));
    this.phase += dt * (2.2 + speed * 2.1);
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const swing = 0.55 * move + 0.35 * run;
    // legs: hip swings, knee bends on the back stroke
    this.L.hp.rotation.x = s * swing; this.R.hp.rotation.x = -s * swing;
    this.L.kn.rotation.x = Math.max(0, -c) * swing * 1.3 + 0.05; this.R.kn.rotation.x = Math.max(0, c) * swing * 1.3 + 0.05;
    // body bob and lean
    this.hips.position.y = 0.95 + Math.abs(c) * 0.05 * move - 0.03 * run + Math.sin(t * 1.6) * 0.008;
    this.torso.rotation.x = 0.08 * move + 0.18 * run;
    this.torso.rotation.y = s * 0.08 * move;
    // arms counter-swing; idle arms hang with a slight breath
    const armS = swing * 0.9;
    this.L.sh.rotation.set(-s * armS, 0, 0.08); this.R.sh.rotation.set(s * armS, 0, -0.08);
    this.L.el.rotation.x = -0.25 - 0.5 * run; this.R.el.rotation.x = -0.25 - 0.5 * run;
    this.head.rotation.set(0, p.look || 0, 0);
    if (p.aim > 0) {
      // raise the gun to the shoulder
      const a = p.aim;
      this.R.sh.rotation.x = THREE.MathUtils.lerp(this.R.sh.rotation.x, -1.45 + (p.aimPitch || 0), a);
      this.R.el.rotation.x = THREE.MathUtils.lerp(this.R.el.rotation.x, -0.1, a);
      this.L.sh.rotation.x = THREE.MathUtils.lerp(this.L.sh.rotation.x, -1.2, a);
      this.L.sh.rotation.z = THREE.MathUtils.lerp(0.08, -0.55, a);
      this.L.el.rotation.x = THREE.MathUtils.lerp(this.L.el.rotation.x, -0.5, a);
    }
    if (p.recoil) this.R.sh.rotation.x -= p.recoil * 0.25;
    if (p.struggle > 0) {
      // something is on their back: hands clawing at the neck, body thrashing
      const k = p.struggle, j = Math.sin(t * 31) * 0.18 * k;
      this.torso.rotation.z = j; this.torso.rotation.x = 0.25 * k + Math.sin(t * 23) * 0.1 * k;
      this.L.sh.rotation.set(-2.6 * k, 0, 0.4 * k); this.R.sh.rotation.set(-2.6 * k, 0, -0.4 * k);
      this.L.el.rotation.x = -1.6 * k; this.R.el.rotation.x = -1.6 * k;
      this.head.rotation.x = -0.4 * k + j;
    } else this.torso.rotation.z = 0;
    if (p.alarmed) this.head.rotation.x = -0.05;
    this.setPossessed(p.possessed || 0, t);
    this.deadT = 0; this.body.rotation.x = 0; this.body.position.y = 0;
  }

  collapse(dt) {
    // fall backwards and go slack
    this.deadT = Math.min(1, this.deadT + dt * 1.6);
    const k = this.deadT * this.deadT * (3 - 2 * this.deadT);
    this.body.rotation.x = -1.5 * k;
    this.body.position.y = 0.12 * k;
    this.body.position.z = -0.3 * k;
    this.hips.position.y = 0.95 - 0.75 * k;
    this.torso.rotation.set(0, 0, 0);
    this.L.hp.rotation.x = 0.3 * k; this.R.hp.rotation.x = 0.1 * k;
    this.L.kn.rotation.x = 0.4 * k; this.R.kn.rotation.x = 0.1 * k;
    this.L.sh.rotation.set(-0.3 * k, 0, 0.9 * k); this.R.sh.rotation.set(-0.2 * k, 0, -1.1 * k);
    this.head.rotation.set(0.2 * k, 0.5 * k, 0);
    this.setPossessed(0, 0);
    for (const m of this.tint) m.emissiveIntensity = 0;
    for (const m of this.eyes) m.color.setHex(0x111111);
  }
}

// maintenance bot: a squat yellow box on treads with a single lens and two little claws
class Bot extends Figure {
  constructor() {
    super();
    const shell = mat(0xf2c230, { roughness: 0.55, metalness: 0.2 }), dark = mat(0x2a2d31, { metalness: 0.3 }), stripe = mat(0x1d1f22);
    this.tint.push(shell);
    this.root.add(blobShadow(0.6));
    const body = this.body = pivot(this.root, 0, 0, 0);
    for (const s of [-1, 1]) body.add(box(0.18, 0.26, 0.7, dark, s * 0.3, 0.13, 0));
    this.treads = [];
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const tooth = box(0.2, 0.04, 0.06, stripe, s * 0.3, 0.27, -0.27 + i * 0.18); body.add(tooth); this.treads.push(tooth);
    }
    const hull = this.hull = pivot(body, 0, 0.3, 0);
    hull.add(box(0.62, 0.5, 0.6, shell, 0, 0.27, 0));
    hull.add(box(0.64, 0.08, 0.62, stripe, 0, 0.1, 0));
    for (let i = 0; i < 3; i++) hull.add(box(0.1, 0.06, 0.02, stripe, -0.2 + i * 0.2, 0.42, 0.305));
    const head = this.head = pivot(hull, 0, 0.55, 0.02);
    head.add(box(0.36, 0.22, 0.32, shell, 0, 0.11, 0));
    head.add(box(0.24, 0.14, 0.04, dark, 0, 0.11, 0.17));
    const eyeM = glow(0x6ff0ff); this.eyes.push(eyeM); this.eyeBase.push(eyeM.color.clone());
    head.add(box(0.1, 0.08, 0.03, eyeM, 0, 0.11, 0.195));
    const ant = box(0.02, 0.25, 0.02, dark, 0.12, 0.34, -0.05); head.add(ant);
    this.lamp = glow(0xffa020); head.add(box(0.05, 0.05, 0.05, this.lamp, 0.12, 0.48, -0.05));
    this.arms = [];
    for (const s of [-1, 1]) {
      const a = pivot(hull, s * 0.34, 0.32, 0.1);
      a.add(box(0.06, 0.06, 0.3, dark, 0, 0, 0.15));
      a.add(box(0.1, 0.08, 0.06, shell, 0, 0, 0.32));
      this.arms.push(a);
    }
    this.height = 1.15;
  }
  muzzle(out) { return this.head.getWorldPosition(out); }
  update(dt, p) {
    const { speed = 0, t = 0 } = p;
    if (p.dead) {
      this.deadT = Math.min(1, this.deadT + dt * 2);
      this.hull.rotation.z = 0.5 * this.deadT; this.head.rotation.x = 0.6 * this.deadT;
      this.eyes[0].color.setHex(0x111111); this.lamp.color.setHex(0x111111);
      for (const m of this.tint) m.emissiveIntensity = 0;
      return;
    }
    this.phase += dt * speed * 6;
    this.treads.forEach((m, i) => { m.position.z = -0.27 + ((((i % 4) * 0.18 + this.phase * 0.05) % 0.72) + 0.72) % 0.72; });
    this.hull.position.y = 0.3 + Math.sin(t * 9) * 0.008 * (speed > 0.1 ? 1 : 0.3);
    this.hull.rotation.x = Math.min(speed, 2) * 0.04;
    this.head.rotation.y = p.look ?? Math.sin(t * 0.7) * 0.5;
    this.arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 2 + i) * 0.15 - (p.struggle ? Math.sin(t * 30) * 0.8 : 0); });
    if (p.struggle) this.hull.rotation.z = Math.sin(t * 27) * 0.12 * p.struggle;
    else this.hull.rotation.z = 0;
    this.lamp.color.setHex(Math.sin(t * 5) > 0 ? 0xffa020 : 0x553300);
    this.setPossessed(p.possessed || 0, t);
  }
}

// the parasite: a glowing segmented worm that slithers along its own trail
class Worm extends Figure {
  constructor(scene) {
    super();
    this.scene = scene;
    this.n = 9;
    this.trail = [];
    const skin = mat(0x58d66a, { emissive: 0x1e8a34, emissiveIntensity: 0.5, roughness: 0.4 });
    const belly = mat(0x2f7a3a, { emissive: 0x0f4a1e, emissiveIntensity: 0.4 });
    this.segs = [];
    for (let i = 0; i < this.n; i++) {
      const r = i === 0 ? 0.14 : 0.13 * (1 - i / (this.n + 2)) + 0.03;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), i % 2 ? belly : skin);
      m.scale.set(1, 0.8, 1.25);
      this.root.add(m);
      this.segs.push({ m, r });
    }
    const eye = glow(0xeaffb0);
    for (const s of [-1, 1]) this.segs[0].m.add(box(0.04, 0.04, 0.04, eye, s * 0.07, 0.06, 0.1));
    // mandibles
    this.jaws = [];
    for (const s of [-1, 1]) { const j = box(0.025, 0.025, 0.12, belly, s * 0.06, -0.02, 0.15); j.rotation.y = -s * 0.4; this.segs[0].m.add(j); this.jaws.push(j); }
    this.shadow = blobShadow(0.35); this.root.add(this.shadow);
    scene.add(this.root);
    this.height = 0.3;
  }
  reset(pos) { this.trail = []; for (let i = 0; i < 40; i++) this.trail.push(pos.clone()); }
  muzzle(out) { return out.copy(this.segs[0].m.position); }
  // the worm is placed in world space, not by root transform
  update(dt, p) {
    const { pos, yaw = 0, speed = 0, t = 0, air = 0 } = p;
    if (!this.trail.length) this.reset(pos);
    const head = this.trail[0];
    if (head.distanceToSquared(pos) > 0.0016) { this.trail.unshift(pos.clone()); if (this.trail.length > 80) this.trail.pop(); }
    else head.copy(pos);
    // walk the trail to place segments at fixed spacing
    let seg = 0, acc = 0, want = 0;
    const spacing = 0.15;
    const out = new THREE.Vector3();
    for (let i = 0; i < this.trail.length - 1 && seg < this.n; i++) {
      const a = this.trail[i], b = this.trail[i + 1], d = a.distanceTo(b);
      while (seg < this.n && want <= acc + d) {
        out.lerpVectors(a, b, d > 0 ? (want - acc) / d : 0);
        this.place(seg, out, t, speed, air);
        seg++; want = seg * spacing;
      }
      acc += d;
    }
    for (; seg < this.n; seg++) this.place(seg, this.trail[this.trail.length - 1], t, speed, air);
    const h = this.segs[0].m;
    h.rotation.set(0, yaw, 0);
    for (let i = 1; i < this.n; i++) {
      const a = this.segs[i - 1].m.position, b = this.segs[i].m.position;
      if (a.distanceToSquared(b) > 1e-6) this.segs[i].m.rotation.y = Math.atan2(a.x - b.x, a.z - b.z);
    }
    this.jaws.forEach((j, i) => { j.rotation.y = (i ? 1 : -1) * (0.4 + 0.3 * Math.sin(t * 14)); });
    this.shadow.position.set(pos.x, 0.02, pos.z);
  }
  place(i, at, t, speed, air) {
    const s = this.segs[i];
    const wig = Math.sin(t * 9 - i * 0.9) * 0.05 * Math.min(1, speed / 2) * (i / this.n);
    s.m.position.set(at.x + wig, s.r * 0.8 + (i === 0 ? 0.06 : 0) + air * (1 - i / this.n) + Math.max(0, Math.sin(t * 9 - i * 0.9)) * 0.02 * Math.min(1, speed), at.z + wig);
  }
}

export function makeFigure(type, scene) {
  if (type === 'worm') return new Worm(scene);
  if (type === 'bot') return new Bot();
  return new Human(type);
}
