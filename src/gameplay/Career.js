// Career state (spec 8.2, 8.5, 8.6): money, reputation, boats and upgrades,
// port services (fuel, repairs), tow-home rescues, save/load. Pure JS.

import { ECONOMY } from '../config/career.js';

const SAVE_KEY = 'breakwater.career.v1';

export class Career {
  constructor(storage = null) {
    this.storage = storage;
    this.money = ECONOMY.startMoney;
    this.reputation = 0;
    this.boats = ['marlin'];
    this.boat = 'marlin';
    this.upgrades = [];
    this.ledger = [];
    this.listeners = [];
    this.bailedOut = false;
    this.bankrupt = false;
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  notify(entry) {
    for (const fn of this.listeners) {
      fn(entry);
    }
  }

  earn(amount, why) {
    this.money += amount;
    const e = { amount, why };
    this.ledger.push(e);
    this.notify(e);
  }

  spend(amount, why) {
    this.money -= amount;
    const e = { amount: -amount, why };
    this.ledger.push(e);
    this.checkBankrupt();
    this.notify(e);
  }

  addReputation(d) {
    this.reputation = Math.max(0, Math.min(100, this.reputation + d));
  }

  // Once, the harbormaster covers a debt past the limit; then it's over.
  checkBankrupt() {
    if (this.money > ECONOMY.bankruptcy) {
      return;
    }
    if (!this.bailedOut) {
      this.bailedOut = true;
      this.money = 0;
      this.ledger.push({ amount: 0, why: 'Harbormaster covered your debts (once)' });
    } else {
      this.bankrupt = true;
    }
  }

  refuelCost(hull) {
    return Math.round((hull.fuelMax - hull.fuel) * ECONOMY.fuelPerLitre);
  }

  repairCost(hull, boatId) {
    return Math.round((100 - hull.integrity) * (ECONOMY.repairPerPercent[boatId] || 12));
  }

  refuel(hull) {
    const cost = this.refuelCost(hull);
    if (cost <= 0) {
      return 0;
    }
    hull.fuel = hull.fuelMax;
    this.spend(cost, 'Fuel');
    return cost;
  }

  repair(hull, boatId, propulsion) {
    const cost = this.repairCost(hull, boatId);
    hull.integrity = 100;
    hull.flood = 0;
    hull.extraLeak = 0;
    if (propulsion && hull.fuel > 0) {
      propulsion.enabled = true;
    }
    if (cost > 0) {
      this.spend(cost, 'Repairs');
    }
    return cost;
  }

  towHome(hull, boatId) {
    const cost = ECONOMY.towHomeFee + this.repairCost(hull, boatId);
    this.spend(cost, 'Towed home + repairs');
    return cost;
  }

  serialize(extra = {}) {
    return {
      v: 1,
      money: this.money,
      reputation: this.reputation,
      boats: this.boats,
      boat: this.boat,
      upgrades: this.upgrades,
      bailedOut: this.bailedOut,
      ...extra,
    };
  }

  save(extra) {
    if (!this.storage) {
      return false;
    }
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.serialize(extra)));
      return true;
    } catch {
      return false;
    }
  }

  static load(storage) {
    try {
      const raw = storage && storage.getItem(SAVE_KEY);
      if (!raw) {
        return null;
      }
      const d = JSON.parse(raw);
      const c = new Career(storage);
      Object.assign(c, { money: d.money, reputation: d.reputation, boats: d.boats, boat: d.boat, upgrades: d.upgrades || [], bailedOut: d.bailedOut });
      c.saved = d;
      return c;
    } catch {
      return null;
    }
  }

  static clear(storage) {
    try {
      storage.removeItem(SAVE_KEY);
    } catch {
      // storage unavailable
    }
  }
}
