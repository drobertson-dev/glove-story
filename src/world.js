// Builds the level's static geometry (visual meshes + matching colliders),
// plus sky, clouds and decoration.
import * as THREE from 'three';
import { BoxCollider, CylCollider } from './physics.js';
import { rng, scaleUVs } from './textures.js';

const UP = new THREE.Vector3(0, 1, 0);

function lambert(map, extra = {}) {
  return new THREE.MeshLambertMaterial({ map, ...extra });
}

// Box UVs with independent tile sizes for top/bottom and sides.
function tiledBox(w, h, d, topTile, sideTile) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const dims = [[d, h, sideTile], [d, h, sideTile], [w, d, topTile], [w, d, topTile], [w, h, sideTile], [w, h, sideTile]];
  for (let f = 0; f < 6; f++) {
    const [su, sv, tile] = dims[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * su) / tile, (uv.getY(k) * sv) / tile);
    }
  }
  return geo;
}

// Deterministic jitter keyed on position, so duplicated seam vertices move together.
function hash3(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

export function buildWorld(scene, physics, T, L) {
  const mats = {
    grass: lambert(T.grass),
    grassSide: lambert(T.grassSide),
    rock: lambert(T.rock),
    stone: lambert(T.stone),
    wood: lambert(T.wood),
    crate: lambert(T.crate),
    thistle: lambert(T.thistle),
    metal: lambert(T.metal),
    pad: lambert(T.pad),
    padSide: new THREE.MeshLambertMaterial({ color: 0xc72a40 }),
    trunk: new THREE.MeshLambertMaterial({ color: 0x8a5a2e, flatShading: true }),
    leaves: new THREE.MeshLambertMaterial({ color: 0x3fae4a, flatShading: true }),
    leaves2: new THREE.MeshLambertMaterial({ color: 0x5cc95a, flatShading: true }),
    spike: new THREE.MeshLambertMaterial({ color: 0x9b59c9, flatShading: true }),
    cloud: new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x506080, emissiveIntensity: 0.35 }),
  };

  const level = new THREE.Group();
  scene.add(level);
  const out = { movers: [], crates: [], pads: [], clouds: [], group: level };

  // ---------- islands ----------
  for (const isl of L.islands) {
    const { x, y, z, r } = isl;
    const segs = Math.max(10, Math.min(28, Math.round(r * 3.5)));
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const slabH = 0.5;
    const slabGeo = new THREE.CylinderGeometry(r, r * 0.98, slabH, segs, 1, false);
    // side uv: u around circumference, v over slab height
    const uv = slabGeo.attributes.uv;
    const circ = 2 * Math.PI * r;
    const sideCount = (segs + 1) * 2;
    for (let i = 0; i < uv.count; i++) {
      if (i < sideCount) uv.setXY(i, (uv.getX(i) * circ) / 0.5, uv.getY(i));
      else uv.setXY(i, uv.getX(i) * r, uv.getY(i) * r);
    }
    const slab = new THREE.Mesh(slabGeo, [mats.grassSide, mats.grass, mats.rock]);
    slab.position.y = -slabH / 2;
    g.add(slab);

    const depth = isl.depth ?? Math.max(2.5, r * 0.85);
    const bottomR = isl.column ? r * 0.8 : r * 0.28;
    const under = new THREE.CylinderGeometry(r * 0.98, bottomR, depth, segs, 4, true);
    const pos = under.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vy = pos.getY(i);
      if (vy > depth / 2 - 0.01) continue; // keep the top ring flush with the slab
      const px = pos.getX(i), pz = pos.getZ(i);
      const h = hash3(px + x, vy, pz + z);
      const k = 1 + (h - 0.5) * 0.22;
      pos.setXYZ(i, px * k, vy + (hash3(pz, px, vy) - 0.5) * 0.4, pz * k);
    }
    under.computeVertexNormals();
    scaleUVs(under, circ / 2.5, depth / 2.5);
    const underMesh = new THREE.Mesh(under, mats.rock);
    underMesh.position.y = -slabH - depth / 2;
    g.add(underMesh);
    if (!isl.column) {
      const tip = new THREE.ConeGeometry(bottomR, r * 0.5, Math.max(6, segs >> 1));
      tip.rotateX(Math.PI);
      const tipMesh = new THREE.Mesh(tip, mats.rock);
      tipMesh.position.y = -slabH - depth - r * 0.25;
      g.add(tipMesh);
    }
    level.add(g);

    const colH = isl.column ? depth + slabH : 1.5;
    physics.add(new CylCollider({ pos: new THREE.Vector3(x, y - colH / 2, z), radius: r, height: colH, mat: 'grass' }));
  }

  // ---------- boxes ----------
  for (const b of L.boxes) {
    const { x, y, z, w, d, h, mat } = b;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (mat === 'wood') {
      const m = new THREE.Mesh(tiledBox(w, h, d, 2, 1), mats.wood);
      m.position.y = -h / 2;
      g.add(m);
      // little rope posts
      const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.9, 6);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(postGeo, mats.trunk);
        p.position.set(sx * (w / 2 - 0.08), 0.25, sz * (d / 2 - 0.3));
        g.add(p);
      }
    } else {
      const topMat = mat === 'thistle' ? mats.thistle : mats.grass;
      const slabSide = mat === 'thistle' ? mats.thistle : mats.grassSide;
      const slabH = Math.min(0.5, h);
      const slab = new THREE.Mesh(tiledBox(w, slabH, d, 2, 0.5), [slabSide, slabSide, topMat, mats.rock, slabSide, slabSide]);
      slab.position.y = -slabH / 2;
      g.add(slab);
      if (h > slabH) {
        const bodyMat = mat === 'stone' ? mats.stone : mats.rock;
        const body = new THREE.Mesh(tiledBox(w * 0.98, h - slabH, d * 0.98, 2, 2), bodyMat);
        body.position.y = -slabH - (h - slabH) / 2;
        g.add(body);
      }
      if (mat === 'thistle') addThistles(g, w, d, mats.spike);
    }
    level.add(g);
    physics.add(new BoxCollider({ pos: new THREE.Vector3(x, y - h / 2, z), size: [w, h, d], mat, hurt: !!b.hurt }));
  }

  // ---------- ramps ----------
  for (const rp of L.ramps) {
    const p0 = new THREE.Vector3(...rp.from), p1 = new THREE.Vector3(...rp.to);
    const Z = p1.clone().sub(p0);
    const len = Z.length();
    Z.normalize();
    const X = new THREE.Vector3().crossVectors(UP, Z).normalize();
    const Y = new THREE.Vector3().crossVectors(Z, X).normalize();
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    const th = 0.8;
    const center = p0.clone().add(p1).multiplyScalar(0.5).addScaledVector(Y, -th / 2);
    const m = new THREE.Mesh(tiledBox(rp.w, th, len, 2, 0.8), [mats.stone, mats.stone, mats.grass, mats.rock, mats.stone, mats.stone]);
    m.position.copy(center);
    m.quaternion.copy(quat);
    level.add(m);
    physics.add(new BoxCollider({ pos: center, size: [rp.w, th, len], quat, mat: 'grass' }));
  }

  // ---------- bounce pads ----------
  for (const p of L.pads) {
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    const padH = 0.3;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 1.08, padH, 20), [mats.padSide, mats.pad, mats.padSide]);
    top.position.y = 0.08 - padH / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r * 1.05, 0.08, 6, 20), new THREE.MeshLambertMaterial({ color: 0xffd23f }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    g.add(top, ring);
    level.add(g);
    const col = physics.add(new CylCollider({ pos: new THREE.Vector3(p.x, p.y + 0.08 - padH / 2, p.z), radius: p.r, height: padH, mat: 'pad' }));
    col.pad = p;
    out.pads.push({ data: p, col, mesh: g, top, squash: 0 });
  }

  // ---------- crates ----------
  for (const c of L.crates) {
    const m = new THREE.Mesh(tiledBox(c.size, c.size, c.size, c.size, c.size), mats.crate);
    m.position.set(c.x, c.y, c.z);
    level.add(m);
    const col = physics.add(new BoxCollider({ pos: m.position.clone(), size: [c.size, c.size, c.size], mat: 'crate', crate: true }));
    out.crates.push({ mesh: m, col, alive: true });
  }

  // ---------- moving platforms ----------
  for (const mv of L.movers) {
    const m = new THREE.Mesh(tiledBox(mv.w, mv.h, mv.d, 1, 0.5), mats.metal);
    const base = new THREE.Vector3(mv.x, mv.y - mv.h / 2, mv.z);
    m.position.copy(base);
    level.add(m);
    const col = physics.add(new BoxCollider({ pos: base.clone(), size: [mv.w, mv.h, mv.d], mat: 'metal' }));
    out.movers.push({ data: mv, mesh: m, col, base, axis: new THREE.Vector3(...mv.axis), t: 0 });
  }

  // ---------- trees (instanced: trunk + two leaf blobs) ----------
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6);
  const blobGeo = new THREE.IcosahedronGeometry(1, 0);
  {
    const all = [...L.trees];
    for (const s of L.scenery) all.push([s.x + s.r * 0.3, s.y, s.z, s.r * 0.3, true]);
    const trunks = new THREE.InstancedMesh(trunkGeo, mats.trunk, all.length);
    const leaves = new THREE.InstancedMesh(blobGeo, mats.leaves, all.length);
    const leaves2 = new THREE.InstancedMesh(blobGeo, mats.leaves2, all.length);
    const m4 = new THREE.Matrix4(), part = new THREE.Matrix4(), base = new THREE.Matrix4();
    all.forEach(([x, y, z, s, scenic], i) => {
      base.makeTranslation(x, y, z).scale(new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m4.multiplyMatrices(base, part.makeTranslation(0, 0.8, 0)));
      leaves.setMatrixAt(i, m4.multiplyMatrices(base, part.makeTranslation(0, 2.1, 0).scale(new THREE.Vector3(1.15, 1, 1.15))));
      leaves2.setMatrixAt(i, m4.multiplyMatrices(base, part.makeRotationY(0.6).setPosition(0.25, 2.75, 0.1).scale(new THREE.Vector3(0.7, 0.7, 0.7))));
      if (!scenic) physics.add(new CylCollider({ pos: new THREE.Vector3(x, y + 0.9 * s, z), radius: 0.28 * s, height: 1.8 * s, mat: 'wood' }));
    });
    level.add(trunks, leaves, leaves2);
  }

  // ---------- flowers + grass tufts (instanced, decorative) ----------
  {
    const r = rng(42);
    const spots = [];
    for (const isl of L.islands) {
      if (isl.column) continue;
      const n = Math.round(isl.r * 4);
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (isl.r - 0.6);
        spots.push([isl.x + Math.cos(a) * d, isl.y, isl.z + Math.sin(a) * d, r()]);
      }
    }
    const flowers = spots.filter((_, i) => i % 3 === 0);
    const tufts = spots.filter((_, i) => i % 3 !== 0);
    // flat daisies lying on the grass: 5 petals + a yellow middle
    const petalGeo = new THREE.CircleGeometry(0.16, 5);
    petalGeo.rotateX(-Math.PI / 2);
    petalGeo.translate(0, 0.03, 0);
    const midGeo = new THREE.CircleGeometry(0.06, 6);
    midGeo.rotateX(-Math.PI / 2);
    midGeo.translate(0, 0.04, 0);
    const petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshLambertMaterial(), flowers.length);
    const mids = new THREE.InstancedMesh(midGeo, new THREE.MeshLambertMaterial({ color: 0xffc21a }), flowers.length);
    const colors = [0xffffff, 0xff9fd0, 0xb9a3ff, 0xffffff];
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    flowers.forEach((p, i) => {
      m4.makeRotationY(p[3] * 6).setPosition(p[0], p[1], p[2]);
      petals.setMatrixAt(i, m4);
      mids.setMatrixAt(i, m4);
      petals.setColorAt(i, col.setHex(colors[i % colors.length]));
    });
    level.add(petals, mids);
    // grass tufts: three thin blades
    const blade = new THREE.ConeGeometry(0.05, 0.32, 3);
    blade.translate(0, 0.16, 0);
    const tuftGeo = mergeBlades(blade);
    const tuftMesh = new THREE.InstancedMesh(tuftGeo, new THREE.MeshLambertMaterial({ color: 0x4aa82c, flatShading: true }), tufts.length);
    tufts.forEach((p, i) => {
      const s = 0.8 + p[3] * 0.6;
      m4.makeRotationY(p[3] * 6).scale(new THREE.Vector3(s, s, s)).setPosition(p[0], p[1], p[2]);
      tuftMesh.setMatrixAt(i, m4);
    });
    level.add(tuftMesh);
  }

  // ---------- distant scenery ----------
  for (const s of L.scenery) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r * 0.95, 0.8, 12), [mats.grassSide, mats.grass, mats.rock]);
    const under = new THREE.Mesh(new THREE.ConeGeometry(s.r * 0.95, s.r * 1.4, 10), mats.rock);
    under.rotation.x = Math.PI;
    under.position.y = -0.4 - s.r * 0.7;
    g.add(top, under);
    level.add(g);
  }

  // ---------- sky ----------
  {
    const skyGeo = new THREE.SphereGeometry(400, 24, 16);
    const cols = [];
    const top = new THREE.Color(0x3d8be6), mid = new THREE.Color(0xbfe6ff), low = new THREE.Color(0xfff1d6);
    const p = skyGeo.attributes.position;
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const h = p.getY(i) / 400;
      if (h > 0) c.copy(mid).lerp(top, Math.pow(h, 0.6));
      else c.copy(mid).lerp(low, Math.min(1, -h * 3));
      cols.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    scene.add(sky);
    out.sky = sky;
  }

  // ---------- clouds (every puff is one instance of a single mesh) ----------
  {
    const r = rng(7);
    const puffs = [];
    const makeCloud = (x, y, z, scale, speed) => {
      const cloud = { x, y, z, speed, puffs: [] };
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        cloud.puffs.push({
          ox: ((i - n / 2) * 1.3 + r() * 0.6) * scale, oy: r() * 0.6 * scale, oz: (r() - 0.5) * 1.2 * scale,
          s: (1 + r() * 0.9) * scale, idx: puffs.length,
        });
        puffs.push(0);
      }
      out.clouds.push(cloud);
    };
    // a sea of clouds below
    for (let i = 0; i < 34; i++) makeCloud((r() - 0.5) * 150, -20 - r() * 10, 25 - r() * 180, 1.6 + r() * 1.8, 0.3 + r() * 0.4);
    // and a few up high
    for (let i = 0; i < 10; i++) makeCloud((r() < 0.5 ? -1 : 1) * (18 + r() * 30), 10 + r() * 14, 10 - r() * 150, 1.6 + r() * 1.6, 0.5 + r() * 0.5);
    const inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mats.cloud, puffs.length);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.frustumCulled = false;
    out.cloudMesh = inst;
    level.add(inst);
    placeClouds(out);
  }

  return out;
}

function mergeBlades(blade) {
  // three tilted blades in one geometry
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const g = blade.clone();
    g.rotateZ((k - 1) * 0.35);
    g.rotateY(k * 2.1);
    g.translate((k - 1) * 0.05, 0, 0);
    parts.push(g);
  }
  const pos = [], norm = [];
  for (const g of parts) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    norm.push(...ng.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  return out;
}

function addThistles(group, w, d, mat) {
  const r = rng(99);
  const n = Math.round(w * d * 1.6);
  const geo = new THREE.ConeGeometry(0.12, 0.45, 4);
  geo.translate(0, 0.2, 0);
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    e.set((r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6);
    q.setFromEuler(e);
    const s = 0.7 + r() * 0.6;
    m4.compose(new THREE.Vector3((r() - 0.5) * (w - 0.2), 0, (r() - 0.5) * (d - 0.2)), q, new THREE.Vector3(s, s, s));
    inst.setMatrixAt(i, m4);
  }
  group.add(inst);
}

const _cm = new THREE.Matrix4();
function placeClouds(world) {
  const inst = world.cloudMesh;
  for (const c of world.clouds) {
    for (const p of c.puffs) {
      _cm.makeScale(p.s, p.s, p.s).setPosition(c.x + p.ox, c.y + p.oy, c.z + p.oz);
      inst.setMatrixAt(p.idx, _cm);
    }
  }
  inst.instanceMatrix.needsUpdate = true;
}

export function updateWorld(world, dt, time) {
  for (const c of world.clouds) {
    c.x += c.speed * dt;
    if (c.x > 80) c.x = -80;
  }
  placeClouds(world);
  for (const p of world.pads) {
    p.squash = Math.max(0, p.squash - dt * 3);
    const s = p.squash;
    p.top.scale.set(1 + s * 0.25, 1 - s * 0.6 + Math.sin(s * 20) * s * 0.3, 1 + s * 0.25);
  }
}

// Moving platforms are stepped in the fixed physics loop so things riding them stay glued.
export function stepMovers(world, dt, time) {
  for (const mv of world.movers) {
    const { amp, period, phase } = mv.data;
    const off = Math.sin((time / period) * Math.PI * 2 + phase) * amp;
    const nx = mv.base.x + mv.axis.x * off, ny = mv.base.y + mv.axis.y * off, nz = mv.base.z + mv.axis.z * off;
    mv.col.vel.set((nx - mv.col.pos.x) / dt, (ny - mv.col.pos.y) / dt, (nz - mv.col.pos.z) / dt);
    mv.col.pos.set(nx, ny, nz);
    mv.mesh.position.copy(mv.col.pos);
  }
}
