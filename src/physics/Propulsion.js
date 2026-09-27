// Engine, propeller and rudder (spec 3.4). Pure JS.
// Throttle is a lever (-1..1) that stays put; RPM follows it with inertia.
// Thrust acts at the prop and fades as the prop leaves the water
// (ventilation: load drops, RPM spikes). The rudder is a flat-plate foil in
// the flow at the rudder, which includes prop wash when going ahead, so a
// blip of throttle steers at low speed and steering in reverse is weak.

import { rotate, rotateInv, cross, vec, clamp } from '../core/math.js';
import { PHYS } from '../config/physics.js';

const DEG = Math.PI / 180;

export class Propulsion {
  constructor(cfg) {
    this.cfg = cfg;
    this.throttle = 0;
    this.load = 0; // normalized shaft speed under load, -1..1
    this.rpm = cfg.prop.rpmIdle;
    this.rudder = 0; // radians, + = trailing edge to local +X (port): turns to port
    this.podAngle = 0; // azimuth drives: pod angle (radians, same sense)
    this.swing = 0; // azimuth drives: 0 = pods ahead, 1 = swung round astern
    this.submerged = 1;
    this.ventilation = 0;
    this.thrust = 0;
    this.enabled = true;
    this.propArea = (Math.PI * cfg.prop.diameter * cfg.prop.diameter) / 4;
    this.tmp = { p: vec(), r: vec(), v: vec(), vl: vec(), F: vec(), Fw: vec(), t: vec(), water: {} };
  }

  // rudderInput: +1 turns to port (local +X), -1 to starboard; lock holds it.
  control(dt, throttle, rudderInput, lock) {
    const r = this.cfg.rudder;
    this.throttle = clamp(throttle, -1, 1);
    const max = r.maxAngleDeg * DEG;
    if (rudderInput !== 0) {
      this.rudder = clamp(this.rudder + rudderInput * r.rateDegPerSec * DEG * dt, -max, max);
    } else if (!lock) {
      const step = r.returnDegPerSec * DEG * dt;
      this.rudder = Math.abs(this.rudder) <= step ? 0 : this.rudder - Math.sign(this.rudder) * step;
    }
  }

  compute(state, waves, t, current, out) {
    const cfg = this.cfg;
    const { pos, rot, linvel, angvel, com } = state;
    const tmp = this.tmp;
    const rho = PHYS.rhoWater;
    const dt = state.dt;

    // Engine inertia: shaft load follows the lever over rpmTau seconds.
    const cmd = this.enabled ? this.throttle : 0;
    const rate = dt / cfg.prop.rpmTau;
    this.load += clamp(cmd - this.load, -rate, rate);

    // Prop immersion.
    this.pointVelocity(state, cfg.prop.pos, tmp.p, tmp.v);
    const water = waves.sample(tmp.p.x, tmp.p.z, t, undefined, tmp.water, tmp.p.y);
    const depth = water.height - tmp.p.y;
    this.submerged = clamp(depth / cfg.prop.diameter + 0.5, 0, 1);
    tmp.v.x -= water.vx + current.x;
    tmp.v.y -= water.vy;
    tmp.v.z -= water.vz + current.z;
    rotateInv(rot, tmp.v, tmp.vl);
    const vFwd = tmp.vl.z;

    if (cfg.azimuth) {
      this.computeAzimuth(state, waves, t, current, vFwd, out);
      return;
    }
    // Thrust (N, along local +Z).
    let T;
    if (this.load >= 0) {
      T = this.load * cfg.prop.thrustMax * this.submerged * clamp(1 - vFwd / cfg.prop.vPropMax, 0, 1.3);
    } else {
      const eff = cfg.prop.reverseEfficiency;
      T = this.load * cfg.prop.thrustMax * eff * this.submerged * clamp(1 - 0.6 * Math.abs(vFwd) / cfg.prop.vPropMax, 0.3, 1);
    }
    this.thrust = T;
    // Ventilation: an unloaded prop races.
    this.ventilation = Math.abs(this.load) * (1 - this.submerged);
    const idle = cfg.prop.rpmIdle;
    const span = cfg.prop.rpmMax - idle;
    const targetRpm = idle + span * Math.abs(this.load) * (1 + 0.35 * this.ventilation);
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * (this.ventilation > 0.2 ? 12 : 4));
    tmp.F.x = 0;
    tmp.F.y = 0;
    tmp.F.z = T;
    rotate(rot, tmp.F, tmp.Fw);
    this.apply(tmp.p, com, tmp.Fw, out);

    this.computeRudder(state, waves, t, current, T, out);
  }

  // Largest pod angle the helm may command at this speed: full vectoring
  // (to 90°) when manoeuvring, closing to cruiseAngleDeg as she gathers way
  // so a hard-over at speed turns her tightly without laying her over.
  podLimit(kn) {
    const az = this.cfg.azimuth;
    const f = clamp((kn - az.fullKn) / (az.cruiseKn - az.fullKn), 0, 1);
    return (az.lowAngleDeg + (az.cruiseAngleDeg - az.lowAngleDeg) * f) * DEG;
  }

  // Twin azimuth stern drives (opt-in, cfg.azimuth): each pod's thrust is
  // vectored by the helm angle. The helm (this.rudder) keeps its usual
  // meaning (+ turns to port), so autopilot, instruments and input are
  // unchanged; the pods swing to helm fraction × podLimit(speed).
  computeAzimuth(state, waves, t, current, vFwd, out) {
    const cfg = this.cfg;
    const az = cfg.azimuth;
    const tmp = this.tmp;
    const helm = this.rudder / (cfg.rudder.maxAngleDeg * DEG);
    const kn = Math.abs(vFwd) / 0.514444;
    this.podAngle = helm * this.podLimit(kn);
    // Astern means swinging both pods round (symmetrically, so their side
    // forces cancel), which takes swingSec; thrust builds as they come
    // round. Ducted props: the nozzle adds bollardExtra of thrust at rest,
    // gone by bollardKn, on top of the open-water curve.
    const sw = state.dt / az.swingSec;
    this.swing = clamp(this.swing + (this.load < 0 ? sw : -sw), 0, 1);
    const swingK = this.swing * this.swing * (3 - 2 * this.swing);
    const hump = az.bollardExtra * Math.pow(clamp(1 - kn / az.bollardKn, 0, 1), 2);
    let total = 0;
    let sub = 0;
    for (const pos of az.pods) {
      this.pointVelocity(state, pos, tmp.p, tmp.v);
      const water = waves.sample(tmp.p.x, tmp.p.z, t, undefined, tmp.water, tmp.p.y);
      const s = clamp((water.height - tmp.p.y) / cfg.prop.diameter + 0.5, 0, 1);
      sub += s / az.pods.length;
      let T;
      if (this.load >= 0) {
        T = this.load * s * (cfg.prop.thrustMax * clamp(1 - vFwd / cfg.prop.vPropMax, 0, 1.3) + hump) * (1 - swingK);
      } else {
        T = this.load * s * (cfg.prop.reverseEfficiency * cfg.prop.thrustMax * clamp(1 - 0.6 * Math.abs(vFwd) / cfg.prop.vPropMax, 0.3, 1) + az.bollardAstern * hump) * swingK;
      }
      T /= az.pods.length;
      total += T;
      // Thrust along the pod's axis; + helm swings the jet to port so the
      // stern is pushed to starboard and she turns to port. Swung astern,
      // the pods are still steered so the helm walks the stern the same
      // way (unlike a rudder, steering does not reverse going astern).
      tmp.F.x = -Math.abs(T) * Math.sin(this.podAngle);
      tmp.F.y = 0;
      tmp.F.z = T * Math.cos(this.podAngle);
      rotate(state.rot, tmp.F, tmp.Fw);
      this.apply(tmp.p, state.com, tmp.Fw, out);
    }
    this.submerged = sub;
    this.thrust = total;
    this.ventilation = Math.abs(this.load) * (1 - sub);
    const idle = cfg.prop.rpmIdle;
    const span = cfg.prop.rpmMax - idle;
    const targetRpm = idle + span * Math.abs(this.load) * (1 + 0.35 * this.ventilation);
    this.rpm += (targetRpm - this.rpm) * Math.min(1, state.dt * (this.ventilation > 0.2 ? 12 : 4));
    // The pod struts act as small foils in the ship's own flow. No prop
    // wash term: a pod's wash runs along its own axis, not across it.
    if (az.finArea) {
      this.computeRudder(state, waves, t, current, 0, out, az.finArea, this.podAngle);
    }
  }

  computeRudder(state, waves, t, current, T, out, area = this.cfg.rudder.area, angle = this.rudder) {
    const cfg = this.cfg;
    const r = cfg.rudder;
    const tmp = this.tmp;
    const rho = PHYS.rhoWater;
    this.pointVelocity(state, r.pos, tmp.p, tmp.v);
    const water = waves.sample(tmp.p.x, tmp.p.z, t, undefined, tmp.water, tmp.p.y);
    const imm = clamp((water.height - tmp.p.y) / 0.8 + 0.5, 0, 1);
    if (imm <= 0) {
      return;
    }
    tmp.v.x -= water.vx + current.x;
    tmp.v.y -= water.vy;
    tmp.v.z -= water.vz + current.z;
    rotateInv(state.rot, tmp.v, tmp.vl);
    // Water velocity relative to the rudder, local xz. Prop wash only when
    // going ahead (the rudder sits behind the prop).
    const u = tmp.vl.z;
    const wash2 = T > 0 ? (cfg.prop.washK * T) / (rho * this.propArea) : 0;
    const axial2 = u * Math.abs(u) + wash2;
    const axial = Math.sign(axial2) * Math.sqrt(Math.abs(axial2));
    const wx = -tmp.vl.x;
    const wz = -axial;
    const speed2 = wx * wx + wz * wz;
    if (speed2 < 1e-6) {
      return;
    }
    const speed = Math.sqrt(speed2);
    const nx = Math.cos(angle);
    const nz = Math.sin(angle);
    const sinA = clamp((wx * nx + wz * nz) / speed, -1, 1);
    const alpha = Math.asin(sinA);
    const stall = r.stallDeg * DEG;
    const a = Math.abs(alpha);
    let cn = a <= stall ? 2 * Math.PI * a : 2 * Math.PI * stall * 0.45 + 1.1 * (Math.sin(a) - Math.sin(stall));
    cn *= Math.sign(alpha);
    const q = 0.5 * rho * area * speed2 * imm;
    // Normal force plus a little profile drag along the flow.
    const fl = { x: nx * q * cn + (wx / speed) * q * 0.03, y: 0, z: nz * q * cn + (wz / speed) * q * 0.03 };
    rotate(state.rot, fl, tmp.Fw);
    this.apply(tmp.p, state.com, tmp.Fw, out);
  }

  pointVelocity(state, local, outPos, outVel) {
    const tmp = this.tmp;
    rotate(state.rot, { x: local[0], y: local[1], z: local[2] }, outPos);
    outPos.x += state.pos.x;
    outPos.y += state.pos.y;
    outPos.z += state.pos.z;
    tmp.r.x = outPos.x - state.com.x;
    tmp.r.y = outPos.y - state.com.y;
    tmp.r.z = outPos.z - state.com.z;
    cross(state.angvel, tmp.r, outVel);
    outVel.x += state.linvel.x;
    outVel.y += state.linvel.y;
    outVel.z += state.linvel.z;
  }

  apply(point, com, F, out) {
    const r = { x: point.x - com.x, y: point.y - com.y, z: point.z - com.z };
    const t = cross(r, F, this.tmp.t);
    out.fx += F.x;
    out.fy += F.y;
    out.fz += F.z;
    out.tx += t.x;
    out.ty += t.y;
    out.tz += t.z;
  }
}

// Aerodynamic force at the windage centre (spec 3.4). wind: world {x, z} m/s.
export function windForce(cfg, state, wind, out, tmp = { p: vec(), l: vec(), F: vec(), t: vec(), r: vec() }) {
  const w = cfg.windage;
  rotate(state.rot, { x: w.center[0], y: w.center[1], z: w.center[2] }, tmp.p);
  const rx = tmp.p.x - (state.com.x - state.pos.x);
  const ry = tmp.p.y - (state.com.y - state.pos.y);
  const rz = tmp.p.z - (state.com.z - state.pos.z);
  const vx = wind.x - state.linvel.x;
  const vz = wind.z - state.linvel.z;
  rotateInv(state.rot, { x: vx, y: 0, z: vz }, tmp.l);
  const k = 0.5 * PHYS.rhoAir;
  const F = { x: k * w.cdSide * w.areaSide * Math.abs(tmp.l.x) * tmp.l.x, y: 0, z: k * w.cdFront * w.areaFront * Math.abs(tmp.l.z) * tmp.l.z };
  rotate(state.rot, F, tmp.F);
  tmp.r.x = rx;
  tmp.r.y = ry;
  tmp.r.z = rz;
  cross(tmp.r, tmp.F, tmp.t);
  out.fx += tmp.F.x;
  out.fy += tmp.F.y;
  out.fz += tmp.F.z;
  out.tx += tmp.t.x;
  out.ty += tmp.t.y;
  out.tz += tmp.t.z;
  return out;
}

// Stand-in for hulls with no engine (tow targets, drifting wrecks).
export class NoPropulsion {
  constructor() {
    this.throttle = 0;
    this.load = 0;
    this.rpm = 0;
    this.rudder = 0;
    this.submerged = 1;
    this.ventilation = 0;
    this.thrust = 0;
    this.enabled = false;
  }

  control() {}

  compute(state, waves, t, current, out) {
    return out;
  }
}
