// Tow line (spec 3.6): a spring-damper with slack between the tug's tow
// point and the target's bow cleat. Pure JS; registered as a PhysicsWorld
// link so it computes once per step from both bodies' states, then pushes
// equal and opposite forces into each body's force accumulator.
//   d > L : T = k (d - L) + c ḋ, clamped >= 0 (k: 15% stretch at break)
//   d <= L: slack, T = 0
// Breaks after 0.25 s above the rating, or instantly above 1.5x. The winch
// pays out / hauls in L (10-120 m); the auto-tension upgrade renders line
// out on spikes and recovers it as the load falls.

import { rotate, cross, vec } from '../core/math.js';
import { TOW } from '../config/tow.js';

function massOf(body) {
  return body.cfg.mass;
}

export class TowLine {
  // tug/target: { body: BoatPhysics, local: {x, y, z} } (body frame, metres).
  constructor(tug, target, opts = {}) {
    this.tug = tug;
    this.target = target;
    this.breakingN = opts.breakingN ?? tug.body.cfg.towBreakingKN * 1000;
    this.length = opts.length ?? TOW.defaultLength;
    this.setLength = this.length;
    this.autoTension = Boolean(opts.autoTension);
    this.tension = 0;
    this.peak = 0;
    this.peakAge = 0;
    this.maxTension = 0;
    this.meanT = 0;
    this.overTime = 0;
    this.broken = false;
    this.distance = 0;
    this.rate = 0;
    this.winchInput = 0;
    this.onBreak = null;
    const m1 = massOf(tug.body);
    const m2 = massOf(target.body);
    this.mEff = (m1 * m2) / (m1 + m2);
    this.pa = vec();
    this.pb = vec();
    this.dir = vec();
    this.tmp = { r: vec(), v: vec(), va: vec(), vb: vec(), F: vec(), t: vec() };
    // Force hooks on each body: apply the force computed in preStep.
    this.forceA = vec();
    this.forceB = vec();
    this.hookA = (s, f) => this.apply(s, f, this.pa, this.forceA);
    this.hookB = (s, f) => this.apply(s, f, this.pb, this.forceB);
    tug.body.extraForces.push(this.hookA);
    target.body.extraForces.push(this.hookB);
  }

  get ratio() {
    return this.tension / this.breakingN;
  }

  get taut() {
    return this.distance > this.length;
  }

  // Axial stiffness of the current length of line (N/m).
  get stiffness() {
    return this.breakingN / (TOW.stretchAtBreak * this.length);
  }

  detach() {
    for (const [end, hook] of [
      [this.tug, this.hookA],
      [this.target, this.hookB],
    ]) {
      const list = end.body.extraForces;
      const i = list.indexOf(hook);
      if (i >= 0) {
        list.splice(i, 1);
      }
    }
    this.tension = 0;
  }

  // World position and velocity of an attachment point.
  endPoint(end, outP, outV) {
    const s = end.body.state;
    rotate(s.rot, end.local, outP);
    outP.x += s.pos.x;
    outP.y += s.pos.y;
    outP.z += s.pos.z;
    const r = this.tmp.r;
    r.x = outP.x - s.com.x;
    r.y = outP.y - s.com.y;
    r.z = outP.z - s.com.z;
    cross(s.angvel, r, outV);
    outV.x += s.linvel.x;
    outV.y += s.linvel.y;
    outV.z += s.linvel.z;
  }

  // PhysicsWorld link: runs before the bodies' preStep each fixed step.
  preStep(dt) {
    if (this.broken) {
      return;
    }
    this.winch(dt);
    const t = this.tmp;
    this.endPoint(this.tug, this.pa, t.va);
    this.endPoint(this.target, this.pb, t.vb);
    const dx = this.pb.x - this.pa.x;
    const dy = this.pb.y - this.pa.y;
    const dz = this.pb.z - this.pa.z;
    const d = Math.hypot(dx, dy, dz) || 1e-6;
    const dir = this.dir;
    dir.x = dx / d;
    dir.y = dy / d;
    dir.z = dz / d;
    // ḋ: separation rate of the two ends along the line.
    const rate = (t.vb.x - t.va.x) * dir.x + (t.vb.y - t.va.y) * dir.y + (t.vb.z - t.va.z) * dir.z;
    this.distance = d;
    this.rate = rate;
    let T = 0;
    if (d > this.length) {
      const k = this.stiffness;
      const c = 2 * TOW.dampingRatio * Math.sqrt(k * this.mEff);
      T = Math.max(0, k * (d - this.length) + c * rate);
    }
    this.tension = T;
    this.maxTension = Math.max(this.maxTension, T);
    this.peakAge += dt;
    if (T >= this.peak || this.peakAge > TOW.peakHoldSeconds) {
      this.peak = T;
      this.peakAge = 0;
    }
    // Tug is pulled toward the target (+dir), target toward the tug.
    this.forceA.x = dir.x * T;
    this.forceA.y = dir.y * T;
    this.forceA.z = dir.z * T;
    this.forceB.x = -dir.x * T;
    this.forceB.y = -dir.y * T;
    this.forceB.z = -dir.z * T;
    this.checkBreak(dt, T);
  }

  checkBreak(dt, T) {
    const B = this.breakingN;
    if (T > B * TOW.breakInstantRatio) {
      this.snap();
      return;
    }
    this.overTime = T > B ? this.overTime + dt : 0;
    if (this.overTime > TOW.breakHoldSeconds) {
      this.snap();
    }
  }

  snap() {
    this.broken = true;
    this.detach();
    if (this.onBreak) {
      this.onBreak(this);
    }
  }

  winch(dt) {
    const w = TOW.autoTension;
    const input = this.winchInput;
    if (input > 0) {
      this.setLength = Math.min(TOW.maxLength, this.setLength + TOW.payOutRate * dt);
    } else if (input < 0) {
      // Hauling slows as the load approaches the winch's stall.
      const load = Math.min(1, this.ratio / TOW.haulStallRatio);
      this.setLength = Math.max(TOW.minLength, this.setLength - TOW.haulInRate * (1 - load) * dt);
    }
    if (!this.autoTension) {
      this.length = this.setLength;
      return;
    }
    // Render against spikes: pay out while the load is well above its
    // running mean (and the ends are separating), recover once it eases.
    const T = this.tension;
    this.meanT += (T - this.meanT) * Math.min(1, dt / w.meanSeconds);
    const render = Math.max(w.floorRatio * this.breakingN, this.meanT * w.meanFactor);
    if (T > render && this.rate > 0) {
      const pay = Math.min(w.maxPayOut, (T - render) * w.payOutGain);
      this.length = Math.min(this.length + pay * dt, this.setLength + w.maxExtra, TOW.maxLength);
    } else if (T < this.meanT) {
      this.length = Math.max(this.setLength, this.length - w.recoverRate * dt);
    }
    if (input !== 0) {
      this.length = Math.max(this.length, this.setLength);
      if (input < 0) {
        this.length = Math.min(this.length, Math.max(this.setLength, this.length - TOW.haulInRate * dt));
      }
    }
  }

  // Force hook: adds this line's pull at the attachment point.
  apply(s, f, p, F) {
    if (this.broken) {
      return;
    }
    const r = this.tmp.r;
    r.x = p.x - s.com.x;
    r.y = p.y - s.com.y;
    r.z = p.z - s.com.z;
    const t = cross(r, F, this.tmp.t);
    f.fx += F.x;
    f.fy += F.y;
    f.fz += F.z;
    f.tx += t.x;
    f.ty += t.y;
    f.tz += t.z;
  }
}
