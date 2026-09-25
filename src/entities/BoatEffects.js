// Visual effects driven by a boat's physics state: stern wake, bow waves
// (a Kelvin-style V of diverging crests), hull-contact foam, prop wash,
// ventilation churn, slam foam + spray bursts, and bow spray at speed.

import { FOAM, SPRAY } from '../config/render.js';

const KN = 0.514444;
const KELVIN = Math.tan((19.5 * Math.PI) / 180);

export class BoatEffects {
  constructor(boat, foam, spray) {
    this.boat = boat;
    this.foam = foam;
    this.spray = spray;
    this.bowAcc = 0;
    this.washAcc = 0;
  }

  local(x, y, z, out = {}) {
    const s = this.boat.sim.state;
    const q = s.rot;
    const tx = 2 * (q.y * z - q.z * y);
    const ty = 2 * (q.z * x - q.x * z);
    const tz = 2 * (q.x * y - q.y * x);
    out.x = s.pos.x + x + q.w * tx + (q.y * tz - q.z * ty);
    out.y = s.pos.y + y + q.w * ty + (q.z * tx - q.x * tz);
    out.z = s.pos.z + z + q.w * tz + (q.x * ty - q.y * tx);
    return out;
  }

  // Paint a stamp swept back along the direction of travel over `moved`
  // metres, split so low frame rates don't leave a dotted trail.
  trail(x, z, radius, strength, moved) {
    const v = this.boat.sim.state.linvel;
    const sp = Math.hypot(v.x, v.z) || 1;
    const n = Math.min(12, Math.max(1, Math.ceil(moved / (radius * 0.8))));
    for (let i = 0; i < n; i++) {
      const b = (moved * i) / n;
      this.foam.paint(x - (v.x / sp) * b, z - (v.z / sp) * b, radius, strength / n);
    }
  }

  update(dt, slams, waves) {
    const sim = this.boat.sim;
    const h = sim.cfg.hull;
    const foam = this.foam;
    const u = Math.max(0, sim.forwardSpeed);
    const kn = u / KN;
    const f60 = dt * 60;
    const L = h.length;
    const B = h.beam;
    const p = {};

    // Foam is deposited per metre travelled (stamp strength ∝ distance moved
    // / stamp diameter), so the trail density is independent of frame rate
    // and speed, and a stopped boat leaves no wake.
    const moved = u * dt;
    // Stern wake: broad turbulent band behind the transom.
    const wake = Math.min(1, u / 4);
    if (wake > 0.02) {
      const r = B * (0.3 + 0.12 * wake);
      this.local(0, 0, -L / 2 + 0.3, p);
      this.trail(p.x, p.z, r, (FOAM.wakeStrength * wake * moved) / (2 * r), moved);
    }
    // Bow waves: stamps along the two diverging Kelvin arms.
    const bow = Math.min(1, u / 6);
    if (bow > 0.05) {
      for (let k = 0; k < 4; k++) {
        const behind = 1 + k * (L * 0.3);
        const z = L / 2 - 1.5 - behind;
        const lat = B * 0.42 + behind * KELVIN;
        const r = 0.55 + k * 0.15;
        const strength = (FOAM.bowStrength * bow * (1 - k * 0.22) * moved) / (2 * r);
        for (const side of [1, -1]) {
          this.local(side * lat, 0, z, p);
          this.trail(p.x, p.z, r, strength, moved);
        }
      }
    }
    // Hull contact: waterline points moving through the water.
    const pts = sim.buoyancy.world;
    const speed = sim.speed;
    if (speed > 0.8) {
      for (const w of pts) {
        if (w.f > 0.05 && w.f < 0.95) {
          foam.paint(w.x, w.z, 0.7, (FOAM.contactStrength * speed * dt) / 1.4);
        }
      }
    }
    // Prop wash and ventilation churn.
    const pr = sim.propulsion;
    const thrust = Math.abs(pr.thrust) / sim.cfg.prop.thrustMax;
    this.local(sim.cfg.prop.pos[0], 0, sim.cfg.prop.pos[2] - 1.2 * Math.sign(pr.thrust || 1), p);
    if (thrust > 0.05) {
      foam.paint(p.x, p.z, 1.1 + thrust, thrust * 0.005 * f60);
    }
    if (pr.ventilation > 0.2) {
      foam.paint(p.x, p.z, 1.6, pr.ventilation * 0.3 * f60);
      this.spray.emit(Math.ceil(pr.ventilation * 30 * dt * 10), p.x, p.y + 0.2, p.z, 0, 1.5, 0, 3, 0.7, 0.9);
    }
    // Slams: foam burst + spray.
    for (const s of slams) {
      foam.paint(s.x, s.z, 2 + s.speed * 0.4, FOAM.slamStrength);
      const n = Math.min(260, Math.round(s.speed * SPRAY.slamParticlesPerMs));
      const v = sim.state.linvel;
      this.spray.emit(n, s.x, s.y + 0.1, s.z, v.x * 0.7, 3 + s.speed * 1.1, v.z * 0.7, 3.5 + s.speed * 0.8, 1.5, 2.2);
    }
    // Bow spray at speed, from the bow shoulders.
    if (kn > 7) {
      this.bowAcc += SPRAY.bowRatePerKn * (kn - 7) * dt;
      const n = Math.floor(this.bowAcc);
      this.bowAcc -= n;
      if (n > 0) {
        const v = sim.state.linvel;
        for (const side of [1, -1]) {
          this.local(side * B * 0.34, 0.05, L / 2 - 2.2, p);
          const out = {};
          this.local(side * (1.5 + u * 0.12), 0, 0, out);
          const ox = out.x - sim.state.pos.x;
          const oz = out.z - sim.state.pos.z;
          this.spray.emit(n, p.x, p.y, p.z, v.x * 0.55 + ox, 1.5 + u * 0.18, v.z * 0.55 + oz, 1.6, 0.7, 1.3);
        }
      }
    }
  }
}
