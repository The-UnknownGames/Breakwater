// Tow line and tow targets (spec 3.6, 4, 14 V3). Tow targets are hulls built
// from the same HullShape/BoatPhysics as the player's boat, with no engine.

export const TOW = {
  stretchAtBreak: 0.15, // synthetic line: 15% elongation at breaking strength
  dampingRatio: 0.12, // fraction of critical damping (line hysteresis)
  minLength: 10,
  maxLength: 120,
  defaultLength: 25,
  payOutRate: 2.2, // m/s (Q)
  haulInRate: 1.2, // m/s (Z), slows under load
  haulStallRatio: 0.8, // the winch cannot haul in above this tension ratio
  attachRange: 8, // m from tow point to the target's bow cleat
  attachMaxKn: 3,
  breakHoldSeconds: 0.25,
  breakInstantRatio: 1.5,
  warnRatio: 0.6,
  critRatio: 0.85,
  creakRatio: 0.7,
  peakHoldSeconds: 2.5,
  // Winch auto-tension upgrade: render (pay out) against spikes, recover
  // the set length slowly once the load falls.
  autoTension: {
    floorRatio: 0.05, // never renders below this fraction of the rating
    meanFactor: 1.35, // renders above this multiple of the running mean load
    meanSeconds: 8, // running-mean time constant
    payOutGain: 0.0006, // m/s per newton above the render tension
    maxPayOut: 12, // m/s
    recoverRate: 0.5, // m/s back toward the set length once the load eases
    maxExtra: 14, // m paid out beyond the set length at most
  },
  rope: { nodes: 40, radius: 0.036, iterations: 14, floatDepth: 0.35 },
};

const common = {
  prop: null,
  rudder: null,
  slam: { speed: 3.5, coefficient: 0.9 },
  capsizeHoldSeconds: 3,
  fuelMinutesFullThrottle: 1,
  fuelLitres: 0,
  survivorCapacity: 0,
  pumpTonnesPerMin: 0,
};

export const TRAWLER = {
  ...common,
  id: 'trawler',
  name: 'Trawler',
  hull: {
    length: 16,
    beam: 5.4,
    draft: 1.3,
    freeboard: 1.35,
    sheerRise: 0.9,
    transomWidth: 0.8,
    maxBeamAt: 0.45,
    fullness: 2.4,
    bowFullness: 1.7,
    forefootRise: 0.6,
  },
  mass: 25000,
  vcg: 0.15,
  gyration: { roll: 0.3, pitch: 0.26, yaw: 0.27 },
  voxel: { fine: 0.3, budget: 32 },
  drag: {
    long: { quad: 290, lin: 420 },
    lat: { quad: 26000, lin: 9000, speedLin: 2500, aftBias: 0.6 },
    vert: { quad: 25000, lin: 12000, speedLin: 8000 },
  },
  windage: { center: [0, 2.6, 2], areaSide: 42, areaFront: 22, cdSide: 0.9, cdFront: 0.8 },
  capsizeDeg: 60,
};

export const SAILBOAT = {
  ...common,
  id: 'sailboat',
  name: 'Sailboat',
  hull: {
    length: 10,
    beam: 3.3,
    draft: 0.55,
    freeboard: 0.95,
    sheerRise: 0.3,
    transomWidth: 0.7,
    maxBeamAt: 0.4,
    fullness: 1.7,
    bowFullness: 1.4,
    forefootRise: 0.5,
  },
  mass: 5000,
  // Ballast keel: centre of mass below the waterline.
  vcg: -0.1,
  gyration: { roll: 0.32, pitch: 0.27, yaw: 0.28 },
  voxel: { fine: 0.2, budget: 32 },
  drag: {
    long: { quad: 70, lin: 160 },
    lat: { quad: 9000, lin: 3500, speedLin: 900, aftBias: 0.3 },
    vert: { quad: 6000, lin: 3000, speedLin: 2500 },
  },
  windage: { center: [0, 3.2, 0.4], areaSide: 16, areaFront: 6, cdSide: 1.0, cdFront: 0.8 },
  capsizeDeg: 120,
};

// A 40 ft shipping container adrift, riding low (cargo recovery, spec 8.1).
export const CONTAINER = {
  ...common,
  id: 'container',
  name: 'Container',
  hull: {
    length: 12.2,
    beam: 2.44,
    draft: 2.1,
    freeboard: 0.5,
    sheerRise: 0,
    transomWidth: 1,
    maxBeamAt: 0.5,
    fullness: 8,
    bowFullness: 8,
    forefootRise: 0,
  },
  mass: 24000,
  sealed: true,
  vcg: -1.2, // cargo low in the box: GM needs KG below KB + BM (~ -0.8 m)
  gyration: { roll: 0.3, pitch: 0.29, yaw: 0.29 },
  voxel: { fine: 0.25, budget: 16 },
  drag: {
    long: { quad: 320, lin: 300 },
    lat: { quad: 9000, lin: 4000, speedLin: 800, aftBias: 0.5 },
    vert: { quad: 12000, lin: 6000, speedLin: 3000 },
  },
  windage: { center: [0, 0.3, 0], areaSide: 6, areaFront: 1.2, cdSide: 1.1, cdFront: 1.1 },
  capsizeDeg: 170,
};

// A 250 t deck barge (spec 8.1: barge contracts, rep 70, a Bulwark job:
// "6 kn with a 250 t barge").
export const BARGE = {
  ...common,
  id: 'barge',
  name: 'Barge',
  hull: {
    length: 60,
    beam: 14,
    draft: 1.0,
    freeboard: 1.8,
    sheerRise: 0.4,
    transomWidth: 1,
    maxBeamAt: 0.5,
    fullness: 6,
    bowFullness: 3,
    forefootRise: 0.4,
  },
  mass: 250000,
  vcg: 0.4,
  gyration: { roll: 0.35, pitch: 0.28, yaw: 0.28 },
  voxel: { fine: 0.6, budget: 32 },
  drag: {
    long: { quad: 1700, lin: 900 },
    lat: { quad: 90000, lin: 40000, speedLin: 9000, aftBias: 0.5 },
    vert: { quad: 300000, lin: 120000, speedLin: 60000 },
  },
  windage: { center: [0, 1.5, 0], areaSide: 110, areaFront: 26, cdSide: 1.0, cdFront: 1.0 },
  capsizeDeg: 60,
};

export const TOW_TARGETS = { trawler: TRAWLER, sailboat: SAILBOAT, container: CONTAINER, barge: BARGE };

// Anchoring (leisure / waiting on station).
export const ANCHOR = {
  maxDepth: 60, // m: deeper and the anchor can't reach bottom
  maxKn: 2, // let go only when nearly stopped
  scopeRatio: 3, // rode = 3 x depth + scopeExtra
  scopeExtra: 15,
  stiffnessPerTonne: 900, // N/m per tonne of boat
  damping: 0.5,
  holding: 0.35, // m/s² x boat mass: more pull than this and it drags
};
