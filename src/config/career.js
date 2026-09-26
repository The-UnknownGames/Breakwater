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
    pw: { label: 'Person in the water', weight: 3, base: 300, per: 250, people: [1, 3] },
    raft: { label: 'Life raft', weight: 2, base: 200, per: 180, people: [4, 6] },
    crew: { label: 'Crew transfer', weight: 1.5, base: 400, per: 300, people: [2, 4], sinkMinutes: [6, 10] },
    tow: { label: 'Disabled vessel', weight: 3 },
    swamped: { label: 'Swamped vessel', weight: 1.5, bonus: 800, pumpSeconds: 20 },
  },
  vessels: {
    sailboat: { value: 6000, names: ['Wren', 'Kittiwake', 'Sea Lark', 'Morven', 'Tern'] },
    trawler: { value: 14000, names: ['Brae Lass', 'Ellen Mary', 'Northern Star', 'Guillemot', 'Silver Dawn'] },
  },
  sources: ['ferry Islander', 'trawler Ellen Mary', 'yacht Halcyon', 'creel boat Morag', 'pilot launch'],
  towShare: 0.15, // of vessel value x condition
  crewTransferSeconds: 5,
  crewRange: 2.5, // m between hulls
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
  repairPerPercent: { marlin: 12, kestrel: 5, bulwark: 40 },
  towHomeFee: 1000,
  bankruptcy: -5000,
  autosaveSeconds: 120,
};
