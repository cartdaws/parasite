// Builds and maintains the three.js objects for one room: floor (a canvas
// texture that decals get stamped into), walls, door sprites and obstacle sprites.
import * as THREE from 'three';
import { CFG } from '../config.js';
import { gfx, makeSprite, freeSprite, freeFlat, place } from './gfx.js';
import { paintFloor, wallFaceTex, wallTopTex, rockTex, metalTex, poopTex, fireplaceTex, tntTex, urnTex, doorTex, stampSplat, stampScorch, TILE_PX } from './art_world.js';
import { toTexture, inkText, rgba } from './draw.js';
import { RNG, fxRng } from '../core/rng.js';

const WH = CFG.WALL_HEIGHT;

function boxWithUV(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // face order px nx py ny pz nz, 4 verts each; scale UVs to world size so textures tile
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [fw, fh] = dims[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * fw / 4, uv.getY(k) * fh / (f === 2 || f === 3 ? 2 : WH));
    }
  }
  return g;
}

export class RoomView {
  constructor(room, floorNum, palette) {
    this.room = room;
    this.floorNum = floorNum;
    this.group = new THREE.Group();
    this.group.position.set(room.originX, 0, room.originZ);
    this.layer = new THREE.Group(); // entity sprites live here
    this.group.add(this.layer);
    this.disposables = [];
    this.obstacleSprites = new Map();
    this.doorSprites = [];
    this.palette = palette;
    this.floorDirty = false;
    this.buildFloor();
    this.buildWalls();
    this.buildObstacles();
    this.buildDoors();
    gfx.scene.add(this.group);
  }

  buildFloor() {
    const r = this.room;
    this.floorCanvas = paintFloor(r, this.palette, r.seed || r.id + 1);
    if (r.type === 'start' && this.floorNum === 1 && !r.noHints) this.drawControlHints();
    if (r.decalLog) for (const d of r.decalLog) this.applyDecal(d); // replay persistent decals
    this.floorCtx = this.floorCanvas.getContext('2d');
    this.floorTex = toTexture(this.floorCanvas);
    const geo = new THREE.PlaneGeometry(r.W, r.H);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: this.floorTex });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(r.W / 2, 0, r.H / 2);
    m.renderOrder = 0;
    this.group.add(m);
    this.disposables.push(geo, mat, this.floorTex);
  }

  drawControlHints() {
    const ctx = this.floorCanvas.getContext('2d');
    const P = TILE_PX;
    const col = rgba('#e8dcc0', 0.45);
    const draw = (txt, x, y, s) => inkText(ctx, txt, x * P, y * P, s, col, { align: 'center', outline: rgba('#000000', 0.25), lw: 3 });
    draw('W A S D', 3.2, 2.6, 22); draw('move', 3.2, 3.4, 16);
    draw('ARROWS', 9.8, 2.6, 22); draw('cry', 9.8, 3.4, 16);
    draw('E bomb   Q card/pill   SPACE item', 6.5, 5.6, 15);
  }

  rebuildWalls() {
    if (this.wallGroup) { this.group.remove(this.wallGroup); for (const d of this.wallDisposables) d.dispose(); }
    this.buildWalls();
  }
  buildWalls() {
    const r = this.room, W = r.W, H = r.H;
    this.wallGroup = new THREE.Group();
    this.group.add(this.wallGroup);
    this.wallDisposables = [];
    const disp = this.wallDisposables;
    const faceTex = wallFaceTex(this.palette);
    faceTex.wrapS = faceTex.wrapT = THREE.RepeatWrapping; faceTex.needsUpdate = true;
    const topTex = wallTopTex(this.palette);
    topTex.wrapS = topTex.wrapT = THREE.RepeatWrapping; topTex.needsUpdate = true;
    const faceMat = new THREE.MeshBasicMaterial({ map: faceTex });
    const topMat = new THREE.MeshBasicMaterial({ map: topTex });
    const mats = [faceMat, faceMat, topMat, faceMat, faceMat, faceMat];
    disp.push(faceMat, topMat);
    const T = 1.0;
    const addBox = (x0, z0, x1, z1, h = WH) => {
      if (x1 - x0 <= 0.01 || z1 - z0 <= 0.01) return;
      const g = boxWithUV(x1 - x0, h, z1 - z0);
      const m = new THREE.Mesh(g, mats);
      m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
      this.wallGroup.add(m);
      disp.push(g);
    };
    // walls are split around door openings (1 tile wide)
    const gapsFor = (side) => r.doors.filter((d) => d.side === side && !d.hidden).map((d) => (side % 2 === 0 ? d.tx : d.ty)).sort((a, b) => a - b);
    const run = (side, len, mk) => {
      let start = -T;
      for (const g of gapsFor(side)) { mk(start, g); start = g + 1; }
      mk(start, len + T);
    };
    run(0, W, (a, b) => addBox(a, -T, b, 0));
    run(2, W, (a, b) => addBox(a, H, b, H + T));
    run(3, H, (a, b) => addBox(-T, Math.max(a, 0), 0, Math.min(b, H)));
    run(1, H, (a, b) => addBox(W, Math.max(a, 0), W + T, Math.min(b, H)));
    // corners
    addBox(-T, -T, 0, 0); addBox(W, -T, W + T, 0); addBox(-T, H, 0, H + T); addBox(W, H, W + T, H + T);
    // door gap floors (dark recess so the opening reads as a passage)
    const recessMat = new THREE.MeshBasicMaterial({ color: 0x0a0605 });
    disp.push(recessMat);
    for (const d of r.doors) {
      if (d.hidden) continue;
      const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, recessMat);
      const [ox, oz] = [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]][d.side];
      m.position.set(d.x + ox, 0.01, d.z + oz);
      this.wallGroup.add(m); disp.push(g);
    }
    // L-room notch: one big solid block
    if (r.notch) {
      const [nx, ny] = r.notch;
      const x0 = nx === 0 ? 0 : 13, x1 = nx === 0 ? 14 : W;
      const z0 = ny === 0 ? 0 : 8, z1 = ny === 0 ? 8 : H;
      addBox(x0, z0, x1, z1);
    }
  }

  obstacleTexture(t, tx, ty) {
    const fl = this.floorNum;
    switch (t.t) {
      case 'rock': return { tex: rockTex(t.v ?? ((tx * 7 + ty * 3) % 3), false, fl), w: 1.18, h: 1.1 };
      case 'trock': return { tex: rockTex(1, true, fl), w: 1.18, h: 1.1 };
      case 'metal': return { tex: metalTex(), w: 1.15, h: 1.15 };
      case 'poop': return { tex: poopTex(t.stage || 0, t.variant), w: 1.15, h: 1.08 };
      case 'fire': return { tex: fireplaceTex(t.frame || 0, t.lit, this.room.tiles_blue_fire), w: 1.05, h: 1.3 };
      case 'tnt': return { tex: tntTex(), w: 1.05, h: 1.05 };
      case 'urn': return { tex: urnTex(), w: 1.0, h: 1.0 };
      default: return null;
    }
  }
  buildObstacles() {
    const r = this.room;
    for (let ty = 0; ty < r.H; ty++) for (let tx = 0; tx < r.W; tx++) this.refreshTile(tx, ty);
  }
  /** Rebuild the sprite for one tile after it changes (destroyed, damaged, extinguished) */
  refreshTile(tx, ty) {
    const key = ty * this.room.W + tx;
    const t = this.room.tile(tx, ty);
    const info = t ? this.obstacleTexture(t, tx, ty) : null;
    let s = this.obstacleSprites.get(key);
    if (!info) { if (s) { freeSprite(s); this.obstacleSprites.delete(key); } return; }
    if (!s) { s = makeSprite(info.tex, info.w, info.h, this.layer); this.obstacleSprites.set(key, s); }
    s.material.map = info.tex;
    s.scale.set(info.w, info.h, 1);
    place(s, tx + 0.5, ty + 0.92, 0, -2);
  }

  buildDoors() {
    for (const s of this.doorSprites) freeSprite(s);
    this.doorSprites = [];
    for (const d of this.room.doors) {
      const s = makeSprite(doorTex(d.kind, 'open', d.side), 2.0, 2.0, this.group);
      d.spr = s;
      this.doorSprites.push(s);
      this.updateDoor(d);
    }
  }
  updateDoor(d) {
    const s = d.spr;
    if (!s) return;
    if (d.hidden) { s.visible = false; return; }
    s.visible = true;
    const state = d.lock ? 'locked' : d.closed ? 'closed' : 'open';
    s.material.map = doorTex(d.kind, state, d.side);
    // sit each frame over its wall; side/bottom doors are centered on the wall top
    if (d.side === 0) { s.center.set(0.5, 0); s.position.set(d.x, 0.02, d.z + 0.1); s.scale.set(2.0, 2.0, 1); }
    else if (d.side === 2) { s.center.set(0.5, 0.5); s.position.set(d.x, WH, d.z + 0.5); s.scale.set(2.0, 2.0, 1); }
    else { s.center.set(0.5, 0.5); s.position.set(d.x + (d.side === 1 ? 0.5 : -0.5), WH, d.z); s.scale.set(2.0, 2.0, 1); }
    s.renderOrder = 900;
  }
  updateDoors() { for (const d of this.room.doors) this.updateDoor(d); }

  /** Blood / goop / scorch decal stamped into the floor texture (persists for the room) */
  decal(kind, x, z, size, color) {
    const d = { kind, x, z, size, color, seed: (fxRng.next() * 1e9) | 0 };
    if (!this.room.decalLog) this.room.decalLog = [];
    if (this.room.decalLog.length < 160) this.room.decalLog.push(d);
    this.applyDecal(d);
    this.floorDirty = true;
  }
  applyDecal(d) {
    const ctx = this.floorCanvas.getContext('2d');
    const rng = new RNG(d.seed);
    if (d.kind === 'scorch') stampScorch(ctx, d.x, d.z, d.size, rng);
    else stampSplat(ctx, d.x, d.z, d.size, d.color, rng);
  }
  /** Called once per rendered frame */
  sync() {
    if (this.floorDirty) { this.floorTex.needsUpdate = true; this.floorDirty = false; }
  }

  dispose() {
    for (const s of this.obstacleSprites.values()) freeSprite(s);
    for (const s of this.doorSprites) freeSprite(s);
    // free any entity sprites still in the layer
    for (const c of [...this.layer.children]) { if (c.isSprite) freeSprite(c); else if (c.isMesh) freeFlat(c); else this.layer.remove(c); }
    gfx.scene.remove(this.group);
    for (const d of this.disposables) d.dispose();
    for (const d of this.wallDisposables) d.dispose();
  }
}
