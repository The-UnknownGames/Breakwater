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
  maxStamps: 3000,
  wakeStrength: 1.7,
  bowStrength: 0.8,
  contactStrength: 0.35,
  slamStrength: 2.2,
};

export const WAKE = {
  maxParticles: 2400,
  spacing: 0.8, // metres travelled between emissions
  drag: 0.12, // outward drift decay (1/s)
  centreLife: 16,
  centreGrow: 0.28, // m/s radius growth (turbulent wake widening)
  centreStrength: 1.7,
  quarterLife: 11,
  quarterStrength: 0.9,
  kelvinLife: 8,
  kelvinStrength: 0.75,
};

// Wind-torn spray off breaking crests around the camera (gale/storm haze).
export const SPINDRIFT = {
  minWindKn: 20,
  ratePerKn: 3, // puffs per second per knot above minWindKn
  radius: [10, 90], // metres from the camera
  size: [4, 11],
  life: 4.5,
};

export const SPRAY = {
  maxParticles: 4600,
  bowRatePerKn: 14, // particles/s per knot of speed at the bow
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
