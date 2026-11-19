// Game rules for items and interactive props: giving items, active items,
// cards/pills, bombs, chests, shop, machines, sacrifice/challenge rooms and
// the post-boss Bargain/Chapel door.
import { CFG } from '../config.js';
import { S } from '../state.js';
import { audio } from '../core/audio.js';
import { ITEMS, TRINKETS } from './items.js';
import { CARDS, PILLS } from './consumables.js';
import { runHook } from './hooks.js';
import { spawnPickup, spawnReward } from '../entities/pickups.js';
import { spawnBomb } from '../entities/bombs.js';
import { spawnBoss } from '../entities/bosses.js';
import { spawnEnemy } from '../entities/enemies.js';
import { syncFamiliars } from '../entities/familiars.js';
import { itemIconTex, cardTex } from '../render/art_items.js';
import { pillTex, shopkeeperTex, machineTex } from '../render/art_pickups.js';
import { makeSprite, freeSprite, place, makeShadow, freeFlat, placeFlat, setTex } from '../render/gfx.js';
import { particles, poof, gore } from '../entities/effects.js';
import { Room } from '../world/room.js';
import { fillRoom } from '../world/roomfill.js';
import { RNG } from '../core/rng.js';

// ---- items -------------------------------------------------------------------
/** Give an item. Returns the id of an active item that was swapped out (to put back on the pedestal). */
export function giveItem(p, id, pedestal = null) {
  const def = ITEMS[id];
  if (!def) return null;
  let swapped = null;
  if (def.type === 'active') {
    if (p.active) swapped = p.active.id;
    p.active = { id, charge: def.charge ?? 0, maxCharge: def.charge ?? 0 };
  } else {
    p.items.push(id);
  }
  if (def.onPickup) def.onPickup(p);
  p.refresh();
  syncFamiliars(p);
  p.showHeld(itemIconTex(id));
  S.game.banner(def.name, def.tagline);
  audio.play(def.quality === 0 && def.bad ? 'badFanfare' : 'fanfare');
  S.run.itemsCollected = (S.run.itemsCollected || 0) + 1;
  return swapped;
}

export function chargeActive(p, n) {
  if (!p.active) return;
  const def = ITEMS[p.active.id];
  if (!def || !def.charge) return;
  const before = p.active.charge;
  p.active.charge = Math.min(def.charge, p.active.charge + n);
  if (before < def.charge && p.active.charge >= def.charge && n < 99) audio.play('charged');
}
export function useActive(p) {
  if (!p.active) return;
  const def = ITEMS[p.active.id];
  if (!def) return;
  if ((def.charge || 0) > 0 && p.active.charge < def.charge) { audio.play('back'); return; }
  const res = def.use ? def.use(p) : true;
  if (res === false) return;
  p.active.charge = 0;
  if (def.singleUse) p.active = null;
  audio.play('active');
  p.showHeld(itemIconTex(def.id), 0.5);
}

export function usePocket(p) {
  const pk = p.pocket;
  if (!pk) return;
  p.pocket = null;
  if (pk.type === 'card') {
    const c = CARDS[pk.id];
    S.game.banner(c.name, c.desc);
    audio.play('card');
    c.use(p);
    p.showHeld(cardTex(pk.id), 0.6);
  } else {
    const pill = PILLS[pk.id];
    S.run.pillsKnown.add(pk.id);
    S.game.banner(pill.name, '');
    audio.play('pill');
    pill.use(p);
    p.showHeld(pillTex(S.run.pillColorOf(pk.id)), 0.6);
  }
  runHook(p, 'onPocketUse', p, pk);
}

export function dropTrinket(p) {
  if (!p.trinket) return;
  spawnPickup('trinket', p.x, p.z + 0.4, { sub: p.trinket, delay: 1.2 });
  p.trinket = null;
  p.refresh();
}

export function placeBomb(p) {
  if (p.bombs <= 0 && !p.hasItem('bottomless_bag')) {
    // remote bombs: detonate existing ones
    return;
  }
  // remote detonation: if you have remote bombs out, E detonates them instead
  if (p.tearFlags.remoteBombs && S.bombs.some((b) => b.alive && b.owner === 'player' && b.fuse > 50)) {
    for (const b of S.bombs) if (b.alive && b.owner === 'player') b.fuse = 0;
    return;
  }
  if (!p.hasItem('bottomless_bag')) p.bombs--;
  const f = p.tearFlags;
  spawnBomb(p.x, p.z, { big: !!f.bigBombs, remote: !!f.remoteBombs, sticky: !!f.stickyBombs, homing: !!f.homingBombs, poison: !!f.poisonBombs, scatter: !!f.scatterBombs });
  audio.play('fuse');
}

// ---- chests ------------------------------------------------------------------
export function openChest(ch) {
  const rng = S.run.dropRng;
  const x = ch.x, z = ch.z;
  const luck = S.player.stats.luck;
  if (ch.sub === 'red') {
    const r = rng.next();
    if (r < 0.15) { spawnEnemy('spider', x, z + 0.5); spawnEnemy('spider', x + 0.4, z + 0.5); }
    else if (r < 0.3) { S.player.hurt(1, 'a red chest'); }
    else if (r < 0.5) { spawnReward('soul', x, z, rng); spawnReward('black', x, z, rng); }
    else if (r < 0.62) { spawnPickup('pedestal', x, z - 0.1, { itemId: S.run.drawItem('bargain'), pool: 'bargain' }); ch.destroy(); }
    else { spawnReward('black', x, z, rng); spawnReward('pill', x, z, rng); }
    return;
  }
  if (ch.sub === 'locked' && rng.chance(0.14 + luck * 0.01)) {
    spawnPickup('pedestal', x, z - 0.1, { itemId: S.run.drawItem('treasure'), pool: 'treasure' });
    ch.destroy();
    return;
  }
  const n = ch.sub === 'locked' ? rng.int(2, 4) : rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    const kind = rng.weighted([['coin', 30], ['heart', 14], ['key', 10], ['bomb', 10], ['pill', 6], ['card', 6], ['trinket', ch.sub === 'locked' ? 6 : 2], ['battery', 2]]);
    spawnReward(kind, x, z, rng, { spread: 2.2 });
  }
}

// ---- room contents --------------------------------------------------------------
export function spawnContent(c, room, rng) {
  const run = S.run;
  switch (c.kind) {
    case 'pedestal': {
      const itemId = run.drawItem(c.pool);
      let heartPrice = 0;
      if (c.price === 'hearts') heartPrice = (ITEMS[itemId]?.quality ?? 2) >= 3 ? 2 : 1;
      spawnPickup('pedestal', c.x, c.z, { itemId, pool: c.pool, heartPrice, choice: c.choice ? c.choice + room.id : null });
      break;
    }
    case 'boss': spawnBoss(c.id, c.x, c.z); break;
    case 'pickup': spawnReward(c.pickup, c.x, c.z, rng, { spread: 0.3, vh: 1 }); break;
    case 'shopkeeper': spawnProp({ kind: 'shopkeeper', x: c.x, z: c.z }); break;
    case 'shopitem': {
      const P = CFG.PRICES;
      const sale = S.player.hasItem('coupon') ? 0.5 : 1;
      const price = (n) => Math.max(1, Math.round(n * sale));
      if (c.good === 'item') spawnPickup('pedestal', c.x, c.z, { itemId: run.drawItem('shop'), pool: 'shop', price: price(P.item), shopGood: 'item' });
      else if (c.good === 'heart') spawnPickup('heart', c.x, c.z, { sub: 'full', price: price(P.heart), shopGood: c.good });
      else if (c.good === 'soul') spawnPickup('heart', c.x, c.z, { sub: 'soul', price: price(P.soul), shopGood: c.good });
      else if (c.good === 'bomb') spawnPickup('bomb', c.x, c.z, { sub: 'single', price: price(P.bomb), shopGood: c.good });
      else if (c.good === 'key') spawnPickup('key', c.x, c.z, { sub: 'normal', price: price(P.key), shopGood: c.good });
      else if (c.good === 'card') spawnPickup('card', c.x, c.z, { sub: run.randomCard(rng), price: price(P.card), shopGood: c.good });
      else if (c.good === 'pill') spawnPickup('pill', c.x, c.z, { sub: run.randomPill(rng), price: price(P.pill), shopGood: c.good });
      else if (c.good === 'battery') spawnPickup('battery', c.x, c.z, { price: price(P.battery), shopGood: c.good });
      break;
    }
    case 'machine': spawnProp({ kind: 'machine', machine: c.machine, x: c.x, z: c.z }); break;
    case 'sacrifice': spawnProp({ kind: 'sacrifice', x: c.x, z: c.z }); break;
    case 'challenge': spawnProp({ kind: 'challenge', x: c.x, z: c.z }); break;
    default: break;
  }
}

// ---- props: shopkeeper, machines, sacrifice spikes, challenge waves ------------
class Prop {
  constructor(o) {
    Object.assign(this, o);
    this.alive = true; this.persist = true; this.t = 0;
    this.r = 0.5;
    if (this.kind === 'shopkeeper') { this.spr = makeSprite(shopkeeperTex(!!this.dead), 1.2, 1.2); this.shadow = makeShadow(0.9); }
    if (this.kind === 'machine') { this.spr = makeSprite(machineTex(this.machine, !!this.broken), 1.15, 1.4); this.shadow = makeShadow(1); this.r = 0.55; }
    if (this.kind === 'challenge') { this.persist = false; this.initChallenge(); }
    if (this.kind === 'sacrifice') { this.count = this.count || 0; }
    this.solid = this.kind === 'shopkeeper' || this.kind === 'machine';
  }
  serialize() { return { kind: this.kind, machine: this.machine, x: this.x, z: this.z, dead: this.dead, broken: this.broken, count: this.count }; }
  sync() {
    if (this.spr) place(this.spr, this.x, this.z + 0.3, 0, 0);
    if (this.shadow) placeFlat(this.shadow, this.x, this.z + 0.2);
  }
  destroy() { if (this.spr) freeSprite(this.spr); if (this.shadow) freeFlat(this.shadow); this.spr = this.shadow = null; this.alive = false; }
  update(dt) {
    this.t += dt;
    const p = S.player;
    if (this.solid) { // push the player out
      const dx = p.x - this.x, dz = p.z - (this.z + 0.1), d = Math.hypot(dx, dz), rr = this.r + p.r;
      if (d < rr && d > 1e-4) { p.x += (dx / d) * (rr - d); p.z += (dz / d) * (rr - d); this.touch(p); }
    }
    if (this.kind === 'sacrifice') {
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      if (d < 0.55 && p.invuln <= 0) this.sacrifice(p);
    }
    if (this.kind === 'challenge') this.updateChallenge(dt);
  }
  touch(p) {
    if (this.kind !== 'machine' || this.broken) return;
    if (this.cd && this.t < this.cd) return;
    this.cd = this.t + 0.8;
    const rng = S.run.dropRng;
    const out = { x: this.x, z: this.z + 0.9 };
    if (this.machine === 'slot') {
      if (p.coins <= 0) return;
      p.coins--; audio.play('coin');
      const r = rng.next() - p.stats.luck * 0.02;
      if (r < 0.45) { audio.play('back'); return; }
      const prize = rng.weighted([['coin', 30], ['coin2', 12], ['heart', 10], ['bomb', 10], ['key', 10], ['pill', 8], ['fly', 6], ['item', 1.5]]);
      audio.play('select');
      if (prize === 'coin2') { spawnReward('coin', out.x, out.z, rng); spawnReward('coin', out.x, out.z, rng); }
      else if (prize === 'fly') spawnEnemy('gnat', out.x, out.z);
      else if (prize === 'item') { spawnPickup('pedestal', out.x, out.z + 0.4, { itemId: S.run.drawItem('treasure'), pool: 'treasure' }); this.broken = true; setTex(this.spr, machineTex(this.machine, true)); }
      else spawnReward(prize, out.x, out.z, rng);
      if (rng.chance(0.03)) this.breakMachine();
    } else if (this.machine === 'blood') {
      if (p.totalHalves <= 1) return;
      p.hurt(1, 'a blood donation machine', { redFirst: true, ignoreInvuln: true, invuln: 0.6 });
      const n = rng.int(1, 2) + (rng.chance(0.08) ? 3 : 0);
      for (let i = 0; i < n; i++) spawnReward('coin', out.x, out.z, rng);
      if (rng.chance(0.04)) this.breakMachine();
    } else if (this.machine === 'fortune') {
      if (p.coins <= 0) return;
      p.coins--; audio.play('coin');
      const r = rng.next();
      if (r < 0.6) S.game.banner(rng.pick(FORTUNES), 'the machine whirs');
      else if (r < 0.75) spawnReward('soul', out.x, out.z, rng);
      else if (r < 0.88) spawnReward('card', out.x, out.z, rng);
      else spawnReward('trinket', out.x, out.z, rng);
    }
  }
  breakMachine() {
    if (this.broken) return;
    this.broken = true;
    setTex(this.spr, machineTex(this.machine, true));
    audio.play('rock');
    const rng = S.run.dropRng;
    for (let i = 0; i < 3; i++) spawnReward(rng.pick(['coin', 'coin', 'heart', 'bomb', 'key']), this.x, this.z + 0.8, rng);
    poof(this.x, this.z, 0x8a8a8a, 1);
  }
  bombed() {
    if (this.kind === 'shopkeeper' && !this.dead) {
      this.dead = true;
      setTex(this.spr, shopkeeperTex(true));
      const rng = S.run.dropRng;
      const n = rng.int(CFG.SHOPKEEPER_COINS[0], CFG.SHOPKEEPER_COINS[1]);
      for (let i = 0; i < n; i++) spawnReward('coin', this.x, this.z + 0.6, rng, { spread: 2.5 });
      gore(this.x, this.z, 0.8);
    } else if (this.kind === 'machine') this.breakMachine();
  }
  sacrifice(p) {
    this.count++;
    p.hurt(1, 'the sacrifice spikes', { redFirst: true, ignoreInvuln: true });
    const rng = S.run.dropRng;
    const c = this.count;
    const at = { x: this.x, z: this.z - 1 };
    if (c <= 2) { if (rng.chance(0.5)) spawnReward('coin', at.x, at.z, rng); }
    else if (c === 3) { if (rng.chance(0.66)) spawnReward('chest', at.x, at.z, rng); }
    else if (c === 4) { spawnReward('soul', at.x, at.z, rng); }
    else if (c === 5) { if (rng.chance(0.33)) spawnPickup('pedestal', at.x, at.z - 0.5, { itemId: S.run.drawItem('chapel'), pool: 'chapel' }); else spawnReward('soul', at.x, at.z, rng); }
    else if (c === 6) { for (let i = 0; i < 3; i++) spawnReward('heart', at.x, at.z, rng); }
    else if (c === 7) { if (rng.chance(0.5)) spawnPickup('pedestal', at.x, at.z - 0.5, { itemId: S.run.drawItem('treasure'), pool: 'treasure' }); }
    else if (rng.chance(0.3)) spawnReward(rng.pick(['soul', 'chest', 'black']), at.x, at.z, rng);
  }
  initChallenge() {
    const room = S.room;
    if (room.challengeDone) { this.alive = false; return; }
    this.wave = 0;
    this.waves = 3;
    this.spawnWave();
  }
  spawnWave() {
    const room = S.room;
    const rng = new RNG((room.seed || 1) + this.wave * 13);
    const types = room.waveTypes || ['moaner', 'gnat', 'clot'];
    const n = 3 + this.wave + Math.floor(S.floorNum / 2);
    for (let i = 0; i < n; i++) {
      const pos = room.randomFree(rng, 1);
      const e = spawnEnemy(types[(this.wave + i) % types.length], pos.x, pos.z, { champion: rng.chance(0.15) ? rng.pick(CFG.CHAMPION_TYPES) : null });
      if (e) e.spawnGrace = 0.6;
    }
    poof(room.W / 2, room.H / 2, 0xaa3333, 1.2);
    audio.play('roar');
    this.wave++;
  }
  updateChallenge(dt) {
    if (S.enemies.some((e) => e.alive && !e.ignoreClear)) { this.wait = 0.8; return; }
    if (this.wait > 0) { this.wait -= dt; S.game.pendingSpawns = true; return; }
    S.game.pendingSpawns = false;
    if (this.wave < this.waves) { this.spawnWave(); return; }
    const room = S.room;
    room.challengeDone = true;
    spawnPickup('pedestal', room.W / 2, room.H / 2, { itemId: S.run.drawItem(S.floorNum >= 3 ? 'boss' : 'treasure'), pool: 'treasure' });
    this.alive = false;
  }
}
const FORTUNES = [
  'Grandma kept the good spoons down here.', 'Something is counting the stairs.', 'Your tears are worth more than you think.',
  'Do not answer if the ceiling calls.', 'Lucky numbers: 4, 13, a half.', 'The Housemother never forgets a face.',
  'A penny saved is a penny spent later.', 'Bring a candle. Bring two.', 'Someone left the light on for you.',
];

export function spawnProp(o) { const p = new Prop(o); if (p.alive) S.misc.push(p); return p; }
export function explosionHitsProps(x, z, radius) {
  for (const m of S.misc) if (m.alive && m.bombed && Math.hypot(m.x - x, m.z - z) < radius + 0.6) m.bombed();
}

// ---- deal rooms (Bargain / Chapel) --------------------------------------------------
export function dealChance() {
  const D = CFG.DEAL, run = S.run, p = S.player;
  if (S.floorNum < 2) return D.floor1Chance;
  let c = D.baseChance;
  if (p.damageTakenFloor) c *= D.damagePenalty;
  if (p.damageTakenBoss) c *= D.bossDamagePenalty;
  if (run.dealSeenLastFloor) c *= 0.5;
  c += (p.dealBonus || 0);
  return Math.min(1, c);
}
export function maybeSpawnDealDoor(bossRoom, rng) {
  const run = S.run;
  run.dealSeenLastFloor = false;
  if (!rng.chance(dealChance())) return;
  // decide Bargain vs Chapel
  const D = CFG.DEAL;
  let chapel = D.chapelBaseShare + run.bargainSkipped * D.chapelSkipBonus + (S.player.chapelBonus || 0);
  if (run.dealTaken && D.chapelTakenPenalty) chapel = 0;
  const type = rng.chance(Math.min(0.9, chapel)) ? 'chapel' : 'bargain';
  openDealDoor(bossRoom, type);
}
export function openDealDoor(bossRoom, type) {
  const floor = S.floor;
  const used = new Set(bossRoom.doors.map((d) => d.side));
  const side = [0, 1, 3, 2].find((s) => !used.has(s));
  if (side == null) return;
  const id = floor.rooms.length;
  const def = { id, gx: -30 - id * 2, gy: -30, cw: 1, ch: 1, shape: '1x1', notch: null, cells: [[-30 - id * 2, -30]], type, seed: (Math.random() * 1e9) | 0, offgrid: true, doors: [{ side: (side + 2) % 4, lx: 0, ly: 0, to: bossRoom.id, kind: type, offgrid: true }] };
  const room = new Room(def);
  room.cleared = true;
  floor.rooms.push(room);
  const d = { side, lx: 0, ly: 0, to: id, kind: type, offgrid: true };
  bossRoom.placeDoor(d);
  bossRoom.doors.push(d);
  S.view.rebuildWalls();
  S.view.buildDoors();
  S.run.dealSeenLastFloor = true;
  audio.play(type === 'chapel' ? 'chapel' : 'bargain');
  poof(d.x, d.z, type === 'chapel' ? 0xfff6c0 : 0x601010, 1.4);
}
