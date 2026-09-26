// Spray (spec 2.5): instanced camera-facing sprites in one draw call.
// Two kinds share the buffers:
//   droplets: fine drops stretched along their screen-space velocity
//   mist:     billowing, rotating puffs that grow, linger and dissolve
// Normal-mapped sprites lit by sky + sun with forward scattering (see
// SprayShaders.js), fogged, and faded near the camera. CPU-simulated.

import * as THREE from 'three';
import { fogUniforms } from '../render/fogGLSL.js';
import { sprayVertex, sprayFragment } from './SprayShaders.js';
import { SPRAY } from '../config/render.js';
import { mulberry32 } from '../core/Rng.js';
import { createSprayAtlas, createSprayNoise } from './SprayTextures.js';

const DROPLET = 0;
const MIST = 1;

export class Spray {
  constructor(max) {
    max = max || SPRAY.maxParticles;
    this.max = max;
    this.rng = mulberry32(77);
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.alpha0 = new Float32Array(max);
    this.kind = new Uint8Array(max);
    this.cell = new Uint8Array(max);
    this.rot = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.floor = new Float32Array(max);
    this.alive = 0;
    this.posSize = new Float32Array(max * 4);
    this.velAlpha = new Float32Array(max * 4);
    this.meta = new Float32Array(max * 4);
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    this.aPosSize = new THREE.InstancedBufferAttribute(this.posSize, 4).setUsage(THREE.DynamicDrawUsage);
    this.aVelAlpha = new THREE.InstancedBufferAttribute(this.velAlpha, 4).setUsage(THREE.DynamicDrawUsage);
    this.aMeta = new THREE.InstancedBufferAttribute(this.meta, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPosSize', this.aPosSize);
    geo.setAttribute('aVelAlpha', this.aVelAlpha);
    geo.setAttribute('aMeta', this.aMeta);
    geo.instanceCount = 0;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        ...fogUniforms,
        uAtlas: { value: createSprayAtlas() },
        uNoise: { value: createSprayNoise() },
        uSky: { value: new THREE.Color(1, 1, 1) },
        uSun: { value: new THREE.Color(0, 0, 0) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      },
      vertexShader: sprayVertex,
      fragmentShader: sprayFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'spray';
    this.mesh.renderOrder = 3;
    // Back-compat name used by the session.
    this.points = this.mesh;
  }

  spawn(kind, px, py, pz, vx, vy, vz, spread, size, life, alpha, grow) {
    if (this.alive >= this.max) {
      return;
    }
    const rng = this.rng;
    const i = this.alive++;
    const o = i * 3;
    this.pos[o] = px + (rng() - 0.5) * 0.4;
    this.pos[o + 1] = py + rng() * 0.15;
    this.pos[o + 2] = pz + (rng() - 0.5) * 0.4;
    this.vel[o] = vx + (rng() - 0.5) * spread;
    this.vel[o + 1] = vy * (0.6 + 0.6 * rng());
    this.vel[o + 2] = vz + (rng() - 0.5) * spread;
    this.maxLife[i] = life * (0.6 + 0.8 * rng());
    this.life[i] = this.maxLife[i];
    this.size[i] = size * (0.6 + 0.8 * rng());
    this.grow[i] = grow;
    this.alpha0[i] = alpha;
    this.kind[i] = kind;
    this.cell[i] = Math.floor(rng() * 4);
    this.rot[i] = rng() * Math.PI * 2;
    this.spin[i] = (rng() - 0.5) * 1.2;
    this.floor[i] = py - 1.1;
  }

  // Fast, bright droplet clusters (streaks).
  droplets(n, px, py, pz, vx, vy, vz, spread, size = 0.35, life = 1.3) {
    for (let k = 0; k < n; k++) {
      this.spawn(DROPLET, px, py, pz, vx, vy, vz, spread, size, life, 1.0, 0.1);
    }
  }

  // Soft mist puffs that billow and hang in the air.
  mist(n, px, py, pz, vx, vy, vz, spread, size = 1.4, life = 2.4, alpha = 0.3) {
    for (let k = 0; k < n; k++) {
      this.spawn(MIST, px, py, pz, vx, vy, vz, spread, size, life, alpha, SPRAY.mistGrow + size * 0.08);
    }
  }

  // Legacy mixed emitter: mostly droplets with some mist.
  emit(n, px, py, pz, vx, vy, vz, spread, size = SPRAY.size, life = SPRAY.life) {
    const nd = Math.ceil(n * 0.7);
    this.droplets(nd, px, py, pz, vx, vy, vz, spread, size * 0.55, life * 0.8);
    this.mist(Math.ceil((n - nd) * 0.5), px, py, pz, vx * 0.6, vy * 0.5, vz * 0.6, spread * 0.6, size * 2.2, life * 1.3);
  }

  update(dt, wind, sky, sunDir, sun) {
    let i = 0;
    while (i < this.alive) {
      this.life[i] -= dt;
      const o = i * 3;
      if (this.life[i] <= 0 || this.pos[o + 1] < this.floor[i]) {
        this.kill(i);
        continue;
      }
      const isMist = this.kind[i] === MIST;
      // Mist is carried by the wind; droplets fall ballistically.
      // Mist slows quickly and drifts downwind at a fraction of the wind
      // speed (it is dragged along near the sea, not launched by gusts);
      // droplets fly ballistically with light drag.
      const k = isMist ? SPRAY.mistDrag : SPRAY.airDrag;
      const carry = isMist ? SPRAY.mistWindCarry : 1;
      const drag = Math.exp(-dt * k);
      const wx = wind.x * carry;
      const wz = wind.z * carry;
      this.vel[o] = wx + (this.vel[o] - wx) * drag;
      // Mist is water too: it settles back to the sea, not smoke.
      this.vel[o + 1] = this.vel[o + 1] * drag - (isMist ? SPRAY.mistFall : 9.81) * dt;
      this.vel[o + 2] = wz + (this.vel[o + 2] - wz) * drag;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      this.rot[i] += this.spin[i] * dt;
      i++;
    }
    for (let j = 0; j < this.alive; j++) {
      const o = j * 3;
      const q = j * 4;
      const t = this.life[j] / this.maxLife[j];
      const fadeIn = Math.min(1, (1 - t) * 8);
      this.posSize[q] = this.pos[o];
      this.posSize[q + 1] = this.pos[o + 1];
      this.posSize[q + 2] = this.pos[o + 2];
      this.posSize[q + 3] = this.size[j];
      this.velAlpha[q] = this.vel[o];
      this.velAlpha[q + 1] = this.vel[o + 1];
      this.velAlpha[q + 2] = this.vel[o + 2];
      // Fade out as the particle falls back to the surface.
      const land = Math.min(1, (this.pos[o + 1] - this.floor[j]) * 2.5);
      this.velAlpha[q + 3] = this.alpha0[j] * Math.min(1, t * 1.8) * fadeIn * land;
      this.meta[q] = this.kind[j];
      this.meta[q + 1] = this.cell[j];
      this.meta[q + 2] = this.rot[j];
      this.meta[q + 3] = 1 - t;
    }
    this.mesh.geometry.instanceCount = this.alive;
    this.aPosSize.needsUpdate = true;
    this.aVelAlpha.needsUpdate = true;
    this.aMeta.needsUpdate = true;
    const u = this.material.uniforms;
    u.uSky.value.copy(sky);
    u.uSun.value.copy(sun);
    u.uSunDir.value.copy(sunDir);
  }

  kill(i) {
    const last = --this.alive;
    if (i === last) {
      return;
    }
    const o = i * 3;
    const l = last * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[o + k] = this.pos[l + k];
      this.vel[o + k] = this.vel[l + k];
    }
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.size[i] = this.size[last];
    this.grow[i] = this.grow[last];
    this.alpha0[i] = this.alpha0[last];
    this.kind[i] = this.kind[last];
    this.cell[i] = this.cell[last];
    this.rot[i] = this.rot[last];
    this.spin[i] = this.spin[last];
    this.floor[i] = this.floor[last];
  }
}
