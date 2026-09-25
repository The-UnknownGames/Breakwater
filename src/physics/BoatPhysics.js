// A floating boat: Rapier rigid body + voxel buoyancy + propulsion (none for
// tow targets) + wind + hull state (flooding, damage, grounding). Pure JS
// (no three.js) so tests can drive it headless.

import { HullBuoyancy } from './Buoyancy.js';
import { Propulsion, NoPropulsion, windForce } from './Propulsion.js';
import { HullState } from './Hull.js';
import { buildHullMesh, hullStation } from './HullShape.js';
import { quatFromAxisAngle, rotate, cross, vec, headingOf } from '../core/math.js';
import { PHYS } from '../config/physics.js';
import { FLOOD, DAMAGE } from '../config/rescue.js';

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
    this.propulsion = cfg.prop ? new Propulsion(cfg) : new NoPropulsion();
    const reserve = (this.buoyancy.totalVolume * PHYS.rhoWater - cfg.mass) / 1000;
    this.hull = new HullState(cfg, reserve);
    const h = cfg.hull;
    this.deckEdge = this.findDeckEdge();
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
      const c = physics.world.createCollider(cd, this.body);
      if (physics.watchCollider) {
        physics.watchCollider(c, this);
      }
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
    // Deck cargo (survivors aboard), kg.
    this.payload = 0;
    this.io = { greenWater: 0, groundDamage: 0, scrape: 0, contactDamage: 0 };
    this.tmpW = { p: vec(), l: vec(), F: vec(), r: vec(), t: vec(), v: vec() };
  }

  // Buoyancy points in the top layer near the sheer: green water enters the
  // hull when these go under. Stores each point's deck height above it.
  findDeckEdge() {
    const h = this.cfg.hull;
    const out = [];
    for (let i = 0; i < this.buoyancy.points.length; i++) {
      const p = this.buoyancy.points[i];
      const st = hullStation(h, Math.min(1, Math.max(0, p.z / h.length + 0.5)));
      if (p.y + p.h / 2 > st.deck * 0.45 && Math.abs(p.x) > st.halfBeam * 0.45) {
        out.push({ i, above: st.deck - p.y });
      }
    }
    return out;
  }

  // Contact force report from the physics world (collisions).
  onContact(force, dt) {
    if (force > DAMAGE.contactThreshold) {
      this.io.contactDamage += ((force - DAMAGE.contactThreshold) / DAMAGE.contactScale) * dt;
    }
  }

  // Weight at a body-frame point (flood water, deck cargo).
  addWeight(s, f, kg, lx, ly, lz) {
    const w = this.tmpW;
    w.l.x = lx;
    w.l.y = ly;
    w.l.z = lz;
    rotate(s.rot, w.l, w.p);
    w.r.x = s.pos.x + w.p.x - s.com.x;
    w.r.y = s.pos.y + w.p.y - s.com.y;
    w.r.z = s.pos.z + w.p.z - s.com.z;
    w.F.x = 0;
    w.F.y = -kg * PHYS.gravity;
    w.F.z = 0;
    cross(w.r, w.F, w.t);
    f.fy += w.F.y;
    f.tx += w.t.x;
    f.ty += w.t.y;
    f.tz += w.t.z;
  }

  // Flood water runs to the low side (free-surface effect); survivors sit
  // on deck amidships.
  applyLoads(s, f) {
    const h = this.cfg.hull;
    const hull = this.hull;
    if (hull.flood > 0) {
      const fill = Math.min(1, hull.flood / Math.max(0.1, hull.reserve));
      const shift = FLOOD.freeSurface * (h.beam / 2) * Math.max(-1, Math.min(1, Math.sin(hull.heel) * 4)) * (1 - 0.5 * fill);
      this.addWeight(s, f, hull.flood * 1000, shift, -h.draft * 0.45 + fill * 0.5, this.buoyancy.lcb);
    }
    if (this.payload > 0) {
      this.addWeight(s, f, this.payload, 0, h.freeboard + 0.3, -h.length * 0.1);
    }
  }

  // Seabed contact: buoyancy points below the bed get a normal spring,
  // sliding friction and hull damage.
  ground(s, f, seabed) {
    const io = this.io;
    io.groundDamage = 0;
    io.scrape = 0;
    if (!seabed || !seabed.shallowNear(s.pos.x, s.pos.z, this.cfg.hull.length)) {
      return;
    }
    const w = this.tmpW;
    const pts = this.buoyancy.points;
    const world = this.buoyancy.world;
    for (let i = 0; i < pts.length; i++) {
      const wp = world[i];
      const bottom = wp.y - pts[i].h / 2;
      const bed = -seabed.depthAt(wp.x, wp.z);
      const pen = bed - bottom;
      if (pen <= 0) {
        continue;
      }
      w.r.x = wp.x - s.com.x;
      w.r.y = wp.y - s.com.y;
      w.r.z = wp.z - s.com.z;
      cross(s.angvel, w.r, w.v);
      const vx = w.v.x + s.linvel.x;
      const vy = w.v.y + s.linvel.y;
      const vz = w.v.z + s.linvel.z;
      const N = Math.max(0, DAMAGE.groundStiffness * pen - 20000 * Math.min(0, vy));
      const slide = Math.hypot(vx, vz);
      const fr = slide > 1e-3 ? Math.min(DAMAGE.groundFriction * N, 30000 * slide) / slide : 0;
      w.F.x = -vx * fr;
      w.F.y = N;
      w.F.z = -vz * fr;
      cross(w.r, w.F, w.t);
      f.fx += w.F.x;
      f.fy += w.F.y;
      f.fz += w.F.z;
      f.tx += w.t.x;
      f.ty += w.t.y;
      f.tz += w.t.z;
      io.groundDamage += DAMAGE.groundDamage * Math.min(pen, 0.5) * (slide + Math.max(0, -vy));
      io.scrape = Math.max(io.scrape, slide);
    }
  }

  // Deck-edge immersion (m, summed) for green-water flooding.
  greenWater() {
    let sum = 0;
    const world = this.buoyancy.world;
    for (const e of this.deckEdge) {
      const over = world[e.i].depth - e.above;
      if (over > 0) {
        sum += Math.min(over, 1);
      }
    }
    return sum;
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
    this.applyLoads(s, f);
    this.ground(s, f, ctx.seabed);
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
    const io = this.io;
    io.greenWater = this.greenWater();
    this.hull.damage(io.contactDamage);
    io.contactDamage = 0;
    this.hull.update(dt, s.rot, this.propulsion, io);
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
