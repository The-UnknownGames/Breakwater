// Shipyard (spec 8.5): upgrades and boats. Equipment is shared across boats
// unless perBoat. Effects are applied by gameplay/Upgrades.js.

export const UPGRADES = [
  { id: 'searchlight2', label: 'Searchlight II', effect: '2× range, narrower beam', price: 900 },
  { id: 'fuel2', label: 'Fuel tanks II', effect: '+50% fuel', price: 1200, perBoat: true, fuelScale: 1.5 },
  { id: 'towline2', label: 'Tow line II', effect: '+50% breaking strength', price: 1500, towScale: 1.5 },
  { id: 'pumps2', label: 'Pumps II', effect: '2× pump rate', price: 1800, pumpScale: 2 },
  { id: 'autotension', label: 'Winch auto-tension', effect: 'Pays out on snatch loads (~40% lower peaks)', price: 2000 },
  { id: 'autopilot', label: 'Autopilot', effect: 'T steers to the job; time compression up to 4×', price: 2500 },
  { id: 'plating', label: 'Hull plating', effect: 'Integrity loss −40%', price: 3000, perBoat: true, damageScale: 0.6 },
  { id: 'radar', label: 'Radar', effect: 'Vessels, rafts and rocks on the chart within 3 km', price: 3500 },
  { id: 'engine2', label: 'Engine II', effect: '+15% thrust, +8% top speed', price: 4000, perBoat: true, thrustScale: 1.15, vPropScale: 1.08 },
];

export const BOAT_PRICES = {
  kestrel: 9000,
  bulwark: 24000,
};

// Autopilot time compression (spec 8.4).
export const AUTOPILOT = {
  maxCompression: 4,
  clearRange: 300, // m: no object or job action this close
  maxSeaIndex: 1, // Calm, Moderate
  cruiseFraction: 0.8, // of the boat's top speed
  arriveKn: 2,
  stopDist: 60, // m short of the objective
};
