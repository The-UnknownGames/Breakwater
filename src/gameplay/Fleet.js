// Fleet (RP): hired crews work the owned boats you are not driving. Each
// crewed boat earns its route's gross less wages per hour of sim time; in
// weather beyond the boat it sits in port and only the wages run. Income
// settles to the career every few minutes with a radio line. Pure JS.

import { FLEET } from '../config/career.js';
import { SEA_STATES } from '../config/weather.js';
import { BOAT_PRICES } from '../config/upgrades.js';

const seaIndex = (id) => SEA_STATES.findIndex((s) => s.id === id);

export function hireFee(id) {
  return Math.round((BOAT_PRICES[id] || 10000) * FLEET.hireFee);
}

export class Fleet {
  constructor(career, radio) {
    this.career = career;
    this.radio = radio;
    this.pending = 0;
    this.timer = 0;
    this.status = {}; // boat id -> 'working' | 'in port'
  }

  // Net $/h for a crewed boat in this sea (negative when stormbound).
  rate(id, seaState) {
    const r = FLEET.routes[id];
    if (!r) {
      return 0;
    }
    return seaIndex(seaState) <= seaIndex(r.maxSea) ? r.grossPerHour - r.wagePerHour : -r.wagePerHour;
  }

  update(dt, seaState) {
    const crews = this.career.crews;
    if (!crews.length) {
      return;
    }
    for (const id of crews) {
      const net = this.rate(id, seaState);
      this.status[id] = net > 0 ? 'working' : 'in port';
      this.pending += (net * dt) / 3600;
    }
    this.timer += dt;
    if (this.timer >= FLEET.settleSeconds) {
      this.settle();
    }
  }

  settle() {
    this.timer = 0;
    const amount = Math.round(this.pending);
    this.pending -= amount;
    if (amount === 0) {
      return;
    }
    const n = this.career.crews.length;
    const why = `Fleet: ${n} crew${n > 1 ? 's' : ''}${amount < 0 ? ' (weatherbound, wages)' : ''}`;
    if (amount > 0) {
      this.career.earn(amount, why);
    } else {
      this.career.spend(-amount, why);
    }
    if (this.radio) {
      this.radio.say(`Fleet office: ${amount > 0 ? `$${amount.toLocaleString()} earned by your crews` : `crews weatherbound, $${(-amount).toLocaleString()} in wages`}.`, amount > 0 ? 'info' : 'warn');
    }
  }
}
