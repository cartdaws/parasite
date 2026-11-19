// Fixed-timestep loop: update() at exactly 60Hz, render() every animation frame.
export function startLoop(update, render, step = 1 / 60) {
  let acc = 0;
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // tab was hidden; don't spiral
    acc += dt;
    let n = 0;
    while (acc >= step && n < 6) { update(step); acc -= step; n++; }
    if (n >= 6) acc = 0;
    render(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
