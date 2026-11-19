// On-screen touch controls for phones/tablets: a floating move stick on the
// left half, a floating cry stick on the right half (snaps to 4 directions),
// and buttons for bomb / item / card / map / pause. Shown only on touch devices
// while a run is being played.

export const touch = {
  active: false,      // a touch device has been detected
  move: { x: 0, z: 0 },
  shootDir: -1,
  pressed: new Set(), // actions tapped since the last tick
};

const STICK_R = 56;   // px: full deflection radius

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  parent.appendChild(e);
  return e;
}

export function initTouch() {
  const root = el('div', 'touch-layer', document.body);
  const sticks = {};
  for (const side of ['left', 'right']) {
    const base = el('div', 'stick-base', root);
    const knob = el('div', 'stick-knob', base);
    sticks[side] = { base, knob, id: null, ox: 0, oy: 0 };
  }
  // hint labels shown before the first touch on each side
  el('div', 'touch-hint left', root, 'move');
  el('div', 'touch-hint right', root, 'cry');

  const btns = el('div', 'touch-btns', root);
  const mk = (label, action, cls = '') => {
    const b = el('div', 'tbtn ' + cls, btns, label);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); touch.pressed.add(action); b.classList.add('down'); });
    const up = () => b.classList.remove('down');
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    return b;
  };
  mk('💣', 'bomb', 'bomb');
  mk('★', 'active', 'act');
  mk('🂠', 'card', 'card');
  const top = el('div', 'touch-top', root);
  const topBtn = (label, action) => {
    const b = el('div', 'tbtn small', top, label);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); touch.pressed.add(action); });
  };
  topBtn('❚❚', 'pause');
  topBtn('map', 'map');

  const sideOf = (x) => (x < window.innerWidth / 2 ? 'left' : 'right');
  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    const s = sticks[sideOf(e.clientX)];
    if (s.id !== null) return;
    s.id = e.pointerId; s.ox = e.clientX; s.oy = e.clientY;
    s.base.style.left = e.clientX + 'px'; s.base.style.top = e.clientY + 'px';
    s.base.classList.add('on');
    root.classList.add('used-' + sideOf(e.clientX));
    root.setPointerCapture?.(e.pointerId);
    moveStick(s, e.clientX, e.clientY);
  });
  root.addEventListener('pointermove', (e) => {
    for (const s of Object.values(sticks)) if (s.id === e.pointerId) { e.preventDefault(); moveStick(s, e.clientX, e.clientY); }
  });
  const end = (e) => {
    for (const [side, s] of Object.entries(sticks)) if (s.id === e.pointerId) {
      s.id = null; s.base.classList.remove('on'); s.knob.style.transform = '';
      if (side === 'left') { touch.move.x = touch.move.z = 0; } else touch.shootDir = -1;
    }
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);

  function moveStick(s, x, y) {
    let dx = x - s.ox, dy = y - s.oy;
    const d = Math.hypot(dx, dy);
    // let the stick follow the finger if it drags far, so it never "runs out"
    if (d > STICK_R * 1.6) { const k = (d - STICK_R * 1.6) / d; s.ox += dx * k; s.oy += dy * k; s.base.style.left = s.ox + 'px'; s.base.style.top = s.oy + 'px'; dx = x - s.ox; dy = y - s.oy; }
    const dd = Math.hypot(dx, dy);
    const cl = Math.min(1, dd / STICK_R);
    const kx = dd > 0 ? (dx / dd) * cl : 0, ky = dd > 0 ? (dy / dd) * cl : 0;
    s.knob.style.transform = `translate(${kx * STICK_R}px, ${ky * STICK_R}px)`;
    if (s === sticks.left) {
      const dead = 0.15;
      touch.move.x = cl > dead ? kx : 0; touch.move.z = cl > dead ? ky : 0;
    } else {
      touch.shootDir = dd < 14 ? touch.shootDir : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    }
  }

  const detect = () => { touch.active = true; document.body.classList.add('is-touch'); };
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) detect();
  window.addEventListener('touchstart', detect, { once: true, passive: true });
  touch.root = root;
}

/** Show the controls only during play (hidden behind menus, panels, title). */
export function setTouchVisible(on) {
  if (touch.root) touch.root.classList.toggle('show', on && touch.active);
}

/** Try to go fullscreen + landscape (must be called from a user gesture). */
export function goFullscreenLandscape() {
  if (!touch.active) return;
  try {
    const d = document.documentElement;
    const p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : d.webkitRequestFullscreen?.();
    Promise.resolve(p).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } catch { /* iOS Safari has no fullscreen API for pages; that's fine */ }
}
