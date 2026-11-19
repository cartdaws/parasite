// Phone emulation playtest: tap through menus, drive both sticks with touch events.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || 'mobile-out'; fs.mkdirSync(out, { recursive: true });
const server = await createServer({ root: path.resolve(import.meta.dirname, '..'), server: { port: 5198 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
const shot = (n) => page.screenshot({ path: path.join(out, n + '.png') });
await page.goto(server.resolvedUrls.local[0]);
await page.waitForTimeout(800);
await shot('m0-title');
await page.tap('text=New Run'); await page.waitForTimeout(300);
await shot('m1-chars');
await page.tap('text=Go Down'); await page.waitForTimeout(600);
for (let i = 0; i < 6; i++) { if (!(await page.evaluate(() => document.getElementById('panels').classList.contains('active')))) break; await page.tap('#panels'); await page.waitForTimeout(450); }
await page.waitForTimeout(800);
const vp = page.viewportSize();
const before = await page.evaluate(() => ({ x: __S.player.x, z: __S.player.z }));
// left thumb pushes right, right thumb cries up
await touch('touchStart', [[150, 260], [vp.width - 200, 260]]);
for (let k = 1; k <= 10; k++) { await touch('touchMove', [[150 + k * 6, 260], [vp.width - 200, 260 - k * 5]]); await page.waitForTimeout(40); }
await page.waitForTimeout(500);
await shot('m2-play');
const mid = await page.evaluate(() => ({ x: __S.player.x, z: __S.player.z, tears: __S.tears.length, head: __S.player.headDir }));
await touch('touchEnd', []);
await page.tap('.tbtn.bomb'); await page.waitForTimeout(300);
const bombs = await page.evaluate(() => __S.bombs.length);
await page.tap('text=❚❚'); await page.waitForTimeout(300);
await shot('m3-pause');
const st = await page.evaluate(() => __game.state);
console.log(JSON.stringify({ before, mid, bombs, pausedState: st }));
await ctx.close(); const p2 = await browser.newPage({ ...devices['iPhone 13'] }); await p2.goto(server.resolvedUrls.local[0]); await p2.waitForTimeout(600); await p2.screenshot({ path: path.join(out, 'm4-portrait.png') });
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close(); await server.close();
