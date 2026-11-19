// Shared mutable game state. The Game populates this; entities read it.
// (One module instead of passing `game` everywhere keeps entity code short.)
export const S = {
  game: null,        // Game instance
  run: null,         // current run (seed, floor, rng streams, pools...)
  floor: null,       // generated floor
  room: null,        // current Room
  view: null,        // current RoomView
  player: null,
  enemies: [], tears: [], shots: [], pickups: [], bombs: [], familiars: [], fx: [], creep: [], misc: [], lasers: [],
  time: 0,           // seconds since the room was entered
  hitStop: 0,        // frames to freeze for impact
  floorNum: 1,
};
export function clearEntities() {
  for (const k of ['enemies', 'tears', 'shots', 'pickups', 'bombs', 'fx', 'creep', 'misc', 'lasers']) {
    for (const e of S[k]) if (e.destroy) e.destroy();
    S[k].length = 0;
  }
}
