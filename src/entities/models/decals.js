// Hull-number decals drawn to a canvas texture and bent to the bow flare.

import * as THREE from 'three';
import { hullStation, sectionPoint } from '../../physics/HullShape.js';
import { WORLD } from '../../config/palette.js';

let texture = null;

function numberTexture(text) {
  if (texture) {
    return texture;
  }
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = `#${new THREE.Color(WORLD.workboatNavy).getHexString()}`;
  g.font = '600 104px "IBM Plex Sans Condensed", "Arial Narrow", Arial, sans-serif';
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillText(text, c.width / 2, c.height / 2 + 4);
  texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// A strip of quads hugging the topsides between two stations.
export function createHullNumber(text, side, h) {
  const tex = numberTexture(text);
  const s0 = 0.64;
  const s1 = 0.82;
  const segs = 8;
  const height = 0.42;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segs; i++) {
    const s = s0 + ((s1 - s0) * i) / segs;
    const st = hullStation(h, s);
    const y0 = 0.42;
    for (let k = 0; k < 2; k++) {
      const y = y0 + k * height;
      const u = (y - st.keel) / (st.deck - st.keel);
      const th = Math.acos(Math.pow(1 - Math.min(u, 0.999), st.n / 2));
      const p = sectionPoint(st, th / (Math.PI / 2));
      positions.push(side * (p.x + 0.012), y, st.z);
      const uu = side > 0 ? 1 - i / segs : i / segs;
      uvs.push(uu, k);
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    if (side > 0) {
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    } else {
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    roughness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  return new THREE.Mesh(geo, mat);
}
