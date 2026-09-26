// Upgrade effects (spec 8.5) on a live boat. The boat's cfg is a per-career
// copy (Game clones it), so the base values come from `base` and applying
// again is idempotent. Pure JS (used by the game and the headless tests).

import { UPGRADES } from '../config/upgrades.js';

export function upgradeKey(id, boatId) {
  const u = UPGRADES.find((x) => x.id === id);
  return u && u.perBoat ? `${id}@${boatId}` : id;
}

export function applyUpgrades(sim, base, has) {
  const cfg = sim.cfg;
  const scale = (field) => UPGRADES.filter((u) => u[field] && has(u.id)).reduce((m, u) => m * u[field], 1);
  cfg.fuelLitres = base.fuelLitres * scale('fuelScale');
  cfg.towBreakingKN = base.towBreakingKN * scale('towScale');
  cfg.pumpTonnesPerMin = base.pumpTonnesPerMin * scale('pumpScale');
  if (cfg.prop) {
    cfg.prop.thrustMax = base.prop.thrustMax * scale('thrustScale');
    cfg.prop.vPropMax = base.prop.vPropMax * scale('vPropScale');
  }
  const hull = sim.hull;
  const ratio = hull.fuelMax > 0 ? hull.fuel / hull.fuelMax : 1;
  hull.fuelMax = cfg.fuelLitres;
  hull.fuel = Math.min(hull.fuelMax, ratio * hull.fuelMax);
  hull.pumpRate = cfg.pumpTonnesPerMin / 60;
  hull.damageScale = scale('damageScale');
}
