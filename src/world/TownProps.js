// Town furnishings (V7): simple, convincing interiors per building kind,
// street lights, benches, parked cars and harbour clutter. Everything goes
// through a TownBuilder (merged per material).

import * as THREE from 'three';
import { KETTLE } from '../config/town.js';

const CAR_COLORS = [0x8a2a24, 0x2b3f55, 0xb9b6ad, 0x3d4a3a];

// Rows of little coloured boxes (bottles, tins, stock) on a shelf line.
function stock(b, a0, a1, o, y, rows, seed, colors) {
  let k = seed;
  for (let r = 0; r < rows; r++) {
    for (let a = a0; a < a1 - 0.15; a += 0.22) {
      const c = colors[k++ % colors.length];
      const h = 0.18 + ((k * 37) % 5) * 0.03;
      b.box('interior', a, a + 0.14, o - 0.08, o + 0.08, y + r * 0.45, y + r * 0.45 + h, c);
    }
  }
}

function table(b, a, o, y, r = 0.45) {
  b.add('furniture', new THREE.CylinderGeometry(r, r, 0.05, 16), a, o, y + 0.74);
  b.add('furniture', new THREE.CylinderGeometry(0.05, 0.08, 0.74, 8), a, o, y + 0.37);
}

function stool(b, a, o, y) {
  b.add('furniture', new THREE.CylinderGeometry(0.18, 0.18, 0.05, 10), a, o, y + 0.46);
  b.add('metal', new THREE.CylinderGeometry(0.03, 0.05, 0.46, 6), a, o, y + 0.23);
}

// Interior for an enterable building (bd from TownLayout.building).
export function furnish(b, bd) {
  const { a, o, w, d, y, side } = bd;
  const c = bd.counter;
  const in0 = a - w / 2 + 0.3;
  const in1 = a + w / 2 - 0.3;
  const backIn = bd.back + side * 0.3; // just inside the back wall
  const f = y + 0.15; // floor top
  // The counter itself (the layout's wall), with a pale top.
  b.box(bd.kind === 'market' ? 'metal' : 'furniture', c.a - c.w / 2, c.a + c.w / 2, c.o - side * 0.6, c.o, f, y + 1.0);
  b.box('trim', c.a - c.w / 2 - 0.05, c.a + c.w / 2 + 0.05, c.o - side * 0.65, c.o + side * 0.05, y + 1.0, y + 1.06);
  // Ceiling lamps.
  for (const la of [a - w / 4, a + w / 4]) {
    b.add('metal', new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), la, o, y + 2.88);
    b.add('bulb', new THREE.SphereGeometry(0.14, 10, 8), la, o, y + 2.66);
  }
  if (bd.kind === 'pub') {
    // Back bar: shelves of bottles, a mirror.
    b.box('furniture', c.a - c.w / 2, c.a + c.w / 2, backIn, backIn + side * 0.3, f, y + 2.4);
    stock(b, c.a - c.w / 2 + 0.1, c.a + c.w / 2, backIn + side * 0.35, y + 1.2, 3, 3, [0x2f4a2a, 0x6b3a1c, 0xa8a18a, 0x3a2418, 0x7a6a3a]);
    // Tables with stools across the room.
    for (let i = 0; i < 3; i++) {
      const ta = in0 + 1.4 + i * ((w - 3) / 2.2);
      const to = bd.front - side * 2.4;
      table(b, ta, to, f);
      for (const [da, dO] of [[0.8, 0], [-0.8, 0], [0, 0.8]]) {
        stool(b, ta + da, to + dO * -side, f);
      }
    }
    // Fireplace on the side wall with an ember glow.
    b.box('stoneWall', in0, in0 + 0.5, o - 1, o - 0.55, f, y + 1.6);
    b.box('stoneWall', in0, in0 + 0.5, o + 0.55, o + 1, f, y + 1.6);
    b.box('stoneWall', in0, in0 + 0.5, o - 1, o + 1, f + 0.8, y + 1.6);
    b.box('door', in0, in0 + 0.3, o - 0.55, o + 0.55, f, f + 0.8);
    b.add('bulb', new THREE.BoxGeometry(0.2, 0.18, 0.7), in0 + 0.3, o, f + 0.12);
    for (let s = 0; s < 4; s++) {
      stool(b, c.a - c.w / 2 + 0.5 + s * (c.w / 4), c.o + side * 0.5, f);
    }
  } else if (bd.kind === 'market') {
    // Fish on ice on the slab, crates stacked along the walls.
    b.box('interior', c.a - c.w / 2 + 0.1, c.a + c.w / 2 - 0.1, c.o - side * 0.55, c.o - side * 0.05, y + 1.0, y + 1.08, 0xe9eef0);
    for (let i = 0; i < 8; i++) {
      const fa = c.a - c.w / 2 + 0.4 + i * (c.w / 8.5);
      b.box('interior', fa, fa + 0.35, c.o - side * 0.4, c.o - side * 0.2, y + 1.08, y + 1.14, 0x8f9aa0);
    }
    for (let i = 0; i < 6; i++) {
      const ca = in0 + 0.5 + i * 0.75;
      for (let s = 0; s < 1 + (i % 3); s++) {
        b.box('interior', ca, ca + 0.65, bd.front - side * 1.2, bd.front - side * 0.8, f + s * 0.32, f + s * 0.32 + 0.3, s % 2 ? 0x2a5d7a : 0xc9c2ae);
      }
    }
    b.box('metal', in1 - 0.6, in1, o - 2, o + 2, f, y + 0.9);
  } else if (bd.kind === 'shop') {
    // Chandlery: shelves round the walls with rope, tins, lifebuoys.
    for (const wa of [in0, in1 - 0.4]) {
      b.box('furniture', wa, wa + 0.4, o - d / 2 + 1, o + d / 2 - 1.2, f, y + 2.2);
      for (let s = 0; s < 3; s++) {
        for (let k = 0; k < 5; k++) {
          const oo = o - d / 2 + 1.4 + k * ((d - 2.8) / 5);
          b.add('interior', new THREE.CylinderGeometry(0.16, 0.16, 0.14, 10), wa + 0.2, oo, f + 0.5 + s * 0.6, 0, [0xd8c7a0, 0x3a6a8a, 0xe0582a][(s + k) % 3]);
        }
      }
    }
    const ring = new THREE.TorusGeometry(0.32, 0.08, 8, 18);
    for (let k = 0; k < 3; k++) {
      b.add('interior', ring, c.a - 1 + k, backIn + side * 0.05, y + 2.1, 0, 0xe0582a);
    }
  } else if (bd.kind === 'office') {
    // Desk behind the counter, filing cabinets, a chart on the back wall.
    b.box('furniture', c.a - 1, c.a + 1, backIn + side * 0.5, backIn + side * 1.2, f, y + 0.76);
    b.box('interior', c.a - 0.6, c.a + 0.6, backIn + side * 0.02, backIn + side * 0.05, y + 1.2, y + 2.1, 0xede8dc);
    for (let k = 0; k < 3; k++) {
      b.box('metal', in1 - 0.55, in1, bd.back + side * (0.6 + k * 0.62), bd.back + side * (1.15 + k * 0.62), f, y + 1.35);
    }
    table(b, in0 + 1.2, bd.front - side * 1.6, f, 0.5);
    stool(b, in0 + 1.2 + 0.8, bd.front - side * 1.6, f);
    // A half model of a hull on the wall (the shipyard's pride).
    b.box('interior', in0 + 0.05, in0 + 0.1, o - 1.2, o + 1.2, y + 1.5, y + 1.8, 0x1c2a36);
  } else if (bd.kind === 'home') {
    // Bed, table and chairs, a sofa, the trophy shelf, a rug.
    b.box('interior', in0, in0 + 1.5, bd.back + side * 0.35, bd.back + side * 2.4, f, f + 0.5, 0x6e7f8a);
    b.box('interior', in0, in0 + 1.5, bd.back + side * 0.35, bd.back + side * 0.75, f, f + 0.95, 0x5a3d26);
    table(b, a - 0.5, bd.front - side * 2.2, f, 0.55);
    stool(b, a + 0.4, bd.front - side * 2.2, f);
    stool(b, a - 1.4, bd.front - side * 2.2, f);
    b.box('interior', in1 - 0.9, in1, o - 1.2, o + 1.2, f, f + 0.45, 0x7a3b2e);
    b.box('interior', in1 - 0.25, in1, o - 1.2, o + 1.2, f, f + 0.85, 0x7a3b2e);
    b.box('furniture', in1 - 0.35, in1, bd.back + side * 0.4, bd.back + side * 1.6, y + 1.5, y + 1.56);
    for (let k = 0; k < 3; k++) {
      b.add('metal', new THREE.CylinderGeometry(0.06, 0.09, 0.25, 8), in1 - 0.17, bd.back + side * (0.6 + k * 0.4), y + 1.69);
    }
    b.box('interior', a - 1.2, a + 1.2, o - 0.8, o + 0.8, f, f + 0.01, 0x8a5a44);
  } else if (bd.kind === 'kiosk') {
    b.add('metal', new THREE.BoxGeometry(0.4, 0.25, 0.3), c.a + 0.6, c.o - side * 0.3, y + 1.19);
    stock(b, a - w / 2 + 0.4, a + w / 2 - 0.4, backIn + side * 0.1, y + 1.2, 2, 5, [0xe0582a, 0x2b3f55, 0xd2a22a]);
  }
}

function lamp(b, towns, t, a, o, y, small) {
  const hgt = small ? 3.2 : 5.2;
  b.add('metal', new THREE.CylinderGeometry(0.06, 0.09, hgt, 8), a, o, y + hgt / 2);
  b.add('lampHead', new THREE.BoxGeometry(0.35, 0.22, 0.35), a, o, y + hgt);
  const p = t.frame.toWorld(a, o, {});
  towns.glows.push({ x: p.x, y: y + hgt - 0.2, z: p.z });
  towns.pools.push({ x: p.x, y, z: p.z, r: small ? 3.5 : 7 });
}

function car(b, a, o, y, turn, color) {
  b.add('carBody', new THREE.BoxGeometry(1.75, 0.7, 4.2), a, o, y + 0.62, turn, color);
  b.add('glass', new THREE.BoxGeometry(1.55, 0.55, 2.1), a, o, y + 1.24, turn);
  b.add('carBody', new THREE.BoxGeometry(1.5, 0.06, 1.9), a, o, y + 1.53, turn, color);
  const tyre = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 12);
  tyre.rotateZ(Math.PI / 2);
  const s = Math.sin(turn);
  const c = Math.cos(turn);
  for (const [dx, dz] of [[0.8, 1.35], [-0.8, 1.35], [0.8, -1.35], [-0.8, -1.35]]) {
    // Local (x, z) of the car -> frame (a, o): local +X is -a, +Z is +o.
    const da = -(dx * c + dz * s);
    const dO = -dx * s + dz * c;
    b.add('tyre', tyre, a + da, o + dO, y + 0.33, turn);
  }
}

export { car, CAR_COLORS };

// Lamps, benches, parked cars and clutter for a town.
export function streetFurniture(b, t, towns) {
  const y = 2.0;
  for (const l of t.lights) {
    const s = t.slabs.find((q) => q.name === 'pier');
    lamp(b, towns, t, l.a, l.o, l.small ? s.top : y, l.small);
  }
  for (const p of t.parked) {
    car(b, p.a, p.o, y, p.yaw, CAR_COLORS[p.variant % CAR_COLORS.length]);
  }
  if (t.kind !== 'kettle') {
    return;
  }
  const K = KETTLE;
  // Benches on the quay, facing the water.
  for (const a of [-95, -58, -2, 58]) {
    b.box('furniture', a - 0.9, a + 0.9, K.quay.o1 - 3.2, K.quay.o1 - 2.8, y + 0.42, y + 0.48);
    b.box('furniture', a - 0.9, a + 0.9, K.quay.o1 - 3.3, K.quay.o1 - 3.22, y + 0.48, y + 0.9);
    b.box('metal', a - 0.8, a - 0.7, K.quay.o1 - 3.2, K.quay.o1 - 2.8, y, y + 0.42);
    b.box('metal', a + 0.7, a + 0.8, K.quay.o1 - 3.2, K.quay.o1 - 2.8, y, y + 0.42);
  }
  // Fish boxes and lobster pots on the quay by the market.
  for (let i = 0; i < 9; i++) {
    const a = -52 + (i % 3) * 0.8 + Math.floor(i / 3) * 3;
    b.box('interior', a, a + 0.7, K.quay.o0 + 1, K.quay.o0 + 1.5, y, y + 0.3 * (1 + (i % 2)), i % 2 ? 0x2a5d7a : 0xc9c2ae);
  }
  for (let i = 0; i < 6; i++) {
    b.add('interior', new THREE.CylinderGeometry(0.4, 0.45, 0.45, 8), -30 + i * 1.1, K.quay.o0 + 1.4, y + 0.22, 0, 0x4a3a2a);
  }
  // Flagpole at the harbormaster's.
  const hm = K.buildings[0];
  b.add('trim', new THREE.CylinderGeometry(0.05, 0.07, 9, 8), hm.a + hm.w / 2 + 1.5, hm.o + hm.d / 2 + 1, y + 4.5);
  b.box('interior', hm.a + hm.w / 2 + 1.55, hm.a + hm.w / 2 + 3.1, hm.o + hm.d / 2 + 0.98, hm.o + hm.d / 2 + 1.02, y + 7.9, y + 8.9, 0x1c2a36);
}
