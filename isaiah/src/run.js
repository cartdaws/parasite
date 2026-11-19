// One playthrough: seed, seeded RNG streams, item pools (no repeats), pill
// color mapping, curses, deal-room bookkeeping and death-note stats.
import { RNG, hashString } from './core/rng.js';
import { CFG } from './config.js';
import { ITEMS, TRINKETS } from './items/items.js';
import { CARDS, PILLS } from './items/consumables.js';
import { PILL_COLORS } from './render/art_pickups.js';

export const CURSES = {
  darkness: { name: 'Curse of Darkness', desc: 'the lights go out' },
  lost: { name: 'Curse of the Lost', desc: 'you forget the way' },
  maze: { name: 'Curse of the Maze', desc: 'the rooms shift around' },
  unknown: { name: 'Curse of the Unknown', desc: 'you cannot feel your heart' },
  labyrinth: { name: 'Curse of the Labyrinth', desc: 'two floors become one' },
};

export class Run {
  constructor(seed, charId) {
    this.seed = seed;
    this.charId = charId;
    this.master = new RNG(hashString(seed));
    this.itemRng = new RNG(hashString(seed + ':items'));
    this.dropRng = new RNG(hashString(seed + ':drops'));
    this.aiRng = new RNG(hashString(seed + ':ai'));
    this.floorNum = 1;
    this.curse = null;
    this.time = 0;
    this.kills = 0;
    this.roomsCleared = 0;
    this.itemsSeen = new Set();
    this.trinketsSeen = new Set();
    this.dealTaken = false;       // took any Bargain deal this run
    this.bargainSkipped = 0;      // Bargain rooms visited without taking a deal
    this.bargainVisitedFloor = false;
    this.dealSeenOnFloor = false;
    this.pools = this.buildPools();
    // pills: shuffle which color means which effect
    const pr = new RNG(hashString(seed + ':pills'));
    const ids = Object.keys(PILLS);
    const colors = pr.shuffle(PILL_COLORS.map((_, i) => i));
    this.pillColor = {};
    ids.forEach((id, i) => { this.pillColor[id] = colors[i % colors.length]; });
    this.pillsKnown = new Set();
  }

  floorRng(n) { return new RNG(hashString(this.seed + ':floor:' + n)); }

  buildPools() {
    const pools = {};
    for (const [id, it] of Object.entries(ITEMS)) {
      if (it.noPool) continue;
      for (const p of it.pools || []) (pools[p] = pools[p] || []).push(id);
    }
    return pools;
  }
  /** Draw an item from a pool without repeats; falls back to treasure, then a filler item. */
  drawItem(pool, rng = this.itemRng) {
    const tryPool = (name) => {
      const list = (this.pools[name] || []).filter((id) => !this.itemsSeen.has(id));
      if (!list.length) return null;
      const weighted = list.map((id) => [id, CFG.TREASURE_QUALITY_WEIGHTS[ITEMS[id].quality ?? 1] ?? 1]);
      return rng.weighted(weighted);
    };
    let id = tryPool(pool);
    if (!id && pool !== 'treasure') id = tryPool('treasure');
    if (!id) id = 'breakfast';
    if (id !== 'breakfast') this.itemsSeen.add(id);
    return id;
  }
  drawTrinket(rng = this.dropRng) {
    const list = Object.keys(TRINKETS).filter((id) => !this.trinketsSeen.has(id));
    if (!list.length) return null;
    const id = rng.pick(list);
    this.trinketsSeen.add(id);
    return id;
  }
  randomCard(rng = this.dropRng) { return rng.pick(Object.keys(CARDS)); }
  randomPill(rng = this.dropRng) { return rng.pick(Object.keys(PILLS)); }
  pillColorOf(id) { return this.pillColor[id] ?? 0; }

  rollCurse(floorNum) {
    this.curse = null;
    if (floorNum === 1 || floorNum === CFG.FLOOR_COUNT) return null;
    const r = this.floorRng(floorNum).fork('curse');
    if (!r.chance(CFG.CURSE_CHANCE)) return null;
    const options = ['darkness', 'lost', 'maze', 'unknown'];
    if (floorNum <= CFG.FLOOR_COUNT - 2) options.push('labyrinth');
    this.curse = r.pick(options);
    return this.curse;
  }
}
