// Local lights for the custom shaders (V5 night): the boat's searchlight
// (one spot) and up to two flares (points). The ocean and the rain read
// these shared uniforms; Three.js SpotLight / PointLights mirror them for
// the standard materials (boats, survivors). Colours carry intensity.

import * as THREE from 'three';

export const localLightUniforms = {
  uSpotPos: { value: new THREE.Vector3() },
  uSpotDir: { value: new THREE.Vector3(0, -1, 0) },
  uSpotCone: { value: new THREE.Vector2(0.97, 0.94) }, // cos inner, cos outer
  uSpotRange: { value: 300 },
  uSpotColor: { value: new THREE.Color(0, 0, 0) },
  uPointPos: { value: [new THREE.Vector3(), new THREE.Vector3()] },
  uPointColor: { value: [new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0)] },
  uPointRange: { value: [500, 500] },
};

export const LOCAL_LIGHTS_GLSL = /* glsl */ `
uniform vec3 uSpotPos;
uniform vec3 uSpotDir;
uniform vec2 uSpotCone;
uniform float uSpotRange;
uniform vec3 uSpotColor;
uniform vec3 uPointPos[2];
uniform vec3 uPointColor[2];
uniform float uPointRange[2];

// Irradiance at P from the local lights (no normal: for rain and spray).
vec3 localIrradiance(vec3 P) {
  vec3 e = vec3(0.0);
  vec3 d = P - uSpotPos;
  float L = length(d);
  float cone = smoothstep(uSpotCone.y, uSpotCone.x, dot(d / max(L, 1e-3), uSpotDir));
  e += uSpotColor * cone / (1.0 + L * L / (uSpotRange * uSpotRange * 0.08)) * step(L, uSpotRange);
  for (int i = 0; i < 2; i++) {
    vec3 q = P - uPointPos[i];
    float r2 = dot(q, q);
    e += uPointColor[i] / (1.0 + r2 / (uPointRange[i] * uPointRange[i] * 0.05));
  }
  return e;
}

// Diffuse and specular from the local lights on a surface.
void localLight(vec3 P, vec3 n, vec3 V, float specPow, out vec3 diff, out vec3 spec) {
  diff = vec3(0.0);
  spec = vec3(0.0);
  vec3 d = P - uSpotPos;
  float L = length(d);
  vec3 l = -d / max(L, 1e-3);
  float cone = smoothstep(uSpotCone.y, uSpotCone.x, dot(-l, uSpotDir));
  vec3 e = uSpotColor * cone / (1.0 + L * L / (uSpotRange * uSpotRange * 0.08)) * step(L, uSpotRange);
  diff += e * max(dot(n, l), 0.0);
  vec3 h = normalize(l + V);
  spec += e * pow(max(dot(n, h), 0.0), specPow) * (specPow + 8.0) / 25.13;
  for (int i = 0; i < 2; i++) {
    vec3 q = uPointPos[i] - P;
    float r = length(q);
    vec3 pl = q / max(r, 1e-3);
    vec3 pe = uPointColor[i] / (1.0 + r * r / (uPointRange[i] * uPointRange[i] * 0.05));
    diff += pe * max(dot(n, pl), 0.0);
    vec3 ph = normalize(pl + V);
    spec += pe * pow(max(dot(n, ph), 0.0), specPow) * (specPow + 8.0) / 25.13;
  }
}
`;
