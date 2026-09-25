// Procedural tow targets: a 10 m sloop and a 16 m trawler, built from the
// same HullShape the physics voxelizes (so they float on their painted
// waterline). Bands are vertex colours; grime is shader-injected.

import * as THREE from 'three';
import { buildHullMesh, hullStation, sectionPoint } from '../../physics/HullShape.js';
import { bowCleatLocal } from '../../physics/fittings.js';
import { WORLD } from '../../config/palette.js';
import { addHullGrime } from './hullGrime.js';

const PER_SIDE = 12;

function std(color, rough = 0.6, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

// colors: { bottom, boot, top, sheer } (THREE.Color); boot: [y0, y1].
function paintedHull(h, colors, boot) {
  const mesh = buildHullMesh(h, 36, PER_SIDE, false);
  const pos = new Float32Array(mesh.positions);
  const col = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const y = pos[i + 1];
    const u = Math.abs(PER_SIDE - ((i / 3) % mesh.ring)) / PER_SIDE;
    const c = y < boot[0] ? colors.bottom : y < boot[1] ? colors.boot : u > 0.95 ? colors.sheer : colors.top;
    col[i] = c.r;
    col[i + 1] = c.g;
    col[i + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(mesh.indices);
  geo.computeVertexNormals();
  const mat = addHullGrime(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), { deck: h.freeboard });
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
  const deck = new THREE.Mesh(geo, std(deckColor, 0.85));
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
  const colors = {
    bottom: new THREE.Color(0x1d2f3f),
    boot: new THREE.Color(0xd9d2c0),
    top: new THREE.Color(0x284c68),
    sheer: new THREE.Color(0xe8e4da),
  };
  g.add(paintedHull(h, colors, [-0.02, 0.1]));
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
  const colors = {
    bottom: new THREE.Color(WORLD.antifouling).multiplyScalar(0.8),
    boot: new THREE.Color(0x1a1d1f),
    top: new THREE.Color(0x2d4b47),
    sheer: new THREE.Color(0xd9d4c6),
  };
  g.add(paintedHull(h, colors, [0.0, 0.18]));
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

export const TARGET_MODELS = { sailboat: buildSailboatModel, trawler: buildTrawlerModel };
