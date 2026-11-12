// Headless smoke test: boots the built game, checks for errors, plays scripted beats through the debug hook, takes screenshots.
// usage: npm run build && node tools/smoke.mjs [outdir]
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] || 'shots';
mkdirSync(out, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', '4317', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => { server.stdout.on('data', (d) => { if (String(d).includes('4317')) r(); }); setTimeout(r, 4000); });
const URL = 'http://localhost:4317/?debug';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failures++; };

async function run(name, ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__boot && window.__boot.game);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}-menu.png` });
  await page.click('#play');
  await page.waitForTimeout(800);
  // step the simulation directly (software GL renders too slowly to play in real time)
  const step = (secs) => page.evaluate((s) => { const g = window.__boot.game; for (let i = 0; i < s * 30; i++) g.update(1 / 30); }, secs);
  await step(1);
  await page.screenshot({ path: `${out}/${name}-start.png` });

  // beat 1: sneak behind the cargo guard and leap
  const r1 = await page.evaluate(() => {
    const g = window.__boot.game, w = g.player.worm, guard = g.actors.find((a) => a.type === 'guard' && a.home === 'cargo');
    guard.state = 'patrol'; guard.path = null; guard.wait = 99; guard.yaw = 0; guard.look = 0;
    w.pos.set(guard.pos.x, 0, guard.pos.z - 2.5); w.fig.reset(w.pos);
    g.player.yaw = 0;
    for (let i = 0; i < 3; i++) g.update(1 / 30);
    const t = g.player.target === guard;
    g.input.press('use');
    for (let i = 0; i < 60; i++) g.update(1 / 30);
    return { targeted: t, host: g.player.host?.type, phase: g.player.phase };
  });
  check(r1.targeted, `${name}: guard is a leap target from behind`);
  check(r1.host === 'guard', `${name}: possessed the guard (host=${r1.host}, phase=${r1.phase})`);
  await step(0.5);
  await page.screenshot({ path: `${out}/${name}-guard.png` });

  // beat 2: shoot; tracers and noise must not throw
  await page.evaluate(() => { const g = window.__boot.game; g.input.press('fire'); for (let i = 0; i < 20; i++) g.update(1 / 30); g.input.down.delete('fire'); });
  await page.screenshot({ path: `${out}/${name}-shoot.png` });

  // beat 3: leave the host -> a body on the floor, worm out
  const r3 = await page.evaluate(() => { const g = window.__boot.game; g.input.press('leave'); for (let i = 0; i < 30; i++) g.update(1 / 30); return { host: !!g.player.host, bodies: g.actors.filter((a) => !a.alive).length }; });
  check(!r3.host && r3.bodies >= 1, `${name}: left host, body on the floor (${r3.bodies})`);

  // beat 4: walk into the hall guard's view as the worm -> he notices
  const r4 = await page.evaluate(() => {
    const g = window.__boot.game, w = g.player.worm, guard = g.actors.find((a) => a.type === 'guard' && a.home === 'hall');
    guard.state = 'patrol'; guard.path = null; guard.wait = 99; guard.look = 0; guard.yaw = 0; guard.pos.set(25, 0, 19);
    w.pos.set(guard.pos.x + Math.sin(guard.yaw) * 4, 0, guard.pos.z + Math.cos(guard.yaw) * 4); w.fig.reset(w.pos);
    g.world.collide(w.pos, 0.22, 'worm', null);
    let maxS = 0;
    for (let i = 0; i < 60; i++) { g.update(1 / 30); maxS = Math.max(maxS, guard.susp); }
    return { susp: maxS, state: guard.state, seen: guard.canSee(w, g.world, g) };
  });
  check(r4.susp > 0.3, `${name}: hall guard notices the worm (susp ${r4.susp.toFixed(2)}, ${r4.state})`);
  await step(1.5);
  await page.screenshot({ path: `${out}/${name}-spotted.png` });

  // beat 5: scientist route: possess the crew scientist, walk the path to the pod through both lab doors
  const r5 = await page.evaluate(() => {
    const g = window.__boot.game;
    g.alarm = 0; g.wanted = null;
    for (const a of g.actors) if (a.alive && !a.player && a.type !== 'worm') { a.susp = 0; a.setState('patrol'); }
    const sci = g.actors.find((a) => a.type === 'scientist' && a.home === 'crew' && a.alive);
    g.player.possess(sci);
    // the stealthy route: through the lab, not the scanner (which would trip the alarm)
    const gi = g.world.gate.cy * 40 + g.world.gate.cx, gk = g.world.grid[gi];
    g.world.grid[gi] = 0;
    const path = g.world.path(sci.pos.x, sci.pos.z, g.world.pod.x, g.world.pod.z, 'human', 'scientist');
    g.world.grid[gi] = gk;
    let steps = 0;
    while (g.state === 'play' && path && path.length && steps < 30 * 90) {
      const p = path[0], dx = p.x - sci.pos.x, dz = p.z - sci.pos.z;
      if (Math.hypot(dx, dz) < 0.5) { path.shift(); continue; }
      // drive the input as a player would: face the waypoint with the camera, push forward
      g.player.yaw = Math.atan2(dx, dz);
      g.input.move.x = 0; g.input.move.y = 1;
      g.input.update = () => {};
      g.update(1 / 30); steps++;
      if (!g.player.host) break;
    }
    return { alarm: g.alarms, hp: sci.hp, state: g.state, steps, hasPath: !!path, at: [sci.pos.x.toFixed(1), sci.pos.z.toFixed(1)] };
  });
  check(r5.hasPath, `${name}: scientist has a route to the pod`);
  check(r5.state === 'end', `${name}: scientist reaches the pod (state=${r5.state}, ${r5.steps} steps, at ${r5.at}, alarms ${r5.alarm}, hp ${r5.hp})`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}-end.png` });
  check(errors.length === 0, `${name}: no page errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  await ctx.close();
}

await run('desktop', { viewport: { width: 1280, height: 720 } });
await run('phone', { ...devices['iPhone 13'] });
await browser.close();
server.kill();
console.log(failures ? `${failures} failure(s)` : 'all good');
process.exit(failures ? 1 : 0);
