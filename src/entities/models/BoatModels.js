// Procedural Kestrel (7.5 m rescue RIB) and Bulwark (22 m salvage tug),
// built on the same HullShape as their physics, with the Marlin's named
// empties (spec 2.6): towPoint, bowCleat, propeller, rudder, searchlight,
// helmCamera.

import * as THREE from 'three';
import { hullStation, sectionPoint } from '../../physics/HullShape.js';
import { WORLD } from '../../config/palette.js';
import { createHullNumber } from './decals.js';
import { buildDeckhouse } from './Deckhouse.js';
import { hullMaterial } from './hullGrime.js';
import { gelcoat, stainless, rubber, nonSkidDeck, planarUV } from './materials.js';
import { std, hullGeometry, transomGeometry, deckGeometry, bulwarkGeometry, sheerAt, addRunningGear, empty } from './MarlinModel.js';

function shell(group, h, paint, deckColor) {
  const hull = new THREE.Mesh(hullGeometry(h), hullMaterial(h, paint));
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);
  const tm = hullMaterial(h, paint);
  tm.side = THREE.DoubleSide;
  group.add(new THREE.Mesh(transomGeometry(h), tm));
  const deck = new THREE.Mesh(planarUV(deckGeometry(h)), nonSkidDeck(deckColor));
  deck.receiveShadow = true;
  group.add(deck);
}

function finish(group, cfg, points) {
  const h = cfg.hull;
  const gear = addRunningGear(group, cfg);
  const bow = sheerAt(h, h.length / 2 - 0.5);
  group.add(empty('towPoint', points.tow));
  group.add(empty('bowCleat', new THREE.Vector3(0, bow.y + 0.1, h.length / 2 - 0.5)));
  group.add(empty('propeller', new THREE.Vector3().fromArray(cfg.prop.pos)));
  group.add(empty('rudder', new THREE.Vector3().fromArray(cfg.rudder.pos)));
  group.add(empty('searchlight', points.searchlight));
  group.add(empty('helmCamera', points.helm));
  group.userData.gear = gear;
  return group;
}

// Inflatable collar: a fat tube following the sheer, closed round the bow,
// open at the transom.
function collar(h, radius) {
  const pts = [];
  const n = 40;
  for (const side of [1, -1]) {
    const run = [];
    for (let i = 0; i <= n; i++) {
      const s = 0.02 + (i / n) * 0.95;
      const st = hullStation(h, s);
      const p = sectionPoint(st, 1);
      run.push(new THREE.Vector3(side * (p.x + radius * 0.35), st.deck + radius * 0.2, st.z));
    }
    if (side === 1) {
      pts.push(...run);
    } else {
      pts.push(...run.reverse());
    }
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, radius, 12);
  const m = new THREE.Mesh(geo, rubber(0x3b4146));
  m.castShadow = true;
  return m;
}

export function buildKestrelModel(cfg) {
  const h = cfg.hull;
  const group = new THREE.Group();
  group.name = 'kestrel';
  shell(group, h, { bottom: 0x2b2f33, boot: WORLD.rescueOrange, top: 0x2b2f33, sheer: 0x2b2f33, bootY: [0.02, 0.12], stripe: 0.06 }, 0x7d8286);
  group.add(collar(h, 0.26));
  const deckY = sheerAt(h, 0).y;
  // Centre console with a small screen, and a jockey seat behind it.
  const orange = gelcoat(WORLD.rescueOrange);
  const console = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.95, 0.7), gelcoat(WORLD.hullWhite));
  console.position.set(0, deckY + 0.47, 0.3);
  console.castShadow = true;
  group.add(console);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.4, 0.03), new THREE.MeshPhysicalMaterial({ color: 0x1a2630, roughness: 0.05, transmission: 0.2, transparent: true, opacity: 0.6 }));
  screen.position.set(0, deckY + 1.13, 0.52);
  screen.rotation.x = -0.35;
  group.add(screen);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.55), orange);
  seat.position.set(0, deckY + 0.35, -0.55);
  seat.castShadow = true;
  group.add(seat);
  // A-frame over the stern with a light and antennas.
  const steel = stainless();
  const frameZ = -h.length / 2 + 0.9;
  for (const side of [1, -1]) {
    const s = sheerAt(h, frameZ);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), steel);
    leg.position.set(side * (s.x - 0.25), s.y + 0.72, frameZ);
    leg.rotation.z = side * 0.18;
    group.add(leg);
  }
  const top = sheerAt(h, frameZ);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, top.x * 2 - 0.9, 8), steel);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, top.y + 1.45, frameZ);
  group.add(bar);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), orange);
  beacon.position.set(0, top.y + 1.53, frameZ);
  group.add(beacon);
  // Outboard on the transom.
  const t = hullStation(h, 0);
  const motor = new THREE.Group();
  const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.6), gelcoat(0x1c1f22, 0.3));
  cowl.position.set(0, t.deck + 0.2, t.z - 0.35);
  cowl.castShadow = true;
  motor.add(cowl);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.22), std(0x1c1f22, 0.4));
  leg.position.set(0, t.deck - 0.45, t.z - 0.3);
  motor.add(leg);
  group.add(motor);
  for (const side of [1, -1]) {
    group.add(createHullNumber('KESTREL', side, h));
  }
  return finish(group, cfg, {
    tow: new THREE.Vector3(0, top.y + 0.3, frameZ + 0.1),
    searchlight: new THREE.Vector3(0, deckY + 1.3, 0.55),
    helm: new THREE.Vector3(0, deckY + 1.55, -0.4),
  });
}

export function buildBulwarkModel(cfg) {
  const h = cfg.hull;
  const group = new THREE.Group();
  group.name = 'bulwark';
  shell(group, h, { bottom: WORLD.antifouling, boot: 0x1b1e20, top: 0x1b1e20, sheer: 0xf2f2ee, bootY: [0.05, 0.3], stripe: 0.2 }, 0x6f5a4a);
  const bm = gelcoat(0x1b1e20, 0.5);
  bm.side = THREE.DoubleSide;
  const bulwark = new THREE.Mesh(bulwarkGeometry(h, 0.9), bm);
  bulwark.castShadow = true;
  group.add(bulwark);
  // Superstructure: the Marlin's wheelhouse scaled up, on a deckhouse block.
  const deckY = sheerAt(h, 3).y;
  const block = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.2, 7.5), gelcoat(WORLD.hullWhite));
  block.position.set(0, deckY + 1.1, 3.2);
  block.castShadow = true;
  block.receiveShadow = true;
  group.add(block);
  const { house, height, length } = buildDeckhouse();
  const k = 1.5;
  house.scale.setScalar(k);
  house.position.set(0, deckY + 2.2, 3.8);
  group.add(house);
  const topY = deckY + 2.2 + height * k;
  // Funnel and mast.
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 2.2, 14), std(0xb03a2e, 0.5));
  funnel.position.set(0, deckY + 3.2, -0.2);
  funnel.castShadow = true;
  group.add(funnel);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.5, 14), std(0x1b1e20, 0.5));
  band.position.set(0, deckY + 4.1, -0.2);
  group.add(band);
  const mastMat = std(0xb7bcbf, 0.35, 0.6);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8), mastMat);
  mast.position.set(0, topY + 1.6, 3.4);
  group.add(mast);
  const radar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.25), std(WORLD.workboatNavy, 0.5));
  radar.position.set(0, topY + 2.9, 3.4);
  radar.name = 'radar';
  group.add(radar);
  // H-bitt aft.
  const iron = std(0x2a2e31, 0.6, 0.5);
  const bz = -h.length / 2 + 4.5;
  const by = sheerAt(h, bz).y;
  for (const x of [-0.9, 0.9]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.3, 12), iron);
    post.position.set(x, by + 0.65, bz);
    post.castShadow = true;
    group.add(post);
  }
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 10), iron);
  cross.rotation.z = Math.PI / 2;
  cross.position.set(0, by + 1.0, bz);
  group.add(cross);
  // Tyre fenders hung along the sides.
  const tyre = new THREE.TorusGeometry(0.42, 0.17, 8, 16);
  const tyreMat = rubber();
  for (let z = -h.length / 2 + 2; z < h.length / 2 - 3; z += 2.6) {
    for (const side of [1, -1]) {
      const s = sheerAt(h, z);
      const t = new THREE.Mesh(tyre, tyreMat);
      t.position.set(side * (s.x + 0.2), s.y - 0.5, z);
      t.rotation.y = Math.PI / 2;
      group.add(t);
    }
  }
  for (const side of [1, -1]) {
    group.add(createHullNumber('BULWARK', side, h));
  }
  return finish(group, cfg, {
    tow: new THREE.Vector3(0, by + 1.0, bz),
    searchlight: new THREE.Vector3(1.2, topY + 0.2, 3.8 + (length * k) / 2),
    helm: new THREE.Vector3(-0.8, deckY + 2.2 + 1.58 * k, 3.8 + (length / 2 - 1.2) * k),
  });
}
