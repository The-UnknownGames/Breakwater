// Jobs, pay, reputation and economy (spec 8). Tunable to hit the section
// 8.5 pacing targets (checked by npm run sim:economy).

export const JOBS = {
  // Offers: first offer interval, then every [min, max] seconds / call rate.
  firstOffers: 2,
  intervalSeconds: [60, 180],
  expireSeconds: [360, 600],
  offerRange: [600, 2600], // metres from the player
  uncertainty: 280, // search-area radius until you get close
  revealRange: 450,
  maxOffers: (rep) => Math.min(6, 3 + Math.floor(rep / 20)),
  types: {
    pw: { label: 'Person in the water', weight: 3, base: 380, per: 300, people: [1, 3] },
    raft: { label: 'Life raft', weight: 2, base: 240, per: 200, people: [4, 6] },
    crew: { label: 'Crew transfer', weight: 1.5, base: 460, per: 330, people: [2, 4], sinkMinutes: [6, 10] },
    tow: { label: 'Disabled vessel', weight: 3 },
    swamped: { label: 'Swamped vessel', weight: 1.5, bonus: 900, pumpSeconds: 20 },
    containers: { label: 'Cargo recovery', weight: 0.8, perContainer: 500, count: [3, 6] }, // spec 350 (D81)
  },
  vessels: {
    sailboat: { value: 6000, names: ['Wren', 'Kittiwake', 'Sea Lark', 'Morven', 'Tern'] },
    trawler: { value: 14000, names: ['Brae Lass', 'Ellen Mary', 'Northern Star', 'Guillemot', 'Silver Dawn'] },
    // Barge contracts (spec 8.1): reputation 70; realistically a Bulwark job.
    barge: { value: 60000, minRep: 70, chance: 0.3, names: ['Grey Reach 7', 'Kettle Lighter 2', 'Stoneway'] },
  },
  fromTraffic: 0.5, // of person-overboard / raft calls: from a passing vessel
  trafficKinds: { ferry: 'ferry', fishing: 'trawler', yacht: 'yacht', sailing: 'sloop', freighter: 'freighter' },
  sources: ['ferry Islander', 'trawler Ellen Mary', 'yacht Halcyon', 'creel boat Morag', 'pilot launch'],
  towShare: 0.18, // of vessel value x condition (spec 0.15, D64)
  crewTransferSeconds: 5,
  // A sinking vessel's clock starts on accept and is never shorter than the
  // run out at sinkWorkingSpeed x top speed, x sinkTravelFactor, plus the
  // search and the transfer.
  sinkWorkingSpeed: 0.7,
  sinkTravelFactor: 1.4,
  sinkSlackMinutes: 4,
  crewRange: 2.5, // m between hulls
};

// Trade (RP work for the big boats): passenger runs / charters and cargo
// contracts between ports. Load at the origin, deliver on time.
export const TRADE = {
  passenger: { label: 'Passenger run', perHead: 16, perHeadKm: 0.9, loadSecondsPerHead: 0.4, headMass: 90 },
  charter: { label: 'Charter', perHead: 48, perHeadKm: 2.7, loadSecondsPerHead: 3, headMass: 90, maxHeads: 20 },
  cargo: { label: 'Cargo contract', perTonne: 4.5, perTonneKm: 1.6, loadSecondsPerTonne: 0.25 },
  // Ferry timetable: a scheduled round of stops (the Islander's regular
  // route). Each leg pays on arrival, docked for lateness against the
  // timetable; late passengers complain on the radio and cost reputation.
  timetable: { label: 'Ferry timetable', perHead: 16, perHeadKm: 0.9, loadSecondsPerHead: 0.4, headMass: 90, bonus: 1.2, deadlineFactor: 1.4, slackMinutes: 1.5, complainEvery: 75, lateReputation: -1, lateGraceMinutes: 1 },
  // Passenger ratings per port (0-5 stars, 3 to start): punctual arrivals
  // raise the arrival port's rating, late ones cut it. More passengers board
  // at well-rated ports (x 0.7 at 0 stars .. x 1.2 at 5).
  rating: { start: 3, onTime: 0.2, latePerMinute: 0.1, maxDrop: 0.6, headsBase: 0.7, headsPerStar: 0.1 },
  offerChance: 0.6, // of new offers, when the boat can trade
  fill: [0.5, 1], // fraction of capacity
  workingSpeed: 0.75, // x top speed for the deadline
  deadlineFactor: 1.8,
  slackMinutes: 3,
  latePerMinute: 0.05, // pay lost per minute late
  minPay: 0.5,
  berthRadius: 150, // m round an anchorage
  arriveKn: 2,
  reputation: 2,
};

// Fishing (RP): trawl a ground with the nets out, sell the catch in port.
export const FISHING = {
  trawlKn: [2, 5.5], // catching only at trawling speed
  kgPerMinute: 100, // a good ground in fair weather
  maxSeaIndex: 3, // no fishing above Gale
  seaFactor: [0.8, 1, 1.1, 0.7], // calm..gale: fish bite better in a chop
  // Price per kg by ground (config/world.js fishingGrounds order).
  pricePerKg: [3.2, 4.5, 5.0, 3.8, 5.8, 5.2], // the far grounds pay best
  shootSeconds: 20, // shooting or hauling the nets
};

// Guided first job (spec 15): the Wren, disabled outside the breakwater.
export const TUTORIAL = {
  out: 520, // m seaward of the harbor centre (past the channel buoys)
  side: 70, // m along the shore
  nearRange: 60, // m: "come within 8 m of her bow" prompt
  hintSeconds: 6,
  firstOfferSeconds: 20,
};

export const REPUTATION = {
  perContainer: 1,
  perSurvivor: 5,
  perTow: 3,
  perLifeLost: -10,
  perLostTow: -5,
  farrow: 25,
};

export const ECONOMY = {
  startMoney: 1500,
  fuelPerLitre: 1.2,
  repairPerPercent: { kittiwake: 20, marlin: 12, kestrel: 5, bulwark: 40, solace: 30, islander: 150, northfarer: 320 },
  towHomeFee: 1000,
  bankruptcy: -5000,
  autosaveSeconds: 120,
};

// Fleet (RP): owned boats you are not driving can be crewed to work a
// route on their own. Hire fee is a share of the boat's price; income and
// wages accrue per hour of sim time and settle every few minutes. Above a
// boat's worst sea its crew stays in port (wages still due).
export const FLEET = {
  hireFee: 0.04, // x boat price
  settleSeconds: 300,
  // Breakdowns: a crewed boat working near her weather limit can lose her
  // engine. The call is a job: tow her home in time and her crew goes back
  // to work; let it lapse (or fail) and she is towed in by the yard for a
  // share of her price, and the crew sits idle a while.
  breakdown: {
    perHour: { atLimit: 0.5, oneBelow: 0.15, fair: 0.03 },
    deadlineMinutes: 25,
    repairShare: 0.06, // x boat price when the yard has to fetch her
    idleMinutes: 30,
  },
  routes: {
    marlin: { route: 'Harbor patrol and small tows', grossPerHour: 5400, wagePerHour: 1800, maxSea: 'gale' },
    kestrel: { route: 'Water taxi', grossPerHour: 6000, wagePerHour: 2000, maxSea: 'rough' },
    bulwark: { route: 'Harbor towage', grossPerHour: 9000, wagePerHour: 3000, maxSea: 'storm' },
    kittiwake: { route: 'Trawling Hake Bank', grossPerHour: 8000, wagePerHour: 2400, maxSea: 'gale' },
    solace: { route: 'Day charters', grossPerHour: 12000, wagePerHour: 3500, maxSea: 'rough' },
    islander: { route: 'Kettle–Pellow ferry', grossPerHour: 26000, wagePerHour: 8000, maxSea: 'gale' },
    northfarer: { route: 'Coastal freight', grossPerHour: 48000, wagePerHour: 14000, maxSea: 'storm' },
  },
};
