// Geometry collector for the towns (V7): pieces are placed in a port's
// harbor frame and merged into one mesh per material (draw calls), with
// per-piece vertex colours where the material uses them.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const std = (color, rough = 0.85, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

// Shared town materials. `tint` ones take vertex colours (white base).
export function townMaterials() {
  return {
    wall: std(0xffffff, 0.92, 0, { vertexColors: true }),
    trim: std(0xe9e6dc, 0.7),
    slate: std(0x3b4046, 0.8),
    metalRoof: std(0x6f7a80, 0.55, 0.4),
    glass: std(0x1c262c, 0.12, 0.3),
    windowLit: std(0x1c262c, 0.12, 0.3, { emissive: new THREE.Color(0xffb468), emissiveIntensity: 0 }),
    bulb: std(0xf2e6cc, 0.4, 0, { emissive: new THREE.Color(0xffe2b0), emissiveIntensity: 0.8 }),
    door: std(0x2e2620, 0.7),
    cobble: std(0x5b5751, 0.95),
    pavement: std(0x8a8780, 0.9),
    gravel: std(0x77705f, 1),
    tarmac: std(0x2f3133, 0.9),
    grass: std(0x4b5a36, 1),
    stoneWall: std(0x6b6a66, 0.95),
    floorWood: std(0x6b4a30, 0.75),
    floorStone: std(0x8b8780, 0.9),
    interior: std(0xffffff, 0.85, 0, { vertexColors: true }),
    wood: std(0x5a3d26, 0.7),
    furniture: std(0x5a3d26, 0.7),
    metal: std(0x44494d, 0.45, 0.6),
    lampHead: std(0x303234, 0.5, 0.4, { emissive: new THREE.Color(0xffd08a), emissiveIntensity: 0 }),
    carBody: std(0xffffff, 0.35, 0.4, { vertexColors: true }),
    tyre: std(0x151617, 0.9),
    lights: std(0x222222, 0.4, 0, { emissive: new THREE.Color(0xfff2d8), emissiveIntensity: 0 }),
  };
}

export class TownBuilder {
  // parts: a shared Map (material key -> geometries) so every town merges
  // into one mesh per material.
  constructor(frame, parts = new Map()) {
    this.frame = frame;
    this.parts = parts;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
    this.tmp = {};
  }

  // Add geometry (centred on its origin) at frame (a, o) and height y,
  // turned by `turn` about Y relative to the frame (0: local +Z points out
  // to sea, local +X along -a). Colour for vertex-coloured materials.
  add(key, geo, a, o, y, turn = 0, color = null) {
    const f = this.frame;
    const w = f.toWorld(a, o, this.tmp);
    this.q.setFromAxisAngle(this.up, f.yaw + turn);
    this.m.compose(new THREE.Vector3(w.x, y, w.z), this.q, new THREE.Vector3(1, 1, 1));
    const g = geo.clone().applyMatrix4(this.m);
    const flat = g.index ? g.toNonIndexed() : g;
    flat.deleteAttribute('uv');
    if (color !== null) {
      const c = new THREE.Color(color);
      const n = flat.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      flat.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    if (!this.parts.has(key)) {
      this.parts.set(key, []);
    }
    this.parts.get(key).push(flat);
    return this;
  }

  // Axis-aligned box in the frame: a0..a1 along, o0..o1 out, y0..y1.
  box(key, a0, a1, o0, o1, y0, y1, color = null) {
    const geo = new THREE.BoxGeometry(Math.abs(a1 - a0), y1 - y0, Math.abs(o1 - o0));
    return this.add(key, geo, (a0 + a1) / 2, (o0 + o1) / 2, (y0 + y1) / 2, 0, color);
  }

  // Merge into meshes on `group` using `mats`.
  build(group, mats, shadows = true) {
    for (const [key, list] of this.parts) {
      const mat = mats[key];
      const colored = mat.vertexColors;
      for (const g of list) {
        if (colored && !g.attributes.color) {
          const n = g.attributes.position.count;
          g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
        } else if (!colored && g.attributes.color) {
          g.deleteAttribute('color');
        }
      }
      const mesh = new THREE.Mesh(mergeGeometries(list), mat);
      mesh.castShadow = shadows && key !== 'glass' && key !== 'windowLit';
      mesh.receiveShadow = true;
      mesh.name = `town-${key}`;
      group.add(mesh);
    }
    this.parts.clear();
  }
}

// Pitched roof prism over a w (along a) x d (along o) footprint, ridge
// along a, rising `rise` above y.
export function roofGeometry(w, d, rise, over = 0.35) {
  const hw = w / 2 + over;
  const hd = d / 2 + over;
  const shape = new THREE.Shape();
  shape.moveTo(-hd, 0);
  shape.lineTo(hd, 0);
  shape.lineTo(0, rise);
  shape.lineTo(-hd, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: hw * 2, bevelEnabled: false });
  // Shape is in XY with depth along Z: turn so the ridge runs along X.
  g.translate(0, 0, -hw);
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
