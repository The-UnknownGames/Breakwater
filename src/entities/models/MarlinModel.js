// Procedural Marlin (12 m workboat) — the fallback used when no Blender .glb
// is present. Built from the same HullShape the physics voxelizes, so the
// visual waterline matches the physics. Named empties (spec 2.6): towPoint,
// bowCleat, propeller, rudder, searchlight, helmCamera.

import * as THREE from 'three';
import { buildHullMesh, hullStation, sectionPoint } from '../../physics/HullShape.js';
import { WORLD } from '../../config/palette.js';
import { createHullNumber } from './decals.js';
import { buildDeckhouse } from './Deckhouse.js';
import { addHullGrime } from './hullGrime.js';

const C = {
  hull: new THREE.Color(WORLD.hullWhite),
  bottom: new THREE.Color(WORLD.antifouling),
  navy: new THREE.Color(WORLD.workboatNavy),
};

function std(color, rough = 0.5, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

const PER_SIDE = 16;

function hullGeometry(h) {
  const mesh = buildHullMesh(h, 44, PER_SIDE, false);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(mesh.positions);
  const colors = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const y = pos[i + 1];
    const j = PER_SIDE - ((i / 3) % mesh.ring);
    const u = Math.abs(j) / PER_SIDE;
    let c = C.hull;
    if (y < 0.06) {
      c = C.bottom;
    } else if (y < 0.2) {
      c = C.navy;
    } else if (u > 0.94) {
      c = C.navy;
    }
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(mesh.indices);
  geo.computeVertexNormals();
  return geo;
}

function hullColor(y, u) {
  if (y < 0.06) {
    return C.bottom;
  }
  if (y < 0.2 || u > 0.94) {
    return C.navy;
  }
  return C.hull;
}

// Transom: horizontal strips between the two sides of the stern section,
// so the antifouling / boot-top / topside bands stay crisp.
function transomGeometry(h, levels = 18) {
  const st = hullStation(h, 0);
  const positions = [];
  const colors = [];
  const indices = [];
  for (let k = 0; k <= levels; k++) {
    const u = k / levels;
    const p = sectionPoint(st, u);
    for (const side of [1, -1]) {
      positions.push(side * p.x, p.y, st.z - 0.002);
      const c = hullColor(p.y, u);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let k = 0; k < levels; k++) {
    const a = k * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Flat deck following the sheer line.
function deckGeometry(h, stations = 44) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= stations; i++) {
    const st = hullStation(h, i / stations);
    const p = sectionPoint(st, 1);
    const inset = Math.max(0, p.x - 0.03);
    positions.push(inset, st.deck - 0.02, st.z, -inset, st.deck - 0.02, st.z);
  }
  for (let i = 0; i < stations; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Solid bulwark along the sheer (0.35 m), open at the stern.
function bulwarkGeometry(h, height = 0.35, stations = 44) {
  const positions = [];
  const indices = [];
  const i0 = 2;
  for (let i = i0; i <= stations; i++) {
    const st = hullStation(h, i / stations);
    const p = sectionPoint(st, 1);
    for (const side of [1, -1]) {
      positions.push(side * p.x, st.deck, st.z, side * (p.x + 0.01), st.deck + height, st.z);
    }
  }
  const n = stations - i0;
  for (let i = 0; i < n; i++) {
    const a = i * 4;
    const b = a + 4;
    // starboard (outward +X) and port (outward -X)
    indices.push(a, b, a + 1, a + 1, b, b + 1);
    indices.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function sheerAt(h, z) {
  const s = z / h.length + 0.5;
  const st = hullStation(h, Math.min(Math.max(s, 0), 1));
  return { x: sectionPoint(st, 1).x, y: st.deck };
}

function addRailing(group, h, mat) {
  const postGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6);
  const posts = [];
  for (let z = -h.length / 2 + 0.4; z < h.length / 2 - 1.2; z += 1.1) {
    for (const side of [1, -1]) {
      const s = sheerAt(h, z);
      posts.push(new THREE.Vector3(side * s.x, s.y + 0.65, z));
    }
  }
  const inst = new THREE.InstancedMesh(postGeo, mat, posts.length);
  const m = new THREE.Matrix4();
  posts.forEach((p, i) => inst.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
  inst.castShadow = true;
  group.add(inst);
  // Top rail: a tube along each side.
  for (const side of [1, -1]) {
    const pts = [];
    for (let z = -h.length / 2 + 0.4; z <= h.length / 2 - 1.2; z += 0.5) {
      const s = sheerAt(h, z);
      pts.push(new THREE.Vector3(side * s.x, s.y + 0.95, z));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.03, 6), mat);
    tube.castShadow = true;
    group.add(tube);
  }
}

function addDeckhouse(group, h) {
  const deckY = sheerAt(h, 1.5).y;
  const { house, height, length, eye } = buildDeckhouse();
  house.position.set(0, deckY, 1.2);
  const navy = std(WORLD.workboatNavy, 0.5);
  const mastMat = std(0xb7bcbf, 0.35, 0.6);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 8), mastMat);
  mast.position.set(0, height + 0.85, -0.8);
  house.add(mast);
  const radarBar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.18), navy);
  radarBar.position.set(0, height + 1.55, -0.8);
  radarBar.name = 'radar';
  house.add(radarBar);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std(0xf5f2e8, 0.3));
  light.position.set(0, height + 1.7, -0.8);
  house.add(light);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.22, 10), mastMat);
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0.6, height + 0.2, length / 2 - 0.1);
  house.add(lamp);
  const ringMat = std(WORLD.rescueOrange, 0.6);
  for (const side of [1, -1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 20), ringMat);
    ring.position.set(side * 1.5, 0.75, -0.9);
    ring.rotation.y = Math.PI / 2;
    ring.castShadow = true;
    house.add(ring);
  }
  group.add(house);
  const helm = eye.clone().add(house.position);
  const searchlight = new THREE.Vector3(0.6, height + 0.2, length / 2 - 0.1).add(house.position);
  return { deckY, helm, searchlight };
}

function addTowBitt(group, h) {
  const mat = std(0x2a2e31, 0.6, 0.5);
  const z = -h.length / 2 + 1.3;
  const y = sheerAt(h, z).y;
  for (const x of [-0.3, 0.3]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.6, 10), mat);
    post.position.set(x, y + 0.3, z);
    post.castShadow = true;
    group.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), mat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, y + 0.45, z);
  group.add(bar);
  return new THREE.Vector3(0, y + 0.45, z);
}

function addFenders(group, h) {
  const mat = std(0x1f2326, 0.8);
  const geo = new THREE.CapsuleGeometry(0.11, 0.45, 4, 8);
  for (const z of [-2.5, 0, 2.5]) {
    for (const side of [1, -1]) {
      const s = sheerAt(h, z);
      const f = new THREE.Mesh(geo, mat);
      f.position.set(side * (s.x + 0.1), s.y - 0.45, z);
      group.add(f);
    }
  }
}

function addRunningGear(group, cfg) {
  const bronze = std(0x8a6a3a, 0.35, 0.9);
  const prop = new THREE.Mesh(new THREE.CylinderGeometry(cfg.prop.diameter / 2, cfg.prop.diameter / 2, 0.08, 16), bronze);
  prop.rotation.x = Math.PI / 2;
  prop.position.fromArray(cfg.prop.pos);
  prop.name = 'propGeo';
  group.add(prop);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.6), std(WORLD.antifouling, 0.6));
  rudder.position.set(cfg.rudder.pos[0], cfg.rudder.pos[1], cfg.rudder.pos[2]);
  rudder.name = 'rudderGeo';
  group.add(rudder);
  return { prop, rudder };
}

function empty(name, pos) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.copy(pos);
  return o;
}

export function buildMarlinModel(cfg) {
  const h = cfg.hull;
  const group = new THREE.Group();
  group.name = 'marlin';
  const hullMat = addHullGrime(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.02 }), { deck: h.freeboard });
  const hull = new THREE.Mesh(hullGeometry(h), hullMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);
  const transomMat = addHullGrime(hullMat.clone(), { deck: h.freeboard });
  transomMat.side = THREE.DoubleSide;
  const transom = new THREE.Mesh(transomGeometry(h), transomMat);
  transom.castShadow = true;
  group.add(transom);
  const deck = new THREE.Mesh(deckGeometry(h), std(0x8a8f8c, 0.85));
  deck.receiveShadow = true;
  group.add(deck);
  const bulwarkMat = std(WORLD.hullWhite, 0.45);
  bulwarkMat.side = THREE.DoubleSide;
  const bulwark = new THREE.Mesh(bulwarkGeometry(h), bulwarkMat);
  bulwark.castShadow = true;
  bulwark.receiveShadow = true;
  group.add(bulwark);
  addRailing(group, h, std(0xc9ced1, 0.3, 0.7));
  const { helm, searchlight } = addDeckhouse(group, h);
  const towPoint = addTowBitt(group, h);
  addFenders(group, h);
  const gear = addRunningGear(group, cfg);
  for (const side of [1, -1]) {
    const num = createHullNumber('BW 12', side, h);
    group.add(num);
  }
  const bow = sheerAt(h, h.length / 2 - 0.6);
  group.add(empty('towPoint', towPoint));
  group.add(empty('bowCleat', new THREE.Vector3(0, bow.y + 0.1, h.length / 2 - 0.6)));
  group.add(empty('propeller', new THREE.Vector3().fromArray(cfg.prop.pos)));
  group.add(empty('rudder', new THREE.Vector3().fromArray(cfg.rudder.pos)));
  group.add(empty('searchlight', searchlight));
  group.add(empty('helmCamera', helm));
  group.userData.gear = gear;
  return group;
}
