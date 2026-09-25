// Fit-out detail for the procedural Marlin: rub rails, scuppers, navigation
// lights, liferaft canister, antennas, exhaust stack, bow roller + anchor,
// bow cleats, windscreen wipers. Pure decoration (no physics).

import * as THREE from 'three';
import { hullStation, sectionPoint } from '../../physics/HullShape.js';
import { gelcoat, stainless, rubber, paint } from './materials.js';

function sheer(h, z) {
  const st = hullStation(h, Math.min(1, Math.max(0, z / h.length + 0.5)));
  return { x: sectionPoint(st, 1).x, y: st.deck };
}

function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function rod(a, b, r, mat, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
}

function cleat(mat) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.08, 8), mat, 0, 0.04, 0));
  const horn = mesh(new THREE.CapsuleGeometry(0.025, 0.24, 4, 8), mat, 0, 0.09, 0);
  horn.rotation.x = Math.PI / 2;
  g.add(horn);
  return g;
}

// house: { deckY, height, length, width, z } of the wheelhouse.
export function addMarlinDetails(group, h, house) {
  const steel = stainless();
  const black = rubber();
  // Rub rails: a heavy rubber D-section just under the sheer, both sides.
  for (const side of [1, -1]) {
    const pts = [];
    for (let z = -h.length / 2 + 0.05; z <= h.length / 2 - 0.25; z += 0.25) {
      const s = sheer(h, z);
      pts.push(new THREE.Vector3(side * (s.x + 0.035), s.y - 0.06, z));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.055, 8), black);
    tube.castShadow = true;
    group.add(tube);
    // Scuppers (freeing ports) at the base of the bulwark.
    for (let z = -h.length / 2 + 1.2; z < h.length / 2 - 2.5; z += 1.6) {
      const s = sheer(h, z);
      group.add(mesh(new THREE.BoxGeometry(0.02, 0.09, 0.32), paint(0x14191c, 0.9), side * (s.x + 0.006), s.y + 0.07, z));
    }
  }
  // Transom rub strip.
  const tz = -h.length / 2 - 0.02;
  const ts = sheer(h, -h.length / 2);
  group.add(rod(new THREE.Vector3(-ts.x, ts.y - 0.06, tz), new THREE.Vector3(ts.x, ts.y - 0.06, tz), 0.05, black));

  // Bow: roller, anchor, cleats.
  const bz = h.length / 2 - 0.15;
  const bs = sheer(h, bz);
  const roller = mesh(new THREE.BoxGeometry(0.22, 0.12, 0.9), steel, 0, bs.y + 0.08, bz + 0.05);
  group.add(roller);
  const anchor = new THREE.Group();
  anchor.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.75), paint(0x3a3f42, 0.45, 0.8), 0, 0, 0));
  const fluke = mesh(new THREE.BoxGeometry(0.42, 0.04, 0.26), paint(0x3a3f42, 0.45, 0.8), 0, -0.02, 0.36);
  fluke.rotation.x = 0.5;
  anchor.add(fluke);
  anchor.position.set(0, bs.y + 0.17, bz + 0.25);
  anchor.rotation.x = -0.25;
  group.add(anchor);
  for (const side of [1, -1]) {
    const s = sheer(h, h.length / 2 - 1.4);
    const c = cleat(steel);
    c.position.set(side * (s.x - 0.25), s.y - 0.02, h.length / 2 - 1.4);
    group.add(c);
    const a = sheer(h, -h.length / 2 + 0.5);
    const c2 = cleat(steel);
    c2.position.set(side * (a.x - 0.22), a.y - 0.02, -h.length / 2 + 0.5);
    group.add(c2);
  }

  // Wheelhouse fit-out.
  const top = house.deckY + house.height + 0.1;
  const zc = house.z;
  // Liferaft canister in its cradle on the roof.
  const can = mesh(new THREE.CapsuleGeometry(0.27, 0.55, 6, 16), gelcoat(0xf1f0ea, 0.4), 0, top + 0.34, zc - 1.0);
  can.rotation.z = Math.PI / 2;
  group.add(can);
  for (const x of [-0.25, 0.25]) {
    const strap = mesh(new THREE.TorusGeometry(0.28, 0.018, 6, 20), paint(0x1f2a33, 0.6), x, top + 0.34, zc - 1.0);
    strap.rotation.y = Math.PI / 2;
    group.add(strap);
    group.add(mesh(new THREE.BoxGeometry(0.06, 0.1, 0.5), steel, x, top + 0.05, zc - 1.0));
  }
  // Whip antennas.
  for (const x of [-1.25, 1.25]) {
    group.add(rod(new THREE.Vector3(x, top, zc - 1.6), new THREE.Vector3(x * 1.02, top + 2.4, zc - 1.75), 0.012, paint(0xeeeeea, 0.4)));
    group.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), black, x, top + 0.06, zc - 1.6));
  }
  // Navigation sidelights (port red, +X; starboard green).
  const lamp = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: 0.3 });
  for (const [side, color] of [
    [1, 0xd8322a],
    [-1, 0x2fbf5a],
  ]) {
    const x = side * (house.width / 2 + 0.06);
    group.add(mesh(new THREE.BoxGeometry(0.1, 0.16, 0.24), paint(0x151a1d, 0.5), x, top - 0.45, zc + house.length / 2 - 0.3));
    group.add(mesh(new THREE.BoxGeometry(0.02, 0.1, 0.16), lamp(color), x + side * 0.05, top - 0.45, zc + house.length / 2 - 0.3));
  }
  // Exhaust stack aft of the wheelhouse, starboard side.
  const ex = new THREE.Vector3(-1.05, house.deckY, zc - house.length / 2 - 0.25);
  group.add(rod(ex, ex.clone().setY(top + 0.7), 0.075, paint(0x1c1f21, 0.55, 0.4), 12));
  group.add(mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 12), paint(0x6b3b22, 0.8), ex.x, top + 0.66, ex.z));
  // Windscreen wipers.
  const wz = zc + house.length / 2 + 0.035;
  for (const x of [-0.85, 0, 0.85]) {
    const arm = rod(new THREE.Vector3(x - 0.05, house.deckY + 1.16, wz), new THREE.Vector3(x + 0.18, house.deckY + 1.66, wz), 0.01, black);
    group.add(arm);
  }
}
