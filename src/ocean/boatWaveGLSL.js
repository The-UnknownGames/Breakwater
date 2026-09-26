// Waves made by the player's hull (visual only; physics floats on the
// undisturbed sea). In the boat frame (s forward from midships, t out from
// the centreline) the stem climbs its own bow wave, which peels off the
// bow as a crest running aft and outward; the water is drawn down along the
// sides behind it, falls into a trough behind the transom, rises again in
// the quarter waves, and trails transverse Kelvin waves inside the 19.5°
// wedge. Divergent crests further out come from the wake particles (foam
// map alpha, see Wake.js).
// `blur` (m) widens every feature for coarse vertex grids while keeping its
// volume, so sampling doesn't pop as the grid moves; per-pixel normals use 0.
// Height scale: the bow's stagnation head u²/2g, capped by the beam.

export const BOAT_WAVE_GLSL = /* glsl */ `
uniform vec4 uBoat;      // x, z, forward x, forward z
uniform vec4 uBoatHull;  // length, beam, speed (m/s), bow-wave height (m)

// Gaussian of width s, widened by blur b with its area kept.
float gb(float x, float s, float b) {
  float w2 = s * s + b * b;
  return sqrt(s * s / w2) * exp(-x * x / w2);
}

float boatWaveHeight(vec2 p, float blur) {
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
  float xb = 0.5 * L - s; // metres aft of the stem
  // Water piled against the stem.
  float h = 0.7 * Hb * gb(xb, 0.07 * L, blur) * gb(t, 0.3 * B, blur);
  // Bow wave: a crest peeling off the stem, running aft and outward
  // (~30° to the hull), growing then fading.
  float aft = max(xb, 0.0);
  float tc = 0.12 * B + 0.58 * aft;
  float env = smoothstep(-0.05 * L, 0.12 * L, xb) * exp(-aft / (0.55 * L));
  h += Hb * env * gb(t - tc, 0.05 * L + 0.12 * aft, blur);
  // Drawn down along the sides behind the bow crest.
  float side = gb(s + 0.08 * L, 0.26 * L, blur) * gb(t - 0.55 * B, 0.3 * B, blur);
  h -= 0.5 * Hb * side;
  // Behind the transom: a trough, then the quarter waves.
  float x = -s - 0.5 * L;
  float xa = max(x, 0.0);
  h -= 0.55 * Hb * gb(x - 0.04 * L, 0.13 * L, blur) * gb(t, 0.6 * B + 0.1 * xa, blur);
  h += 0.4 * Hb * gb(x - 0.4 * L, 0.2 * L, blur) * gb(t - 0.5 * B - 0.1 * xa, 0.45 * B, blur);
  // Transverse Kelvin waves inside the wedge (tan 19.5° = 0.354) behind
  // the bow, wavelength 2πu²/g, fading with distance.
  if (xb > 0.0) {
    float u = max(uBoatHull.z, 0.5);
    float k0 = 9.81 / (u * u);
    float wedge = smoothstep(0.36, 0.22, t / max(xb, 1e-3));
    float soft = exp(-0.5 * k0 * k0 * blur * blur);
    h += 0.3 * Hb * soft * cos(k0 * xb) * wedge * exp(-xb / (7.0 * L)) * smoothstep(0.2 * L, 1.0 * L, xb);
  }
  return h;
}

// Gradient by central differences (for per-pixel normals).
vec2 boatWaveSlope(vec2 p, float e) {
  if (uBoatHull.w < 0.005) {
    return vec2(0.0);
  }
  float hx = boatWaveHeight(p + vec2(e, 0.0), 0.0) - boatWaveHeight(p - vec2(e, 0.0), 0.0);
  float hz = boatWaveHeight(p + vec2(0.0, e), 0.0) - boatWaveHeight(p - vec2(0.0, e), 0.0);
  return vec2(hx, hz) / (2.0 * e);
}
`;
