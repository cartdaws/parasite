// Item hook dispatch. Every item / trinket / buff may define hooks:
//   modifyTear(tear, p)        when a player tear is created
//   onFire(p, dir, tears)      after a volley is fired (may push extra tears)
//   onTearUpdate(tear, p, dt)  every tick for each player tear
//   onTearHit(tear, enemy, p)  a player tear hit an enemy
//   onEnemyKill(enemy, p)      any enemy died
//   onRoomClear(p, room)       room cleared
//   onHurt(p, amount, source)  player took damage
//   onFloorStart(p, floorNum)  new floor
//   onRoomEnter(p, room)       entered a room
//   onUpdate(p, dt)            every tick
//   onBombExplode(bomb, p)
import { statSources } from './stats.js';

export function runHook(p, name, ...args) {
  if (!p) return;
  const srcs = statSources(p);
  for (const s of srcs) {
    const h = s.hooks && s.hooks[name];
    if (h) h(...args);
  }
}
/** true if any source has this hook (cheap check to skip per-tear work) */
export function hasHook(p, name) {
  if (!p) return false;
  return statSources(p).some((s) => s.hooks && s.hooks[name]);
}
