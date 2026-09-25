// Spray particles (spec 2.5): bow slams, hull spray at speed, prop wash.
// One Points draw call; CPU-simulated; lit by sun and sky (not unlit white).

import * as THREE from 'three';
import { FOG_GLSL, fogUniforms } from '../render/fogGLSL.js';
import { SPRAY } from '../config/render.js';
import { mulberry32 } from '../core/Rng.js';

const vertexShader = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying float vAlpha;
varying vec3 vWorld;
void main() {
  vAlpha = aAlpha;
  vWorld = position;
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.1), 1.0, 160.0);
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
${FOG_GLSL}
uniform vec3 uLight;
varying float vAlpha;
varying vec3 vWorld;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.15, r) * vAlpha;
  if (a < 0.01) discard;
  vec3 col = applyFog(uLight, vWorld);
  gl_FragColor = vec4(col, a);
}
`;

export class Spray {
  constructor(max = SPRAY.maxParticles) {
    this.max = max;
    this.rng = mulberry32(77);
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.floor = new Float32Array(max);
    this.alive = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...fogUniforms, uScale: { value: 600 }, uLight: { value: new THREE.Color(1, 1, 1) } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'spray';
  }

  // Emit n particles at p with base velocity v and random spread (m/s).
  emit(n, px, py, pz, vx, vy, vz, spread, size = SPRAY.size, life = SPRAY.life) {
    const rng = this.rng;
    for (let k = 0; k < n && this.alive < this.max; k++) {
      const i = this.alive++;
      this.pos[i * 3] = px + (rng() - 0.5) * 0.3;
      this.pos[i * 3 + 1] = py;
      this.pos[i * 3 + 2] = pz + (rng() - 0.5) * 0.3;
      this.vel[i * 3] = vx + (rng() - 0.5) * spread;
      this.vel[i * 3 + 1] = vy + rng() * spread * 0.6;
      this.vel[i * 3 + 2] = vz + (rng() - 0.5) * spread;
      this.maxLife[i] = life * (0.6 + 0.8 * rng());
      this.life[i] = this.maxLife[i];
      this.size[i] = size * (0.6 + 0.9 * rng());
      this.floor[i] = py - 0.6;
    }
  }

  update(dt, wind, light, pixelScale) {
    const drag = Math.exp(-dt * SPRAY.airDrag);
    let i = 0;
    while (i < this.alive) {
      this.life[i] -= dt;
      const o = i * 3;
      if (this.life[i] <= 0 || this.pos[o + 1] < this.floor[i]) {
        this.kill(i);
        continue;
      }
      const vx = this.vel[o] * drag + (wind.x - this.vel[o]) * (1 - drag) * 0.6;
      const vz = this.vel[o + 2] * drag + (wind.z - this.vel[o + 2]) * (1 - drag) * 0.6;
      this.vel[o] = vx;
      this.vel[o + 1] = this.vel[o + 1] * drag - 9.81 * dt;
      this.vel[o + 2] = vz;
      this.pos[o] += vx * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += vz * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.2) * 0.7;
      this.size[i] += dt * 0.6;
      i++;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, this.alive);
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    this.material.uniforms.uLight.value.copy(light);
    this.material.uniforms.uScale.value = pixelScale;
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
    this.alpha[i] = this.alpha[last];
    this.floor[i] = this.floor[last];
  }
}
