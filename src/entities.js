// Interactive props: garibs (collectibles), potions, checkpoints, signs,
// bumbler critters and the exit portal. Each has a mesh and light update logic.
import * as THREE from 'three';
import { FORMS } from './ball.js';

// ---------------- garibs ----------------
export class Garibs {
  constructor(scene, list) {
    const geo = new THREE.OctahedronGeometry(0.3, 0);
    geo.scale(0.85, 1.25, 0.32);
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0xb37400, emissiveIntensity: 0.6, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, list.length);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.items = list.map(([x, y, z], i) => ({
      idx: i, pos: new THREE.Vector3(x, y, z), base: new THREE.Vector3(x, y, z), alive: true, phase: i * 0.7, pop: 0, rot: 0, scale: 1,
    }));
    this.total = list.length;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }
  reset() {
    for (const g of this.items) { g.alive = true; g.pop = 0; g.scale = 1; g.pos.copy(g.base); }
  }
  update(dt, t) {
    for (const g of this.items) {
      if (!g.alive) {
        if (g.pop > 0) {
          g.pop = Math.max(0, g.pop - dt * 3);
          g.pos.y += dt * 4;
          g.rot += dt * 20;
          g.scale = g.pop;
        } else g.scale = 0;
      } else {
        g.rot = t * 2.4 + g.phase;
        g.pos.y = g.base.y + Math.sin(t * 3 + g.phase) * 0.1;
      }
      this._q.setFromAxisAngle(this._up, g.rot);
      this._m.compose(g.pos, this._q, this._s.setScalar(g.scale));
      this.mesh.setMatrixAt(g.idx, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  collect(g) { g.alive = false; g.pop = 1; }
}

// ---------------- potions ----------------
const POTION_COL = { rubber: 0xff7a2f, bowling: 0x8a4dff, crystal: 0x5fd8ff };

export class Potions {
  constructor(scene, list) {
    const pts = [];
    const prof = [[0.0, 0], [0.22, 0.02], [0.3, 0.14], [0.3, 0.32], [0.2, 0.46], [0.09, 0.52], [0.09, 0.66], [0.0, 0.66]];
    for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
    const bottleGeo = new THREE.LatheGeometry(pts, 12);
    const corkGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.12, 8);
    const corkMat = new THREE.MeshLambertMaterial({ color: 0xa0703a });
    const pedGeo = new THREE.CylinderGeometry(0.42, 0.52, 0.5, 8);
    const pedMat = new THREE.MeshLambertMaterial({ color: 0xb6b0cc, flatShading: true });
    this.items = list.map((p) => {
      const g = new THREE.Group();
      g.position.set(p.x, p.y, p.z);
      const ped = new THREE.Mesh(pedGeo, pedMat);
      ped.position.y = 0.25;
      const holder = new THREE.Group();
      holder.position.y = 0.95;
      const col = POTION_COL[p.form];
      const bottle = new THREE.Mesh(bottleGeo, new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.35 }));
      bottle.position.y = -0.3;
      const cork = new THREE.Mesh(corkGeo, corkMat);
      cork.position.y = 0.42;
      holder.add(bottle, cork);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 4, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6 }));
      glow.rotation.x = Math.PI / 2;
      glow.position.y = 0.55;
      g.add(ped, holder, glow);
      scene.add(g);
      return { ...p, group: g, holder, glow, pos: new THREE.Vector3(p.x, p.y + 0.9, p.z), cool: 0, color: col };
    });
  }
  update(dt, t) {
    for (const p of this.items) {
      p.cool = Math.max(0, p.cool - dt);
      p.holder.rotation.y = t * 1.5;
      p.holder.position.y = 0.95 + Math.sin(t * 2.2 + p.x) * 0.08;
      p.glow.scale.setScalar(1 + Math.sin(t * 3) * 0.1);
    }
  }
}

// ---------------- checkpoints ----------------
export class Checkpoints {
  constructor(scene, list) {
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0xe8e2d0 });
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0); flagShape.lineTo(0.9, -0.25); flagShape.lineTo(0, -0.5); flagShape.lineTo(0, 0);
    const flagGeo = new THREE.ShapeGeometry(flagShape);
    const knobGeo = new THREE.SphereGeometry(0.12, 8, 6);
    this.items = list.map((c) => {
      const g = new THREE.Group();
      g.position.set(c.x, c.y, c.z);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 1.1;
      const flagMat = new THREE.MeshLambertMaterial({ color: 0x9a93ad, side: THREE.DoubleSide });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(0.05, 1.3, 0);
      const knob = new THREE.Mesh(knobGeo, new THREE.MeshLambertMaterial({ color: 0xffd23f }));
      knob.position.y = 2.25;
      g.add(pole, flag, knob);
      scene.add(g);
      return { ...c, group: g, flag, flagMat, active: false, raise: 0, pos: new THREE.Vector3(c.x, c.y, c.z) };
    });
  }
  reset() {
    for (const c of this.items) { c.active = false; c.raise = 0; c.flagMat.color.setHex(0x9a93ad); c.flag.position.y = 1.3; }
  }
  activate(c) {
    c.active = true;
    c.flagMat.color.setHex(0xff4fa3);
  }
  update(dt, t) {
    for (const c of this.items) {
      if (c.active && c.raise < 1) c.raise = Math.min(1, c.raise + dt * 2);
      c.flag.position.y = 1.3 + c.raise * 0.9;
      c.flag.rotation.y = Math.sin(t * 4 + c.x) * 0.25;
    }
  }
}

// ---------------- signs ----------------
export class Signs {
  constructor(scene, list, tex) {
    const postGeo = new THREE.BoxGeometry(0.12, 1.1, 0.12);
    const boardGeo = new THREE.BoxGeometry(0.8, 0.62, 0.1);
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x9a6633 });
    const faceMat = new THREE.MeshLambertMaterial({ map: tex });
    this.items = list.map((s) => {
      const g = new THREE.Group();
      g.position.set(s.x, s.y, s.z);
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.y = 0.55;
      const board = new THREE.Mesh(boardGeo, faceMat);
      board.position.y = 1.15;
      g.add(post, board);
      scene.add(g);
      return { ...s, group: g, board, pos: new THREE.Vector3(s.x, s.y, s.z) };
    });
  }
  update(dt, t, camPos) {
    for (const s of this.items) {
      // signs turn to face the camera so you can always see the "!"
      const a = Math.atan2(camPos.x - s.x, camPos.z - s.z);
      s.group.rotation.y = a;
      s.board.rotation.z = Math.sin(t * 2 + s.x) * 0.04;
    }
  }
}

// ---------------- bumblers ----------------
function bumblerMesh() {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshLambertMaterial({ color: 0xe8394f });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a1846 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
  shell.scale.set(1, 0.85, 1.15);
  shell.position.y = 0.18;
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.4, 0.14, 14), dark);
  belly.position.y = 0.16;
  belly.scale.z = 1.15;
  g.add(shell, belly);
  const spotMat = new THREE.MeshBasicMaterial({ color: 0x1a1030 });
  for (const [x, y, z] of [[0.18, 0.5, 0.05], [-0.2, 0.46, -0.12], [0.05, 0.42, -0.32], [-0.08, 0.55, 0.2]]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), spotMat);
    s.position.set(x, y, z);
    s.scale.y = 0.4;
    g.add(s);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), dark);
  head.position.set(0, 0.25, 0.45);
  g.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const x of [-0.09, 0.09]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeMat);
    e.position.set(x, 0.33, 0.62);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), spotMat);
    p.position.set(x, 0.33, 0.68);
    g.add(e, p);
  }
  // wind-up key on its back
  const key = new THREE.Group();
  key.position.set(0, 0.62, -0.18);
  const keyMat = new THREE.MeshLambertMaterial({ color: 0xffd23f });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6), keyMat);
  stem.position.y = 0.05;
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 4, 10), keyMat);
  bow.position.y = 0.2;
  const bow2 = bow.clone();
  bow2.position.y = 0.2;
  bow.position.x = 0.1; bow2.position.x = -0.1;
  key.add(stem, bow, bow2);
  g.add(key);
  // legs
  const legs = [];
  const legGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.22, 4);
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const l = new THREE.Mesh(legGeo, dark);
    l.position.set(side * 0.38, 0.08, -0.2 + (i % 3) * 0.2);
    l.rotation.z = side * 0.6;
    g.add(l);
    legs.push(l);
  }
  g.userData = { key, legs };
  return g;
}

export class Bumblers {
  constructor(scene, list) {
    this.scene = scene;
    this.items = list.map((e, i) => {
      const mesh = bumblerMesh();
      scene.add(mesh);
      const a = new THREE.Vector3(...e.a), b = new THREE.Vector3(...e.b);
      return { mesh, a, b, pos: a.clone(), t: i * 0.37, dir: 1, alive: true, pause: 0, squish: 0, vel: new THREE.Vector3() };
    });
    this.reset();
  }
  reset() {
    for (const e of this.items) {
      e.alive = true; e.mesh.visible = true; e.squish = 0; e.u = 0.5; e.dir = 1; e.pause = 0;
      e.pos.copy(e.a).lerp(e.b, e.u);
      e.mesh.scale.setScalar(1);
    }
  }
  update(dt, t) {
    for (const e of this.items) {
      if (!e.alive) {
        if (e.squish > 0) {
          e.squish -= dt * 3;
          e.mesh.scale.set(1 + (1 - e.squish) * 0.6, Math.max(0.05, e.squish * 0.5), 1 + (1 - e.squish) * 0.6);
          if (e.squish <= 0) e.mesh.visible = false;
        }
        continue;
      }
      const len = e.a.distanceTo(e.b);
      const prev = e.pos.clone();
      if (e.pause > 0) e.pause -= dt;
      else {
        e.u += (e.dir * 1.6 * dt) / len;
        if (e.u > 1) { e.u = 1; e.dir = -1; e.pause = 0.6; }
        if (e.u < 0) { e.u = 0; e.dir = 1; e.pause = 0.6; }
      }
      e.pos.copy(e.a).lerp(e.b, e.u);
      e.vel.copy(e.pos).sub(prev).divideScalar(Math.max(dt, 1e-4));
      const heading = e.dir > 0 ? e.b.clone().sub(e.a) : e.a.clone().sub(e.b);
      const want = Math.atan2(heading.x, heading.z);
      let d = want - e.mesh.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      e.mesh.rotation.y += d * Math.min(1, dt * 8);
      e.mesh.position.copy(e.pos);
      e.mesh.position.y += Math.abs(Math.sin(t * 14 + e.u * 9)) * 0.04;
      e.mesh.userData.key.rotation.z = t * 4;
      e.mesh.userData.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 16 + i * 2) * 0.5; });
    }
  }
  kill(e) {
    e.alive = false;
    e.squish = 1;
  }
}

// ---------------- exit portal ----------------
export class Portal {
  constructor(scene, g, tex) {
    this.group = new THREE.Group();
    this.group.position.set(g.x, g.y, g.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.2, 0.4, 16), new THREE.MeshLambertMaterial({ color: 0xb6b0cc, flatShading: true }));
    base.position.y = 0.2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.22, 8, 28), new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x7a5200, flatShading: true }));
    ring.position.y = 2.1;
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1.55, 28), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, side: THREE.DoubleSide }));
    this.disc.position.y = 2.1;
    this.stars = [];
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), starMat);
      this.group.add(s);
      this.stars.push(s);
    }
    this.group.add(base, ring, this.disc);
    scene.add(this.group);
    this.pos = new THREE.Vector3(g.x, g.y, g.z);
    this.center = new THREE.Vector3(g.x, g.y + 2.1, g.z);
  }
  update(dt, t) {
    this.disc.rotation.z = -t * 1.5;
    this.disc.scale.setScalar(1 + Math.sin(t * 3) * 0.03);
    this.stars.forEach((s, i) => {
      const a = t * 1.2 + (i / this.stars.length) * Math.PI * 2;
      s.position.set(Math.cos(a) * 2.1, 2.1 + Math.sin(a) * 2.1, 0);
      s.rotation.y = t * 3;
    });
  }
}

export { FORMS };
