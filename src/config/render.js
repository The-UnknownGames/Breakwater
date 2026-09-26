// Rendering / atmosphere tuning numbers.

export const DAY = {
  realMinutesPerDay: 24,
  startHour: 11.5,
  latitudeDeg: 44.5,
  declinationDeg: 12,
  // Sun elevation (deg) where golden light blends to white daylight.
  goldenEndDeg: 14,
  // Civil-twilight floor: below this elevation the sun contributes nothing.
  twilightDeg: -7,
};

export const LIGHT = {
  sunIntensity: 3.2,
  moonIntensity: 0.1,
  skyAmbientDay: 0.9,
  skyAmbientNight: 0.085,
  // Simple camera auto-exposure: exposure = base * sqrt(ref / sceneLum),
  // clamped. Storm days brighten like a real camera; nights stay dark.
  exposureBase: 0.85,
  exposureRefLum: 0.9,
  exposureMaxDay: 2.6,
  exposureMaxNight: 2.2,
  fogBrightClear: 1.7,
  exposureAdaptSeconds: 1.5,
  flashAmbient: 0.12,
  goldenSkyTint: 0.45,
  lightningIntensity: 6,
};

export const OCEAN = {
  meshRadius: 14000,
  innerCell: 0.3,
  snapCells: 4,
  detailScaleA: 17,
  detailScaleB: 5.3,
  detailStrengthCalm: 0.22,
  detailStrengthStorm: 0.55,
  sunSpecPower: 900,
  roughSpecPower: 70,
};

export const FOAM = {
  resolution: 512,
  extent: 200, // metres covered around the player
  fadeSeconds: 12,
  spreadRate: 0.5, // foam diffusion per second (fraction toward the neighbour mean)
  maxStamps: 1500,
  maxRibbons: 3000,
  wakeStrength: 1.7,
  bowStrength: 0.8,
  contactStrength: 0.35,
  slamStrength: 2.2,
};

export const WAKE = {
  streamCap: 700, // particles per trail
  spacing: 0.8, // metres travelled between emissions
  drag: 0.12, // outward drift decay (1/s)
  centreLife: 18,
  centreGrow: 0.3, // m/s radius growth (turbulent wake widening)
  centreStrength: 1.5, // foam coverage at the transom (ribbons are MAX blended)
  quarterLife: 12,
  quarterStrength: 0.75, // the quarter streaks merge into the centre wash
  quarterDrift: 0.05, // outward drift as a fraction of boat speed
  kelvinLife: 9,
  kelvinStrength: 1.3,
  // Kelvin arm crest spacing (m): crestPerMs x speed, clamped.
  crestPerMs: 1.1,
  crestMin: 5,
  crestMax: 16,
  // Divergent crest height: head u²/2g x crestHeadK, capped per metre of beam.
  crestHeadK: 0.12,
  crestHeightPerBeam: 0.07,
  // Hull waves (ocean/boatWaveGLSL.js): bow-wave height from the stagnation
  // head u²/2g x bowHeadK, capped per metre of beam.
  bowHeadK: 0.45,
  bowHeightPerBeam: 0.13,
};

// Wind-torn spray off breaking crests around the camera (gale/storm haze).
export const SPINDRIFT = {
  minWindKn: 24,
  ratePerKn: 1.2, // wisps per second per knot above minWindKn
  radius: [14, 80], // metres from the camera
  size: [1.5, 3.5],
  life: 2.2,
  alpha: 0.14,
};

export const SPRAY = {
  mistDrag: 2.2, // 1/s: mist loses its launch speed quickly
  mistWindCarry: 0.3, // fraction of wind speed mist drifts at
  mistFall: 2.4, // m/s² settling (was 0.6: it hung like smoke)
  mistGrow: 0.5, // m/s puff growth (+8% of the launch size)
  maxParticles: 4600,
  bowRatePerKn: 26, // particles/s per knot of speed at the bow
  slamParticlesPerMs: 45, // burst size per m/s of slam speed
  propWashRate: 50,
  size: 0.55,
  life: 1.6,
  airDrag: 0.9,
};

export const FOG = {
  // Koschmieder: extinction = 3.912 / visibility (2% contrast threshold).
  koschmieder: 3.912,
  heightFalloff: 0.004,
};

export const SKY = {
  cloudRadius: 15000,
  envRefreshSeconds: 2,
  cloudWindScale: 0.9,
  preethamScale: 0.3,
  rayleigh: 1.8,
  // Aerial perspective scale height used for the sky dome haze (m).
  hazeScaleHeight: 120,
};

export const POST = {
  bloomThreshold: 2.4,
  bloomStrength: 0.35,
  bloomRadius: 0.4,
  vignette: 0.28,
};
