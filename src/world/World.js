// The Grey Reach, assembled: terrain, harbors, navigation aids, the seabed
// depth map for physics, and a baked depth texture for the ocean shader
// (shallow-water colour and surf along the shores).

import * as THREE from 'three';
import { WorldShape } from './WorldShape.js';
import { Terrain } from './Terrain.js';
import { Harbors } from './Harbor.js';
import { NavAids } from './NavAids.js';
import { DepthMap } from '../ocean/DepthMap.js';

const DEPTH_TEX = 768;
const DEPTH_HALF = 5600; // metres covered by the depth texture (each way)
const DEPTH_MAX = 40;

function bakeDepth(shape) {
  const n = DEPTH_TEX;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -DEPTH_HALF + ((i + 0.5) / n) * DEPTH_HALF * 2;
      const z = -DEPTH_HALF + ((j + 0.5) / n) * DEPTH_HALF * 2;
      const h = shape.heightAt(x, z);
      const o = (j * n + i) * 4;
      data[o] = Math.round(Math.min(1, Math.max(0, -h / DEPTH_MAX)) * 255);
      data[o + 1] = h > 0 ? 255 : 0;
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class World {
  constructor(game, opts = {}) {
    this.shape = new WorldShape();
    this.depth = new DepthMap(this.shape);
    this.terrain = new Terrain(game.scene, this.shape, game.physics, { coarse: opts.coarse });
    this.harbors = new Harbors(game.scene, this.shape, game.physics);
    this.nav = new NavAids(game.scene, this.shape, this.harbors);
    this.depthTexture = bakeDepth(this.shape);
    this.uniforms = {
      uDepthMap: { value: this.depthTexture },
      uDepthHalf: { value: DEPTH_HALF },
      uDepthMax: { value: DEPTH_MAX },
    };
  }

  get ports() {
    return this.shape.ports;
  }

  update(dt, waves, night) {
    this.nav.update(dt, waves, night);
  }
}
