// Hull paint and weathering, computed per pixel in the shader (no textures,
// so nothing pixelates up close):
//   paint bands by height (antifouling, boot-top, topsides, sheer stripe
//   following the sheer line), anti-aliased with screen derivatives;
//   a weed-stained scum band at the waterline that breaks up along the
//   length; dirt runs from the deck edge; paint blotches; roughness that
//   varies across the paint (chalky patches, slick near the water, matte
//   antifouling).

import * as THREE from 'three';

const NOISE = /* glsl */ `
varying vec3 vHullPos;
float gHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float gNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x),
                 mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x),
                 mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float gFbm(vec3 p) {
  return gNoise(p) * 0.5 + gNoise(p * 2.1) * 0.3 + gNoise(p * 4.3) * 0.2;
}
`;

function vec3(hex) {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

const f = (x) => x.toFixed(4);

let counter = 0;

// hull: HullShape params (for the sheer line). paint: { bottom, boot, top,
// sheer (hex colours), bootY: [y0, y1] (m above DWL), stripe (m below the
// sheer, 0 = none), grime (0..1), band (scum height, m) }.
export function addHullPaint(material, hull, paint) {
  const p = { stripe: 0.12, grime: 1, band: 0.32, ...paint };
  const key = `hullPaint${counter++}`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHullPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHullPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  vec3 hp = vHullPos;
  float s01 = clamp(hp.z / ${f(hull.length)} + 0.5, 0.0, 1.0);
  float deckY = ${f(hull.freeboard)} + ${f(hull.sheerRise)} * s01 * s01;
  float aa = max(fwidth(hp.y) * 0.75, 0.002);
  // Boot-top follows a slight sheer of its own (higher at the bow).
  float lift = 0.06 * s01 * s01;
  vec3 paint = ${vec3(p.bottom)};
  paint = mix(paint, ${vec3(p.boot)}, smoothstep(-aa, aa, hp.y - ${f(p.bootY[0])} - lift));
  paint = mix(paint, ${vec3(p.top)}, smoothstep(-aa, aa, hp.y - ${f(p.bootY[1])} - lift));
  ${p.stripe > 0 ? `paint = mix(paint, ${vec3(p.sheer)}, smoothstep(-aa, aa, hp.y - (deckY - ${f(p.stripe)})));` : ''}
  float below = 1.0 - smoothstep(-aa, aa, hp.y - ${f(p.bootY[0])} - lift);
  diffuseColor.rgb = paint;
  float wave = gFbm(vec3(hp.z * 0.9, 0.0, hp.x * 0.5)) - 0.5;
  float above = hp.y - wave * 0.12;
  float grime = smoothstep(${f(p.band)}, -0.02, above) * step(-0.06, above);
  grime *= (0.55 + 0.6 * gFbm(hp * vec3(3.1, 7.0, 1.3))) * ${f(p.grime)};
  vec3 scum = vec3(0.34, 0.33, 0.24);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * scum * 1.6, clamp(grime, 0.0, 1.0) * 0.75);
  float run = gNoise(vec3(hp.z * 7.0, 0.0, sign(hp.x) * 11.0));
  run = smoothstep(0.72, 0.95, run) * smoothstep(0.1, deckY - 0.1, hp.y) * ${f(p.grime)};
  run *= 0.5 + 0.5 * gNoise(vec3(hp.z * 7.0, hp.y * 1.6, 3.0));
  diffuseColor.rgb *= 1.0 - run * vec3(0.18, 0.24, 0.3);
  float blotch = gFbm(hp * 1.7 + 4.0);
  diffuseColor.rgb *= 0.94 + 0.08 * blotch;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor * (0.8 + 0.45 * blotch) + grime * 0.35 + run * 0.15 + below * 0.4
    - smoothstep(0.35, 0.0, hp.y) * 0.1, 0.06, 1.0);`,
      );
  };
  material.customProgramCacheKey = () => key;
  return material;
}

// Glossy gelcoat hull material with the paint shader.
export function hullMaterial(hull, paint) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.34,
    metalness: 0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.9,
  });
  return addHullPaint(m, hull, paint);
}
