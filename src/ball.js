// The ball and its three forms. Physics stepping is in game.js; this holds the
// per-form tuning and the visuals.
import * as THREE from 'three';

export const BALL_R = 0.5;

export const FORMS = {
  crystal: {
    label: 'Crystal Ball',
    gravity: 24, restitution: 0.3, rollFriction: 1.4, impactKeep: 0.55, mass: 1,
    breakSpeed: 13.5, slap: 11, throwH: 8, throwV: 7.5,
    holdSpeed: 0.92, jumpMul: 0.86, color: '#9fe6ff',
  },
  rubber: {
    label: 'Rubber Ball',
    gravity: 22, restitution: 0.8, rollFriction: 0.9, impactKeep: 0.85, mass: 0.7,
    breakSpeed: Infinity, slap: 15, throwH: 8.5, throwV: 8.5,
    holdSpeed: 1.0, jumpMul: 0.9, dribble: true, color: '#ff8a3d',
  },
  bowling: {
    label: 'Bowling Ball',
    gravity: 30, restitution: 0.05, rollFriction: 0.6, impactKeep: 0.5, mass: 4,
    breakSpeed: Infinity, slap: 8.5, throwH: 4.5, throwV: 4.5,
    holdSpeed: 0.68, jumpMul: 0, smash: true, color: '#b18cff',
  },
};

function crystalMesh() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 24, 16),
    new THREE.MeshPhongMaterial({
      color: 0xa8e4ff, emissive: 0x1d4a6e, specular: 0xffffff, shininess: 140,
      transparent: true, opacity: 0.55, depthWrite: false,
    }),
  );
  shell.renderOrder = 2;
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(BALL_R * 0.42, 0),
    new THREE.MeshBasicMaterial({ color: 0xd8f6ff, wireframe: true }),
  );
  const core2 = new THREE.Mesh(
    new THREE.OctahedronGeometry(BALL_R * 0.22, 0),
    new THREE.MeshBasicMaterial({ color: 0x6fd6ff }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(BALL_R * 0.7, 0.025, 4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
  );
  g.add(core, core2, ring, shell);
  g.userData.spinners = [core, core2];
  return g;
}

function rubberMesh() {
  const geo = new THREE.SphereGeometry(BALL_R, 18, 12).toNonIndexed();
  const pos = geo.attributes.position;
  const cols = [];
  const palette = [0xff4d4d, 0xffd23f, 0x3d8bff, 0xffffff, 0x4cc764, 0xff8a3d].map((h) => new THREE.Color(h));
  for (let i = 0; i < pos.count; i += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { cx += pos.getX(i + k); cy += pos.getY(i + k); cz += pos.getZ(i + k); }
    const a = Math.atan2(cz, cx);
    let idx = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 6) % 6;
    let c = palette[idx];
    if (Math.abs(cy / 3) > BALL_R * 0.86) c = palette[3];
    for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x444444 }));
  const g = new THREE.Group();
  g.add(m);
  return g;
}

function bowlingMesh() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 22, 16),
    new THREE.MeshPhongMaterial({ color: 0x3a1a66, specular: 0xb9a3ff, shininess: 90 }),
  );
  g.add(ball);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x0b0418 });
  const holes = [[0.0, 0.42], [-0.16, 0.36], [0.16, 0.36]];
  for (const [x, y] of holes) {
    const n = new THREE.Vector3(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))).normalize();
    const h = new THREE.Mesh(new THREE.CircleGeometry(0.065, 10), holeMat);
    h.position.copy(n).multiplyScalar(BALL_R + 0.002);
    h.lookAt(n.clone().multiplyScalar(2));
    g.add(h);
  }
  // swirl band so rolling reads clearly
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(BALL_R * 1.0, 0.03, 4, 32),
    new THREE.MeshBasicMaterial({ color: 0xb18cff }),
  );
  band.rotation.y = Math.PI / 2;
  g.add(band);
  return g;
}

export class BallVisual {
  constructor() {
    this.root = new THREE.Group();     // positioned at ball centre
    this.spin = new THREE.Group();     // rolls
    this.root.add(this.spin);
    this.forms = { crystal: crystalMesh(), rubber: rubberMesh(), bowling: bowlingMesh() };
    for (const k in this.forms) this.spin.add(this.forms[k]);

    // a fake specular glint that doesn't roll, so glass still reads as glass
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
    );
    glint.position.set(-0.2, 0.26, 0.28);
    glint.scale.set(1, 0.6, 0.4);
    this.glint = glint;
    this.root.add(glint);

    // x-ray silhouette: only drawn where the ball is hidden behind something
    this.xray = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R * 1.02, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0x9fe6ff, transparent: true, opacity: 0.4, depthWrite: false, depthFunc: THREE.GreaterDepth,
      }),
    );
    this.xray.renderOrder = 10;
    this.root.add(this.xray);
    this.setForm('crystal');
    this.t = 0;
  }
  setForm(name) {
    for (const k in this.forms) this.forms[k].visible = k === name;
    this.glint.visible = name !== 'rubber';
    this.xray.material.color.set(FORMS[name].color);
    this.form = name;
  }
  animate(dt) {
    this.t += dt;
    const f = this.forms.crystal;
    if (f.visible) {
      f.userData.spinners[0].rotation.y += dt * 1.5;
      f.userData.spinners[0].rotation.x += dt * 0.7;
      f.userData.spinners[1].rotation.y -= dt * 2.5;
    }
  }
}
