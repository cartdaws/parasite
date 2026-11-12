import * as THREE from 'three';

// Short-lived effects: tracers, sparks, muzzle flashes, guard aim lasers.
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    this.lasers = new Map();
  }

  tracer(a, b, color = 0xffd27a) {
    const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
    const l = new THREE.Line(g, m);
    this.scene.add(l);
    this.items.push({ o: l, t: 0, life: 0.12, fade: m });
    const fl = new THREE.PointLight(color, 6, 6, 2); fl.position.copy(a); this.scene.add(fl);
    this.items.push({ o: fl, t: 0, life: 0.06 });
  }

  sparks(at, color, n = 8) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true });
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this.sparkGeo, m);
      s.position.copy(at);
      const v = new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5);
      this.scene.add(s);
      this.items.push({ o: s, t: 0, life: 0.35 + Math.random() * 0.3, v, fade: m });
    }
  }

  // a guard's red aiming line, shown while they line up a shot
  laser(id, a, b, k) {
    let l = this.lasers.get(id);
    if (!l) {
      const g = new THREE.BufferGeometry().setFromPoints([a, b]);
      l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.6 }));
      this.scene.add(l); this.lasers.set(id, l);
    }
    l.visible = k > 0;
    if (k > 0) {
      const p = l.geometry.attributes.position;
      p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true;
      l.material.opacity = 0.25 + 0.5 * k;
    }
  }
  hideLaser(id) { const l = this.lasers.get(id); if (l) l.visible = false; }

  flashGate() { this.gateFlash = 1; }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (it.v) { it.v.y -= 12 * dt; it.o.position.addScaledVector(it.v, dt); if (it.o.position.y < 0.03) { it.o.position.y = 0.03; it.v.multiplyScalar(0.4); } }
      if (it.fade) it.fade.opacity = Math.max(0, 1 - it.t / it.life);
      if (it.t >= it.life) { this.scene.remove(it.o); this.items.splice(i, 1); }
    }
    if (this.gateFlash) this.gateFlash = Math.max(0, this.gateFlash - dt);
  }
}
