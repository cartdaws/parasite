// three.js scene, tilted orthographic camera, pooled billboard sprites and
// flat floor quads. Entities talk to the renderer only through this module.
import * as THREE from 'three';
import { CFG } from '../config.js';
import { tex, rgba } from './draw.js';

const TILT = (CFG.CAMERA_TILT_DEG * Math.PI) / 180;
export const SIN_T = Math.sin(TILT);
export const COS_T = Math.cos(TILT);

export const gfx = {
  renderer: null, scene: null, camera: null,
  camTarget: new THREE.Vector3(),
  shake: 0, shakeX: 0, shakeZ: 0,
  viewW: CFG.VIEW_MIN_W, viewH: CFG.VIEW_MIN_H,
  layer: null,            // current entity layer (THREE.Group positioned at the room origin)
  width: 1, height: 1,
  shakeScale: 1,
};

export function initGfx(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.setClearColor(0x050304, 1);
  r.sortObjects = true;
  gfx.renderer = r;
  gfx.scene = new THREE.Scene();
  gfx.camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 200);
  resize();
  window.addEventListener('resize', resize);
  return gfx;
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  gfx.width = w; gfx.height = h;
  gfx.renderer.setSize(w, h, false);
  gfx.renderer.domElement.style.width = w + 'px';
  gfx.renderer.domElement.style.height = h + 'px';
  const aspect = w / h;
  let vw = CFG.VIEW_MIN_W, vh = CFG.VIEW_MIN_H;
  if (vw / vh > aspect) vh = vw / aspect; else vw = vh * aspect;
  gfx.viewW = vw; gfx.viewH = vh;
  const c = gfx.camera;
  c.left = -vw / 2; c.right = vw / 2; c.top = vh / 2; c.bottom = -vh / 2;
  c.updateProjectionMatrix();
  if (gfx.onResize) gfx.onResize(w, h);
}

/** Point the camera at a world-space floor point (x, z). */
export function setCamera(x, z) {
  gfx.camTarget.set(x, 0, z);
}
export function addShake(amount) { gfx.shake = Math.min(1.2, gfx.shake + amount * gfx.shakeScale); }

export function renderFrame(dt) {
  // screen shake decays quickly
  if (gfx.shake > 0.001) {
    gfx.shake *= Math.pow(0.0015, dt);
    gfx.shakeX = (Math.random() - 0.5) * gfx.shake * 0.6;
    gfx.shakeZ = (Math.random() - 0.5) * gfx.shake * 0.6;
  } else { gfx.shake = 0; gfx.shakeX = gfx.shakeZ = 0; }
  const c = gfx.camera, t = gfx.camTarget;
  const D = 60;
  // shift the look point up a bit so the top wall's face sits nicely on screen
  const lx = t.x + gfx.shakeX, lz = t.z + gfx.shakeZ - 0.15;
  c.position.set(lx, D * COS_T, lz + D * SIN_T);
  c.lookAt(lx, 0, lz);
  gfx.renderer.render(gfx.scene, c);
}

/** Project a world point to CSS pixel coordinates. */
const _v = new THREE.Vector3();
export function worldToScreen(x, y, z) {
  _v.set(x, y, z).project(gfx.camera);
  return { x: (_v.x * 0.5 + 0.5) * gfx.width, y: (-_v.y * 0.5 + 0.5) * gfx.height };
}
/** Scale: CSS pixels per world unit */
export function pxPerUnit() { return gfx.width / gfx.viewW; }

// ---- billboard sprites -------------------------------------------------------
const spritePool = [];
/**
 * Create a camera-facing sprite anchored at its feet.
 * Sprites render without depth test and are sorted by floor z (renderOrder).
 */
export function makeSprite(texture, w, h, parent = gfx.layer) {
  let s = spritePool.pop();
  if (!s) {
    const m = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    s = new THREE.Sprite(m);
    s.center.set(0.5, 0);
  } else {
    s.material.map = texture;
    s.material.color.setRGB(1, 1, 1);
    s.material.opacity = 1;
    s.material.rotation = 0;
    s.visible = true;
  }
  s.center.set(0.5, 0);
  s.scale.set(w, h, 1);
  s.userData.baseTex = texture;
  if (parent) parent.add(s);
  return s;
}
export function freeSprite(s) {
  if (!s) return;
  if (s.parent) s.parent.remove(s);
  s.material.blending = THREE.NormalBlending;
  spritePool.push(s);
}
/**
 * Position a sprite: (x, z) on the floor, h = visual height above the floor.
 * Height is faked by sliding the sprite up the screen.
 */
export function place(s, x, z, h = 0, bias = 0) {
  s.position.set(x, 0.05 + h * SIN_T, z - h * COS_T);
  s.renderOrder = 1000 + Math.round(z * 24) + bias;
}
export function setTex(s, t) { if (s.material.map !== t) s.material.map = t; }

// ---- flat floor quads (shadows, creep, scorch marks) --------------------------
const flatGeo = new THREE.PlaneGeometry(1, 1);
flatGeo.rotateX(-Math.PI / 2);
const flatPool = [];
export function makeFlat(texture, w, d, order = 300, parent = gfx.layer, opacity = 1) {
  let m = flatPool.pop();
  if (!m) {
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
    m = new THREE.Mesh(flatGeo, mat);
  } else { m.material.map = texture; m.visible = true; m.material.color.setRGB(1, 1, 1); }
  m.material.opacity = opacity;
  m.scale.set(w, 1, d);
  m.renderOrder = order;
  if (parent) parent.add(m);
  return m;
}
export function freeFlat(m) { if (!m) return; if (m.parent) m.parent.remove(m); flatPool.push(m); }

export const shadowTex = () => tex('shadow', 64, 32, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(10,5,5,0.55)'); g.addColorStop(0.6, 'rgba(10,5,5,0.35)'); g.addColorStop(1, 'rgba(10,5,5,0)');
  ctx.fillStyle = g; ctx.scale(1, h / w); ctx.beginPath(); ctx.arc(w / 2, w / 2, w / 2, 0, 7); ctx.fill();
});
export function makeShadow(size, parent = gfx.layer) {
  return makeFlat(shadowTex(), size, size * 0.55, 400, parent);
}
export function placeFlat(m, x, z, y = 0.02) { m.position.set(x, y, z); }

export function glowTex(color) {
  return tex('glow:' + color, 64, 64, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, rgba(color, 0.7)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
  });
}
