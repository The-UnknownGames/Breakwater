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
  // On the plane above ~14 kn: dynamic lift carries ~85% of her weight at
  // speed; she rises ~0.25 m and wets (and drags) less.
  planing: { cl: 0.012, fromKn: 14 },
  drag: {
    long: { quad: 4, lin: 30 },
    lat: { quad: 450, lin: 300, speedLin: 60, aftBias: 0.9 },
    vert: { quad: 1600, lin: 700, speedLin: 700 },
  },
  prop: {
    pos: [0, -0.35, -3.6],
    diameter: 0.35,
    thrustMax: 5600,
    vPropMax: 80,
    reverseEfficiency: 0.9,
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
  // Bow thruster: holds her head up to the weather at manoeuvring speed.
  thruster: { force: 12000, pos: [0, -1.2, 9], fullKn: 1.5, offKn: 3.5 },
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

// Leisure: an 18 m motor yacht, quick and comfortable.
export const SOLACE = {
  id: 'solace',
  name: 'Solace',
  role: 'Motor yacht',
  hull: { length: 18, beam: 5.2, draft: 1.1, freeboard: 1.7, sheerRise: 0.6, transomWidth: 0.9, maxBeamAt: 0.42, fullness: 2.1, bowFullness: 1.4, forefootRise: 0.9 },
  mass: 28000,
  vcg: 0.8,
  gyration: { roll: 0.22, pitch: 0.26, yaw: 0.27 },
  voxel: { fine: 0.3, budget: 64 },
  drag: {
    long: { quad: 40, lin: 300 },
    lat: { quad: 11000, lin: 6000, speedLin: 1500, aftBias: 0.9 },
    vert: { quad: 19000, lin: 8500, speedLin: 12000 },
  },
  prop: { pos: [0, -0.9, -7.4], diameter: 0.9, thrustMax: 61200, vPropMax: 32, reverseEfficiency: 0.45, washK: 1.0, rpmIdle: 650, rpmMax: 2300, rpmTau: 0.7 },
  rudder: { pos: [0, -0.85, -8.1], area: 0.45, maxAngleDeg: 35, stallDeg: 35, rateDegPerSec: 40, returnDegPerSec: 16 },
  windage: { center: [0, 2.6, 0.5], areaSide: 55, areaFront: 22, cdSide: 0.9, cdFront: 0.7 },
  slam: { speed: 3, coefficient: 1.1 },
  capsizeDeg: 70,
  capsizeHoldSeconds: 2.5,
  fuelMinutesFullThrottle: 120,
  fuelLitres: 2000,
  survivorCapacity: 12,
  passengers: 12, // charter guests
  pumpTonnesPerMin: 4,
  towBreakingKN: 120,
  targets: { topSpeedKn: 35, accel: { toKn: 20, seconds: 7 }, stopping: { fromKn: 20, metres: 120 }, turningCircleLengths: 3.5, cruiseThrottle: 0.7, rollPeriod: 6.5, capsizeDeg: 70 },
};

// Work: a 45 m passenger and vehicle ferry.
export const ISLANDER = {
  id: 'islander',
  name: 'Islander',
  role: 'Island ferry',
  hull: { length: 45, beam: 11, draft: 2.6, freeboard: 2.8, sheerRise: 1.2, transomWidth: 0.9, maxBeamAt: 0.45, fullness: 2.6, bowFullness: 1.8, forefootRise: 0.6 },
  mass: 650000,
  vcg: 1.3,
  gyration: { roll: 0.34, pitch: 0.26, yaw: 0.26 },
  voxel: { fine: 0.6, budget: 64 },
  drag: {
    long: { quad: 1746, lin: 800 },
    lat: { quad: 30000, lin: 18000, speedLin: 5000, aftBias: 0.85 },
    vert: { quad: 420000, lin: 170000, speedLin: 170000 },
  },
  prop: { pos: [0, -2.0, -19.5], diameter: 2.4, thrustMax: 315000, vPropMax: 60, reverseEfficiency: 0.45, washK: 1.2, rpmIdle: 250, rpmMax: 750, rpmTau: 1.0 },
  rudder: { pos: [0, -1.9, -21], area: 3.9, maxAngleDeg: 35, stallDeg: 35, rateDegPerSec: 28, returnDegPerSec: 14 },
  windage: { center: [0, 6, 0], areaSide: 380, areaFront: 110, cdSide: 0.9, cdFront: 0.8 },
  slam: { speed: 4, coefficient: 1.2 },
  capsizeDeg: 62,
  capsizeHoldSeconds: 4,
  fuelMinutesFullThrottle: 240,
  fuelLitres: 20000,
  survivorCapacity: 150,
  passengers: 150,
  cargoTonnes: 80, // vehicles
  pumpTonnesPerMin: 20,
  towBreakingKN: 400,
  towPointFromStern: 3,
  targets: { topSpeedKn: 22, accel: { toKn: 12, seconds: 16 }, stopping: { fromKn: 12, metres: 90 }, turningCircleLengths: 3, cruiseThrottle: 0.7, rollPeriod: 9.5, capsizeDeg: 62 },
};

// Work: a 72 m coastal freighter; huge, tows anything. Tuned for play:
// far punchier than a real ship (0-10 kn in ~23 s, stops in ~110 m).
export const NORTHFARER = {
  id: 'northfarer',
  name: 'Northfarer',
  role: 'Coastal freighter',
  hull: { length: 72, beam: 13, draft: 4.2, freeboard: 4.6, sheerRise: 1.6, transomWidth: 0.85, maxBeamAt: 0.5, fullness: 3.0, bowFullness: 2.0, forefootRise: 0.5 },
  mass: 3200000,
  vcg: 0.1,
  gyration: { roll: 0.35, pitch: 0.25, yaw: 0.25 },
  voxel: { fine: 0.9, budget: 64 },
  drag: {
    long: { quad: 6930, lin: 1500 },
    lat: { quad: 65000, lin: 40000, speedLin: 10000, aftBias: 0.85 },
    vert: { quad: 800000, lin: 320000, speedLin: 320000 },
  },
  prop: { pos: [0, -3.2, -32], diameter: 3.8, thrustMax: 875000, vPropMax: 60, reverseEfficiency: 0.45, washK: 1.2, rpmIdle: 90, rpmMax: 320, rpmTau: 1.4 },
  rudder: { pos: [0, -3.0, -34], area: 6, maxAngleDeg: 35, stallDeg: 35, rateDegPerSec: 22, returnDegPerSec: 11 },
  windage: { center: [0, 8, -20], areaSide: 700, areaFront: 200, cdSide: 0.9, cdFront: 0.8 },
  slam: { speed: 4, coefficient: 1.2 },
  capsizeDeg: 80,
  capsizeHoldSeconds: 5,
  fuelMinutesFullThrottle: 600,
  fuelLitres: 80000,
  survivorCapacity: 30,
  cargoTonnes: 1200,
  pumpTonnesPerMin: 40,
  towBreakingKN: 1500,
  towPointFromStern: 3,
  targets: { topSpeedKn: 19, accel: { toKn: 10, seconds: 23 }, stopping: { fromKn: 10, metres: 110 }, turningCircleLengths: 3, cruiseThrottle: 0.7, rollPeriod: 11, capsizeDeg: 80 },
};

// Work: a 16 m stern trawler (fishing), the traffic trawlers' sister.
export const KITTIWAKE = {
  id: 'kittiwake',
  name: 'Kittiwake',
  role: 'Stern trawler',
  hull: { length: 16, beam: 5.4, draft: 1.3, freeboard: 1.35, sheerRise: 0.9, transomWidth: 0.8, maxBeamAt: 0.45, fullness: 2.4, bowFullness: 1.7, forefootRise: 0.6 },
  mass: 25000,
  vcg: 0.15,
  gyration: { roll: 0.3, pitch: 0.26, yaw: 0.27 },
  voxel: { fine: 0.3, budget: 64 },
  drag: {
    long: { quad: 290, lin: 420 },
    lat: { quad: 14000, lin: 7000, speedLin: 2000, aftBias: 0.8 },
    vert: { quad: 25000, lin: 12000, speedLin: 8000 },
  },
  prop: { pos: [0, -0.9, -6.6], diameter: 1.2, thrustMax: 20000, vPropMax: 16, reverseEfficiency: 0.45, washK: 1.1, rpmIdle: 500, rpmMax: 1600, rpmTau: 0.9 },
  rudder: { pos: [0, -0.85, -7.3], area: 0.9, maxAngleDeg: 35, stallDeg: 35, rateDegPerSec: 30, returnDegPerSec: 12 },
  windage: { center: [0, 2.6, 2], areaSide: 42, areaFront: 22, cdSide: 0.9, cdFront: 0.8 },
  slam: { speed: 3.5, coefficient: 1.0 },
  capsizeDeg: 75,
  capsizeHoldSeconds: 3,
  fuelMinutesFullThrottle: 180,
  fuelLitres: 3000,
  survivorCapacity: 8,
  pumpTonnesPerMin: 3,
  towBreakingKN: 100,
  fishHoldKg: 6000,
  netDrag: 5200, // N per (m/s)² with the nets out
  targets: { topSpeedKn: 11.5, accel: { toKn: 8, seconds: 10 }, stopping: { fromKn: 8, metres: 30 }, turningCircleLengths: 2, cruiseThrottle: 0.7, rollPeriod: 4.2, capsizeDeg: 75 },
};

export const BOATS = { marlin: MARLIN, kestrel: KESTREL, bulwark: BULWARK, kittiwake: KITTIWAKE, solace: SOLACE, islander: ISLANDER, northfarer: NORTHFARER };

export { KN };
