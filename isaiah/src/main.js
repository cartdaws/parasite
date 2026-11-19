// Entry point: boot renderer, HUD, UI and the fixed-timestep loop.
import { initGfx, renderFrame } from './render/gfx.js';
import { startLoop } from './core/loop.js';
import { save } from './core/save.js';
import { audio } from './core/audio.js';
import { Game } from './game.js';
import { HUD } from './ui/hud.js';
import { UI, applySettings } from './ui/menus.js';
import { S } from './state.js';
import { CFG } from './config.js';
import { setIconFn } from './items/items.js';
import { itemIconTex } from './render/art_items.js';
setIconFn(itemIconTex);

save.load();
initGfx(document.getElementById('gl'));
const hud = new HUD(document.getElementById('hud'));
const ui = new UI(hud, document.getElementById('ui'));
const game = new Game(ui);
applySettings();
window.addEventListener('pointerdown', () => audio.unlock());
window.addEventListener('keydown', () => audio.unlock());

startLoop(
  (dt) => game.update(dt),
  (dt) => { game.render(dt); renderFrame(dt); hud.draw(dt); },
  CFG.TICK,
);
ui.showTitle();
// debugging / automated playtests
window.__S = S;
import('./entities/enemies.js').then((m) => { window.__DEFS = m.DEFS; window.__spawnEnemy = m.spawnEnemy; });
import('./entities/pickups.js').then((m) => { window.__spawnPickup = m.spawnPickup; });
import('./items/items.js').then((m) => { window.__ITEMS = m.ITEMS; });
window.__game = game;
window.__ui = ui;
