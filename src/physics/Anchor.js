// Anchor (RP / leisure): a rode from the bow roller to a point on the
// seabed. The boat swings freely inside the scope (3x depth + 15 m); past it
// the rode pulls horizontally at the bow, a spring-damper like the tow line,
// so the boat lies head to wind and sea. Pulled harder than its holding
// power (motoring away, a storm) it drags. A PhysicsWorld link. Pure JS.

import { rotate, cross, vec } from '../core/math.js';
import { ANCHOR } from '../config/tow.js';

export class Anchor {
  // body: BoatPhysics; local: bow point (body frame); x, z: where it holds;
  // depth: water depth there (m).
  constructor(body, local, x, z, depth) {
    this.body = body;
    this.local = local;
    this.x = x;
    this.z = z;
    this.depth = depth;
    this.scope = ANCHOR.scopeRatio * depth + ANCHOR.scopeExtra;
    this.k = body.cfg.mass * ANCHOR.stiffnessPerTonne / 1000;
    this.c = 2 * ANCHOR.damping * Math.sqrt(this.k * body.cfg.mass);
    this.tension = 0;
    this.p = vec();
    this.F = vec();
    this.tmp = { r: vec(), t: vec(), v: vec() };
    this.hook = (s, f) => this.apply(s, f);
    body.extraForces.push(this.hook);
  }

  preStep() {
    const s = this.body.state;
    rotate(s.rot, this.local, this.p);
    this.p.x += s.pos.x;
    this.p.y += s.pos.y;
    this.p.z += s.pos.z;
    const dx = this.x - this.p.x;
    const dz = this.z - this.p.z;
    const d = Math.hypot(dx, dz) || 1e-6;
    this.distance = d;
    // Bow velocity away from the anchor.
    const r = this.tmp.r;
    r.x = this.p.x - s.com.x;
    r.y = this.p.y - s.com.y;
    r.z = this.p.z - s.com.z;
    const v = cross(s.angvel, r, this.tmp.v);
    const away = -((s.linvel.x + v.x) * dx + (s.linvel.z + v.z) * dz) / d;
    let T = 0;
    this.dragging = false;
    if (d > this.scope) {
      T = Math.max(0, this.k * (d - this.scope) + this.c * away);
      // Past its holding power the anchor drags: it slides after the boat.
      const hold = this.body.cfg.mass * ANCHOR.holding;
      if (T > hold) {
        this.dragging = true;
        const slide = (d - this.scope - hold / this.k) * 0.5;
        if (slide > 0) {
          this.x -= (dx / d) * slide;
          this.z -= (dz / d) * slide;
        }
        T = hold;
      }
    }
    this.tension = T;
    this.F.x = (dx / d) * T;
    this.F.y = 0;
    this.F.z = (dz / d) * T;
  }

  apply(s, f) {
    const r = this.tmp.r;
    r.x = this.p.x - s.com.x;
    r.y = this.p.y - s.com.y;
    r.z = this.p.z - s.com.z;
    const t = cross(r, this.F, this.tmp.t);
    f.fx += this.F.x;
    f.fz += this.F.z;
    f.tx += t.x;
    f.ty += t.y;
    f.tz += t.z;
  }

  detach() {
    const list = this.body.extraForces;
    const i = list.indexOf(this.hook);
    if (i >= 0) {
      list.splice(i, 1);
    }
    this.tension = 0;
  }
}
