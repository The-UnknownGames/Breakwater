// Storm front (spec 7, V5): while heavy weather builds, a wall of dark cloud
// and falling rain closes in from windward and passes over the boat as the
// storm arrives. One open cylinder arc around the camera; its radius shrinks
// with the weather's transition progress. Rain streaks scroll down it, it
// takes the fog colour darkened, and lightning lights it up.

import * as THREE from 'three';
import { FOG_GLSL, fogUniforms } from '../render/fogGLSL.js';
import { STORM_FRONT } from '../config/render.js';

const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const fragmentShader = /* glsl */ `
${FOG_GLSL}
uniform float uOpacity;
uniform float uTime;
uniform float uFlash;
uniform float uDark;
varying vec2 vUv;
varying vec3 vWorld;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  float u = vUv.x;
  float v = vUv.y;
  // Ragged top edge and soft ends of the arc.
  float top = 0.62 + 0.25 * vnoise(vec2(u * 14.0, uTime * 0.02));
  float body = 1.0 - smoothstep(top - 0.25, top, v);
  float ends = smoothstep(0.0, 0.18, u) * smoothstep(1.0, 0.82, u);
  // Rain shafts: vertical streaks and slow billows.
  float shafts = 0.85 + 0.1 * vnoise(vec2(u * 900.0, v * 4.0 + uTime * 0.9)) + 0.05 * vnoise(vec2(u * 2400.0, v * 9.0 + uTime * 1.7));
  float billow = 0.7 + 0.3 * vnoise(vec2(u * 24.0, v * 4.0 - uTime * 0.05));
  // Heavier at the sea (rain shafts reach down), lighter in the cloud base.
  body *= 0.75 + 0.25 * (1.0 - v);
  float a = uOpacity * body * ends * shafts * billow;
  vec3 dir = normalize(vWorld - cameraPosition);
  // Darkest low down in the rain shafts, lifting toward the cloud base.
  vec3 col = fogColorFor(dir) * (1.0 - uDark * (0.95 - 0.35 * v) * billow);
  col += vec3(0.55, 0.6, 0.75) * uFlash * billow;
  // Fog softens it with distance but never quite hides it.
  col = mix(col, fogColorFor(dir), min(fogAmount(vWorld), 0.3));
  gl_FragColor = vec4(col, a);
}
`;

export class StormFront {
  constructor(scene) {
    const c = STORM_FRONT;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 64, 1, true, -c.arc / 2, c.arc);
    geo.translate(0, 0.5, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        ...fogUniforms,
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uFlash: { value: 0 },
        uDark: { value: c.darkness },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
    this.mesh.name = 'stormFront';
    scene.add(this.mesh);
    this.time = 0;
    this.distance = Infinity;
  }

  // weather: sky/Weather; flash: lightning 0..1.
  update(dt, weather, camera, flash) {
    const c = STORM_FRONT;
    this.time += dt;
    const w = weather;
    const building = w.transitioning && w.rising && w.duration >= c.minSeconds && w.target.rain >= c.minRain;
    const s = w.progress * w.progress * (3 - 2 * w.progress);
    this.distance = building ? c.startDistance * (1 - s) : Infinity;
    const on = building && this.distance > c.passDistance;
    this.mesh.visible = on;
    if (!on) {
      return;
    }
    const u = this.material.uniforms;
    u.uTime.value = this.time % 1000;
    u.uFlash.value = flash;
    // Fade in as it appears on the horizon.
    u.uOpacity.value = c.opacity * Math.min(1, w.progress / 0.1) * Math.min(1, (this.distance - c.passDistance) / 150);
    const d = this.distance;
    this.mesh.position.set(camera.position.x, -20, camera.position.z);
    this.mesh.scale.set(d, c.height, d);
    // Arc centred on the direction the wind blows from.
    const from = (w.windDirectionDeg * Math.PI) / 180;
    this.mesh.rotation.y = Math.PI / 2 - from + Math.PI / 2;
  }
}
