// Procedural spray sprites (generated once at startup, no downloads).
// Atlas 1024x512 RGBA, 256 px cells: left half = 2x2 droplet cells, right
// half = 2x2 mist billows. RGB is a tangent-space normal (x right, y up,
// z toward the viewer), A is coverage, so the shader can light each sprite
// as a 3D shape. Also a small tiling noise for mist wisps and dissolve.

import * as THREE from 'three';
import { mulberry32 } from '../core/Rng.js';

const CELL = 256;

function periodicNoise(rng, period) {
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) {
    g[i] = rng();
  }
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const w = (a) => ((a % period) + period) % period;
    const at = (a, b) => g[w(b) * period + w(a)];
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}

function fbm(n, x, y, oct = 5) {
  let v = 0;
  let a = 0.5;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    v += a * n(x, y);
    norm += a;
    x *= 2;
    y *= 2;
    a *= 0.5;
  }
  return v / norm;
}

function put(img, ox, oy, x, y, nx, ny, nz, a) {
  const i = ((oy + y) * img.width + ox + x) * 4;
  img.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
  img.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
  img.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
  img.data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
}

// Droplet cell: one main drop and a few satellites, each a little lens
// (sphere normals), with a soft rim.
function drawDroplets(img, ox, oy, rng) {
  const cov = new Float32Array(CELL * CELL);
  const nrm = new Float32Array(CELL * CELL * 3);
  for (let i = 0; i < CELL * CELL; i++) {
    nrm[i * 3 + 2] = 1;
  }
  const drops = 3 + Math.floor(rng() * 5);
  for (let k = 0; k < drops; k++) {
    const r = k === 0 ? 0 : (0.12 + rng() * 0.26) * CELL;
    const ang = rng() * Math.PI * 2;
    const cx = CELL / 2 + Math.cos(ang) * r;
    const cy = CELL / 2 + Math.sin(ang) * r;
    const rad = k === 0 ? 34 + rng() * 14 : 10 + rng() * 16;
    for (let y = Math.max(0, Math.floor(cy - rad - 2)); y < Math.min(CELL, cy + rad + 2); y++) {
      for (let x = Math.max(0, Math.floor(cx - rad - 2)); x < Math.min(CELL, cx + rad + 2); x++) {
        const dx = (x - cx) / rad;
        const dy = (cy - y) / rad;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) {
          continue;
        }
        const a = Math.min(1, (1 - Math.sqrt(d2)) * 4);
        const i = y * CELL + x;
        if (a > cov[i]) {
          cov[i] = a;
          nrm[i * 3] = dx;
          nrm[i * 3 + 1] = dy;
          nrm[i * 3 + 2] = Math.sqrt(1 - d2);
        }
      }
    }
  }
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const i = y * CELL + x;
      put(img, ox, oy, x, y, nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2], cov[i]);
    }
  }
}

// Mist billow: soft union of lobes, eroded by fbm into cauliflower edges;
// normals from the gradient of the (smoothed) density, like a height field.
function drawMist(img, ox, oy, rng, noise) {
  const seed = rng() * 64;
  const lobes = [];
  const count = 6 + Math.floor(rng() * 5);
  for (let k = 0; k < count; k++) {
    const a = rng() * Math.PI * 2;
    const d = k === 0 ? 0 : 0.1 + rng() * 0.32;
    lobes.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.85 + 0.04, r: 0.13 + rng() * 0.17 });
  }
  const dens = new Float32Array(CELL * CELL);
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const u = (x / CELL) * 2 - 1;
      const v = 1 - (y / CELL) * 2;
      let d = 0;
      for (const l of lobes) {
        const dx = (u - l.x) / l.r;
        const dy = (v - l.y) / l.r;
        // Smooth max of the lobes keeps the lumpy outline.
        d = Math.max(d, Math.exp(-(dx * dx + dy * dy) * 1.5));
      }
      const f = fbm(noise, x / 22 + seed, y / 22 + seed, 5);
      const edge = Math.max(0, 1 - Math.hypot(u, v) * 1.04);
      dens[y * CELL + x] = d * (0.3 + 1.15 * f) * Math.min(1, edge * 3.5);
    }
  }
  const at = (x, y) => dens[Math.min(CELL - 1, Math.max(0, y)) * CELL + Math.min(CELL - 1, Math.max(0, x))];
  const k = 26;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const d = at(x, y);
      const t = Math.min(1, Math.max(0, (d - 0.28) / 0.5));
      const a = t * t * (3 - 2 * t);
      // Height-field normal (up = -canvas y); wide stencil for smoothness.
      const gx = (at(x + 2, y) - at(x - 2, y)) * k;
      const gy = (at(x, y - 2) - at(x, y + 2)) * k;
      let nx = -gx;
      let ny = -gy;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      put(img, ox, oy, x, y, nx, ny, nz, a);
    }
  }
}

function texture(canvasOrData, w, h, data) {
  let tex;
  if (data) {
    tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.needsUpdate = true;
  } else {
    tex = new THREE.CanvasTexture(canvasOrData);
  }
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export function createSprayAtlas() {
  const w = CELL * 4;
  const h = CELL * 2;
  // A plain ImageData-shaped buffer (no premultiplication through a canvas,
  // which would destroy the normals where coverage is 0).
  const img = { width: w, data: new Uint8Array(w * h * 4) };
  const rng = mulberry32(2024);
  const noise = periodicNoise(rng, 64);
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      drawDroplets(img, cx * CELL, cy * CELL, rng);
      drawMist(img, (cx + 2) * CELL, cy * CELL, rng, noise);
    }
  }
  // DataTexture rows run bottom-up; flip so cell row 0 is the top row as in
  // the canvas layout the vertex shader expects.
  const flipped = new Uint8Array(img.data.length);
  const row = w * 4;
  for (let y = 0; y < h; y++) {
    flipped.set(img.data.subarray(y * row, (y + 1) * row), (h - 1 - y) * row);
  }
  return texture(null, w, h, flipped);
}

// Tiling fbm noise for mist wisps / dissolve (R channel).
export function createSprayNoise(size = 128) {
  const rng = mulberry32(99);
  const n = periodicNoise(rng, 16);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = fbm(n, (x / size) * 16, (y / size) * 16, 4);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(v * 255);
      data[i + 3] = 255;
    }
  }
  const tex = texture(null, size, size, data);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
