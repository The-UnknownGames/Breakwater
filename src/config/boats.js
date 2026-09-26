// Boat definitions (spec section 4). Local frame: +Z forward (bow), +Y up,
// +X port (right-handed, facing +Z). Origin: midships on the design waterline (DWL).
// Physics coefficients are tuned so `npm run test:physics` hits `targets`.

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

// Rescue RIB: light, fast, twitchy; jumps off swells.
export const KESTREL = {
  id: 'kestrel',
  name: 'Kestrel',
  role: 'Fast rescue RIB',
  hull: {
    length: 7.5,
    beam: 2.6,
    draft: 0.4,
    freeboard: 0.75,
    sheerRise: 0.3,
    transomWidth: 0.92,
    maxBeamAt: 0.4,
    fullness: 2.2,
    bowFullness: 1.4,
    forefootRise: 0.9,
  },
  mass: 1600,
  vcg: 0.45,
  gyration: { roll: 0.24, pitch: 0.25, yaw: 0.26 },
  voxel: { fine: 0.12, budget: 48 },
  drag: {
    long: { quad: 4, lin: 30 },
    lat: { quad: 450, lin: 300, speedLin: 60, aftBias: 0.9 },
    vert: { quad: 1600, lin: 700, speedLin: 700 },
  },
  prop: {
    pos: [0, -0.35, -3.6],
    diameter: 0.35,
    thrustMax: 6000,
    vPropMax: 80,
    reverseEfficiency: 0.65,
    washK: 1.0,
    rpmIdle: 900,
    rpmMax: 6000,
    rpmTau: 0.3,
  },
  rudder: {
    pos: [0, -0.3, -3.8],
    area: 0.2,
    maxAngleDeg: 30,
    stallDeg: 30,
    rateDegPerSec: 70,
    returnDegPerSec: 30,
  },
  windage: {
    center: [0, 0.9, 0],
    areaSide: 6,
    areaFront: 3,
    cdSide: 0.9,
    cdFront: 0.7,
  },
  slam: { speed: 3, coefficient: 0.9 },
  capsizeDeg: 70,
  capsizeHoldSeconds: 2,
  fuelMinutesFullThrottle: 25,
  fuelLitres: 90,
  survivorCapacity: 4,
  pumpTonnesPerMin: 0.5,
  towBreakingKN: 15,
  towPointFromStern: 0.9, // A-frame
  targets: {
    topSpeedKn: 45,
    accel: { toKn: 30, seconds: 7 },
    stopping: { fromKn: 30, metres: 45 },
    turningCircleLengths: 3,
    cruiseThrottle: 0.4, // rescue cruise (D59)
    rollPeriod: 2.5,
    capsizeDeg: 70,
  },
};

// Salvage tug: huge inertia and prop wash, slow, works a storm.
export const BULWARK = {
  id: 'bulwark',
  name: 'Bulwark',
  role: 'Salvage tug',
  hull: {
    length: 22,
    beam: 8,
    draft: 2.2,
    freeboard: 1.3,
    sheerRise: 1.0,
    transomWidth: 0.8,
    maxBeamAt: 0.45,
    fullness: 2.4,
    bowFullness: 1.8,
    forefootRise: 0.6,
  },
  mass: 110000,
  vcg: 0.6,
  gyration: { roll: 0.26, pitch: 0.26, yaw: 0.24 },
  voxel: { fine: 0.3, budget: 64 },
  drag: {
    long: { quad: 360, lin: 300 },
    lat: { quad: 20000, lin: 12000, speedLin: 3000, aftBias: 0.85 },
    vert: { quad: 150000, lin: 60000, speedLin: 60000 },
  },
  prop: {
    pos: [0, -1.6, -9.2],
    diameter: 2.0,
    thrustMax: 25000,
    vPropMax: 60,
    reverseEfficiency: 0.16,
    washK: 1.4,
    rpmIdle: 300,
    rpmMax: 900,
    rpmTau: 1.4,
  },
  rudder: {
    pos: [0, -1.5, -10.2],
    area: 1.6,
    maxAngleDeg: 35,
    stallDeg: 40,
    rateDegPerSec: 25,
    returnDegPerSec: 10,
  },
  windage: {
    center: [0, 4, 1],
    areaSide: 90,
    areaFront: 40,
    cdSide: 0.9,
    cdFront: 0.8,
  },
  slam: { speed: 4, coefficient: 1.2 },
  capsizeDeg: 55,
  capsizeHoldSeconds: 3,
  fuelMinutesFullThrottle: 60,
  fuelLitres: 1200,
  survivorCapacity: 10,
  pumpTonnesPerMin: 8,
  towBreakingKN: 600,
  towPointFromStern: 4.5, // H-bitt
  targets: {
    topSpeedKn: 13,
    accel: { toKn: 10, seconds: 35 },
    stopping: { fromKn: 10, metres: 180 },
    turningCircleLengths: 2.5,
    cruiseThrottle: 0.7,
    rollPeriod: 9,
    capsizeDeg: 55,
  },
};

export const BOATS = { marlin: MARLIN, kestrel: KESTREL, bulwark: BULWARK };

export { KN };
