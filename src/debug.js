// Test harness, only loaded with ?debug in the URL. Lets you warp around and
// step the simulation by hand from the console: T.warp(...), T.run(seconds).
export function installDebug(getGame, render, getRenderer, loadLevel) {
  // G always points at the current level's game, even after switching levels
  const G = new Proxy({}, {
    get: (_, k) => getGame()[k],
    set: (_, k, v) => { getGame()[k] = v; return true; },
  });
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
    level(i) { loadLevel(i); return T.snap(); },
    info() { const renderer = getRenderer(); render(); return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }; },
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
  // ---------------------------------------------------------------- autopilot
  // Scripted runs through each level using only stick + button inputs (camera fixed
  // so stick-up = -Z). They prove every level can be finished the intended way.
  const pilot = () => {
    const out = [];
    const inp = G.input;
    let taps = [];
    const P = {
      out,
      frame(mx = 0, my = 0) {
        inp.update();
        for (const b of taps) inp.pressed[b] = true;
        taps = [];
        G.cam.yaw = 0; G.cam.manualT = 0;
        inp.move.x = mx; inp.move.y = my;
        G.update(1 / 60);
      },
      tap(b) { taps.push(b); },
      steps(n, mx = 0, my = 0) { for (let i = 0; i < n; i++) P.frame(mx, my); },
      toward(x, z, k = 1) {
        const dx = x - G.g.pos.x, dz = z - G.g.pos.z, d = Math.hypot(dx, dz) || 1;
        return [(dx / d) * k, (-dz / d) * k];
      },
      goTo(x, z, tol = 0.25, maxT = 12) {
        for (let i = 0; i < maxT * 60; i++) {
          const dx = x - G.g.pos.x, dz = z - G.g.pos.z, d = Math.hypot(dx, dz);
          if (d < tol || G.state !== 'playing') return d;
          const k = Math.min(1, d / 0.6);
          P.frame((dx / d) * k, (-dz / d) * k);
        }
        return -1;
      },
      // face a direction without moving much
      face(x, z) { const [mx, my] = P.toward(x, z, 0.3); P.steps(6, mx, my); P.steps(4); },
      // jump toward a point (double jump on the way) and stop once landed near it
      hop(x, z, double = true) {
        P.tap('jump');
        for (let i = 0; i < 150 && G.state === 'playing'; i++) {
          if (double && i === 16) P.tap('jump');
          const d = Math.hypot(x - G.g.pos.x, z - G.g.pos.z);
          const [mx, my] = d > 0.3 ? P.toward(x, z, Math.min(1, d / 0.8)) : [0, 0];
          P.frame(mx, my);
          if (i > 8 && G.g.grounded) break;
        }
        P.steps(15);
      },
      waitBallStill(maxF = 300) {
        for (let i = 0; i < maxF && Math.hypot(G.b.vel.x, G.b.vel.z) > 0.3; i++) P.frame();
      },
      // walk up to the ball from whichever side we're on, face it and pick it up
      fetchBall() {
        if (G.g.holding) return;
        P.waitBallStill();
        const bx = G.b.pos.x, bz = G.b.pos.z;
        const dx = G.g.pos.x - bx, dz = G.g.pos.z - bz, d = Math.hypot(dx, dz) || 1;
        P.goTo(bx + (dx / d) * 1.5, bz + (dz / d) * 1.5, 0.2);
        P.face(bx, bz);
        P.tap('grab'); P.steps(4);
      },
      // put the ball down on a spot: stand so the spot is just in front, then GRAB
      placeBallAt(x, z, fromDz = 1.12) {
        P.goTo(x, z + fromDz, 0.15);
        P.face(x, z - 2);
        P.steps(10);
        P.tap('grab'); P.steps(30);
      },
      waitUntil(fn, maxF = 900) { for (let i = 0; i < maxF && !fn(); i++) P.frame(); },
      where(tag) { out.push(tag + ' ' + JSON.stringify(T.snap())); },
      begin() {
        G.reset(true);
        G.start();
        for (const id of ['title', 'select', 'pause', 'complete', 'gameover']) document.getElementById(id).classList.add('hidden');
        T.log = [];
        P.steps(10);
      },
      result() { return { out, log: T.log.filter((x) => !x.startsWith('step')).join(' '), stats: G.state === 'complete' ? G.stats() : null }; },
    };
    return P;
  };

  const routes = {
    isles(P) {
      P.goTo(0, 2.7); P.steps(5); P.tap('grab'); P.steps(3); P.where('grab');
      P.goTo(0, -24); P.goTo(0, -30); P.goTo(0, -38); P.goTo(0, -47.4); P.where('plateau-edge');
      P.tap('grab'); P.steps(2, 0, 1); P.where('thrown');
      for (let i = 0; i < 200 && G.state === 'playing'; i++) {
        if (i === 8) P.tap('jump');
        if (i === 26) P.tap('jump');
        P.frame(0, 1);
        if (i > 30 && G.g.grounded) break;
      }
      P.steps(40); P.where('landed-F');
      P.fetchBall(); P.where('regrab');
      P.goTo(0, -60.3, 0.3); P.steps(120); P.where('ledge');
      P.fetchBall();
      P.goTo(0, -74.2, 0.2); P.steps(20); P.tap('grab'); P.steps(30); P.where('dropped');
      P.tap('jump'); P.steps(10, 0, 0.7); P.steps(50); P.where('mounted');
      for (let i = 0; i < 400 && G.g.pos.z > -90 && G.state === 'playing'; i++) P.frame(0, 1);
      for (let i = 0; i < 120 && Math.hypot(G.b.vel.x, G.b.vel.z) > 0.5; i++) P.frame();
      P.tap('jump'); P.steps(40, 1, 0); P.steps(30); P.where('off-ride');
      P.fetchBall();
      P.goTo(3.2, -88.6, 0.2); P.steps(30); P.where('potion');
      P.goTo(0, -94, 0.3); P.goTo(0, -103.8, 0.3); P.where('crates');
      const mv = G.world.movers[0];
      P.waitUntil(() => mv.col.pos.z > -106.9 && mv.col.vel.z >= 0);
      P.goTo(0, -107.3, 0.2);
      P.waitUntil(() => mv.col.pos.z < -112.2);
      P.where('mover-far');
      P.goTo(0, -115.5, 0.3); P.where('island-L');
      P.goTo(-3.3, -116.0, 0.2); P.steps(20); P.where('crystal');
      P.goTo(-0.5, -118.6, 0.3);
      const bug = G.bumblers.items[2];
      P.waitUntil(() => !bug.alive || Math.abs(bug.pos.x - G.g.pos.x) > 2.6, 600);
      P.goTo(0, -122.5, 0.3, 4); P.steps(120);
    },
    lagoon(P) {
      P.goTo(0, 2.7); P.steps(5); P.tap('grab'); P.steps(3); P.where('grab');
      P.goTo(0.4, -6.6, 0.2);
      P.hop(0.8, -10); P.hop(-0.8, -13.6); P.hop(0.6, -17.2); P.hop(0.2, -20.5, false); P.where('stones');
      // rubber potion (ball rides on our thumb side, +x when facing -z)
      P.goTo(-4.35, -20.6, 0.2); P.goTo(-4.35, -21.5, 0.15); P.steps(20); P.where('rubber');
      // wait for the crab to be out of the way, then a running throw into the channel
      const crab = G.bumblers.items[0];
      P.goTo(-0.85, -23.4, 0.2);
      P.waitUntil(() => Math.abs(crab.pos.x - G.g.pos.x) > 3.2, 600);
      P.goTo(-0.85, -29.4, 0.2);
      P.tap('grab'); P.steps(3, 0, 1); P.steps(90); P.where('thrown');
      // swim out to it and climb on
      P.waitBallStill(240);
      P.goTo(G.b.pos.x, G.b.pos.z + 0.6, 0.3, 8); P.steps(10); P.where('mounted');
      for (let i = 0; i < 600 && G.g.riding && G.b.pos.z > -42.2; i++) {
        const [mx, my] = P.toward(0, -45);
        P.frame(mx, my);
      }
      P.steps(30); P.where('crossed');
      P.hop(0, -45.5, false); P.where('landed-E');
      P.fetchBall(); P.where('regrab');
      // ball switch raises the bridge
      P.placeBallAt(-3.3, -51); P.steps(160); P.where('switch');
      P.fetchBall();
      P.goTo(0, -49.5); P.goTo(0, -56.2); P.goTo(0, -66.6); P.goTo(0, -71); P.where('F');
      P.goTo(0, -76); P.goTo(0, -81.6, 0.2); P.where('dock');
      const raft = G.world.movers[0];
      P.waitUntil(() => raft.col.pos.z > -84.0);
      P.goTo(0, -84.2, 0.2);
      P.waitUntil(() => raft.col.pos.z < -92.4);
      P.where('raft');
      P.goTo(0, -96.5, 0.3);
      P.goTo(-4.4, -97.3, 0.15); P.steps(30); P.where('crystal');
      const crab4 = G.bumblers.items[3];
      P.goTo(-1, -99.4, 0.3);
      P.waitUntil(() => Math.abs(crab4.pos.x - G.g.pos.x) > 3, 600);
      P.goTo(0, -103.6, 0.3, 4); P.steps(120);
    },
  };

  routes.carnival = (P) => {
    P.goTo(0, 2.7); P.steps(5); P.tap('grab'); P.steps(3); P.where('grab');
    P.goTo(0, -6.5); P.goTo(0, -19.5); P.goTo(0, -33.4, 0.25, 15); P.where('belts');
    const m1 = G.bumblers.items[0], m2 = G.bumblers.items[1];
    P.waitUntil(() => Math.abs(m1.pos.x) > 3, 600);
    P.goTo(0, -36.3); P.goTo(1.7, -39); P.goTo(1.8, -43); P.goTo(0.2, -45.6);
    P.waitUntil(() => Math.abs(m2.pos.x) > 3, 600);
    P.goTo(0, -48.5, 0.15); P.where('plaza');
    // board a gondola as it swings through the bottom
    const gons = G.world.movers;
    let gon = null;
    P.face(0, -55);
    P.waitUntil(() => (gon = gons.find((m) => m.col.pos.y < 0 && m.col.pos.x > -0.9 && m.col.pos.x < -0.5 && m.col.vel.x > 0)), 1500);
    for (let i = 0; i < 60 && G.g.pos.z > -50.6; i++) P.frame(0, 1);
    P.steps(10);
    P.where('boarded');
    P.waitUntil(() => gon.col.pos.y > 10 && Math.abs(gon.col.pos.x) < 0.5, 1200);
    P.where('top');
    P.hop(G.g.pos.x, -55.5); P.where('H');
    // bowling potion, then ring the bell
    P.goTo(1.8, -55.4, 0.2); P.goTo(1.8, -56.2, 0.15); P.steps(20); P.where('bowling');
    P.placeBallAt(-2.2, -58.5); P.steps(120); P.where('bell');
    P.fetchBall();
    P.goTo(2.8, -59.5, 0.2); P.goTo(2.8, -62.6, 0.2); P.goTo(1.8, -64.7, 0.15); P.steps(20); P.where('crystal');
    P.goTo(0.3, -65.6, 0.2);
    P.hop(0.7, -68.2); P.hop(-0.7, -71.6); P.hop(0.7, -75); P.hop(-0.7, -78.4); P.hop(0, -82.6); P.where('G');
    const m4 = G.bumblers.items[3];
    P.waitUntil(() => Math.abs(m4.pos.x) > 3, 600);
    P.goTo(0, -89.8, 0.3, 4); P.steps(120);
  };

  routes.spooky = (P) => {
    P.goTo(0, 2.7); P.steps(5); P.tap('grab'); P.steps(3); P.where('grab');
    P.goTo(0, -7); P.goTo(0, -16.5); P.goTo(3, -18); P.goTo(5, -24); P.where('courtyard');
    const lift = G.world.movers[0];
    P.waitUntil(() => lift.col.pos.y + 0.2 < 0.15, 900);
    P.goTo(6.9, -25.8, 0.2, 3);
    P.waitUntil(() => lift.col.pos.y + 0.2 > 6.95, 900);
    P.goTo(6.9, -28.8, 0.2); P.where('walkway');
    // dash past each spike trap when it has just dropped
    const safeToCross = (sp) => {
      const { period = 2.6, phase = 0, upFrac = 0.42 } = sp.data;
      const u = ((G.simTime / period + phase) % 1 + 1) % 1;
      return u > upFrac + 0.02 && u < 0.6;
    };
    const [s1, s2] = G.world.spikes;
    P.goTo(4.8, -29.2, 0.2);
    P.waitUntil(() => safeToCross(s1), 600);
    P.goTo(1.2, -29.2, 0.25);
    P.waitUntil(() => safeToCross(s2), 600);
    P.goTo(-3.4, -29.2, 0.25);
    P.goTo(-5.6, -29.4); P.goTo(-6.5, -33); P.goTo(-6.5, -37); P.where('T1');
    P.hop(-6.5, -39.4); P.hop(-6.5, -42.8); P.hop(-6.5, -46.2); P.hop(-6.5, -49.6); P.hop(-6.4, -53); P.where('T2');
    P.placeBallAt(-3.6, -55.2); P.steps(140); P.where('switch');
    P.fetchBall();
    P.goTo(-6.5, -60.6, 0.25); P.goTo(-6.5, -71.8, 0.3); P.where('keep');
    P.goTo(-9.4, -73.5, 0.3); P.goTo(-9.4, -77.5, 0.3); P.goTo(-7.2, -80.4, 0.3, 4); P.steps(120);
  };

  T.autoplay = () => {
    const P = pilot();
    const route = routes[G.L.id];
    if (!route) return 'no route for ' + G.L.id;
    P.begin();
    route(P);
    P.where('end');
    return P.result();
  };

  const orig = G.sound.play.bind(G.sound);
  G.sound.play = (n, a) => { T.log.push(n + (a ? ':' + (+a).toFixed(1) : '')); orig(n, a); };
  window.T = T;
  window.G = G;
}
