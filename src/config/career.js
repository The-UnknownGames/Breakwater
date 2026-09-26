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
    pw: { label: 'Person in the water', weight: 3, base: 380, per: 280, people: [1, 3] },
    raft: { label: 'Life raft', weight: 2, base: 240, per: 200, people: [4, 6] },
    crew: { label: 'Crew transfer', weight: 1.5, base: 460, per: 330, people: [2, 4], sinkMinutes: [6, 10] },
    tow: { label: 'Disabled vessel', weight: 3 },
    swamped: { label: 'Swamped vessel', weight: 1.5, bonus: 900, pumpSeconds: 20 },
  },
  vessels: {
    sailboat: { value: 6000, names: ['Wren', 'Kittiwake', 'Sea Lark', 'Morven', 'Tern'] },
    trawler: { value: 14000, names: ['Brae Lass', 'Ellen Mary', 'Northern Star', 'Guillemot', 'Silver Dawn'] },
  },
  fromTraffic: 0.5, // of person-overboard / raft calls: from a passing vessel
  trafficKinds: { ferry: 'ferry', fishing: 'trawler', yacht: 'yacht', sailing: 'sloop' },
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

// Guided first job (spec 15): the Wren, disabled outside the breakwater.
export const TUTORIAL = {
  out: 520, // m seaward of the harbor centre (past the channel buoys)
  side: 70, // m along the shore
  nearRange: 60, // m: "come within 8 m of her bow" prompt
  hintSeconds: 6,
  firstOfferSeconds: 20,
};

export const REPUTATION = {
  perSurvivor: 5,
  perTow: 3,
  perLifeLost: -10,
  perLostTow: -5,
  farrow: 25,
};

export const ECONOMY = {
  startMoney: 1500,
  fuelPerLitre: 1.2,
  repairPerPercent: { marlin: 12, kestrel: 5, bulwark: 40, solace: 30, islander: 150, northfarer: 320 },
  towHomeFee: 1000,
  bankruptcy: -5000,
  autosaveSeconds: 120,
};
