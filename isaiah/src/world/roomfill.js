// Turns a generated room definition into a playable grid: applies templates,
// clears door approaches, guarantees doors connect, and lists what to spawn on
// the first visit (enemies, pedestals, shop goods, machines...).
import { RNG } from '../core/rng.js';
import { TEMPLATES, templateGrid } from './templates.js';
import { tileBlocks, M_WALK, SIDE_VEC } from './room.js';

const CHAR_TILE = { r: 'rock', R: 'trock', m: 'metal', p: 'pit', '^': 'spikes', o: 'poop', f: 'fire', t: 'tnt', u: 'urn' };
const TPL_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

function newTile(t, floorNum) {
  if (t === 'poop') return { t, hp: 4, stage: 0 };
  if (t === 'fire') return { t, hp: 3, lit: true };
  if (t === 'tnt') return { t, hp: 2 };
  if (t === 'rock') return { t, v: Math.floor(Math.random() * 3) };
  return { t };
}

export function fillRoom(room, floorNum) {
  const rng = new RNG(room.seed || 1);
  room.contents = [];
  room.spawns = [];
  if (room.type === 'normal') applyTemplates(room, rng, floorNum);
  else fillSpecial(room, rng, floorNum);
  sanitize(room, rng);
  room.built = true;
}

function applyTemplates(room, rng, floorNum) {
  const cells = room.cells.map(([x, y]) => [x - room.gx, y - room.gy]);
  cells.forEach(([lx, ly], i) => {
    const pick = room.templates[i] || room.templates[0];
    const tpl = TPL_BY_ID[pick.id] || TEMPLATES[0];
    const rows = templateGrid(tpl, pick.flipX, pick.flipY);
    // big rooms: thin out enemies a little so a 2x2 isn't 4 full rooms of monsters
    const enemyKeep = room.cells.length > 1 ? 0.7 : 1;
    const ox = lx * 15, oy = ly * 9;
    for (let y = 0; y < 7; y++) for (let x = 0; x < 13; x++) {
      const ch = rows[y][x];
      const tx = ox + x, ty = oy + y;
      if (!room.inBounds(tx, ty) || room.tile(tx, ty).t === 'void') continue;
      if (CHAR_TILE[ch]) room.setTile(tx, ty, newTile(CHAR_TILE[ch], floorNum));
      else if ('eEwT'.includes(ch) && rng.chance(enemyKeep)) room.spawns.push({ x: tx + 0.5, z: ty + 0.5, type: room.enemyTypes[ch] || room.enemyTypes.e });
    }
  });
  if (!room.spawns.length) { const c = room.randomFree(rng, 2); room.spawns.push({ x: c.x, z: c.z, type: room.enemyTypes.e }); }
}

function fillSpecial(room, rng, floorNum) {
  const cx = room.W / 2, cz = room.H / 2;
  const set = (tx, ty, t) => room.setTile(tx, ty, newTile(t, floorNum));
  switch (room.type) {
    case 'start':
      break;
    case 'treasure':
      room.contents.push({ kind: 'pedestal', pool: 'treasure', x: cx, z: cz });
      if (rng.chance(0.5)) { set(1, 1, 'rock'); set(11, 1, 'rock'); set(1, 5, 'rock'); set(11, 5, 'rock'); }
      break;
    case 'boss':
      room.contents.push({ kind: 'boss', id: room.boss, x: cx, z: cz - 0.5 });
      break;
    case 'shop': {
      room.contents.push({ kind: 'shopkeeper', x: cx, z: 1.4 });
      const goods = ['item', rng.pick(['heart', 'heart', 'soul']), rng.pick(['bomb', 'key']), rng.pick(['card', 'pill', 'bomb', 'key', 'battery'])];
      if (floorNum >= 2 && rng.chance(0.5)) goods.push('item');
      const n = goods.length;
      goods.forEach((g, i) => room.contents.push({ kind: 'shopitem', good: g, x: cx + (i - (n - 1) / 2) * 2.2, z: cz + 0.6 }));
      break;
    }
    case 'secret':
      if (rng.chance(0.45)) room.contents.push({ kind: 'pedestal', pool: 'secret', x: cx, z: cz });
      else {
        const loot = rng.pick([['coin', 'coin', 'coin', 'coin', 'coin'], ['bomb', 'bomb', 'key'], ['chest', 'coin', 'coin'], ['soul', 'coin', 'bomb'], ['lockedchest', 'key']]);
        loot.forEach((k, i) => room.contents.push({ kind: 'pickup', pickup: k, x: cx + (i - (loot.length - 1) / 2) * 1.2, z: cz }));
      }
      break;
    case 'sacrifice':
      set(6, 3, 'spikes');
      room.contents.push({ kind: 'sacrifice', x: 6.5, z: 3.5 });
      break;
    case 'challenge':
      room.contents.push({ kind: 'challenge', x: cx, z: cz });
      room.spawns = [];
      break;
    case 'arcade':
      room.contents.push({ kind: 'machine', machine: 'slot', x: 3.5, z: 2.2 });
      room.contents.push({ kind: 'machine', machine: 'slot', x: 9.5, z: 2.2 });
      room.contents.push({ kind: 'machine', machine: 'blood', x: 6.5, z: 1.6 });
      room.contents.push({ kind: 'machine', machine: 'fortune', x: 6.5, z: 5.2 });
      break;
    case 'library':
      room.contents.push({ kind: 'pedestal', pool: 'library', x: cx - 1.6, z: cz, choice: 'lib' });
      room.contents.push({ kind: 'pedestal', pool: 'library', x: cx + 1.6, z: cz, choice: 'lib' });
      for (let x = 1; x < 12; x += 2) set(x, 0, 'metal');
      break;
    case 'bargain': {
      const n = rng.chance(0.4) ? 3 : 2;
      for (let i = 0; i < n; i++) room.contents.push({ kind: 'pedestal', pool: 'bargain', x: cx + (i - (n - 1) / 2) * 3, z: cz - 0.3, price: 'hearts' });
      set(1, 1, 'fire'); set(11, 1, 'fire'); set(1, 5, 'fire'); set(11, 5, 'fire');
      room.tiles_blue_fire = true;
      break;
    }
    case 'chapel': {
      const n = rng.chance(0.3) ? 2 : 1;
      for (let i = 0; i < n; i++) room.contents.push({ kind: 'pedestal', pool: 'chapel', x: cx + (i - (n - 1) / 2) * 3, z: cz - 0.3, choice: n > 1 ? 'chapel' : null });
      break;
    }
    default: break;
  }
}

/** Keep door approaches clear and make sure every door can reach every other door. */
function sanitize(room, rng) {
  const doorTiles = room.doors.map((d) => {
    const inward = SIDE_VEC[(d.side + 2) % 4];
    return { tx: d.tx, ty: d.ty, in: inward };
  });
  for (const d of doorTiles) {
    for (let k = 0; k < 2; k++) {
      for (let s = -1; s <= 1; s++) {
        const tx = d.tx + d.in[0] * k + (d.in[0] === 0 ? s : 0);
        const ty = d.ty + d.in[1] * k + (d.in[1] === 0 ? s : 0);
        const t = room.tile(tx, ty);
        if (t && t.t !== 'void' && t.t !== 'floor') room.setTile(tx, ty, { t: 'floor' });
        room.spawns = room.spawns.filter((sp) => !(Math.floor(sp.x) === tx && Math.floor(sp.z) === ty));
      }
    }
  }
  // connectivity: carve the cheapest path from the first door to each other door
  if (doorTiles.length < 2) return;
  const W = room.W, H = room.H;
  const src = doorTiles[0];
  for (let i = 1; i < doorTiles.length; i++) {
    const dst = doorTiles[i];
    const dist = room.flowField(src.tx, src.ty, M_WALK);
    if (dist[dst.ty * W + dst.tx] >= 0) continue;
    // Dijkstra-lite: obstacles cost 8, floor 1
    const cost = new Float32Array(W * H).fill(1e9), prev = new Int32Array(W * H).fill(-1);
    const open = [[0, src.ty * W + src.tx]]; cost[src.ty * W + src.tx] = 0;
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [c, idx] = open.shift();
      if (c > cost[idx]) continue;
      const x = idx % W, y = (idx / W) | 0;
      if (x === dst.tx && y === dst.ty) break;
      for (const [dx, dy] of SIDE_VEC) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const t = room.grid[ny * W + nx].t;
        if (t === 'void') continue;
        const nc = c + (tileBlocks(t, M_WALK) ? 8 : 1);
        if (nc < cost[ny * W + nx]) { cost[ny * W + nx] = nc; prev[ny * W + nx] = idx; open.push([nc, ny * W + nx]); }
      }
    }
    let idx = dst.ty * W + dst.tx;
    while (idx >= 0) { if (tileBlocks(room.grid[idx].t, M_WALK)) room.grid[idx] = { t: 'floor' }; idx = prev[idx]; }
  }
}
