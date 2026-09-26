// Procedural spray sprite atlas (generated once at startup, no downloads).
// 512x256 RGBA: left half = 2x2 droplet clusters, right half = 2x2 mist puffs.
// Alpha carries coverage; RGB carries a little internal shading.

import * as THREE from 'three';
import { mulberry32 } from '../core/Rng.js';

const CELL = 128;

function valueNoise(rng, size) {
  const g = new Float32Array(size * size);
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
    const i = (a, b) => g[(((b % size) + size) % size) * size + (((a % size) + size) % size)];
    const a = i(xi, yi);
    const b = i(xi + 1, yi);
    const c = i(xi, yi + 1);
    const d = i(xi + 1, yi + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}

function fbm(n, x, y) {
  let v = 0;
  let a = 0.5;
  for (let o = 0; o < 5; o++) {
    v += a * n(x, y);
    x *= 2.03;
    y *= 2.03;
    a *= 0.5;
  }
  return v;
}

// Droplet cluster: a few large drops (each sprite is small on screen, so
// the drops must stay several pixels wide after minification).
function drawDroplets(img, ox, oy, rng) {
  const drops = 4 + Math.floor(rng() * 5);
  for (let k = 0; k < drops; k++) {
    const r = k === 0 ? 0 : Math.pow(rng(), 0.8) * CELL * 0.32;
    const ang = rng() * Math.PI * 2;
    const cx = CELL / 2 + Math.cos(ang) * r;
    const cy = CELL / 2 + Math.sin(ang) * r;
    const rad = (k === 0 ? 20 : 8) + rng() * 12;
    const x0 = Math.max(0, Math.floor(cx - rad - 1));
    const x1 = Math.min(CELL - 1, Math.ceil(cx + rad + 1));
    const y0 = Math.max(0, Math.floor(cy - rad - 1));
    const y1 = Math.min(CELL - 1, Math.ceil(cy + rad + 1));
    const strength = 0.55 + rng() * 0.45;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / rad;
        if (d >= 1) {
          continue;
        }
        const a = (1 - d * d) * strength;
        const i = ((oy + y) * img.width + ox + x) * 4;
        // Bright rim + darker core reads as a water drop catching light.
        const shade = 0.75 + 0.25 * Math.min(1, d * 1.6);
        img.data[i] = Math.max(img.data[i], 255 * shade);
        img.data[i + 1] = Math.max(img.data[i + 1], 255 * shade);
        img.data[i + 2] = Math.max(img.data[i + 2], 255 * shade);
        img.data[i + 3] = Math.min(255, img.data[i + 3] + a * 255);
      }
    }
  }
}

// Mist puff: a billow of overlapping lobes (like a small cumulus), eroded
// by fbm into wispy edges. RGB carries fake self-shadowing: the underside
// and core are darker, the top and rim brighter.
function drawMist(img, ox, oy, rng) {
  const n = valueNoise(rng, 32);
  const seed = rng() * 50;
  const lobes = [];
  const count = 5 + Math.floor(rng() * 4);
  for (let k = 0; k < count; k++) {
    const a = rng() * Math.PI * 2;
    const d = k === 0 ? 0 : 0.12 + rng() * 0.28;
    lobes.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8 - 0.05, r: 0.16 + rng() * 0.16 });
  }
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const u = (x / CELL) * 2 - 1;
      const v = (y / CELL) * 2 - 1;
      // Soft union of the lobes (max, not sum, so the billow keeps its
      // lumpy outline instead of saturating into a disc).
      let dens = 0;
      for (const l of lobes) {
        const dx = (u - l.x) / l.r;
        const dy = (v - l.y) / l.r;
        dens = Math.max(dens, Math.exp(-(dx * dx + dy * dy) * 1.6));
      }
      const f = fbm(n, x / 14 + seed, y / 14 + seed);
      const edge = Math.max(0, 1 - Math.hypot(u, v) * 1.05);
      // Cauliflower edges: threshold the eroded density instead of a soft ramp.
      const d = dens * (0.3 + 1.1 * f);
      const t = Math.min(1, Math.max(0, (d - 0.32) / 0.45)) * (0.55 + 0.45 * dens);
      const a = t * t * (3 - 2 * t) * Math.min(1, edge * 3);
      const i = ((oy + y) * img.width + ox + x) * 4;
      // Canvas y grows downward: v > 0 is the underside.
      const shade = 0.78 + 0.22 * Math.max(0, Math.min(1, 0.5 - v * 0.8)) + 0.1 * (f - 0.5) - 0.12 * Math.min(1, dens * 0.4);
      const c = Math.max(0, Math.min(255, shade * 255));
      img.data[i] = c;
      img.data[i + 1] = c;
      img.data[i + 2] = Math.min(255, c * 1.02);
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
}

export function createSprayAtlas() {
  const w = CELL * 4;
  const h = CELL * 2;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const img = g.createImageData(w, h);
  const rng = mulberry32(2024);
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      drawDroplets(img, cx * CELL, cy * CELL, rng);
      drawMist(img, (cx + 2) * CELL, cy * CELL, rng);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}
