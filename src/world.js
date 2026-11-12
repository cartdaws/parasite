import * as THREE from 'three';
import { CELL, W, H, WALL, FLOOR, VENT, DOOR, LABDOOR, GATE, POD, ROOMS, cellAt, roomAt } from './map.js';

const WALL_H = 3.2;

// Who can pass a cell. body: 'worm' | 'human' | 'bot'; role: 'guard' | 'scientist' | 'bot' | null
export function passable(kind, body, role, doorOpen) {
  switch (kind) {
    case WALL: return false;
    case VENT: return body === 'worm';
    case DOOR: return doorOpen > 0.75;
    case LABDOOR: return doorOpen > 0.75;
    default: return true;
  }
}
// Who may open a door: any body opens a plain door; only a scientist opens a lab door.
export function canOpen(kind, role) { return kind === DOOR || (kind === LABDOOR && role === 'scientist'); }

// The deck: geometry, doors, collision and sight lines.
export class World {
  constructor(scene, map) {
    this.scene = scene;
    this.grid = map.grid;
    this.crateSet = new Set(map.crates.map(([x, y]) => y * W + x));
    this.group = new THREE.Group();
    scene.add(this.group);
    this.doors = [];
    this.build();
  }

  kind(cx, cy) { return cellAt(this.grid, cx, cy); }
  door(cx, cy) { return this.doors.find((d) => d.cx === cx && d.cy === cy); }

  // can this body stand in this cell right now?
  open(cx, cy, body, role) {
    const k = this.kind(cx, cy);
    if (k === DOOR || k === LABDOOR) { const d = this.door(cx, cy); return passable(k, body, role, d ? d.open : 0); }
    return passable(k, body, role, 0);
  }

  build() {
    const pos = [], col = [], idx = [];
    const quad = (a, b, c, d, color) => {
      const i = pos.length / 3;
      for (const v of [a, b, c, d]) { pos.push(v[0], v[1], v[2]); col.push(color.r, color.g, color.b); }
      idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    };
    const tmp = new THREE.Color();
    const box = (x0, y0, z0, x1, y1, z1, color, faces = 'all') => {
      const c = color;
      const shade = (k) => tmp.copy(c).multiplyScalar(k).clone();
      if (faces === 'all' || faces.includes('top')) quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], shade(1));
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], shade(0.78)); // +z
      quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], shade(0.72)); // -z
      quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], shade(0.86)); // +x
      quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], shade(0.66)); // -x
    };
    const floorC = new THREE.Color(0x2a3138), wallC = new THREE.Color(0x6d7a86), crateC = new THREE.Color(0x8a6a3a), ventC = new THREE.Color(0x1b2024);
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
      const k = this.kind(cx, cy), x0 = cx * CELL, z0 = cy * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
      const room = roomAt(cx, cy);
      if (k === WALL) {
        // only draw walls that border open space
        let edge = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (this.kind(cx + dx, cy + dy) !== WALL) edge = true;
        if (!edge) continue;
        if (this.crateSet.has(cy * W + cx)) {
          // crates: a stack of two, slightly inset, in the room's floor
          quad([x0, 0.01, z0], [x0, 0.01, z1], [x1, 0.01, z1], [x1, 0.01, z0], floorC);
          box(x0 + 0.1, 0, z0 + 0.1, x1 - 0.1, 1.2, z1 - 0.1, crateC);
          box(x0 + 0.35, 1.2, z0 + 0.3, x1 - 0.25, 2.0, z1 - 0.35, tmp.copy(crateC).multiplyScalar(0.85).clone());
        } else box(x0, 0, z0, x1, WALL_H, z1, wallC);
        continue;
      }
      // floor: each room has its own tint, with a darker seam grid
      const fc = floorC.clone();
      if (room) fc.lerp(new THREE.Color(room.light), 0.08);
      if ((cx + cy) % 2) fc.multiplyScalar(0.93);
      quad([x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], fc);
      if (k === VENT) {
        // a duct through the wall: low opening at the floor, solid wall above
        box(x0, 0.75, z0, x1, WALL_H, z1, wallC);
        box(x0, 0, z0, x1, 0.02, z1, ventC, ['top']);
        box(x0, 0.68, z0, x1, 0.75, z1, ventC);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1, flatShading: true }));
    this.group.add(this.mesh);

    // trim strips along the base of walls: a thin emissive line in each room's colour, for readability
    for (const r of ROOMS) {
      const m = new THREE.MeshBasicMaterial({ color: r.light });
      const x0 = r.x0 * CELL, x1 = (r.x1 + 1) * CELL, z0 = r.y0 * CELL, z1 = (r.y1 + 1) * CELL;
      for (const [a, b, c, d] of [[x0, z0, x1, z0 + 0.04], [x0, z1 - 0.04, x1, z1], [x0, z0, x0 + 0.04, z1], [x1 - 0.04, z0, x1, z1]]) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(c - a, 0.06, d - b), m);
        s.position.set((a + c) / 2, 0.25, (b + d) / 2);
        this.group.add(s);
      }
      // room light
      const L = new THREE.PointLight(r.light, 26, 26, 1.4);
      L.position.set(((r.x0 + r.x1 + 1) / 2) * CELL, 2.9, ((r.y0 + r.y1 + 1) / 2) * CELL);
      this.group.add(L);
      r.lightObj = L;
    }

    // doors, the scanner, the pod
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
      const k = this.kind(cx, cy), x = cx * CELL + CELL / 2, z = cy * CELL + CELL / 2;
      // which way the passage runs: along x if walls are above and below
      const alongX = this.kind(cx, cy - 1) === WALL && this.kind(cx, cy + 1) === WALL;
      if (k === DOOR || k === LABDOOR) {
        const lab = k === LABDOOR;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.25 : CELL, WALL_H - 0.4, alongX ? CELL : 0.25),
          new THREE.MeshStandardMaterial({ color: lab ? 0x2f7f8f : 0x6b7680, roughness: 0.6, metalness: 0.3, flatShading: true }));
        panel.position.set(x, (WALL_H - 0.4) / 2, z);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.27 : CELL * 0.98, 0.18, alongX ? CELL * 0.98 : 0.27), new THREE.MeshBasicMaterial({ color: lab ? 0x6ff0ff : 0xffb040 }));
        stripe.position.y = 0.4 - (WALL_H - 0.4) / 2 + 1.0;
        panel.add(stripe);
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.5 : CELL, 0.4, alongX ? CELL : 0.5), new THREE.MeshStandardMaterial({ color: 0x3a434b, flatShading: true }));
        lintel.position.set(x, WALL_H - 0.2, z);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: lab ? 0x6ff0ff : 0x40ff80 }));
        lamp.position.set(x, WALL_H - 0.45, z);
        this.group.add(panel, lintel, lamp);
        this.doors.push({ cx, cy, kind: k, x, z, open: 0, panel, lamp, alongX, lab });
      } else if (k === GATE) {
        const frameM = new THREE.MeshStandardMaterial({ color: 0x3a434b, flatShading: true });
        for (const s of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.4 : 0.3, WALL_H - 0.4, alongX ? 0.3 : 0.4), frameM);
          post.position.set(x + (alongX ? 0 : s * (CELL / 2 - 0.15)), (WALL_H - 0.4) / 2, z + (alongX ? s * (CELL / 2 - 0.15) : 0));
          this.group.add(post);
        }
        const beam = new THREE.Mesh(new THREE.PlaneGeometry(CELL - 0.3, WALL_H - 0.6), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
        beam.position.set(x, (WALL_H - 0.6) / 2, z);
        if (alongX) beam.rotation.y = Math.PI / 2;
        this.group.add(beam);
        this.gate = { cx, cy, x, z, beam };
      } else if (k === POD) {
        const pod = new THREE.Group();
        const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 1.2, 6, 16), new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.4, metalness: 0.3, flatShading: true }));
        shell.position.y = 1.4;
        const window = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7affa0 }));
        window.position.set(0, 1.9, -0.55); window.rotation.x = -Math.PI / 2;
        const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.4, 32), new THREE.MeshBasicMaterial({ color: 0x7affa0, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
        pod.add(shell, window, ring);
        pod.position.set(x, 0, z);
        this.group.add(pod);
        this.pod = { cx, cy, x, z, ring };
        const L = new THREE.PointLight(0x7affa0, 12, 10, 1.6); L.position.set(x, 2.4, z); this.group.add(L);
      }
    }
  }

  // Doors open for whoever may open them and is close; they close behind.
  updateDoors(dt, actors, t) {
    for (const d of this.doors) {
      let want = false;
      for (const a of actors) {
        if (!a.alive || a.carried) continue;
        if (Math.hypot(a.pos.x - d.x, a.pos.z - d.z) < 2.4 && canOpen(d.kind, a.body === 'worm' ? null : a.role)) want = true;
      }
      const target = want ? 1 : 0, prev = d.open;
      d.open += Math.sign(target - d.open) * Math.min(Math.abs(target - d.open), dt * 2.6);
      if ((prev === 0 && d.open > 0) || (prev === 1 && d.open < 1)) d.moved = true;
      d.panel.position.y = (WALL_H - 0.4) / 2 + d.open * (WALL_H - 0.5);
      d.lamp.material.color.setHex(d.lab ? (d.open > 0 ? 0x40ff80 : 0x6ff0ff) : 0x40ff80);
    }
    if (this.gate) this.gate.beam.material.opacity = 0.14 + 0.08 * Math.sin(t * 6);
    if (this.pod) this.pod.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 3));
  }

  // Push a circle out of everything this body cannot pass.
  collide(p, r, body, role) {
    for (let it = 0; it < 3; it++) {
      const cx0 = Math.floor((p.x - r) / CELL), cx1 = Math.floor((p.x + r) / CELL), cy0 = Math.floor((p.z - r) / CELL), cy1 = Math.floor((p.z + r) / CELL);
      let moved = false;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        if (this.open(cx, cy, body, role)) continue;
        const bx0 = cx * CELL, bz0 = cy * CELL, bx1 = bx0 + CELL, bz1 = bz0 + CELL;
        const nx = Math.max(bx0, Math.min(p.x, bx1)), nz = Math.max(bz0, Math.min(p.z, bz1));
        const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; p.x += (dx / d) * push; p.z += (dz / d) * push; }
        else { // centre inside the block: leave by the nearest face
          const l = p.x - bx0, rr = bx1 - p.x, f = p.z - bz0, k = bz1 - p.z, m = Math.min(l, rr, f, k);
          if (m === l) p.x = bx0 - r; else if (m === rr) p.x = bx1 + r; else if (m === f) p.z = bz0 - r; else p.z = bz1 + r;
        }
        moved = true;
      }
      if (!moved) break;
    }
  }

  // Is the straight line between two points clear of walls and closed doors? (vents block sight too)
  sight(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / 0.4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps, x = ax + dx * t, z = az + dz * t, cx = Math.floor(x / CELL), cy = Math.floor(z / CELL), k = this.kind(cx, cy);
      if (k === WALL || k === VENT) return false;
      if ((k === DOOR || k === LABDOOR) && (this.door(cx, cy)?.open ?? 0) < 0.6) return false;
    }
    return true;
  }

  // Grid path (8-way) for a body from one point to another; returns a list of world points or null.
  path(ax, az, bx, bz, body, role) {
    const sx = Math.floor(ax / CELL), sy = Math.floor(az / CELL), tx = Math.floor(bx / CELL), ty = Math.floor(bz / CELL);
    const ok = (x, y) => {
      const k = this.kind(x, y);
      if (k === DOOR) return true;                       // doors open for anyone walking up
      if (k === LABDOOR) return role === 'scientist';
      return passable(k, body, role, 0);
    };
    if (!ok(tx, ty)) return null;
    const prev = new Int32Array(W * H).fill(-1), seen = new Uint8Array(W * H), q = [sy * W + sx];
    seen[sy * W + sx] = 1;
    while (q.length) {
      const c = q.shift(), x = c % W, y = (c / W) | 0;
      if (x === tx && y === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy, n = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[n] || !ok(nx, ny)) continue;
        if (dx && dy && (!ok(x + dx, y) || !ok(x, y + dy))) continue;
        seen[n] = 1; prev[n] = c; q.push(n);
      }
    }
    const end = ty * W + tx;
    if (!seen[end]) return null;
    const pts = [];
    for (let c = end; c !== sy * W + sx && c >= 0; c = prev[c]) pts.push({ x: (c % W) * CELL + CELL / 2, z: ((c / W) | 0) * CELL + CELL / 2 });
    return pts.reverse();
  }
}

export { WALL_H, FLOOR };
