// Voxelizes a closed hull mesh into buoyancy sample points (spec 3.3).
// 1. Vertical rays through a fine grid give exact inside intervals per column
//    (ray-parity inside test against the mesh triangles).
// 2. Fine voxels are merged into a coarse grid, symmetric about the centreline
//    and aligned to the DWL, growing the cell size until the point budget fits.
// Each point: { x, y, z, v (m^3), h (m) } in the hull's local frame.

function columnIntervals(tris, x, z) {
  const hits = [];
  for (const t of tris) {
    if (x < t.minX || x > t.maxX || z < t.minZ || z > t.maxZ) {
      continue;
    }
    const d = (t.bz - t.cz) * (t.ax - t.cx) + (t.cx - t.bx) * (t.az - t.cz);
    if (Math.abs(d) < 1e-12) {
      continue;
    }
    const l1 = ((t.bz - t.cz) * (x - t.cx) + (t.cx - t.bx) * (z - t.cz)) / d;
    const l2 = ((t.cz - t.az) * (x - t.cx) + (t.ax - t.cx) * (z - t.cz)) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) {
      continue;
    }
    hits.push(l1 * t.ay + l2 * t.by + l3 * t.cy);
  }
  hits.sort((a, b) => a - b);
  const intervals = [];
  for (let i = 0; i + 1 < hits.length; i += 2) {
    intervals.push([hits[i], hits[i + 1]]);
  }
  return intervals;
}

function buildTris(positions, indices) {
  const tris = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const t = {
      ax: positions[a],
      ay: positions[a + 1],
      az: positions[a + 2],
      bx: positions[b],
      by: positions[b + 1],
      bz: positions[b + 2],
      cx: positions[c],
      cy: positions[c + 1],
      cz: positions[c + 2],
    };
    t.minX = Math.min(t.ax, t.bx, t.cx);
    t.maxX = Math.max(t.ax, t.bx, t.cx);
    t.minZ = Math.min(t.az, t.bz, t.cz);
    t.maxZ = Math.max(t.az, t.bz, t.cz);
    tris.push(t);
  }
  return tris;
}

export function fineVoxels(mesh, fine) {
  const { positions, indices } = mesh;
  const tris = buildTris(positions, indices);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    maxY = Math.max(maxY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]);
    maxZ = Math.max(maxZ, positions[i + 2]);
  }
  const cells = [];
  const y0 = Math.floor(minY / fine) * fine;
  // Tiny offsets keep rays off shared edges and vertices.
  for (let x = Math.floor(minX / fine) * fine + fine / 2; x < maxX; x += fine) {
    for (let z = Math.floor(minZ / fine) * fine + fine / 2; z < maxZ; z += fine) {
      const iv = columnIntervals(tris, x + 1.37e-5, z + 2.11e-5);
      if (!iv.length) {
        continue;
      }
      for (let y = y0; y < maxY; y += fine) {
        let len = 0;
        let lo = Infinity;
        let hi = -Infinity;
        for (const [a, b] of iv) {
          const s = Math.max(a, y);
          const e = Math.min(b, y + fine);
          if (e > s) {
            len += e - s;
            lo = Math.min(lo, s);
            hi = Math.max(hi, e);
          }
        }
        if (len > 1e-6) {
          cells.push({ x, y: (lo + hi) / 2, z, v: len * fine * fine, lo, hi });
        }
      }
    }
  }
  return cells;
}

function cluster(cells, size) {
  const map = new Map();
  for (const c of cells) {
    const ix = Math.floor(c.x / size.x);
    const iy = Math.floor(c.y / size.y);
    const iz = Math.floor(c.z / size.z);
    const key = `${ix},${iy},${iz}`;
    let g = map.get(key);
    if (!g) {
      g = { sx: 0, sz: 0, v: 0, lo: Infinity, hi: -Infinity };
      map.set(key, g);
    }
    g.sx += c.x * c.v;
    g.sz += c.z * c.v;
    g.v += c.v;
    g.lo = Math.min(g.lo, c.lo);
    g.hi = Math.max(g.hi, c.hi);
  }
  const points = [];
  for (const g of map.values()) {
    points.push({ x: g.sx / g.v, y: (g.lo + g.hi) / 2, z: g.sz / g.v, v: g.v, h: g.hi - g.lo });
  }
  return points;
}

// Hulls are symmetric: cluster the starboard half and mirror it so the
// points are exactly symmetric (no spurious static heel).
function mirrored(cells, size) {
  const half = cluster(cells.filter((c) => c.x > 0), size);
  const out = [];
  for (const p of half) {
    out.push(p, { ...p, x: -p.x });
  }
  return out;
}

export function voxelize(mesh, dims, fine, budget) {
  const cells = fineVoxels(mesh, fine);
  const base = { x: dims.beam / 4, y: dims.depth / 3, z: dims.length / 8 };
  let points = [];
  for (let scale = 0.5; scale < 6; scale += 0.05) {
    const size = { x: base.x * scale, y: base.y * scale, z: base.z * scale };
    points = mirrored(cells, size);
    if (points.length <= budget) {
      break;
    }
  }
  let total = 0;
  for (const c of cells) {
    total += c.v;
  }
  return { points, totalVolume: total, fineCount: cells.length };
}
