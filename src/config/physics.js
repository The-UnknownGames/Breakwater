// World physics constants.

export const PHYS = {
  gravity: 9.81,
  rhoWater: 1025,
  rhoAir: 1.225,
  // Buoyancy points evaluated per step across all bodies (spec 3.3 budget).
  maxPointsPerStep: 400,
  // Slow procedural surface current (m/s): base drift plus a wandering field.
  currentBase: 0.12,
  currentVariation: 0.18,
  currentScale: 900,
  // Wind gusts: fraction of mean speed and the gust period (s).
  gustAmount: 0.18,
  gustPeriod: 9,
};
