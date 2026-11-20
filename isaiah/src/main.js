// Entry point: boot renderer, HUD, UI and the fixed-timestep loop.
import { fontsReady } from './fonts.js';
import { initGfx, renderFrame } from './render/gfx.js';
import { startLoop } from './core/loop.js';
import { save } from './core/save.js';
import { audio } from './core/audio.js';
import { Game } from './game.js';
import { HUD } from './ui/hud.js';
import { UI, applySettings } from './ui/menus.js';
import { S } from './state.js';
import { CFG } from './config.js';
import { initTouch, setTouchVisible, touch } from './core/touch.js';
import { setIconFn, ITEMS } from './items/items.js';
import { DEFS, spawnEnemy } from './entities/enemies.js';
import { spawnPickup } from './entities/pickups.js';
import * as logicMod from './items/logic.js';
import * as consMod from './items/consumables.js';
import { itemIconTex } from './render/art_items.js';
setIconFn(itemIconTex);

save.load();
initGfx(document.getElementById('gl'));
const hud = new HUD(document.getElementById('hud'));
const ui = new UI(hud, document.getElementById('ui'));
const game = new Game(ui);
applySettings();
initTouch();
window.addEventListener('pointerdown', () => { audio.unlock(); if (game.state === 'bossintro') touch.pressed.add('confirm'); });
window.addEventListener('keydown', () => audio.unlock());

// canvas art bakes text into textures, so wait for the bundled fonts first
fontsReady().then(() => {
startLoop(
  (dt) => game.update(dt),
  (dt) => {
    game.render(dt); renderFrame(dt); hud.draw(dt);
    setTouchVisible(['play', 'transition', 'cutscene'].includes(game.state) && !ui.screen);
  },
  CFG.TICK,
);
ui.showTitle();
});
// debugging / automated playtests
window.__S = S;
Object.assign(window, { __DEFS: DEFS, __spawnEnemy: spawnEnemy, __spawnPickup: spawnPickup, __ITEMS: ITEMS, __logic: logicMod, __cons: consMod });
window.__game = game;
window.__ui = ui;
