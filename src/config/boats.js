// Boat definitions (spec section 4). Local frame: +Z forward (bow), +Y up,
// +X port (right-handed, facing +Z). Origin: midships on the design waterline (DWL).
// Physics coefficients are tuned so `npm run test:physics` hits `targets`.
// Kestrel and Bulwark get full physics tuning in V4.

const KN = 0.514444;

export const MARLIN = {
  id: 'marlin',
  name: 'Marlin',
  role: 'Starter workboat',
  hull: {
    length: 12,
    beam: 4.2,
    draft: 0.55, // keel depth below DWL, midships
    freeboard: 1.15, // deck edge above DWL, midships
    sheerRise: 0.45, // extra deck height at the bow
    transomWidth: 0.86, // fraction of max beam at the stern
    maxBeamAt: 0.42, // fraction of length from the stern
    fullness: 2.0, // section superellipse exponent midships (higher = boxier)
    bowFullness: 1.6,
    forefootRise: 0.85, // how far the keel rises toward the bow (fraction of draft)
  },
  mass: 9000,
  // Centre of mass height above DWL (m). Sets GM, hence roll period and capsize angle.
  vcg: 0.9,
  // Radii of gyration as fractions of beam (roll), length (pitch, yaw).
  gyration: { roll: 0.25, pitch: 0.26, yaw: 0.27 },
  voxel: { fine: 0.2, budget: 64 },
  // Hydrodynamic drag totals at the design waterline: quad = ½ρCdA (N/(m/s)²),
  // lin = linear damping (N/(m/s)); speedLin adds lin per m/s of forward speed
  // (hull lift damping). Distributed over submerged points.
  drag: {
    long: { quad: 21, lin: 150 },
    lat: { quad: 5200, lin: 3000, speedLin: 800, aftBias: 0.9 },
    vert: { quad: 9000, lin: 4000, speedLin: 6000 },
  },
  prop: {
    pos: [0, -0.6, -4.9],
    diameter: 0.75,
    thrustMax: 9200,
    vPropMax: 26, // m/s at which forward thrust reaches zero
    reverseEfficiency: 0.45,
    washK: 1.0,
    rpmIdle: 650,
    rpmMax: 2600,
    rpmTau: 0.6, // seconds to reach commanded RPM
  },
  rudder: {
    pos: [0, -0.55, -5.4],
    area: 0.25,
    maxAngleDeg: 35,
    stallDeg: 35,
    rateDegPerSec: 45,
    returnDegPerSec: 18,
  },
  windage: {
    center: [0, 1.9, 0.6],
    areaSide: 20,
    areaFront: 9,
    cdSide: 0.9,
    cdFront: 0.75,
  },
  slam: { speed: 3, coefficient: 1.2 },
  capsizeDeg: 65,
  capsizeHoldSeconds: 2,
  fuelMinutesFullThrottle: 35,
  fuelLitres: 100,
  survivorCapacity: 6,
  pumpTonnesPerMin: 2,
  towBreakingKN: 80,
  targets: {
    topSpeedKn: 22,
    accel: { toKn: 15, seconds: 12 },
    stopping: { fromKn: 15, metres: 60 },
    turningCircleLengths: 3.5,
    cruiseThrottle: 0.7,
    rollPeriod: 5,
    capsizeDeg: 65,
  },
};

export const KESTREL_TARGETS = {
  topSpeedKn: 45,
  accel: { toKn: 30, seconds: 7 },
  stopping: { fromKn: 30, metres: 45 },
  turningCircleLengths: 3,
  rollPeriod: 2.5,
  capsizeDeg: 70,
};

export const BULWARK_TARGETS = {
  topSpeedKn: 13,
  accel: { toKn: 10, seconds: 35 },
  stopping: { fromKn: 10, metres: 180 },
  turningCircleLengths: 2.5,
  rollPeriod: 9,
  capsizeDeg: 55,
};

export const BOATS = { marlin: MARLIN };

export { KN };
