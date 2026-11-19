// Keyboard + gamepad input. Polled once per fixed tick via update().
// move: {x, z} analog vector; shootDir: 0 up, 1 right, 2 down, 3 left, -1 none.

const BIND = {
  up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
  shootUp: ['ArrowUp'], shootDown: ['ArrowDown'], shootLeft: ['ArrowLeft'], shootRight: ['ArrowRight'],
  bomb: ['KeyE'], card: ['KeyQ'], active: ['Space'], pause: ['Escape', 'KeyP'],
  restart: ['KeyR'], map: ['Tab'], drop: ['ControlLeft', 'ControlRight'],
  confirm: ['Enter', 'Space'],
};
const SHOOT_KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up right down left (x, z)

class Input {
  constructor() {
    this.down = new Set();
    this.queue = new Set();      // keys pressed since last tick
    this.shootStack = [];        // arrow keys in press order
    this.move = { x: 0, z: 0 };
    this.shootDir = -1;
    this.justPressed = new Set(); // action names this tick
    this.anyKey = false;
    this.padPrev = [];
    this.padShootDir = -1;
    this.usingPad = false;
    this.enabled = true;
    this.onAnyKeyDown = null;    // for menus
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code) && !(e.target instanceof HTMLInputElement)) e.preventDefault();
      if (e.target instanceof HTMLInputElement) return;
      if (!e.repeat) {
        this.queue.add(e.code);
        if (e.code in SHOOT_KEYS) {
          this.shootStack = this.shootStack.filter((c) => c !== e.code);
          this.shootStack.push(e.code);
        }
        if (this.onAnyKeyDown) this.onAnyKeyDown(e);
      }
      this.down.add(e.code);
      this.usingPad = false;
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      if (e.code in SHOOT_KEYS) this.shootStack = this.shootStack.filter((c) => c !== e.code);
    });
    window.addEventListener('blur', () => { this.down.clear(); this.shootStack = []; });
  }

  held(action) {
    for (const k of BIND[action]) if (this.down.has(k)) return true;
    return false;
  }
  pressed(action) { return this.justPressed.has(action); }

  update() {
    this.justPressed.clear();
    for (const [action, keys] of Object.entries(BIND)) {
      for (const k of keys) if (this.queue.has(k)) { this.justPressed.add(action); break; }
    }
    this.anyKey = this.queue.size > 0;
    this.queue.clear();

    // keyboard movement
    let mx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    let mz = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    // keyboard shooting: last pressed arrow still held wins
    let sd = this.shootStack.length ? SHOOT_KEYS[this.shootStack[this.shootStack.length - 1]] : -1;

    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find((p) => p && p.connected);
    if (pad) {
      const dz = 0.25;
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (Math.hypot(ax, ay) > dz) { mx = ax; mz = ay; this.usingPad = true; }
      const b = pad.buttons.map((x) => x.pressed);
      const rx = pad.axes[2] || 0, ry = pad.axes[3] || 0;
      let pd = -1;
      if (Math.hypot(rx, ry) > 0.45) pd = Math.abs(rx) > Math.abs(ry) ? (rx > 0 ? 1 : 3) : (ry > 0 ? 2 : 0);
      // face buttons: Y up, B right, A down, X left (standard mapping)
      if (b[3]) pd = 0; if (b[1]) pd = 1; if (b[0]) pd = 2; if (b[2]) pd = 3;
      if (b[12]) mz = -1; if (b[13]) mz = 1; if (b[14]) mx = -1; if (b[15]) mx = 1;
      if (pd >= 0) { sd = pd; this.usingPad = true; }
      const edge = (i) => b[i] && !this.padPrev[i];
      if (edge(6) || edge(4)) this.justPressed.add(edge(6) ? 'bomb' : 'card');
      if (edge(7)) this.justPressed.add('active');
      if (edge(5)) this.justPressed.add('card');
      if (edge(9)) this.justPressed.add('pause');
      if (edge(8)) this.justPressed.add('map');
      if (edge(0)) this.justPressed.add('confirm');
      if (b.some((x, i) => x && !this.padPrev[i])) this.anyKey = true;
      this.padPrev = b;
      this.padHeldRestart = b[8] && b[9];
    }

    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    this.move.x = mx; this.move.z = mz;
    this.shootDir = sd;
    if (!this.enabled) { this.move.x = this.move.z = 0; this.shootDir = -1; }
  }
}

export const input = new Input();
