// Voxel buoyancy + anisotropic hydrodynamic drag + slamming (spec 3.3).
// Pure JS: returns a total force and a torque about the centre of mass so the
// caller can apply them to any rigid-body engine.

import { buildHullMesh } from './HullShape.js';
import { voxelize } from './Voxelize.js';
import { rotate, rotateInv, cross, vec } from '../core/math.js';
import { PHYS } from '../config/physics.js';

function fraction(py, h, waterY) {
  const f = (waterY - (py - h / 2)) / h;
  return f < 0 ? 0 : f > 1 ? 1 : f;
}

export class HullBuoyancy {
  constructor(cfg) {
    const h = cfg.hull;
    this.cfg = cfg;
    this.mesh = buildHullMesh(h, 28, 10, true);
    const dims = { beam: h.beam, length: h.length, depth: h.draft + h.freeboard + h.sheerRise };
    const vox = voxelize(this.mesh, dims, cfg.voxel.fine, cfg.voxel.budget);
    this.points = vox.points;
    this.rawVolume = vox.totalVolume;
    // Scale volumes so the upright hull floats exactly at the DWL in calm water.
    let vDwl = 0;
    let mz = 0;
    for (const p of this.points) {
      const f = fraction(p.y, p.h, 0);
      vDwl += p.v * f;
      mz += p.v * f * p.z;
    }
    this.volumeScale = cfg.mass / (PHYS.rhoWater * vDwl);
    this.lcb = mz / vDwl;
    let reserve = 0;
    for (const p of this.points) {
      p.v *= this.volumeScale;
      p.area = p.v / p.h;
      p.wasWet = false;
      reserve += p.v;
    }
    this.totalVolume = reserve;
    // Mean horizontal spacing of the buoyancy points (wave filter footprint).
    this.footprint = Math.sqrt((h.length * h.beam) / (this.points.length / 2));
    this.designVolume = cfg.mass / PHYS.rhoWater;
    this.dragNorm = 1 / (vDwl * this.volumeScale);
    // Keel/skeg: lateral resistance weighted aft for directional stability.
    const aft = cfg.drag.lat.aftBias || 0;
    let wSum = 0;
    let wBias = 0;
    for (const p of this.points) {
      p.latW = Math.max(0.2, 1 - aft * (p.z / (h.length / 2)));
      const f = fraction(p.y, p.h, 0);
      wSum += p.v * f;
      wBias += p.v * f * p.latW;
    }
    for (const p of this.points) {
      p.latW *= wSum / wBias;
    }
    this.world = this.points.map(() => ({ x: 0, y: 0, z: 0, f: 0, depth: 0 }));
    this.tmp = { local: vec(), r: vec(), v: vec(), vl: vec(), F: vec(), Fl: vec(), t: vec(), water: {} };
    this.slams = [];
    this.submergedVolume = 0;
    this.bowDepth = 0;
  }

  // state: { pos, rot, linvel, angvel, com } (world). current: {x, z} m/s.
  compute(state, waves, t, current, out) {
    const { pos, rot, linvel, angvel, com } = state;
    const d = this.cfg.drag;
    const rho = PHYS.rhoWater;
    const g = PHYS.gravity;
    const slamV = this.cfg.slam.speed;
    const tmp = this.tmp;
    let fx = 0;
    let fy = 0;
    let fz = 0;
    let tx = 0;
    let ty = 0;
    let tz = 0;
    let sub = 0;
    // Deepest immersion of the forward quarter (hull waves, spray).
    let bowDepth = -Infinity;
    const bowFrom = this.cfg.hull.length * 0.25;
    this.slams.length = 0;
    rotateInv(rot, linvel, tmp.vl);
    const uAbs = Math.abs(tmp.vl.z);
    // Planing (opt-in, cfg.planing): dynamic lift on the wetted bottom,
    // 1/2 rho Cl A u^2 along hull-up, faded in from half to full planing
    // speed. The hull rises, wets less and so drags less.
    const pl = this.cfg.planing;
    let planeQ = 0;
    if (pl && tmp.vl.z > 0) {
      const on = Math.min(1, Math.max(0, (tmp.vl.z / (pl.fromKn * 0.514444) - 0.5) * 2));
      planeQ = 0.5 * rho * pl.cl * tmp.vl.z * tmp.vl.z * on * on * (3 - 2 * on);
    }
    let lift = 0;
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const wp = this.world[i];
      rotate(rot, p, tmp.local);
      const px = pos.x + tmp.local.x;
      const py = pos.y + tmp.local.y;
      const pz = pos.z + tmp.local.z;
      wp.x = px;
      wp.y = py;
      wp.z = pz;
      const water = waves.sample(px, pz, t, undefined, tmp.water, py, this.footprint);
      const f = fraction(py, p.h, water.height);
      wp.f = f;
      wp.depth = water.height - py;
      if (p.z > bowFrom && wp.depth > bowDepth) {
        bowDepth = wp.depth;
      }
      if (f <= 0) {
        p.wasWet = false;
        continue;
      }
      sub += p.v * f;
      // Point velocity relative to the moving water.
      tmp.r.x = px - com.x;
      tmp.r.y = py - com.y;
      tmp.r.z = pz - com.z;
      cross(angvel, tmp.r, tmp.v);
      tmp.v.x += linvel.x - water.vx - current.x;
      tmp.v.y += linvel.y - water.vy;
      tmp.v.z += linvel.z - water.vz - current.z;
      rotateInv(rot, tmp.v, tmp.vl);
      const w = p.v * this.dragNorm * f;
      const vl = tmp.vl;
      // Hull lift at speed adds sway/heave (hence roll) damping ∝ forward speed.
      const latLin = d.lat.lin + d.lat.speedLin * uAbs;
      const vertLin = d.vert.lin + d.vert.speedLin * uAbs;
      // Sway and surge resist in the hull frame; heave resists world-vertical
      // motion relative to the water, so forward speed on a trimmed hull
      // never turns into spurious cross-flow lift.
      const vy = tmp.v.y;
      tmp.Fl.x = -(d.lat.quad * Math.abs(vl.x) * vl.x + latLin * vl.x) * w * p.latW;
      tmp.Fl.y = 0;
      tmp.Fl.z = -(d.long.quad * Math.abs(vl.z) * vl.z + d.long.lin * vl.z) * w;
      rotate(rot, tmp.Fl, tmp.F);
      tmp.F.y -= (d.vert.quad * Math.abs(vy) * vy + vertLin * vy) * w;
      let up = rho * g * p.v * f;
      // Slamming: fast entry of a point that was dry or barely wet.
      if (tmp.v.y < -slamV && f < 0.7) {
        const extra = 0.5 * rho * this.cfg.slam.coefficient * p.area * tmp.v.y * tmp.v.y * (1 - f);
        up += extra;
        if (!p.wasWet) {
          this.slams.push({ x: px, y: water.height, z: pz, speed: -tmp.v.y, force: extra });
        }
      }
      p.wasWet = true;
      tmp.F.y += up;
      if (planeQ > 0) {
        const L = planeQ * p.area * Math.min(1, f / 0.15);
        tmp.Fl.x = 0;
        tmp.Fl.y = L;
        tmp.Fl.z = 0;
        rotate(rot, tmp.Fl, tmp.vl);
        tmp.F.x += tmp.vl.x;
        tmp.F.y += tmp.vl.y;
        tmp.F.z += tmp.vl.z;
        lift += L;
      }
      fx += tmp.F.x;
      fy += tmp.F.y;
      fz += tmp.F.z;
      cross(tmp.r, tmp.F, tmp.t);
      tx += tmp.t.x;
      ty += tmp.t.y;
      tz += tmp.t.z;
    }
    this.submergedVolume = sub;
    this.bowDepth = bowDepth;
    this.planingLift = lift;
    out.fx += fx;
    out.fy += fy;
    out.fz += fz;
    out.tx += tx;
    out.ty += ty;
    out.tz += tz;
    return out;
  }
}
