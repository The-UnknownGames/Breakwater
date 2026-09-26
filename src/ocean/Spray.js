// Spray (spec 2.5): instanced camera-facing sprites in one draw call.
// Two kinds share the buffers:
//   droplets: small clusters stretched along their screen-space velocity
//   mist:     large, soft, rotating puffs that grow and linger
// Lit by the sky dome plus a forward-scattering sun term (backlit spray
// glows), fogged, and faded near the camera. CPU-simulated.

import * as THREE from 'three';
import { FOG_GLSL, fogUniforms } from '../render/fogGLSL.js';
import { SPRAY } from '../config/render.js';
import { mulberry32 } from '../core/Rng.js';
import { createSprayAtlas } from './SprayTextures.js';

const DROPLET = 0;
const MIST = 1;

const vertexShader = /* glsl */ `
attribute vec4 aPosSize;
attribute vec4 aVelAlpha;
attribute vec3 aMeta; // kind, atlas cell, rotation
varying vec2 vUv;
varying float vAlpha;
varying float vKind;
varying vec3 vWorld;
void main() {
  vec3 pos = aPosSize.xyz;
  float size = aPosSize.w;
  vec4 mv = viewMatrix * vec4(pos, 1.0);
  vec2 corner = position.xy;
  // Branch-free: both offsets computed, blended by kind (0 droplet, 1 mist).
  vec2 v = (viewMatrix * vec4(aVelAlpha.xyz, 0.0)).xy;
  float len = length(v);
  vec2 dir = v / max(len, 1e-3);
  dir = mix(vec2(0.0, 1.0), dir, step(1e-3, len));
  // (dir.y, -dir.x) keeps the quad's winding (a proper rotation of the
  // corner frame); the mirrored perp flipped it and FrontSide culled every
  // droplet.
  vec2 perp = vec2(dir.y, -dir.x);
  // Motion blur over ~1/30 s: thin streaks along the screen velocity whose
  // opacity falls as they lengthen (the same light spread over more area).
  float stretch = 1.0 + clamp(len * 0.3, 0.0, 7.0);
  vec2 dropOffset = perp * (corner.x * size * 0.7) + dir * (corner.y * size * stretch);
  float c = cos(aMeta.z);
  float s = sin(aMeta.z);
  vec2 mistOffset = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y) * size;
  // Mist streams: stretched a little along its screen motion.
  mistOffset += dir * dot(mistOffset, dir) * min(len * 0.06, 1.4);
  float isMist = step(0.5, aMeta.x);
  vec2 offset = mix(dropOffset, mistOffset, isMist);
  mv.xy += offset;
  float cell = aMeta.y;
  float col = mod(cell, 2.0) + 2.0 * isMist;
  float row = floor(cell / 2.0);
  vUv = vec2((col + corner.x + 0.5) / 4.0, (row + corner.y + 0.5) / 2.0);
  float camFade = smoothstep(0.6, 3.5, -mv.z);
  float blur = mix(min(1.0, 1.35 * inversesqrt(stretch)), 1.0, isMist);
  vAlpha = aVelAlpha.w * camFade * blur;
  vKind = aMeta.x;
  vWorld = pos;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
${FOG_GLSL}
uniform sampler2D uAtlas;
uniform vec3 uSky;
uniform vec3 uSun;
uniform vec3 uSunDir;
varying vec2 vUv;
varying float vAlpha;
varying float vKind;
varying vec3 vWorld;

// Henyey-Greenstein phase: water droplets scatter strongly forward.
float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5));
}

void main() {
  vec4 t = texture2D(uAtlas, vUv);
  float a = t.a * vAlpha;
  if (a < 0.004) discard;
  vec3 view = normalize(vWorld - cameraPosition);
  float c = dot(view, uSunDir);
  float phase = hg(c, 0.62) * 6.0 + 0.35;
  float mist = step(0.5, vKind);
  vec3 col = uSky * mix(1.15, 0.95, mist) + uSun * phase * mix(0.55, 0.35, mist);
  col *= t.rgb;
  // Thin mist edges glow when backlit (light passing through, not around).
  col += uSun * phase * mist * (1.0 - t.a) * 0.45 * t.a;
  col = applyFog(col, vWorld);
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
    this.meta = new Float32Array(max * 3);
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    this.aPosSize = new THREE.InstancedBufferAttribute(this.posSize, 4).setUsage(THREE.DynamicDrawUsage);
    this.aVelAlpha = new THREE.InstancedBufferAttribute(this.velAlpha, 4).setUsage(THREE.DynamicDrawUsage);
    this.aMeta = new THREE.InstancedBufferAttribute(this.meta, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPosSize', this.aPosSize);
    geo.setAttribute('aVelAlpha', this.aVelAlpha);
    geo.setAttribute('aMeta', this.aMeta);
    geo.instanceCount = 0;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        ...fogUniforms,
        uAtlas: { value: createSprayAtlas() },
        uSky: { value: new THREE.Color(1, 1, 1) },
        uSun: { value: new THREE.Color(0, 0, 0) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      },
      vertexShader,
      fragmentShader,
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
  mist(n, px, py, pz, vx, vy, vz, spread, size = 1.4, life = 2.4) {
    for (let k = 0; k < n; k++) {
      this.spawn(MIST, px, py, pz, vx, vy, vz, spread, size, life, 0.3, 1.9 + size * 0.2);
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
      const k = isMist ? 1.6 : SPRAY.airDrag;
      const drag = Math.exp(-dt * k);
      this.vel[o] = wind.x + (this.vel[o] - wind.x) * drag;
      this.vel[o + 1] = this.vel[o + 1] * drag - (isMist ? 1.2 : 9.81) * dt;
      this.vel[o + 2] = wind.z + (this.vel[o + 2] - wind.z) * drag;
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
      this.meta[o] = this.kind[j];
      this.meta[o + 1] = this.cell[j];
      this.meta[o + 2] = this.rot[j];
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
