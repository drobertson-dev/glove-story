// Builds a level's world from its data: visual meshes plus matching colliders,
// themed sky/clouds/scenery, and the moving parts (platforms, gates, crumbling
// floors, spike traps, conveyors, bumpers, water).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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

const flat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

export function buildWorld(scene, physics, T, L, theme) {
  const mats = {
    grass: lambert(T.grass),
    grassSide: lambert(T.grassSide),
    rock: lambert(T.rock),
    stone: lambert(T.stone),
    flags: lambert(T.flags),
    checker: lambert(T.checker),
    stripes: lambert(T.stripes),
    wood: lambert(T.wood),
    crate: lambert(T.crate),
    thistle: lambert(T.thistle),
    metal: lambert(T.metal),
    pad: lambert(T.pad),
    padSide: new THREE.MeshLambertMaterial({ color: 0xc72a40 }),
    gold: flat(0xffd23f, { emissive: 0x5a3a00 }),
    dark: flat(0x2a2735),
    spike: flat(theme.night ? 0xb8b4cc : 0x9b59c9),
    cloud: new THREE.MeshLambertMaterial({ color: theme.clouds.color, flatShading: true, emissive: theme.clouds.emissive, emissiveIntensity: 0.35 }),
  };

  // which textures make up each kind of surface
  const SURF = {
    grass: { top: mats.grass, side: mats.grassSide, body: mats.rock, slab: true },
    stone: { top: mats.grass, side: mats.grassSide, body: mats.stone, slab: true },
    flags: { top: mats.flags, side: mats.stone, body: mats.stone, slab: true },
    checker: { top: mats.checker, side: mats.grassSide, body: mats.rock, slab: true },
    thistle: { top: mats.thistle, side: mats.thistle, body: mats.rock, slab: true },
    wood: { all: mats.wood },
    metal: { all: mats.metal },
    stripes: { all: mats.stripes },
    stoneblock: { all: mats.stone },
  };

  const level = new THREE.Group();
  scene.add(level);
  const out = {
    group: level, physics, movers: [], crates: [], pads: [], clouds: [], belts: [], bumpers: [],
    switches: [], gates: [], crumbles: [], spikes: [], wheels: [], floaters: [], water: null,
  };

  // a box with an optional grassy "slab" on top, positioned with its top at y
  function surfaceBox(w, h, d, matName) {
    const S = SURF[matName] || SURF.grass;
    const g = new THREE.Group();
    if (S.all) {
      const m = new THREE.Mesh(tiledBox(w, h, d, 2, 1), S.all);
      m.position.y = -h / 2;
      g.add(m);
      return g;
    }
    const slabH = Math.min(0.5, h);
    const slab = new THREE.Mesh(tiledBox(w, slabH, d, 2, 0.5), [S.side, S.side, S.top, S.body, S.side, S.side]);
    slab.position.y = -slabH / 2;
    g.add(slab);
    if (h > slabH) {
      const body = new THREE.Mesh(tiledBox(w * 0.98, h - slabH, d * 0.98, 2, 2), S.body);
      body.position.y = -slabH - (h - slabH) / 2;
      g.add(body);
    }
    return g;
  }

  // ---------- islands ----------
  for (const isl of L.islands || []) {
    const { x, y, z, r } = isl;
    const S = SURF[isl.mat || 'grass'];
    const segs = Math.max(10, Math.min(28, Math.round(r * 3.5)));
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const slabH = 0.5;
    const slabGeo = new THREE.CylinderGeometry(r, r * 0.98, slabH, segs, 1, false);
    const uv = slabGeo.attributes.uv;
    const circ = 2 * Math.PI * r;
    const sideCount = (segs + 1) * 2;
    for (let i = 0; i < uv.count; i++) {
      if (i < sideCount) uv.setXY(i, (uv.getX(i) * circ) / 0.5, uv.getY(i));
      else uv.setXY(i, uv.getX(i) * r, uv.getY(i) * r);
    }
    const slab = new THREE.Mesh(slabGeo, [S.side, S.top, S.body]);
    slab.position.y = -slabH / 2;
    g.add(slab);

    const depth = isl.depth ?? Math.max(2.5, r * 0.85);
    const bottomR = isl.column ? r * (isl.taper ?? 0.8) : r * 0.28;
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
    const underMesh = new THREE.Mesh(under, isl.mat === 'flags' ? mats.stone : mats.rock);
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
    physics.add(new CylCollider({ pos: new THREE.Vector3(x, y - colH / 2, z), radius: r, height: colH, mat: isl.mat || 'grass' }));
  }

  // ---------- boxes ----------
  for (const b of L.boxes || []) {
    const { x, y, z, w, d, h, mat } = b;
    const g = surfaceBox(w, h, d, mat);
    g.position.set(x, y, z);
    if (b.rotY) g.rotation.y = b.rotY;
    if (mat === 'wood' && !b.noPosts) {
      const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.9, 6);
      const postMat = flat(0x8a5a2e);
      const along = d >= w;
      for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
        const p = new THREE.Mesh(postGeo, postMat);
        if (along) p.position.set(s1 * (w / 2 - 0.08), 0.25, s2 * (d / 2 - 0.3));
        else p.position.set(s2 * (w / 2 - 0.3), 0.25, s1 * (d / 2 - 0.08));
        g.add(p);
      }
    }
    if (mat === 'thistle') addThistles(g, w, d, mats.spike);
    level.add(g);
    const quat = b.rotY ? new THREE.Quaternion().setFromAxisAngle(UP, b.rotY) : undefined;
    physics.add(new BoxCollider({ pos: new THREE.Vector3(x, y - h / 2, z), size: [w, h, d], quat, mat, hurt: !!b.hurt }));
  }

  // ---------- ramps ----------
  for (const rp of L.ramps || []) {
    const p0 = new THREE.Vector3(...rp.from), p1 = new THREE.Vector3(...rp.to);
    const Z = p1.clone().sub(p0);
    const len = Z.length();
    Z.normalize();
    const X = new THREE.Vector3().crossVectors(UP, Z).normalize();
    const Y = new THREE.Vector3().crossVectors(Z, X).normalize();
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    const th = 0.8;
    const center = p0.clone().add(p1).multiplyScalar(0.5).addScaledVector(Y, -th / 2);
    const S = SURF[rp.mat || 'stone'];
    const sideM = S.all || mats.stone, topM = S.all || S.top;
    const m = new THREE.Mesh(tiledBox(rp.w, th, len, 2, 0.8), [sideM, sideM, topM, mats.rock, sideM, sideM]);
    m.position.copy(center);
    m.quaternion.copy(quat);
    level.add(m);
    physics.add(new BoxCollider({ pos: center, size: [rp.w, th, len], quat, mat: 'grass' }));
  }

  // ---------- bounce pads ----------
  for (const p of L.pads || []) {
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    const padH = 0.3;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 1.08, padH, 20), [mats.padSide, mats.pad, mats.padSide]);
    top.position.y = 0.08 - padH / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r * 1.05, 0.08, 6, 20), mats.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    g.add(top, ring);
    level.add(g);
    const col = physics.add(new CylCollider({ pos: new THREE.Vector3(p.x, p.y + 0.08 - padH / 2, p.z), radius: p.r, height: padH, mat: 'pad' }));
    col.pad = p;
    out.pads.push({ data: p, col, mesh: g, top, squash: 0 });
  }

  // ---------- crates ----------
  for (const c of L.crates || []) {
    const m = new THREE.Mesh(tiledBox(c.size, c.size, c.size, c.size, c.size), mats.crate);
    m.position.set(c.x, c.y, c.z);
    level.add(m);
    const col = physics.add(new BoxCollider({ pos: m.position.clone(), size: [c.size, c.size, c.size], mat: 'crate', crate: true }));
    out.crates.push({ mesh: m, col, alive: true });
  }

  // ---------- moving platforms (back-and-forth or round in a circle) ----------
  for (const mv of L.movers || []) {
    const g = surfaceBox(mv.w, mv.h, mv.d, mv.mat || 'metal');
    const base = new THREE.Vector3(mv.x, mv.y - mv.h / 2, mv.z);
    g.position.set(mv.x, mv.y, mv.z);
    level.add(g);
    const col = physics.add(new BoxCollider({ pos: base.clone(), size: [mv.w, mv.h, mv.d], mat: mv.mat || 'metal' }));
    col.isMover = true;
    out.movers.push({ data: mv, mesh: g, col, base, axis: new THREE.Vector3(...(mv.axis || [0, 0, 1])), top: mv.h / 2 });
  }

  // ---------- ferris wheels (decoration that turns with its gondolas) ----------
  for (const wh of L.wheels || []) {
    const g = new THREE.Group();
    g.position.set(wh.x, wh.y, wh.z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(wh.r, 0.16, 6, 32), mats.gold);
    const rim2 = rim.clone();
    rim.position.z = 0.9; rim2.position.z = -0.9;
    const spokes = new THREE.Group();
    const spokeGeo = new THREE.BoxGeometry(0.12, wh.r * 2, 0.12);
    for (let i = 0; i < 6; i++) {
      for (const zz of [0.9, -0.9]) {
        const s = new THREE.Mesh(spokeGeo, mats.stripes);
        s.rotation.z = (i / 6) * Math.PI;
        s.position.z = zz;
        spokes.add(s);
      }
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.2, 12), mats.gold);
    hub.rotation.x = Math.PI / 2;
    const turning = new THREE.Group();
    turning.add(rim, rim2, spokes, hub);
    // legs
    const legGeo = new THREE.BoxGeometry(0.3, wh.y + 3, 0.3);
    for (const sx of [-1, 1]) for (const sz of [-1.3, 1.3]) {
      const leg = new THREE.Mesh(legGeo, mats.stripes);
      leg.position.set(sx * (wh.y + 3) * 0.28, -(wh.y + 3) / 2 + 0.2, sz);
      leg.rotation.z = -sx * 0.28;
      g.add(leg);
    }
    g.add(turning);
    level.add(g);
    out.wheels.push({ data: wh, turning });
  }

  // ---------- conveyor belts ----------
  for (const c of L.conveyors || []) {
    const tex = T.belt.clone();
    tex.needsUpdate = true;
    const along = Math.abs(c.belt[1]) >= Math.abs(c.belt[0]);
    // chevrons are drawn pointing -z; flip them for belts that run toward +z
    tex.rotation = along ? (c.belt[1] > 0 ? Math.PI : 0) : Math.PI / 2;
    tex.center.set(0.5, 0.5);
    const topMat = new THREE.MeshLambertMaterial({ map: tex });
    const m = new THREE.Mesh(tiledBox(c.w, c.h, c.d, 1, 1), [mats.dark, mats.dark, topMat, mats.dark, mats.dark, mats.dark]);
    m.position.set(c.x, c.y - c.h / 2, c.z);
    level.add(m);
    // little rollers at each end
    const rollerGeo = new THREE.CylinderGeometry(c.h * 0.55, c.h * 0.55, along ? c.w + 0.1 : c.d + 0.1, 10);
    rollerGeo.rotateZ(Math.PI / 2);
    if (!along) rollerGeo.rotateY(Math.PI / 2);
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(rollerGeo, mats.gold);
      if (along) r.position.set(c.x, c.y - c.h / 2, c.z + s * c.d / 2);
      else r.position.set(c.x + s * c.w / 2, c.y - c.h / 2, c.z);
      level.add(r);
    }
    const col = physics.add(new BoxCollider({ pos: new THREE.Vector3(c.x, c.y - c.h / 2, c.z), size: [c.w, c.h, c.d], mat: 'belt' }));
    col.belt = new THREE.Vector3(c.belt[0], 0, c.belt[1]);
    // scroll so the chevrons travel with the belt (texture v runs toward the arrow tips)
    out.belts.push({ tex, du: along ? 0 : -Math.abs(c.belt[0]), dv: along ? -Math.abs(c.belt[1]) : 0 });
  }

  // ---------- pinball bumpers ----------
  for (const bp of L.bumpers || []) {
    const r = bp.r || 0.7;
    const g = new THREE.Group();
    g.position.set(bp.x, bp.y, bp.z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, 1.0, 16), mats.stripes);
    body.position.y = 0.5;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.22, 16), mats.gold);
    cap.position.y = 1.08;
    const light = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff6fb5 }));
    light.position.y = 1.2;
    light.scale.y = 0.6;
    g.add(body, cap, light);
    level.add(g);
    const col = physics.add(new CylCollider({ pos: new THREE.Vector3(bp.x, bp.y + 0.6, bp.z), radius: r * 1.1, height: 1.2, mat: 'bumper' }));
    col.bumper = bp.power || 11;
    out.bumpers.push({ col, mesh: g, light, squash: 0, cool: 0 });
  }

  // ---------- fences (keep the ball from rolling off) ----------
  const fenceStyle = theme.fence;
  const fenceMats = {
    wood: [flat(0x8a5a2e), flat(0xb97a3f)],
    rope: [flat(0x9a6a3a), flat(0xe8d0a0)],
    candy: [mats.stripes, flat(0xffd23f)],
    iron: [flat(0x2b2735), flat(0x3a3548)],
  }[fenceStyle] || [flat(0x8a5a2e), flat(0xb97a3f)];
  // every post and rail of every fence goes into two instanced meshes
  const postXf = [], railXf = [];
  const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fs = new THREE.Vector3(), _fp = new THREE.Vector3();
  const fenceSeg = (x0, z0, x1, z1, y, h = 0.85) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz);
    _fq.setFromAxisAngle(UP, ang);
    const n = Math.max(2, Math.round(len / 1.2) + 1);
    const postH = fenceStyle === 'iron' ? h + 0.25 : h;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      _fp.set(x0 + dx * t, y, z0 + dz * t);
      postXf.push(_fm.compose(_fp, _fq, _fs.set(1, postH, 1)).clone());
    }
    for (const ry of [h * 0.45, h * 0.85]) {
      _fp.set((x0 + x1) / 2, y + ry, (z0 + z1) / 2);
      railXf.push(_fm.compose(_fp, _fq, _fs.set(1, 1, len)).clone());
    }
    const quat = new THREE.Quaternion().setFromAxisAngle(UP, ang);
    physics.add(new BoxCollider({ pos: new THREE.Vector3((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2), size: [0.25, h, len], quat, mat: 'fence', fence: true }));
  };
  for (const f of L.fences || []) fenceSeg(f.from[0], f.from[1], f.to[0], f.to[1], f.y, f.h);
  for (const ring of L.fenceRings || []) {
    // fence around a round platform, leaving gaps where the paths come in
    const n = ring.segs || 16;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
      const gapped = (ring.gaps || []).some((gA) => Math.abs(Math.atan2(Math.sin(am - gA), Math.cos(am - gA))) < (ring.gapWidth || 0.35));
      if (gapped) continue;
      const R = ring.r - 0.25;
      fenceSeg(ring.x + Math.sin(a0) * R, ring.z + Math.cos(a0) * R, ring.x + Math.sin(a1) * R, ring.z + Math.cos(a1) * R, ring.y, ring.h);
    }
  }
  if (postXf.length) {
    const postGeo = fenceStyle === 'iron' ? new THREE.ConeGeometry(0.07, 1, 4) : new THREE.CylinderGeometry(0.08, 0.09, 1, 6);
    postGeo.translate(0, 0.5, 0);
    const posts = new THREE.InstancedMesh(postGeo, fenceMats[0], postXf.length);
    postXf.forEach((m, i) => posts.setMatrixAt(i, m));
    const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.09, 1), fenceMats[1], railXf.length);
    railXf.forEach((m, i) => rails.setMatrixAt(i, m));
    level.add(posts, rails);
  }

  // ---------- ball switches and the gates/bridges they move ----------
  for (const sw of L.switches || []) {
    const g = new THREE.Group();
    g.position.set(sw.x, sw.y, sw.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.16, 20), sw.heavy ? mats.dark : flat(0x6f6a80));
    base.position.y = 0.04;
    const btnMat = new THREE.MeshLambertMaterial({ color: sw.heavy ? 0x8a4dff : 0xff4d6d, emissive: sw.heavy ? 0x3a1080 : 0x701020 });
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.18, 20), btnMat);
    button.position.y = 0.16;
    // a little target ring so it reads as "put the ball here"
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 4, 20), mats.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.26;
    g.add(base, button, ring);
    if (sw.heavy) {
      // strongman tower with a bell on top
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5, 0.25), mats.stripes);
      tower.position.set(0, 2.6, -1.2);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.gold);
      bell.position.set(0, 5.2, -1.2);
      const puck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), flat(0xff4d6d));
      puck.position.set(0, 0.5, -1.2);
      g.add(tower, bell, puck);
      g.userData.puck = puck;
    }
    level.add(g);
    const col = physics.add(new CylCollider({ pos: new THREE.Vector3(sw.x, sw.y + 0.25 - 0.15, sw.z), radius: 0.95, height: 0.3, mat: 'switch' }));
    out.switches.push({ data: sw, col, group: g, button, btnMat, pressed: false, anim: 0 });
  }
  for (const gt of L.gates || []) {
    const mesh = gt.mat === 'bars'
      ? new THREE.Mesh(new THREE.BoxGeometry(gt.w, gt.h, gt.d), new THREE.MeshLambertMaterial({ map: barsTex(T, gt), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }))
      : surfaceBox(gt.w, gt.h, gt.d, gt.mat || 'stoneblock');
    const center = new THREE.Vector3(gt.x, gt.y - gt.h / 2, gt.z);
    if (gt.mat === 'bars') mesh.position.copy(center);
    else mesh.position.set(gt.x, gt.y, gt.z);
    level.add(mesh);
    const col = physics.add(new BoxCollider({ pos: center.clone(), size: [gt.w, gt.h, gt.d], mat: gt.mat || 'stone' }));
    col.isMover = true;
    out.gates.push({
      data: gt, mesh, col, from: center.clone(), to: center.clone().add(new THREE.Vector3(...gt.move)),
      t: 0, active: false, meshOffset: gt.mat === 'bars' ? 0 : gt.h / 2,
    });
  }

  // ---------- crumbling platforms ----------
  for (const c of L.crumbles || []) {
    const g = surfaceBox(c.w, c.h, c.d, c.mat || 'flags');
    g.position.set(c.x, c.y, c.z);
    level.add(g);
    const center = new THREE.Vector3(c.x, c.y - c.h / 2, c.z);
    const col = physics.add(new BoxCollider({ pos: center.clone(), size: [c.w, c.h, c.d], mat: c.mat || 'flags' }));
    const cr = { data: c, mesh: g, col, state: 'idle', t: 0, home: new THREE.Vector3(c.x, c.y, c.z), vy: 0 };
    col.crumble = cr;
    out.crumbles.push(cr);
  }

  // ---------- pop-up spike traps ----------
  for (const sp of L.spikes || []) {
    const g = surfaceBox(sp.w, 0.3, sp.d, 'flags');
    g.position.set(sp.x, sp.y, sp.z);
    level.add(g);
    const n = Math.max(4, Math.round(sp.w * sp.d * 3));
    const geo = new THREE.ConeGeometry(0.1, 0.55, 4);
    geo.translate(0, 0.27, 0);
    const inst = new THREE.InstancedMesh(geo, flat(0xd8d4e8), n);
    const m4 = new THREE.Matrix4();
    const cols = Math.max(2, Math.round(sp.w * 1.6)), rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const cx = (i % cols + 0.5) / cols - 0.5, cz = (Math.floor(i / cols) + 0.5) / rows - 0.5;
      m4.makeTranslation(cx * (sp.w - 0.2), 0, cz * (sp.d - 0.2));
      inst.setMatrixAt(i, m4);
    }
    const spikes = new THREE.Group();
    spikes.add(inst);
    spikes.position.set(sp.x, sp.y - 0.6, sp.z);
    level.add(spikes);
    const col = physics.add(new BoxCollider({ pos: new THREE.Vector3(sp.x, sp.y - 0.15, sp.z), size: [sp.w, 0.3, sp.d], mat: 'flags' }));
    col.spiky = true;
    out.spikes.push({ data: sp, col, spikes, base: sp.y, h: 0 });
  }

  // ---------- water ----------
  if (L.water) {
    const geo = new THREE.PlaneGeometry(520, 520, 90, 90);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhongMaterial({
      color: theme.water || 0x2fb8d8, transparent: true, opacity: 0.78, shininess: 90, specular: 0xbff4ff, flatShading: true,
    });
    const uniforms = { uTime: { value: 0 } };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        transformed.y += sin(wp.x * 0.35 + uTime * 1.3) * 0.09 + cos(wp.z * 0.28 + uTime * 1.05) * 0.09;`,
      );
    };
    const water = new THREE.Mesh(geo, mat);
    water.position.y = L.water.y;
    water.renderOrder = 3;
    level.add(water);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), lambert(T.seabed));
    T.seabed.repeat.set(130, 130);
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = L.water.floor;
    level.add(bed);
    out.water = { y: L.water.y, mesh: water, uniforms };
  }

  // ---------- trees ----------
  buildTrees(level, physics, L, theme, mats);

  // ---------- ground decoration ----------
  buildDecor(level, L, theme);

  // ---------- props ----------
  for (const p of L.props || []) buildProp(level, physics, p, mats, out);

  // ---------- distant scenery ----------
  for (const s of L.scenery || []) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    if (s.type === 'tower') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r * 1.1, s.h || 30, 10), mats.stone);
      body.position.y = (s.h || 30) / 2 - 10;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(s.r * 1.35, s.r * 2.4, 10), flat(0x3a2a5a));
      roof.position.y = (s.h || 30) - 10 + s.r * 1.2;
      const win = new THREE.Mesh(new THREE.BoxGeometry(s.r * 0.4, s.r * 0.6, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
      win.position.set(0, (s.h || 30) - 13, s.r * 1.02);
      g.add(body, roof, win);
    } else {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r * 0.95, 0.8, 12), [mats.grassSide, mats.grass, mats.rock]);
      const under = new THREE.Mesh(new THREE.ConeGeometry(s.r * 0.95, s.r * 1.4, 10), mats.rock);
      under.rotation.x = Math.PI;
      under.position.y = -0.4 - s.r * 0.7;
      g.add(top, under);
    }
    level.add(g);
  }

  // ---------- sky ----------
  {
    const skyGeo = new THREE.SphereGeometry(400, 24, 16);
    const cols = [];
    const top = new THREE.Color(theme.sky[0]), mid = new THREE.Color(theme.sky[1]), low = new THREE.Color(theme.sky[2]);
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
    if (theme.night) {
      // stars and a big friendly moon
      const r = rng(5);
      const pts = [];
      for (let i = 0; i < 500; i++) {
        const a = r() * Math.PI * 2, e = 0.08 + r() * 1.4;
        pts.push(Math.cos(a) * Math.cos(e) * 380, Math.sin(e) * 380, Math.sin(a) * Math.cos(e) * 380);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
      scene.add(stars);
      const moon = new THREE.Mesh(new THREE.CircleGeometry(26, 32), new THREE.MeshBasicMaterial({ color: 0xfff4c8, fog: false }));
      moon.position.set(-120, 150, -300);
      moon.lookAt(0, 0, 0);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(44, 32), new THREE.MeshBasicMaterial({ color: 0x8a7ad8, transparent: true, opacity: 0.25, fog: false }));
      glow.position.copy(moon.position).multiplyScalar(1.01);
      glow.lookAt(0, 0, 0);
      scene.add(glow, moon);
    }
  }

  // ---------- clouds (every puff is one instance of a single mesh) ----------
  {
    const r = rng(7);
    let puffs = 0;
    const makeCloud = (x, y, z, scale, speed) => {
      const cloud = { x, y, z, speed, puffs: [] };
      const n = 3 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        cloud.puffs.push({
          ox: ((i - n / 2) * 1.3 + r() * 0.6) * scale, oy: r() * 0.6 * scale, oz: (r() - 0.5) * 1.2 * scale,
          s: (1 + r() * 0.9) * scale, idx: puffs++,
        });
      }
      out.clouds.push(cloud);
    };
    const span = L.span || 180;
    for (let i = 0; i < theme.clouds.below; i++) makeCloud((r() - 0.5) * 150, -20 - r() * 10, 25 - r() * span, 1.6 + r() * 1.8, 0.3 + r() * 0.4);
    for (let i = 0; i < theme.clouds.above; i++) makeCloud((r() < 0.5 ? -1 : 1) * (18 + r() * 30), 10 + r() * 14, 10 - r() * span * 0.85, 1.6 + r() * 1.6, 0.5 + r() * 0.5);
    const inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mats.cloud, Math.max(1, puffs));
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.frustumCulled = false;
    if (!puffs) inst.count = 0;
    out.cloudMesh = inst;
    level.add(inst);
    placeClouds(out);
  }

  return out;
}

function barsTex(T, gt) {
  const t = T.bars.clone();
  t.needsUpdate = true;
  t.repeat.set(Math.max(1, gt.w / 1.2), Math.max(1, gt.h / 1.2));
  return t;
}

// ---------------------------------------------------------------- trees
function buildTrees(level, physics, L, theme, mats) {
  const list = [...(L.trees || [])];
  for (const s of L.scenery || []) if (s.type !== 'tower') list.push([s.x + s.r * 0.3, s.y, s.z, s.r * 0.3, true]);
  if (!list.length) return;
  const style = theme.trees;
  // each style is a set of (geometry, material) parts in tree-local space, scale 1
  let parts;
  if (style === 'palm') {
    const trunkParts = [];
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.CylinderGeometry(0.15 - i * 0.012, 0.19 - i * 0.012, 0.62, 7);
      seg.translate(Math.pow(i / 6, 2) * 0.9, 0.31 + i * 0.58, 0);
      trunkParts.push(seg);
    }
    const trunk = mergeGeometries(trunkParts);
    const fronds = [];
    for (let i = 0; i < 7; i++) {
      const f = new THREE.ConeGeometry(0.42, 2.2, 4);
      f.scale(1, 1, 0.22);
      f.translate(0, 1.1, 0);
      f.rotateZ(-1.9 + (i % 2) * 0.25);
      f.rotateY((i / 7) * Math.PI * 2);
      f.translate(0.9, 3.55, 0);
      fronds.push(f);
    }
    const nuts = [];
    for (let i = 0; i < 3; i++) {
      const n = new THREE.SphereGeometry(0.16, 6, 5);
      n.translate(0.9 + Math.cos(i * 2.1) * 0.2, 3.3, Math.sin(i * 2.1) * 0.2);
      nuts.push(n);
    }
    parts = [[trunk, flat(0xa0703c)], [mergeGeometries(fronds), flat(0x3fb85a)], [mergeGeometries(nuts), flat(0x6b4423)]];
  } else if (style === 'candy') {
    const pole = new THREE.CylinderGeometry(0.1, 0.1, 2.4, 8);
    pole.translate(0, 1.2, 0);
    const pop = new THREE.SphereGeometry(0.85, 14, 10);
    pop.scale(1, 1, 0.35);
    pop.translate(0, 2.9, 0);
    const swirl = new THREE.TorusGeometry(0.55, 0.12, 6, 18);
    swirl.translate(0, 2.9, 0.3);
    parts = [[pole, flat(0xfff4e0)], [pop, flat(0xff6fb5), true], [swirl, flat(0xffffff)]];
  } else if (style === 'dead') {
    const tr = [];
    const t0 = new THREE.CylinderGeometry(0.12, 0.26, 2.6, 6);
    t0.translate(0, 1.3, 0);
    tr.push(t0);
    const br = [[0.6, 2.0, 0.9, 0.0], [-0.7, 2.3, -0.8, 1.5], [0.2, 2.6, 0.6, 3.0], [-0.3, 1.5, -1.0, 4.2]];
    for (const [bx, by, rz, ry] of br) {
      const b = new THREE.CylinderGeometry(0.04, 0.09, 1.3, 5);
      b.translate(0, 0.65, 0);
      b.rotateZ(rz);
      b.rotateY(ry);
      b.translate(bx * 0.2, by, 0);
      tr.push(b);
    }
    parts = [[mergeGeometries(tr), flat(0x3b3040)]];
  } else {
    const trunk = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6);
    trunk.translate(0, 0.8, 0);
    const blob = new THREE.IcosahedronGeometry(1, 0);
    const b1 = blob.clone().scale(1.15, 1, 1.15).translate(0, 2.1, 0);
    const b2 = blob.clone().scale(0.7, 0.7, 0.7).rotateY(0.6).translate(0.25, 2.75, 0.1);
    parts = [[trunk, flat(0x8a5a2e)], [b1, flat(0x3fae4a)], [b2, flat(0x5cc95a)]];
  }
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  const candyCols = [0xff6fb5, 0x6fd6ff, 0xffd23f, 0xa98bff];
  for (const [geo, mat, tinted] of parts) {
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, y, z, s], i) => {
      m4.makeRotationY((x * 7 + z * 3) % 6.28).scale(new THREE.Vector3(s, s, s)).setPosition(x, y, z);
      inst.setMatrixAt(i, m4);
      if (tinted) inst.setColorAt(i, col.setHex(candyCols[i % candyCols.length]));
    });
    level.add(inst);
  }
  for (const [x, y, z, s, scenic] of list) {
    if (!scenic) physics.add(new CylCollider({ pos: new THREE.Vector3(x, y + 0.9 * s, z), radius: 0.28 * s, height: 1.8 * s, mat: 'wood' }));
  }
}

// ---------------------------------------------------------------- ground decoration
function buildDecor(level, L, theme) {
  const r = rng(42);
  const spots = [];
  for (const isl of L.islands || []) {
    if (isl.noDecor || (isl.r < 2.2)) continue;
    const n = Math.round(isl.r * 4);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (isl.r - 0.6);
      spots.push([isl.x + Math.cos(a) * d, isl.y, isl.z + Math.sin(a) * d, r()]);
    }
  }
  if (!spots.length) return;
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  const style = theme.decor;
  const flowers = spots.filter((_, i) => i % 3 === 0);
  const tufts = spots.filter((_, i) => i % 3 !== 0);

  if (style === 'flowers' || style === 'shells' || style === 'confetti') {
    const isShell = style === 'shells';
    const petalGeo = isShell ? starGeo(0.17) : new THREE.CircleGeometry(style === 'confetti' ? 0.09 : 0.16, style === 'confetti' ? 4 : 5);
    petalGeo.rotateX(-Math.PI / 2);
    petalGeo.translate(0, 0.03, 0);
    const petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), flowers.length * (style === 'confetti' ? 2 : 1));
    const colors = isShell ? [0xff8a5c, 0xffb0c8, 0xffd27a, 0xff6f6f]
      : style === 'confetti' ? [0xff4d6d, 0xffd23f, 0x3d8bff, 0x4cc764, 0xa98bff] : [0xffffff, 0xff9fd0, 0xb9a3ff, 0xffffff];
    let k = 0;
    flowers.forEach((p) => {
      const reps = style === 'confetti' ? 2 : 1;
      for (let j = 0; j < reps; j++) {
        m4.makeRotationY(p[3] * 6 + j).setPosition(p[0] + j * 0.6, p[1], p[2] + j * 0.3);
        petals.setMatrixAt(k, m4);
        petals.setColorAt(k, col.setHex(colors[k % colors.length]));
        k++;
      }
    });
    level.add(petals);
    if (style === 'flowers') {
      const midGeo = new THREE.CircleGeometry(0.06, 6);
      midGeo.rotateX(-Math.PI / 2);
      midGeo.translate(0, 0.04, 0);
      const mids = new THREE.InstancedMesh(midGeo, new THREE.MeshLambertMaterial({ color: 0xffc21a }), flowers.length);
      flowers.forEach((p, i) => { m4.makeRotationY(p[3] * 6).setPosition(p[0], p[1], p[2]); mids.setMatrixAt(i, m4); });
      level.add(mids);
    }
  } else if (style === 'pumpkins') {
    const few = flowers.filter((_, i) => i % 2 === 0);
    const body = new THREE.SphereGeometry(0.26, 10, 8);
    body.scale(1.2, 0.85, 1.2);
    body.translate(0, 0.2, 0);
    const pumpkins = new THREE.InstancedMesh(body, new THREE.MeshLambertMaterial({ color: 0xff8a1c, emissive: 0x7a2a00 }), few.length);
    const stem = new THREE.CylinderGeometry(0.03, 0.05, 0.14, 5);
    stem.translate(0, 0.46, 0);
    const stems = new THREE.InstancedMesh(stem, flat(0x3f6b2a), few.length);
    few.forEach((p, i) => {
      m4.makeRotationY(p[3] * 6).setPosition(p[0], p[1], p[2]);
      pumpkins.setMatrixAt(i, m4);
      stems.setMatrixAt(i, m4);
    });
    level.add(pumpkins, stems);
  }

  if (style !== 'confetti') {
    const blade = new THREE.ConeGeometry(0.05, 0.32, 3);
    blade.translate(0, 0.16, 0);
    const parts = [];
    for (let k = 0; k < 3; k++) {
      const g = blade.clone();
      g.rotateZ((k - 1) * 0.35);
      g.rotateY(k * 2.1);
      g.translate((k - 1) * 0.05, 0, 0);
      parts.push(g);
    }
    const tuftColor = { shells: 0x7ab84a, pumpkins: 0x2f4a2a }[style] || 0x4aa82c;
    const tuftMesh = new THREE.InstancedMesh(mergeGeometries(parts), flat(tuftColor), tufts.length);
    tufts.forEach((p, i) => {
      const s = 0.8 + p[3] * 0.6;
      m4.makeRotationY(p[3] * 6).scale(new THREE.Vector3(s, s, s)).setPosition(p[0], p[1], p[2]);
      tuftMesh.setMatrixAt(i, m4);
    });
    level.add(tuftMesh);
  }
}

function starGeo(r) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, rr = i % 2 ? r * 0.42 : r;
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new THREE.ShapeGeometry(shape);
}

// ---------------------------------------------------------------- props
function buildProp(level, physics, p, mats, out) {
  const g = new THREE.Group();
  g.position.set(p.x, p.y, p.z);
  g.rotation.y = p.rot || 0;
  g.scale.setScalar(p.s || 1);
  const s = p.s || 1;
  switch (p.type) {
    case 'tent': {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2.2, 12, 1, true), mats.stripes);
      body.position.y = 1.1;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 12), mats.stripes);
      roof.position.y = 3.3;
      const flag = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 3), flat(0xffd23f));
      flag.rotation.z = -Math.PI / 2;
      flag.position.set(0.3, 4.6, 0);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 4), mats.dark);
      pole.position.y = 4.6;
      g.add(body, roof, pole, flag);
      if (!p.noCollide) physics.add(new CylCollider({ pos: new THREE.Vector3(p.x, p.y + 1.1 * s, p.z), radius: 2 * s, height: 2.2 * s, mat: 'tent' }));
      break;
    }
    case 'balloons': {
      const cols = [0xff4d6d, 0x3d8bff, 0xffd23f, 0x4cc764];
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshLambertMaterial({ color: cols[(i + (p.c || 0)) % 4], emissive: 0x200810 }));
        b.scale.y = 1.2;
        b.position.set((i - 1) * 0.5, 2.6 + (i % 2) * 0.45, (i % 2) * 0.3);
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2.4, 3), mats.dark);
        str.position.set((i - 1) * 0.25, 1.3, 0);
        str.rotation.z = (i - 1) * -0.2;
        g.add(b, str);
      }
      out.floaters.push({ obj: g, base: p.y, phase: p.x });
      break;
    }
    case 'grave': {
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.25), flat(0x8a85a0));
      stone.position.y = 0.5;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.25, 12), flat(0x8a85a0));
      top.rotation.x = Math.PI / 2; // a disc facing forward; its lower half hides in the slab
      top.position.y = 1.0;
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.27), flat(0x5d5973));
      cross.position.y = 0.7;
      g.add(stone, top, cross);
      g.rotation.z = (p.tilt || 0);
      physics.add(new BoxCollider({ pos: new THREE.Vector3(p.x, p.y + 0.6 * s, p.z), size: [0.8 * s, 1.2 * s, 0.3 * s], quat: new THREE.Quaternion().setFromAxisAngle(UP, p.rot || 0), mat: 'stone' }));
      break;
    }
    case 'lantern': {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6), mats.dark);
      post.position.y = 1.1;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), mats.dark);
      arm.position.set(0.22, 2.15, 0);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), new THREE.MeshBasicMaterial({ color: p.color || 0xffc95a }));
      lamp.position.set(0.45, 1.9, 0);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: p.color || 0xffc95a, transparent: true, opacity: 0.18, depthWrite: false }));
      glow.position.copy(lamp.position);
      g.add(post, arm, lamp, glow);
      break;
    }
    case 'umbrella': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), flat(0xf4f4f4));
      pole.position.y = 1.2;
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.6, 8, 1, true), mats.stripes);
      top.material = top.material.clone();
      top.material.side = THREE.DoubleSide;
      top.position.y = 2.5;
      g.add(pole, top);
      break;
    }
    case 'rock': {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), mats.rock);
      rock.scale.set(1.2, 0.8, 1);
      rock.position.y = 0.4;
      g.add(rock);
      physics.add(new CylCollider({ pos: new THREE.Vector3(p.x, p.y + 0.4 * s, p.z), radius: 0.95 * s, height: 1.3 * s, mat: 'rock' }));
      break;
    }
    case 'coral': {
      const c = flat(p.color || 0xff6f9a);
      for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.9, 5), c);
        b.position.set(Math.cos(i * 1.3) * 0.25, 0.45, Math.sin(i * 1.3) * 0.25);
        b.rotation.set(Math.sin(i) * 0.5, 0, Math.cos(i * 1.7) * 0.5);
        g.add(b);
      }
      break;
    }
    case 'lighthouse': {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 7, 12), mats.stripes);
      tower.position.y = 3.5;
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1, 10), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
      cab.position.y = 7.5;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.2, 10), flat(0xe8394f));
      roof.position.y = 8.6;
      g.add(tower, cab, roof);
      physics.add(new CylCollider({ pos: new THREE.Vector3(p.x, p.y + 3.5 * s, p.z), radius: 1.5 * s, height: 7 * s, mat: 'stone' }));
      break;
    }
  }
  level.add(g);
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

// Per-frame visual updates (things that don't affect physics).
export function updateWorld(world, dt, time) {
  for (const c of world.clouds) {
    c.x += c.speed * dt;
    if (c.x > 80) c.x = -80;
  }
  if (world.clouds.length) placeClouds(world);
  for (const p of world.pads) {
    p.squash = Math.max(0, p.squash - dt * 3);
    const s = p.squash;
    p.top.scale.set(1 + s * 0.25, 1 - s * 0.6 + Math.sin(s * 20) * s * 0.3, 1 + s * 0.25);
  }
  for (const b of world.belts) {
    b.tex.offset.x += b.du * dt;
    b.tex.offset.y += b.dv * dt;
  }
  for (const bp of world.bumpers) {
    bp.squash = Math.max(0, bp.squash - dt * 4);
    const s = bp.squash;
    bp.mesh.scale.set(1 + s * 0.25, 1 - s * 0.15, 1 + s * 0.25);
    bp.light.material.color.setHex(s > 0.05 ? 0xffffff : 0xff6fb5);
  }
  for (const sw of world.switches) {
    const target = sw.pressed ? 1 : 0;
    sw.anim += (target - sw.anim) * Math.min(1, dt * 8);
    sw.button.position.y = 0.16 - sw.anim * 0.12;
    const puck = sw.group.userData.puck;
    if (puck) puck.position.y = 0.5 + Math.sin(Math.min(1, sw.anim) * Math.PI / 2) * 4.3;
  }
  for (const f of world.floaters) f.obj.position.y = f.base + Math.sin(time * 1.4 + f.phase) * 0.25;
  if (world.water) world.water.uniforms.uTime.value = time;
}

const ease = (t) => t * t * (3 - 2 * t);

// Things that move colliders run in the fixed physics step so riders stay glued.
export function stepMovers(world, dt, time) {
  for (const mv of world.movers) {
    const d = mv.data;
    let nx, ny, nz;
    if (d.circle) {
      const a = (time / d.circle.period) * Math.PI * 2 + (d.circle.phase || 0);
      const c = Math.cos(a) * d.circle.r, s = Math.sin(a) * d.circle.r;
      nx = mv.base.x + (d.circle.plane === 'xy' ? c : d.circle.plane === 'xz' ? c : 0);
      ny = mv.base.y + (d.circle.plane === 'xy' ? s : d.circle.plane === 'zy' ? s : 0);
      nz = mv.base.z + (d.circle.plane === 'xz' ? s : d.circle.plane === 'zy' ? c : 0);
    } else {
      const off = Math.sin((time / d.period) * Math.PI * 2 + (d.phase || 0)) * d.amp;
      nx = mv.base.x + mv.axis.x * off; ny = mv.base.y + mv.axis.y * off; nz = mv.base.z + mv.axis.z * off;
    }
    mv.col.vel.set((nx - mv.col.pos.x) / dt, (ny - mv.col.pos.y) / dt, (nz - mv.col.pos.z) / dt);
    mv.col.pos.set(nx, ny, nz);
    mv.mesh.position.set(nx, ny + mv.top, nz);
  }
  for (const wh of world.wheels) {
    wh.turning.rotation.z = (time / wh.data.period) * Math.PI * 2 + (wh.data.phase || 0);
  }
  for (const gt of world.gates) {
    if (!gt.active || gt.t >= 1) { gt.col.vel.set(0, 0, 0); continue; }
    gt.t = Math.min(1, gt.t + dt / (gt.data.time || 1.4));
    const k = ease(gt.t);
    const nx = gt.from.x + (gt.to.x - gt.from.x) * k, ny = gt.from.y + (gt.to.y - gt.from.y) * k, nz = gt.from.z + (gt.to.z - gt.from.z) * k;
    gt.col.vel.set((nx - gt.col.pos.x) / dt, (ny - gt.col.pos.y) / dt, (nz - gt.col.pos.z) / dt);
    gt.col.pos.set(nx, ny, nz);
    gt.mesh.position.set(nx, ny + gt.meshOffset, nz);
  }
  for (const cr of world.crumbles) {
    if (cr.state === 'shaking') {
      cr.t += dt;
      cr.mesh.position.set(cr.home.x + (Math.random() - 0.5) * 0.08, cr.home.y, cr.home.z + (Math.random() - 0.5) * 0.08);
      if (cr.t > (cr.data.delay || 0.6)) {
        cr.state = 'falling';
        cr.t = 0;
        cr.vy = 0;
        world.physics.remove(cr.col);
      }
    } else if (cr.state === 'falling') {
      cr.t += dt;
      cr.vy -= 20 * dt;
      cr.mesh.position.y += cr.vy * dt;
      cr.mesh.rotation.z += dt * 0.6;
      if (cr.t > (cr.data.respawn || 3.5)) {
        cr.state = 'idle';
        cr.t = 0;
        cr.mesh.position.copy(cr.home);
        cr.mesh.rotation.set(0, 0, 0);
        cr.mesh.scale.setScalar(0.01);
        cr.grow = 0;
        world.physics.add(cr.col);
      }
    } else if (cr.grow !== undefined && cr.grow < 1) {
      cr.grow = Math.min(1, cr.grow + dt * 3);
      cr.mesh.scale.setScalar(Math.max(0.01, cr.grow));
    }
  }
  for (const sp of world.spikes) {
    const { period = 2.6, phase = 0, upFrac = 0.42 } = sp.data;
    const u = ((time / period + phase) % 1 + 1) % 1;
    const up = u < upFrac;
    const warn = !up && u > 1 - 0.18; // poke out a little just before rising
    const target = up ? 0 : warn ? -0.32 : -0.6;
    sp.h += (target - sp.h) * Math.min(1, dt * (up ? 30 : 10));
    sp.spikes.position.y = sp.base + sp.h;
    sp.col.hurt = sp.h > -0.25;
  }
}
