// Procedural cloud dome: fbm projected onto a cloud plane, coverage and
// darkness from the weather, lit by sun/sky, dissolving into height fog at
// the horizon. Below the horizon it outputs the fog colour so the sea edge
// never shows.

import * as THREE from 'three';
import { FOG_GLSL, fogUniforms } from '../render/fogGLSL.js';
import { SKY } from '../config/render.js';

const vertexShader = /* glsl */ `
varying vec3 vDir;
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const fragmentShader = /* glsl */ `
${FOG_GLSL}
uniform float uCover;
uniform float uDark;
uniform float uFlash;
uniform vec2 uOffset;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uCloudDark;
uniform float uSkyFogScale;
varying vec3 vDir;
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
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < OCTAVES; i++) {
    v += a * vnoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  vec3 fogCol = fogColorFor(d);
  if (d.y <= 0.0) {
    gl_FragColor = vec4(fogCol, 1.0);
    return;
  }
  vec2 uv = d.xz / (d.y + 0.06) * 0.9 + uOffset;
  float n = fbm(uv);
  float n2 = fbm(uv * 3.1 + 7.0);
  float shape = n * 0.8 + n2 * 0.2;
  float lo = 0.78 - uCover * 0.62;
  float dens = smoothstep(lo, lo + 0.22, shape);
  dens = max(dens, smoothstep(0.85, 1.0, uCover) * 0.9);

  // Cheap self-shadowing: sample toward the sun.
  float ns = fbm(uv + normalize(uSunDir.xz + 1e-4) * 0.12);
  float shade = clamp(0.55 + (shape - ns) * 2.2, 0.0, 1.0);
  float thick = smoothstep(lo, lo + 0.5, shape);
  float sunUp = clamp(uSunDir.y * 3.0 + 0.2, 0.0, 1.0);
  vec3 lit = uSunColor * sunUp * (0.3 + 0.7 * shade) * (1.0 - uDark * 0.85) * 0.75 + uSkyColor * 0.9;
  vec3 base = mix(uSkyColor * 0.8, uCloudDark, uDark);
  vec3 col = mix(lit, base, clamp(thick * (0.12 + uDark * 0.7), 0.0, 1.0));
  // Silver lining around the sun on thin edges.
  float sunAng = max(dot(d, uSunDir), 0.0);
  col += uSunColor * pow(sunAng, 10.0) * (1.0 - thick) * 0.9 * (1.0 - uDark);
  col += vec3(0.75, 0.8, 0.95) * uFlash * (0.4 + 0.6 * shade) * dens;

  // Aerial perspective through the height fog up to the cloud deck.
  float path = uFogDensity * uSkyFogScale / max(d.y, 0.01);
  float haze = 1.0 - exp(-path);
  col = mix(col, fogCol, haze);
  float alpha = mix(dens, 1.0, haze);
  gl_FragColor = vec4(col, alpha);
}
`;

export class Clouds {
  constructor(octaves = 5) {
    this.offset = new THREE.Vector2();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        ...fogUniforms,
        uCover: { value: 0.3 },
        uDark: { value: 0 },
        uFlash: { value: 0 },
        uOffset: { value: this.offset },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uSkyColor: { value: new THREE.Color(0.5, 0.5, 0.5) },
        uCloudDark: { value: new THREE.Color(0.1, 0.1, 0.1) },
        uSkyFogScale: { value: SKY.hazeScaleHeight },
      },
      defines: { OCTAVES: octaves },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const geo = new THREE.SphereGeometry(SKY.cloudRadius, 48, 24);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'clouds';
  }

  get uniforms() {
    return this.material.uniforms;
  }

  update(dt, windTravel, windKn, camera) {
    const speed = windKn * 0.0004 * SKY.cloudWindScale;
    this.offset.x += windTravel.x * speed * dt;
    this.offset.y += windTravel.z * speed * dt;
    this.mesh.position.copy(camera.position);
  }
}
