// The Grey Reach (spec 6): a 6 x 6 km play region. Units are metres, +X
// east, -Z north, origin at the centre. Islands are noise-shaped granite
// domes; ports sit on their shores; reefs are submerged domes marked with
// hazard buoys. Everything that places or shapes the world lives here.

export const WORLD_MAP = {
  halfSize: 3000, // play region half-extent
  serviceRadius: 5000, // radio warns past this
  failRadius: 7000, // towed home past this
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
  ],
  // Submerged hazards: x, z, radius, minimum depth.
  reefs: [
    { name: 'Widow Reef', x: 1150, z: 350, r: 80, minDepth: 0.4 },
    { name: 'Slate Shoal', x: -1450, z: -300, r: 110, minDepth: 0.8 },
    { name: 'Farrow Ledges', x: 1900, z: 1250, r: 90, minDepth: 0.5 },
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
  ],
  harbor: {
    basinRadius: 95, // dredged basin carved into the shore
    basinDepth: 6,
    zoneRadius: 150, // port zone (docking, deliveries, tow completion)
    shelterRadius: 170, // waves die down inside
    shelter: 0.85,
  },
  // Small stations: a fuel dock off the shore facing the origin.
  station: { zoneRadius: 90 },
  lighthouses: [
    { port: 'kettle', at: 'breakwater' },
    { port: 'pellow', at: 'point' },
    { port: 'farrow', at: 'point' },
  ],
};
