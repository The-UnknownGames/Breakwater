// Weathering for painted hulls, added to a MeshStandardMaterial in the
// shader (no textures): a grimy, weed-stained band just above the waterline
// that breaks up along the length, rust/dirt runs streaking down from the
// deck edge, and roughness that varies across the paint (chalky patches,
// wetter and slicker near the water).

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

// deck: sheer height above the DWL (m), for the streak fade.
export function addHullGrime(material, { deck = 1.2, band = 0.32 } = {}) {
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
  float wave = gFbm(vec3(hp.z * 0.9, 0.0, hp.x * 0.5)) - 0.5;
  // Waterline band: brown-green scum, thickest right at the water.
  float above = hp.y - wave * 0.12;
  float grime = smoothstep(${band.toFixed(3)}, -0.02, above) * step(-0.06, above);
  grime *= 0.55 + 0.6 * gFbm(hp * vec3(3.1, 7.0, 1.3));
  vec3 scum = vec3(0.34, 0.33, 0.24);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * scum * 1.6, clamp(grime, 0.0, 1.0) * 0.75);
  // Runs from the deck edge: narrow along z, long downward.
  float run = gNoise(vec3(hp.z * 7.0, 0.0, sign(hp.x) * 11.0));
  run = smoothstep(0.72, 0.95, run) * smoothstep(0.1, ${(deck - 0.1).toFixed(3)}, hp.y);
  run *= 0.5 + 0.5 * gNoise(vec3(hp.z * 7.0, hp.y * 1.6, 3.0));
  diffuseColor.rgb *= 1.0 - run * vec3(0.18, 0.24, 0.3);
  float blotch = gFbm(hp * 1.7 + 4.0);
  diffuseColor.rgb *= 0.93 + 0.1 * blotch;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor * (0.75 + 0.55 * blotch) + grime * 0.35 + run * 0.15
    - smoothstep(0.35, 0.0, hp.y) * 0.12, 0.08, 1.0);`,
      );
  };
  material.customProgramCacheKey = () => 'hullGrime';
  return material;
}
