// Automated playtest: boots the dev server, starts a run, drives the game with
// simulated input and screenshots. Usage: node tools/playtest.mjs [outDir] [scenario]
import { createServer } from 'vite';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2] || 'playtest-out';
const scenario = process.argv[3] || 'basic';
fs.mkdirSync(outDir, { recursive: true });

const server = await createServer({ root: path.resolve(import.meta.dirname, '..'), server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + e.stack));

const shot = async (name) => { await page.screenshot({ path: path.join(outDir, name + '.png') }); console.log('shot', name); };
const wait = (ms) => page.waitForTimeout(ms);
const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await wait(ms); for (const k of keys) await page.keyboard.up(k); };
const evalg = (fn, arg) => page.evaluate(fn, arg);

await page.goto(url);
await wait(800);
await shot('00-title');

// simple bot: shoot at the nearest enemy, strafe away when close
async function fight(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const a = await evalg(() => {
      const p = __S.player; if (!p || __game.state !== 'play') return null;
      if (!__S.enemies.some((e) => e.alive)) return { done: true };
      const es = __S.enemies.filter((e) => e.alive && !e.untargetable);
      if (!es.length) return { keys: [['KeyW', 'KeyA', 'KeyS', 'KeyD'][Math.floor(Math.random() * 4)]] };
      es.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
      const e = es[0]; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      const keys = [];
      keys.push(Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dz > 0 ? 'ArrowDown' : 'ArrowUp'));
      // align on the minor axis, back off if too close
      if (Math.abs(dx) > Math.abs(dz)) { if (Math.abs(dz) > 0.3) keys.push(dz > 0 ? 'KeyS' : 'KeyW'); if (d < 2.5) keys.push(dx > 0 ? 'KeyA' : 'KeyD'); }
      else { if (Math.abs(dx) > 0.3) keys.push(dx > 0 ? 'KeyD' : 'KeyA'); if (d < 2.5) keys.push(dz > 0 ? 'KeyW' : 'KeyS'); }
      return { keys };
    });
    if (!a) { await wait(100); continue; }
    if (a.done) break;
    await hold(a.keys, 110);
  }
}
async function startRun(seed = 'TEST 0001', ch) {
  await page.keyboard.press('Enter');
  await wait(200);
  await page.fill('input', seed);
  await page.keyboard.press('Enter');
  await wait(1000);
  // skip intro panels if they show
  for (let i = 0; i < 6; i++) { const on = await evalg(() => document.getElementById('panels').classList.contains('active')); if (!on) break; await page.keyboard.press('Escape'); await wait(300); }
  await wait(500);
}
const scenarios0 = {
  async tour() {
    await startRun(process.argv[4] || 'TOUR 0001');
    for (let floor = 1; floor <= 5; floor++) {
      const n = await evalg(() => __S.floor.rooms.length);
      console.log('floor', floor, 'rooms', n, await evalg(() => __S.floor.rooms.map((r) => r.type[0] + r.shape).join(' ')));
      for (let i = 0; i < n; i++) {
        await evalg((i) => { const p = __S.player; p.invuln = 99; p.red = p.maxRed; const r = __S.floor.rooms[i]; if (r === __S.room) return; __game.transitionTo(r, r.doors[0], 'slide'); }, i);
        await wait(450);
        await hold(['ArrowRight', 'KeyA'], 250);
        await evalg(() => { for (const e of __S.enemies) if (e.alive && !e.isBoss) e.die({}); for (const e of __S.enemies) if (e.alive && e.isBoss && e.type !== 'boss_housemother') { e.hp = 1; e.hurt(5, {}); } });
        await wait(250);
      }
      await shot('tour-f' + floor);
      if (floor === 2) { // force a deal door and visit it
        await evalg(async () => { const r = __S.floor.rooms.find((r) => r.type === 'boss'); __game.transitionTo(r, r.doors[0], 'fade'); });
        await wait(800);
        await evalg(() => { const m = window.__logic; m.openDealDoor(__S.room, 'bargain'); const d = __S.room.doors.find((d) => d.kind === 'bargain'); __game.goThroughDoor(d); });
        await wait(800); await shot('deal-bargain');
        await evalg(() => { const pk = __S.pickups.find((p) => p.kind === 'pedestal'); if (pk) { __S.player.x = pk.x; __S.player.z = pk.z; } });
        await wait(600); await shot('deal-took');
      }
      if (floor < 5) await evalg((f) => __game.startFloor(f + 1), floor);
      await wait(600);
    }
  },
  async allitems() {
    await startRun();
    await evalg(() => { const p = __S.player; p.invuln = 999; for (const id of Object.keys(window.__ITEMS)) { if (window.__ITEMS[id].type !== 'active') __game.giveItem(p, id); } });
    const r = await evalg(() => __S.floor.rooms.find((r) => r.type === 'normal' && r.cells.length === 1).id);
    await evalg((id) => { const r = __S.floor.rooms[id]; __game.transitionTo(r, r.doors[0], 'fade'); }, r);
    await wait(800);
    await hold(['ArrowLeft', 'KeyD'], 2500);
    await shot('allitems');
    // actives, cards, pills
    const errs = await evalg(async () => {
      const out = []; const p = __S.player;
      for (const [id, it] of Object.entries(window.__ITEMS)) if (it.type === 'active') { try { p.active = { id, charge: 99 }; __game.useActive(p); } catch (e) { out.push(id + ':' + e.message); } }
      return out;
    });
    console.log('active errs', errs);
    await wait(1200);
    const errs2 = await evalg(async () => {
      const out = []; const p = __S.player; const c = window.__cons;
      for (const id of Object.keys(c.CARDS)) { try { p.pocket = { type: 'card', id }; __game.usePocket(p); } catch (e) { out.push(id + ':' + e.message); } }
      for (const id of Object.keys(c.PILLS)) { try { p.pocket = { type: 'pill', id }; __game.usePocket(p); } catch (e) { out.push(id + ':' + e.message); } }
      return out;
    });
    console.log('pocket errs', errs2);
    await wait(1500); await shot('allitems-after');
    console.log(JSON.stringify(await evalg(() => ({ state: __game.state, stats: __S.player.stats, items: __S.player.items.length }))));
  },
  async perf() {
    await startRun();
    await evalg(() => { const p = __S.player; p.invuln = 999; for (const id of ['crybaby_bib', 'onion_skin', 'third_eye_patch', 'cracked_marble', 'bent_fork']) __game.giveItem(p, id); });
    const r = await evalg(() => __S.floor.rooms.find((r) => r.type === 'normal' && r.cells.length === 1).id);
    await evalg((id) => { const r = __S.floor.rooms[id]; __game.transitionTo(r, r.doors[0], 'fade'); }, r);
    await wait(800);
    await evalg(() => { for (let i = 0; i < 24; i++) { const e = window.__spawnEnemy(['moaner', 'gnat', 'pipe', 'clot', 'spider'][i % 5], 1 + (i % 12), 1 + Math.floor(i / 12) * 4); if (e) e.maxHp = e.hp = 9999; } });
    await evalg(() => { __S.player.x = 6.5; __S.player.z = 5.5; for (const e of __S.enemies) { e.status.freeze = 999; } const g = __game; const u = g.update.bind(g), r = g.render.bind(g); window.__ut = []; g.update = (dt) => { const t = performance.now(); u(dt); window.__ut.push(performance.now() - t); }; g.render = (dt) => { const t = performance.now(); r(dt); window.__ut.push(performance.now() - t); }; });
    await page.keyboard.down('ArrowUp');
    await evalg(() => import('/src/entities/tears.js').then((m) => { window.__keepTears = setInterval(() => { while (__S.tears.length < 80) { const a = Math.random() * 6.28; m.spawnTear({ x: 6.5, z: 3.5, vx: Math.cos(a) * 4, vz: Math.sin(a) * 4, dmg: 0.01, range: 12, owner: 'player', flags: { bounce: 1 } }); } }, 50); }));
    await evalg(() => { window.__frames = []; let last = performance.now(); const f = (t) => { window.__frames.push(t - last); last = t; if (window.__frames.length < 300) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await wait(6000);
    await shot('perf');
    await page.keyboard.up('ArrowUp');
    console.log(JSON.stringify(await evalg(() => { const f = window.__frames.slice(10); f.sort((a, b) => a - b); const u = window.__ut.slice(60).sort((a, b) => a - b); return { updMedian: u[Math.floor(u.length / 2)].toFixed(2), updP99: u[Math.floor(u.length * 0.99)].toFixed(2), n: f.length, median: f[Math.floor(f.length / 2)].toFixed(1), p95: f[Math.floor(f.length * 0.95)].toFixed(1), tears: __S.tears.length, shots: __S.shots.length, enemies: __S.enemies.length, fx: __S.fx.length }; })));
  },
};
const scenarios = {
  ...scenarios0,
  async bigroom() {
    await startRun('ABCD 1234');
    await evalg(() => __game.startFloor(4)); await wait(500);
    for (const shape of ['L10', '2x2']) {
      await evalg((shape) => { const p = __S.player; p.invuln = 99; const r = __S.floor.rooms.find((r) => r.shape === shape); __game.transitionTo(r, r.doors[0], 'fade'); }, shape);
      await wait(900); await shot('big-' + shape);
      await fight(5000); await shot('big-' + shape + '-b');
    }
  },
  async gallery() {
    await startRun();
    // all enemies frozen in the start room
    await evalg(() => {
      const types = Object.keys(window.__DEFS).filter((t) => !t.startsWith('boss_') && !t.startsWith('hm_'));
      types.forEach((t, i) => { const e = window.__spawnEnemy(t, 1 + (i % 9) * 1.4, 1 + Math.floor(i / 9) * 1.7); if (e) { e.status.freeze = 999; e.untargetable = true; } });
      __S.player.x = 12; __S.player.z = 6;
    });
    await wait(400); await shot('g-enemies');
    await evalg(() => { for (const e of __S.enemies) e.destroy(); __S.enemies.length = 0; });
    await evalg(() => { const ids = Object.keys(window.__ITEMS); ids.slice(0, 48).forEach((id, i) => window.__spawnPickup('pedestal', 0.8 + (i % 12) * 1.05, 0.8 + Math.floor(i / 12) * 1.6, { itemId: id })); __S.player.x = 6.5; __S.player.z = 6.6; });
    await wait(400); await shot('g-items1');
    await evalg(() => { for (const p of __S.pickups) p.destroy(); __S.pickups.length = 0; const ids = Object.keys(window.__ITEMS); ids.slice(48).forEach((id, i) => window.__spawnPickup('pedestal', 0.8 + (i % 12) * 1.05, 0.8 + Math.floor(i / 12) * 1.6, { itemId: id })); });
    await wait(400); await shot('g-items2');
  },
  async boss() {
    await startRun(process.argv[4] || 'TEST 0001');
    const which = process.argv[5];
    const items = (process.argv[6] || '').split(',').filter(Boolean);
    await evalg(([which, items]) => {
      const p = __S.player; for (const id of items) __game.giveItem(p, id);
      p.maxRed = 12; p.red = 12;
      const r = __S.floor.rooms.find((r) => r.type === 'boss');
      if (which) { r.boss = which; const c = r.contents && r.contents.find((c) => c.kind === 'boss'); if (c) c.id = which; }
      __game.transitionTo(r, r.doors[0], 'fade');
    }, [which, items]);
    await wait(700); await shot('b-intro');
    await wait(2200);
    if (process.env.HMLOW) { await evalg(() => { const m = __S.enemies.find((e) => e.type === 'boss_housemother'); m.hp = m.maxHp * 0.025; }); await fight(4000); await shot('hm-phase2'); await evalg(() => { const h = __S.enemies.find((e) => e.type === 'hm_heart'); if (h) h.hp = 30; }); await fight(8000); await wait(3500); await shot('hm-win-panel'); for (let k = 0; k < 4; k++) { await page.keyboard.press('Enter'); await wait(500); } await shot('hm-win'); return; }
    for (let i = 0; i < 6; i++) { await fight(5000); await shot('b-' + i); const st = await evalg(() => ({ state: __game.state, hp: __S.player.red, boss: __S.enemies.filter((e) => e.isBoss && e.alive).map((e) => e.type + ':' + Math.round(e.hp) + ':' + e.state + ':' + e.t.toFixed(1) + ':' + e.x.toFixed(1) + ',' + e.z.toFixed(1)) })); console.log(JSON.stringify(st)); if (st.state !== 'play' || !st.boss.length) break; }
  },
  async rooms() {
    await page.keyboard.press('Enter');
    await wait(200);
    await page.fill('input', process.argv[4] || 'TEST 0001');
    await page.keyboard.press('Enter');
    await wait(1000);
    const ids = await evalg(() => __S.floor.rooms.filter((r) => r.type === 'normal').map((r) => r.id));
    for (let i = 0; i < Math.min(ids.length, Number(process.argv[5] || 4)); i++) {
      await evalg((id) => { const r = __S.floor.rooms[id]; __game.transitionTo(r, r.doors[0], 'fade'); }, ids[i]);
      await wait(900);
      await shot('fight-' + i + '-a');
      await fight(6000);
      await shot('fight-' + i + '-b');
      console.log(JSON.stringify(await evalg(() => ({ state: __game.state, room: __S.room.type, shape: __S.room.shape, enemies: __S.enemies.filter(e=>e.alive).map(e=>e.type), cleared: __S.room.cleared, hp: __S.player.red, kills: __S.run.kills }))));
    }
  },
  async basic() {
    await page.keyboard.press('Enter'); // New Run
    await wait(300);
    await shot('01-chars');
    await page.fill('input', 'TEST 0001');
    await page.keyboard.press('Enter');
    await wait(1200);
    await shot('02-start');
    await hold(['KeyD'], 500);
    await hold(['ArrowRight'], 700);
    await shot('03-shoot');
    await hold(['KeyW', 'ArrowUp'], 600);
    await shot('04-move');
    const info = await evalg(() => ({ state: __game.state, room: __S.room.type, rooms: __S.floor.rooms.length, px: __S.player.x, pz: __S.player.z, tears: __S.tears.length, fps: 0 }));
    console.log(JSON.stringify(info));
  },
  async explore() {
    await page.keyboard.press('Enter');
    await wait(200);
    await page.fill('input', process.argv[4] || 'TEST 0001');
    await page.keyboard.press('Enter');
    await wait(1000);
    // walk through doors of the start room in turn
    const doors = await evalg(() => __S.room.doors.map((d) => d.side));
    console.log('start doors', doors);
    const keyFor = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
    for (let i = 0; i < 6; i++) {
      const d = await evalg(() => { const r = __S.room; const d = r.doors.find((d) => !d.hidden && !d.lock); return d ? { side: d.side, x: d.x, z: d.z } : null; });
      if (!d) break;
      // steer toward the door
      for (let k = 0; k < 40; k++) {
        const st = await evalg(() => ({ x: __S.player.x, z: __S.player.z, state: __game.state, id: __S.room.id }));
        if (st.state !== 'play') break;
        const dx = d.x - st.x, dz = d.z - st.z;
        const keys = [];
        if (Math.abs(dx) > 0.2) keys.push(dx > 0 ? 'KeyD' : 'KeyA');
        if (Math.abs(dz) > 0.2) keys.push(dz > 0 ? 'KeyS' : 'KeyW');
        if (!keys.length) keys.push(keyFor[d.side]);
        // shoot at enemies on the way
        const shoot = await evalg(() => { const p = __S.player; const e = __S.enemies.find((e) => e.alive); if (!e) return null; const dx = e.x - p.x, dz = e.z - p.z; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dz > 0 ? 'ArrowDown' : 'ArrowUp'); });
        if (shoot) keys.push(shoot);
        await hold(keys, 120);
      }
      await wait(500);
      await shot('room-' + i);
      console.log(JSON.stringify(await evalg(() => ({ state: __game.state, room: __S.room.type, id: __S.room.id, enemies: __S.enemies.length, hp: __S.player.red }))));
    }
  },
};
try {
  await scenarios[scenario]();
} catch (e) { errors.push('[script] ' + e.message); }
const perf = await evalg(() => ({ calls: window.__game ? 1 : 0 }));
console.log('errors:', errors.length ? '\n' + errors.slice(0, 30).join('\n') : 'none');
await browser.close();
await server.close();
