// Island terrain (spec 6): one height-field mesh per island from the shared
// WorldShape (so what you see is what the boat hits), granite / heath /
// wet-rock vertex colours by height and slope, instanced spruce on the
// gentle high ground, and a coarser trimesh collider per island.

import * as THREE from 'three';
import { fbm } from './WorldShape.js';

const C = {
  wet: new THREE.Color(0x2c2a27),
  sand: new THREE.Color(0x8a7e68),
  granite: new THREE.Color(0x6a6d6e),
  graniteDark: new THREE.Color(0x4a4d4f),
  heath: new THREE.Color(0x4e5a3a),
  moss: new THREE.Color(0x3b4a2e),
};

function islandGrid(shape, s, step) {
  const half = s.r * 1.45;
  const n = Math.ceil((half * 2) / step);
  const verts = (n + 1) * (n + 1);
  const pos = new Float32Array(verts * 3);
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = s.x - half + i * step;
      const z = s.z - half + j * step;
      const h = Math.max(-14, shape.heightAt(x, z));
      const o = (j * (n + 1) + i) * 3;
      pos[o] = x;
      pos[o + 1] = h;
      pos[o + 2] = z;
    }
  }
  const idx = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      const b = a + 1;
      const c = a + n + 1;
      const d = c + 1;
      // Skip cells entirely deep under water (never visible).
      if (Math.max(pos[a * 3 + 1], pos[b * 3 + 1], pos[c * 3 + 1], pos[d * 3 + 1]) < -12) {
        continue;
      }
      idx.push(a, c, b, b, c, d);
    }
  }
  return { pos, idx, n };
}

function colourise(geo, seed) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const up = nrm.getY(i);
    const n = fbm(x / 30, z / 30, seed + 11);
    if (y < 0.6) {
      c.copy(C.wet).lerp(C.sand, Math.max(0, Math.min(1, (y + 1.5) / 2)) * 0.5 * (up > 0.9 ? 1 : 0));
    } else {
      const rock = C.granite.clone().lerp(C.graniteDark, n);
      const green = C.heath.clone().lerp(C.moss, n);
      const flat = Math.max(0, Math.min(1, (up - 0.72) / 0.15)) * Math.min(1, (y - 1.5) / 4);
      c.copy(rock).lerp(green, flat * (0.55 + 0.45 * n));
      // Tide line: dark, wet rock just above the water.
      c.lerp(C.wet, Math.max(0, 1 - (y - 0.6) / 1.8) * 0.8);
    }
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// Instanced spruce: one low-poly crown (cheap enough for thousands).
function spruceGeometry() {
  const crown = new THREE.ConeGeometry(1, 4.2, 6, 1, true);
  crown.translate(0, 3.1, 0);
  const g = crown.toNonIndexed();
  const col = new Float32Array(g.attributes.position.count * 3);
  const green = new THREE.Color(0x24321f);
  for (let i = 0; i < g.attributes.position.count; i++) {
    const shade = 0.75 + 0.25 * Math.max(0, g.attributes.position.getY(i) / 5.2);
    col[i * 3] = green.r * shade;
    col[i * 3 + 1] = green.g * shade;
    col[i * 3 + 2] = green.b * shade;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export class Terrain {
  constructor(scene, shape, physics = null, opts = {}) {
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    let trees = [];
    for (const s of shape.islands) {
      const step = Math.max(5, s.r / 60) * (opts.coarse ? 1.6 : 1);
      const g = islandGrid(shape, s, step);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
      geo.setIndex(g.idx);
      geo.computeVertexNormals();
      colourise(geo, s.seed);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      mesh.name = s.name;
      this.group.add(mesh);
      this.scatterTrees(shape, s, trees, opts.coarse ? 0.4 : 1);
      if (physics) {
        this.collider(physics, shape, s);
      }
    }
    // Thin evenly (every island keeps its share) down to the budget.
    const cap = opts.coarse ? 2500 : 7000;
    if (trees.length > cap) {
      const keep = cap / trees.length;
      trees = trees.filter((_, i) => Math.floor((i + 1) * keep) > Math.floor(i * keep));
    }
    const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
    const inst = new THREE.InstancedMesh(spruceGeometry(), tmat, trees.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    trees.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      m.compose(new THREE.Vector3(t.x, t.y - 0.3, t.z), q, new THREE.Vector3(t.s, t.s * t.tall, t.s));
      inst.setMatrixAt(i, m);
    });
    this.group.add(inst);
    scene.add(this.group);
  }

  scatterTrees(shape, s, out, density) {
    const step = 13 / Math.sqrt(density);
    for (let z = s.z - s.r * 1.2; z < s.z + s.r * 1.2; z += step) {
      for (let x = s.x - s.r * 1.2; x < s.x + s.r * 1.2; x += step) {
        const jx = x + (fbm(x, z, 71) - 0.5) * step * 1.6;
        const jz = z + (fbm(z, x, 72) - 0.5) * step * 1.6;
        const h = shape.heightAt(jx, jz);
        if (h < 5 || fbm(jx / 60, jz / 60, s.seed + 31) < 0.47) {
          continue;
        }
        const hx = shape.heightAt(jx + 3, jz) - h;
        const hz = shape.heightAt(jx, jz + 3) - h;
        if (Math.hypot(hx, hz) > 2.2) {
          continue;
        }
        out.push({ x: jx, z: jz, y: h, s: 0.9 + fbm(jx, jz, 5) * 1.3, tall: 0.9 + fbm(jz, jx, 6) * 0.7, rot: fbm(jx, jz, 9) * 6.28 });
      }
    }
  }

  // Coarse trimesh of the island (cliffs and beaches the hull can hit).
  collider(physics, shape, s) {
    const R = physics.R;
    const g = islandGrid(shape, s, Math.max(10, s.r / 30));
    const desc = R.ColliderDesc.trimesh(g.pos, new Uint32Array(g.idx)).setFriction(0.6).setRestitution(0.05);
    physics.world.createCollider(desc);
  }
}
