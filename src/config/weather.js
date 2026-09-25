// Sea states (spec section 7). All weather-driven numbers live here.
// hs: significant wave height (m). visibility in metres. rain/lightning 0..1.
// lambdaMin/Max: Gerstner wavelength range (m). steepness: global Gerstner Q·k·A sum.
// cloudCover/cloudDark: sky layer. foam: crest foam where the Gerstner Jacobian
// drops below this value (1 = flat water; 0 disables crest foam).
// grade: colour grading (saturation, contrast) applied after tone mapping.
// clarity: how much sunlight comes back up out of the water (clear blue
// water in fair weather, opaque grey-green in a storm).

export const SEA_STATES = [
  {
    id: 'calm',
    name: 'Calm',
    windKn: 5,
    hs: 0.3,
    visibility: 8000,
    rain: 0,
    lightning: 0,
    callRate: 0.5,
    payout: 1.0,
    lambdaMin: 1.2,
    lambdaMax: 26,
    steepness: 0.35,
    cloudCover: 0.3,
    cloudDark: 0.0,
    foam: 0.0,
    turbidity: 3,
    saturation: 0.97,
    clarity: 1.0,
    contrast: 1.0,
  },
  {
    id: 'moderate',
    name: 'Moderate',
    windKn: 15,
    hs: 1.2,
    visibility: 5000,
    rain: 0.08,
    lightning: 0,
    callRate: 1.0,
    payout: 1.2,
    lambdaMin: 2.0,
    lambdaMax: 55,
    steepness: 0.5,
    cloudCover: 0.6,
    cloudDark: 0.15,
    foam: 0.68,
    turbidity: 5,
    saturation: 0.82,
    clarity: 0.75,
    contrast: 1.03,
  },
  {
    id: 'rough',
    name: 'Rough',
    windKn: 25,
    hs: 2.5,
    visibility: 2000,
    rain: 0.35,
    lightning: 0,
    callRate: 1.6,
    payout: 1.6,
    lambdaMin: 3.0,
    lambdaMax: 85,
    steepness: 0.62,
    cloudCover: 0.8,
    cloudDark: 0.35,
    foam: 0.8,
    turbidity: 7,
    saturation: 0.74,
    clarity: 0.45,
    contrast: 1.07,
  },
  {
    id: 'gale',
    name: 'Gale',
    windKn: 38,
    hs: 4.5,
    visibility: 800,
    rain: 0.7,
    lightning: 0.15,
    callRate: 2.4,
    payout: 2.2,
    lambdaMin: 4.0,
    lambdaMax: 125,
    steepness: 0.72,
    cloudCover: 0.95,
    cloudDark: 0.58,
    foam: 0.86,
    turbidity: 9,
    saturation: 0.66,
    clarity: 0.2,
    contrast: 1.12,
  },
  {
    id: 'storm',
    name: 'Storm',
    windKn: 50,
    hs: 7.0,
    visibility: 400,
    rain: 1.0,
    lightning: 1.0,
    callRate: 3.4,
    payout: 3.0,
    lambdaMin: 5.0,
    lambdaMax: 170,
    steepness: 0.8,
    cloudCover: 1.0,
    cloudDark: 0.78,
    foam: 0.9,
    turbidity: 10,
    saturation: 0.58,
    clarity: 0.08,
    contrast: 1.16,
  },
];

// Keys interpolated linearly during a transition; lambda keys use log interpolation.
export const LERP_KEYS = [
  'windKn',
  'hs',
  'visibility',
  'rain',
  'lightning',
  'steepness',
  'cloudCover',
  'cloudDark',
  'foam',
  'turbidity',
  'saturation',
  'clarity',
  'contrast',
];
export const LOG_LERP_KEYS = ['lambdaMin', 'lambdaMax'];

export const WEATHER = {
  transitionSeconds: 60,
  windDirectionDeg: 235, // direction the wind blows FROM (compass). SW wind.
  seaTempC: 11,
  waveSeed: 1337,
};

export function seaStateIndex(id) {
  return SEA_STATES.findIndex((s) => s.id === id);
}
