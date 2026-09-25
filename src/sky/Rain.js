// Rain streaks: one LineSegments draw call. Each drop wraps inside a box
// around the camera in the vertex shader and is slanted by the wind.
// Intensity controls how many drops are drawn.

import * as THREE from 'three';
import { FOG_GLSL, fogUniforms } from '../render/fogGLSL.js';
import { mulberry32 } from '../core/Rng.js';

const BOX = new THREE.Vector3(60, 34, 60);

const vertexShader = /* glsl */ `
attribute vec4 seed;
uniform vec3 uCam;
uniform vec3 uBox;
uniform vec3 uVel;
uniform float uTime;
uniform float uStreak;
varying float vEnd;
varying vec3 vWorld;
void main() {
  vec3 p = seed.xyz * uBox + uVel * uTime * (0.85 + 0.3 * seed.w);
  vec3 origin = uCam - uBox * 0.5;
  vec3 local = mod(p - origin, uBox);
  vec3 wp = origin + local;
  // position.y is 0 for the head and 1 for the tail of the streak.
  wp -= uVel * uStreak * position.y;
  vEnd = position.y;
  vWorld = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const fragmentShader = /* glsl */ `
${FOG_GLSL}
uniform vec3 uColor;
uniform float uOpacity;
varying float vEnd;
varying vec3 vWorld;
void main() {
  float d = length(vWorld - cameraPosition);
  float fade = smoothstep(0.5, 3.0, d) * (1.0 - smoothstep(18.0, 30.0, d));
  float a = uOpacity * fade * (1.0 - vEnd * 0.7);
  vec3 col = applyFog(uColor, vWorld);
  gl_FragColor = vec4(col, a);
}
`;

export class Rain {
  constructor(maxDrops) {
    this.maxDrops = maxDrops;
    const rng = mulberry32(4242);
    const pos = new Float32Array(maxDrops * 2 * 3);
    const seed = new Float32Array(maxDrops * 2 * 4);
    for (let i = 0; i < maxDrops; i++) {
      const s = [rng(), rng(), rng(), rng()];
      for (let v = 0; v < 2; v++) {
        const k = i * 2 + v;
        pos[k * 3 + 1] = v;
        seed.set(s, k * 4);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        ...fogUniforms,
        uCam: { value: new THREE.Vector3() },
        uBox: { value: BOX.clone() },
        uVel: { value: new THREE.Vector3(0, -9, 0) },
        uTime: { value: 0 },
        uStreak: { value: 0.05 },
        uColor: { value: new THREE.Color(0.6, 0.63, 0.66) },
        uOpacity: { value: 0.35 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.LineSegments(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'rain';
    this.time = 0;
  }

  update(dt, camera, intensity, windTravel, windKn, lightColor) {
    this.time += dt;
    const u = this.material.uniforms;
    const count = Math.floor(this.maxDrops * Math.min(Math.max(intensity, 0), 1));
    this.mesh.geometry.setDrawRange(0, count * 2);
    this.mesh.visible = count > 0;
    u.uCam.value.copy(camera.position);
    u.uTime.value = this.time % 1000;
    const wind = windKn * 0.5144 * 0.55;
    u.uVel.value.set(windTravel.x * wind, -9.5, windTravel.z * wind);
    u.uColor.value.copy(lightColor).multiplyScalar(1.6).addScalar(0.02);
    u.uOpacity.value = 0.07 + 0.1 * intensity;
  }
}
