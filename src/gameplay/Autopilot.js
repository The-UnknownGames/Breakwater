// Autopilot helper: steers a BoatPhysics to a point and holds a speed
// schedule that slows to an arrival speed. Used by the scripted scenario
// tests (spec 14 V3) and, after the upgrade, by the player (V4).
// Rudder input is a rate command, so it servos the rudder to a target angle
// with the lock held.

import { clamp } from '../core/math.js';

const KN = 0.514444;
const DEG = Math.PI / 180;

function wrap(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export class Autopilot {
  constructor(sim, opts = {}) {
    this.sim = sim;
    this.kp = opts.kp ?? 2.2;
    this.kd = opts.kd ?? 1.6;
    this.speedK = opts.speedK ?? 0.5;
    this.speedI = opts.speedI ?? 0.12;
    // m/s² planned slowdown; big ships can't stop like a workboat.
    this.decel = opts.decel ?? Math.min(0.35, 7 / sim.cfg.hull.length);
    this.integral = 0;
    this.distance = Infinity;
    this.headingError = 0;
  }

  // target: {x, z}; opts: cruiseKn, arriveKn, stopDist, creep.
  update(dt, target, opts = {}) {
    const sim = this.sim;
    const s = sim.state;
    const cruise = (opts.cruiseKn ?? 10) * KN;
    const arrive = (opts.arriveKn ?? 0) * KN;
    const dx = target.x - s.pos.x;
    const dz = target.z - s.pos.z;
    const dist = Math.hypot(dx, dz);
    this.distance = dist;
    // Compass bearing: +X east, -Z north.
    const bearing = Math.atan2(dx, -dz);
    const err = wrap(bearing - sim.heading);
    this.headingError = err;
    // Heading rate (compass, clockwise): rotation about +Y turns bow west.
    const hdgRate = -s.angvel.y;
    // PD on the heading error; positive rudder turns to port (heading falls).
    const max = sim.cfg.rudder.maxAngleDeg * DEG;
    const want = clamp(-(this.kp * err - this.kd * hdgRate) * 0.6, -max, max);
    const pr = sim.propulsion;
    const step = sim.cfg.rudder.rateDegPerSec * DEG * dt;
    sim.input.rudder = clamp((want - pr.rudder) / step, -1, 1);
    sim.input.lock = true;
    // Speed: brake to the arrival speed over the remaining distance, and slow
    // for large heading errors so it turns tightly.
    let vCmd = Math.min(cruise, Math.sqrt(arrive * arrive + 2 * this.decel * Math.max(0, dist - (opts.stopDist ?? 0))));
    vCmd *= clamp(1.2 - Math.abs(err) / 1.6, 0.35, 1);
    // Target inside the turning circle: creep and turn on prop wash rather
    // than orbit it (opt-in: pickups of small targets in the water).
    if (opts.creep && dist < 30 && Math.abs(err) > 0.7) {
      vCmd = Math.min(vCmd, 0.5);
    }
    if (opts.stopDist !== undefined && dist < opts.stopDist) {
      vCmd = arrive;
    }
    const u = sim.forwardSpeed;
    const e = vCmd - u;
    this.integral = clamp(this.integral + e * dt * this.speedI, -0.6, 0.6);
    const ff = clamp(vCmd / (sim.cfg.targets.topSpeedKn * KN), 0, 1) * 0.9;
    sim.input.throttle = clamp(ff + this.speedK * e + this.integral, -1, 1);
    return dist;
  }

  // Back down along a line (e.g. onto a tow's bow): hold `heading` and zero
  // lateral offset `off` (m, + to starboard of the line) going astern at
  // up to `kn`. Astern, the rudder acts the other way round.
  backDown(dt, heading, off, kn = 2) {
    const sim = this.sim;
    const hd = wrap(sim.heading - heading);
    const max = sim.cfg.rudder.maxAngleDeg * DEG;
    const want = clamp(-(2 * hd + 0.08 * off), -max, max);
    const step = sim.cfg.rudder.rateDegPerSec * DEG * dt;
    sim.input.rudder = clamp((want - sim.propulsion.rudder) / step, -1, 1);
    sim.input.lock = true;
    sim.input.throttle = sim.forwardSpeed > -kn * KN * 0.5 ? -0.35 : 0;
  }

  stop(dt) {
    const sim = this.sim;
    const u = sim.forwardSpeed;
    sim.input.throttle = clamp(-u * 0.6, -1, 1);
    sim.input.rudder = clamp(-sim.propulsion.rudder / (sim.cfg.rudder.rateDegPerSec * DEG * dt), -1, 1);
  }
}
