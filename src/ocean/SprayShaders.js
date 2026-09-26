// Spray sprite shaders. The atlas stores a normal (RGB) and coverage (A)
// per texel, so every puff and drop is lit as a 3D shape: mist billows get a
// sunlit side, a shaded underside and a glowing backlit rim (forward
// scattering, Henyey-Greenstein); droplets are little lenses with a sun
// glint. Mist also dissolves into wisps as it ages (noise-thresholded) and
// carries fine detail from a tiling noise, so large puffs stay crisp.

import { FOG_GLSL } from '../render/fogGLSL.js';

export const sprayVertex = /* glsl */ `
attribute vec4 aPosSize;
attribute vec4 aVelAlpha;
attribute vec4 aMeta; // kind, atlas cell, rotation, life fraction (0 new .. 1 dead)
varying vec2 vUv;
varying vec2 vLocal;
varying float vAlpha;
varying float vKind;
varying float vAge;
varying float vSeed;
varying vec4 vFrame; // quad x axis, quad y axis (view space xy)
varying vec3 vWorld;
void main() {
  vec3 pos = aPosSize.xyz;
  float size = aPosSize.w;
  vec4 mv = viewMatrix * vec4(pos, 1.0);
  vec2 corner = position.xy;
  vec2 v = (viewMatrix * vec4(aVelAlpha.xyz, 0.0)).xy;
  float len = length(v);
  vec2 dir = v / max(len, 1e-3);
  dir = mix(vec2(0.0, 1.0), dir, step(1e-3, len));
  // Winding-preserving frame (a rotation, never a reflection).
  vec2 perp = vec2(dir.y, -dir.x);
  float isMist = step(0.5, aMeta.x);
  // Droplets: thin motion-blurred streaks along the screen velocity.
  float stretch = 1.0 + clamp(len * 0.35, 0.0, 9.0);
  vec2 dropOffset = perp * (corner.x * size * 0.6) + dir * (corner.y * size * stretch);
  // Mist: rotating billow, stretched a little along its motion.
  float c = cos(aMeta.z);
  float s = sin(aMeta.z);
  vec2 ax = vec2(c, s);
  vec2 ay = vec2(-s, c);
  vec2 mistOffset = (ax * corner.x + ay * corner.y) * size;
  mistOffset += dir * dot(mistOffset, dir) * min(len * 0.06, 1.4);
  mv.xy += mix(dropOffset, mistOffset, isMist);
  vFrame = mix(vec4(perp, dir), vec4(ax, ay), isMist);
  float cell = aMeta.y;
  float col = mod(cell, 2.0) + 2.0 * isMist;
  float row = floor(cell / 2.0);
  // Half-texel inset keeps neighbouring cells from bleeding in.
  vec2 cuv = clamp(corner + 0.5, 0.004, 0.996);
  vUv = vec2((col + cuv.x) / 4.0, (row + cuv.y) / 2.0);
  vLocal = cuv;
  float camFade = smoothstep(0.4, 3.0, -mv.z);
  float blur = mix(min(1.0, 1.5 * inversesqrt(stretch)), 1.0, isMist);
  vAlpha = aVelAlpha.w * camFade * blur;
  vKind = aMeta.x;
  vAge = aMeta.w;
  vSeed = fract(aMeta.z * 7.31 + cell * 0.37);
  vWorld = pos;
  gl_Position = projectionMatrix * mv;
}
`;

export const sprayFragment = /* glsl */ `
${FOG_GLSL}
uniform sampler2D uAtlas;
uniform sampler2D uNoise;
uniform vec3 uSky;
uniform vec3 uSun;
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec2 vLocal;
varying float vAlpha;
varying float vKind;
varying float vAge;
varying float vSeed;
varying vec4 vFrame;
varying vec3 vWorld;

float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5));
}

void main() {
  vec4 t = texture2D(uAtlas, vUv);
  float mist = step(0.5, vKind);
  float cover = t.a;
  if (mist > 0.5) {
    // Fine wisps + age dissolve: the billow erodes from its thin parts.
    float n1 = texture2D(uNoise, vLocal * 1.7 + vSeed * 3.1).r;
    float n2 = texture2D(uNoise, vLocal * 4.3 + vSeed * 5.7 + vAge * 0.15).r;
    float detail = n1 * 0.6 + n2 * 0.4;
    cover *= 0.55 + 0.9 * detail;
    float cut = vAge * vAge * 0.75;
    cover *= smoothstep(cut, cut + 0.25, detail * 0.5 + t.a * 0.5);
  }
  float a = clamp(cover, 0.0, 1.0) * vAlpha;
  if (a < 0.004) discard;
  // Normal from the atlas, taken from the quad frame into view space.
  vec3 nq = t.rgb * 2.0 - 1.0;
  vec3 nv = normalize(vec3(nq.x * vFrame.xy + nq.y * vFrame.zw, max(nq.z, 0.05)));
  vec3 L = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec3 view = normalize(vWorld - cameraPosition);
  float phase = hg(dot(view, uSunDir), 0.6) * 5.0;
  vec3 col;
  if (mist > 0.5) {
    float wrap = clamp(dot(nv, L) * 0.6 + 0.4, 0.0, 1.0);
    float skyLit = 0.62 + 0.38 * dot(nv, up);
    float thin = 1.0 - clamp(cover, 0.0, 1.0);
    col = uSky * skyLit * 1.1 + uSun * (wrap * 0.5 + phase * (0.12 + 0.5 * thin));
  } else {
    // Water drop: sky-lit body, forward-scattered sun, sharp glint.
    vec3 r = reflect(-L, nv);
    float glint = pow(max(r.z, 0.0), 28.0);
    col = uSky * (1.05 + 0.2 * nv.y) + uSun * (phase * 0.4 + glint * 2.5);
  }
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, a);
}
`;
