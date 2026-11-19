// Game: run/floor/room flow, transitions, doors, room clears, explosions and
// the per-tick update of every entity list.
import { CFG, FLOORS } from './config.js';
import { S, clearEntities } from './state.js';
import { Run, CURSES } from './run.js';
import { RNG, fxRng } from './core/rng.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { save } from './core/save.js';
import { gfx, setCamera, addShake, COS_T } from './render/gfx.js';
import { RoomView } from './render/roomview.js';
import { generateFloor, oppositeSide, GRID_DIRS } from './world/floorgen.js';
import { Room, SIDE_VEC, DESTRUCTIBLE } from './world/room.js';
import { fillRoom } from './world/roomfill.js';
import { Player } from './entities/player.js';
import { updateFx, particles, gore, explosionFx, poof, creep } from './entities/effects.js';
import { spawnPickup, spawnReward } from './entities/pickups.js';
import { spawnBomb } from './entities/bombs.js';
import { spawnEnemy } from './entities/enemies.js';
import { spawnBoss, BOSS_INFO } from './entities/bosses.js';
import { syncFamiliars, updateFamiliars, spawnBlueFly } from './entities/familiars.js';
import { runHook } from './items/hooks.js';
import { ITEMS, TRINKETS } from './items/items.js';
import { CARDS, PILLS } from './items/consumables.js';
import * as logic from './items/logic.js';

export class Game {
  constructor(ui) {
    S.game = this;
    this.ui = ui;
    this.state = 'title';     // title | play | transition | paused | bossintro | dead | win | cutscene
    this.trans = null;
    this.restartHold = 0;
    this.stateT = 0;
  }

  // ===========================================================================
  //  runs & floors
  // ===========================================================================
  newRun({ seed, charId = 'isaiah' }) {
    this.cleanupRun();
    const run = new Run(seed, charId);
    S.run = run;
    S.player = new Player(charId);
    save.data.best.runs++; save.write();
    this.startFloor(1);
    input.queue.clear(); input.justPressed.clear();
  }
  cleanupRun() {
    if (S.view) { clearEntities(); for (const f of S.familiars) f.destroy(); S.familiars.length = 0; S.view.dispose(); S.view = null; }
    if (this.prevView) { this.prevView.dispose(); this.prevView = null; }
    if (S.player) { S.player.destroy(); S.player = null; }
    S.room = null; S.floor = null;
  }

  startFloor(n) {
    const run = S.run;
    run.floorNum = n;
    S.floorNum = n;
    const curse = run.rollCurse(n);
    const rng = run.floorRng(n);
    const floor = generateFloor(rng, n, { labyrinth: curse === 'labyrinth' });
    floor.rooms = floor.rooms.map((def) => new Room(def));
    floor.num = n;
    floor.dealDoorSpawned = false;
    S.floor = floor;
    S.bossBarMax = 0;
    run.dealSeenOnFloor = false;
    const p = S.player;
    p.damageTakenFloor = false; p.damageTakenBoss = false; p.mapRevealed = false;
    p.buffs = p.buffs.filter((b) => b.until !== 'floor' && b.until !== 'room');
    p.refresh();
    if (S.view) { clearEntities(); S.view.dispose(); S.view = null; }
    const start = floor.rooms[floor.startId];
    this.enterRoom(start, null, { x: start.W / 2, z: start.H / 2 });
    this.revealAdjacent(start);
    runHook(p, 'onFloorStart', p, n);
    audio.setDrone(FLOORS[Math.min(n, 5)].drone);
    const name = CFG.FLOOR_NAMES[n - 1] + (curse === 'labyrinth' ? ' XL' : '');
    this.ui.floorBanner(name, curse ? CURSES[curse].name : null);
    if (n > save.data.best.floor) { save.data.best.floor = n; save.write(); }
    this.state = 'play';
  }
  get palette() { return FLOORS[Math.min(S.floorNum, 5)].palette; }

  // ===========================================================================
  //  rooms
  // ===========================================================================
  /** Make `room` current and populate it. spawn: player position in the room. */
  enterRoom(room, fromSide, spawn) {
    S.room = room;
    if (!room.built) fillRoom(room, S.floorNum);
    S.view = new RoomView(room, S.floorNum, this.palette);
    gfx.layer = S.view.layer;
    S.time = 0;
    const p = S.player;
    p.attach(S.view.layer);
    p.x = spawn.x; p.z = spawn.z;
    p.vx *= 0.3; p.vz *= 0.3;
    for (const f of S.familiars) f.attach && f.attach(S.view.layer, p);
    const firstVisit = !room.visited;
    room.visited = true; room.seen = true;
    this.revealAdjacent(room);
    this.populate(room, firstVisit);
    // doors close if there are enemies
    this.combat = !room.cleared && S.enemies.some((e) => e.alive && !e.ignoreClear);
    if (!this.combat && !room.cleared && room.type !== 'challenge') room.cleared = true;
    this.setDoorsClosed(this.combat);
    p.buffs = p.buffs.filter((b) => b.until !== 'room');
    p.refresh();
    syncFamiliars(p);
    runHook(p, 'onRoomEnter', p, room);
    this.snapCamera();
  }
  revealAdjacent(room) {
    for (const d of room.doors) {
      const o = S.floor.rooms[d.to];
      if (!o) continue;
      if (!d.hidden) o.seen = o.seen || 'adjacent';
    }
  }

  /** Spawn the room's persistent pickups, first-visit contents and enemies. */
  populate(room, firstVisit) {
    const rng = new RNG((room.seed || 1) + 77);
    if (room.saved) {
      for (const s of room.saved) {
        if (s.kind === 'shopkeeper' || s.kind === 'machine') logic.spawnProp(s);
        else spawnPickup(s.kind, s.x, s.z, { ...s, sub: s.sub, delay: 0.3 });
      }
    }
    if (firstVisit) {
      for (const c of room.contents || []) logic.spawnContent(c, room, rng);
    }
    if (!room.cleared) {
      for (const sp of room.spawns) {
        const e = spawnEnemy(sp.type, sp.x, sp.z, { champion: this.rollChampion(rng) });
        if (e) e.spawnGrace = CFG.ENEMY_SPAWN_GRACE;
      }
      if (room.type === 'boss' && firstVisit) this.startBossIntro(room);
      if (room.type === 'boss' && !firstVisit && !S.enemies.some((e) => e.isBoss)) {
        // left a boss fight via teleport: the boss comes back at full strength
        const c = (room.contents || []).find((x) => x.kind === 'boss');
        if (c) spawnBoss(c.id, c.x, c.z);
      }
    }
  }
  rollChampion(rng) {
    const ch = CFG.CHAMPION_CHANCE[Math.min(S.floorNum, 5)] + (S.player ? S.player.stats.luck * -0.003 : 0);
    return rng.chance(ch) ? rng.pick(CFG.CHAMPION_TYPES) : null;
  }
  /** Persist pickups/props in the room we're leaving */
  saveRoom(room) {
    const keep = [];
    for (const pk of S.pickups) if (pk.alive && pk.persist) keep.push(pk.serialize());
    for (const m of S.misc) if (m.alive && m.persist && m.serialize) keep.push(m.serialize());
    room.saved = keep;
  }

  setDoorsClosed(closed) {
    for (const d of S.room.doors) d.closed = closed;
    S.view.updateDoors();
  }

  // ---- doors & transitions ----------------------------------------------------
  checkDoors(p, mx, mz) {
    if (this.state !== 'play') return;
    for (const d of S.room.doors) {
      if (d.hidden) continue;
      let along, push, near;
      if (d.side === 0) { along = p.x - d.x; near = p.z - p.r <= 0.03; push = mz < -0.3; }
      else if (d.side === 2) { along = p.x - d.x; near = p.z + p.r >= S.room.H - 0.03; push = mz > 0.3; }
      else if (d.side === 3) { along = p.z - d.z; near = p.x - p.r <= 0.03; push = mx < -0.3; }
      else { along = p.z - d.z; near = p.x + p.r >= S.room.W - 0.03; push = mx > 0.3; }
      if (!near || !push) continue;
      // door assist: slide toward the doorway when pushing into the wall near it
      if (Math.abs(along) < 0.95 && Math.abs(along) > 0.3 && !d.closed && !d.lock) {
        const k = Math.sign(along) * Math.min(Math.abs(along), 3.5 * CFG.TICK);
        if (d.side % 2 === 0) p.x -= k; else p.z -= k;
      }
      if (Math.abs(along) > 0.42) continue;
      if (d.closed) continue;
      if (d.lock) { this.tryUnlock(p, d); continue; }
      this.goThroughDoor(d);
      return;
    }
  }
  tryUnlock(p, d) {
    if (d.lockCd && S.time < d.lockCd) return;
    d.lockCd = S.time + 0.4;
    const can = d.lock === 'key' ? p.keys > 0 || p.hasItem('skeleton_key') : p.coins > 0;
    if (!can) return;
    if (d.lock === 'key' && !p.hasItem('skeleton_key')) p.keys--;
    if (d.lock === 'coin') p.coins--;
    d.lock = null;
    const other = S.floor.rooms[d.to];
    const back = this.matchingDoor(S.room, d, other);
    if (back) back.lock = null;
    S.view.updateDoor(d);
    audio.play(d.lock === 'coin' ? 'coin' : 'key');
    audio.play('doorOpen');
  }
  matchingDoor(fromRoom, d, toRoom) {
    if (!toRoom) return null;
    if (d.cell) {
      const nx = d.cell[0] + GRID_DIRS[d.side][0], ny = d.cell[1] + GRID_DIRS[d.side][1];
      const m = toRoom.doors.find((o) => o.to === fromRoom.id && o.cell && o.cell[0] === nx && o.cell[1] === ny);
      if (m) return m;
    }
    return toRoom.doors.find((o) => o.to === fromRoom.id);
  }
  /** Leave through a door: camera slides over to the next room. */
  goThroughDoor(d, forceMode = null) {
    const from = S.room;
    let to = S.floor.rooms[d.to];
    let back = this.matchingDoor(from, d, to);
    let mode = forceMode || (d.offgrid || to.offgrid ? 'fade' : 'slide');
    // Curse of the Maze: sometimes you end up somewhere else
    if (S.run.curse === 'maze' && to.type === 'normal' && fxRng.chance(0.18)) {
      const options = S.floor.rooms.filter((r) => r !== from && r.type === 'normal' && r.doors.length);
      if (options.length) { to = fxRng.pick(options); back = fxRng.pick(to.doors); mode = 'fade'; }
    }
    this.transitionTo(to, back, mode);
  }
  /** Move to `to`, placing the player just inside `door` (or the center). */
  transitionTo(to, door, mode = 'slide') {
    const from = S.room;
    this.saveRoom(from);
    if (from.type === 'bargain' && !from.counted) { from.counted = true; if (!S.run.bargainTakenFloor) S.run.bargainSkipped++; }
    // lasers and tears don't carry over
    clearEntities();
    const spawn = door ? { x: door.x + SIDE_VEC[(door.side + 2) % 4][0] * 0.95, z: door.z + SIDE_VEC[(door.side + 2) % 4][1] * 0.95 } : { x: to.W / 2, z: to.H / 2 + 1 };
    const camFrom = this.cameraPos();
    this.prevView = S.view;
    S.view = null;
    this.enterRoom(to, door ? door.side : null, spawn);
    const camTo = this.cameraPos();
    this.trans = { t: 0, dur: mode === 'slide' ? CFG.ROOM_TRANSITION_TIME : 0.5, camFrom, camTo, mode };
    if (this.state !== 'bossintro') this.state = 'transition';
    if (mode === 'fade') this.ui.fade(0.5);
    setCamera(camFrom.x, camFrom.z);
  }
  /** Teleport within the floor (cards, items). */
  teleport(room) {
    this.transitionTo(room, null, 'fade');
  }

  cameraPos() {
    const r = S.room, p = S.player;
    const hw = gfx.viewW / 2, hd = (gfx.viewH / 2) / COS_T;
    let x = r.W / 2, z = r.H / 2;
    if (r.W + 2 > gfx.viewW) x = Math.max(-1 + hw - 0.2, Math.min(r.W + 1 - hw + 0.2, p.x));
    if (r.H + 2.5 > gfx.viewH / COS_T) z = Math.max(-1.6 + hd, Math.min(r.H + 1 - hd + 0.6, p.z));
    return { x: x + r.originX, z: z + r.originZ };
  }
  snapCamera() { const c = this.cameraPos(); setCamera(c.x, c.z); this.cam = c; }

  // ===========================================================================
  //  update
  // ===========================================================================
  update(dt) {
    input.update();
    this.stateT += dt;
    if (S.run) S.run.time += this.state === 'play' ? dt : 0;
    // hold R to restart the run
    if (S.run && (this.state === 'play' || this.state === 'dead') && (input.held('restart') || input.padHeldRestart)) {
      this.restartHold += dt;
      if (this.restartHold > 1.0) { this.restartHold = 0; this.ui.restartRun(); return; }
    } else this.restartHold = 0;

    switch (this.state) {
      case 'play':
        if (input.pressed('pause')) { this.pause(); return; }
        if (input.pressed('map')) this.ui.toggleMap();
        if (S.hitStop > 0) { S.hitStop--; return; }
        this.updatePlay(dt);
        break;
      case 'transition': this.updateTransition(dt); break;
      case 'bossintro':
        this.introT -= dt;
        if (this.introT <= 0 || (this.introT < CFG.BOSS_INTRO_TIME - 0.3 && (input.anyKey))) { this.state = 'play'; this.ui.hideBossIntro(); }
        break;
      case 'dead':
        if (S.player) S.player.sync();
        updateFx(dt);
        break;
      case 'cutscene':
        updateFx(dt);
        for (const m of S.misc) if (m.alive && m.update && !m.solid) m.update(dt);
        break;
      default: break;
    }
  }

  updateTransition(dt) {
    const tr = this.trans;
    tr.t += dt;
    const k = Math.min(1, tr.t / tr.dur);
    if (tr.mode === 'slide') {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setCamera(tr.camFrom.x + (tr.camTo.x - tr.camFrom.x) * e, tr.camFrom.z + (tr.camTo.z - tr.camFrom.z) * e);
    } else if (k >= 0.5) setCamera(tr.camTo.x, tr.camTo.z);
    S.player.sync();
    for (const e of S.enemies) e.sync && e.sync();
    for (const pk of S.pickups) pk.sync();
    for (const f of S.familiars) f.sync && f.sync();
    if (k >= 1) {
      if (this.prevView) { this.prevView.dispose(); this.prevView = null; }
      gfx.layer = S.view.layer;
      this.trans = null;
      if (this.pendingIntro) { this.pendingIntro = false; this.state = 'bossintro'; this.introT = CFG.BOSS_INTRO_TIME; this.ui.showBossIntro(this.introBoss); audio.play('roar'); }
      else this.state = 'play';
      this.snapCamera();
    }
  }

  updatePlay(dt) {
    S.time += dt;
    const p = S.player;
    p.update(dt);
    if (this.state !== 'play') return; // player walked through a door
    updateFamiliars(dt);
    const lists = [S.enemies, S.tears, S.shots, S.bombs, S.pickups, S.misc, S.lasers];
    for (const list of lists) {
      for (let i = 0; i < list.length; i++) { const e = list[i]; if (e.alive) e.update(dt); }
    }
    for (const list of lists) {
      for (let i = list.length - 1; i >= 0; i--) if (!list[i].alive) list.splice(i, 1);
    }
    updateFx(dt);
    this.updateCreep(dt);
    this.updateTiles(dt);
    this.checkRoomClear();
    // big rooms: camera follows
    const c = this.cameraPos();
    if (!this.cam) this.cam = c;
    this.cam.x += (c.x - this.cam.x) * Math.min(1, dt * 8);
    this.cam.z += (c.z - this.cam.z) * Math.min(1, dt * 8);
    setCamera(this.cam.x, this.cam.z);
  }

  updateCreep(dt) {
    const p = S.player;
    for (const c of S.creep) {
      if (!c.alive) continue;
      if (c.owner === 'enemy') {
        if (!p.flying && (p.x - c.x) ** 2 + (p.z - c.z) ** 2 < (c.r + p.r * 0.5) ** 2) p.hurt(this.dmgAmount(false), 'a puddle of creep');
      } else {
        c.tickT = (c.tickT || 0) + dt;
        if (c.tickT > 0.25) {
          c.tickT = 0;
          for (const e of S.enemies) if (e.alive && !e.flying && (e.x - c.x) ** 2 + (e.z - c.z) ** 2 < (c.r + e.r) ** 2) e.hurt(c.dps * 0.25, { flags: {} });
        }
      }
    }
  }
  updateTiles(dt) {
    // animate fireplaces & hurt on touch
    const room = S.room, p = S.player;
    this.fireAnim = (this.fireAnim || 0) + dt;
    const frame = Math.floor(this.fireAnim * 8) % 3;
    if (frame !== this.lastFireFrame) {
      this.lastFireFrame = frame;
      for (let i = 0; i < room.grid.length; i++) {
        const t = room.grid[i];
        if (t.t === 'fire' && t.lit) { t.frame = frame; S.view.refreshTile(i % room.W, (i / room.W) | 0); }
      }
    }
    // touching a lit fireplace hurts
    const tx = Math.floor(p.x), tz = Math.floor(p.z);
    for (let y = tz - 1; y <= tz + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
      const t = room.tile(x, y);
      if (!t || t.t !== 'fire' || !t.lit) continue;
      const cx = Math.max(x, Math.min(p.x, x + 1)), cz = Math.max(y, Math.min(p.z, y + 1));
      if ((p.x - cx) ** 2 + (p.z - cz) ** 2 < (p.r + 0.08) ** 2) p.hurt(this.dmgAmount(false), 'a fireplace');
    }
  }

  // ---- room clear -------------------------------------------------------------
  checkRoomClear() {
    const room = S.room;
    if (room.cleared) return;
    if (room.type === 'challenge' && !room.challengeDone) return;
    if (S.enemies.some((e) => e.alive && !e.ignoreClear)) return;
    if (this.pendingSpawns) return;
    room.cleared = true;
    this.onRoomClear(room);
  }
  onRoomClear(room) {
    const p = S.player;
    S.run.roomsCleared++;
    this.setDoorsClosed(false);
    audio.play('doorOpen');
    audio.play('clear');
    addShake(0.15);
    this.chargeActive(p, CFG.ACTIVE_ROOM_CHARGE);
    runHook(p, 'onRoomClear', p, room);
    if (room.type === 'boss') this.onBossRoomClear(room);
    else if (room.type === 'normal') this.dropClearReward(room);
  }
  dropClearReward(room) {
    const rng = S.run.dropRng;
    const luck = S.player.stats.luck;
    const chance = CFG.CLEAR_REWARD_BASE_CHANCE + Math.max(-0.2, luck * CFG.CLEAR_REWARD_LUCK_BONUS);
    if (!rng.chance(chance)) return;
    const table = CFG.CLEAR_REWARDS.map(([k, w]) => [k, k === 'coin' ? w : w * (1 + Math.max(0, luck) * 0.08)]);
    const kind = rng.weighted(table);
    const c = room.nearestFree(room.W / 2, room.H / 2);
    spawnReward(kind, c.x, c.z, rng, { spread: 0.5 });
    poof(c.x, c.z, 0xe8dcc0, 0.6);
  }
  onBossRoomClear(room) {
    const rng = S.run.floorRng(S.floorNum).fork('bossclear');
    const c = room.center();
    const last = S.floorNum >= CFG.FLOOR_COUNT;
    if (last) return; // the win sequence is handled by the final boss
    // boss item, trapdoor, maybe a deal door
    spawnPickup('pedestal', c.x, c.z - 1.2, { itemId: S.run.drawItem('boss'), pool: 'boss' });
    spawnPickup('trapdoor', c.x, c.z + 1.4, { sub: 'normal' });
    for (let i = 0; i < 2; i++) spawnReward(rng.pick(['heart', 'coin', 'heart']), c.x + (i ? 1.8 : -1.8), c.z, rng);
    logic.maybeSpawnDealDoor(room, rng);
    save.write();
  }

  startBossIntro(room) {
    const c = (room.contents || []).find((x) => x.kind === 'boss');
    if (!c) return;
    this.introBoss = c.id;
    this.pendingIntro = true;
    if (this.state === 'play') { this.pendingIntro = false; this.state = 'bossintro'; this.introT = CFG.BOSS_INTRO_TIME; this.ui.showBossIntro(c.id); audio.play('roar'); }
  }

  // ===========================================================================
  //  damage / interactions
  // ===========================================================================
  /** Halves of damage for an enemy hit, per floor rules */
  dmgAmount(isBoss, contact = false) {
    const D = CFG.DAMAGE;
    if (S.floorNum >= D.fullHeartFromFloor) return 2;
    if (isBoss && contact && D.bossContactFull) return 2;
    if (isBoss && S.floorNum >= D.bossShotsFullFromFloor) return 2;
    return 1;
  }
  blackHeartBurst() {
    for (const e of S.enemies) if (e.alive) e.hurt(CFG.DAMAGE.blackHeartBurst, { flags: {} });
    addShake(0.4);
    particles(S.player.x, S.player.z, { count: 16, kind: 'smoke', color: 0x2a1a2a, life: 0.8, size: 0.9, speed: 4 });
    audio.play('bargain');
  }

  /** A tear hit a solid tile */
  tearHitTile(tear, tx, ty) {
    const t = S.room.tile(tx, ty);
    if (!t || tear.owner === 'enemy') return;
    if (t.t === 'poop' || t.t === 'fire' || t.t === 'tnt' || t.t === 'urn') this.damageTile(tx, ty, 1);
    if (tear.flags.rockBreak && (t.t === 'rock' || t.t === 'trock') && Math.random() < 0.25) this.destroyTile(tx, ty, true);
  }
  laserHitTile(tx, ty) {
    const t = S.room.tile(tx, ty);
    if (t && (t.t === 'poop' || t.t === 'fire' || t.t === 'tnt')) this.damageTile(tx, ty, 0.5);
  }
  damageTile(tx, ty, amount) {
    const room = S.room, t = room.tile(tx, ty);
    if (!t) return;
    if (t.t === 'poop') {
      t.hp -= amount;
      t.stage = Math.min(3, Math.floor((CFG.POOP_HITS - t.hp) * 4 / CFG.POOP_HITS));
      audio.play('poop');
      particles(tx + 0.5, ty + 0.5, { count: 3, color: 0x6a5a2c, kind: 'blob', speed: 1.5, up: 2, life: 0.4, size: 0.15 });
      if (t.hp <= 0) this.destroyTile(tx, ty, false); else S.view.refreshTile(tx, ty);
    } else if (t.t === 'fire' && t.lit) {
      t.hp -= amount;
      if (t.hp <= 0) {
        t.lit = false; t.t = 'fire_out';
        room.setTile(tx, ty, { t: 'floor', ash: true });
        S.view.refreshTile(tx, ty);
        audio.play('fireOut');
        particles(tx + 0.5, ty + 0.5, { count: 6, kind: 'smoke', color: 0x8a8a8a, life: 0.8, size: 0.6 });
        S.view.decal('scorch', tx + 0.5, ty + 0.5, 0.6);
        if (S.run.dropRng.chance(CFG.FIRE_DROP_CHANCE)) spawnReward(S.run.dropRng.pick(['heart', 'coin', 'bomb']), tx + 0.5, ty + 0.5, S.run.dropRng);
      }
    } else if (t.t === 'tnt') {
      t.hp -= amount;
      if (t.hp <= 0) { room.setTile(tx, ty, { t: 'floor' }); S.view.refreshTile(tx, ty); this.explode(tx + 0.5, ty + 0.5, { radius: 1.8, damage: 50, hurtsPlayer: true }); }
    } else if (t.t === 'urn') this.destroyTile(tx, ty, false);
  }
  destroyTile(tx, ty, byExplosion) {
    const room = S.room, t = room.tile(tx, ty);
    if (!t) return;
    const rng = S.run.dropRng;
    const x = tx + 0.5, z = ty + 0.5;
    const was = t.t;
    if (was === 'metal' || was === 'void' || was === 'pit' || was === 'floor' || was === 'spikes') return;
    room.setTile(tx, ty, { t: 'floor' });
    S.view.refreshTile(tx, ty);
    if (was === 'rock' || was === 'trock' || was === 'urn') {
      audio.play('rock');
      particles(x, z, { count: 7, kind: 'rock', color: was === 'urn' ? 0x7a6a5a : 0x8a8278, speed: 3, up: 4, life: 0.7, size: 0.28 });
      poof(x, z, 0x8a8278, 0.6);
      if (was === 'trock') { const n = rng.int(1, 2); for (let i = 0; i < n; i++) spawnReward(rng.weighted(CFG.TINTED_ROCK_DROPS), x, z, rng); }
      if (was === 'urn' && rng.chance(0.4)) spawnReward(rng.pick(['coin', 'coin', 'heart', 'key']), x, z, rng);
      if (was === 'rock' && rng.chance(0.02)) spawnReward('coin', x, z, rng);
    } else if (was === 'poop') {
      audio.play('poop');
      particles(x, z, { count: 8, color: 0x6a5a2c, kind: 'blob', speed: 2.5, up: 3, life: 0.5, size: 0.2, decal: '#4a3c1c' });
      S.view.decal('splat', x, z, 0.7, '#4a3c1c');
      if (rng.chance(CFG.POOP_DROP_CHANCE + S.player.stats.luck * 0.01)) spawnReward('coin', x, z, rng);
    } else if (was === 'fire') {
      audio.play('fireOut');
      S.view.decal('scorch', x, z, 0.6);
    } else if (was === 'tnt') {
      this.explode(x, z, { radius: 1.8, damage: 50, hurtsPlayer: true });
    }
  }

  /** Explosion: damages enemies/player, destroys tiles, reveals secret doors. */
  explode(x, z, o = {}) {
    const radius = o.radius ?? CFG.BOMB.radius;
    const dmg = o.damage ?? CFG.BOMB.damage;
    explosionFx(x, z, o.small ? 0.55 : radius / CFG.BOMB.radius);
    audio.play('explosion');
    S.hitStop = Math.max(S.hitStop, o.small ? 0 : 2);
    for (const e of S.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < radius + e.r) e.hurt(dmg, { kx: ((e.x - x) / (d || 1)) * 6, kz: ((e.z - z) / (d || 1)) * 6, flags: {}, explosion: true });
    }
    const p = S.player;
    if (o.hurtsPlayer !== false && !p.dead && !p.hasItem?.('blast_apron') && Math.hypot(p.x - x, p.z - z) < radius + p.r * 0.5) {
      p.hurt(CFG.BOMB.playerDamage, 'their own bomb');
    }
    // push bombs & pickups
    for (const b of S.bombs) if (b.alive && b !== o.bomb) { const d = Math.hypot(b.x - x, b.z - z); if (d < radius) { b.vx += (b.x - x) / (d || 1) * 6; b.vz += (b.z - z) / (d || 1) * 6; } }
    for (const pk of S.pickups) if (pk.alive && pk.kind !== 'pedestal' && pk.kind !== 'trapdoor') { const d = Math.hypot(pk.x - x, pk.z - z); if (d < radius + 0.5) { pk.vx += (pk.x - x) / (d || 1) * 5; pk.vz += (pk.z - z) / (d || 1) * 5; pk.vh = 3; } }
    // tiles
    if (!o.small) {
      const room = S.room;
      for (let ty = Math.floor(z - radius); ty <= Math.floor(z + radius); ty++) for (let tx = Math.floor(x - radius); tx <= Math.floor(x + radius); tx++) {
        const t = room.tile(tx, ty);
        if (!t) continue;
        if (Math.hypot(tx + 0.5 - x, ty + 0.5 - z) > radius + 0.3) continue;
        if (DESTRUCTIBLE.has(t.t)) this.destroyTile(tx, ty, true);
      }
      // secret doors & bombable things
      for (const d of room.doors) {
        if (d.hidden && Math.hypot(d.x - x, d.z - z) < radius + 0.8) this.revealSecretDoor(d);
      }
      logic.explosionHitsProps(x, z, radius);
    }
    runHook(p, 'onBombExplode', { x, z, radius }, p);
  }
  revealSecretDoor(d) {
    d.hidden = false;
    const other = S.floor.rooms[d.to];
    const back = this.matchingDoor(S.room, d, other);
    if (back) back.hidden = false;
    other.seen = other.seen || 'adjacent';
    S.view.rebuildWalls();
    S.view.updateDoors();
    audio.play('doorOpen');
    poof(d.x, d.z, 0x8a8278, 1);
  }

  /** Damaging creep left by player tears (items) */
  playerCreep(x, z) { creep(x, z, { color: '#c8c8f0', size: 0.7, life: 1.5, owner: 'player', dps: S.player.stats.damage * 1.5 }); }

  // ===========================================================================
  //  player actions (delegated to items/logic.js)
  // ===========================================================================
  playerPlaceBomb(p) { logic.placeBomb(p); }
  useActive(p) { logic.useActive(p); }
  usePocket(p) { logic.usePocket(p); }
  dropTrinket(p) { logic.dropTrinket(p); }
  chargeActive(p, n) { logic.chargeActive(p, n); }
  giveItem(p, id, pedestal) { return logic.giveItem(p, id, pedestal); }
  openChest(ch) { logic.openChest(ch); }
  announceTrinket(id) { const t = TRINKETS[id]; if (t) { this.banner(t.name, t.tagline); audio.play('fanfare'); } }
  onBargainTaken() { S.run.dealTaken = true; S.run.bargainTakenFloor = true; audio.play('bargain'); }
  randomCard(rng) { return S.run.randomCard(rng); }
  randomPill(rng) { return S.run.randomPill(rng); }
  randomTrinket(rng) { return S.run.drawTrinket(rng); }
  cardName(id) { return CARDS[id]?.name || 'a card'; }
  pillName(id) { return S.run.pillsKnown.has(id) ? PILLS[id]?.name : '???'; }
  onPickup() {}
  spawnBlueFly(x, z) { spawnBlueFly(S.player); }

  enterTrapdoor(td) {
    if (this.state !== 'play' || this.descending) return;
    this.descending = true;
    audio.play('trapdoor');
    this.ui.fade(1.0);
    S.player.vx = S.player.vz = 0;
    this.state = 'cutscene';
    setTimeout(() => {
      this.descending = false;
      const skip = S.run.curse === 'labyrinth' ? 2 : 1;
      const next = Math.min(CFG.FLOOR_COUNT, S.floorNum + skip);
      this.startFloor(next);
    }, 500);
  }

  // ===========================================================================
  //  UI-facing
  // ===========================================================================
  banner(title, sub) { this.ui.itemBanner(title, sub); }
  pause() { if (this.state !== 'play') return; this.state = 'paused'; this.ui.showPause(); }
  resume() { this.state = 'play'; input.queue.clear(); input.justPressed.clear(); }
  onPlayerDeath(cause) {
    this.state = 'dead';
    this.stateT = 0;
    S.run.killedBy = cause;
    save.data.best.deaths++; save.write();
    audio.play('death');
    audio.stopDrone();
    setTimeout(() => this.ui.showDeath(), 1600);
  }
  onWin() {
    this.state = 'win';
    save.data.best.wins++;
    const firstWin = !save.data.unlocks.june;
    save.data.unlocks.june = true;
    save.write();
    audio.stopDrone();
    this.ui.showWin(firstWin);
  }

  // ===========================================================================
  //  render
  // ===========================================================================
  render(dt) {
    if (!S.room) return;
    if (this.state === 'play' || this.state === 'paused' || this.state === 'bossintro' || this.state === 'cutscene' || this.state === 'dead' || this.state === 'win') {
      const p = S.player;
      p.sync();
      for (const e of S.enemies) e.sync && e.sync();
      for (const t of S.tears) t.alive && t.sync();
      for (const t of S.shots) t.alive && t.sync();
      for (const b of S.bombs) b.alive && b.sync();
      for (const pk of S.pickups) pk.alive && pk.sync();
      for (const m of S.misc) m.alive && m.sync && m.sync();
      for (const f of S.familiars) f.sync && f.sync();
    }
    S.view && S.view.sync();
  }
}
