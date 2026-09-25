// Shared boat materials: glossy gelcoat, stainless, rubber, and a
// procedural non-skid deck (diamond tread as colour + bump, mipmapped and
// anisotropic so it stays crisp at grazing angles).

import * as THREE from 'three';

export function gelcoat(color, rough = 0.32) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.2 });
}

export function stainless(rough = 0.22) {
  return new THREE.MeshStandardMaterial({ color: 0xd0d4d6, roughness: rough, metalness: 0.95 });
}

export function rubber(color = 0x1b1e20) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
}

export function paint(color, rough = 0.5, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

let nonSkid = null;

function nonSkidTextures() {
  if (nonSkid) {
    return nonSkid;
  }
  const n = 128;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, n, n);
  // Raised diamond tread on a 16 px grid, with a little grit.
  for (let y = 0; y < n; y += 16) {
    for (let x = 0; x < n; x += 16) {
      g.fillStyle = '#c8c8c8';
      g.beginPath();
      g.moveTo(x + 8, y + 2);
      g.lineTo(x + 14, y + 8);
      g.lineTo(x + 8, y + 14);
      g.lineTo(x + 2, y + 8);
      g.closePath();
      g.fill();
    }
  }
  const img = g.getImageData(0, 0, n, n);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() - 0.5) * 30;
    img.data[i] += v;
    img.data[i + 1] += v;
    img.data[i + 2] += v;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  nonSkid = tex;
  return tex;
}

// UVs must be in metres (1 repeat per 0.5 m after the texture repeat).
export function nonSkidDeck(color = 0x9a9d98) {
  const t = nonSkidTextures();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, bumpMap: t, bumpScale: 1.2 });
  m.bumpMap.repeat.set(2, 2);
  return m;
}

// Planar XZ uvs in metres for flat parts (decks, roofs).
export function planarUV(geo) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i);
    uv[i * 2 + 1] = pos.getZ(i);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
