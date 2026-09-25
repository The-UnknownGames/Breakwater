// Parametric hull surface, shared by rendering, voxelization and the Blender
// generator. Pure JS (no three.js). Local frame: +Z bow, +Y up, origin on the
// DWL midships. Sections are superellipse quadrants from keel to sheer.

function smoothstep(e0, e1, x) {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

// s: 0 at the transom, 1 at the stem.
export function hullStation(h, s) {
  let w;
  if (s < h.maxBeamAt) {
    w = h.transomWidth + (1 - h.transomWidth) * Math.sin((Math.PI / 2) * (s / h.maxBeamAt));
  } else {
    const t = (s - h.maxBeamAt) / (1 - h.maxBeamAt);
    w = Math.pow(Math.cos((t * Math.PI) / 2), 0.7);
  }
  const halfBeam = Math.max((h.beam / 2) * w, 0.004);
  const deck = h.freeboard + h.sheerRise * s * s;
  const keel = -h.draft * (1 - h.forefootRise * smoothstep(0.55, 1, s));
  const n = h.fullness + (h.bowFullness - h.fullness) * smoothstep(0.45, 1, s);
  return { z: (s - 0.5) * h.length, halfBeam, deck, keel, n };
}

// Point on the starboard half-section, u: 0 = keel, 1 = sheer.
export function sectionPoint(st, u) {
  const th = (u * Math.PI) / 2;
  const e = 2 / st.n;
  const x = st.halfBeam * Math.pow(Math.sin(th), e);
  const y = st.keel + (st.deck - st.keel) * (1 - Math.pow(Math.cos(th), e));
  return { x, y };
}

// Builds a mesh. Returns { positions: number[], indices: number[], ring, stations }.
// `closed` adds deck, transom and stem caps (needed for voxelization).
export function buildHullMesh(h, stations = 28, perSide = 10, closed = true) {
  const positions = [];
  const indices = [];
  const ring = perSide * 2 + 1;
  for (let i = 0; i <= stations; i++) {
    const s = i / stations;
    const st = hullStation(h, s);
    // Starboard sheer -> keel -> port sheer.
    for (let j = perSide; j >= -perSide; j--) {
      const p = sectionPoint(st, Math.abs(j) / perSide);
      positions.push(j >= 0 ? p.x : -p.x, p.y, st.z);
    }
  }
  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < ring - 1; j++) {
      const a = i * ring + j;
      const b = a + 1;
      const c = a + ring;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  if (closed) {
    addCaps(positions, indices, stations, ring);
  }
  return { positions, indices, ring, stations };
}

function addCaps(positions, indices, stations, ring) {
  // Deck: quads between starboard and port sheer points of adjacent stations.
  for (let i = 0; i < stations; i++) {
    const sa = i * ring;
    const pa = i * ring + ring - 1;
    const sb = sa + ring;
    const pb = pa + ring;
    indices.push(sa, pa, sb, sb, pa, pb);
  }
  // Transom (station 0) and stem (last station): fans from a centre vertex.
  for (const i of [0, stations]) {
    let cx = 0;
    let cy = 0;
    const cz = positions[(i * ring) * 3 + 2];
    for (let j = 0; j < ring; j++) {
      cx += positions[(i * ring + j) * 3];
      cy += positions[(i * ring + j) * 3 + 1];
    }
    const centre = positions.length / 3;
    positions.push(cx / ring, cy / ring, cz);
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j;
      const b = i * ring + ((j + 1) % ring);
      if (i === 0) {
        indices.push(centre, b, a);
      } else {
        indices.push(centre, a, b);
      }
    }
  }
}

// Signed volume via the divergence theorem (positive when outward-wound).
export function meshVolume(positions, indices) {
  let v = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const ax = positions[a];
    const ay = positions[a + 1];
    const az = positions[a + 2];
    const bx = positions[b];
    const by = positions[b + 1];
    const bz = positions[b + 2];
    const cx = positions[c];
    const cy = positions[c + 1];
    const cz = positions[c + 2];
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}
