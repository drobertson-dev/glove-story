// The hero: a cheerful white glove that walks on two fingers.
// This file is just the model + animation; movement lives in game.js.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const white = () => new THREE.MeshLambertMaterial({ color: 0xf7f5f0 });

function capsule(radius, length, mat) {
  const g = new THREE.CapsuleGeometry(radius, length, 4, 10);
  g.translate(0, -length / 2 - radius * 0.2, 0); // pivot at the top
  return new THREE.Mesh(g, mat);
}

export class GloverModel {
  constructor() {
    this.root = new THREE.Group();
    this.inner = new THREE.Group();   // scaled model lives in here
    this.inner.scale.setScalar(0.86);
    this.root.add(this.inner);
    this.mat = white();
    this.cuffMat = new THREE.MeshLambertMaterial({ color: 0x7b4bd6 });
    this.bandMat = new THREE.MeshLambertMaterial({ color: 0xffd23f });

    // body pivot sits at the "hips" (where the finger-legs join)
    this.body = new THREE.Group();
    this.body.position.y = 0.55;
    this.inner.add(this.body);

    this.squash = new THREE.Group();
    this.body.add(this.squash);

    const hand = new THREE.Mesh(new RoundedBoxGeometry(0.74, 0.64, 0.34, 4, 0.15), this.mat);
    hand.position.y = 0.3;
    this.squash.add(hand);

    // knuckle bumps along the bottom (the two curled fingers)
    for (const x of [0.25, -0.25]) {
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), this.mat);
      k.position.set(x, 0.0, -0.06);
      k.scale.set(1, 0.8, 1.2);
      this.squash.add(k);
    }

    // cuff
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.2, 16), this.cuffMat);
    cuff.position.y = 0.69;
    cuff.scale.z = 0.62;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 6, 18), this.bandMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.7;
    band.scale.y = 0.62;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshBasicMaterial({ color: 0x2a1846 }));
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.795;
    hole.scale.y = 0.6;
    this.squash.add(cuff, band, hole);

    // eyes
    this.eyes = new THREE.Group();
    this.eyes.position.set(0, 0.36, 0.165);
    const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1a1030 });
    for (const x of [-0.12, 0.12]) {
      const e = new THREE.Group();
      e.position.x = x;
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), eyeWhite);
      w.scale.set(0.85, 1.25, 0.45);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), pupilMat);
      p.position.set(0, -0.01, 0.035);
      p.scale.set(0.9, 1.3, 0.5);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), eyeWhite);
      shine.position.set(0.015, 0.03, 0.06);
      e.add(w, p, shine);
      this.eyes.add(e);
    }
    this.squash.add(this.eyes);

    // thumb (acts like an arm)
    this.thumbPivot = new THREE.Group();
    this.thumbPivot.position.set(-0.36, 0.34, 0.02);
    const thumb = capsule(0.09, 0.26, this.mat);
    thumb.rotation.z = 0; // hangs down from pivot
    this.thumbPivot.add(thumb);
    this.thumbPivot.rotation.z = -0.9;
    this.squash.add(this.thumbPivot);

    // finger legs
    this.legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.13, 0.04, 0);
      const upper = capsule(0.095, 0.2, this.mat);
      const knee = new THREE.Group();
      knee.position.y = -0.27;
      const lower = capsule(0.09, 0.18, this.mat);
      knee.add(lower);
      hip.add(upper, knee);
      this.body.add(hip);
      this.legs.push({ hip, knee, side });
    }

    this.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });

    this.phase = 0;
    this.blinkT = 2;
    this.flip = 0;
    this.spin = 0;
    this.land = 0;
    this.time = 0;
  }

  // s: animation inputs gathered by the game each frame
  animate(dt, s) {
    this.time += dt;
    const t = this.time;
    const L = this.legs;
    const lerp = (a, b, k) => a + (b - a) * Math.min(1, k);

    let hipA = [0, 0], kneeA = [0, 0];
    let lean = 0, bob = 0, thumbZ = -0.9, thumbX = 0, sway = 0;

    if (s.swimming) {
      // doggy paddle: legs flutter, thumb strokes, body tipped forward
      this.phase += dt * 9;
      const p = this.phase;
      hipA = [Math.sin(p) * 0.5 - 0.6, Math.sin(p + Math.PI) * 0.5 - 0.6];
      kneeA = [0.3, 0.3];
      thumbZ = -1.5 + Math.sin(p * 0.7) * 0.6;
      thumbX = Math.cos(p * 0.7) * 0.8;
      lean = 0.5;
    } else if (s.riding) {
      this.phase += dt * (6 + s.speed * 3);
      const p = this.phase;
      hipA = [Math.sin(p) * 0.6 - 0.2, Math.sin(p + Math.PI) * 0.6 - 0.2];
      kneeA = [Math.max(0, Math.cos(p)) * 0.9 + 0.2, Math.max(0, Math.cos(p + Math.PI)) * 0.9 + 0.2];
      thumbZ = -1.9 + Math.sin(t * 7) * 0.3;
      sway = Math.sin(t * 5) * 0.12;
      bob = Math.abs(Math.sin(p)) * 0.04;
    } else if (s.grounded) {
      const sp = s.speed;
      if (sp > 0.3) {
        this.phase += dt * (5 + sp * 1.7);
        const p = this.phase;
        const amt = Math.min(1, sp / 5);
        hipA = [Math.sin(p) * 0.75 * amt, Math.sin(p + Math.PI) * 0.75 * amt];
        kneeA = [Math.max(0, -Math.cos(p)) * 1.0 * amt, Math.max(0, -Math.cos(p + Math.PI)) * 1.0 * amt];
        bob = Math.abs(Math.cos(p)) * 0.06 * amt;
        lean = 0.12 * amt;
        thumbX = Math.sin(p) * 0.5 * amt;
      } else {
        bob = Math.sin(t * 2.2) * 0.012;
        thumbZ = -0.9 + Math.sin(t * 1.3) * 0.08;
      }
    } else {
      // airborne: tuck going up, legs out coming down
      if (s.vy > 0) { hipA = [-0.6, -0.4]; kneeA = [1.1, 1.0]; }
      else { hipA = [0.25, -0.25]; kneeA = [0.25, 0.3]; }
      thumbZ = -1.6;
    }

    if (s.holding) {
      // stand tall, thumb wrapped over the ball tucked at our side;
      // lean away from it a little to balance the weight
      thumbZ = -1.85;
      thumbX = -0.3;
      sway = s.heavy ? -0.16 : -0.06;
      if (s.dribble) {
        thumbZ = -1.55 - Math.abs(Math.sin(s.dribblePhase)) * 0.5;
        bob += Math.max(0, Math.sin(s.dribblePhase * 2)) * 0.02;
      }
    }

    if (s.slam) { hipA = [-1.0, -1.0]; kneeA = [1.6, 1.6]; lean = 0; }

    for (let i = 0; i < 2; i++) {
      L[i].hip.rotation.x = lerp(L[i].hip.rotation.x, -hipA[i], dt * 20);
      L[i].knee.rotation.x = lerp(L[i].knee.rotation.x, kneeA[i], dt * 20);
    }

    // double-jump flip
    if (s.flipStart) this.flip = 1;
    let flipRot = 0;
    if (this.flip > 0) {
      this.flip = Math.max(0, this.flip - dt * 2.6);
      const k = 1 - this.flip;
      flipRot = k * Math.PI * 2;
    }
    // slap spin
    if (s.spinStart) this.spin = 1;
    let spinRot = 0;
    if (this.spin > 0) {
      this.spin = Math.max(0, this.spin - dt * 4);
      spinRot = (1 - this.spin) * Math.PI * 2;
      thumbZ = -2.4;
    }

    this.body.rotation.x = lerp(this.body.rotation.x, lean, dt * 12) + 0;
    this.body.rotation.z = lerp(this.body.rotation.z, sway, dt * 10);
    this.squash.rotation.x = flipRot;
    this.squash.rotation.y = spinRot;
    this.body.position.y = 0.55 + bob;

    // squash & stretch
    if (s.landImpact) this.land = Math.min(1, s.landImpact);
    this.land = Math.max(0, this.land - dt * 5);
    let sy = 1 - this.land * 0.28;
    if (!s.grounded && !s.riding && s.vy > 4) sy = 1.1;
    const target = sy;
    const cur = this.squash.scale.y;
    const ny = lerp(cur, target, dt * 18);
    this.squash.scale.set(1 + (1 - ny) * 0.6, ny, 1 + (1 - ny) * 0.6);

    this.thumbPivot.rotation.z = lerp(this.thumbPivot.rotation.z, thumbZ, dt * 14);
    this.thumbPivot.rotation.x = lerp(this.thumbPivot.rotation.x, thumbX, dt * 14);

    // blink
    this.blinkT -= dt;
    let eyeS = 1;
    if (this.blinkT < 0.12) eyeS = Math.abs(this.blinkT - 0.06) / 0.06;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    if (s.hurt) eyeS = 0.3;
    this.eyes.scale.y = Math.max(0.1, eyeS);

    // invulnerability flicker
    this.root.visible = s.flicker ? Math.floor(t * 16) % 2 === 0 : true;
  }
}
