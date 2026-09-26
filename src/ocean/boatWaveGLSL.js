// Waves made by the player's hull (visual only; physics floats on the
// undisturbed sea). In the boat frame (s forward from midships, t to the
// side) a moving hull piles water on its bow shoulders, draws it down along
// the sides, leaves a trough behind the transom and a quarter-wave rise, and
// trails transverse Kelvin waves inside the 19.5° wedge. Divergent crests
// come from the wake particles (foam map alpha, see Wake.js).
// Height scale: the bow's stagnation head u²/2g, capped by the beam.

export const BOAT_WAVE_GLSL = /* glsl */ `
uniform vec4 uBoat;      // x, z, forward x, forward z
uniform vec4 uBoatHull;  // length, beam, speed (m/s), bow-wave height (m)

float g2(float x, float s) {
  float q = x / s;
  return exp(-q * q);
}

float boatWaveHeight(vec2 p) {
  float Hb = uBoatHull.w;
  if (Hb < 0.005) {
    return 0.0;
  }
  float L = uBoatHull.x;
  float B = uBoatHull.y;
  vec2 d = p - uBoat.xy;
  if (dot(d, d) > 100.0 * L * L) {
    return 0.0;
  }
  vec2 f = uBoat.zw;
  float s = dot(d, f);
  float t = abs(f.x * d.y - f.y * d.x);
  // Bow wave on the shoulders, a small pressure hump ahead of the stem.
  float h = Hb * g2(s - 0.32 * L, 0.17 * L) * g2(t - 0.58 * B, 0.33 * B);
  h += 0.35 * Hb * g2(s - 0.56 * L, 0.08 * L) * g2(t, 0.45 * B);
  // Drawn down along the sides amidships.
  h -= 0.45 * Hb * g2(s + 0.05 * L, 0.24 * L) * g2(t - 0.6 * B, 0.45 * B);
  // Behind the transom: a trough, then the quarter-wave rise.
  float x = -s - 0.5 * L;
  float lane = g2(t, 0.75 * B + 0.12 * max(x, 0.0));
  h -= 0.55 * Hb * g2(x - 0.06 * L, 0.14 * L) * lane;
  h += 0.4 * Hb * g2(x - 0.42 * L, 0.2 * L) * g2(t - 0.55 * B - 0.1 * max(x, 0.0), 0.5 * B);
  // Transverse Kelvin waves inside the wedge (tan 19.5° = 0.354) behind
  // the bow, wavelength 2πu²/g, fading with distance.
  float xb = 0.5 * L - s;
  if (xb > 0.0) {
    float u = max(uBoatHull.z, 0.5);
    float k0 = 9.81 / (u * u);
    float wedge = smoothstep(0.36, 0.22, t / max(xb, 1e-3));
    h += 0.3 * Hb * cos(k0 * xb) * wedge * exp(-xb / (7.0 * L)) * smoothstep(0.2 * L, 1.0 * L, xb);
  }
  return h;
}

// Gradient by central differences (for per-pixel normals).
vec2 boatWaveSlope(vec2 p, float e) {
  if (uBoatHull.w < 0.005) {
    return vec2(0.0);
  }
  float hx = boatWaveHeight(p + vec2(e, 0.0)) - boatWaveHeight(p - vec2(e, 0.0));
  float hz = boatWaveHeight(p + vec2(0.0, e)) - boatWaveHeight(p - vec2(0.0, e));
  return vec2(hx, hz) / (2.0 * e);
}
`;
