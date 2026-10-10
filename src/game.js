// Core game: Glover movement, the ball, and how they interact with the world.
import * as THREE from 'three';
import { PhysicsWorld } from './physics.js';
import { createTextures } from './textures.js';
import { buildWorld, updateWorld, stepMovers } from './world.js';
import { GloverModel } from './glover.js';
import { BallVisual, FORMS, BALL_R } from './ball.js';
import { Particles, BlobShadow } from './fx.js';
import { Garibs, Potions, Checkpoints, Signs, Bumblers, Portal } from './entities.js';
import { FollowCam } from './camera.js';
import { formatControls } from './hud.js';

const G_R = 0.42;        // Glover's collision sphere radius (centre sits at feet + G_R)
const GRAV = 30;
const RUN = 5.6;
const JUMP_V = 10.5;
const JUMP2_V = 9.5;
const SUPER_V = 19.5;
const DT = 1 / 120;
const MAX_HEARTS = 3;
const START_LIVES = 5;

const _move = new THREE.Vector3();
const _c = new THREE.Vector3();
const _t = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _ax = new THREE.Vector3();
const _p = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);

// phone rumble (Android); browsers ignore it until the player has tapped
function buzz(pattern) {
  if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(pattern);
}

function rotateToward(a, b, maxStep) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + Math.max(-maxStep, Math.min(maxStep, d));
}

export class Game {
  constructor({ scene, camera, input, hud, sound, level, ui }) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;
    this.hud = hud;
    this.sound = sound;
    this.L = level;
    this.ui = ui;

    scene.background = new THREE.Color(0xbfe6ff);
    scene.fog = new THREE.Fog(0xc4e6ff, 50, 175);
    scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x7a6248, 1.9));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
    sun.position.set(0.6, 1, 0.35);
    scene.add(sun);

    this.physics = new PhysicsWorld();
    this.T = createTextures();
    this.world = buildWorld(scene, this.physics, this.T, level);
    for (const mv of this.world.movers) mv.col.isMover = true;

    this.model = new GloverModel();
    scene.add(this.model.root);
    this.ballVis = new BallVisual();
    scene.add(this.ballVis.root);

    this.fx = new Particles(scene);
    this.gShadow = new BlobShadow(scene, this.T.shadow, 1.0);
    this.bShadow = new BlobShadow(scene, this.T.shadow, 0.95);

    this.garibs = new Garibs(scene, level.garibs);
    this.potions = new Potions(scene, level.potions);
    this.checkpoints = new Checkpoints(scene, level.checkpoints);
    this.signs = new Signs(scene, level.signs, this.T.sign);
    this.bumblers = new Bumblers(scene, level.enemies);
    this.eShadows = this.bumblers.items.map(() => new BlobShadow(scene, this.T.shadow, 1.0));
    this.portal = new Portal(scene, level.goal, this.T.portal);

    this.cam = new FollowCam(camera);

    this.g = {
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: Math.PI,
      grounded: false, groundCol: null, coyote: 0, jumpBuffer: 0, canDouble: false, jumpFlag: false,
      holding: false, riding: false, slamming: false, slamHang: 0, airT: 0, launchT: 0,
      hearts: MAX_HEARTS, invuln: 0, hurtT: 0,
      anim: { flipStart: false, spinStart: false, landImpact: 0 },
    };
    this.b = {
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), form: 'crystal', state: 'free',
      grounded: false, groundN: new THREE.Vector3(0, 1, 0), groundCol: null, omega: new THREE.Vector3(),
      ignoreT: 0, soundT: 0, dribble: 0, dribbleBounced: false, airT: 0,
    };

    this.state = 'title';
    this.time = 0;
    this.simTime = 0;
    this.wantGrab = false;
    this.wantSlap = false;
    this.levelTime = 0;
    this.acc = 0;
    this.lives = START_LIVES;
    this.garibCount = 0;
    this.shake = 0;
    this.msgCool = {};
    this.tips = { pickups: 0, releases: 0 }; // how much help to show
    this.stepPhase = 0;
    this.titleT = 0;
    this.reset(true);
  }

  // ---------------------------------------------------------------- lifecycle
  reset(full) {
    if (full) {
      this.lives = START_LIVES;
      this.garibCount = 0;
      this.tips = { pickups: 0, releases: 0 };
      this.levelTime = 0;
      this.garibs.reset();
      this.checkpoints.reset();
      for (const c of this.world.crates) {
        if (!c.alive) { c.alive = true; c.mesh.visible = true; this.physics.add(c.col); }
      }
      const s = this.L.start;
      this.spawnPoint = {
        pos: new THREE.Vector3(...s.pos), yaw: s.yaw, form: 'crystal',
        ball: new THREE.Vector3(...this.L.ball),
      };
    }
    this.respawn();
  }

  respawn() {
    const g = this.g, b = this.b, sp = this.spawnPoint;
    g.pos.copy(sp.pos);
    g.vel.set(0, 0, 0);
    g.yaw = sp.yaw;
    g.grounded = true; g.groundCol = null; g.holding = false; g.riding = false; g.slamming = false;
    g.hearts = MAX_HEARTS; g.invuln = 0; g.hurtT = 0; g.jumpBuffer = 0; g.launchT = 0;
    b.pos.copy(sp.ball);
    b.vel.set(0, 0, 0);
    b.omega.set(0, 0, 0);
    b.state = 'free';
    b.ignoreT = 0;
    this.setForm(sp.form, true);
    this.ballVis.root.visible = true;
    this.ballVis.root.scale.setScalar(1);
    this.bumblers.reset();
    this.cam.snap(g.pos, g.yaw);
    this.fx.clear();
  }

  setForm(name, silent) {
    this.b.form = name;
    this.ballVis.setForm(name);
    const f = FORMS[name];
    this.hud.setForm(f.label, f.color);
  }

  start() {
    this.state = 'playing';
    this.hud.show(true);
    this.hud.toast('World 1', this.L.name, 2.4);
  }

  // what the GRAB button would do right now, for the floating hint bubble
  updatePrompt() {
    const g = this.g, b = this.b;
    const mode = this.input.labelMode();
    let text = null;
    let inReach = false;
    if (this.state === 'playing' && !g.riding && (b.state === 'free' || b.state === 'held')) {
      inReach = !g.holding && b.state === 'free' && this.ballInReach(0.8);
      if (inReach) text = formatControls('{GRAB} Pick up', mode);
      else if (g.holding && this.tips.releases < 4) text = formatControls(this.willThrow() ? '{GRAB} Throw' : '{GRAB} Put down', mode);
      else if (!g.holding && this.tips.pickups === 0) text = 'Your ball!';
    }
    this.input.setGrabHint(inReach && this.input.device === 'touch');
    if (!text) { this.hud.setPrompt(null); return; }
    this.camera.updateMatrixWorld();
    _p.set(b.pos.x, b.pos.y + 0.75, b.pos.z).project(this.camera);
    if (_p.z > 1 || Math.abs(_p.x) > 1.1 || Math.abs(_p.y) > 1.1) { this.hud.setPrompt(null); return; }
    this.hud.setPrompt(text, (_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight);
  }

  // ---------------------------------------------------------------- main update
  update(dt) {
    const inp = this.input;
    this.time += dt;

    if (this.state === 'playing') {
      this.levelTime += dt;
      if (inp.pressed.jump) this.g.jumpBuffer = 0.14;
      // remember presses until a physics step consumes them (high-refresh screens
      // can run frames with zero steps)
      this.wantGrab = this.wantGrab || inp.pressed.grab;
      this.wantSlap = this.wantSlap || inp.pressed.slap;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= DT && steps < 8) {
        this.step(DT);
        this.acc -= DT;
        steps++;
        this.wantGrab = false;
        this.wantSlap = false;
        if (this.state !== 'playing') break;
      }
      if (steps >= 8) this.acc = 0;
    } else if (this.state === 'dying') {
      this.deathT -= dt;
      if (this.deathT < 0.4 && !this.fading) {
        this.fading = true;
        this.ui.fade(true);
      }
      if (this.deathT <= 0) {
        this.fading = false;
        this.lives -= 1;
        if (this.lives <= 0) {
          this.state = 'gameover';
          this.ui.fade(false);
          this.ui.showGameOver();
        } else {
          this.respawn();
          this.state = 'playing';
          this.ui.fade(false);
        }
      }
      // keep movers going in the background
      this.simTime += dt;
      stepMovers(this.world, dt, this.simTime);
    } else if (this.state === 'complete') {
      this.winT += dt;
      const k = Math.min(1, this.winT / 1.2);
      this.b.pos.lerp(this.portal.center, Math.min(1, dt * 4));
      this.ballVis.root.scale.setScalar(Math.max(0.01, 1 - k));
      if (this.winT > 1.4 && !this.shownWin) {
        this.shownWin = true;
        this.ui.showComplete(this.stats());
      }
    }

    this.visuals(dt);
  }

  stats() {
    const t = Math.floor(this.levelTime);
    return {
      garibs: this.garibCount, total: this.garibs.total,
      time: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`,
      crystal: this.b.form === 'crystal',
      lives: this.lives,
    };
  }

  // ---------------------------------------------------------------- fixed step
  step(dt) {
    const g = this.g, b = this.b;
    this.simTime += dt;
    stepMovers(this.world, dt, this.simTime);
    g.invuln = Math.max(0, g.invuln - dt);
    g.hurtT = Math.max(0, g.hurtT - dt);
    g.jumpBuffer = Math.max(0, g.jumpBuffer - dt);
    g.launchT = Math.max(0, g.launchT - dt);
    b.ignoreT = Math.max(0, b.ignoreT - dt);
    b.soundT = Math.max(0, b.soundT - dt);

    this.handleActions();
    this.stepGlover(dt);
    if (b.state === 'free') this.stepBall(dt);
    if (g.riding) this.placeRider();
    else if (g.holding) this.placeHeldBall(dt);
    if (b.state === 'free' && !g.riding) this.gloverBallContact();
    this.interactions(dt);

    if (this.state !== 'playing') return;
    if (g.pos.y < this.L.killY) this.loseLife('Whoops!', 'You fell');
    else if (b.state === 'free' && b.pos.y < this.L.killY) this.loseLife('Ball lost!', 'Keep it on solid ground');
  }

  forward(out) {
    return out.set(Math.sin(this.g.yaw), 0, Math.cos(this.g.yaw));
  }

  handleActions() {
    const g = this.g, b = this.b, f = FORMS[b.form];
    if (this.wantGrab && !g.riding) {
      if (g.holding && !this.willThrow()) {
        // put it down gently right where it is
        g.holding = false;
        b.state = 'free';
        b.vel.set(0, 0, 0);
        b.ignoreT = 0.3;
        this.tips.releases++;
        this.sound.play('grab');
      } else if (g.holding) {
        // throw
        this.forward(_fwd);
        g.holding = false;
        b.state = 'free';
        b.vel.set(_fwd.x * f.throwH + g.vel.x * 0.4, f.throwV + Math.max(0, g.vel.y) * 0.3, _fwd.z * f.throwH + g.vel.z * 0.4);
        b.ignoreT = 0.35;
        g.anim.spinStart = false;
        this.model.land = 0.3;
        this.tips.releases++;
        this.sound.play('throw');
      } else if (b.state === 'free' && this.ballInReach(0.8)) {
        g.holding = true;
        b.state = 'held';
        this.sound.play('grab');
        if (this.tips.pickups++ === 0) this.hud.toast('Got it!', 'Now carry it to the portal at the end', 2.6);
        this.fx.burst(b.pos, 6, { color: 0xffffff, size: 0.07, life: 0.35, speed: 3 });
      } else {
        this.sound.play('whiff');
      }
    }

    if (this.wantSlap && !g.riding) {
      if (!g.grounded && g.airT > 0.12 && !g.slamming && !g.holding) {
        g.slamming = true;
        g.slamHang = 0.12;
        g.vel.set(0, 3, 0);
        this.sound.play('whiff');
      } else if (g.grounded || g.coyote > 0) {
        g.anim.spinStart = true;
        this.forward(_fwd);
        let hitBall = false;
        if (g.holding) {
          g.holding = false;
          b.state = 'free';
          hitBall = true;
        } else if (b.state === 'free' && this.ballInReach(1.1)) {
          hitBall = true;
        }
        if (hitBall) {
          b.vel.set(_fwd.x * f.slap, 1.8, _fwd.z * f.slap);
          b.ignoreT = 0.3;
          this.sound.play('slap');
          this.fx.burst(b.pos, 10, { color: [0xffffff, 0xffd23f], size: 0.08, life: 0.35, speed: 5 });
          this.shake = Math.max(this.shake, 0.12);
        } else {
          this.sound.play('whiff');
        }
        // slap hits critters right in front
        _p.copy(g.pos).addScaledVector(_fwd, 0.9);
        for (const e of this.bumblers.items) {
          if (e.alive && Math.hypot(e.pos.x - _p.x, e.pos.z - _p.z) < 1.1 && Math.abs(e.pos.y - g.pos.y) < 1.2) this.killBumbler(e);
        }
      }
    }
  }

  // GRAB while holding throws if you're moving, airborne, or the ball would just drop
  // into a pit; otherwise it puts the ball down.
  willThrow() {
    const g = this.g, b = this.b;
    if (!g.grounded) return true;
    if (Math.hypot(this.input.move.x, this.input.move.y) > 0.35) return true;
    const hit = this.physics.raycast(b.pos, DOWN, 2.5);
    return !(hit && hit.normal.y > 0.5);
  }

  ballInReach(extra) {
    const g = this.g, b = this.b;
    const dx = b.pos.x - g.pos.x, dz = b.pos.z - g.pos.z;
    const dy = b.pos.y - (g.pos.y + G_R);
    return Math.hypot(dx, dz) < G_R + BALL_R + extra && Math.abs(dy) < 1.3;
  }

  // ---------------------------------------------------------------- Glover
  stepGlover(dt) {
    const g = this.g, b = this.b, inp = this.input, f = FORMS[b.form];
    this.cam.moveDir(inp.move.x, inp.move.y, _move);
    const mag = Math.min(1, _move.length());
    if (mag > 0.1) g.yaw = rotateToward(g.yaw, Math.atan2(_move.x, _move.z), 11 * dt);

    if (g.riding) {
      // steer the ball you're standing on
      b.vel.x += _move.x * 12 * dt;
      b.vel.z += _move.z * 12 * dt;
      const hs = Math.hypot(b.vel.x, b.vel.z);
      if (hs > 5.5) { b.vel.x *= 5.5 / hs; b.vel.z *= 5.5 / hs; }
      if (g.jumpBuffer > 0) {
        g.riding = false;
        g.jumpBuffer = 0;
        g.vel.set(b.vel.x, JUMP_V, b.vel.z);
        g.canDouble = true;
        g.jumpFlag = true;
        b.ignoreT = 0.35;
        g.pos.y += 0.05;
        this.sound.play('jump');
      }
      return;
    }

    if (g.grounded) { g.coyote = 0.1; g.airT = 0; }
    else { g.coyote = Math.max(0, g.coyote - dt); g.airT += dt; }

    // horizontal control
    let maxSpeed = RUN * (g.holding ? f.holdSpeed : 1);
    if (g.hurtT > 0 || g.slamming) maxSpeed = 0;
    const tx = _move.x * maxSpeed, tz = _move.z * maxSpeed;
    let accel;
    if (g.grounded) accel = mag > 0.05 ? 36 : 32;
    else accel = mag > 0.05 ? 20 * (g.launchT > 0 ? 0.35 : 1) : 0.6;
    if (g.hurtT > 0) accel = g.grounded ? 30 : 0;
    if (g.slamming) { g.vel.x = 0; g.vel.z = 0; }
    else {
      const dvx = tx - g.vel.x, dvz = tz - g.vel.z;
      const dl = Math.hypot(dvx, dvz), md = accel * dt;
      if (dl <= md) { g.vel.x = tx; g.vel.z = tz; }
      else { g.vel.x += (dvx / dl) * md; g.vel.z += (dvz / dl) * md; }
    }

    // jumping
    if (g.jumpBuffer > 0 && !g.slamming && g.hurtT <= 0) {
      if (g.grounded || g.coyote > 0) {
        const jm = g.holding ? f.jumpMul : 1;
        if (jm > 0) {
          g.vel.y = JUMP_V * jm;
          if (g.groundCol && g.groundCol.isMover) { g.vel.x += g.groundCol.vel.x; g.vel.z += g.groundCol.vel.z; }
          g.grounded = false; g.coyote = 0; g.jumpBuffer = 0;
          g.canDouble = !g.holding;
          g.jumpFlag = true;
          this.sound.play('jump');
        } else {
          g.jumpBuffer = 0;
          this.sound.play('nope');
          this.message('heavy', 'Too heavy to jump!', 'Throw or drop the bowling ball first', 4);
        }
      } else if (g.canDouble && !g.holding) {
        g.vel.y = JUMP2_V;
        g.canDouble = false;
        g.jumpBuffer = 0;
        g.jumpFlag = true;
        g.anim.flipStart = true;
        this.sound.play('jump2');
        this.fx.burst(_p.copy(g.pos).setY(g.pos.y + 0.2), 8, { color: 0xffffff, size: 0.08, life: 0.4, speed: 3, up: -1 });
      }
    }

    // gravity
    if (g.slamming) {
      if (g.slamHang > 0) { g.slamHang -= dt; g.vel.y = Math.max(g.vel.y - 40 * dt, 0); }
      else g.vel.y = -26;
    } else {
      let gm = 1;
      if (g.vel.y < 0) gm = 1.15;
      else if (g.jumpFlag && !inp.held.jump && inp.device !== 'touch') gm = 2.2;
      g.vel.y = Math.max(-32, g.vel.y - GRAV * gm * dt);
    }

    // ride moving platforms
    if (g.grounded && g.groundCol && g.groundCol.isMover) g.pos.addScaledVector(g.groundCol.vel, dt);

    g.pos.addScaledVector(g.vel, dt);

    // collide
    const wasGrounded = g.grounded;
    g.grounded = false;
    let landSpeed = 0, hurtFloor = null, padCol = null, groundCol = null;
    _c.set(g.pos.x, g.pos.y + G_R, g.pos.z);
    const preVy = g.vel.y;
    this.physics.resolveSphere(_c, G_R, (n, depth, col) => {
      const vn = g.vel.dot(n);
      if (n.y > 0.55) {
        g.grounded = true;
        groundCol = col;
        if (col.hurt) hurtFloor = col;
        if (col.pad) padCol = col;
      }
      if (vn < 0) g.vel.addScaledVector(n, -vn);
    });
    g.pos.set(_c.x, _c.y - G_R, _c.z);
    if (g.grounded) landSpeed = Math.max(0, -preVy);

    // snap down slopes / onto platforms instead of skipping into the air
    if (!g.grounded && wasGrounded && g.vel.y <= 0 && !g.slamming) {
      _p.set(g.pos.x, g.pos.y + G_R, g.pos.z);
      const hit = this.physics.raycast(_p, DOWN, G_R + 0.45);
      if (hit && hit.normal.y > 0.55) {
        g.pos.y -= hit.t - G_R;
        g.grounded = true;
        groundCol = hit.collider;
        g.vel.y = 0;
      }
    }
    g.groundCol = groundCol;

    if (g.grounded && !wasGrounded) this.onGloverLand(landSpeed);

    if (padCol && g.grounded) this.launchFromPad(padCol, 'glover');
    if (hurtFloor && g.grounded) {
      if (g.invuln <= 0) {
        this.forward(_fwd);
        _p.copy(g.pos).addScaledVector(_fwd, 1);
        this.hurtGlover(_p);
      } else {
        g.vel.y = 7; g.grounded = false;
      }
    }
  }

  onGloverLand(speed) {
    const g = this.g;
    g.jumpFlag = false;
    if (g.slamming) {
      g.slamming = false;
      g.anim.landImpact = 1;
      this.sound.play('thud', 12);
      this.shake = Math.max(this.shake, 0.25);
      this.fx.burst(_p.copy(g.pos).setY(g.pos.y + 0.1), 18, { color: [0xffffff, 0xe8dcc0], size: 0.12, life: 0.5, speed: 7, up: 1 });
      for (const e of this.bumblers.items) {
        if (e.alive && e.pos.distanceTo(g.pos) < 2.4) this.killBumbler(e);
      }
      return;
    }
    if (speed > 3) {
      g.anim.landImpact = Math.min(1, speed / 18);
      this.sound.play('land');
    }
    if (speed > 12) this.fx.burst(_p.copy(g.pos).setY(g.pos.y + 0.1), 8, { color: 0xffffff, size: 0.09, life: 0.4, speed: 4, up: 0.5 });
  }

  launchFromPad(col, who) {
    const p = col.pad;
    const pad = this.world.pads.find((x) => x.col === col);
    if (pad) pad.squash = 1;
    if (who === 'glover') {
      const g = this.g;
      g.vel.set(p.push[0], Math.sqrt(2 * GRAV * p.apex), p.push[1]);
      g.grounded = false; g.groundCol = null;
      g.canDouble = true;
      g.jumpFlag = false;
      g.launchT = 0.6;
      g.pos.y += 0.05;
      g.anim.flipStart = true;
    } else {
      const b = this.b, f = FORMS[b.form];
      b.vel.set(p.push[0], Math.sqrt(2 * f.gravity * p.apex), p.push[1]);
      b.pos.y += 0.05;
    }
    this.sound.play('pad');
    this.fx.burst(_p.set(col.pos.x, col.pos.y + 0.3, col.pos.z), 14, { color: [0xff4d6d, 0xffffff, 0xffd23f], size: 0.1, life: 0.6, speed: 5, up: 4 });
  }

  hurtGlover(fromPos) {
    const g = this.g, b = this.b;
    if (g.invuln > 0 || this.state !== 'playing') return;
    g.hearts -= 1;
    g.invuln = 1.6;
    g.hurtT = 0.45;
    _t.set(g.pos.x - fromPos.x, 0, g.pos.z - fromPos.z);
    if (_t.lengthSq() < 1e-4) this.forward(_t).multiplyScalar(-1);
    _t.normalize();
    g.vel.set(_t.x * 6, 8, _t.z * 6);
    g.grounded = false;
    g.slamming = false;
    if (g.holding) {
      g.holding = false;
      b.state = 'free';
      b.vel.set(-_t.x * 1.5, 2, -_t.z * 1.5);
      b.ignoreT = 0.5;
    }
    if (g.riding) { g.riding = false; b.ignoreT = 0.5; }
    this.sound.play('hurt');
    this.shake = Math.max(this.shake, 0.2);
    buzz(60);
    if (g.hearts <= 0) this.loseLife('Ouch!', 'Out of hearts');
  }

  // ---------------------------------------------------------------- ball
  stepBall(dt) {
    const b = this.b, f = FORMS[b.form];
    b.vel.y -= f.gravity * dt;
    b.pos.addScaledVector(b.vel, dt);

    let maxImpact = 0, padCol = null, smash = false;
    const wasGrounded = b.grounded;
    b.grounded = false;
    b.groundCol = null;
    this.physics.resolveSphere(b.pos, BALL_R, (n, depth, col) => {
      _rel.copy(b.vel).sub(col.vel);
      const vn = _rel.dot(n);
      if (n.y > 0.5) {
        b.grounded = true;
        b.groundCol = col;
        b.groundN.copy(n);
        if (col.pad) padCol = col;
      }
      if (col.crate && f.smash && _rel.length() > 2.2) smash = true;
      if (vn < 0) {
        const impact = -vn;
        if (impact > maxImpact) maxImpact = impact;
        const e = impact > 2.5 ? f.restitution : 0;
        _rel.addScaledVector(n, -vn * (1 + e));
        if (impact > 2.5) {
          // hard landings bleed off sliding speed so throws don't roll forever
          const keep = 1 - (1 - f.impactKeep) * Math.min(1, impact / 8);
          const rn = _rel.dot(n);
          _rel.addScaledVector(n, -rn).multiplyScalar(keep).addScaledVector(n, rn);
        }
        b.vel.copy(_rel).add(col.vel);
      }
    });

    // rolling friction (sticky on moving platforms so the ball rides along)
    if (b.grounded) {
      b.airT = 0;
      const col = b.groundCol;
      _rel.copy(b.vel).sub(col.vel);
      const vn = _rel.dot(b.groundN);
      _t.copy(b.groundN).multiplyScalar(vn);
      _rel.sub(_t);
      const rate = col.isMover ? 7 : (this.g.riding ? f.rollFriction * 0.5 : f.rollFriction);
      const sp = _rel.length();
      let nsp = sp * Math.exp(-rate * dt) - 0.25 * dt;
      if (nsp < 0) nsp = 0;
      if (sp > 1e-6) _rel.multiplyScalar(nsp / sp);
      b.vel.copy(_rel).add(_t).add(col.vel);
      // spin from rolling
      _rel.copy(b.vel).sub(col.vel);
      b.omega.crossVectors(b.groundN, _rel).divideScalar(BALL_R);
    } else {
      b.airT += dt;
      b.omega.multiplyScalar(1 - dt * 0.3);
    }

    if (smash) this.smashCrates(b.pos);

    if (maxImpact > 2.5 && b.soundT <= 0) {
      b.soundT = 0.07;
      if (b.form === 'rubber') this.sound.play('bounce', maxImpact);
      else if (b.form === 'crystal') this.sound.play('clink', maxImpact);
      else this.sound.play('thud', maxImpact);
      if (maxImpact > 9) this.fx.burst(_p.copy(b.pos).setY(b.pos.y - 0.4), 6, { color: 0xffffff, size: 0.08, life: 0.35, speed: 3, up: 0.5 });
      if (b.form === 'bowling' && maxImpact > 8) this.shake = Math.max(this.shake, 0.15);
    }

    if (maxImpact > f.breakSpeed) { this.shatterBall(); return; }
    if (padCol) this.launchFromPad(padCol, 'ball');
  }

  placeHeldBall(dt) {
    const g = this.g, b = this.b, f = FORMS[b.form];
    this.forward(_fwd);
    const want = _t.set(g.pos.x + _fwd.x * (G_R + BALL_R + 0.1), g.pos.y + BALL_R, g.pos.z + _fwd.z * (G_R + BALL_R + 0.1));
    const impactSpeed = Math.hypot(g.vel.x, g.vel.z);
    // follow the ground under the ball so it rides up slopes and steps
    if (g.grounded) {
      _p.set(want.x, g.pos.y + 1.4, want.z);
      const hit = this.physics.raycast(_p, DOWN, 2.0);
      if (hit && hit.normal.y > 0.5) {
        const gy = _p.y - hit.t;
        if (gy > g.pos.y - 0.6 && gy < g.pos.y + 1.0) want.y = gy + BALL_R;
      }
    }
    b.pos.copy(want);
    let smash = false, wall = false;
    this.physics.resolveSphere(b.pos, BALL_R * 0.96, (n, depth, col) => {
      if (col.crate && f.smash) smash = true;
      if (n.y < 0.6) wall = true;
    });
    // small lips and slopes just lift the ball; only real walls push back
    if (!wall) { b.pos.x = want.x; b.pos.z = want.z; }
    // if the ball got pushed sideways by a wall, push Glover back too
    const cx = b.pos.x - want.x, cz = b.pos.z - want.z;
    if (cx * cx + cz * cz > 1e-8) {
      g.pos.x += cx; g.pos.z += cz;
      const vn = (g.vel.x * cx + g.vel.z * cz) / Math.hypot(cx, cz);
      if (vn < 0) {
        const l = Math.hypot(cx, cz);
        g.vel.x -= (cx / l) * vn; g.vel.z -= (cz / l) * vn;
      }
    }
    b.vel.copy(g.vel);
    // rolling look
    const gs = Math.hypot(g.vel.x, g.vel.z);
    if (g.grounded && gs > 0.1) {
      _rel.set(g.vel.x, 0, g.vel.z);
      b.omega.crossVectors(UP, _rel).divideScalar(BALL_R);
    } else b.omega.multiplyScalar(0.9);
    if (smash && (impactSpeed > 2 || g.vel.y < -3)) this.smashCrates(b.pos);
  }

  placeRider() {
    const g = this.g, b = this.b;
    g.pos.set(b.pos.x, b.pos.y + BALL_R - 0.02, b.pos.z);
    g.vel.copy(b.vel);
    g.grounded = false;
  }

  gloverBallContact() {
    const g = this.g, b = this.b, f = FORMS[b.form];
    if (b.ignoreT > 0) return;
    _c.set(g.pos.x, g.pos.y + G_R, g.pos.z);
    _t.copy(b.pos).sub(_c);
    const dist = _t.length();
    const minD = G_R + BALL_R;
    if (dist >= minD || dist < 1e-5) return;
    _t.divideScalar(dist); // glover -> ball

    // landing on top of the ball?
    if (_t.y < -0.55 && g.vel.y <= 1) {
      if (b.form === 'rubber' && g.vel.y < -8.5) {
        g.vel.y = SUPER_V;
        g.canDouble = true;
        g.jumpFlag = false;
        g.slamming = false;
        g.anim.flipStart = true;
        b.vel.y = Math.min(b.vel.y, -2);
        b.ignoreT = 0.3;
        this.sound.play('superbounce');
        this.fx.burst(b.pos, 16, { color: [0xff4d4d, 0xffd23f, 0x3d8bff], size: 0.1, life: 0.6, speed: 5, up: 3 });
        this.message('superbounce', 'Super bounce!', '', 2);
        return;
      }
      g.riding = true;
      g.slamming = false;
      g.holding = false;
      this.sound.play('grab');
      this.message('ride', 'Ball ride!', 'Steer to roll it, jump to hop off', 2.5);
      return;
    }

    // otherwise bump it along
    _t.y = 0;
    const hl = _t.length();
    if (hl < 1e-5) return;
    _t.divideScalar(hl);
    const overlap = minD - dist;
    const mg = 1.2, mb = f.mass;
    b.pos.addScaledVector(_t, overlap * (mg / (mg + mb)));
    g.pos.addScaledVector(_t, -overlap * (mb / (mg + mb)));
    const vrel = (g.vel.x - b.vel.x) * _t.x + (g.vel.z - b.vel.z) * _t.z;
    if (vrel > 0) {
      const k = 1.1 * (mg / (mg + mb));
      b.vel.x += _t.x * vrel * k;
      b.vel.z += _t.z * vrel * k;
      g.vel.x -= _t.x * vrel * (mb / (mg + mb)) * 0.6;
      g.vel.z -= _t.z * vrel * (mb / (mg + mb)) * 0.6;
    }
  }

  shatterBall() {
    const b = this.b;
    this.sound.play('shatter');
    this.fx.burst(b.pos, 40, { color: [0xbfefff, 0xffffff, 0x7fdcff, 0xe0f8ff], size: 0.12, life: 1.1, speed: 7, up: 4, gravity: 20 });
    this.ballVis.root.visible = false;
    b.state = 'gone';
    this.g.holding = false;
    this.g.riding = false;
    this.shake = 0.3;
    buzz([40, 30, 60]);
    this.loseLife('Smashed!', 'Crystal can\'t take big drops');
  }

  smashCrates(p) {
    let any = false;
    for (const c of this.world.crates) {
      if (!c.alive) continue;
      if (Math.hypot(c.col.pos.x - p.x, c.col.pos.z - p.z) < 1.6) {
        c.alive = false;
        c.mesh.visible = false;
        this.physics.remove(c.col);
        this.fx.burst(c.mesh.position, 10, { color: [0xc98b45, 0x8e5420, 0xffd98f], size: 0.14, life: 0.9, speed: 6, up: 4, gravity: 18 });
        any = true;
      }
    }
    if (any) {
      this.sound.play('crate');
      this.shake = Math.max(this.shake, 0.35);
      buzz(50);
    }
  }

  killBumbler(e) {
    if (!e.alive) return;
    this.bumblers.kill(e);
    this.sound.play('pop');
    this.fx.burst(_p.copy(e.pos).setY(e.pos.y + 0.4), 16, { color: [0xe8394f, 0xffffff, 0xffd23f], size: 0.1, life: 0.6, speed: 5, up: 3 });
  }

  // ---------------------------------------------------------------- interactions
  interactions(dt) {
    const g = this.g, b = this.b;
    if (this.state !== 'playing') return;
    _c.set(g.pos.x, g.pos.y + 0.6, g.pos.z);

    // garibs
    for (const it of this.garibs.items) {
      if (!it.alive) continue;
      if (it.pos.distanceToSquared(_c) < 0.95 * 0.95) {
        this.garibs.collect(it);
        this.garibCount++;
        this.sound.play('garib');
        this.fx.burst(it.pos, 8, { color: [0xffd23f, 0xffffff], size: 0.08, life: 0.5, speed: 3, up: 2 });
        if (this.garibCount === this.garibs.total) {
          this.lives++;
          this.hud.toast('All garibs!', '+1 life', 2.2);
          this.sound.play('fanfare');
        }
      }
    }

    // critters
    for (const e of this.bumblers.items) {
      if (!e.alive) continue;
      const ex = e.pos.x, ey = e.pos.y, ez = e.pos.z;
      const hd = Math.hypot(g.pos.x - ex, g.pos.z - ez);
      if (hd < 0.85 && g.pos.y > ey + 0.15 && g.pos.y < ey + 1.1 && g.vel.y < 0 && !g.riding) {
        this.killBumbler(e);
        g.vel.y = 11;
        g.canDouble = true;
        g.jumpFlag = false;
        g.slamming = false;
        this.sound.play('stomp');
        continue;
      }
      if (hd < 0.8 && Math.abs(g.pos.y - ey) < 0.8) {
        if (g.slamming) this.killBumbler(e);
        else this.hurtGlover(e.pos);
        continue;
      }
      if (b.state !== 'gone') {
        _t.set(b.pos.x - ex, b.pos.y - (ey + 0.3), b.pos.z - ez);
        const d = _t.length();
        if (d < BALL_R + 0.45) {
          const sp = _rel.copy(b.vel).sub(e.vel).length();
          if (sp > 3.5 || b.form === 'bowling') {
            this.killBumbler(e);
            if (b.state === 'free') { b.vel.x *= 0.3; b.vel.z *= 0.3; } // the hit soaks up the ball's speed
          }
          else if (b.state === 'free') {
            _t.y = 0; _t.normalize();
            b.vel.x += _t.x * 2.5; b.vel.z += _t.z * 2.5;
            b.pos.addScaledVector(_t, BALL_R + 0.45 - d);
          }
        }
      }
    }

    // potions
    for (const p of this.potions.items) {
      if (p.cool > 0) continue;
      const ballNear = b.state !== 'gone' && b.pos.distanceTo(p.pos) < 1.2;
      const gloverNear = _c.distanceTo(p.pos) < 1.1;
      if (ballNear || (g.holding && gloverNear)) {
        p.cool = 1.5;
        if (b.form !== p.form) {
          this.setForm(p.form);
          this.sound.play('potion');
          this.fx.burst(b.pos, 24, { color: [p.color, 0xffffff], size: 0.1, life: 0.8, speed: 4, up: 3 });
          const tips = {
            rubber: 'Bouncy! Double-jump onto it to super bounce',
            bowling: 'Heavy! Smashes crates, too heavy to jump with',
            crystal: 'Fragile, but worth a bonus',
          };
          this.hud.toast(FORMS[p.form].label + '!', tips[p.form], 2.6);
        }
      } else if (gloverNear && !g.holding && b.form !== p.form) {
        this.message('potion-' + p.form, 'Potions change the ball', 'Bring the ball here', 3);
      }
    }

    // checkpoints (only count if the ball came along)
    for (const cp of this.checkpoints.items) {
      if (cp.active) continue;
      if (Math.hypot(g.pos.x - cp.x, g.pos.z - cp.z) < 2 && Math.abs(g.pos.y - cp.y) < 2.5) {
        if (b.state !== 'gone' && b.pos.distanceTo(cp.pos) < 5) {
          this.checkpoints.activate(cp);
          const off = cp.x > 0 ? -1.2 : 1.2;
          this.spawnPoint = {
            pos: new THREE.Vector3(cp.x + off, cp.y + 0.05, cp.z),
            yaw: Math.PI,
            form: b.form,
            ball: new THREE.Vector3(cp.x + off, cp.y + BALL_R + 0.05, cp.z - 1.4),
          };
          g.hearts = MAX_HEARTS;
          this.sound.play('checkpoint');
          this.hud.toast('Checkpoint!', '', 1.4);
          this.fx.burst(_p.set(cp.x, cp.y + 2, cp.z), 20, { color: [0xff4fa3, 0xffd23f, 0xffffff], size: 0.1, life: 0.8, speed: 4, up: 3 });
        } else {
          this.message('cp', 'Bring the ball!', 'Checkpoints need your ball nearby', 3);
        }
      }
    }

    // goal
    const P = this.portal.pos;
    if (b.state !== 'gone' && Math.hypot(b.pos.x - P.x, b.pos.z - P.z) < 1.7 && b.pos.y > P.y - 0.5 && b.pos.y < P.y + 3.8) {
      this.win();
    } else if (Math.hypot(g.pos.x - P.x, g.pos.z - P.z) < 1.8 && Math.abs(g.pos.y - P.y) < 2) {
      this.message('goal', 'Bring the ball!', 'The portal needs your ball', 3);
    }
  }

  message(key, text, sub, cool) {
    const now = this.time;
    if (this.msgCool[key] && now < this.msgCool[key]) return;
    this.msgCool[key] = now + cool;
    this.hud.toast(text, sub, 1.8);
  }

  loseLife(text, sub) {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    this.deathT = 1.5;
    this.sound.play('die');
    this.hud.toast(text, sub, 1.4);
    this.input.releaseAll();
  }

  win() {
    if (this.state !== 'playing') return;
    this.state = 'complete';
    this.winT = 0;
    this.shownWin = false;
    this.g.holding = false;
    this.g.riding = false;
    this.b.state = 'won';
    this.sound.play('portal');
    setTimeout(() => this.sound.play('fanfare'), 700);
    this.fx.burst(this.portal.center, 40, { color: [0xffffff, 0xc27bff, 0xffd23f], size: 0.12, life: 1.2, speed: 6, up: 2 });
  }

  // ---------------------------------------------------------------- per-frame visuals
  visuals(dt) {
    const g = this.g, b = this.b, t = this.time;
    const f = FORMS[b.form];

    // title screen: slow orbit around the start
    if (this.state === 'title') {
      this.titleT += dt;
      const a = this.titleT * 0.15 + 0.6;
      const rad = innerHeight > innerWidth ? 15 : 11;
      this.camera.position.set(Math.sin(a) * rad, 4.5, Math.cos(a) * rad + 1);
      this.camera.lookAt(0, 1, 0);
    } else if (this.state !== 'paused') {
      this.cam.update(dt, {
        pos: g.pos, vel: g.vel, grounded: g.grounded || g.riding,
        ball: b.pos, ballFree: b.state === 'free', holding: g.holding, yaw: g.yaw,
        input: this.input, physics: this.physics,
        portrait: innerHeight > innerWidth,
      });
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }

    // Glover model
    this.model.root.position.copy(g.pos);
    this.model.root.rotation.y = g.yaw;
    if (g.holding && f.dribble) b.dribble += dt * (9 + Math.hypot(g.vel.x, g.vel.z) * 0.6);
    const hs = Math.hypot(g.vel.x, g.vel.z);
    this.model.animate(dt, {
      speed: g.riding ? Math.hypot(b.vel.x, b.vel.z) : hs,
      grounded: g.grounded, vy: g.vel.y, holding: g.holding, riding: g.riding,
      dribble: g.holding && !!f.dribble, dribblePhase: b.dribble,
      flipStart: g.anim.flipStart, spinStart: g.anim.spinStart, landImpact: g.anim.landImpact,
      slam: g.slamming, hurt: g.hurtT > 0, flicker: g.invuln > 0 && this.state === 'playing',
    });
    g.anim.flipStart = false; g.anim.spinStart = false; g.anim.landImpact = 0;

    // footsteps
    if (g.grounded && hs > 1 && this.state === 'playing') {
      const ph = Math.floor(this.model.phase / Math.PI);
      if (ph !== this.stepPhase) { this.stepPhase = ph; this.sound.play('step'); }
    }

    // ball visual
    if (b.state !== 'won') this.ballVis.root.position.copy(b.pos);
    else this.ballVis.root.position.copy(b.pos);
    if (g.holding && f.dribble) {
      const d = Math.abs(Math.sin(b.dribble));
      this.ballVis.root.position.y += d * 0.6;
      if (d < 0.15 && !b.dribbleBounced) { b.dribbleBounced = true; this.sound.play('bounce', 3); }
      if (d > 0.5) b.dribbleBounced = false;
    }
    const w = b.omega.length();
    if (w > 1e-4) {
      _ax.copy(b.omega).divideScalar(w);
      _q.setFromAxisAngle(_ax, w * dt);
      this.ballVis.spin.quaternion.premultiply(_q);
    }
    this.ballVis.animate(dt);

    // shadows
    this.gShadow.update(this.physics, g.pos, this.model.root.visible || this.state !== 'playing');
    this.bShadow.update(this.physics, _p.set(b.pos.x, b.pos.y - BALL_R, b.pos.z), this.ballVis.root.visible && b.state !== 'won');
    this.bumblers.items.forEach((e, i) => this.eShadows[i].update(this.physics, e.pos, e.alive));

    // world + props
    updateWorld(this.world, dt, t);
    this.garibs.update(dt, t);
    this.potions.update(dt, t);
    this.checkpoints.update(dt, t);
    this.signs.update(dt, t, this.camera.position);
    if (this.state === 'playing' || this.state === 'title') this.bumblers.update(dt, t);
    else this.bumblers.update(0, t);
    this.portal.update(dt, t);
    this.fx.update(dt);

    // sparkles drifting off the portal + crystal ball
    if (Math.random() < dt * 12) {
      const a = Math.random() * Math.PI * 2;
      this.fx.spawn(_p.set(this.portal.center.x + Math.cos(a) * 1.6, this.portal.center.y + Math.sin(a) * 1.6, this.portal.center.z),
        _t.set(0, 0.6, 0), { color: 0xffe8ff, size: 0.06, life: 0.9 });
    }
    if (b.form === 'crystal' && this.ballVis.root.visible && Math.random() < dt * 4) {
      this.fx.spawn(_p.copy(b.pos).add(_t.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.9)),
        _t.set(0, 0.4, 0), { color: 0xe0f8ff, size: 0.04, life: 0.6 });
    }

    // HUD
    if (this.state === 'playing' || this.state === 'dying') {
      this.hud.setLives(this.lives);
      this.hud.setHearts(Math.max(0, g.hearts), MAX_HEARTS);
      this.hud.setGaribs(this.garibCount, this.garibs.total);
      this.input.setGrabLabel(g.holding ? (this.willThrow() ? 'THROW' : 'DROP') : 'GRAB');

      // until the ball has been picked up once, spell out the goal; after that, nearest sign
      const mode = this.input.labelMode();
      if (this.tips.pickups === 0 && this.state === 'playing') {
        this.hud.showSign(formatControls('<b>Goal:</b> carry your <b>ball</b> to the <b>portal</b> at the end of the level! Walk up to it and press {GRAB} to pick it up.', mode));
      } else {
        let sign = null, best = 2.8;
        for (const s of this.signs.items) {
          const d = Math.hypot(s.x - g.pos.x, s.z - g.pos.z);
          if (d < best && Math.abs(s.y - g.pos.y) < 2.5) { best = d; sign = s; }
        }
        this.hud.showSign(sign ? formatControls(sign.text, mode) : null);
      }
      this.updateBallArrow();
      this.updatePrompt();
    } else {
      this.hud.showSign(null);
      this.hud.setArrow(null);
      this.hud.setPrompt(null);
      this.input.setGrabHint(false);
    }
    this.hud.update(dt);
  }

  updateBallArrow() {
    const b = this.b;
    if (b.state !== 'free' || b.pos.distanceTo(this.g.pos) < 3) { this.hud.setArrow(null); return; }
    this.camera.updateMatrixWorld();
    _p.copy(b.pos).project(this.camera);
    const behind = _t.copy(b.pos).sub(this.camera.position).dot(this.camera.getWorldDirection(_fwd)) < 0;
    let x = _p.x, y = _p.y;
    if (!behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.88) { this.hud.setArrow(null); return; }
    if (behind) { x = -x; y = -y; }
    const ang = Math.atan2(x, y);
    const m = Math.max(Math.abs(x) / 0.88, Math.abs(y) / 0.8, 1e-3);
    x /= m; y /= m;
    const W = innerWidth, H = innerHeight;
    this.hud.setArrow((x * 0.5 + 0.5) * W, (-y * 0.5 + 0.5) * H, ang);
  }
}
