// Mooring lines (V7), pure JS. Come alongside a pier or the quay slowly and
// roughly parallel and the lines go ashore by themselves: a bow and a stern
// line (springs to her berth alongside, fender distance off the face) hold
// her there. Throttle hard or cast off (Space at the helm) to let go.

import { MOORING } from '../config/onfoot.js';
import { hullStation, sectionPoint } from '../physics/HullShape.js';
import { rotate, cross, vec } from '../core/math.js';

const KN = 0.514444;
const DEG = Math.PI / 180;

export class Mooring {
  // sim: BoatPhysics; ground: TownGround (towns with mooring edges).
  constructor(sim, ground) {
    this.sim = sim;
    this.ground = ground;
    this.lines = null; // { bow: {local, target, bollard}, stern: {...}, town, edge }
    this.armed = true;
    this.tmp = { p: vec(), r: vec(), v: vec(), t: vec(), F: vec() };
    this.hook = (s, f) => this.apply(s, f);
    const m = sim.cfg.mass;
    const w = (2 * Math.PI) / MOORING.periodSec;
    // Per line, each holding half her mass.
    this.k = (m / 2) * w * w;
    this.c = 2 * MOORING.damping * Math.sqrt(this.k * (m / 2));
    this.maxF = MOORING.maxForceG * m * 9.81;
  }

  get moored() {
    return Boolean(this.lines);
  }

  halfBeam() {
    const h = this.sim.cfg.hull;
    return sectionPoint(hullStation(h, h.maxBeamAt), 1).x;
  }

  // Frame-space geometry of an edge: direction u (unit, along the face),
  // normal n (out to the water), start point, length.
  static edgeGeom(e) {
    const len = Math.hypot(e.a1 - e.a0, e.o1 - e.o0);
    return { ua: (e.a1 - e.a0) / len, uo: (e.o1 - e.o0) / len, len };
  }

  // Try to throw the lines (called every step while not moored).
  // Returns the capture or null.
  find(force = false) {
    const sim = this.sim;
    const s = sim.state;
    const town = this.ground.townAt(s.pos.x, s.pos.z);
    if (!town || (!force && sim.speed / KN > MOORING.maxKn)) {
      return null;
    }
    const f = town.frame;
    const l = f.toLocal(s.pos.x, s.pos.z, {});
    const fw = sim.forward;
    const fa = fw.x * f.ax + fw.z * f.az;
    const fo = fw.x * f.ox + fw.z * f.oz;
    const fl = Math.hypot(fa, fo) || 1;
    const hb = this.halfBeam();
    const L = sim.cfg.hull.length;
    let best = null;
    for (const e of town.edges) {
      const g = Mooring.edgeGeom(e);
      const cos = (fa * g.ua + fo * g.uo) / fl;
      if (Math.abs(cos) < Math.cos(MOORING.maxAngleDeg * DEG)) {
        continue;
      }
      const da = l.a - e.a0;
      const dO = l.o - e.o0;
      const along = da * g.ua + dO * g.uo;
      const off = da * e.n.a + dO * e.n.o; // centreline distance off the face
      if (along < L * 0.25 || along > g.len - L * 0.25 || off <= 0) {
        continue;
      }
      const gap = off - hb;
      if (gap > MOORING.captureGap || gap < -0.5) {
        continue;
      }
      if (!best || gap < best.gap) {
        best = { edge: e, g, along, off, gap, dir: Math.sign(cos), town };
      }
    }
    return best;
  }

  // Lines ashore for a capture from find().
  make(c) {
    const f = c.town.frame;
    const L = this.sim.cfg.hull.length;
    const hb = this.halfBeam();
    const off = hb + MOORING.fender;
    const e = c.edge;
    const line = (dz) => {
      // Her point dz along her length, and its berth alongside the face.
      const along = c.along + c.dir * dz;
      const a = e.a0 + c.g.ua * along + e.n.a * off;
      const o = e.o0 + c.g.uo * along + e.n.o * off;
      const target = f.toWorld(a, o, {});
      let bollard = null;
      let bd = Infinity;
      for (const b of c.town.bollards) {
        const d = Math.hypot(b.a - (a - e.n.a * off), b.o - (o - e.n.o * off));
        if (d < bd) {
          bd = d;
          bollard = b;
        }
      }
      const bw = bollard ? f.toWorld(bollard.a, bollard.o, {}) : target;
      return { local: vec(0, 0, dz), target, bollard: bollard ? { x: bw.x, y: bollard.y + 0.4, z: bw.z } : null };
    };
    this.lines = { bow: line(L * 0.35), stern: line(-L * 0.35), town: c.town, edge: e };
    this.sim.extraForces.push(this.hook);
    return this.lines;
  }

  release() {
    if (!this.lines) {
      return;
    }
    const i = this.sim.extraForces.indexOf(this.hook);
    if (i >= 0) {
      this.sim.extraForces.splice(i, 1);
    }
    this.lines = null;
    this.armed = false;
  }

  // Fixed step: throw lines when she comes alongside; slip them when she
  // throttles away. Returns 'moored' | 'slipped' | null (events).
  update(dt, throttle) {
    if (this.lines) {
      if (Math.abs(throttle) >= MOORING.slipThrottle) {
        this.release();
        return 'slipped';
      }
      return null;
    }
    const c = this.find();
    if (!this.armed) {
      // Re-arm once she is well clear of any face (or moving).
      const near = this.find(true);
      if (!near || near.gap > MOORING.rearmGap) {
        this.armed = true;
      }
      return null;
    }
    if (c && Math.abs(throttle) < MOORING.slipThrottle) {
      this.make(c);
      return 'moored';
    }
    return null;
  }

  // Spring-damper on each line point toward its berth (horizontal only).
  apply(s, f) {
    const t = this.tmp;
    for (const ln of [this.lines.bow, this.lines.stern]) {
      rotate(s.rot, ln.local, t.p);
      t.r.x = t.p.x + s.pos.x - s.com.x;
      t.r.y = t.p.y + s.pos.y - s.com.y;
      t.r.z = t.p.z + s.pos.z - s.com.z;
      cross(s.angvel, t.r, t.v);
      const vx = s.linvel.x + t.v.x;
      const vz = s.linvel.z + t.v.z;
      const dx = ln.target.x - (s.pos.x + t.p.x);
      const dz = ln.target.z - (s.pos.z + t.p.z);
      let fx = this.k * dx - this.c * vx;
      let fz = this.k * dz - this.c * vz;
      const m = Math.hypot(fx, fz);
      if (m > this.maxF) {
        fx *= this.maxF / m;
        fz *= this.maxF / m;
      }
      ln.tension = Math.min(m, this.maxF);
      t.F.x = fx;
      t.F.y = 0;
      t.F.z = fz;
      cross(t.r, t.F, t.t);
      f.fx += fx;
      f.fz += fz;
      f.tx += t.t.x;
      f.ty += t.t.y;
      f.tz += t.t.z;
    }
  }
}
