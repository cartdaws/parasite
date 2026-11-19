// Phone playtest across viewport sizes: every menu screen must have its buttons
// on screen (or reachable by scrolling), and the game must be playable by touch.
// usage: node tools/mobiletest.mjs <outDir>
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || 'mobile-out'; fs.mkdirSync(out, { recursive: true });
const server = await createServer({ root: path.resolve(import.meta.dirname, '..'), server: { port: 5198 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// realistic visible areas: phone browsers and in-app viewers lose height to bars
const SIZES = { 'land-small': [640, 300], 'land-iphone': [750, 340], 'portrait-small': [360, 600], 'portrait-iphone': [390, 700] };
const report = [];
for (const [name, [w, h]] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const shot = (n) => page.screenshot({ path: path.join(out, `${name}-${n}.png`) });
  // every button must be fully inside the viewport after scrolling it into view
  const checkButtons = async (screen) => {
    const bad = await page.evaluate(() => [...document.querySelectorAll('#ui .btn')].filter((b) => { b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return r.bottom > innerHeight + 1 || r.top < -1 || r.right > innerWidth + 1 || r.left < -1; }).map((b) => b.textContent));
    const fits = await page.evaluate(() => { const u = document.getElementById('ui'); return u.scrollHeight <= u.clientHeight + 2; });
    report.push(`${name} ${screen}: ${bad.length ? 'UNREACHABLE ' + bad.join(',') : 'ok'}${fits ? '' : ' (scrolls)'}`);
  };
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForTimeout(700);
  await shot('0-title'); await checkButtons('title');
  await page.tap('text=New Run'); await page.waitForTimeout(300);
  await shot('1-chars'); await checkButtons('chars');
  await page.tap('text=Go Down'); await page.waitForTimeout(600);
  for (let i = 0; i < 6; i++) { if (!(await page.evaluate(() => document.getElementById('panels').classList.contains('active')))) break; if (i === 0) await shot('2-panel'); await page.tap('#panels'); await page.waitForTimeout(450); }
  await page.waitForTimeout(900);
  const before = await page.evaluate(() => __S.player.x);
  const ly = h * 0.8, rx = w * 0.8;
  await touch('touchStart', [[w * 0.2, ly], [rx, ly]]);
  for (let k = 1; k <= 10; k++) { await touch('touchMove', [[w * 0.2 + k * 6, ly], [rx, ly - k * 5]]); await page.waitForTimeout(40); }
  await page.waitForTimeout(400);
  await shot('3-play');
  const moved = (await page.evaluate(() => __S.player.x)) - before;
  const tears = await page.evaluate(() => __S.tears.length);
  await touch('touchEnd', []);
  await page.tap('text=❚❚'); await page.waitForTimeout(300);
  await shot('4-pause'); await checkButtons('pause');
  await page.tap('text=Resume'); await page.waitForTimeout(200);
  await page.evaluate(() => { const r = __S.floor.rooms.find((r) => r.type === 'boss'); __game.transitionTo(r, r.doors[0], 'fade'); });
  await page.waitForTimeout(1100); await shot('5-bossintro');
  await page.waitForTimeout(2200); await shot('6-boss');
  await page.evaluate(() => { __S.player.invuln = 0; __S.player.hurt(99, 'a test'); });
  await page.waitForTimeout(2200); await shot('7-death'); await checkButtons('death');
  report.push(`${name} play: moved ${moved.toFixed(1)} tiles, tears ${tears}, errors ${errors.length ? errors.join(' | ') : 'none'}`);
  await ctx.close();
}
console.log(report.join('\n'));
await browser.close(); await server.close();
