// Particles (one instanced mesh) and blob shadows.
import * as THREE from 'three';

const MAX = 500;

export class Particles {
  constructor(scene) {
    const geo = new THREE.OctahedronGeometry(1, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < MAX; i++) this.mesh.setColorAt(i, c);
    scene.add(this.mesh);
    this.ps = [];
    for (let i = 0; i < MAX; i++) this.ps.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, size: 0.1, g: 0, rot: 0, spin: 0 });
    this.next = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._e = new THREE.Euler();
    this._c = new THREE.Color();
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX; i++) this.mesh.setMatrixAt(i, this.zero);
  }

  spawn(pos, vel, { life = 0.8, size = 0.12, color = 0xffffff, gravity = 0, spin = 6 } = {}) {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    const P = this.ps[i];
    P.alive = true;
    P.p.copy(pos);
    P.v.copy(vel);
    P.life = P.max = life;
    P.size = size;
    P.g = gravity;
    P.rot = Math.random() * 6;
    P.spin = (Math.random() - 0.5) * spin * 2;
    this.mesh.setColorAt(i, this._c.set(color));
    this.mesh.instanceColor.needsUpdate = true;
  }

  burst(pos, n, { speed = 4, up = 2, ...opts } = {}) {
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      v.y += up * Math.random();
      const color = Array.isArray(opts.color) ? opts.color[i % opts.color.length] : opts.color;
      this.spawn(pos, v, { ...opts, color });
    }
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < MAX; i++) {
      const P = this.ps[i];
      if (!P.alive) continue;
      any = true;
      P.life -= dt;
      if (P.life <= 0) { P.alive = false; this.mesh.setMatrixAt(i, this.zero); continue; }
      P.v.y -= P.g * dt;
      P.v.multiplyScalar(1 - dt * 1.2);
      P.p.addScaledVector(P.v, dt);
      P.rot += P.spin * dt;
      const k = P.life / P.max;
      const s = P.size * (k < 0.3 ? k / 0.3 : 1);
      this._q.setFromEuler(this._e.set(P.rot, P.rot * 0.7, 0));
      this._m.compose(P.p, this._q, this._s.set(s, s, s));
      this.mesh.setMatrixAt(i, this._m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < MAX; i++) { this.ps[i].alive = false; this.mesh.setMatrixAt(i, this.zero); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const DOWN = new THREE.Vector3(0, -1, 0);
const UPV = new THREE.Vector3(0, 1, 0);

export class BlobShadow {
  constructor(scene, tex, size) {
    this.size = size;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this._o = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._rx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  }
  update(physics, pos, visible = true) {
    if (!visible) { this.mesh.visible = false; return; }
    this._o.set(pos.x, pos.y + 0.3, pos.z);
    const hit = physics.raycast(this._o, DOWN, 40);
    if (!hit) { this.mesh.visible = false; return; }
    const h = hit.t - 0.3;
    this.mesh.visible = true;
    this.mesh.position.set(pos.x, pos.y + 0.3 - hit.t + 0.03, pos.z);
    this._q.setFromUnitVectors(UPV, hit.normal);
    this.mesh.quaternion.copy(this._q).multiply(this._rx);
    const s = this.size * Math.max(0.45, 1 - h * 0.06);
    this.mesh.scale.set(s, s, s);
    this.mesh.material.opacity = Math.max(0.25, 1 - h * 0.07);
  }
}
