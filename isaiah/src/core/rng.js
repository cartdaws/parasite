// Seeded RNG (mulberry32) + helpers. Every procedural decision draws from one of
// these so a seed reproduces the same run.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTWXYZ01234V6789';
/** Isaac-style seed text: "XXXX XXXX" */
export function randomSeedString() {
  let s = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) s += ' ';
    s += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)];
  }
  return s;
}
export function normalizeSeed(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (clean.length < 1) return randomSeedString();
  const p = clean.padEnd(8, '0');
  return p.slice(0, 4) + ' ' + p.slice(4);
}

export class RNG {
  constructor(seed) {
    this.s = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 0x9e3779b9;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** entries: [[value, weight], ...] */
  weighted(entries) {
    let total = 0;
    for (const e of entries) total += e[1];
    let r = this.next() * total;
    for (const e of entries) { if ((r -= e[1]) < 0) return e[0]; }
    return entries[entries.length - 1][0];
  }
  fork(label) { return new RNG(hashString(this.s + ':' + label)); }
}

/** Non-seeded RNG for cosmetic randomness (particles, wobble) */
export const fxRng = new RNG((Math.random() * 4294967296) >>> 0);
