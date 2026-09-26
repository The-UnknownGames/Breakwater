// Procedural big boats: Solace (18 m motor yacht), Islander (45 m island
// ferry) and Northfarer (72 m coastal freighter). Same HullShape shell and
// named empties as the workboats; superstructures are stacked blocks with
// window bands, funnels, masts and deck cargo.

import * as THREE from 'three';
import { WORLD } from '../../config/palette.js';
import { createHullNumber } from './decals.js';
import { gelcoat, stainless } from './materials.js';
import { std, sheerAt, bulwarkGeometry } from './MarlinModel.js';
import { shell, finish } from './BoatModels.js';

const GLASS = new THREE.MeshPhysicalMaterial({ color: 0x16222c, roughness: 0.08, metalness: 0.3, clearcoat: 1 });

function block(group, mat, w, h, l, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

// A deck level with a dark window band round it.
function deckLevel(group, mat, w, h, l, y, z, band = 0.45) {
  block(group, mat, w, h, l, 0, y, z);
  block(group, GLASS, w + 0.02, h * band, l + 0.02, 0, y + h * 0.35, z);
}

function mast(group, x, y, z, height, radar = 0) {
  const m = std(0xb7bcbf, 0.35, 0.6);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, height, 8), m);
  pole.position.set(x, y + height / 2, z);
  group.add(pole);
  if (radar) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(radar, 0.1, 0.25), std(WORLD.workboatNavy, 0.5));
    r.position.set(x, y + height * 0.8, z);
    r.name = 'radar';
    group.add(r);
  }
}

function railing(group, h, from, to, height = 1) {
  const mat = stainless();
  for (const side of [1, -1]) {
    const pts = [];
    for (let z = from; z <= to; z += 1) {
      const s = sheerAt(h, z);
      pts.push(new THREE.Vector3(side * (s.x - 0.05), s.y + height, z));
    }
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.035, 6), mat));
  }
}

export function buildSolaceModel(cfg) {
  const h = cfg.hull;
  const g = new THREE.Group();
  g.name = 'solace';
  shell(g, h, { bottom: 0x1d2a38, boot: 0x1d2a38, top: WORLD.hullWhite, sheer: 0x8a9aa8, bootY: [0.05, 0.25], stripe: 0.08 }, 0xb39b76);
  const white = gelcoat(WORLD.hullWhite);
  const y = sheerAt(h, 0).y;
  // Saloon, then the flybridge above it, both swept back.
  deckLevel(g, white, 4.2, 1.9, 8.5, y, -0.5, 0.5);
  deckLevel(g, white, 3.6, 0.9, 5, y + 1.9, -1.2, 0.35);
  block(g, GLASS, 3.9, 0.9, 0.2, 0, y + 0.8, 3.8).rotation.x = -0.5;
  // Flybridge hardtop on posts.
  const top = block(g, white, 3.8, 0.12, 4.2, 0, y + 3.7, -1.6);
  top.castShadow = true;
  for (const [x, z] of [[1.7, 0.4], [-1.7, 0.4], [1.7, -3.6], [-1.7, -3.6]]) {
    block(g, std(0xb7bcbf, 0.35, 0.6), 0.08, 0.9, 0.08, x, y + 2.8, z);
  }
  mast(g, 0, y + 3.8, -2.4, 1.6, 1.2);
  railing(g, h, -8, 7, 0.9);
  for (const side of [1, -1]) {
    g.add(createHullNumber('SOLACE', side, h));
  }
  const tz = -h.length / 2 + 1;
  return finish(g, cfg, {
    tow: new THREE.Vector3(0, sheerAt(h, tz).y + 0.45, tz),
    searchlight: new THREE.Vector3(0, y + 3.9, 0.4),
    helm: new THREE.Vector3(-0.8, y + 3.0, -0.2),
  });
}

export function buildIslanderModel(cfg) {
  const h = cfg.hull;
  const g = new THREE.Group();
  g.name = 'islander';
  shell(g, h, { bottom: WORLD.antifouling, boot: 0x1d3f6e, top: WORLD.hullWhite, sheer: 0x1d3f6e, bootY: [0.1, 0.5], stripe: 0.35 }, 0x6d7275);
  const white = gelcoat(WORLD.hullWhite);
  const bm = gelcoat(WORLD.hullWhite);
  bm.side = THREE.DoubleSide;
  g.add(new THREE.Mesh(bulwarkGeometry(h, 1.1), bm));
  const y = sheerAt(h, 0).y;
  // Vehicle deck aft (open), passenger decks and bridge forward.
  deckLevel(g, white, 9.6, 2.6, 22, y, 6, 0.4);
  deckLevel(g, white, 8.6, 2.4, 16, y + 2.6, 7, 0.45);
  deckLevel(g, white, 6, 2.2, 5, y + 5, 11.5, 0.5);
  // Funnel with a blue band.
  const fy = y + 5;
  block(g, white, 1.8, 3.2, 2.6, 0, fy, 1.5);
  block(g, std(0x1d3f6e, 0.5), 1.82, 0.8, 2.62, 0, fy + 2.2, 1.5);
  mast(g, 0, y + 7.2, 11.5, 4, 2.4);
  // Lifeboats (orange) along the upper deck.
  for (const side of [1, -1]) {
    for (const z of [3, 10]) {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 3.2, 4, 10), gelcoat(WORLD.rescueOrange));
      b.rotation.x = Math.PI / 2;
      b.position.set(side * 4.9, y + 4.2, z);
      g.add(b);
    }
  }
  // Cars on the open vehicle deck.
  const colors = [0x8a2b22, 0x2c4a6e, 0xd8d8d0, 0x3a3f44, 0x6e7b52];
  let k = 0;
  for (let z = -18; z < -6; z += 4.8) {
    for (const x of [-2.6, 0, 2.6]) {
      block(g, std(colors[k++ % colors.length], 0.4, 0.3), 1.8, 1.4, 4.2, x, y, z);
    }
  }
  for (const side of [1, -1]) {
    g.add(createHullNumber('ISLANDER', side, h));
  }
  const tz = -h.length / 2 + 3;
  return finish(g, cfg, {
    tow: new THREE.Vector3(0, sheerAt(h, tz).y + 0.45, tz),
    searchlight: new THREE.Vector3(2.4, y + 7.2, 14),
    helm: new THREE.Vector3(-1.2, y + 6.6, 13.3),
  });
}

export function buildNorthfarerModel(cfg) {
  const h = cfg.hull;
  const g = new THREE.Group();
  g.name = 'northfarer';
  shell(g, h, { bottom: WORLD.antifouling, boot: 0x1b1e20, top: 0x23384a, sheer: 0xe8e4da, bootY: [0.2, 0.9], stripe: 0.35 }, 0x5b4a3c);
  const bm = gelcoat(0x23384a, 0.5);
  bm.side = THREE.DoubleSide;
  g.add(new THREE.Mesh(bulwarkGeometry(h, 1.2), bm));
  const white = gelcoat(WORLD.hullWhite, 0.45);
  // Accommodation block and bridge aft, funnel behind.
  const ay = sheerAt(h, -26).y;
  deckLevel(g, white, 11, 2.8, 9, ay, -28, 0.35);
  deckLevel(g, white, 10, 2.6, 8, ay + 2.8, -28, 0.4);
  deckLevel(g, white, 12.6, 2.4, 5, ay + 5.4, -26.5, 0.55);
  block(g, std(0x1b1e20, 0.5), 2.2, 4.5, 3, 0, ay + 5.4, -32);
  block(g, std(0xb03a2e, 0.5), 2.22, 1, 3.02, 0, ay + 8.4, -32);
  mast(g, 0, ay + 7.8, -26.5, 5, 3);
  // Hatch covers and a deck load of containers forward of the bridge.
  const hatch = std(0x3d4a3f, 0.7, 0.2);
  const cy = sheerAt(h, 0).y;
  const cols = [0xb03a2e, 0x2c4a6e, 0x6e7b52, 0xc78b2a, 0x3a3f44, 0x8a2b22];
  let k = 0;
  for (let z = -18; z <= 26; z += 11) {
    block(g, hatch, 10.5, 1.2, 10, 0, cy, z);
    for (const x of [-3.7, -1.25, 1.25, 3.7]) {
      const tiers = 1 + ((k * 7) % 3);
      for (let t = 0; t < tiers; t++) {
        block(g, std(cols[k++ % cols.length], 0.6, 0.2), 2.4, 2.55, 9.4, x, cy + 1.2 + t * 2.6, z);
      }
    }
  }
  mast(g, 0, sheerAt(h, 32).y, 32, 6, 0);
  for (const side of [1, -1]) {
    g.add(createHullNumber('NORTHFARER', side, h));
  }
  const tz = -h.length / 2 + 3;
  return finish(g, cfg, {
    tow: new THREE.Vector3(0, sheerAt(h, tz).y + 0.45, tz),
    searchlight: new THREE.Vector3(3, ay + 7.8, -24),
    helm: new THREE.Vector3(-1.5, ay + 7.2, -24.6),
  });
}
