// A floating powered boat: Rapier rigid body + voxel buoyancy + propulsion +
// wind + hull state. Pure JS (no three.js) so tests can drive it headless.

import { HullBuoyancy } from './Buoyancy.js';
import { Propulsion, windForce } from './Propulsion.js';
import { HullState } from './Hull.js';
import { buildHullMesh } from './HullShape.js';
import { quatFromAxisAngle, rotate, vec, headingOf } from '../core/math.js';

const KN = 0.514444;

function hullColliders(R, cfg) {
  const mesh = buildHullMesh(cfg.hull, 12, 5, false);
  const { positions, ring, stations } = mesh;
  const pieces = 4;
  const descs = [];
  for (let k = 0; k < pieces; k++) {
    const i0 = Math.floor((k * stations) / pieces);
    const i1 = Math.floor(((k + 1) * stations) / pieces);
    const pts = [];
    for (let i = i0; i <= i1; i++) {
      for (let j = 0; j < ring; j++) {
        const o = (i * ring + j) * 3;
        pts.push(positions[o], positions[o + 1], positions[o + 2]);
      }
    }
    const d = R.ColliderDesc.convexHull(new Float32Array(pts));
    if (d) {
      descs.push(d.setDensity(0).setFriction(0.4).setRestitution(0.1));
    }
  }
  return descs;
}

export class BoatPhysics {
  constructor(physics, cfg, spawn = {}) {
    const R = physics.R;
    this.cfg = cfg;
    this.buoyancy = new HullBuoyancy(cfg);
    this.propulsion = new Propulsion(cfg);
    this.hull = new HullState(cfg);
    const h = cfg.hull;
    const m = cfg.mass;
    const g = cfg.gyration;
    this.comLocal = vec(0, cfg.vcg, this.buoyancy.lcb);
    const inertia = {
      x: m * (g.pitch * h.length) ** 2,
      y: m * (g.yaw * h.length) ** 2,
      z: m * (g.roll * h.beam) ** 2,
    };
    const heading = spawn.heading ?? 0;
    const rot = quatFromAxisAngle(0, 1, 0, Math.PI - heading);
    const desc = R.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x ?? 0, spawn.y ?? 0, spawn.z ?? 0)
      .setRotation(rot)
      .setAdditionalMassProperties(m, this.comLocal, inertia, { x: 0, y: 0, z: 0, w: 1 })
      .setCanSleep(false);
    this.body = physics.world.createRigidBody(desc);
    for (const cd of hullColliders(R, cfg)) {
      physics.world.createCollider(cd, this.body);
    }
    this.state = { pos: vec(), rot: { x: 0, y: 0, z: 0, w: 1 }, linvel: vec(), angvel: vec(), com: vec(), dt: 1 / 60 };
    this.forces = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
    this.prev = { pos: vec(), rot: { x: 0, y: 0, z: 0, w: 1 } };
    this.windTmp = { p: vec(), l: vec(), F: vec(), t: vec(), r: vec() };
    this.readState();
    this.copyPrev();
    // External force hooks (tow lines etc. in V3): fn(state, forces).
    this.extraForces = [];
    this.input = { throttle: 0, rudder: 0, lock: false };
    // Slam events since the last drain (effects, audio, camera shake).
    this.slamEvents = [];
  }

  readState() {
    const s = this.state;
    const b = this.body;
    Object.assign(s.pos, b.translation());
    Object.assign(s.rot, b.rotation());
    Object.assign(s.linvel, b.linvel());
    Object.assign(s.angvel, b.angvel());
    rotate(s.rot, this.comLocal, s.com);
    s.com.x += s.pos.x;
    s.com.y += s.pos.y;
    s.com.z += s.pos.z;
    return s;
  }

  copyPrev() {
    Object.assign(this.prev.pos, this.state.pos);
    Object.assign(this.prev.rot, this.state.rot);
  }

  preStep(dt, ctx) {
    this.copyPrev();
    const s = this.readState();
    s.dt = dt;
    const f = this.forces;
    f.fx = 0;
    f.fy = 0;
    f.fz = 0;
    f.tx = 0;
    f.ty = 0;
    f.tz = 0;
    const current = ctx.env.currentAt(s.pos.x, s.pos.z, this.currentTmp || (this.currentTmp = vec()));
    this.propulsion.control(dt, this.input.throttle, this.input.rudder, this.input.lock);
    this.buoyancy.compute(s, ctx.waves, ctx.time, current, f);
    this.propulsion.compute(s, ctx.waves, ctx.time, current, f);
    windForce(this.cfg, s, ctx.env.wind, f, this.windTmp);
    for (const fn of this.extraForces) {
      fn(s, f);
    }
    const b = this.body;
    b.resetForces(true);
    b.resetTorques(true);
    b.addForce({ x: f.fx, y: f.fy, z: f.fz }, true);
    b.addTorque({ x: f.tx, y: f.ty, z: f.tz }, true);
  }

  postStep(dt) {
    for (const e of this.buoyancy.slams) {
      if (this.slamEvents.length < 32) {
        this.slamEvents.push(e);
      }
    }
    this.buoyancy.slams = [];
    const s = this.readState();
    this.hull.update(dt, s.rot, this.propulsion);
  }

  get forward() {
    return rotate(this.state.rot, vec(0, 0, 1));
  }

  get speed() {
    const v = this.state.linvel;
    return Math.hypot(v.x, v.z);
  }

  get forwardSpeed() {
    const f = this.forward;
    const v = this.state.linvel;
    return v.x * f.x + v.z * f.z;
  }

  get speedKn() {
    return this.speed / KN;
  }

  get heading() {
    return headingOf(this.state.rot);
  }

  // Waterline draft below the local surface at the CoM (for the waterline test).
  get position() {
    return this.state.pos;
  }
}
