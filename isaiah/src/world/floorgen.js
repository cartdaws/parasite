// Floor layout generation, in the style of the original: a 13×13 cell grid,
// start in the center, rooms grown breadth-first with a "no loops" rule,
// dead ends turned into special rooms, boss on the furthest dead end, and a
// secret room tucked into a spot touching several rooms.
import { CFG, FLOORS } from '../config.js';
import { TEMPLATES } from './templates.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // top right bottom left
const OPP = [2, 3, 0, 1];

const SHAPES = {
  '1x1': { cw: 1, ch: 1, cells: [[0, 0]] },
  '2x1': { cw: 2, ch: 1, cells: [[0, 0], [1, 0]] },
  '1x2': { cw: 1, ch: 2, cells: [[0, 0], [0, 1]] },
  '2x2': { cw: 2, ch: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  'L00': { cw: 2, ch: 2, cells: [[1, 0], [0, 1], [1, 1]], notch: [0, 0] },
  'L10': { cw: 2, ch: 2, cells: [[0, 0], [0, 1], [1, 1]], notch: [1, 0] },
  'L01': { cw: 2, ch: 2, cells: [[0, 0], [1, 0], [1, 1]], notch: [0, 1] },
  'L11': { cw: 2, ch: 2, cells: [[0, 0], [1, 0], [0, 1]], notch: [1, 1] },
};
const BIG_SHAPES = [['2x1', 4], ['1x2', 4], ['2x2', 1.5], ['L00', 1], ['L10', 1], ['L01', 1], ['L11', 1]];

// enemy categories used by template letters
export const ENEMY_CAT = {
  turret: new Set(['pipe', 'wellspout', 'hive', 'molemite', 'nun']),
  fly: new Set(['gnat', 'twitchfly', 'halogn', 'draft', 'ember']),
};

const DOOR_PRIORITY = ['boss', 'bargain', 'chapel', 'treasure', 'shop', 'arcade', 'library', 'challenge', 'sacrifice', 'secret'];

export function generateFloor(rng, floorNum, opts = {}) {
  const N = CFG.GRID_SIZE;
  let target = Math.floor(CFG.ROOMS_PER_FLOOR_MULT * floorNum + rng.int(CFG.ROOMS_PER_FLOOR_ADD[0], CFG.ROOMS_PER_FLOOR_ADD[1]));
  if (opts.labyrinth) target = Math.floor(target * CFG.LABYRINTH_ROOM_MULT);
  target = Math.min(target, opts.labyrinth ? 34 : CFG.ROOMS_MAX);
  if (floorNum === CFG.FLOOR_COUNT) target = Math.min(target, 16);

  for (let attempt = 0; attempt < 400; attempt++) {
    const res = tryGenerate(rng, floorNum, target, N, opts);
    if (res) return res;
  }
  throw new Error('floor generation failed');
}

function tryGenerate(rng, floorNum, target, N, opts) {
  const cellMap = new Int16Array(N * N).fill(-1);
  const rooms = [];
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? -2 : cellMap[y * N + x]);
  const occupiedNeighbors = (x, y) => DIRS.reduce((n, [dx, dy]) => n + (at(x + dx, y + dy) >= 0 ? 1 : 0), 0);
  const addRoom = (gx, gy, shapeId) => {
    const sh = SHAPES[shapeId];
    const r = { id: rooms.length, gx, gy, cw: sh.cw, ch: sh.ch, shape: shapeId, notch: sh.notch || null, cells: sh.cells.map(([x, y]) => [gx + x, gy + y]), type: 'normal', doors: [] };
    for (const [x, y] of r.cells) cellMap[y * N + x] = r.id;
    rooms.push(r);
    return r;
  };
  const c0 = Math.floor(N / 2);
  const start = addRoom(c0, c0, '1x1');
  start.type = 'start';
  let queue = [start];
  let guard = 0;
  while (rooms.length < target && guard++ < 60) {
    if (!queue.length) queue = rng.shuffle(rooms.slice());
    const next = [];
    while (queue.length && rooms.length < target) {
      const room = queue.shift();
      for (const [cx, cy] of room.cells) {
        for (const d of rng.shuffle([0, 1, 2, 3])) {
          if (rooms.length >= target) break;
          const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
          if (at(nx, ny) !== -1) continue;
          if (rng.chance(0.5)) continue;
          // try a big room now and then (not next to the start room)
          if (room.type !== 'start' && rng.chance(CFG.BIG_ROOM_CHANCE) && floorNum < CFG.FLOOR_COUNT) {
            const shapeId = rng.weighted(BIG_SHAPES);
            const sh = SHAPES[shapeId];
            const offs = rng.shuffle(sh.cells.slice());
            let placed = null;
            for (const [ox, oy] of offs) {
              const gx = nx - ox, gy = ny - oy;
              const cells = sh.cells.map(([x, y]) => [gx + x, gy + y]);
              if (!cells.every(([x, y]) => at(x, y) === -1)) continue;
              // must touch only the parent room
              const touching = new Set();
              for (const [x, y] of cells) for (const [dx, dy] of DIRS) { const v = at(x + dx, y + dy); if (v >= 0) touching.add(v); }
              if (touching.size !== 1 || !touching.has(room.id)) continue;
              // the edge to the parent must not face the L notch
              placed = addRoom(gx, gy, shapeId);
              break;
            }
            if (placed) { next.push(placed); continue; }
          }
          if (occupiedNeighbors(nx, ny) > 1) continue;
          next.push(addRoom(nx, ny, '1x1'));
        }
      }
    }
    queue = next;
  }
  if (rooms.length < target) return null;

  // ---- doors between adjacent rooms -----------------------------------------
  const inBBox = (r, x, y) => x >= r.gx && y >= r.gy && x < r.gx + r.cw && y < r.gy + r.ch;
  const doorCapable = (r, x, y, d) => { const nx = x + DIRS[d][0], ny = y + DIRS[d][1]; return !inBBox(r, nx, ny); };
  const link = () => {
    for (const r of rooms) r.doors = [];
    for (const r of rooms) {
      for (const [x, y] of r.cells) {
        for (let d = 0; d < 4; d++) {
          if (!doorCapable(r, x, y, d)) continue;
          const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
          const o = at(nx, ny);
          if (o < 0 || o === r.id) continue;
          const other = rooms[o];
          if (!doorCapable(other, nx, ny, OPP[d])) continue;
          r.doors.push({ side: d, lx: x - r.gx, ly: y - r.gy, to: o, cell: [x, y] });
        }
      }
    }
  };
  link();
  // connectivity check (L notches can isolate rooms)
  const dist = bfs(rooms, start.id);
  if (dist.some((v) => v < 0)) return null;

  // ---- special rooms --------------------------------------------------------
  const deadEnds = rooms.filter((r) => r.type === 'normal' && r.shape === '1x1' && r.doors.length === 1);
  const needed = 2 + (floorNum < CFG.FLOOR_COUNT ? 1 : 0); // boss, treasure, shop
  if (deadEnds.length < needed) return null;
  deadEnds.sort((a, b) => dist[b.id] - dist[a.id]);
  const boss = deadEnds[0];
  if (dist[boss.id] < 3) return null;
  boss.type = 'boss';
  const pool = rng.shuffle(deadEnds.slice(1));
  // two boss rooms on labyrinth floors would be confusing; keep one and add a second treasure room
  const take = (type) => { const r = pool.shift(); if (r) r.type = type; return r; };
  if (floorNum < CFG.FLOOR_COUNT || opts.labyrinth) take('treasure');
  if (opts.labyrinth) take('treasure');
  if (floorNum < CFG.FLOOR_COUNT) take('shop');
  for (const [type, p] of Object.entries(CFG.OPTIONAL_ROOMS)) {
    if (pool.length && rng.chance(p)) take(type);
  }
  if (floorNum === CFG.FLOOR_COUNT && pool.length) take('treasure');

  // ---- secret room ----------------------------------------------------------
  if (rng.chance(CFG.SECRET_ROOM_CHANCE)) {
    let best = null, bestScore = 0;
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      if (at(x, y) !== -1) continue;
      let score = 0, bad = false;
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        const o = at(nx, ny);
        if (o < 0) continue;
        const r = rooms[o];
        if (r.type === 'boss') { bad = true; break; }
        if (!doorCapable(r, nx, ny, OPP[d])) continue;
        score += r.type === 'normal' || r.type === 'start' ? 1 : 0.6;
      }
      if (bad) continue;
      score += rng.next() * 0.3;
      if (score > bestScore) { bestScore = score; best = [x, y]; }
    }
    if (best && bestScore >= 2) {
      const s = addRoom(best[0], best[1], '1x1');
      s.type = 'secret';
      link();
    }
  }

  // ---- door kinds -----------------------------------------------------------
  for (const r of rooms) {
    for (const d of r.doors) {
      const other = rooms[d.to];
      const types = [r.type, other.type];
      d.kind = types.includes('secret') ? 'secret' : DOOR_PRIORITY.find((t) => types.includes(t)) || 'normal';
      // hidden from outside only: from inside a secret room you can always see the way out
      d.hidden = d.kind === 'secret' && r.type !== 'secret';
      d.lock = null;
      if (d.kind === 'secret') continue;
      // locked doors only when entering the special room from outside
      if (other.type === 'shop' || other.type === 'library') d.lock = 'key';
      if (other.type === 'arcade') d.lock = 'coin';
      if (other.type === 'treasure' && floorNum >= 3 && !opts.labyrinth) d.lock = 'key';
    }
  }

  // ---- per-room content picks (templates, enemy types, bosses) ---------------
  const fl = FLOORS[floorNum];
  const turrets = fl.enemies.filter((e) => ENEMY_CAT.turret.has(e));
  const flies = fl.enemies.filter((e) => ENEMY_CAT.fly.has(e));
  const ground = fl.enemies.filter((e) => !ENEMY_CAT.turret.has(e) && !ENEMY_CAT.fly.has(e));
  const okTemplates = TEMPLATES.filter((t) => (t.minFloor || 1) <= floorNum && (t.maxFloor || 99) >= floorNum);
  for (const r of rooms) {
    r.seed = rng.int(1, 2 ** 31);
    r.dist = dist[r.id] ?? 99;
    if (r.type === 'normal') {
      const cells = r.cells.length;
      r.templates = [];
      for (let i = 0; i < cells; i++) r.templates.push({ id: rng.pick(okTemplates).id, flipX: rng.chance(0.5), flipY: rng.chance(0.5) });
      const a = rng.pick(ground), b = rng.chance(0.55) ? rng.pick(ground) : a;
      r.enemyTypes = { e: a, E: b, w: flies.length ? rng.pick(flies) : a, T: turrets.length ? rng.pick(turrets) : b };
    }
    if (r.type === 'boss') r.boss = floorNum === CFG.FLOOR_COUNT ? 'housemother' : rng.pick(fl.bosses);
    if (r.type === 'challenge') r.waveTypes = [rng.pick(ground), rng.pick(ground), rng.pick(fl.enemies)];
  }
  // a fresh BFS distance including the secret room (minimap needs it)
  return { rooms, cellMap, N, startId: start.id, bossId: boss.id };
}

function bfs(rooms, startId) {
  const dist = rooms.map(() => -1);
  dist[startId] = 0;
  const q = [startId];
  for (let i = 0; i < q.length; i++) {
    const r = rooms[q[i]];
    for (const d of r.doors) if (dist[d.to] < 0) { dist[d.to] = dist[r.id] + 1; q.push(d.to); }
  }
  return dist;
}

export function oppositeSide(s) { return OPP[s]; }
export { DIRS as GRID_DIRS };
