// Survivors, life rafts, flooding, damage and grounding (spec 3.5, 14 V3).

export const RESCUE = {
  pullRange: 4.2, // m from the hull side (waterline) to the survivor
  pullMaxKn: 2.5,
  pullSeconds: 2.5,
  survivorMass: 85, // kg, carried on deck
  // Minutes in the water before hypothermia takes a survivor, by sea state.
  hypothermiaMinutes: { calm: 14, moderate: 11, rough: 9, gale: 7, storm: 5.5 },
  raftFactor: 4, // a raft slows cooling this much
  survivorLeeway: 0.012, // fraction of wind speed
  raftLeeway: 0.045,
  raftCapacity: 6,
};

export const FLOOD = {
  // Green water over the deck edge: t/s per metre of edge immersion, summed
  // over the deck-edge buoyancy points.
  greenWaterRate: 0.22,
  // Damage leak below 60% integrity: t/min at 0% integrity.
  leakThreshold: 60,
  leakMaxPerMin: 3.5,
  founderRatio: 0.6, // of reserve buoyancy
  sinkRate: 1.5, // t/s once foundered
  freeSurface: 0.8, // how far flood water runs to the low side (fraction of half-beam)
};

export const DAMAGE = {
  contactThreshold: 45000, // N of contact force before damage
  contactScale: 2500, // N per %/s above the threshold
  groundStiffness: 250000, // N per metre of penetration, per buoyancy point
  groundFriction: 0.5,
  groundDamage: 9, // % per second per (m penetration × m/s sliding)
  scrapeMinSpeed: 0.3,
};

// Night aids (V5): searchlight, flares, strobes, whistles.
export const NIGHT = {
  darkFrom: 0.35, // lights come on below this "daylight" (dayFactor x storm gloom)
  // intensity: irradiance scale in the ocean/rain shaders (sun = 3.2,
  // moon = 0.1); threeScale: candela per unit for the Three.js lights
  // (decay 1: irradiance = I / d).
  searchlight: { range: 320, cosInner: 0.985, cosOuter: 0.955, intensity: 3.6, threeScale: 40, beamOpacity: 0.16 },
  searchlight2: { range: 640, cosInner: 0.993, cosOuter: 0.978, intensity: 5, threeScale: 60, beamOpacity: 0.16 },
  flare: {
    stock: 6,
    price: 20, // each, restocked at any fuel port
    climb: 55, // m/s at launch (a parachute rocket)
    apex: 260, // m
    fall: 2.2, // m/s under the parachute
    burnSeconds: 50,
    intensity: 0.75,
    threeScale: 100,
    range: 900,
    color: [1.0, 0.86, 0.62],
  },
  handFlare: { burnSeconds: 45, intensity: 0.45, threeScale: 18, range: 260, color: [1.0, 0.25, 0.12], seenRange: 1500, againSeconds: 180 },
  strobe: { period: 1.1, on: 0.07 },
  whistle: { range: 350, every: [4, 7] },
};
