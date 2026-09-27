// Paths through a town (V7), pure JS: a 1 m walkability grid in the harbor
// frame (a slab underfoot, no wall within reach, no step taller than the
// walker takes) and A* over it. Used by townspeople and the headless
// walking tests.

import { inside } from '../world/TownLayout.js';
import { FOOT } from '../config/onfoot.js';

const CELL = 0.5;
const CLEAR = 0.35; // wall clearance (m): the walker's radius and a little

// Binary min-heap of cell indices keyed by f.
class Heap {
  constructor(f) {
    this.f = f;
    this.a = [];
  }

  push(k) {
    const a = this.a;
    a.push(k);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[a[p]] <= this.f[a[i]]) {
        break;
      }
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.f[a[l]] < this.f[a[m]]) {
          m = l;
        }
        if (r < a.length && this.f[a[r]] < this.f[a[m]]) {
          m = r;
        }
        if (m === i) {
          break;
        }
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }

  get size() {
    return this.a.length;
  }
}

export class TownNav {
  constructor(town) {
    this.town = town;
    let a0 = Infinity;
    let a1 = -Infinity;
    let o0 = Infinity;
    let o1 = -Infinity;
    for (const s of town.slabs) {
      const ra = Math.abs(s.ua) * s.hw + Math.abs(s.uo) * s.hl;
      const ro = Math.abs(s.uo) * s.hw + Math.abs(s.ua) * s.hl;
      a0 = Math.min(a0, s.ca - ra);
      a1 = Math.max(a1, s.ca + ra);
      o0 = Math.min(o0, s.co - ro);
      o1 = Math.max(o1, s.co + ro);
    }
    this.a0 = Math.floor(a0);
    this.o0 = Math.floor(o0);
    this.na = Math.ceil((a1 - this.a0) / CELL) + 1;
    this.no = Math.ceil((o1 - this.o0) / CELL) + 1;
    this.top = new Float32Array(this.na * this.no).fill(NaN);
    for (let j = 0; j < this.no; j++) {
      for (let i = 0; i < this.na; i++) {
        const a = this.a0 + (i + 0.5) * CELL;
        const o = this.o0 + (j + 0.5) * CELL;
        let top = NaN;
        for (const s of town.slabBucket ? town.slabBucket.at(a, o) : town.slabs) {
          if (inside(s, a, o, -0.2) && !(s.top <= top)) {
            top = s.top;
          }
        }
        if (Number.isNaN(top)) {
          continue;
        }
        let blocked = false;
        for (const w of town.wallBucket ? town.wallBucket.at(a, o) : town.walls) {
          if (w.y1 >= top + 0.25 && w.y0 <= top + 1.7 && inside(w, a, o, CLEAR)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          this.top[j * this.na + i] = top;
        }
      }
    }
  }

  cell(a, o) {
    const i = Math.floor((a - this.a0) / CELL);
    const j = Math.floor((o - this.o0) / CELL);
    if (i < 0 || j < 0 || i >= this.na || j >= this.no) {
      return -1;
    }
    return j * this.na + i;
  }

  // Nearest walkable cell to (a, o) within r cells.
  nearest(a, o, r = 8) {
    const c = this.cell(a, o);
    if (c >= 0 && !Number.isNaN(this.top[c])) {
      return c;
    }
    let best = -1;
    let bd = Infinity;
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        const k = this.cell(a + di * CELL, o + dj * CELL);
        if (k >= 0 && !Number.isNaN(this.top[k]) && di * di + dj * dj < bd) {
          bd = di * di + dj * dj;
          best = k;
        }
      }
    }
    return best;
  }

  // A* from frame point A to B: frame waypoints [{a, o}] or null.
  path(A, B) {
    const s = this.nearest(A.a, A.o);
    const g = this.nearest(B.a, B.o);
    if (s < 0 || g < 0) {
      return null;
    }
    const na = this.na;
    const cost = new Float32Array(this.top.length).fill(Infinity);
    const from = new Int32Array(this.top.length).fill(-1);
    cost[s] = 0;
    const gi = g % na;
    const gj = Math.floor(g / na);
    const h = (k) => Math.hypot((k % na) - gi, Math.floor(k / na) - gj);
    const f = new Float32Array(this.top.length).fill(Infinity);
    f[s] = h(s);
    const open = new Heap(f);
    open.push(s);
    const closed = new Uint8Array(this.top.length);
    while (open.size) {
      const k = open.pop();
      if (k === g) {
        break;
      }
      if (closed[k]) {
        continue;
      }
      closed[k] = 1;
      const i = k % na;
      const j = Math.floor(k / na);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) {
            continue;
          }
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= na || jj >= this.no) {
            continue;
          }
          const n = jj * na + ii;
          if (closed[n] || Number.isNaN(this.top[n]) || Math.abs(this.top[n] - this.top[k]) > FOOT.stepUp) {
            continue;
          }
          // No corner cutting past a blocked cell.
          if (di && dj && (Number.isNaN(this.top[j * na + ii]) || Number.isNaN(this.top[jj * na + i]))) {
            continue;
          }
          const c = cost[k] + (di && dj ? Math.SQRT2 : 1);
          if (c < cost[n]) {
            cost[n] = c;
            from[n] = k;
            f[n] = c + h(n);
            open.push(n);
          }
        }
      }
    }
    if (from[g] < 0 && g !== s) {
      return null;
    }
    const out = [];
    for (let k = g; k >= 0; k = from[k]) {
      out.push({ a: this.a0 + ((k % na) + 0.5) * CELL, o: this.o0 + (Math.floor(k / na) + 0.5) * CELL });
      if (k === s) {
        break;
      }
    }
    out.reverse();
    return this.simplify(out);
  }

  // Drop waypoints that are on a straight line.
  simplify(pts) {
    if (pts.length < 3) {
      return pts;
    }
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const p = out[out.length - 1];
      const q = pts[i + 1];
      const c = pts[i];
      const cr = (c.a - p.a) * (q.o - p.o) - (c.o - p.o) * (q.a - p.a);
      if (Math.abs(cr) > 1e-6) {
        out.push(c);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
}
