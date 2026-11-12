// Keyboard + mouse (pointer lock) and touch (left-half stick, right-half look, on-screen buttons).
// Game code reads: move {x, y}, run, takeLook(), held(name), pressed(name). Actions: use, leave, fire.
export class Input {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.run = false;
    this.look = { x: 0, y: 0 };
    this.down = new Set();
    this.edges = new Set();
    this.touch = false;
    this.enabled = false;
    this.sens = 0.0024;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const a = { KeyE: 'use', KeyF: 'use', Space: 'use', KeyQ: 'leave', KeyR: 'fire' }[e.code];
      if (a) this.press(a);
      if (e.code === 'Escape') this.edges.add('pause');
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); const a = { KeyE: 'use', KeyF: 'use', Space: 'use', KeyQ: 'leave', KeyR: 'fire' }[e.code]; if (a) this.down.delete(a); });
    addEventListener('blur', () => { this.keys.clear(); this.down.clear(); });
    canvas.addEventListener('mousedown', (e) => {
      if (this.touch || !this.enabled) return;
      if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
      if (e.button === 0) this.press('fire');
      if (e.button === 2) this.press('use');
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.down.delete('fire'); if (e.button === 2) this.down.delete('use'); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) { this.look.x += e.movementX * this.sens; this.look.y += e.movementY * this.sens; }
    });
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && this.enabled && !this.touch) this.edges.add('pause'); });

    this.buildTouch(ui);
  }

  press(a) { this.down.add(a); this.edges.add(a); }
  held(a) { return this.down.has(a); }
  pressed(a) { return this.edges.has(a); }
  takeLook() { const l = { x: this.look.x, y: this.look.y }; this.look.x = this.look.y = 0; return l; }
  endFrame() { this.edges.clear(); }

  update() {
    if (this.touch) return;   // the stick writes move directly
    const k = this.keys;
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const l = Math.hypot(x, y) || 1;
    this.move.x = x / l; this.move.y = y / l;
    this.run = k.has('ShiftLeft') || k.has('ShiftRight');
  }

  buildTouch(ui) {
    const root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = `
      <div class="stick"><div class="nub"></div></div>
      <button data-a="fire" class="tb fire">FIRE</button>
      <button data-a="use" class="tb use">LEAP</button>
      <button data-a="leave" class="tb leave">EXIT</button>
      <button data-a="pause" class="tb pause">II</button>`;
    ui.appendChild(root);
    this.touchUI = root;
    this.btn = {};
    for (const b of root.querySelectorAll('button')) {
      this.btn[b.dataset.a] = b;
      const a = b.dataset.a;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); if (a === 'pause') this.edges.add('pause'); else this.press(a); b.classList.add('on'); }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); this.down.delete(a); b.classList.remove('on'); }, { passive: false });
    }
    const stick = root.querySelector('.stick'), nub = root.querySelector('.nub');
    let stickId = null, sx = 0, sy = 0, lookId = null, lx = 0, ly = 0;
    const R = 56;
    const start = (e) => {
      if (!this.enabled) return;
      this.setTouch(true);
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && stickId === null) {
          stickId = t.identifier; sx = t.clientX; sy = t.clientY;
          stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.classList.add('on');
        } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
      }
      e.preventDefault();
    };
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          let dx = t.clientX - sx, dy = t.clientY - sy;
          const d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          nub.style.transform = `translate(${dx}px, ${dy}px)`;
          this.move.x = dx / R; this.move.y = -dy / R;
          this.run = d > R * 0.92;
        } else if (t.identifier === lookId) {
          this.look.x += (t.clientX - lx) * 0.0062; this.look.y += (t.clientY - ly) * 0.0048;
          lx = t.clientX; ly = t.clientY;
        }
      }
      e.preventDefault();
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { stickId = null; this.move.x = this.move.y = 0; this.run = false; nub.style.transform = ''; stick.classList.remove('on'); }
        if (t.identifier === lookId) lookId = null;
      }
    };
    this.canvas.addEventListener('touchstart', start, { passive: false });
    this.canvas.addEventListener('touchmove', move, { passive: false });
    this.canvas.addEventListener('touchend', end);
    this.canvas.addEventListener('touchcancel', end);
    if (matchMedia('(pointer: coarse)').matches) this.setTouch(true);
  }

  setTouch(on) { this.touch = on; document.body.classList.toggle('touch', on); }

  // which buttons make sense right now, and what they say
  setButtons({ use, useLabel, leave, fire }) {
    if (!this.btn) return;
    this.btn.use.style.display = use ? '' : 'none';
    if (useLabel) this.btn.use.textContent = useLabel;
    this.btn.leave.style.display = leave ? '' : 'none';
    this.btn.fire.style.display = fire ? '' : 'none';
  }
}
