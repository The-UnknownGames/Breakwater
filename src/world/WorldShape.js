// Pure-JS shape of the Grey Reach: terrain height everywhere (land > 0,
// seabed < 0), port layouts (harbor frames, zones, docks), wave shelters.
// Shared by physics (grounding, colliders), rendering (terrain meshes,
// depth texture) and tests. No three.js.

import { WORLD_MAP } from '../config/world.js';
import { TERRACES, KETTLE, STATION } from '../config/town.js';
import { MOORING } from '../config/onfoot.js';

function hash(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 144269504) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed);
  const b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed);
  const d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm(x, z, seed, oct = 3) {
  let v = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    v += amp * noise(x, z, seed + o * 17);
    norm += amp;
    x *= 2.03;
    z *= 2.03;
    amp *= 0.5;
  }
  return v / norm;
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export class WorldShape {
  constructor(map = WORLD_MAP) {
    this.map = map;
    this.islands = map.islands.map((s) => ({ ...s }));
    this.reefs = map.reefs;
    this.ports = [];
    this.buildPorts();
    this.shelters = this.ports.filter((p) => p.harbor).map((p) => ({ x: p.zone.x, z: p.zone.z, r: map.harbor.shelterRadius, k: map.harbor.shelter }));
  }

  baseDepth(x, z) {
    return this.map.baseDepth + (fbm(x / 900, z / 900, 99) - 0.5) * 2 * this.map.depthNoise;
  }

  // Island profile: noisy dome with cliffs, shallows ring, seabed slope.
  islandHeight(s, x, z, base) {
    const dx = x - s.x;
    const dz = z - s.z;
    const dist = Math.hypot(dx, dz);
    if (dist > s.r * 2.6) {
      return -Infinity;
    }
    const wob = fbm(x / (s.r * 0.55), z / (s.r * 0.55), s.seed);
    const d = dist / (s.r * (0.72 + 0.5 * wob));
    const sea = -base * smoothstep(0.95, 2.4, d) - 1.5 * (1 - smoothstep(0.95, 1.3, d));
    if (d >= 1.05) {
      return sea;
    }
    const rough = 0.7 + 0.6 * fbm(x / 70, z / 70, s.seed + 5);
    const core = s.h * Math.pow(Math.max(0, 1 - d * d), 0.55) * rough;
    const cliff = smoothstep(1.04, 0.9, d);
    return Math.max(sea, core * cliff + (cliff - 1) * 3);
  }

  // Terrain height (m above still water; negative = seabed depth).
  heightAt(x, z, carve = true) {
    const base = this.baseDepth(x, z);
    let h = -base;
    for (const s of this.islands) {
      h = Math.max(h, this.islandHeight(s, x, z, base));
    }
    for (const r of this.reefs) {
      const dd = Math.hypot(x - r.x, z - r.z) / r.r;
      if (dd < 1.8) {
        const dome = Math.max(0, 1 - dd * dd * 0.6);
        const knobs = 0.4 * (fbm(x / 9, z / 9, 41) - 0.5);
        h = Math.max(h, -(r.minDepth + (base - r.minDepth) * (1 - dome) ** 2) + knobs * dome);
      }
    }
    if (carve) {
      h = this.carve(x, z, h);
    }
    return h;
  }

  depthAt(x, z) {
    return -this.heightAt(x, z);
  }

  // Dredged harbor basins and approach channels.
  carve(x, z, h) {
    for (const p of this.ports) {
      if (!p.harbor) {
        // Fuel stations: a small dredged pocket at the pier head.
        const st = this.map.station;
        const dd = Math.hypot(x - p.dock.x, z - p.dock.z);
        if (dd < st.basinRadius * 1.4) {
          const k = smoothstep(st.basinRadius * 1.4, st.basinRadius * 0.7, dd);
          h = h + (Math.min(h, -st.basinDepth) - h) * k;
        }
        const sx = x - p.center.x;
        const sz = z - p.center.z;
        h = this.terrace(TERRACES.station, sx * p.along.x + sz * p.along.z, sx * p.out.x + sz * p.out.z, h);
        continue;
      }
      const hb = this.map.harbor;
      const dx = x - p.center.x;
      const dz = z - p.center.z;
      const dist = Math.hypot(dx, dz);
      if (dist < hb.basinRadius * 1.3) {
        const k = smoothstep(hb.basinRadius * 1.3, hb.basinRadius * 0.9, dist);
        h = h + (Math.min(h, -hb.basinDepth) - h) * k;
      }
      const o = dx * p.out.x + dz * p.out.z;
      const a = dx * p.along.x + dz * p.along.z;
      h = this.terrace(TERRACES.kettle, a, o, h);
      if (o > 0 && o < 420 && Math.abs(a) < 70) {
        const k = smoothstep(70, 40, Math.abs(a)) * smoothstep(420, 300, o);
        h = h + (Math.min(h, -8) - h) * k;
      }
    }
    return h;
  }

  // Made ground for a town (V7): level the land inside the rectangle (harbor
  // frame) to the terrace height, blending over `blend` metres outside it.
  terrace(t, a, o, h) {
    const da = Math.max(t.a0 - a, 0, a - t.a1);
    const dO = Math.max(t.o0 - o, 0, o - t.o1);
    const d = Math.hypot(da, dO);
    if (d >= t.blend) {
      return h;
    }
    const k = smoothstep(t.blend, 0, d);
    // Seaward of the rectangle only fill (never dig the harbor out).
    if (o > t.o1 && h < t.height) {
      return h;
    }
    return h + (t.height - h) * k;
  }

  // Port layout: find where the island's shore faces the origin.
  buildPorts() {
    for (const cfg of this.map.ports) {
      const s = this.islands[cfg.island];
      let ox = -s.x;
      let oz = -s.z;
      const l = Math.hypot(ox, oz);
      ox /= l;
      oz /= l;
      let shore = 0;
      for (let r = 0; r < s.r * 2.5; r += 2) {
        if (this.heightAt(s.x + ox * r, s.z + oz * r, false) < 0) {
          shore = r;
          break;
        }
      }
      const home = Boolean(cfg.home);
      const out = { x: ox, z: oz };
      const along = { x: -oz, z: ox };
      const sx = s.x + ox * shore;
      const sz = s.z + oz * shore;
      const center = home ? { x: sx - ox * 25, z: sz - oz * 25 } : { x: sx, z: sz };
      const zr = home ? this.map.harbor.zoneRadius : this.map.station.zoneRadius;
      const zone = { x: center.x + ox * (home ? 45 : 40), z: center.z + oz * (home ? 45 : 40), r: zr };
      // Dock: berth off the pier, bow pointing out to sea.
      const pierBase = home ? { x: center.x + along.x * 35, z: center.z + along.z * 35 } : center;
      const dock = {
        x: pierBase.x + ox * (home ? 60 : 30) - along.x * 9,
        z: pierBase.z + oz * (home ? 60 : 30) - along.z * 9,
        heading: (Math.atan2(ox, -oz) + Math.PI * 2) % (Math.PI * 2),
      };
      // Big ships (> 30 m) lie at an anchorage off the channel, not the pier.
      const anchorage = { x: center.x + ox * 470 - along.x * 170, z: center.z + oz * 470 - along.z * 170, heading: dock.heading };
      this.ports.push({ ...cfg, harbor: home, shore: { x: sx, z: sz }, center, out, along, zone, dock, pierBase, anchorage });
    }
  }

  // Is anything shallower than `depth` within `radius` of (x, z)?
  shallowNear(x, z, radius, depth = 20) {
    for (const s of this.islands) {
      if (Math.hypot(x - s.x, z - s.z) < s.r * 1.6 + radius) {
        return true;
      }
    }
    for (const r of this.reefs) {
      if (Math.hypot(x - r.x, z - r.z) < r.r * 1.8 + radius) {
        return depth > r.minDepth;
      }
    }
    return false;
  }

  // Where a boat of this length is kept at a port. With her beam, she lies
  // right alongside the pier face (fendered) so her lines can go ashore.
  berthFor(port, length, beam = null) {
    if (length > 30) {
      return port.anchorage;
    }
    if (beam === null) {
      return port.dock;
    }
    const pier = port.harbor ? KETTLE.pier : STATION.pier;
    const off = pier.width / 2 + beam / 2 + MOORING.fender;
    const o = port.harbor ? 50 : 20;
    const b = port.pierBase;
    return { x: b.x + port.out.x * o - port.along.x * off, z: b.z + port.out.z * o - port.along.z * off, heading: port.dock.heading };
  }

  portAt(x, z) {
    for (const p of this.ports) {
      if (Math.hypot(x - p.zone.x, z - p.zone.z) < p.zone.r) {
        return p;
      }
    }
    return null;
  }

  // Random open-water point (depth > minDepth), away from land.
  openWater(rng, minDepth = 25, tries = 60) {
    const hs = this.map.halfSize * 0.92;
    for (let i = 0; i < tries; i++) {
      const x = (rng() * 2 - 1) * hs;
      const z = (rng() * 2 - 1) * hs;
      if (this.depthAt(x, z) > minDepth) {
        return { x, z };
      }
    }
    return { x: 0, z: 0 };
  }
}
