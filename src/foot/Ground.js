// What the walker stands on and bumps into (V7), pure JS.
// TownGround: every port town's slabs (walkable tops) and walls in its
// harbor frame, bucketed on a coarse grid. BoatDeck: a boat's walkable deck
// and deck blocks in the boat frame, posed from its physics state.

import { inside } from '../world/TownLayout.js';
import { hullStation, sectionPoint } from '../physics/HullShape.js';
import { rotate, rotateInv, vec } from '../core/math.js';
import { DECKS } from '../config/onfoot.js';

const CELL = 8;

function reach(b) {
  return Math.abs(b.ua) * b.hw + Math.abs(b.uo) * b.hl;
}

function reachO(b) {
  return Math.abs(b.uo) * b.hw + Math.abs(b.ua) * b.hl;
}

class Bucket {
  constructor(items) {
    this.map = new Map();
    for (const it of items) {
      const ra = reach(it);
      const ro = reachO(it);
      for (let i = Math.floor((it.ca - ra) / CELL); i <= Math.floor((it.ca + ra) / CELL); i++) {
        for (let j = Math.floor((it.co - ro) / CELL); j <= Math.floor((it.co + ro) / CELL); j++) {
          const k = `${i},${j}`;
          if (!this.map.has(k)) {
            this.map.set(k, []);
          }
          this.map.get(k).push(it);
        }
      }
    }
  }

  at(a, o) {
    return this.map.get(`${Math.floor(a / CELL)},${Math.floor(o / CELL)}`) || [];
  }
}

export class TownGround {
  constructor(towns) {
    this.towns = towns;
    for (const t of towns) {
      t.slabBucket = new Bucket(t.slabs);
      t.wallBucket = new Bucket(t.walls);
    }
    this.loc = {};
  }

  // The town whose frame covers (x, z) (within 350 m of its centre).
  townAt(x, z) {
    for (const t of this.towns) {
      const dx = x - t.frame.cx;
      const dz = z - t.frame.cz;
      if (dx * dx + dz * dz < 350 * 350) {
        return t;
      }
    }
    return null;
  }

  // Walkable tops under (x, z): pushes { top, surface, owner } into out.
  supports(x, z, out) {
    const t = this.townAt(x, z);
    if (!t) {
      return out;
    }
    const l = t.frame.toLocal(x, z, this.loc);
    for (const s of t.slabBucket.at(l.a, l.o)) {
      if (inside(s, l.a, l.o)) {
        out.push({ top: s.top, surface: s.surface, owner: t, name: s.name });
      }
    }
    return out;
  }

  // Push a body circle (radius r, feet at y) out of walls; returns the
  // corrected world position in `out`.
  collide(x, z, y, r, out) {
    out.x = x;
    out.z = z;
    const t = this.townAt(x, z);
    if (!t) {
      return out;
    }
    const f = t.frame;
    const l = f.toLocal(x, z, this.loc);
    let a = l.a;
    let o = l.o;
    for (let pass = 0; pass < 2; pass++) {
      for (const w of t.wallBucket.at(a, o)) {
        if (w.y1 < y + 0.25 || w.y0 > y + 1.7) {
          continue;
        }
        const p = pushOut(w, a, o, r);
        if (p) {
          a += p.a;
          o += p.o;
        }
      }
    }
    f.toWorld(a, o, out);
    return out;
  }

  // The building (enterable or not) whose footprint holds (x, z).
  buildingAt(x, z) {
    const t = this.townAt(x, z);
    if (!t) {
      return null;
    }
    const l = t.frame.toLocal(x, z, this.loc);
    for (const b of t.buildings) {
      if (Math.abs(l.a - b.a) < b.w / 2 && Math.abs(l.o - b.o) < b.d / 2) {
        return b;
      }
    }
    return null;
  }
}

// Circle (a, o, r) against an oriented box: the push that separates them,
// or null.
function pushOut(b, a, o, r) {
  const da = a - b.ca;
  const dO = o - b.co;
  const u = da * b.ua + dO * b.uo;
  const v = -da * b.uo + dO * b.ua;
  const cu = Math.max(-b.hw, Math.min(b.hw, u));
  const cv = Math.max(-b.hl, Math.min(b.hl, v));
  let nu = u - cu;
  let nv = v - cv;
  let d = Math.hypot(nu, nv);
  let pen;
  if (d > 1e-6) {
    if (d >= r) {
      return null;
    }
    pen = r - d;
    nu /= d;
    nv /= d;
  } else {
    // Centre inside the box: out through the nearest face.
    const eu = b.hw - Math.abs(u);
    const ev = b.hl - Math.abs(v);
    if (eu < ev) {
      nu = Math.sign(u) || 1;
      nv = 0;
      pen = eu + r;
    } else {
      nu = 0;
      nv = Math.sign(v) || 1;
      pen = ev + r;
    }
    d = 0;
  }
  return { a: (nu * b.ua - nv * b.uo) * pen, o: (nu * b.uo + nv * b.ua) * pen };
}

// A boat's walkable deck. `sim` is a BoatPhysics (state.pos, state.rot).
export class BoatDeck {
  constructor(sim) {
    this.sim = sim;
    this.cfg = sim.cfg;
    const h = sim.cfg.hull;
    const plan = DECKS[sim.cfg.id] || {
      inset: 0.4,
      blocks: [[-h.beam * 0.3, h.beam * 0.3, -h.length * 0.1, h.length * 0.25]],
      helm: [0, -h.length * 0.12],
      stand: [h.beam * 0.2, -h.length * 0.2],
      surface: 'deck',
    };
    this.plan = plan;
    this.blocks = plan.blocks.map(([x0, x1, z0, z1]) => ({ ca: (x0 + x1) / 2, co: (z0 + z1) / 2, hw: (x1 - x0) / 2, hl: (z1 - z0) / 2, ua: 1, uo: 0 }));
    this.tmp = { l: vec(), w: vec() };
  }

  // Deck height (boat frame) at local (x, z), or null off the deck.
  deckY(x, z) {
    const h = this.cfg.hull;
    const s = z / h.length + 0.5;
    if (s < 0.02 || s > 0.97) {
      return null;
    }
    const st = hullStation(h, s);
    const half = sectionPoint(st, 1).x - this.plan.inset;
    if (Math.abs(x) > half) {
      return null;
    }
    return st.deck;
  }

  toLocal(x, y, z, out) {
    const s = this.sim.state;
    this.tmp.w.x = x - s.pos.x;
    this.tmp.w.y = y - s.pos.y;
    this.tmp.w.z = z - s.pos.z;
    return rotateInv(s.rot, this.tmp.w, out);
  }

  toWorld(x, y, z, out) {
    const s = this.sim.state;
    this.tmp.l.x = x;
    this.tmp.l.y = y;
    this.tmp.l.z = z;
    rotate(s.rot, this.tmp.l, out);
    out.x += s.pos.x;
    out.y += s.pos.y;
    out.z += s.pos.z;
    return out;
  }

  // Walkable top at world (x, z) near height y: { top (world y), local } or
  // null. Deck blocks are not walkable.
  support(x, z, y) {
    const l = this.toLocal(x, y, z, vec());
    const d = this.deckY(l.x, l.z);
    if (d === null) {
      return null;
    }
    for (const b of this.blocks) {
      if (inside(b, l.x, l.z)) {
        return null;
      }
    }
    const w = this.toWorld(l.x, d, l.z, vec());
    return { top: w.y, surface: this.plan.surface, owner: this, local: { x: l.x, z: l.z } };
  }

  // Push a body circle out of the deck blocks (boat frame); world out.
  collide(x, z, y, r, out) {
    const l = this.toLocal(x, y, z, vec());
    let a = l.x;
    let o = l.z;
    let hit = false;
    for (const b of this.blocks) {
      const p = pushOut(b, a, o, r);
      if (p) {
        a += p.a;
        o += p.o;
        hit = true;
      }
    }
    if (!hit) {
      out.x = x;
      out.z = z;
      return out;
    }
    const w = this.toWorld(a, l.y, o, vec());
    out.x = w.x;
    out.z = w.z;
    return out;
  }

  // World position of a deck spot [x, z] (boat frame), on the deck.
  spot(xz, out = vec()) {
    const d = this.deckY(xz[0], xz[1]) ?? this.cfg.hull.freeboard;
    return this.toWorld(xz[0], d, xz[1], out);
  }
}
