// Tiny custom physics: spheres (Glover, ball, critters) against static or moving
// boxes and vertical cylinders. Simple enough to tune by feel and cheap on phones.
import * as THREE from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const _l = new THREE.Vector3();
const _d = new THREE.Vector3();

export class BoxCollider {
  constructor({ pos, size, quat, ...props }) {
    this.shape = 'box';
    this.pos = new THREE.Vector3().copy(pos);
    this.half = new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] / 2);
    this.quat = quat ? quat.clone() : new THREE.Quaternion();
    this.invQuat = this.quat.clone().invert();
    this.vel = new THREE.Vector3();
    this.boundR = this.half.length();
    Object.assign(this, props);
  }
}

export class CylCollider {
  // Vertical cylinder. `pos` is the centre.
  constructor({ pos, radius, height, ...props }) {
    this.shape = 'cyl';
    this.pos = new THREE.Vector3().copy(pos);
    this.radius = radius;
    this.halfH = height / 2;
    this.vel = new THREE.Vector3();
    this.boundR = Math.hypot(radius, this.halfH);
    Object.assign(this, props);
  }
}

function sphereBox(c, r, b, out) {
  _l.copy(c).sub(b.pos).applyQuaternion(b.invQuat);
  const hx = b.half.x, hy = b.half.y, hz = b.half.z;
  const dx = _l.x - clamp(_l.x, -hx, hx);
  const dy = _l.y - clamp(_l.y, -hy, hy);
  const dz = _l.z - clamp(_l.z, -hz, hz);
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > r * r) return false;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    out.normal.set(dx / d, dy / d, dz / d).applyQuaternion(b.quat);
    out.depth = r - d;
  } else {
    const ox = hx - Math.abs(_l.x), oy = hy - Math.abs(_l.y), oz = hz - Math.abs(_l.z);
    if (oy <= ox && oy <= oz) { out.normal.set(0, Math.sign(_l.y) || 1, 0); out.depth = oy + r; }
    else if (ox <= oz) { out.normal.set(Math.sign(_l.x) || 1, 0, 0); out.depth = ox + r; }
    else { out.normal.set(0, 0, Math.sign(_l.z) || 1); out.depth = oz + r; }
    out.normal.applyQuaternion(b.quat);
  }
  return true;
}

function sphereCyl(c, r, cy, out) {
  const lx = c.x - cy.pos.x, ly = c.y - cy.pos.y, lz = c.z - cy.pos.z;
  const hh = cy.halfH, R = cy.radius;
  const rd = Math.hypot(lx, lz);
  let qx = lx, qz = lz;
  if (rd > R) { qx = (lx / rd) * R; qz = (lz / rd) * R; }
  const qy = clamp(ly, -hh, hh);
  const dx = lx - qx, dy = ly - qy, dz = lz - qz;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > r * r) return false;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    out.normal.set(dx / d, dy / d, dz / d);
    out.depth = r - d;
  } else {
    const oTop = hh - ly, oBot = ly + hh, oSide = R - rd;
    if (oTop <= oBot && oTop <= oSide) { out.normal.set(0, 1, 0); out.depth = oTop + r; }
    else if (oBot <= oSide) { out.normal.set(0, -1, 0); out.depth = oBot + r; }
    else {
      if (rd > 1e-6) out.normal.set(lx / rd, 0, lz / rd); else out.normal.set(1, 0, 0);
      out.depth = oSide + r;
    }
  }
  return true;
}

// Ray vs box (slab method in local space). Returns distance or -1. Writes normal.
function rayBox(o, dir, maxT, b, outN) {
  const lo = _l.copy(o).sub(b.pos).applyQuaternion(b.invQuat);
  const ld = _d.copy(dir).applyQuaternion(b.invQuat);
  let tmin = -Infinity, tmax = Infinity, axis = -1, sign = 1;
  const h = [b.half.x, b.half.y, b.half.z];
  const O = [lo.x, lo.y, lo.z], D = [ld.x, ld.y, ld.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(D[i]) < 1e-9) {
      if (O[i] < -h[i] || O[i] > h[i]) return -1;
    } else {
      let t1 = (-h[i] - O[i]) / D[i], t2 = (h[i] - O[i]) / D[i];
      let s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = i; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  if (tmax < 0) return -1;
  if (tmin < 0) { if (outN) outN.set(0, 1, 0); return 0; }
  if (tmin > maxT) return -1;
  if (outN) {
    outN.set(0, 0, 0);
    if (axis === 0) outN.x = sign; else if (axis === 1) outN.y = sign; else outN.z = sign;
    outN.applyQuaternion(b.quat);
  }
  return tmin;
}

function rayCyl(o, dir, maxT, cy, outN) {
  const ox = o.x - cy.pos.x, oy = o.y - cy.pos.y, oz = o.z - cy.pos.z;
  const R = cy.radius, hh = cy.halfH;
  if (ox * ox + oz * oz <= R * R && Math.abs(oy) <= hh) { if (outN) outN.set(0, 1, 0); return 0; }
  let best = Infinity, bn = 0; // 0 side, 1 top, -1 bottom
  const a = dir.x * dir.x + dir.z * dir.z;
  if (a > 1e-9) {
    const bq = 2 * (ox * dir.x + oz * dir.z);
    const c = ox * ox + oz * oz - R * R;
    const disc = bq * bq - 4 * a * c;
    if (disc >= 0) {
      const t = (-bq - Math.sqrt(disc)) / (2 * a);
      if (t >= 0) {
        const y = oy + dir.y * t;
        if (y >= -hh && y <= hh) { best = t; bn = 0; }
      }
    }
  }
  if (Math.abs(dir.y) > 1e-9) {
    for (const capY of [hh, -hh]) {
      const t = (capY - oy) / dir.y;
      if (t >= 0 && t < best) {
        const x = ox + dir.x * t, z = oz + dir.z * t;
        if (x * x + z * z <= R * R) { best = t; bn = capY > 0 ? 1 : -1; }
      }
    }
  }
  if (best === Infinity || best > maxT) return -1;
  if (outN) {
    if (bn === 0) {
      const x = ox + dir.x * best, z = oz + dir.z * best;
      const l = Math.hypot(x, z) || 1;
      outN.set(x / l, 0, z / l);
    } else outN.set(0, bn, 0);
  }
  return best;
}

export class PhysicsWorld {
  constructor() {
    this.colliders = [];
    this._hit = { normal: new THREE.Vector3(), depth: 0 };
    this._n = new THREE.Vector3();
  }
  add(c) { this.colliders.push(c); return c; }
  remove(c) {
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
  }

  // Push a sphere out of everything it overlaps. Calls onContact(normal, depth, collider)
  // for each contact (normal points out of the collider, towards the sphere).
  resolveSphere(center, r, onContact) {
    const hit = this._hit;
    for (let pass = 0; pass < 2; pass++) {
      let any = false;
      for (let i = 0; i < this.colliders.length; i++) {
        const c = this.colliders[i];
        const dx = center.x - c.pos.x, dy = center.y - c.pos.y, dz = center.z - c.pos.z;
        const br = c.boundR + r;
        if (dx * dx + dy * dy + dz * dz > br * br) continue;
        const ok = c.shape === 'box' ? sphereBox(center, r, c, hit) : sphereCyl(center, r, c, hit);
        if (!ok) continue;
        center.addScaledVector(hit.normal, hit.depth);
        if (onContact) onContact(hit.normal, hit.depth, c);
        any = true;
      }
      if (!any) break;
    }
  }

  // Returns { t, normal, collider } or null.
  raycast(origin, dir, maxT, ignore) {
    let best = maxT, bestC = null;
    const n = this._n, bn = new THREE.Vector3();
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (ignore && ignore(c)) continue;
      // cheap reject: distance from collider centre to ray
      const vx = c.pos.x - origin.x, vy = c.pos.y - origin.y, vz = c.pos.z - origin.z;
      const proj = clamp(vx * dir.x + vy * dir.y + vz * dir.z, 0, maxT);
      const px = origin.x + dir.x * proj - c.pos.x;
      const py = origin.y + dir.y * proj - c.pos.y;
      const pz = origin.z + dir.z * proj - c.pos.z;
      if (px * px + py * py + pz * pz > c.boundR * c.boundR) continue;
      const t = c.shape === 'box' ? rayBox(origin, dir, best, c, n) : rayCyl(origin, dir, best, c, n);
      if (t >= 0 && t <= best) { best = t; bestC = c; bn.copy(n); }
    }
    return bestC ? { t: best, normal: bn, collider: bestC } : null;
  }
}
