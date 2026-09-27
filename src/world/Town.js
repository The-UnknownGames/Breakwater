// The towns ashore (V7), rendered from TownLayout: paved street, gravel
// yards, the coastal road, buildings with windows (lit at night), open
// doors and simple interiors, signs, street lights with pools of light,
// parked cars. Everything static is merged per material.

import * as THREE from 'three';
import { TownBuilder, townMaterials, roofGeometry } from './TownBuilder.js';
import { furnish, streetFurniture } from './TownProps.js';
import { KETTLE, TOWN_Y } from '../config/town.js';

const INTERIOR_H = 3.0;
// Inside wall colour by building kind.
const LINING = { pub: 0x6b3a2a, office: 0xe4ddcc, market: 0xc9d0d0, shop: 0xcdbd9a, home: 0xe8dcc0, kiosk: 0xd9d6cc };

function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// All building names on one canvas, one row each (sign boards).
function signAtlas(names) {
  const rowH = 64;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = rowH * Math.max(1, names.length);
  const g = c.getContext('2d');
  names.forEach((n, i) => {
    g.fillStyle = '#1c2a36';
    g.fillRect(0, i * rowH, 512, rowH);
    g.strokeStyle = '#b08d57';
    g.lineWidth = 4;
    g.strokeRect(4, i * rowH + 4, 504, rowH - 8);
    g.fillStyle = '#ede8dc';
    g.font = '600 34px "IBM Plex Sans Condensed", Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(n.toUpperCase(), 256, i * rowH + rowH / 2 + 2, 480);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, rows: names.length };
}

// Seeded 0..1 per integer.
function rnd(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class Towns {
  constructor(scene, towns) {
    this.group = new THREE.Group();
    this.group.name = 'towns';
    this.mats = townMaterials();
    this.glows = [];
    this.pools = [];
    this.parts = new Map();
    this.signs = [];
    for (const t of towns) {
      this.town(t);
    }
    new TownBuilder(null, this.parts).build(this.group, this.mats);
    this.signMesh(this.signs);
    this.lightsMesh();
    scene.add(this.group);
  }

  town(t) {
    const b = new TownBuilder(t.frame, this.parts);
    const y = TOWN_Y;
    if (t.kind === 'kettle') {
      const K = KETTLE;
      const s = K.street;
      b.box('cobble', s.a0, s.a1, s.o0 + 2.2, s.o1 - 2.2, y - 0.2, y + 0.005);
      b.box('pavement', s.a0, s.a1, s.o0, s.o0 + 2.2, y - 0.2, y + 0.06);
      b.box('pavement', s.a0, s.a1, s.o1 - 2.2, s.o1, y - 0.2, y + 0.06);
      b.box('gravel', K.lane.a0, K.lane.a1, K.lane.o0, s.o0, y - 0.2, y + 0.002);
      const r = K.road;
      b.box('tarmac', r.a0, r.a1, r.o0, r.o1, y - 0.3, y - 0.02);
      b.box('gravel', r.a0, r.a1, r.o1, K.lane.o0, y - 0.3, y - 0.01);
      // Dry-stone wall along the back of the yards.
      b.box('stoneWall', K.lane.a0, K.lane.a1, K.lane.o0 - 0.5, K.lane.o0, y, y + 0.9);
      // Steps up to the breakwater.
      for (const sl of t.slabs.filter((q) => q.name === 'steps')) {
        b.box('pavement', sl.ca - sl.hw, sl.ca + sl.hw, sl.co - sl.hl, sl.co + sl.hl, y - 0.3, sl.top);
      }
      // Quay bollards (the pier's are part of the harbor).
      const bol = new THREE.CylinderGeometry(0.17, 0.21, 0.55, 10);
      for (const q of t.bollards) {
        if (q.y === K.quay.top) {
          b.add('metal', bol, q.a, q.o, q.y + 0.27);
        }
      }
    } else {
      const sl = t.slabs.find((q) => q.name === 'yard');
      b.box('gravel', sl.ca - sl.hw, sl.ca + sl.hw, sl.co - sl.hl, sl.co + sl.hl, y - 0.3, y + 0.002);
      b.box('stoneWall', sl.ca - sl.hw, sl.ca + sl.hw, sl.co - sl.hl - 0.5, sl.co - sl.hl, y, y + 0.9);
    }
    for (const bd of t.buildings) {
      this.building(b, bd, this.signs, t);
    }
    streetFurniture(b, t, this);
  }

  building(b, bd, signs, t) {
    const { a, o, w, d, h, y } = bd;
    const sd = bd.side;
    if (bd.enter) {
      // Walls as laid out (door gap in front), then a ceiling and an upper
      // storey block on top.
      const wall = 0.25;
      b.box('wall', a - w / 2, a - w / 2 + wall, o - d / 2, o + d / 2, y - 0.3, y + INTERIOR_H, bd.wall);
      b.box('wall', a + w / 2 - wall, a + w / 2, o - d / 2, o + d / 2, y - 0.3, y + INTERIOR_H, bd.wall);
      b.box('wall', a - w / 2, a + w / 2, bd.back - wall / 2, bd.back + wall / 2, y - 0.3, y + INTERIOR_H, bd.wall);
      const dr = bd.door;
      b.box('wall', a - w / 2, dr.a - dr.w / 2, bd.front - wall / 2, bd.front + wall / 2, y - 0.3, y + INTERIOR_H, bd.wall);
      b.box('wall', dr.a + dr.w / 2, a + w / 2, bd.front - wall / 2, bd.front + wall / 2, y - 0.3, y + INTERIOR_H, bd.wall);
      b.box('wall', dr.a - dr.w / 2, dr.a + dr.w / 2, bd.front - wall / 2, bd.front + wall / 2, y + dr.h, y + INTERIOR_H, bd.wall);
      if (h > INTERIOR_H + 0.3) {
        b.box('wall', a - w / 2, a + w / 2, o - d / 2, o + d / 2, y + INTERIOR_H, y + h, bd.wall);
      }
      b.box('interior', a - w / 2 + wall, a + w / 2 - wall, o - d / 2 + wall, o + d / 2 - wall, y + INTERIOR_H - 0.12, y + INTERIOR_H, 0xe7e1d2);
      // Inside lining (panelling, plaster) so the walls take the lamp light.
      const lin = LINING[bd.kind] || 0xd9d2c0;
      const e = 0.03;
      const i0 = a - w / 2 + wall;
      const i1 = a + w / 2 - wall;
      const j0 = o - d / 2 + wall;
      const j1 = o + d / 2 - wall;
      b.box('interior', i0, i0 + e, j0, j1, y + 0.15, y + INTERIOR_H - 0.12, lin);
      b.box('interior', i1 - e, i1, j0, j1, y + 0.15, y + INTERIOR_H - 0.12, lin);
      const bk = sd > 0 ? j0 : j1;
      b.box('interior', i0, i1, bk - e / 2, bk + e / 2, y + 0.15, y + INTERIOR_H - 0.12, lin);
      const fr = sd > 0 ? j1 : j0;
      b.box('interior', i0, dr.a - dr.w / 2, fr - e / 2, fr + e / 2, y + 0.15, y + INTERIOR_H - 0.12, lin);
      b.box('interior', dr.a + dr.w / 2, i1, fr - e / 2, fr + e / 2, y + 0.15, y + INTERIOR_H - 0.12, lin);
      b.box('interior', dr.a - dr.w / 2, dr.a + dr.w / 2, fr - e / 2, fr + e / 2, y + dr.h, y + INTERIOR_H - 0.12, lin);
      b.box(bd.kind === 'market' || bd.kind === 'kiosk' ? 'floorStone' : 'floorWood', a - w / 2 + wall, a + w / 2 - wall, o - d / 2 + wall, o + d / 2 - wall, y - 0.1, y + 0.15);
      b.box('floorStone', dr.a - dr.w / 2, dr.a + dr.w / 2, bd.front - 0.3, bd.front + 0.3, y - 0.1, y + 0.15);
      // Door frame and the door leaf standing open, inside.
      b.box('trim', dr.a - dr.w / 2 - 0.1, dr.a - dr.w / 2, bd.front - 0.18, bd.front + 0.18, y, y + dr.h + 0.1);
      b.box('trim', dr.a + dr.w / 2, dr.a + dr.w / 2 + 0.1, bd.front - 0.18, bd.front + 0.18, y, y + dr.h + 0.1);
      b.box('trim', dr.a - dr.w / 2 - 0.1, dr.a + dr.w / 2 + 0.1, bd.front - 0.18, bd.front + 0.18, y + dr.h, y + dr.h + 0.12);
      b.box('door', dr.a - dr.w / 2, dr.a - dr.w / 2 + 0.06, bd.front - sd * (dr.w - 0.1), bd.front - sd * 0.15, y + 0.15, y + dr.h - 0.05);
      furnish(b, bd);
      if (bd.name) {
        signs.push({ bd, frame: t.frame });
      }
    } else {
      b.box('wall', a - w / 2, a + w / 2, o - d / 2, o + d / 2, y - 0.3, y + h, bd.wall);
      // A closed front door.
      b.box('door', a - 0.55, a + 0.55, bd.front - 0.02, bd.front + sd * 0.06, y, y + 2.2);
    }
    this.windows(b, bd);
    if (bd.roof === 'flat' || !bd.roof) {
      b.box('metalRoof', a - w / 2 - 0.2, a + w / 2 + 0.2, o - d / 2 - 0.2, o + d / 2 + 0.2, y + h, y + h + 0.2);
    } else {
      b.add(bd.roof === 'metal' ? 'metalRoof' : 'slate', roofGeometry(w, d, Math.min(3.2, d * 0.32)), a, o, y + h);
      // Chimney.
      if (bd.roof === 'slate') {
        b.box('stoneWall', a + w * 0.3, a + w * 0.3 + 0.7, o - 0.4, o + 0.4, y + h, y + h + d * 0.32 + 0.9);
      }
    }
  }

  // Windows on the front and back (and the ends of big buildings), two
  // storeys. Lit ones glow at night; the rest are dark glass.
  windows(b, bd) {
    const { a, o, w, d, h, y } = bd;
    const floors = h > 5.2 ? [y + 1.2, y + 4.1] : [y + 1.2];
    let n = Math.round(a * 13 + o * 7);
    for (const face of [bd.front, bd.back]) {
      const out = Math.sign(face - o);
      for (const fy of floors) {
        for (let wa = a - w / 2 + 1.5; wa <= a + w / 2 - 1.4; wa += 2.4) {
          if (bd.door && face === bd.front && fy < y + 3 && Math.abs(wa - bd.door.a) < 1.6) {
            continue;
          }
          if (!bd.enter && face === bd.front && fy < y + 3 && Math.abs(wa - a) < 1.2) {
            continue;
          }
          const lit = rnd(n++) < (bd.enter ? 0.9 : 0.55);
          b.box(lit ? 'windowLit' : 'glass', wa - 0.55, wa + 0.55, face + out * 0.02, face + out * 0.08, fy, fy + 1.35);
          b.box('trim', wa - 0.65, wa + 0.65, face + out * 0.02, face + out * 0.12, fy - 0.12, fy);
        }
      }
    }
  }

  // Sign boards over the doors, textured from one atlas.
  signMesh(list) {
    const atlas = signAtlas(list.map((s) => s.bd.name));
    const geos = list.map(({ bd, frame: f }, i) => {
      const width = Math.min(bd.w - 1, Math.max(2.4, bd.name.length * 0.28));
      const g = new THREE.PlaneGeometry(width, width / 8);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) {
        const v = uv.getY(k);
        uv.setY(k, 1 - (i + 1 - v) / atlas.rows);
      }
      const p = f.toWorld(bd.door.a, bd.front + bd.side * 0.14, {});
      g.rotateY(f.yaw + (bd.side < 0 ? Math.PI : 0));
      g.translate(p.x, bd.y + bd.door.h + 0.55, p.z);
      return g;
    });
    const mat = new THREE.MeshStandardMaterial({ map: atlas.tex, roughness: 0.6 });
    const mesh = new THREE.Mesh(mergeUV(geos), mat);
    mesh.name = 'town-signs';
    this.group.add(mesh);
  }

  // Street lamp glows and pools of light (one draw call each).
  lightsMesh() {
    const n = this.glows.length;
    const pos = new Float32Array(n * 3);
    this.glows.forEach((p, i) => pos.set([p.x, p.y, p.z], i * 3));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.glowMat = new THREE.PointsMaterial({ map: radialTexture('rgba(255,214,150,1)', 'rgba(255,190,110,0)'), size: 2.6, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
    this.glowPoints = new THREE.Points(g, this.glowMat);
    this.glowPoints.frustumCulled = false;
    this.group.add(this.glowPoints);
    const quads = this.pools.map((p) => {
      const q = new THREE.PlaneGeometry(p.r * 2, p.r * 2);
      q.rotateX(-Math.PI / 2);
      q.translate(p.x, p.y + 0.03, p.z);
      return q;
    });
    if (quads.length) {
      this.poolMat = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,200,130,0.55)', 'rgba(255,190,110,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
      const mesh = new THREE.Mesh(mergeUV(quads), this.poolMat);
      mesh.name = 'town-light-pools';
      this.group.add(mesh);
    }
  }

  // night: 0 (day) .. 1 (full night); dusk lights the windows first.
  update(night) {
    const m = this.mats;
    const on = Math.min(1, night * 1.6);
    m.windowLit.emissiveIntensity = on * 0.85;
    m.bulb.emissiveIntensity = 0.8 + on * 1.6;
    m.lampHead.emissiveIntensity = on * 3;
    // Lamp light on the interiors after dark (they have no real lamps).
    m.interior.emissive.setRGB(0.16, 0.11, 0.07).multiplyScalar(on);
    m.floorWood.emissive.setRGB(0.09, 0.06, 0.035).multiplyScalar(on);
    m.furniture.emissive.setRGB(0.08, 0.05, 0.03).multiplyScalar(on);
    this.glowMat.opacity = on * 0.9;
    if (this.poolMat) {
      this.poolMat.opacity = on * 0.5;
    }
  }
}

// Merge geometries that all carry position, normal and uv.
function mergeUV(list) {
  const out = new THREE.BufferGeometry();
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const name of ['position', 'normal', 'uv']) {
    const size = parts[0].attributes[name].itemSize;
    const total = parts.reduce((s, g) => s + g.attributes[name].count, 0);
    const arr = new Float32Array(total * size);
    let off = 0;
    for (const g of parts) {
      arr.set(g.attributes[name].array, off);
      off += g.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
