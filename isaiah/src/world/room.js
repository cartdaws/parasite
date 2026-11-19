// Room runtime: tile grid, obstacle state, door positions and collision.
// Coordinates are room-local: the interior spans x∈[0,W], z∈[0,H] and tile
// (tx,ty) covers [tx,tx+1]×[ty,ty+1]. The room's world origin is (originX, originZ).
import { CFG } from '../config.js';

// collision masks
export const M_WALK = 1, M_FLY = 2, M_TEAR = 4, M_SPECTRAL = 8;

const WALK_SOLID = new Set(['rock', 'trock', 'metal', 'poop', 'fire', 'tnt', 'pit', 'void', 'urn']);
const TEAR_SOLID = new Set(['rock', 'trock', 'metal', 'poop', 'fire', 'tnt', 'void', 'urn']);
export const DESTRUCTIBLE = new Set(['rock', 'trock', 'poop', 'fire', 'tnt', 'urn']);

export function tileBlocks(t, mask) {
  if (!t) return true;
  if (mask & M_SPECTRAL) return t === 'void';
  if (mask & M_TEAR) return TEAR_SOLID.has(t);
  if (mask & M_FLY) return t === 'void';
  return WALK_SOLID.has(t);
}

export const SIDE = { TOP: 0, RIGHT: 1, BOTTOM: 2, LEFT: 3 };
export const SIDE_VEC = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export class Room {
  /** def comes from floorgen */
  constructor(def) {
    Object.assign(this, def);
    this.W = CFG.CELL_W * this.cw - 2;
    this.H = CFG.CELL_H * this.ch - 2;
    this.originX = this.gx * CFG.CELL_W + 1;
    this.originZ = this.gy * CFG.CELL_H + 1;
    this.grid = [];
    for (let i = 0; i < this.W * this.H; i++) this.grid.push({ t: 'floor' });
    this.cleared = false;
    this.visited = false;
    this.seen = false;          // shown on the minimap
    this.saved = null;          // persisted pickups / pedestals when you leave
    this.spawns = [];           // enemy spawn spots
    this.built = false;
    // mark the L-room notch as void
    if (this.notch) {
      const [nx, ny] = this.notch;
      for (let ty = 0; ty < this.H; ty++) for (let tx = 0; tx < this.W; tx++) {
        const inX = nx === 0 ? tx <= 13 : tx >= 13;
        const inY = ny === 0 ? ty <= 7 : ty >= 8;
        if (inX && inY) this.grid[ty * this.W + tx] = { t: 'void' };
      }
    }
    for (const d of this.doors) this.placeDoor(d);
  }

  /** compute door tile position & world anchor from its side + cell */
  placeDoor(d) {
    const W = this.W, H = this.H;
    if (d.side === SIDE.TOP) { d.tx = d.lx * 15 + 6; d.ty = 0; d.x = d.tx + 0.5; d.z = 0; }
    else if (d.side === SIDE.BOTTOM) { d.tx = d.lx * 15 + 6; d.ty = H - 1; d.x = d.tx + 0.5; d.z = H; }
    else if (d.side === SIDE.LEFT) { d.tx = 0; d.ty = d.ly * 9 + 3; d.x = 0; d.z = d.ty + 0.5; }
    else { d.tx = W - 1; d.ty = d.ly * 9 + 3; d.x = W; d.z = d.ty + 0.5; }
  }

  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.W && ty < this.H; }
  tile(tx, ty) { return this.inBounds(tx, ty) ? this.grid[ty * this.W + tx] : null; }
  tileType(tx, ty) { const t = this.tile(tx, ty); return t ? t.t : 'wall'; }
  setTile(tx, ty, t) { if (this.inBounds(tx, ty)) this.grid[ty * this.W + tx] = t; }
  blocksAt(x, z, mask) {
    const tx = Math.floor(x), ty = Math.floor(z);
    if (!this.inBounds(tx, ty)) return true;
    return tileBlocks(this.grid[ty * this.W + tx].t, mask);
  }
  isFree(tx, ty) { const t = this.tile(tx, ty); return t && t.t === 'floor'; }

  /**
   * Push a circle (e.x, e.z, e.r) out of solid tiles and the room walls.
   * Returns true if anything was hit (used by bouncing / charging enemies).
   */
  collide(e, mask, clampWalls = true) {
    let hit = false;
    const r = e.r;
    for (let iter = 0; iter < 2; iter++) {
      const x0 = Math.floor(e.x - r), x1 = Math.floor(e.x + r);
      const z0 = Math.floor(e.z - r), z1 = Math.floor(e.z + r);
      for (let ty = z0; ty <= z1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!this.inBounds(tx, ty)) continue;
        if (!tileBlocks(this.grid[ty * this.W + tx].t, mask)) continue;
        // closest point on the tile AABB
        const cx = Math.max(tx, Math.min(e.x, tx + 1));
        const cz = Math.max(ty, Math.min(e.z, ty + 1));
        let dx = e.x - cx, dz = e.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2), push = r - d;
          e.x += (dx / d) * push; e.z += (dz / d) * push;
        } else {
          // center inside the tile: push out along the shallowest axis
          const l = e.x - tx, rr = tx + 1 - e.x, t = e.z - ty, b = ty + 1 - e.z;
          const m = Math.min(l, rr, t, b);
          if (m === l) e.x = tx - r; else if (m === rr) e.x = tx + 1 + r; else if (m === t) e.z = ty - r; else e.z = ty + 1 + r;
        }
      }
    }
    if (clampWalls) {
      if (e.x < r) { e.x = r; hit = true; }
      if (e.x > this.W - r) { e.x = this.W - r; hit = true; }
      if (e.z < r) { e.z = r; hit = true; }
      if (e.z > this.H - r) { e.z = this.H - r; hit = true; }
    }
    return hit;
  }

  /** Line of sight for a tear-like ray (tiles that block tears). */
  lineClear(x0, z0, x1, z1, mask = M_TEAR) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(d * 3);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.blocksAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, mask)) return false;
    }
    return true;
  }

  /** Nearest free floor tile center to (x, z) */
  nearestFree(x, z, avoid = null) {
    let best = null, bd = 1e9;
    for (let ty = 0; ty < this.H; ty++) for (let tx = 0; tx < this.W; tx++) {
      if (this.grid[ty * this.W + tx].t !== 'floor') continue;
      if (avoid && avoid(tx, ty)) continue;
      const d = (tx + 0.5 - x) ** 2 + (ty + 0.5 - z) ** 2;
      if (d < bd) { bd = d; best = { x: tx + 0.5, z: ty + 0.5 }; }
    }
    return best || { x: this.W / 2, z: this.H / 2 };
  }
  randomFree(rng, margin = 1) {
    for (let i = 0; i < 200; i++) {
      const tx = rng.int(margin, this.W - 1 - margin), ty = rng.int(margin, this.H - 1 - margin);
      if (this.isFree(tx, ty)) return { x: tx + 0.5, z: ty + 0.5 };
    }
    return this.nearestFree(this.W / 2, this.H / 2);
  }
  center() { return { x: this.W / 2, z: this.H / 2 }; }

  /** BFS distance field over walkable tiles from (tx,ty) — for ground pathing */
  flowField(tx, ty, mask = M_WALK) {
    const W = this.W, H = this.H;
    const dist = new Int16Array(W * H).fill(-1);
    if (!this.inBounds(tx, ty)) return dist;
    const q = [ty * W + tx]; dist[ty * W + tx] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of SIDE_VEC) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (dist[ni] >= 0 || tileBlocks(this.grid[ni].t, mask)) continue;
        dist[ni] = dist[i] + 1; q.push(ni);
      }
    }
    return dist;
  }
  doorBySide(side, lx, ly) { return this.doors.find((d) => d.side === side && (lx == null || (d.lx === lx && d.ly === ly))); }
}
