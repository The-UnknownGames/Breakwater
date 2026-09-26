// GLSL for the Gerstner sum. Must stay in lock-step with waveShaderPort.js
// (the JS port used by the CPU/GPU agreement test) and Waves.js.

import { MAX_WAVES } from './Waves.js';

export const WAVE_GLSL = /* glsl */ `
#define MAX_WAVES ${MAX_WAVES}
uniform vec4 uWaveA[MAX_WAVES];
uniform vec4 uWaveB[MAX_WAVES];
uniform float uWaveTau;
uniform vec4 uShelter[4]; // x, z, radius, strength (0 = unused)

// Waves die down inside sheltered water (same rule as Waves.shelterAt).
float shelterFactor(vec2 p) {
  float f = 1.0;
  for (int i = 0; i < 4; i++) {
    vec4 sh = uShelter[i];
    float d = length(p - sh.xy) / sh.z;
    f = min(f, 1.0 - sh.w * (1.0 - smoothstep(0.55, 1.0, d)));
  }
  return f;
}

float waveLodFactor(float k, float cell) {
  float lambda = 6.2831853 / k;
  return smoothstep(2.0, 4.0, lambda / max(cell, 1e-4));
}

vec3 gerstnerDisplace(vec2 p0, float cell) {
  vec3 d = vec3(p0.x, 0.0, p0.y);
  float S = shelterFactor(p0);
  for (int i = 0; i < MAX_WAVES; i++) {
    vec4 a = uWaveA[i];
    vec4 b = uWaveB[i];
    float f = waveLodFactor(b.y, cell) * S;
    float th = a.x * p0.x + a.y * p0.y - b.x - b.z * uWaveTau;
    float c = cos(th);
    float s = sin(th);
    vec2 dir = a.xy / b.y;
    d.x += f * a.w * dir.x * c;
    d.z += f * a.w * dir.y * c;
    d.y += f * a.z * s;
  }
  return d;
}

// Returns normal in xyz and the Jacobian determinant in w.
vec4 gerstnerNormal(vec2 p0, float cell, out float height) {
  float dxx = 1.0;
  float dxy = 0.0;
  float dxz = 0.0;
  float dzy = 0.0;
  float dzz = 1.0;
  height = 0.0;
  float S = shelterFactor(p0);
  for (int i = 0; i < MAX_WAVES; i++) {
    vec4 a = uWaveA[i];
    vec4 b = uWaveB[i];
    float f = waveLodFactor(b.y, cell) * S;
    float th = a.x * p0.x + a.y * p0.y - b.x - b.z * uWaveTau;
    float c = cos(th);
    float s = sin(th);
    vec2 dir = a.xy / b.y;
    float wa = f * a.w * b.y * s;
    float ha = f * a.z * b.y * c;
    dxx -= wa * dir.x * dir.x;
    dxz -= wa * dir.x * dir.y;
    dzz -= wa * dir.y * dir.y;
    dxy += ha * dir.x;
    dzy += ha * dir.y;
    height += f * a.z * s;
  }
  float dzx = dxz;
  vec3 n = vec3(dzy * dxz - dzz * dxy, dzz * dxx - dzx * dxz, dzx * dxy - dzy * dxx);
  float jac = dxx * dzz - dxz * dzx;
  return vec4(normalize(n), jac);
}
`;
