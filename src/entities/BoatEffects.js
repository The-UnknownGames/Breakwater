// Visual effects driven by a boat's physics state: moving wake particles
// (centre wash, quarter streaks, Kelvin bow-wave V), hull-contact foam, prop wash,
// ventilation churn, slam foam + spray bursts, and bow spray at speed.

import { FOAM, SPRAY, WAKE } from '../config/render.js';
import { hullStation } from '../physics/HullShape.js';

const KN = 0.514444;
const KELVIN = Math.tan((19.5 * Math.PI) / 180);

export class BoatEffects {
  constructor(boat, foam, spray, wake = null) {
    this.boat = boat;
    this.foam = foam;
    this.spray = spray;
    this.wake = wake;
    this.wakeAcc = 0;
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
    // Moving wake particles (see ocean/Wake.js): drop one set per
    // WAKE.spacing metres travelled.
    if (this.wake) {
      this.wakeAcc += moved;
      const wake = Math.min(1, u / 4);
      const bow = Math.min(1, u / 5);
      const fwd = sim.forward;
      const side = { x: fwd.z, z: -fwd.x };
      const vel = sim.state.linvel;
      const sp = Math.hypot(vel.x, vel.z) || 1;
      while (this.wakeAcc >= WAKE.spacing && wake > 0.03) {
        this.wakeAcc -= WAKE.spacing;
        // Emissions owed this frame are spread back along the track (and
        // back-dated), so low frame rates don't bead the wake.
        const back = this.wakeAcc;
        const age = back / Math.max(u, 0.5);
        const bx = (-vel.x / sp) * back;
        const bz = (-vel.z / sp) * back;
        const W = this.wake;
        const norm = WAKE.spacing / (B * 0.5);
        this.local(0, 0, -L / 2 + 0.2, p);
        W.emit(p.x + bx, p.z + bz, 0, 0, B * 0.22, WAKE.centreGrow + 0.012 * u, WAKE.centreStrength * wake * norm, WAKE.centreLife, age);
        for (const s of [1, -1]) {
          const out = s * 0.1 * u;
          this.local(s * B * 0.42, 0, -L / 2 + 0.1, p);
          W.emit(p.x + bx, p.z + bz, side.x * out, side.z * out, B * 0.1, 0.08, WAKE.quarterStrength * wake * norm * 1.6, WAKE.quarterLife, age);
          if (bow > 0.1) {
            // Bow-wave crest: runs outward at tan(19.5°) of boat speed.
            const k = s * KELVIN * u;
            this.local(s * B * 0.45, 0, L / 2 - 2.2, p);
            W.emit(p.x + bx, p.z + bz, side.x * k, side.z * k, 0.5, 0.06, WAKE.kelvinStrength * bow * norm * 2, WAKE.kelvinLife, age);
          }
        }
      }
    }
    // Hull footprint: shades the water against the hull (this frame only).
    for (let k = 0; k < 7; k++) {
      const st = hullStation(h, (k + 0.5) / 7);
      this.local(0, 0, st.z, p);
      foam.paintShade(p.x, p.z, st.halfBeam * 1.35 + 0.4, 0.55);
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
    const thrust = sim.cfg.prop ? Math.abs(pr.thrust) / sim.cfg.prop.thrustMax : 0;
    const propPos = sim.cfg.prop ? sim.cfg.prop.pos : [0, 0, -L / 2];
    this.local(propPos[0], 0, propPos[2] - 1.2 * Math.sign(pr.thrust || 1), p);
    if (thrust > 0.05) {
      foam.paint(p.x, p.z, 1.1 + thrust, thrust * 0.005 * f60);
    }
    if (pr.ventilation > 0.2) {
      foam.paint(p.x, p.z, 1.6, pr.ventilation * 0.3 * f60);
      const nv = Math.ceil(pr.ventilation * 40 * dt);
      this.spray.droplets(nv * 4, p.x, p.y + 0.2, p.z, 0, 2.5, 0, 3, 0.2, 0.8);
      this.spray.mist(nv, p.x, p.y + 0.3, p.z, 0, 1, 0, 1.5, 1.2, 1.6);
    }
    // Slams: foam burst + spray.
    for (const s of slams) {
      foam.paint(s.x, s.z, 2 + s.speed * 0.4, FOAM.slamStrength);
      const n = Math.min(360, Math.round(s.speed * SPRAY.slamParticlesPerMs));
      const v = sim.state.linvel;
      // A sheet of droplets flung up and out, and a mist cloud that lingers
      // and drifts downwind.
      this.spray.droplets(n, s.x, s.y + 0.1, s.z, v.x * 0.75, 3 + s.speed * 1.2, v.z * 0.75, 3 + s.speed * 0.9, 0.3, 1.5);
      this.spray.mist(Math.ceil(n / 2.2), s.x, s.y + 0.5, s.z, v.x * 0.5, 1.8 + s.speed * 0.7, v.z * 0.5, 3.6, 1.9, 3.8);
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
          this.spray.droplets(n, p.x, p.y, p.z, v.x * 0.55 + ox, 1.5 + u * 0.18, v.z * 0.55 + oz, 1.6, 0.2, 1.0);
          if (this.spray.rng() < 0.7 * n) {
            this.spray.mist(1, p.x, p.y + 0.3, p.z, v.x * 0.4 + ox * 0.5, 1.3, v.z * 0.4 + oz * 0.5, 1.2, 1.5, 2.6);
          }
        }
      }
    }
  }
}
