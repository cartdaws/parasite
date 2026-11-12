import * as THREE from 'three';

const _p = new THREE.Vector3();

// The overlay: kept to one status block, one prompt line, and marks over the crew's heads.
export class HUD {
  constructor(ui) {
    this.ui = ui;
    ui.insertAdjacentHTML('beforeend', `
      <div id="hud">
        <div id="status"><div id="form">PARASITE</div><div class="bar"><i></i></div><div id="sub"></div></div>
        <div id="goal">ESCAPE POD ▸</div>
        <div id="alarm">ALARM</div>
        <div id="toast"></div>
        <div id="room"></div>
        <div id="prompt"></div>
        <div id="cross"></div>
        <div id="vignette"></div>
        <div id="marks"></div>
      </div>`);
    this.$ = (id) => ui.querySelector('#' + id);
    this.form = this.$('form'); this.bar = ui.querySelector('#status .bar i'); this.sub = this.$('sub');
    this.prompt = this.$('prompt'); this.alarmEl = this.$('alarm'); this.toastEl = this.$('toast'); this.roomEl = this.$('room');
    this.cross = this.$('cross'); this.vig = this.$('vignette'); this.marks = this.$('marks'); this.goal = this.$('goal');
    this.markEls = new Map();
    this.toastT = 0; this.roomT = 0; this.hurtT = 0;
  }

  show(on) { this.$('hud').style.display = on ? '' : 'none'; }

  toast(msg, secs = 2.6) { this.toastEl.textContent = msg; this.toastEl.classList.add('on'); this.toastT = secs; }
  room(name) { this.roomEl.textContent = name; this.roomEl.classList.add('on'); this.roomT = 2.2; }
  possessed(a) { this.form.textContent = a ? a.spec.label : 'PARASITE'; this.form.classList.toggle('host', !!a); }
  hurt() { this.hurtT = 0.4; }
  bark(actor, ch) { actor.bark = ch; actor.barkT = 1.5; }

  update(dt, game, camera) {
    const pl = game.player, b = pl.body;
    // status bar: host time left, or how long the worm can last in the open
    if (pl.host) {
      const k = Math.max(0, pl.host.decay / pl.host.spec.decay);
      this.bar.style.width = (k * 100).toFixed(1) + '%';
      this.bar.className = k < 0.25 ? 'low' : 'host';
      this.sub.textContent = { guard: 'Shoots · noisy', scientist: 'Opens lab doors · trusted', bot: 'Ignored by scanner & turret · slow' }[pl.host.role];
    } else {
      const k = Math.max(0, pl.life / 45);
      this.bar.style.width = (k * 100).toFixed(1) + '%';
      this.bar.className = k < 0.3 ? 'low' : 'worm';
      this.sub.textContent = 'Find a host · fits through vents';
    }
    // what pressing the action does right now
    const t = game.input.touch;
    let msg = '';
    if (pl.phase === 'free') {
      if (pl.target) msg = (t ? 'LEAP' : '[E] LEAP') + ' ONTO ' + pl.target.spec.label;
      else if (pl.host) msg = t ? '' : (pl.host.role === 'guard' ? '[Click] SHOOT   [Q] LEAVE HOST' : '[Q] LEAVE HOST');
    } else if (pl.phase === 'struggle') msg = 'TAKING CONTROL…';
    this.prompt.textContent = msg;
    this.prompt.classList.toggle('on', !!msg);
    game.input.setButtons({ use: !!pl.target, useLabel: 'LEAP', leave: !!pl.host, fire: pl.host && pl.host.role === 'guard' });
    this.cross.style.display = pl.host && pl.host.role === 'guard' ? '' : 'none';

    this.alarmEl.classList.toggle('on', game.alarm > 0);
    if (game.alarm > 0) this.alarmEl.textContent = 'ALARM ' + Math.ceil(game.alarm);
    if ((this.toastT -= dt) <= 0) this.toastEl.classList.remove('on');
    if ((this.roomT -= dt) <= 0) this.roomEl.classList.remove('on');
    this.hurtT = Math.max(0, this.hurtT - dt);
    const low = pl.host ? pl.host.hp / pl.host.spec.hp : pl.worm.hp / pl.worm.spec.hp;
    this.vig.style.opacity = Math.min(1, this.hurtT * 2 + (low < 0.5 ? (0.5 - low) : 0)).toFixed(2);

    // the pod direction, relative to where the camera faces
    if (game.world.pod) {
      const dx = game.world.pod.x - b.pos.x, dz = game.world.pod.z - b.pos.z;
      const a = Math.atan2(dx, dz) - pl.yaw;
      const deg = -a * 180 / Math.PI;
      this.goal.innerHTML = `ESCAPE POD <b style="display:inline-block;transform:rotate(${deg.toFixed(0)}deg)">▲</b> ${Math.round(Math.hypot(dx, dz))}m`;
    }

    // marks above heads: ? while suspicious (fills up), ! when alerted
    const W = innerWidth, H = innerHeight;
    for (const a of game.actors) {
      if (a.type === 'worm') continue;
      let el = this.markEls.get(a);
      const show = a.alive && !a.player && (a.susp > 0.05 || a.state === 'attack' || a.state === 'flee' || a.barkT > 0);
      if (!show) { if (el) el.style.display = 'none'; continue; }
      if (!el) { el = document.createElement('div'); el.className = 'mark'; el.innerHTML = '<span></span><i></i>'; this.marks.appendChild(el); this.markEls.set(a, el); }
      _p.set(a.pos.x, a.fig.height + 0.45, a.pos.z).project(camera);
      if (_p.z > 1) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.transform = `translate(${((_p.x + 1) / 2 * W).toFixed(0)}px, ${((1 - _p.y) / 2 * H).toFixed(0)}px)`;
      const alert = a.state === 'attack' || a.state === 'flee' || a.susp >= 1;
      el.classList.toggle('alert', alert);
      el.firstChild.textContent = alert || a.barkT > 0 ? '!' : '?';
      el.lastChild.style.height = (Math.min(1, a.susp) * 100).toFixed(0) + '%';
      if (a.barkT > 0) a.barkT -= dt;
    }
  }

  screen(html, cls) {
    let s = this.ui.querySelector('#screen');
    if (!s) { s = document.createElement('div'); s.id = 'screen'; this.ui.appendChild(s); }
    s.className = cls || '';
    s.innerHTML = html;
    s.style.display = html ? '' : 'none';
    return s;
  }
}
