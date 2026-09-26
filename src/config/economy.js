// npm run sim:economy (spec 17.3): average job durations, risks and running
// costs per sea state and boat, the weather chain the simulation draws from,
// and the section 8.5 pacing targets. Pay comes from the game's own rules
// (config/career.js, gameplay/Jobs.js estimate()).

export const ECON_SIM = {
  hours: 8,
  seeds: 12, // careers averaged
  reserve: 1200, // money the player keeps for fuel, repairs, a tow home
  overheadMin: 1, // between jobs: pick the next call, refuel
  // (the minutes below already include the run out and back)
  // Minutes for a job in Calm with the Marlin (spec 8.5 pay checks: a Calm
  // trawler tow ~12 min, a Calm 2-person rescue ~7 min).
  minutes: { pw: 7, raft: 10, crew: 9, tow: 12, swamped: 16 },
  // Sea state factors: time, failure chance, hull damage per job (%).
  sea: {
    calm: { time: 1, fail: 0.03, damage: 0 },
    moderate: { time: 1.1, fail: 0.05, damage: 1 },
    rough: { time: 1.2, fail: 0.1, damage: 4 },
    gale: { time: 1.3, fail: 0.16, damage: 9 },
    storm: { time: 1.4, fail: 0.24, damage: 16 },
  },
  // Per boat: worst sea state it works (spec 7), time factor for rescues
  // and tows, fail and hull damage factors, fuel ($/h at a working mix), can
  // it tow.
  boats: {
    marlin: { maxSea: 'gale', rescue: 1, tow: 1, fail: 1, damage: 1, fuelPerHour: 100, tows: true },
    kestrel: { maxSea: 'rough', rescue: 0.65, tow: 1, fail: 1.2, damage: 1.4, fuelPerHour: 120, tows: false },
    bulwark: { maxSea: 'storm', rescue: 1.1, tow: 1.1, fail: 0.4, damage: 0.25, fuelPerHour: 350, tows: true },
  },
  // What the player does next with spare money (spec 17.3: the next upgrade
  // in list order when affordable). "Everything owned" = every boat and
  // every upgrade once (per-boat upgrades on the Marlin), D63.
  shopping: ['searchlight2', 'fuel2', 'towline2', 'pumps2', 'autotension', 'autopilot', 'boat:kestrel', 'plating', 'radar', 'engine2', 'boat:bulwark'],
  // Autopilot time compression cuts open-water transit in fair weather.
  autopilotSaving: 0.12,
};

// Weather for the simulation: a persistent Markov chain over 15-minute
// periods (the game's forecast chain arrives in V5).
export const WEATHER_CHAIN = {
  periodMin: 15,
  states: ['calm', 'moderate', 'rough', 'gale', 'storm'],
  // Row: from; columns: to (calm..storm).
  p: [
    [0.8, 0.18, 0.02, 0, 0],
    [0.12, 0.72, 0.14, 0.02, 0],
    [0.02, 0.18, 0.64, 0.14, 0.02],
    [0, 0.04, 0.22, 0.6, 0.14],
    [0, 0, 0.08, 0.32, 0.6],
  ],
};

// Section 8.5 pacing targets; sim:economy fails beyond ±25%.
export const PACING = {
  tolerance: 0.25,
  calmRatePerHour: [7000, 10000],
  stormRatePerHour: [15000, 25000],
  firstUpgradeMin: [10, 15],
  kestrelMin: 60,
  bulwarkMin: [120, 150],
  everythingMin: [300, 360],
};
