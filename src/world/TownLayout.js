// Walkable towns (V7), pure JS: for every port, in its harbor frame (a along
// the shore, o out to sea), the walkable slabs (quay, pier, street, floors,
// breakwater cap), the walls (buildings with door gaps, crane legs), the
// buildings with their doors and counters, bollards and mooring edges, and
// spots for lights, parked cars and people. Shared by the town meshes, the
// walker, townspeople and the headless tests. No three.js.

import { TOWN_Y, KETTLE, STATION } from '../config/town.js';

const WALL = 0.25; // wall thickness
const DOOR = 1.5; // door gap width
const FLOOR = 0.15; // interior floor above the street

export class PortFrame {
  constructor(port) {
    this.port = port;
    this.cx = port.center.x;
    this.cz = port.center.z;
    this.ax = port.along.x;
    this.az = port.along.z;
    this.ox = port.out.x;
    this.oz = port.out.z;
    // World yaw (three.js, rotation about +Y) that turns local +Z to out.
    this.yaw = Math.atan2(this.ox, this.oz);
  }

  toLocal(x, z, out = {}) {
    const dx = x - this.cx;
    const dz = z - this.cz;
    out.a = dx * this.ax + dz * this.az;
    out.o = dx * this.ox + dz * this.oz;
    return out;
  }

  toWorld(a, o, out = {}) {
    out.x = this.cx + this.ax * a + this.ox * o;
    out.z = this.cz + this.az * a + this.oz * o;
    return out;
  }

  // Frame direction (da, do) to world (dx, dz).
  dirToWorld(da, dO, out = {}) {
    out.x = this.ax * da + this.ox * dO;
    out.z = this.az * da + this.oz * dO;
    return out;
  }
}

// Oriented box in the frame: centre (ca, co), half sizes hw (along its axis
// u) and hl (across), axis u = (ua, uo) unit.
function obb(ca, co, hw, hl, ua = 1, uo = 0) {
  return { ca, co, hw, hl, ua, uo };
}

function rect(a0, a1, o0, o1) {
  return obb((a0 + a1) / 2, (o0 + o1) / 2, Math.abs(a1 - a0) / 2, Math.abs(o1 - o0) / 2);
}

// Point inside an obb (frame coordinates), with an optional margin.
export function inside(b, a, o, margin = 0) {
  const da = a - b.ca;
  const dO = o - b.co;
  const u = da * b.ua + dO * b.uo;
  const v = -da * b.uo + dO * b.ua;
  return Math.abs(u) <= b.hw + margin && Math.abs(v) <= b.hl + margin;
}

export class PortTown {
  constructor(port, kind) {
    this.port = port;
    this.id = port.id;
    this.kind = kind; // 'kettle' | 'station'
    this.frame = new PortFrame(port);
    this.slabs = []; // { ...obb, top, surface, name }
    this.walls = []; // { ...obb, y0, y1 }
    this.buildings = [];
    this.bollards = []; // { a, o, y }
    this.edges = []; // mooring faces: { a0, o0, a1, o1, n: {a, o} outward, top, bollards: [..] }
    this.lights = []; // street lights { a, o }
    this.parked = []; // { a, o, yaw (frame), variant }
    this.people = []; // idle spots { a, o, y, face, pose }
  }

  slab(b, top, surface, name = '') {
    this.slabs.push({ ...b, top, surface, name });
  }

  wall(b, y0, y1) {
    this.walls.push({ ...b, y0, y1 });
  }

  // A building shell: walls with a door gap in the front (sea side, or the
  // back when doorSide = -1), an interior floor and a counter to walk up to.
  building(spec, enter) {
    const { a, o, w, d, h } = spec;
    const side = spec.doorSide || 1;
    const y = TOWN_Y;
    const front = o + (side * d) / 2;
    const back = o - (side * d) / 2;
    const b = { ...spec, enter, y, front, back, side };
    if (!enter) {
      this.wall(rect(a - w / 2, a + w / 2, o - d / 2, o + d / 2), y - 1, y + h);
      this.buildings.push(b);
      return b;
    }
    // Side and back walls.
    this.wall(rect(a - w / 2, a - w / 2 + WALL, o - d / 2, o + d / 2), y - 1, y + h);
    this.wall(rect(a + w / 2 - WALL, a + w / 2, o - d / 2, o + d / 2), y - 1, y + h);
    this.wall(rect(a - w / 2, a + w / 2, back - (side * WALL) / 2, back + (side * WALL) / 2), y - 1, y + h);
    // Front wall either side of the door (door a little off centre in wide
    // buildings, so the counter can face it).
    const da = w > 9 ? -w * 0.18 : 0;
    const f0 = front - (side * WALL) / 2;
    const f1 = front + (side * WALL) / 2;
    this.wall(rect(a - w / 2, a + da - DOOR / 2, f0, f1), y - 1, y + h);
    this.wall(rect(a + da + DOOR / 2, a + w / 2, f0, f1), y - 1, y + h);
    // Lintel over the door (blocks nothing at head height; drawn by Town).
    b.door = { a: a + da, o: front, w: DOOR, h: 2.3 };
    b.outside = { a: a + da, o: front + side * 1.4 };
    b.inside = { a: a + da, o: front - side * 1.3 };
    this.slab(rect(a - w / 2 + WALL, a + w / 2 - WALL, o - d / 2 + WALL, o + d / 2 - WALL), y + FLOOR, spec.kind === 'market' || spec.kind === 'kiosk' ? 'concrete' : 'wood', `${spec.id} floor`);
    // Door sill: a short ramp-like slab at floor height through the gap.
    this.slab(rect(a + da - DOOR / 2, a + da + DOOR / 2, Math.min(f0, f1) - 0.05, Math.max(f0, f1) + 0.05), y + FLOOR, 'wood', `${spec.id} sill`);
    // Counter across the back third, with a gap to walk behind it only in
    // the pub (bar) - the service point is in front of it.
    const cw = Math.min(w - 2, spec.kind === 'kiosk' ? w - 0.8 : w * 0.55);
    const co = back + side * Math.min(d * 0.32, 2.6);
    const ca = a + (spec.kind === 'kiosk' ? 0 : w * 0.12);
    this.wall(rect(ca - cw / 2, ca + cw / 2, co - 0.3, co + 0.3), y, y + 1.05);
    b.counter = { a: ca, o: co + side * 0.3, w: cw };
    b.service = { a: ca, o: co + side * 1.0 };
    this.buildings.push(b);
    return b;
  }
}

// Kettle Harbor: quay, pier, breakwater cap, street, lane, buildings.
function kettle(t) {
  const K = KETTLE;
  const y = TOWN_Y;
  // Base ground over the whole levelled terrace (gravel yards and paths).
  t.slab(rect(K.street.a0, K.street.a1, K.lane.o0, K.street.o0), y, 'gravel', 'yards');
  t.slab(rect(K.street.a0, K.street.a1, K.street.o0, K.street.o1), y, 'concrete', 'street');
  t.slab(rect(K.quay.a0, K.quay.a1, K.quay.o0, K.quay.o1), K.quay.top, 'concrete', 'quay');
  const P = K.pier;
  t.slab(rect(P.a - P.width / 2, P.a + P.width / 2, P.o0, P.o1), P.top, 'wood', 'pier');
  t.wall(rect(P.a - 0.6, P.a + 0.6, P.o1 - 3.4, P.o1 - 2.6), P.top - 1, P.top + 1.6); // fuel pump
  // Breakwater cap (5 m wide concrete) along the mole, joined to the quay.
  for (let i = 0; i + 1 < K.mole.length; i++) {
    const [a0, o0] = K.mole[i];
    const [a1, o1] = K.mole[i + 1];
    const len = Math.hypot(a1 - a0, o1 - o0);
    const ua = (a1 - a0) / len;
    const uo = (o1 - o0) / len;
    t.slab(obb((a0 + a1) / 2, (o0 + o1) / 2, len / 2 + 2.5, 2.5, ua, uo), K.moleCapTop, 'concrete', 'breakwater');
  }
  // Steps from the quay's west end up onto the breakwater root.
  t.slab(rect(K.mole[0][0] + 1.5, K.quay.a0 + 2, K.quay.o0, K.quay.o1), (y + K.moleCapTop) / 2, 'concrete', 'steps');
  // Crane legs on the quay.
  const c = K.crane;
  t.wall(rect(c.a - 0.5, c.a + 0.5, c.o - 0.5, c.o + 0.5), y - 1, y + 14);
  for (const s of K.buildings) {
    t.building(s, true);
  }
  for (const s of K.houses) {
    t.building(s, false);
  }
  t.building(K.kiosk, true);
  // Bollards along both sides of the pier and the quay face.
  for (let o = P.o0 + 6; o < P.o1 - 1; o += 10) {
    for (const s of [-1, 1]) {
      t.bollards.push({ a: P.a + s * (P.width / 2 - 0.35), o, y: P.top });
    }
  }
  for (let a = K.quay.a0 + 5; a < K.quay.a1; a += 12) {
    t.bollards.push({ a, o: K.quay.o1 - 0.4, y: K.quay.top });
  }
  // Mooring faces: the pier's two sides and the quay front.
  const side = (s) => ({ a0: P.a + (s * P.width) / 2, o0: P.o0 + 4, a1: P.a + (s * P.width) / 2, o1: P.o1, n: { a: s, o: 0 }, top: P.top });
  t.edges.push(side(-1), side(1), { a0: K.quay.a0, o0: K.quay.o1, a1: K.quay.a1, o1: K.quay.o1, n: { a: 0, o: 1 }, top: K.quay.top });
  const L = K.streetLights;
  for (let a = L.a0; a <= L.a1; a += L.spacing) {
    t.lights.push({ a, o: L.o });
  }
  for (let o = P.o0 + 10; o < P.o1; o += 20) {
    t.lights.push({ a: P.a + P.width / 2 - 0.25, o, small: true });
  }
  for (const [a, o, v] of K.parked) {
    t.parked.push({ a, o, yaw: Math.PI / 2, variant: v });
  }
  // People: fishermen on the breakwater, loafers on the pier and quay.
  const mole = K.mole;
  for (let i = 0; i < 5; i++) {
    const k = 0.2 + i * 0.17;
    const seg = Math.min(mole.length - 2, Math.floor(k * (mole.length - 1)));
    const f = k * (mole.length - 1) - seg;
    const a = mole[seg][0] + (mole[seg + 1][0] - mole[seg][0]) * f;
    const o = mole[seg][1] + (mole[seg + 1][1] - mole[seg][1]) * f;
    t.people.push({ a: a + 1.6, o: o + 1, y: K.moleCapTop, pose: 'fishing', face: 0.6 + i });
  }
  t.people.push({ a: P.a + 1.8, o: 40, y: P.top, pose: 'fishing', face: Math.PI / 2 });
  t.people.push({ a: P.a - 1.2, o: 22, y: P.top, pose: 'stand', face: 2 });
  t.people.push({ a: -40, o: -24, y: K.quay.top, pose: 'stand', face: 0.3 });
  t.people.push({ a: 12, o: -27, y: K.quay.top, pose: 'stand', face: 3.4 });
  t.people.push({ a: -18, o: -47.5, y, pose: 'stand', face: 0 });
  t.people.push({ a: -15.5, o: -47.2, y, pose: 'stand', face: 3.3 });
}

function station(t) {
  const S = STATION;
  const y = TOWN_Y;
  t.slab(rect(S.pad.a0, S.pad.a1, S.pad.o0, S.pad.o1), y, 'gravel', 'yard');
  const P = S.pier;
  t.slab(rect(P.a - P.width / 2, P.a + P.width / 2, P.o0, P.o1), P.top, 'wood', 'pier');
  t.wall(rect(P.a - 0.6, P.a + 0.6, P.o1 - 2.4, P.o1 - 1.6), P.top - 1, P.top + 1.6); // fuel pump
  for (const s of S.buildings) {
    t.building(s, true);
  }
  for (const s of S.houses) {
    t.building(s, false);
  }
  for (let o = P.o0 + 6; o < P.o1 - 1; o += 8) {
    for (const s of [-1, 1]) {
      t.bollards.push({ a: P.a + s * (P.width / 2 - 0.3), o, y: P.top });
    }
  }
  const side = (s) => ({ a0: P.a + (s * P.width) / 2, o0: P.o0 + 4, a1: P.a + (s * P.width) / 2, o1: P.o1, n: { a: s, o: 0 }, top: P.top });
  t.edges.push(side(-1), side(1));
  t.lights.push({ a: P.a + P.width / 2 - 0.2, o: 10, small: true }, { a: P.a + P.width / 2 - 0.2, o: 28, small: true }, { a: 10, o: -12 });
  t.parked.push({ a: 26, o: -16, yaw: 0.3, variant: 1 });
  t.people.push({ a: P.a - 1, o: 24, y: P.top, pose: 'fishing', face: -Math.PI / 2 });
}

// All ports' towns, from the WorldShape ports.
export function buildTowns(shape) {
  return shape.ports.map((p) => {
    const t = new PortTown(p, p.harbor ? 'kettle' : 'station');
    if (p.harbor) {
      kettle(t);
    } else {
      station(t);
    }
    return t;
  });
}
