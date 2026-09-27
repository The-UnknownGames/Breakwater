// First-person walker (V7), pure JS and fixed-step. Kinematic: the feet
// always stand on a support (a town slab or a boat deck), so there is no
// falling through the world, and a move with nothing to stand on is
// refused (you can't walk off a pier; the gap to a boat is crossed with a
// short clamber). On a deck the walker rides the boat: its spot is kept
// in the boat frame and re-posed every step as she moves.

import { FOOT } from '../config/onfoot.js';
import { vec } from '../core/math.js';

const TMP = { a: vec(), b: vec(), list: [] };

export class Walker {
  // ground: TownGround; decks: () => BoatDeck[] (walkable boats now).
  constructor(ground, decks) {
    this.ground = ground;
    this.decks = decks;
    this.pos = vec(); // feet, world
    this.vel = vec();
    this.yaw = 0; // compass-style: 0 faces +Z... see forward()
    this.pitch = 0;
    this.support = null; // { top, surface, owner, local? }
    this.surface = 'concrete';
    this.speed = 0;
    this.moved = 0; // metres walked (footsteps)
    this.bob = 0; // stride phase (rad)
    this.transition = null; // clamber: { from, to, t, dur, support }
    this.eyeY = 0; // smoothed eye height above the feet support
    this.inside = null; // building (enterable) around the walker
  }

  // Heading the walker faces: yaw 0 looks along world -Z (north); yaw
  // grows clockwise seen from above (compass). Forward = (sin, -cos).
  forward(out = vec()) {
    out.x = Math.sin(this.yaw);
    out.y = 0;
    out.z = -Math.cos(this.yaw);
    return out;
  }

  // Place the walker at a world point (standing on whatever is there).
  place(x, y, z, yaw = this.yaw) {
    this.pos.x = x;
    this.pos.y = y;
    this.pos.z = z;
    this.yaw = yaw;
    this.vel.x = 0;
    this.vel.z = 0;
    this.transition = null;
    const s = this.bestSupport(x, z, y + 0.6, 3);
    this.support = s;
    if (s) {
      this.pos.y = s.top;
      this.surface = s.surface;
    }
    return Boolean(s);
  }

  // Every support under (x, z), and the best one reachable from feet at y:
  // the highest top no more than `up` above and no more than dropMax below.
  bestSupport(x, z, y, up = FOOT.stepUp) {
    const list = TMP.list;
    list.length = 0;
    this.ground.supports(x, z, list);
    for (const d of this.decks()) {
      const s = d.support(x, z, y);
      if (s) {
        list.push(s);
      }
    }
    let best = null;
    for (const s of list) {
      if (s.top <= y + up && s.top >= y - FOOT.dropMax && (!best || s.top > best.top)) {
        best = s;
      }
    }
    return best ? { ...best } : null;
  }

  // move: { forward (-1..1), strafe (-1..1, + right), jog }, look: radians
  // this step { yaw, pitch }.
  step(dt, move, look) {
    this.yaw += look.yaw;
    this.pitch = Math.max(-FOOT.pitchLimit, Math.min(FOOT.pitchLimit, this.pitch + look.pitch));
    // Ride the boat: re-pose the deck spot we stand on.
    const sup = this.support;
    if (sup && sup.local && !this.transition) {
      const w = sup.owner.toWorld(sup.local.x, sup.owner.deckY(sup.local.x, sup.local.z) ?? 0, sup.local.z, TMP.a);
      this.pos.x = w.x;
      this.pos.y = w.y;
      this.pos.z = w.z;
    }
    if (this.transition) {
      this.clamber(dt);
      return;
    }
    const f = this.forward(TMP.b);
    const rx = -f.z; // right of forward
    const rz = f.x;
    let mf = move.forward;
    let ms = move.strafe;
    const m = Math.hypot(mf, ms);
    if (m > 1) {
      mf /= m;
      ms /= m;
    }
    const top = move.jog ? FOOT.jogSpeed : FOOT.walkSpeed;
    const wx = (f.x * mf + rx * ms) * top;
    const wz = (f.z * mf + rz * ms) * top;
    const k = Math.min(1, FOOT.accel * dt / Math.max(0.5, top));
    this.want = { x: wx, z: wz };
    this.vel.x += (wx - this.vel.x) * k;
    this.vel.z += (wz - this.vel.z) * k;
    if (Math.hypot(this.vel.x, this.vel.z) < 0.02 && m === 0) {
      this.vel.x = 0;
      this.vel.z = 0;
    }
    this.tryMove(dt);
    this.inside = this.ground.buildingAt(this.pos.x, this.pos.z);
  }

  tryMove(dt) {
    const p = this.pos;
    let nx = p.x + this.vel.x * dt;
    let nz = p.z + this.vel.z * dt;
    const c = this.ground.collide(nx, nz, p.y, FOOT.radius, TMP.a);
    nx = c.x;
    nz = c.z;
    for (const d of this.decks()) {
      const b = d.collide(nx, nz, p.y, FOOT.radius, TMP.a);
      nx = b.x;
      nz = b.z;
    }
    const s = this.bestSupport(nx, nz, p.y);
    const moved = Math.hypot(nx - p.x, nz - p.z);
    if (s) {
      this.accept(nx, nz, s, moved, dt);
      return;
    }
    // Nothing to stand on: the edge of a pier, a deck or the quay. Look a
    // stride ahead for another boat or the shore to clamber onto.
    // Probe along where the walker wants to go (the velocity is small after
    // bumping the edge).
    const want = this.want || this.vel;
    const sp = Math.hypot(want.x, want.z);
    if (sp > 0.3) {
      const ux = want.x / sp;
      const uz = want.z / sp;
      for (let dist = 0.5; dist <= 1.6; dist += 0.25) {
        const tx = p.x + ux * dist;
        const tz = p.z + uz * dist;
        const t = this.bestSupport(tx, tz, p.y, FOOT.climb);
        if (t && t.owner !== (this.support && this.support.owner)) {
          this.transition = { from: { x: p.x, y: p.y, z: p.z }, to: { x: tx, y: t.top, z: tz }, t: 0, dur: 0.35 + Math.abs(t.top - p.y) * 0.25, support: t };
          return;
        }
      }
    }
    // Slide along the edge: keep the component that stays supported.
    for (const [ax, az] of [[nx, p.z], [p.x, nz]]) {
      const s2 = this.bestSupport(ax, az, p.y);
      if (s2 && (ax !== p.x || az !== p.z)) {
        this.accept(ax, az, s2, Math.hypot(ax - p.x, az - p.z), dt);
        return;
      }
    }
    this.vel.x = 0;
    this.vel.z = 0;
    this.speed = 0;
  }

  accept(x, z, s, moved, dt) {
    const p = this.pos;
    p.x = x;
    p.z = z;
    p.y = s.top;
    this.support = s;
    this.surface = s.surface;
    this.speed = moved / dt;
    this.moved += moved;
    const b = FOOT.bob;
    const hz = this.speed > FOOT.walkSpeed * 1.3 ? b.jogHz : b.walkHz;
    this.bob += moved > 0 ? hz * Math.PI * 2 * dt * Math.min(1, this.speed / FOOT.walkSpeed) : 0;
  }

  // Clamber over the gunwale / onto the pier: an arc over dur seconds.
  clamber(dt) {
    const tr = this.transition;
    tr.t = Math.min(1, tr.t + dt / tr.dur);
    const k = tr.t * tr.t * (3 - 2 * tr.t);
    // A moving boat under either end: aim at the live spot.
    let to = tr.to;
    const s = tr.support;
    if (s.local) {
      to = s.owner.toWorld(s.local.x, s.owner.deckY(s.local.x, s.local.z) ?? 0, s.local.z, TMP.a);
    }
    const p = this.pos;
    p.x = tr.from.x + (to.x - tr.from.x) * k;
    p.z = tr.from.z + (to.z - tr.from.z) * k;
    p.y = tr.from.y + (to.y - tr.from.y) * k + Math.sin(Math.PI * tr.t) * 0.35;
    this.vel.x = 0;
    this.vel.z = 0;
    if (tr.t >= 1) {
      this.support = s;
      this.surface = s.surface;
      this.transition = null;
      p.y = to.y;
      this.moved += 0.9;
    }
  }

  // Eye position (world) with head bob.
  eye(out = vec()) {
    const b = FOOT.bob;
    const amt = Math.min(1, this.speed / FOOT.walkSpeed);
    out.x = this.pos.x + Math.cos(this.yaw) * Math.sin(this.bob * 0.5) * b.sway * amt;
    out.y = this.pos.y + FOOT.eyeHeight + Math.abs(Math.sin(this.bob * 0.5)) * b.amplitude * amt * 2 - b.amplitude * amt;
    out.z = this.pos.z + Math.sin(this.yaw) * Math.sin(this.bob * 0.5) * b.sway * amt;
    return out;
  }

  get onBoat() {
    return Boolean(this.support && this.support.local);
  }
}
