// Test harness, only loaded with ?debug in the URL. Lets you warp around and
// step the simulation by hand from the console: T.warp(...), T.run(seconds).
export function installDebug(G, render, renderer) {
  const T = {
    log: [],
    warp(x, y, z, holding = true, form = 'crystal', yaw = Math.PI) {
      const g = G.g, b = G.b;
      G.input.releaseAll();
      G.state = 'playing';
      for (const id of ['title', 'pause', 'complete', 'gameover']) document.getElementById(id).classList.add('hidden');
      G.hud.show(true);
      g.pos.set(x, y, z); g.vel.set(0, 0, 0); g.yaw = yaw; g.riding = false; g.grounded = true; g.slamming = false;
      G.setForm(form);
      b.state = holding ? 'held' : 'free';
      g.holding = holding;
      b.pos.set(x + Math.sin(yaw) * 1.4, y + 0.5, z + Math.cos(yaw) * 1.4);
      b.vel.set(0, 0, 0);
      G.ballVis.root.visible = true;
      G.cam.snap(g.pos, g.yaw);
    },
    run(sec, each) {
      if (G.state === 'paused') G.state = 'playing';
      const n = Math.round(sec * 60);
      for (let i = 0; i < n; i++) { G.input.update(); G.update(1 / 60); if (each) each(i); }
    },
    render() { render(); },
    info() { render(); return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }; },
    tap(btn) { G.input._down(btn); G.input._up(btn); },
    key(code, on) { if (on) G.input.keys.add(code); else G.input.keys.delete(code); },
    snap() {
      const r = (v) => v.toArray().map((x) => +x.toFixed(2));
      return { g: r(G.g.pos), b: r(G.b.pos), bs: G.b.state, hold: G.g.holding, ride: G.g.riding, state: G.state, form: G.b.form, hearts: G.g.hearts, lives: G.lives, garibs: G.garibCount };
    },
    // record a path: returns positions every `every` frames
    trace(sec, every = 10, fn) {
      const out = [];
      T.run(sec, (i) => { if (fn) fn(i); if (i % every === 0) out.push({ g: G.g.pos.toArray().map((x) => +x.toFixed(1)).join(','), b: G.b.pos.toArray().map((x) => +x.toFixed(1)).join(',') }); });
      return out;
    },
  };
  // Scripted run through the whole level using only stick + button inputs.
  // Returns checkpoints of the run and whether it reached the portal.
  T.autoplay = () => {
    const out = [];
    const inp = G.input;
    let taps = [];
    const frame = (mx = 0, my = 0) => {
      inp.update();
      for (const b of taps) inp.pressed[b] = true;
      taps = [];
      G.cam.yaw = 0; G.cam.manualT = 0; // fixed camera: stick up = -Z
      inp.move.x = mx; inp.move.y = my;
      G.update(1 / 60);
    };
    const tap = (b) => taps.push(b);
    const steps = (n, mx = 0, my = 0) => { for (let i = 0; i < n; i++) frame(mx, my); };
    const goTo = (x, z, tol = 0.25, maxT = 12) => {
      for (let i = 0; i < maxT * 60; i++) {
        const dx = x - G.g.pos.x, dz = z - G.g.pos.z, d = Math.hypot(dx, dz);
        if (d < tol || G.state !== 'playing') return d;
        const k = Math.min(1, d / 0.6);
        frame((dx / d) * k, (-dz / d) * k);
      }
      return -1;
    };
    const fetchBall = () => {
      if (G.g.holding) return;
      for (let i = 0; i < 240 && Math.hypot(G.b.vel.x, G.b.vel.z) > 0.3; i++) frame();
      goTo(G.b.pos.x, G.b.pos.z + 1.6, 0.2);
      steps(6, 0, 0.4); // shuffle forward so we face the ball
      tap('grab'); steps(4);
    };
    const where = (tag) => out.push(tag + ' ' + JSON.stringify(T.snap()));

    G.reset(true);
    G.start();
    document.getElementById('title').classList.add('hidden');
    T.log = [];
    steps(10);
    goTo(0, 2.7); steps(5); tap('grab'); steps(3); where('grab');
    goTo(0, -24); goTo(0, -30); goTo(0, -38); goTo(0, -47.4); where('plateau-edge');
    // running throw over the gap, then jump + double jump after it
    tap('grab'); steps(2, 0, 1); where('thrown');
    for (let i = 0; i < 200 && G.state === 'playing'; i++) {
      if (i === 8) tap('jump');
      if (i === 26) tap('jump');
      frame(0, 1);
      if (i > 30 && G.g.grounded) break;
    }
    steps(40); where('landed-F');
    fetchBall(); where('regrab');
    goTo(0, -60.3, 0.3); steps(120); where('ledge');
    fetchBall();
    // put the ball down at the thistles, hop on, ride across
    goTo(0, -74.2, 0.2); steps(20); tap('grab'); steps(30); where('dropped');
    tap('jump'); steps(10, 0, 0.7); steps(50); where('mounted');
    for (let i = 0; i < 400 && G.g.pos.z > -90 && G.state === 'playing'; i++) frame(0, 1);
    for (let i = 0; i < 120 && Math.hypot(G.b.vel.x, G.b.vel.z) > 0.5; i++) frame(); // coast to a stop
    tap('jump'); steps(40, 1, 0); steps(30); where('off-ride');
    fetchBall();
    goTo(3.2, -88.6, 0.2); steps(30); where('potion');
    goTo(0, -94, 0.3); goTo(0, -103.8, 0.3); where('crates');
    const mv = G.world.movers[0];
    for (let i = 0; i < 900 && !(mv.col.pos.z > -106.9 && mv.col.vel.z >= 0); i++) frame();
    goTo(0, -107.3, 0.2);
    for (let i = 0; i < 900 && !(mv.col.pos.z < -112.2); i++) frame();
    where('mover-far');
    goTo(0, -115.5, 0.3); where('island-L');
    goTo(-3.3, -116.0, 0.2); steps(20); where('crystal');
    goTo(0, -119.5, 0.3); goTo(0, -122.5, 0.3, 4); steps(120);
    where('end');
    return { out, log: T.log.filter((x) => !x.startsWith('step')).join(' '), stats: G.state === 'complete' ? G.stats() : null };
  };

  const orig = G.sound.play.bind(G.sound);
  G.sound.play = (n, a) => { T.log.push(n + (a ? ':' + (+a).toFixed(1) : '')); orig(n, a); };
  window.T = T;
  window.G = G;
}
