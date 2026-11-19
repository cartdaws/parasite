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
      const es = __S.enemies.filter((e) => e.alive && !e.untargetable);
      if (!es.length) return { done: true };
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
const scenarios = {
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
