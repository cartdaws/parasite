// Stat aggregation using Rebirth-style formulas:
//   damage    = base * sqrt(1 + 1.2 * damageUps) + flat, then multipliers
//   fireDelay = 16 - 6 * sqrt(1.3 * tearsUps + 1)  (frames), tears/s = 30 / (delay + 1)
import { CFG } from '../config.js';
import { ITEMS, TRINKETS } from './items.js';

export const CHAR_BASE = {
  isaiah: { damage: 3.5, tearsUp: 0, range: 6.5, shotSpeed: 1.0, speed: 1.0, luck: 0, hearts: 3, soul: 0, startItems: [], startPocket: null, bombs: 1 },
  june: { damage: 4.2, tearsUp: -0.3, range: 7.0, shotSpeed: 1.05, speed: 0.95, luck: 1, hearts: 2, soul: 2, startItems: ['candle_stub'], startPocket: { type: 'card', id: 'moth' }, bombs: 1 },
};

const WEAPON_PRIORITY = ['laser', 'charged', 'tech', 'tears'];

/** All active stat sources for a player: items, trinket, temporary buffs */
export function statSources(p) {
  const out = [];
  for (const id of p.items) if (ITEMS[id]) out.push(ITEMS[id]);
  if (p.trinket && TRINKETS[p.trinket]) out.push(TRINKETS[p.trinket]);
  for (const b of p.buffs) out.push(b);
  return out;
}

export function recalcStats(p) {
  const base = CHAR_BASE[p.charId];
  const a = { dmg: 0, dmgFlat: 0, dmgMult: 1, tears: 0, tearsFlat: 0, tearsMult: 1, range: 0, shotSpeed: 0, speed: 0, luck: 0 };
  const flags = {};
  let tearColor = null, tearScale = 1, weapon = 'tears', shots = 1, spreadMode = 'fan', tearStyle = 'round';
  let flying = false, size = 1;
  for (const src of statSources(p)) {
    const s = src.stats;
    if (s) for (const k in s) {
      if (k === 'dmgMult' || k === 'tearsMult') a[k] *= s[k];
      else a[k] += s[k];
    }
    if (src.dynamicStats) { const d = src.dynamicStats(p); for (const k in d) { if (k.endsWith('Mult')) a[k] *= d[k]; else a[k] += d[k]; } }
    if (src.flags) for (const f of src.flags) flags[f] = (flags[f] || 0) + 1;
    if (src.tearColor) tearColor = src.tearColor;
    if (src.tearScale) tearScale *= src.tearScale;
    if (src.tearStyle) tearStyle = src.tearStyle;
    if (src.weapon && WEAPON_PRIORITY.indexOf(src.weapon) < WEAPON_PRIORITY.indexOf(weapon)) weapon = src.weapon;
    if (src.extraShots) shots += src.extraShots;
    if (src.spread) spreadMode = src.spread;
    if (src.flight) flying = true;
    if (src.size) size *= src.size;
  }
  if (flags.flight) flying = true;
  let damage = base.damage * Math.sqrt(Math.max(0.04, 1 + 1.2 * a.dmg)) + a.dmgFlat;
  damage *= a.dmgMult;
  damage = Math.max(0.5, damage);
  const tu = base.tearsUp + a.tears;
  let delay = tu >= 0 ? 16 - 6 * Math.sqrt(1.3 * tu + 1) : 16 - 6 * tu;
  delay = Math.max(5, delay);
  let tps = (30 / (delay + 1)) * a.tearsMult + a.tearsFlat;
  if (shots > 1) tps *= Math.max(0.42, 1 - 0.12 * (shots - 1)); // multishot penalty
  if (weapon === 'charged') tps *= 0.85;
  tps = Math.max(0.3, tps);
  p.stats = {
    damage,
    tears: tps,
    fireDelay: Math.max(CFG.STATS.minFireDelay / 60, 1 / tps),
    range: Math.max(CFG.STATS.rangeMin, base.range + a.range),
    shotSpeed: Math.max(CFG.STATS.shotSpeedMin, base.shotSpeed + a.shotSpeed),
    speed: Math.min(CFG.STATS.speedMax, Math.max(CFG.STATS.speedMin, base.speed + a.speed)),
    luck: base.luck + a.luck,
  };
  p.tearFlags = flags;
  p.tearColor = tearColor;
  p.tearScale = tearScale * Math.min(1.8, Math.max(0.75, Math.sqrt(damage / 3.5)));
  p.tearStyle = tearStyle;
  p.weapon = weapon;
  p.shots = Math.min(8, shots);
  p.spreadMode = spreadMode;
  p.flying = flying;
  p.sizeMult = size;
  p.r = CFG.PLAYER.radius * size;
}
