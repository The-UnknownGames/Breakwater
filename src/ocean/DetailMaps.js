// Procedural tileable ripple normal maps, generated at startup.
// RGB = tangent-space normal (x, z, y packed), A = height (used for foam breakup).

import * as THREE from 'three';
import { mulberry32 } from '../core/Rng.js';

function makeLattice(size, rng) {
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) {
    g[i] = rng() * 2 - 1;
  }
  return g;
}

// Periodic value noise with quintic smoothing.
function periodicNoise(lattice, period, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const a = lattice[y0 * period + x0];
  const b = lattice[y0 * period + x1];
  const c = lattice[y1 * period + x0];
  const d = lattice[y1 * period + x1];
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function heightField(size, seed, baseFreq, octaves, stretch) {
  const rng = mulberry32(seed);
  const h = new Float32Array(size * size);
  const lattices = [];
  for (let o = 0; o < octaves; o++) {
    const period = baseFreq << o;
    lattices.push({ period, lattice: makeLattice(period * period, rng) });
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 1;
      for (let o = 0; o < octaves; o++) {
        const { period, lattice } = lattices[o];
        const sx = (x / size) * period;
        const sy = (y / size) * period;
        const n = periodicNoise(lattice, period, sx, sy);
        // Ridged octaves read like wind chop.
        v += amp * (o === 0 ? n : 1 - 2 * Math.abs(n));
        amp *= 0.5;
      }
      h[y * size + x] = v * stretch;
    }
  }
  return h;
}

function toTexture(h, size, bump) {
  const data = new Uint8Array(size * size * 4);
  let min = Infinity;
  let max = -Infinity;
  for (const v of h) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)];
      const r = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x];
      const d = h[((y + 1) % size) * size + x];
      let nx = (l - r) * bump;
      let nz = (u - d) * bump;
      let ny = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * size + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((nz * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 3] = Math.round(((h[y * size + x] - min) / (max - min)) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createDetailMaps(size = 256) {
  const ripple = heightField(size, 911, 4, 5, 1);
  const foam = heightField(size, 377, 8, 4, 1);
  return {
    ripple: toTexture(ripple, size, 6),
    foam: toTexture(foam, size, 2),
  };
}
