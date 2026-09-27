// Draw-call budget (spec 12): a procedural model is built from many small
// meshes. Merge the static ones by material into one mesh each, in the
// model's frame. Moving parts (prop, rudder, wipers, radar), the named
// attachment points and anything marked userData.keep stay as they are.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const KEEP = new Set(['wiper', 'radar', 'propGeo', 'rudderGeo', 'helmCamera', 'towPoint', 'bowCleat', 'searchlight', 'propeller', 'rudder']);

function kept(o, root, gear) {
  for (let p = o; p && p !== root; p = p.parent) {
    if (KEEP.has(p.name) || p.userData.keep || gear.has(p)) {
      return true;
    }
  }
  return false;
}

// Materials that look the same merge together even when they are separate
// instances (builders often make one per part).
function materialKey(m) {
  const hex = (c) => (c ? c.getHexString() : '-');
  const id = (t) => (t ? t.uuid : '-');
  return [m.type, hex(m.color), m.roughness, m.metalness, hex(m.emissive), m.emissiveIntensity, id(m.map), id(m.normalMap), id(m.roughnessMap), id(m.metalnessMap), id(m.emissiveMap), id(m.alphaMap), m.transparent, m.opacity, m.side, m.vertexColors, m.flatShading, m.depthWrite, m.alphaTest].join('|');
}

// Same attribute set for every piece: position, normal, uv (zeros if
// missing), color when the material uses vertex colours; non-indexed.
function normalise(g, vertexColors) {
  const out = g.index ? g.toNonIndexed() : g;
  const keep = vertexColors ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
  for (const name of Object.keys(out.attributes)) {
    if (!keep.includes(name)) {
      out.deleteAttribute(name);
    }
  }
  if (vertexColors && !out.attributes.color) {
    out.setAttribute('color', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 3).fill(1), 3));
  } else if (vertexColors && out.attributes.color.itemSize !== 3) {
    const c = out.attributes.color;
    const a = new Float32Array(c.count * 3);
    for (let i = 0; i < c.count; i++) {
      a[i * 3] = c.getX(i);
      a[i * 3 + 1] = c.getY(i);
      a[i * 3 + 2] = c.getZ(i);
    }
    out.setAttribute('color', new THREE.BufferAttribute(a, 3));
  }
  if (!out.attributes.normal) {
    out.computeVertexNormals();
  }
  if (!out.attributes.uv) {
    out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  }
  return out;
}

export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const gear = new Set(Object.values(root.userData.gear || {}));
  const groups = new Map();
  const remove = [];
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || kept(o, root, gear)) {
      return;
    }
    if (o.material.morphTargets || Object.keys(o.geometry.morphAttributes || {}).length) {
      return;
    }
    const g = normalise(o.geometry.clone(), o.material.vertexColors);
    g.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    const key = materialKey(o.material);
    if (!groups.has(key)) {
      groups.set(key, { material: o.material, geos: [], cast: false, receive: false });
    }
    const e = groups.get(key);
    e.geos.push(g);
    e.cast = e.cast || o.castShadow;
    e.receive = e.receive || o.receiveShadow;
    remove.push(o);
  });
  for (const o of remove) {
    o.parent.remove(o);
  }
  for (const e of groups.values()) {
    const merged = mergeGeometries(e.geos, false);
    if (!merged) {
      continue;
    }
    const mesh = new THREE.Mesh(merged, e.material);
    mesh.castShadow = e.cast;
    mesh.receiveShadow = e.receive;
    mesh.name = 'merged';
    root.add(mesh);
  }
  return root;
}
