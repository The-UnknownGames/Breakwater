// Ocean shading: Gerstner displacement (shared with physics), per-pixel
// analytic normals, detail ripples, Fresnel sky reflection, subsurface
// scatter on backlit crests, sun glitter, Jacobian crest foam, height fog.
// Output is linear HDR; tone mapping happens in the OutputPass.

import * as THREE from 'three';
import { MAX_WAVES } from './Waves.js';
import { WAVE_GLSL } from './waveGLSL.js';
import { BOAT_WAVE_GLSL } from './boatWaveGLSL.js';
import { FOG_GLSL, fogUniforms } from '../render/fogGLSL.js';
import { LOCAL_LIGHTS_GLSL, localLightUniforms } from '../render/localLights.js';
import { WORLD } from '../config/palette.js';
import { OCEAN } from '../config/render.js';

const vertexShader = /* glsl */ `
${WAVE_GLSL}
${BOAT_WAVE_GLSL}
attribute float cell;
uniform vec2 uOrigin;
uniform sampler2D uFoamMap;
uniform vec2 uFoamCenter;
uniform float uFoamExtent;
varying vec3 vWorld;
varying vec2 vP0;
varying float vCell;

void main() {
  vec2 p0 = position.xz + uOrigin;
  vec3 d = gerstnerDisplace(p0, cell);
  // Waves made by boats: the player's hull (analytic) and every wake's
  // divergent Kelvin crests (foam map alpha).
  vec2 fuv = (p0 - uFoamCenter) / uFoamExtent + 0.5;
  vec2 fe = smoothstep(0.0, 0.08, fuv) * smoothstep(1.0, 0.92, fuv);
  // Features are blurred to the local cell size so coarse vertices don't
  // pop; thin crest ridges go to the vertices only where the grid resolves
  // them (the fragment pass shades them everywhere).
  float ridgeLod = smoothstep(1.0, 0.45, cell);
  d.y += boatWaveHeight(p0, 0.8 * cell) + texture2D(uFoamMap, fuv).a * fe.x * fe.y * ridgeLod;
  vWorld = d;
  vP0 = p0;
  vCell = cell;
  gl_Position = projectionMatrix * viewMatrix * vec4(d, 1.0);
}
`;

const fragmentShader = /* glsl */ `
${WAVE_GLSL}
${BOAT_WAVE_GLSL}
${FOG_GLSL}
${LOCAL_LIGHTS_GLSL}
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uSSS;
uniform vec3 uFoamColor;
uniform samplerCube uEnv;
uniform sampler2D uRipple;
uniform sampler2D uFoamTex;
uniform float uTime;
uniform float uDetailStrength;
uniform float uFoamThreshold;
uniform float uClarity;
uniform vec3 uScatter;
uniform float uMaxAmp;
uniform float uSpecPow;
uniform float uRoughPow;
uniform float uDetailScaleA;
uniform float uDetailScaleB;
uniform vec2 uWindDir;
uniform float uWindSpeed;
uniform sampler2D uFoamMap;
uniform float uFoamSize;

// Cubic B-spline filtered lookup from 4 bilinear taps: on the Low preset a
// foam texel is ~0.8 m, and plain bilinear shows its diamond/stair-step
// grid along the wake edges.
vec3 foamMapSmooth(vec2 uv) {
  vec2 st = uv * uFoamSize - 0.5;
  vec2 i = floor(st);
  vec2 f = st - i;
  vec2 f2 = f * f;
  vec2 f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1;
  vec2 g1 = w2 + w3;
  vec2 h0 = (i - 1.0 + w1 / g0 + 0.5) / uFoamSize;
  vec2 h1 = (i + 1.0 + w3 / g1 + 0.5) / uFoamSize;
  return g0.y * (g0.x * texture2D(uFoamMap, h0).rgb + g1.x * texture2D(uFoamMap, vec2(h1.x, h0.y)).rgb)
    + g1.y * (g0.x * texture2D(uFoamMap, vec2(h0.x, h1.y)).rgb + g1.x * texture2D(uFoamMap, h1).rgb);
}
uniform sampler2D uDepthMap;
uniform float uDepthHalf;
uniform float uDepthMax;
uniform vec3 uShallow;
uniform vec2 uFoamCenter;
uniform float uFoamExtent;
varying vec3 vWorld;
varying vec2 vP0;
varying float vCell;
uniform sampler2D uBubbles;

// Froth from the Worley texture: two scales, the coarse one drifting.
// Past ~0.2 m per pixel the bubbles would alias, so fade to the mean.
float foamFroth(vec2 p, float cover, float footprint) {
  // Two-level domain warp so the cells read as clumped froth with no
  // visible lattice, even from straight above.
  vec2 w1 = texture2D(uFoamTex, p / 29.0).xy - 0.5;
  p += w1 * 7.0;
  p += (texture2D(uFoamTex, p / 7.3).xy - 0.5) * 2.2;
  mat2 r1 = mat2(0.83, -0.56, 0.56, 0.83);
  vec4 a = texture2D(uBubbles, p / 6.1);
  vec4 b = texture2D(uBubbles, r1 * p / 15.3 + vec2(0.37, 0.61));
  vec4 c = texture2D(uBubbles, r1 * r1 * p / 2.7 + vec2(0.13, 0.29));
  float field = a.r * 0.5 + b.b * 0.3 + c.b * 0.2;
  // Patchy threshold: foam gathers in clumps and thins between them.
  float clump = texture2D(uFoamTex, p / 11.0 + 0.5).a - 0.5;
  float edge = 1.0 - cover + clump * 0.35 * (1.0 - cover);
  float solid = smoothstep(edge - 0.06, edge + 0.06, field);
  float lace = max(a.g, max(b.g, c.a) * 0.8) * smoothstep(0.02, 0.35, cover) * (1.0 - solid);
  float froth = clamp(solid + lace * 0.7, 0.0, 1.0);
  float far = smoothstep(0.12, 0.6, footprint);
  return mix(froth, cover, far);
}

// Wake foam: churned white water that is foam, not paint. Three layers so
// it never breaks into isolated dots at any coverage:
//   film  - a thin milky sheet over the whole band (continuity)
//   froth - Worley bubbles with a soft threshold, clumped along the band
//   lace  - connected bubble-wall network where it thins and ages
// Coverage is broken into clumps by drifting low-frequency noise so the band
// has turbulent structure rather than clean edges.
float wakeFoam(vec2 p, float c, float footprint) {
  vec2 w1 = texture2D(uFoamTex, p / 17.0 + uTime * 0.006).xy - 0.5;
  p += w1 * 5.0;
  p += (texture2D(uFoamTex, p / 5.3).xy - 0.5) * 1.6;
  float clumps = texture2D(uFoamTex, p / 13.0 - uTime * 0.01).a;
  float cc = clamp(c * (0.6 + 0.8 * clumps), 0.0, 1.0);
  mat2 r1 = mat2(0.83, -0.56, 0.56, 0.83);
  vec4 a = texture2D(uBubbles, p / 5.1);
  vec4 b = texture2D(uBubbles, r1 * p / 11.7 + vec2(0.37, 0.61));
  vec4 f = texture2D(uBubbles, r1 * r1 * p / 2.2 + vec2(0.13, 0.29));
  float field = a.r * 0.5 + b.b * 0.3 + f.b * 0.2;
  float edge = 1.0 - cc * 1.15;
  float froth = smoothstep(edge - 0.16, edge + 0.16, field);
  float lace = max(a.g, max(b.g * 0.9, f.a * 0.7));
  float laceAmt = smoothstep(0.02, 0.35, c) * (1.0 - froth) * 0.6;
  float film = c * (0.3 + 0.2 * clumps);
  float foam = max(film, froth * (0.55 + 0.45 * cc)) + lace * laceAmt;
  float far = smoothstep(0.12, 0.6, footprint);
  return clamp(mix(foam, c * 0.85, far), 0.0, 1.0);
}

void main() {
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float footprint = length(fwidth(vP0));
  float cell = max(footprint * 1.5, 0.02);
  float h;
  vec4 nj = gerstnerNormal(vP0, cell, h);
  vec3 n = nj.xyz;

  // Detail ripples: two scrolling layers, stronger with wind, faded by distance.
  vec2 wd = uWindDir;
  vec2 uvA = vWorld.xz / uDetailScaleA - wd * uTime * 0.045;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  vec2 uvB = (rot * vWorld.xz) / uDetailScaleB - (rot * wd) * uTime * 0.09;
  vec3 rA = texture2D(uRipple, uvA).xyz * 2.0 - 1.0;
  vec3 rB = texture2D(uRipple, uvB).xyz * 2.0 - 1.0;
  vec2 slopeB = transpose(rot) * rB.xy;
  float near = exp(-dist / 220.0);
  float patchy = texture2D(uFoamTex, vWorld.xz / 420.0 + wd * uTime * 0.004).a;
  float modA = 0.45 + 1.1 * patchy;
  vec2 slope = (rA.xy * 0.6 * modA + slopeB * 0.5 * near * (1.5 - patchy)) * uDetailStrength;
  // Dynamic foam map (wakes, contact, slams in R/B; hull footprint in G).
  // Look the map up through a small turbulent warp (~2 m): wake edges go
  // ragged and billowy instead of ruler-straight bands.
  // The warp and churn only run where the map has foam (cheap elsewhere).
  vec2 fuv = (vWorld.xz - uFoamCenter) / uFoamExtent + 0.5;
  vec2 fe = smoothstep(0.0, 0.08, fuv) * smoothstep(1.0, 0.92, fuv);
  vec3 dynT = foamMapSmooth(fuv);
  if (dynT.r + dynT.b > 0.004) {
    vec2 fw = (texture2D(uFoamTex, vWorld.xz / 21.0 + uTime * 0.012).xy - 0.5) * 3.2
      + (texture2D(uFoamTex, vWorld.xz / 6.5 - uTime * 0.02).xy - 0.5) * 1.1;
    dynT = foamMapSmooth(fuv + fw / uFoamExtent);
  }
  float dyn = (dynT.r + dynT.b) * fe.x * fe.y;
  // Churned water in the wake: short, steep, disordered ripples break up
  // the reflection (a wake reads by its texture as much as its foam).
  float churn = clamp(1.0 - exp(-dyn * 1.5), 0.0, 1.0) * near;
  // Boat-made waves shade per pixel even where the grid is too coarse to
  // show them (the vertex pass carries the same heights).
  vec2 wakeSlope = boatWaveSlope(vWorld.xz, 0.3);
  float tx = 1.0 / uFoamSize;
  float hmx = texture2D(uFoamMap, fuv + vec2(tx, 0.0)).a - texture2D(uFoamMap, fuv - vec2(tx, 0.0)).a;
  float hmz = texture2D(uFoamMap, fuv + vec2(0.0, tx)).a - texture2D(uFoamMap, fuv - vec2(0.0, tx)).a;
  wakeSlope += vec2(hmx, hmz) * fe.x * fe.y / (2.0 * tx * uFoamExtent);
  slope -= wakeSlope;
  if (churn > 0.01) {
    vec3 rC = texture2D(uRipple, vWorld.xz / (uDetailScaleB * 0.35) + vec2(uTime * 0.07, -uTime * 0.05)).xyz * 2.0 - 1.0;
    vec3 rD = texture2D(uRipple, (rot * vWorld.xz) / (uDetailScaleB * 0.6) - vec2(uTime * 0.04, uTime * 0.06)).xyz * 2.0 - 1.0;
    slope += (rC.xy * 0.9 + rD.xy * 0.6) * churn;
  }
  n = normalize(n + vec3(slope.x, 0.0, slope.y));
  // Distant water gets rougher, not mirror-flat, as detail mip-maps away.
  float far = 1.0 - exp(-dist / 900.0);

  float NdV = clamp(dot(n, V), 0.0, 1.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
  fresnel = mix(fresnel, fresnel * 0.75, far);
  vec3 R = reflect(-V, n);
  R.y = abs(R.y) + 0.01;
  vec3 refl = textureCube(uEnv, normalize(R)).rgb;

  // Water body: deep -> mid by crest height, lit by sky and sun.
  float crest = clamp(h / max(uMaxAmp, 0.05) * 0.5 + 0.5, 0.0, 1.0);
  float sunUp = max(uSunDir.y, 0.0);
  vec3 light = uSkyColor + uSunColor * sunUp * 0.4;
  vec3 body = mix(uDeep, uMid, 0.2 + 0.5 * crest) * light;
  // Upwelling light: in clear water sunlight scatters back up out of the
  // depths, so fair-weather water seen from above glows deep blue-turquoise
  // (strongest looking straight down); murky storm water stays grey-green.
  float lookDown = clamp(dot(n, V), 0.0, 1.0);
  vec3 upwell = uScatter * (uSunColor * sunUp * 0.55 + uSkyColor * 0.7) * (0.35 + 0.65 * lookDown);
  body = mix(body, body * 0.45 + upwell * (0.8 + crest * 0.5), uClarity);
  // Shallows (baked seabed depth): lighter green-turquoise over sand/rock.
  vec4 dm = texture2D(uDepthMap, vWorld.xz / (2.0 * uDepthHalf) + 0.5);
  float seaDepth = dm.r * uDepthMax;
  float shallow = smoothstep(16.0, 1.0, seaDepth);
  body = mix(body, uShallow * light * (0.55 + 0.6 * uClarity), shallow * 0.6);

  // Subsurface scatter: crests glow when the camera looks toward a low sun.
  vec3 viewH = normalize(vec3(-V.x, 0.0, -V.z) + 1e-4);
  vec3 sunH = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-4);
  float toward = pow(clamp(dot(viewH, sunH), 0.0, 1.0), 3.0);
  float thin = pow(crest, 2.5) * (1.0 - far);
  float lowSun = 1.0 - smoothstep(0.1, 0.8, uSunDir.y) * 0.6;
  vec3 sss = uSSS * (uSunColor * toward * lowSun * 0.9 + uSkyColor * 0.25) * thin;

  // Sun: tight glitter lobe + a broader wind-roughened sheen.
  vec3 Hv = normalize(uSunDir + V);
  float NdH = max(dot(n, Hv), 0.0);
  float p1 = uSpecPow * mix(1.0, 0.25, far);
  float spec = (p1 + 8.0) / 25.13 * pow(NdH, p1);
  spec += (uRoughPow + 8.0) / 25.13 * pow(NdH, uRoughPow) * 0.06;
  float sunFres = 0.02 + 0.98 * pow(1.0 - max(dot(Hv, V), 0.0), 5.0);
  vec3 specCol = uSunColor * spec * sunFres * step(0.0, uSunDir.y);

  vec3 col = mix(body + sss, refl, fresnel) + specCol;
  // Searchlight and flares: a lit patch on the water with its own glitter.
  vec3 lDiff;
  vec3 lSpec;
  localLight(vWorld, n, V, 90.0, lDiff, lSpec);
  col += lDiff * (uMid * 0.9 + uSSS * 0.6 + 0.02) + lSpec * 0.35;

  // Crest foam where the Gerstner surface compresses (Jacobian < threshold).
  // cover is the fraction of the surface under foam; the Worley bubble
  // texture turns it into froth: dense foam with dark holes, thinning into
  // a lace of bubble walls.
  float jac = nj.w;
  float thr = uFoamThreshold;
  float cover = smoothstep(thr, thr - 0.22, jac) * step(0.01, thr);
  // Heavy seas: high crests break and carry whitewater.
  float heavy = smoothstep(0.7, 0.88, thr);
  cover = max(cover, smoothstep(0.62, 0.9, crest) * heavy * 0.8);
  vec2 warp = (texture2D(uFoamTex, vWorld.xz / 57.0).xy - 0.5) * 0.8;
  vec2 streakUv = vec2(dot(vWorld.xz, wd) / 41.0, dot(vWorld.xz, vec2(-wd.y, wd.x)) / 6.7) + warp;
  float breakB = texture2D(uFoamTex, streakUv + vec2(uTime * 0.01, 0.0)).a;
  float streak = smoothstep(0.62, 0.92, breakB) * smoothstep(0.75, 0.9, thr) * 0.45 * smoothstep(0.3, 0.7, patchy);
  float breakA = texture2D(uFoamTex, vWorld.xz / 23.0 + wd * uTime * 0.01).a;
  cover = clamp(cover * (0.55 + 0.7 * breakA) + streak * (0.4 + crest), 0.0, 1.0);
  // Surf: breaking lines running in over the shallows at the shore.
  float surfBand = smoothstep(3.5, 0.3, seaDepth);
  float surfWave = 0.5 + 0.5 * sin(seaDepth * 2.4 - uTime * 1.7 + breakA * 5.0);
  cover = max(cover, surfBand * (0.35 + 0.55 * surfWave) * (0.55 + min(uMaxAmp, 2.5) * 0.3));
  // Dynamic foam: wakes, hull contact, slams (R), hull footprint (G).
  float hullShade = clamp(dynT.g, 0.0, 1.0);
  // Fresh wake is white; as it ages (the map fades) it opens into lace.
  float dynCover = (1.0 - exp(-dyn * 1.0)) * 0.84;
  // The bow wave breaks white along its crest.
  if (uBoatHull.w > 0.05) {
    float bw = boatWaveHeight(vWorld.xz, 0.0) / uBoatHull.w;
    dynCover = max(dynCover, smoothstep(0.3, 0.85, bw) * 0.75 * smoothstep(0.1, 0.35, uBoatHull.w));
  }
  // Churned water under the froth is full of bubbles: pale turquoise.
  float aer = clamp(1.0 - exp(-dyn * 0.6), 0.0, 1.0);
  vec3 aerated = (uSSS * 1.9 + uMid * 0.8) * light + uSkyColor * 0.12;
  col = mix(col, aerated, aer * 0.55 * (1.0 - hullShade));
  // Crest foam and wake foam are separate: the crest threshold on a thin wake
  // band leaves isolated bubbles (dots); wakeFoam() keeps it continuous.
  float foam = foamFroth(vWorld.xz + wd * uTime * 0.12, cover, footprint);
  if (dynCover > 0.002) {
    foam = max(foam, wakeFoam(vWorld.xz + wd * uTime * 0.05, dynCover, footprint));
  }
  cover = max(cover, dynCover);
  // Water against the hull: shaded by it and reflecting it, not the sky.
  col = mix(col, body * 0.6, hullShade * 0.55);
  vec3 foamLit = uFoamColor * (uSkyColor * 0.9 + uSunColor * sunUp * 0.7 + lDiff * 0.8);
  // Thick fresh foam is brighter; thin, ageing foam is translucent grey.
  col = mix(col, foamLit * (0.72 + 0.28 * cover), foam * (0.55 + 0.4 * cover));

  // Guard: half-float targets overflow to Inf, which post passes smear.
  col = min(applyFog(col, vWorld), vec3(256.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

function vec4Array() {
  return Array.from({ length: MAX_WAVES }, () => new THREE.Vector4());
}

// Until a world is loaded, the seabed is uniformly deep.
function deepDefault() {
  const t = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

export function createOceanMaterial(detailMaps) {
  const uniforms = {
    ...fogUniforms,
    ...localLightUniforms,
    uWaveA: { value: vec4Array() },
    uWaveB: { value: vec4Array() },
    uWaveTau: { value: 0 },
    uShelter: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 1, 0)) },
    uOrigin: { value: new THREE.Vector2() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uSkyColor: { value: new THREE.Color(0.5, 0.5, 0.5) },
    uDeep: { value: new THREE.Color(WORLD.deepWater) },
    uMid: { value: new THREE.Color(WORLD.midWater) },
    uSSS: { value: new THREE.Color(WORLD.subsurface) },
    uFoamColor: { value: new THREE.Color(WORLD.foam) },
    uEnv: { value: null },
    uRipple: { value: detailMaps.ripple },
    uFoamTex: { value: detailMaps.foam },
    uBubbles: { value: detailMaps.bubbles },
    uTime: { value: 0 },
    uDetailStrength: { value: OCEAN.detailStrengthCalm },
    uFoamThreshold: { value: 0 },
    uClarity: { value: 0.5 },
    uScatter: { value: new THREE.Color(WORLD.clearWater) },
    uMaxAmp: { value: 1 },
    uSpecPow: { value: OCEAN.sunSpecPower },
    uRoughPow: { value: OCEAN.roughSpecPower },
    uDetailScaleA: { value: OCEAN.detailScaleA },
    uDetailScaleB: { value: OCEAN.detailScaleB },
    uWindDir: { value: new THREE.Vector2(1, 0) },
    uWindSpeed: { value: 5 },
    uFoamMap: { value: null },
    uFoamSize: { value: 512 },
    uBoat: { value: new THREE.Vector4(0, 0, 0, 1) },
    uBoatHull: { value: new THREE.Vector4(12, 4, 0, 0) },
    uDepthMap: { value: deepDefault() },
    uDepthHalf: { value: 3600 },
    uDepthMax: { value: 40 },
    uShallow: { value: new THREE.Color(WORLD.shallowWater) },
    uFoamCenter: { value: new THREE.Vector2() },
    uFoamExtent: { value: 200 },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
  });
}
