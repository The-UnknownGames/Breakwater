// Port structures (spec 6, 2.6): Kettle Harbor's rock breakwater with a
// concrete cap, pier on piles with bollards, fuel dock, crane and harbour
// houses; small stations get a pier and fuel pump. Static colliders for the
// solid parts. Built from the port frames in WorldShape.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm } from './WorldShape.js';

const std = (color, rough = 0.8, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

const MAT = {
  rock: std(0x5d6062, 0.95),
  concrete: std(0x8d8c86, 0.9),
  timber: std(0x5a4636, 0.85),
  pile: std(0x2f2a24, 0.9),
  steel: std(0x3a3f43, 0.5, 0.6),
  yellow: std(0xd2a22a, 0.6),
  white: std(0xd9d6cc, 0.8),
  roof: std(0x6e2f26, 0.8),
  roofGrey: std(0x3d4348, 0.8),
  fuel: std(0xb8352a, 0.5),
};

function at(p, a, o) {
  // Harbor frame: a along the shore, o out to sea (from the port centre).
  return { x: p.center.x + p.along.x * a + p.out.x * o, z: p.center.z + p.along.z * a + p.out.z * o };
}

function yawOf(v) {
  return Math.atan2(v.x, v.z);
}

export class Harbors {
  constructor(scene, shape, physics = null) {
    this.group = new THREE.Group();
    this.group.name = 'harbors';
    this.shape = shape;
    this.physics = physics;
    this.rocks = [];
    this.lights = [];
    for (const p of shape.ports) {
      if (p.harbor) {
        this.harbor(p);
      } else {
        this.station(p);
      }
    }
    this.rockMesh();
    this.merge();
    scene.add(this.group);
  }

  // One mesh per material for all the static pieces (draw calls).
  merge() {
    const byMat = new Map();
    const keep = [];
    this.group.updateMatrixWorld(true);
    for (const m of this.group.children) {
      if (!m.isMesh || m.isInstancedMesh || !m.visible) {
        keep.push(m);
        continue;
      }
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const list = byMat.get(m.material) || [];
      list.push(g.index ? g.toNonIndexed() : g);
      byMat.set(m.material, list);
    }
    this.group.clear();
    for (const m of keep) {
      if (m.visible) {
        this.group.add(m);
      }
    }
    for (const [mat, list] of byMat) {
      const merged = new THREE.Mesh(mergeGeometries(list.map((g) => { g.deleteAttribute('uv'); return g; })), mat);
      merged.castShadow = true;
      merged.receiveShadow = true;
      this.group.add(merged);
    }
  }

  box(w, h, l, mat, x, y, z, yaw = 0, collide = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    if (collide && this.physics) {
      const R = this.physics.R;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      this.physics.world.createCollider(
        R.ColliderDesc.cuboid(w / 2, h / 2, l / 2).setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setFriction(0.5),
      );
    }
    return m;
  }

  // Rubble-mound breakwater along a polyline of harbor-frame points.
  mole(p, pts) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = at(p, pts[i][0], pts[i][1]);
      const b = at(p, pts[i + 1][0], pts[i + 1][1]);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      this.box(5, 1.2, len + 5, MAT.concrete, mx, 2.2, mz, yaw);
      this.box(12, 6, len, MAT.rock, mx, -1.5, mz, yaw, true).visible = false;
      for (let t = 0; t < len; t += 2.6) {
        const k = t / len;
        const x = a.x + (b.x - a.x) * k;
        const z = a.z + (b.z - a.z) * k;
        for (const side of [-1, 1]) {
          for (const off of [3.5, 5.8]) {
            const nx = Math.cos(yaw) * side * off;
            const nz = -Math.sin(yaw) * side * off;
            const n = fbm(x / 3 + side, z / 3 + off, 55);
            this.rocks.push({ x: x + nx, y: 1.4 - (off - 3.5) * 0.7 + n * 0.8, z: z + nz, s: 1.3 + n * 1.2, r: n * 12 });
          }
        }
      }
    }
    const end = pts[pts.length - 1];
    return at(p, end[0], end[1]);
  }

  rockMesh() {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const inst = new THREE.InstancedMesh(geo, MAT.rock, this.rocks.length);
    const m = new THREE.Matrix4();
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    this.rocks.forEach((r, i) => {
      e.set(r.r, r.r * 1.7, r.r * 0.6);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(r.x, r.y, r.z), q, new THREE.Vector3(r.s * 1.2, r.s * 0.8, r.s));
      inst.setMatrixAt(i, m);
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    this.group.add(inst);
  }

  pier(p, a0, o0, o1, width = 5) {
    const a = at(p, a0, o0);
    const b = at(p, a0, o1);
    const len = o1 - o0;
    const yaw = yawOf(p.out);
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    this.box(width, 0.4, len, MAT.timber, mx, 1.6, mz, yaw, true);
    for (let t = 2; t < len; t += 5) {
      for (const side of [-1, 1]) {
        const q = at(p, a0 + side * (width / 2 - 0.3), o0 + t);
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 8, 6), MAT.pile);
        pile.position.set(q.x, -2.3, q.z);
        this.group.add(pile);
        if (t % 10 < 5) {
          const bol = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8), MAT.steel);
          bol.position.set(q.x, 2.05, q.z);
          this.group.add(bol);
        }
      }
    }
    return b;
  }

  house(x, z, yaw, w, l, h, roof) {
    const y = Math.max(0.5, this.shape.heightAt(x, z));
    this.box(w, h, l, MAT.white, x, y + h / 2, z, yaw);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.01, w * 0.62, h * 0.6, 4, 1), roof);
    r.rotation.y = yaw + Math.PI / 4;
    r.scale.set(1, 1, l / w);
    r.position.set(x, y + h + h * 0.3, z);
    r.castShadow = true;
    this.group.add(r);
  }

  harbor(p) {
    const head = this.mole(p, [
      [-125, -20],
      [-125, 90],
      [-60, 135],
      [30, 150],
    ]);
    p.breakwaterHead = head;
    this.pier(p, 35, -15, 75);
    // Fuel dock at the pier head.
    const f = at(p, 35, 72);
    this.box(1.2, 1.6, 0.8, MAT.fuel, f.x, 2.6, f.z, yawOf(p.out));
    this.box(3, 2.4, 2.6, MAT.white, at(p, 35, 62).x, 3, at(p, 35, 62).z, yawOf(p.out));
    // Quay along the shore and a crane.
    this.box(150, 3, 10, MAT.concrete, at(p, 10, -25).x, 0.5, at(p, 10, -25).z, yawOf(p.along) - Math.PI / 2, true);
    const c = at(p, -20, -24);
    this.box(0.8, 12, 0.8, MAT.yellow, c.x, 8, c.z);
    const jib = this.box(0.6, 0.6, 14, MAT.yellow, c.x, 14, c.z, yawOf(p.out));
    jib.position.x += p.out.x * 5;
    jib.position.z += p.out.z * 5;
    // Harbour houses on the rise behind the quay.
    for (let i = 0; i < 7; i++) {
      const a = -90 + i * 28 + fbm(i, 3, 8) * 8;
      const o = -45 - fbm(i, 9, 8) * 35;
      const hq = at(p, a, o);
      this.house(hq.x, hq.z, yawOf(p.out) + (fbm(i, 1, 2) - 0.5) * 0.4, 7 + (i % 3) * 2, 9, 5 + (i % 2) * 2, i % 3 ? MAT.roof : MAT.roofGrey);
    }
  }

  station(p) {
    this.pier(p, 0, -10, 32, 4);
    const f = at(p, 0, 30);
    this.box(1.2, 1.6, 0.8, MAT.fuel, f.x, 2.6, f.z, yawOf(p.out));
    const hq = at(p, 18, -30);
    this.house(hq.x, hq.z, yawOf(p.out), 8, 10, 5, MAT.roof);
  }
}
