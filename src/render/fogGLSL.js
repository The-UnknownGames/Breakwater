// Height-based exponential fog shared by all custom shaders. Uniform objects
// are shared by reference so Atmosphere updates every material at once.

import * as THREE from 'three';

export const fogUniforms = {
  uFogColor: { value: new THREE.Color(0.5, 0.55, 0.6) },
  uFogDensity: { value: 0.0005 },
  uFogFalloff: { value: 0.004 },
  uFogSunColor: { value: new THREE.Color(0, 0, 0) },
  uFogSunDir: { value: new THREE.Vector3(0, 1, 0) },
};

export const FOG_GLSL = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uFogFalloff;
uniform vec3 uFogSunColor;
uniform vec3 uFogSunDir;

vec3 fogColorFor(vec3 dir) {
  float s = max(dot(dir, uFogSunDir), 0.0);
  return uFogColor + uFogSunColor * (pow(s, 8.0) * 0.6 + pow(s, 64.0) * 0.8);
}

float fogAmount(vec3 worldPos) {
  vec3 ray = worldPos - cameraPosition;
  float L = length(ray);
  float bdh = uFogFalloff * ray.y;
  float fac = abs(bdh) > 1e-4 ? (1.0 - exp(-bdh)) / bdh : 1.0;
  float base = uFogDensity * exp(-uFogFalloff * max(cameraPosition.y, 0.0));
  return 1.0 - exp(-base * L * fac);
}

vec3 applyFog(vec3 col, vec3 worldPos) {
  vec3 dir = normalize(worldPos - cameraPosition);
  return mix(col, fogColorFor(dir), fogAmount(worldPos));
}
`;
