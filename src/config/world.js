// The Grey Reach (spec 6): a 10 x 10 km play region (the inner 6 x 6 km
// of the original reach plus an outer ring of islands and far ports). Units are metres, +X
// east, -Z north, origin at the centre. Islands are noise-shaped granite
// domes; ports sit on their shores; reefs are submerged domes marked with
// hazard buoys. Everything that places or shapes the world lives here.

export const WORLD_MAP = {
  halfSize: 5000, // play region half-extent
  serviceRadius: 7500, // radio warns past this
  failRadius: 9500, // towed home past this
  baseDepth: 55, // open-water depth (m), varied by noise
  depthNoise: 18,
  // x, z, radius, height (m), seed. Kept clear of a 700 m ring around the
  // origin (open-water spawn used by tests and debug views).
  islands: [
    { name: 'Kettle Island', x: -1050, z: 820, r: 560, h: 58, seed: 1 },
    { name: 'Pellow Point', x: 1500, z: -1150, r: 320, h: 42, seed: 2 },
    { name: 'Farrow Island', x: 2250, z: 1750, r: 380, h: 46, seed: 3 },
    { name: 'Gannet Rock', x: -2050, z: -1550, r: 420, h: 62, seed: 4 },
    { name: 'Hollin', x: 300, z: -2300, r: 290, h: 36, seed: 5 },
    { name: 'Sealstone', x: -2450, z: 650, r: 300, h: 48, seed: 6 },
    { name: 'Brack Isle', x: 950, z: 1500, r: 230, h: 30, seed: 7 },
    { name: 'The Teeth', x: -900, z: -1250, r: 170, h: 24, seed: 8 },
    { name: 'Crowholm', x: 2500, z: -150, r: 260, h: 40, seed: 9 },
    { name: 'Skerry Mor', x: -300, z: 2350, r: 330, h: 44, seed: 10 },
    // The outer reach.
    { name: 'Ardmore', x: -3900, z: 2900, r: 650, h: 70, seed: 11 },
    { name: 'Lanrick', x: 3900, z: -3300, r: 520, h: 55, seed: 12 },
    { name: 'Duncairn', x: 4200, z: 3600, r: 480, h: 60, seed: 13 },
    { name: 'Stack of Orra', x: -4300, z: -3600, r: 300, h: 80, seed: 14 },
    { name: 'Mew Skerries', x: 600, z: 4200, r: 260, h: 26, seed: 15 },
    { name: 'Carrach', x: -4400, z: -800, r: 360, h: 40, seed: 16 },
    { name: 'Blackhead', x: 1200, z: -4300, r: 380, h: 50, seed: 17 },
  ],
  // Submerged hazards: x, z, radius, minimum depth.
  reefs: [
    { name: 'Widow Reef', x: 1150, z: 350, r: 80, minDepth: 0.4 },
    { name: 'Slate Shoal', x: -1450, z: -300, r: 110, minDepth: 0.8 },
    { name: 'Farrow Ledges', x: 1900, z: 1250, r: 90, minDepth: 0.5 },
    { name: 'Orra Bank', x: -3300, z: -2600, r: 120, minDepth: 0.6 },
    { name: 'Duncairn Rocks', x: 3350, z: 2750, r: 100, minDepth: 0.5 },
    { name: 'Mew Ledge', x: 1300, z: 3500, r: 90, minDepth: 0.7 },
  ],
  ports: [
    {
      id: 'kettle',
      name: 'Kettle Harbor',
      island: 0,
      home: true,
      services: ['fuel', 'repair', 'shipyard', 'jobs', 'dropoff'],
    },
    { id: 'pellow', name: 'Pellow Point', island: 1, services: ['fuel', 'repair', 'dropoff'] },
    { id: 'farrow', name: 'Farrow Station', island: 2, services: ['fuel', 'dropoff'], minReputation: 25 },
    { id: 'hollin', name: 'Hollin Pier', island: 4, services: ['fuel', 'dropoff'] },
    { id: 'ardmore', name: 'Ardmore', island: 10, services: ['fuel', 'repair', 'dropoff'], minReputation: 15 },
    { id: 'lanrick', name: 'Lanrick Quay', island: 11, services: ['fuel', 'repair', 'dropoff'], minReputation: 40 },
    { id: 'duncairn', name: 'Duncairn', island: 12, services: ['fuel', 'repair', 'dropoff'], minReputation: 60 },
  ],
  harbor: {
    basinRadius: 95, // dredged basin carved into the shore
    basinDepth: 6,
    zoneRadius: 150, // port zone (docking, deliveries, tow completion)
    shelterRadius: 170, // waves die down inside
    shelter: 0.85,
  },
  // Small stations: a fuel dock off the shore facing the origin.
  station: { zoneRadius: 90, basinRadius: 40, basinDepth: 4.5 },
  // Fishing grounds (traffic trawls them; fishing work later).
  fishingGrounds: [
    { name: 'Hake Bank', x: -150, z: -850, r: 280 },
    { name: 'Gannet Deep', x: -1300, z: -2200, r: 300 },
    { name: 'Farrow Rip', x: 2500, z: 800, r: 280 },
    { name: 'West Hole', x: -2500, z: -300, r: 260 },
    { name: 'Silver Pit', x: 2500, z: -3900, r: 350 },
    { name: 'Ardmore Sound', x: -2500, z: 3900, r: 320 },
  ],
  lighthouses: [
    { port: 'kettle', at: 'breakwater' },
    { port: 'pellow', at: 'point' },
    { port: 'farrow', at: 'point' },
    { port: 'hollin', at: 'point' },
    { port: 'ardmore', at: 'point' },
    { port: 'lanrick', at: 'point' },
    { port: 'duncairn', at: 'point' },
  ],
};

// Ambient traffic (spec 6): vessels on routes between ports (port ids: each
// port's berth for their size) or trawling a fishing ground. Kinematic:
// they ride the waves, leave wakes, the player can hit them, and they stop
// for the player ahead. They also appear on the chart (AIS).
export const TRAFFIC = [
  { name: 'Skerry Belle', kind: 'ferry', model: 'islander', speedKn: 12, route: ['kettle', 'pellow', 'farrow'], dwellSeconds: 90 },
  { name: 'Northern Star', kind: 'fishing', model: 'trawler', speedKn: 5, ground: 0 },
  { name: 'Ellen Mary', kind: 'fishing', model: 'trawler', speedKn: 4.5, ground: 1 },
  { name: 'Guillemot', kind: 'fishing', model: 'trawler', speedKn: 5, ground: 2 },
  { name: 'Halcyon', kind: 'yacht', model: 'solace', speedKn: 16, route: ['pellow', 'farrow', 'kettle'], dwellSeconds: 40 },
  { name: 'Morven', kind: 'sailing', model: 'sailboat', speedKn: 5.5, ground: 3 },
  { name: 'Ardmore Lass', kind: 'ferry', model: 'islander', speedKn: 13, route: ['kettle', 'hollin', 'ardmore'], dwellSeconds: 90 },
  { name: 'Kinloch', kind: 'freighter', model: 'northfarer', speedKn: 11, route: ['pellow', 'lanrick', 'duncairn'], dwellSeconds: 120 },
  { name: 'Silver Dawn', kind: 'fishing', model: 'trawler', speedKn: 4.5, ground: 4 },
];

export const TRAFFIC_RULES = {
  giveWayRange: 90, // m ahead: slow and stop for the player
  giveWayCone: 0.5, // cos of the half-angle ahead
  turnDegPerSec: 6, // big ships turn slower (scaled by 12 / length)
  arriveRadius: 60,
};
