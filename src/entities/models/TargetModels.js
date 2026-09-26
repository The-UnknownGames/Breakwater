// Procedural tow targets: a 10 m sloop and a 16 m trawler, built from the
// same HullShape the physics voxelizes (so they float on their painted
// waterline). Bands are vertex colours; grime is shader-injected.

import * as THREE from 'three';
import { buildHullMesh, hullStation, sectionPoint } from '../../physics/HullShape.js';
import { bowCleatLocal } from '../../physics/fittings.js';
import { WORLD } from '../../config/palette.js';
import { hullMaterial } from './hullGrime.js';
import { nonSkidDeck, planarUV } from './materials.js';

function std(color, rough = 0.6, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

// Smooth hull with per-pixel paint bands (see hullGrime.js).
function paintedHull(h, paint) {
  const mesh = buildHullMesh(h, 90, 24, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mesh.positions), 3));
  geo.setIndex(mesh.indices);
  geo.computeVertexNormals();
  const mat = hullMaterial(h, paint);
  mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sheer(h, z) {
  const st = hullStation(h, Math.min(1, Math.max(0, z / h.length + 0.5)));
  return { x: sectionPoint(st, 1).x, y: st.deck };
}

// Deck plate plus a transom cap, following the sheer.
function deckAndTransom(h, deckColor, transomColor) {
  const g = new THREE.Group();
  const positions = [];
  const idx = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const st = hullStation(h, i / n);
    const x = Math.max(0, sectionPoint(st, 1).x - 0.02);
    positions.push(x, st.deck - 0.02, st.z, -x, st.deck - 0.02, st.z);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const deck = new THREE.Mesh(planarUV(geo), nonSkidDeck(deckColor));
  deck.receiveShadow = true;
  g.add(deck);
  const st = hullStation(h, 0);
  const shape = new THREE.Shape();
  const k = 10;
  for (let j = 0; j <= k; j++) {
    const p = sectionPoint(st, j / k);
    if (j === 0) {
      shape.moveTo(p.x, p.y);
    } else {
      shape.lineTo(p.x, p.y);
    }
  }
  for (let j = k; j >= 0; j--) {
    const p = sectionPoint(st, j / k);
    shape.lineTo(-p.x, p.y);
  }
  const tr = new THREE.Mesh(new THREE.ShapeGeometry(shape), std(transomColor, 0.6));
  tr.material.side = THREE.DoubleSide;
  tr.position.z = st.z - 0.01;
  g.add(tr);
  return g;
}

function box(w, hgt, l, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, l), mat);
  m.position.set(x, y + hgt / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function rod(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
}

function cleat(group, h, mat) {
  const c = bowCleatLocal(h);
  group.add(box(0.14, 0.28, 0.14, mat, 0, c.y - 0.18, c.z));
  const e = new THREE.Object3D();
  e.name = 'bowCleat';
  e.position.set(c.x, c.y, c.z);
  group.add(e);
}

export function buildSailboatModel(cfg) {
  const h = cfg.hull;
  const g = new THREE.Group();
  g.name = 'sailboat';
  g.add(paintedHull(h, { bottom: 0x1d2f3f, boot: 0xd9d2c0, top: 0x284c68, sheer: 0xe8e4da, bootY: [-0.02, 0.1], stripe: 0.07, grime: 0.6 }));
  g.add(deckAndTransom(h, 0xb59a74, 0x284c68));
  const white = std(0xe9e6de, 0.45);
  const steel = std(0xbfc4c6, 0.3, 0.8);
  // Fin keel and spade rudder.
  g.add(box(0.14, 1.2, 1.3, std(0x1d2f3f, 0.7), 0, -h.draft - 1.15, 0.2));
  g.add(box(0.07, 0.8, 0.5, std(0x1d2f3f, 0.7), 0, -h.draft - 0.55, -h.length / 2 + 0.9));
  // Cabin trunk + coachroof, cockpit coaming.
  const d = sheer(h, 0).y;
  g.add(box(2.0, 0.55, 3.4, white, 0, d - 0.02, 0.6));
  g.add(box(1.7, 0.08, 3.0, white, 0, d + 0.53, 0.55));
  for (const s of [1, -1]) {
    g.add(box(0.05, 0.28, 0.5, std(0x10181d, 0.15), s * 1.0, d + 0.15, 1.4));
    g.add(box(0.05, 0.28, 0.5, std(0x10181d, 0.15), s * 1.0, d + 0.15, 0.3));
  }
  // Mast, boom with furled main, standing rigging.
  const mastBase = new THREE.Vector3(0, d + 0.6, 1.9);
  const mastTop = new THREE.Vector3(0, d + 12.5, 1.9);
  g.add(rod(mastBase, mastTop, 0.07, steel));
  const boomEnd = new THREE.Vector3(0, d + 1.5, -2.6);
  g.add(rod(new THREE.Vector3(0, d + 1.5, 1.85), boomEnd, 0.06, steel));
  g.add(rod(new THREE.Vector3(0, d + 1.72, 1.7), new THREE.Vector3(0, d + 1.66, -2.4), 0.16, std(0xd8cfb8, 0.9)));
  const wire = std(0x9aa0a3, 0.4, 0.8);
  const stem = new THREE.Vector3(0, sheer(h, h.length / 2 - 0.2).y + 0.1, h.length / 2 - 0.2);
  g.add(rod(mastTop, stem, 0.012, wire));
  g.add(rod(mastTop, new THREE.Vector3(0, sheer(h, -h.length / 2).y + 0.1, -h.length / 2 + 0.2), 0.012, wire));
  for (const s of [1, -1]) {
    const chain = new THREE.Vector3(s * sheer(h, 1.9).x, d + 0.05, 1.9);
    g.add(rod(mastTop.clone().setY(d + 9), chain, 0.01, wire));
  }
  // Bow pulpit.
  const pul = sheer(h, h.length / 2 - 1.2);
  for (const s of [1, -1]) {
    g.add(rod(new THREE.Vector3(s * pul.x * 0.8, pul.y, h.length / 2 - 1.2), new THREE.Vector3(s * 0.25, pul.y + 0.6, h.length / 2 - 0.5), 0.02, steel));
  }
  cleat(g, h, steel);
  return g;
}

export function buildTrawlerModel(cfg) {
  const h = cfg.hull;
  const g = new THREE.Group();
  g.name = 'trawler';
  g.add(paintedHull(h, { bottom: 0x6f231c, boot: 0x1a1d1f, top: 0x2d4b47, sheer: 0xd9d4c6, bootY: [0.0, 0.18], stripe: 0.1, grime: 1.5, band: 0.45 }));
  g.add(deckAndTransom(h, 0x6f6a60, 0x2d4b47));
  const white = std(0xd8d6ce, 0.55);
  const dark = std(0x23292c, 0.7);
  const rust = std(0xb0562a, 0.65, 0.2);
  // High bulwarks.
  for (const s of [1, -1]) {
    const pts = [];
    for (let z = -h.length / 2 + 0.3; z <= h.length / 2 - 0.8; z += 0.8) {
      const p = sheer(h, z);
      pts.push(new THREE.Vector3(s * p.x, p.y + 0.35, z));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.06, 5), std(0xd9d4c6, 0.6)));
  }
  // Wheelhouse forward of midships, with a dark window band.
  const d = sheer(h, 2.5).y;
  g.add(box(3.6, 1.2, 4.2, white, 0, d, 2.4));
  g.add(box(3.2, 1.3, 3.0, white, 0, d + 1.2, 2.8));
  g.add(box(3.25, 0.55, 3.05, std(0x0e1519, 0.12), 0, d + 1.75, 2.8));
  g.add(box(3.5, 0.12, 3.4, dark, 0, d + 2.5, 2.8));
  // Mast with a derrick, stack.
  const mast = new THREE.Vector3(0, d + 2.6, 1.6);
  g.add(rod(mast, mast.clone().setY(d + 7.2), 0.09, white));
  g.add(rod(mast.clone().setY(d + 3.2), new THREE.Vector3(0, d + 1.6, -3.5), 0.06, white));
  g.add(box(0.5, 1.0, 0.5, dark, 0.9, d + 2.5, 1.5));
  // Net drum and stern gantry (A-frame).
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 16), std(0x3c4a3f, 0.8));
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0, sheer(h, -4.5).y + 0.75, -4.5);
  drum.castShadow = true;
  g.add(drum);
  const sz = -h.length / 2 + 0.6;
  const sy = sheer(h, sz).y;
  for (const s of [1, -1]) {
    g.add(rod(new THREE.Vector3(s * 2.1, sy, sz + 0.4), new THREE.Vector3(s * 1.3, sy + 4.2, sz - 0.3), 0.12, rust));
  }
  g.add(rod(new THREE.Vector3(-1.35, sy + 4.2, sz - 0.3), new THREE.Vector3(1.35, sy + 4.2, sz - 0.3), 0.14, rust));
  // Orange fishing buoys along the rail.
  const buoyMat = std(WORLD.rescueOrange, 0.5);
  for (let i = 0; i < 4; i++) {
    const z = -1.5 - i * 0.6;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), buoyMat);
    b.position.set(sheer(h, z).x + 0.05, sheer(h, z).y + 0.1, z);
    g.add(b);
  }
  cleat(g, h, dark);
  return g;
}

// A 40 ft container adrift: corrugated box riding low, doors aft.
const BOX_COLORS = [0xb03a2e, 0x2c4a6e, 0x6e7b52, 0xc78b2a, 0x7a3d6b, 0x3a3f44];
let boxCount = 0;

export function buildContainerModel(cfg) {
  const h = cfg.hull;
  const g = new THREE.Group();
  g.name = 'container';
  const color = BOX_COLORS[boxCount++ % BOX_COLORS.length];
  const height = h.draft + h.freeboard;
  const box = new THREE.Mesh(new THREE.BoxGeometry(h.beam, height, h.length), std(color, 0.6, 0.3));
  box.position.y = (h.freeboard - h.draft) / 2;
  box.castShadow = true;
  g.add(box);
  // Corrugation ribs along the sides and top rails.
  const ribMat = std(new THREE.Color(color).multiplyScalar(0.8).getHex(), 0.6, 0.3);
  for (let z = -h.length / 2 + 0.4; z < h.length / 2; z += 0.5) {
    for (const s of [1, -1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, height * 0.96, 0.18), ribMat);
      rib.position.set(s * (h.beam / 2 + 0.02), box.position.y, z);
      g.add(rib);
    }
  }
  const doors = new THREE.Mesh(new THREE.BoxGeometry(h.beam * 0.96, height * 0.94, 0.08), std(0x2a2e31, 0.7, 0.4));
  doors.position.set(0, box.position.y, -h.length / 2 - 0.03);
  g.add(doors);
  return g;
}

// A 60 m deck barge: rusty hull, raked bow, a gravel load and bollards.
export function buildBargeModel(cfg) {
  const h = cfg.hull;
  const g = new THREE.Group();
  g.name = 'barge';
  g.add(paintedHull(h, { bottom: 0x5a2a20, boot: 0x1a1d1f, top: 0x4c4f4a, sheer: 0xc78b2a, bootY: [0.0, 0.25], stripe: 0.15, grime: 2, band: 0.5 }));
  g.add(deckAndTransom(h, 0x5b5750, 0x4c4f4a));
  const deck = sheer(h, 0).y;
  // Heaped gravel and a few containers on deck.
  const heap = new THREE.Mesh(new THREE.ConeGeometry(9, 4, 12), std(0x8a8478, 0.95));
  heap.scale.set(1, 1, 2.4);
  heap.position.set(0, deck + 2, -6);
  heap.castShadow = true;
  g.add(heap);
  for (const [x, z, c] of [[-3.5, 18, 0xb03a2e], [0, 18, 0x2c4a6e], [3.5, 18, 0x6e7b52]]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.44, 2.6, 12), std(c, 0.6, 0.3));
    box.position.set(x, deck + 1.3, z);
    box.castShadow = true;
    g.add(box);
  }
  const iron = std(0x2a2e31, 0.6, 0.5);
  for (const z of [-h.length / 2 + 2, h.length / 2 - 3]) {
    for (const x of [-4, 4]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 10), iron);
      b.position.set(x, deck + 0.4, z);
      g.add(b);
    }
  }
  return g;
}

export const TARGET_MODELS = { sailboat: buildSailboatModel, trawler: buildTrawlerModel, container: buildContainerModel, barge: buildBargeModel };
