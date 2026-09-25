// Camera-following ocean grid. Cell size grows geometrically away from the
// centre (dense near, coarse far) with no seams or T-junctions, and extends
// to OCEAN.meshRadius so the edge is always lost in fog. The grid origin is
// snapped to a multiple of the inner cell so near vertices don't swim.

import * as THREE from 'three';
import { OCEAN } from '../config/render.js';
import { createOceanMaterial } from './OceanMaterial.js';

// Solve g so that sum_{j<m} base * g^j = radius.
function solveGrowth(m, base, radius) {
  let lo = 1.0001;
  let hi = 2;
  for (let i = 0; i < 80; i++) {
    const g = (lo + hi) / 2;
    const sum = (base * (Math.pow(g, m) - 1)) / (g - 1);
    if (sum > radius) {
      hi = g;
    } else {
      lo = g;
    }
  }
  return (lo + hi) / 2;
}

function buildAxis(half, base, radius) {
  const g = solveGrowth(half, base, radius);
  const coords = [0];
  const cells = [base];
  let x = 0;
  for (let j = 0; j < half; j++) {
    const step = base * Math.pow(g, j);
    x += step;
    coords.push(x);
    cells.push(step);
  }
  const axis = [];
  const axisCell = [];
  for (let j = half; j > 0; j--) {
    axis.push(-coords[j]);
    axisCell.push(cells[j]);
  }
  for (let j = 0; j <= half; j++) {
    axis.push(coords[j]);
    axisCell.push(cells[j]);
  }
  return { axis, axisCell };
}

export function createOceanGeometry(gridSize) {
  const half = Math.floor(gridSize / 2);
  const { axis, axisCell } = buildAxis(half, OCEAN.innerCell, OCEAN.meshRadius);
  const n = axis.length;
  const positions = new Float32Array(n * n * 3);
  const cell = new Float32Array(n * n);
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iz * n + ix;
      positions[i * 3] = axis[ix];
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = axis[iz];
      cell[i] = Math.max(axisCell[ix], axisCell[iz]);
    }
  }
  const index = new Uint32Array((n - 1) * (n - 1) * 6);
  let k = 0;
  for (let iz = 0; iz < n - 1; iz++) {
    for (let ix = 0; ix < n - 1; ix++) {
      const a = iz * n + ix;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      index[k++] = a;
      index[k++] = c;
      index[k++] = b;
      index[k++] = b;
      index[k++] = c;
      index[k++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('cell', new THREE.BufferAttribute(cell, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  return geo;
}

export class OceanMesh {
  constructor(gridSize, detailMaps) {
    this.material = createOceanMaterial(detailMaps);
    this.mesh = new THREE.Mesh(createOceanGeometry(gridSize), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'ocean';
  }

  get uniforms() {
    return this.material.uniforms;
  }

  follow(camera) {
    const snap = OCEAN.innerCell * OCEAN.snapCells;
    const x = Math.round(camera.position.x / snap) * snap;
    const z = Math.round(camera.position.z / snap) * snap;
    this.uniforms.uOrigin.value.set(x, z);
  }
}
