// Tileable Worley (cellular) foam texture, generated at startup.
// Sea foam is a froth of bubbles: dense foam is white with a few dark holes
// (cell centres), thinning foam breaks into a lace of bubble walls (cell
// edges). Channels (RGBA8):
//   R  coverage field: histogram-equalised multi-scale F1, so the shader's
//      `R > 1 - cover` shows exactly `cover` of the area as foam
//   G  lace: bright where coarse cells meet (F2 - F1 small)
//   B  coverage field of the fine layer alone (equalised F1)
//   A  lace of the fine layer

import * as THREE from 'three';
import { mulberry32 } from '../core/Rng.js';

// Periodic F1/F2 for a jittered grid of `cells` x `cells` over the tile.
function worley(size, cells, rng) {
  const px = new Float32Array(cells * cells);
  const py = new Float32Array(cells * cells);
  for (let i = 0; i < px.length; i++) {
    px[i] = 0.1 + 0.8 * rng();
    py[i] = 0.1 + 0.8 * rng();
  }
  const f1 = new Float32Array(size * size);
  const edge = new Float32Array(size * size);
  const scale = cells / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = x * scale;
      const gy = y * scale;
      const cx = Math.floor(gx);
      const cy = Math.floor(gy);
      let d1 = 9;
      let d2 = 9;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const ix = (((cx + ox) % cells) + cells) % cells;
          const iy = (((cy + oy) % cells) + cells) % cells;
          const k = iy * cells + ix;
          const dx = cx + ox + px[k] - gx;
          const dy = cy + oy + py[k] - gy;
          const d = Math.hypot(dx, dy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) {
            d2 = d;
          }
        }
      }
      f1[y * size + x] = d1;
      edge[y * size + x] = d2 - d1;
    }
  }
  return { f1, edge };
}

// Replace each value by its rank in [0, 1] (histogram equalisation).
function equalise(v) {
  const idx = Array.from(v.keys()).sort((a, b) => v[a] - v[b]);
  const out = new Float32Array(v.length);
  for (let r = 0; r < idx.length; r++) {
    out[idx[r]] = r / (idx.length - 1);
  }
  return out;
}

export function createFoamBubbles(size = 256) {
  const rng = mulberry32(4242);
  const coarse = worley(size, 12, rng);
  const fine = worley(size, 32, rng);
  const mixed = new Float32Array(size * size);
  for (let i = 0; i < mixed.length; i++) {
    // Big bubbles host small ones: the fine layer perturbs the coarse field.
    mixed[i] = coarse.f1[i] * 0.7 + fine.f1[i] * 0.3 * (12 / 32) * 2;
  }
  const r = equalise(mixed);
  const b = equalise(fine.f1);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const laceC = Math.max(0, 1 - coarse.edge[i] / 0.12);
    const laceF = Math.max(0, 1 - fine.edge[i] / 0.14);
    data[i * 4] = Math.round(r[i] * 255);
    data[i * 4 + 1] = Math.round(laceC * laceC * 255);
    data[i * 4 + 2] = Math.round(b[i] * 255);
    data[i * 4 + 3] = Math.round(laceF * laceF * 255);
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
