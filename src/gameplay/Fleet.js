// Fleet (RP): hired crews work the owned boats you are not driving. Each
// crewed boat earns its route's gross less wages per hour of sim time; in
// weather beyond the boat it sits in port and only the wages run. Income
// settles to the career every few minutes with a radio line. Pure JS.

import { FLEET } from '../config/career.js';
import { SEA_STATES } from '../config/weather.js';
import { BOAT_PRICES } from '../config/upgrades.js';

const seaIndex = (id) => SEA_STATES.findIndex((s) => s.id === id);

const name = (id) => `${id[0].toUpperCase()}${id.slice(1)}`;

export function hireFee(id) {
  return Math.round((BOAT_PRICES[id] || 10000) * FLEET.hireFee);
}

export class Fleet {
  constructor(career, radio, rng = Math.random) {
    this.career = career;
    this.radio = radio;
    this.rng = rng;
    this.pending = 0;
    this.timer = 0;
    this.status = {}; // boat id -> 'working' | 'in port' | 'broken down' | 'at the yard'
    this.down = {}; // boat id -> true while broken down (a job is out)
    this.idle = {}; // boat id -> seconds left at the yard
    this.onBreakdown = null; // (id) => void: post the call as a job
  }

  // Chance per hour that a working crew loses her engine in this sea.
  breakdownRate(id, seaState) {
    const r = FLEET.routes[id];
    const b = FLEET.breakdown.perHour;
    const gap = seaIndex(r.maxSea) - seaIndex(seaState);
    return gap <= 0 ? b.atLimit : gap === 1 ? b.oneBelow : b.fair;
  }

  // The player brought her home: back to work.
  recovered(id) {
    delete this.down[id];
    this.radio?.say(`Fleet office: the ${name(id)} is back on her route. Thanks, skipper.`, 'info');
  }

  // Nobody fetched her: the yard tows her in, and bills for it.
  lost(id) {
    delete this.down[id];
    const cost = Math.round((BOAT_PRICES[id] || 10000) * FLEET.breakdown.repairShare);
    this.idle[id] = FLEET.breakdown.idleMinutes * 60;
    this.career.spend(cost, `Yard tow and repairs: the ${name(id)}`);
    this.radio?.say(`Fleet office: the yard fetched the ${name(id)}. $${cost.toLocaleString()}, and her crew is idle for ${FLEET.breakdown.idleMinutes} min.`, 'warn');
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
      if (this.down[id]) {
        this.status[id] = 'broken down';
        continue;
      }
      if (this.idle[id] > 0) {
        this.idle[id] -= dt;
        this.status[id] = 'at the yard';
        continue;
      }
      const net = this.rate(id, seaState);
      this.status[id] = net > 0 ? 'working' : 'in port';
      this.pending += (net * dt) / 3600;
      if (net > 0 && this.onBreakdown && this.rng() < (this.breakdownRate(id, seaState) * dt) / 3600) {
        this.down[id] = true;
        this.status[id] = 'broken down';
        this.onBreakdown(id);
      }
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
