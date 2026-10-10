// Third-person follow camera that swings in behind Glover on its own (so phone
// players rarely need to touch it), with manual orbit when they want it.
import * as THREE from 'three';

const _dir = new THREE.Vector3();
const _want = new THREE.Vector3();

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class FollowCam {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0;          // camera sits at target + (sin yaw, ., cos yaw) * dist
    this.pitch = 0.5;
    this.dist = 7.2;
    this.target = new THREE.Vector3();
    this.manualT = 10;
    this.curDist = this.dist;
    this.boost = 0;        // extra downward tilt while carrying the ball
  }

  snap(pos, facingYaw) {
    this.target.set(pos.x, pos.y + 1.1, pos.z);
    this.yaw = facingYaw + Math.PI;
    this.curDist = this.dist;
    this.apply(null);
  }

  update(dt, { pos, vel, grounded, ball, ballFree, holding, yaw, input, physics, portrait }) {
    const d = input.takeCamDelta();
    const manual = Math.abs(input.camAxis.x) + Math.abs(input.camAxis.y) > 0 || d.x !== 0 || d.y !== 0;
    if (manual) this.manualT = 0; else this.manualT += dt;
    this.yaw -= input.camAxis.x * 2.4 * dt + d.x * 0.008;
    this.pitch = THREE.MathUtils.clamp(this.pitch + input.camAxis.y * 1.5 * dt + d.y * 0.005, 0.05, 1.15);

    // auto swing behind the direction of travel
    const hs = Math.hypot(vel.x, vel.z);
    if (this.manualT > 1.2 && hs > 1.5) {
      const travelYaw = Math.atan2(vel.x, vel.z) + Math.PI;
      const camFwd = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
      const towardCam = (vel.x * camFwd.x + vel.z * camFwd.z) / hs < -0.6;
      if (!towardCam) {
        const rate = 0.7 * Math.min(1, hs / 5);
        this.yaw += angleDiff(this.yaw, travelYaw) * Math.min(1, rate * dt);
      }
    }

    // follow target; lag a bit vertically so jumps don't jerk the view
    _want.set(pos.x, pos.y + 1.0, pos.z);
    if (holding) { _want.x += Math.sin(yaw) * 0.3; _want.z += Math.cos(yaw) * 0.3; }
    if (ball && ballFree) {
      const bx = ball.x - pos.x, bz = ball.z - pos.z;
      const bd = Math.hypot(bx, bz);
      if (bd < 12) { _want.x += bx * 0.3; _want.z += bz * 0.3; }
    }
    const kx = 1 - Math.exp(-dt * 10);
    const ky = 1 - Math.exp(-dt * (grounded ? 6 : 2.5));
    this.target.x += (_want.x - this.target.x) * kx;
    this.target.z += (_want.z - this.target.z) * kx;
    this.target.y += (_want.y - this.target.y) * ky;
    if (this.target.y < _want.y - 3.5) this.target.y = _want.y - 3.5;
    if (this.target.y > _want.y + 3) this.target.y = _want.y + 3;

    this.dist = portrait ? 9.5 : 7.2;
    this.boost += ((holding ? 0.06 : 0) - this.boost) * Math.min(1, dt * 3);
    this.apply(physics, dt);
  }

  apply(physics, dt = 1) {
    const pitch = Math.min(1.25, this.pitch + this.boost);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    _dir.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    let want = this.dist;
    if (physics) {
      const hit = physics.raycast(this.target, _dir, this.dist + 0.3, (c) => c.crate || c.mat === 'wood' && c.shape === 'cyl');
      if (hit) want = Math.max(1.2, hit.t - 0.35);
    }
    // pull in instantly, ease back out
    if (want < this.curDist) this.curDist = want;
    else this.curDist += (want - this.curDist) * Math.min(1, dt * 3);
    this.cam.position.copy(this.target).addScaledVector(_dir, this.curDist);
    this.cam.lookAt(this.target.x, this.target.y + 0.2, this.target.z);
  }

  // camera-relative movement: stick up = away from camera
  moveDir(mx, my, out) {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = -fz, rz = fx;
    out.set(fx * my + rx * mx, 0, fz * my + rz * mx);
    return out;
  }
}
