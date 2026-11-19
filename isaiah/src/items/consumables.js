// Cards (tarot-like, original) and pills (colors shuffled per run).
import { S } from '../state.js';
import { audio } from '../core/audio.js';
import { fxRng } from '../core/rng.js';
import { spawnReward, spawnPickup } from '../entities/pickups.js';
import { addShake } from '../render/gfx.js';

function teleportType(type) {
  const r = S.floor.rooms.find((x) => x.type === type && !x.offgrid);
  if (r && r !== S.room) { S.game.teleport(r); return true; }
  return false;
}
function buff(p, stats, until) { p.buffs.push({ stats, until }); p.refresh(); }

export const CARDS = {
  tooth: { name: 'The Tooth', numeral: 'I', desc: 'three coins', icon: ['tooth'], bg: '#3a2a1a', use(p) { for (let i = 0; i < 3; i++) spawnReward('coin', p.x, p.z, S.run.dropRng, { spread: 2 }); } },
  lantern: { name: 'The Lantern', numeral: 'II', desc: 'go where the treasure is', icon: ['lantern'], bg: '#4a3a1a', use() { teleportType('treasure') || teleportType('start'); } },
  moth: { name: 'The Moth', numeral: 'III', desc: 'the whole floor, seen', icon: ['moth'], bg: '#2a2a3a', use(p) { p.mapRevealed = true; for (const r of S.floor.rooms) if (r.type === 'secret') r.seen = r.seen || 'adjacent'; } },
  stair: { name: 'The Stair', numeral: 'IV', desc: 'straight to the beast', icon: ['skull'], bg: '#3a0a0a', use() { teleportType('boss'); } },
  hearth: { name: 'The Hearth', numeral: 'V', desc: 'warm all the way through', icon: ['heart'], bg: '#4a1a1a', use(p) { p.heal(99); audio.play('heart'); } },
  ox: { name: 'The Ox', numeral: 'VI', desc: 'strong for a while', icon: ['horns', '#6a4a2a'], bg: '#3a2a1a', use(p) { buff(p, { dmg: 1.5, speed: -0.1 }, 'room'); p.addContainers(1); } },
  locksmith: { name: 'The Locksmith', numeral: 'VII', desc: 'two keys', icon: ['key'], bg: '#2a3a3a', use(p) { p.keys = Math.min(99, p.keys + 2); audio.play('key'); } },
  fuse: { name: 'The Fuse', numeral: 'VIII', desc: 'two bombs', icon: ['firework'], bg: '#3a1a1a', use(p) { p.bombs = Math.min(99, p.bombs + 2); audio.play('bombPickup'); } },
  widow: { name: 'The Widow', numeral: 'IX', desc: 'two soul hearts', icon: ['ghost'], bg: '#1a2a4a', use(p) { p.addSoul(4); audio.play('soul'); } },
  magpie: { name: 'The Magpie', numeral: 'X', desc: 'shiny things', icon: ['crown'], bg: '#2a2a2a', use(p) { for (let i = 0; i < 2; i++) spawnReward(fxRng.pick(['key', 'bomb', 'heart', 'coin', 'card']), p.x, p.z, S.run.dropRng, { spread: 2 }); } },
  tower: { name: 'The Cellar Door', numeral: 'XI', desc: 'everything shakes', icon: ['bone'], bg: '#3a3a2a', use(p) { for (let i = 0; i < 5; i++) { const pos = S.room.randomFree(S.run.dropRng, 1); if (Math.hypot(pos.x - p.x, pos.z - p.z) > 2) S.game.explode(pos.x, pos.z, { radius: 1.6, damage: 50, hurtsPlayer: true }); } addShake(0.8); } },
  wanderer: { name: 'The Wanderer', numeral: 'XII', desc: 'somewhere else, anywhere else', icon: ['shoe'], bg: '#2a3a2a', use() { const rs = S.floor.rooms.filter((r) => !r.offgrid && r !== S.room && r.type !== 'secret'); S.game.teleport(fxRng.pick(rs)); } },
  hanged: { name: 'The Hanged Kid', numeral: 'XIII', desc: 'nothing can touch you', icon: ['halo'], bg: '#2a2a3a', use(p) { p.invuln = 6; } },
  wheel: { name: 'The Wheel', numeral: 'XIV', desc: 'round and round', icon: ['die'], bg: '#4a2a4a', use(p) { spawnPickup('chest', p.x, p.z + 0.8, { sub: fxRng.chance(0.3) ? 'locked' : 'normal', vh: 3 }); } },
};

export const PILLS = {
  health: { name: 'Full Health', use(p) { p.heal(99); audio.play('heart'); } },
  badtrip: { name: 'Bad Trip', use(p) { if (p.totalHalves <= 2) { p.heal(99); S.game.banner('Bad Trip?', 'you feel... fine?'); } else p.hurt(2, 'a bad trip', { ignoreInvuln: true }); } },
  tears_up: { name: 'Tears Up', use(p) { buff(p, { tears: 0.35 }); } },
  tears_down: { name: 'Tears Down', use(p) { buff(p, { tears: -0.28 }); } },
  speed_up: { name: 'Speed Up', use(p) { buff(p, { speed: 0.15 }); } },
  speed_down: { name: 'Speed Down', use(p) { buff(p, { speed: -0.1 }); } },
  range_up: { name: 'Range Up', use(p) { buff(p, { range: 1 }); } },
  range_down: { name: 'Range Down', use(p) { buff(p, { range: -0.8 }); } },
  luck_up: { name: 'Luck Up', use(p) { buff(p, { luck: 1 }); } },
  luck_down: { name: 'Luck Down', use(p) { buff(p, { luck: -1 }); } },
  hp_up: { name: 'Health Up', use(p) { p.addContainers(1); } },
  swap: { name: 'Bombs Are Keys', use(p) { const b = p.bombs; p.bombs = p.keys; p.keys = b; } },
  charm: { name: 'Sweet Breath', use() { for (const e of S.enemies) if (e.alive && !e.isBoss) e.status.charm = 6; } },
  tele: { name: 'Telepills', use() { const rs = S.floor.rooms.filter((r) => !r.offgrid && r !== S.room); S.game.teleport(fxRng.pick(rs)); } },
  spirit: { name: 'Spirit Rush', use(p) { p.addSoul(2); audio.play('soul'); } },
  freeze: { name: 'Stiff Legs', use(p) { p.vx = p.vz = 0; p.buffs.push({ stats: { speed: -5 }, time: 1.5 }); p.refresh(); } },
};
