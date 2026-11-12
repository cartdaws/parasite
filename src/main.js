import * as THREE from 'three';
import './style.css';
import { Game } from './game.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { Audio } from './audio.js';

// Bootstrap: one renderer, input, HUD and audio for the page; a fresh Game for every run.
const canvas = document.getElementById('c');
const ui = document.getElementById('ui');
const touchy = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !touchy, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, touchy ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const input = new Input(canvas, ui);
const hud = new HUD(ui);
const audio = new Audio();
let game = null;

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const howTo = () => input.touch
  ? `<p class="keys"><b>Left thumb</b> move (push far to run) · <b>Right thumb</b> look<br><b>LEAP</b> jump onto someone who hasn't seen you · <b>EXIT</b> leave a host</p>`
  : `<p class="keys"><b>WASD</b> move · <b>Shift</b> run · <b>Mouse</b> look<br><b>E</b> leap onto a host · <b>Q</b> leave host · <b>Click</b> shoot (guards)</p>`;

function newGame() {
  if (game) { game.dispose(); }
  game = new Game({ renderer, input, hud, audio, onEnd });
  hud.possessed(null);
}

function menu() {
  newGame();
  hud.show(false);
  input.enabled = false;
  const s = hud.screen(`
    <h1>PARASITE</h1>
    <p class="tag">You are something that got aboard. They will kill it on sight.<br>Wear them instead.</p>
    <ul class="rules">
      <li><b>Guards</b> carry guns.</li>
      <li><b>Scientists</b> open the lab.</li>
      <li><b>Bots</b> slip past the scanner.</li>
    </ul>
    <p class="tag small">Every host rots. Bodies get found. Reach the escape pod.</p>
    <button id="play">PLAY</button>
    ${howTo()}
    <p class="build">build ${__BUILD__}</p>`, 'menu');
  s.querySelector('#play').onclick = start;
}

function start() {
  audio.unlock();
  hud.screen('');
  hud.show(true);
  input.enabled = true;
  game.state = 'play';
  game.camera.position.set(0, 0, 0);
  if (!input.touch) canvas.requestPointerLock?.();
  hud.toast(input.touch ? 'FIND A HOST' : 'FIND A HOST — sneak up behind one and press E', 4);
}

function pause() {
  if (!game || game.state !== 'play') return;
  game.state = 'pause';
  input.enabled = false;
  const s = hud.screen(`<h2>PAUSED</h2><button id="resume">RESUME</button><button id="restart" class="ghost">RESTART</button>${howTo()}`, 'pause');
  s.querySelector('#resume').onclick = () => { hud.screen(''); game.state = 'play'; input.enabled = true; if (!input.touch) canvas.requestPointerLock?.(); };
  s.querySelector('#restart').onclick = () => { menu(); start(); };
}

function onEnd(r) {
  input.enabled = false;
  document.exitPointerLock?.();
  setTimeout(() => {
    const s = hud.screen(r.won
      ? `<h2 class="win">ESCAPED</h2><p class="tag">Launched as a ${r.form.toLowerCase()} in ${fmt(r.time)}.</p>
         <p class="stats">${r.hosts} host${r.hosts === 1 ? '' : 's'} worn · ${r.alarms} alarm${r.alarms === 1 ? '' : 's'}</p><button id="again">PLAY AGAIN</button>`
      : `<h2 class="lose">${r.msg}</h2><p class="stats">${fmt(r.time)} · ${r.hosts} host${r.hosts === 1 ? '' : 's'} worn</p><button id="again">TRY AGAIN</button>`, 'end');
    s.querySelector('#again').onclick = () => { menu(); start(); };
  }, r.won ? 900 : 1400);
}

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); game?.resize(); });

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game) {
    if (input.pressed('pause')) { input.endFrame(); pause(); }
    if (game.state === 'play' || game.state === 'menu' || game.state === 'end') game.update(dt);
    game.render();
  }
}
menu();
requestAnimationFrame(frame);
window.__boot = { start, menu, get game() { return game; } };
