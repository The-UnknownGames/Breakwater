// Jobs (spec 8.1-8.3): offers appear on the radio / job board, one active
// job at a time. Accepting spawns the scene through Operations (people in
// the water, a raft, a disabled or swamped vessel, a sinking vessel with
// crew). Success and failure are judged here; money and reputation go
// through Career. Pure JS (shared with the headless tests).

import { JOBS, REPUTATION, TRADE } from '../config/career.js';
import { SEA_STATES } from '../config/weather.js';
import { isTrade, tradeKinds, makeTradeOffer, acceptTrade, trackTrade, tradeObjective } from './Trade.js';

let nextId = 1;
const KN = 0.514444;

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function between(rng, [a, b]) {
  return a + (b - a) * rng();
}

export function weatherMultiplier(seaState) {
  const s = SEA_STATES.find((x) => x.id === seaState);
  return s ? s.payout : 1;
}

export class Jobs {
  constructor(ops, career, shape, rng, radio) {
    this.ops = ops;
    this.career = career;
    this.shape = shape;
    this.rng = rng;
    this.radio = radio;
    this.offers = [];
    this.active = null;
    this.timer = 5;
    this.seaState = 'calm';
    this.history = [];
  }

  newId() {
    return nextId++;
  }

  // ---- offers ----
  makeOffer(near) {
    const rng = this.rng;
    const kinds = Object.entries(JOBS.types);
    let total = 0;
    for (const [, t] of kinds) {
      total += t.weight;
    }
    let r = rng() * total;
    let type = kinds[0][0];
    for (const [id, t] of kinds) {
      r -= t.weight;
      if (r <= 0) {
        type = id;
        break;
      }
    }
    // Somewhere in open water, a sensible distance from the player.
    let pos = null;
    for (let i = 0; i < 40 && !pos; i++) {
      const p = this.shape.openWater(rng, 25);
      const d = Math.hypot(p.x - near.x, p.z - near.z);
      if (d > JOBS.offerRange[0] && d < JOBS.offerRange[1]) {
        pos = p;
      }
    }
    pos = pos || this.shape.openWater(rng, 25);
    const cfg = JOBS.types[type];
    const offer = {
      id: nextId++,
      type,
      label: cfg.label,
      x: pos.x,
      z: pos.z,
      // Search-area centre: the reported position is approximate.
      cx: pos.x + (rng() - 0.5) * JOBS.uncertainty,
      cz: pos.z + (rng() - 0.5) * JOBS.uncertainty,
      expires: between(rng, JOBS.expireSeconds),
      seaState: this.seaState,
    };
    if (type === 'tow' || type === 'swamped') {
      offer.vessel = type === 'swamped' ? 'trawler' : rng() < 0.5 ? 'sailboat' : 'trawler';
      offer.name = pick(rng, JOBS.vessels[offer.vessel].names);
      offer.heading = rng() * Math.PI * 2;
    } else {
      offer.people = Math.round(between(rng, cfg.people));
      offer.source = type === 'crew' ? `trawler ${pick(rng, JOBS.vessels.trawler.names)}` : pick(rng, JOBS.sources);
      if (type === 'crew') {
        offer.sinkMinutes = between(rng, cfg.sinkMinutes);
      }
    }
    offer.estimate = this.estimate(offer);
    offer.text = this.describe(offer);
    return offer;
  }

  describe(o) {
    if (o.type === 'pw') {
      return `${o.people} overboard from the ${o.source}`;
    }
    if (o.type === 'raft') {
      return `Life raft with ${o.people} aboard, from the ${o.source}`;
    }
    if (o.type === 'crew') {
      return `The ${o.source} is sinking with ${o.people} crew`;
    }
    if (o.type === 'swamped') {
      return `The ${o.vessel} ${o.name} is swamped: pump her out and tow her in`;
    }
    return `The ${o.vessel} ${o.name} has lost her engine: tow her in`;
  }

  // Expected pay at full success (shown on the board).
  estimate(o) {
    const m = weatherMultiplier(o.seaState);
    const cfg = JOBS.types[o.type];
    if (o.type === 'tow' || o.type === 'swamped') {
      const towMult = 1 + (m - 1) / 2;
      const base = JOBS.vessels[o.vessel].value * JOBS.towShare * towMult;
      return Math.round(base + (o.type === 'swamped' ? cfg.bonus * m : 0));
    }
    return Math.round((cfg.base + cfg.per * o.people) * m);
  }

  update(dt, player, seaState) {
    this.player = player;
    this.seaState = seaState;
    const call = (SEA_STATES.find((s) => s.id === seaState) || { callRate: 1 }).callRate;
    for (const o of this.offers) {
      o.expires -= dt;
    }
    this.offers = this.offers.filter((o) => o.expires > 0);
    this.timer -= dt * call;
    const cap = JOBS.maxOffers(this.career.reputation);
    if (this.timer <= 0) {
      this.timer = between(this.rng, JOBS.intervalSeconds);
      if (this.offers.length < cap) {
        // Boats that carry people or freight also get trade work.
        const trade = tradeKinds(player.cfg).length && this.rng() < TRADE.offerChance ? makeTradeOffer(this, player) : null;
        if (trade) {
          this.offers.push(trade);
          this.radio.say(`Kettle Harbor: ${trade.label.toLowerCase()} available · ${trade.text}. Pays $${trade.pay.toLocaleString()}.`, 'info');
        } else {
          const o = this.makeOffer(player.state.pos);
          this.offers.push(o);
          this.radio.say(`MAYDAY · ${o.text}. Search area ${this.bearingText(player, o.cx, o.cz)}. Pays ~$${o.estimate.toLocaleString()}.`, 'mayday');
        }
      }
    }
    if (this.active) {
      this.track(dt, player);
    }
  }

  bearingText(player, x, z) {
    const p = player.state.pos;
    const d = Math.hypot(x - p.x, z - p.z);
    const b = ((Math.atan2(x - p.x, -(z - p.z)) * 180) / Math.PI + 360) % 360;
    return `${(d / 1852).toFixed(1)} nm, ${String(Math.round(b) % 360).padStart(3, '0')}°`;
  }

  // ---- accept / spawn ----
  accept(id) {
    const o = this.offers.find((x) => x.id === id);
    if (!o || this.active) {
      return false;
    }
    this.offers = this.offers.filter((x) => x !== o);
    if (isTrade(o.type)) {
      acceptTrade(this, o);
      return true;
    }
    const job = { ...o, state: 'active', delivered: 0, lost: 0, entities: [], started: 0 };
    const ops = this.ops;
    const rng = this.rng;
    if (o.type === 'pw') {
      for (let i = 0; i < o.people; i++) {
        const s = ops.addSurvivor(o.x + (rng() - 0.5) * 30, o.z + (rng() - 0.5) * 30);
        s.job = job.id;
        job.entities.push(s);
      }
    } else if (o.type === 'raft') {
      const raft = ops.addRaft(o.x, o.z, o.people);
      for (const s of raft.occupants) {
        s.job = job.id;
        job.entities.push(s);
      }
    } else if (o.type === 'crew') {
      const t = ops.addTarget('trawler', o.x, o.z, rng() * 6.28, { crew: o.people, job: job.id, leak: 0 });
      // Sinking on a clock: floods to foundering in about sinkMinutes, never
      // less than it takes to get there at working speed, search and
      // transfer the crew.
      job.sinkMinutes = this.sinkMinutes(o);
      t.sim.hull.extraLeak = t.sim.hull.founderAt / (job.sinkMinutes * 60);
      job.target = t;
    } else {
      const t = ops.addTarget(o.vessel, o.x, o.z, o.heading, { job: job.id });
      if (o.type === 'swamped') {
        t.sim.hull.flood = t.sim.hull.founderAt * 0.5;
      }
      job.target = t;
    }
    this.active = job;
    const clock = job.sinkMinutes ? ` She has about ${Math.round(job.sinkMinutes)} minutes.` : '';
    this.radio.say(`Kettle Harbor: understood, ${o.label.toLowerCase()} is yours. ${o.text}.${clock}`, 'info');
    return true;
  }

  sinkMinutes(o) {
    const pl = this.player;
    if (!pl) {
      return o.sinkMinutes;
    }
    const p = pl.state.pos;
    const d = Math.hypot(o.x - p.x, o.z - p.z);
    const v = pl.cfg.targets.topSpeedKn * KN * JOBS.sinkWorkingSpeed;
    const reach = d / v / 60;
    return Math.max(o.sinkMinutes, reach * JOBS.sinkTravelFactor + JOBS.sinkSlackMinutes + (o.people * JOBS.crewTransferSeconds) / 60);
  }

  abandon() {
    if (!this.active) {
      return;
    }
    const j = this.active;
    this.fail(j, 'abandoned');
  }

  // ---- progress ----
  track(dt, player) {
    const j = this.active;
    if (isTrade(j.type)) {
      trackTrade(this, dt, player);
      return;
    }
    j.started += dt;
    if (j.type === 'pw' || j.type === 'raft' || j.type === 'crew') {
      const lost = this.ops.field.survivors.filter((s) => s.job === j.id && s.state === 'lost').length;
      if (lost > j.lost) {
        this.career.addReputation(REPUTATION.perLifeLost * (lost - j.lost));
        j.lost = lost;
      }
      if (j.type === 'crew' && j.target && j.target.sim.hull.foundered && j.target.crew > 0) {
        this.career.addReputation(REPUTATION.perLifeLost * j.target.crew);
        j.lost += j.target.crew;
        j.target.crew = 0;
      }
      const total = j.people;
      const waiting = this.ops.field.survivors.filter((s) => s.job === j.id && (s.state === 'water' || s.state === 'raft')).length;
      const aboard = this.ops.field.survivors.filter((s) => s.job === j.id && s.state === 'aboard').length;
      const crewLeft = j.type === 'crew' && j.target ? j.target.crew : 0;
      if (j.delivered + j.lost >= total || (waiting === 0 && aboard === 0 && crewLeft === 0 && j.delivered + j.lost > 0)) {
        if (j.delivered > 0) {
          this.succeed(j);
        } else {
          this.fail(j, 'lost');
        }
      }
    } else {
      const t = j.target;
      if (!t || t.sim.hull.foundered || !this.ops.targets.includes(t)) {
        this.career.addReputation(REPUTATION.perLostTow);
        this.fail(j, 'sank');
        return;
      }
      // Delivered: inside a port zone and the line cast off.
      const port = this.shape.portAt(t.sim.state.pos.x, t.sim.state.pos.z);
      if (port && this.ops.lineTarget !== t) {
        this.succeed(j, port);
      }
    }
  }

  // Survivors aboard are handed over at any port with a drop-off.
  deliver(port) {
    let paid = 0;
    const done = this.ops.field.survivors.filter((s) => s.state === 'aboard');
    if (!done.length) {
      return 0;
    }
    for (const s of done) {
      s.state = 'delivered';
      const j = this.active && this.active.id === s.job ? this.active : null;
      const type = j ? j.type : 'pw';
      const m = weatherMultiplier(j ? j.seaState : this.seaState);
      paid += Math.round(JOBS.types[type].per * m);
      if (j) {
        j.delivered++;
      }
      this.career.addReputation(REPUTATION.perSurvivor);
    }
    this.ops.aboard = 0;
    this.ops.player.payload = 0;
    this.career.earn(paid, `${done.length} survivor${done.length > 1 ? 's' : ''} delivered to ${port.name}`);
    return paid;
  }

  succeed(j, port = null) {
    const m = weatherMultiplier(j.seaState);
    const cfg = JOBS.types[j.type];
    let pay = 0;
    if (j.type === 'tow' || j.type === 'swamped') {
      const t = j.target;
      const h = t.sim.hull;
      const condition = Math.max(0, Math.min(1, (h.integrity / 100) * (1 - 0.5 * h.floodRatio)));
      pay = JOBS.vessels[j.vessel].value * JOBS.towShare * condition * (1 + (m - 1) / 2);
      if (j.type === 'swamped' && t.pumped >= cfg.pumpSeconds) {
        pay += cfg.bonus * m;
      }
      this.career.addReputation(REPUTATION.perTow);
      // The vessel is handed over to the harbor.
      this.ops.removeTarget(t);
    } else {
      pay = cfg.base * m;
    }
    pay = Math.round(pay);
    this.career.earn(pay, `${j.label} complete${port ? ` at ${port.name}` : ''}`);
    this.radio.say(`Kettle Harbor: good work. $${pay.toLocaleString()} paid.`, 'info');
    j.state = 'done';
    j.pay = pay;
    this.history.push(j);
    this.active = null;
  }

  fail(j, why) {
    j.state = 'failed';
    if (isTrade(j.type) && j.phase === 'enroute' && this.player) {
      this.player.cargo = Math.max(0, this.player.cargo - j.mass);
    }
    this.radio.say(
      why === 'abandoned' ? 'Kettle Harbor: job abandoned. Someone else will have to go.' : why === 'sank' ? 'Kettle Harbor: she has gone down. Job failed.' : 'Kettle Harbor: nobody made it. Job failed.',
      'warn',
    );
    if (why === 'abandoned' && j.target) {
      this.ops.removeTarget(j.target);
    }
    this.history.push(j);
    this.active = null;
  }

  // Where to steer for the active job: the exact spot once close,
  // otherwise the centre of the search area.
  objective(player) {
    const j = this.active;
    if (!j) {
      return null;
    }
    if (isTrade(j.type)) {
      return tradeObjective(this, player);
    }
    const p = player.state.pos;
    let x = j.x;
    let z = j.z;
    if (j.target) {
      x = j.target.sim.state.pos.x;
      z = j.target.sim.state.pos.z;
    } else {
      const w = this.ops.field.survivors.find((s) => s.job === j.id && (s.state === 'water' || s.state === 'raft'));
      if (w) {
        x = w.x;
        z = w.z;
      }
    }
    const exact = Math.hypot(x - p.x, z - p.z) < JOBS.revealRange;
    const aboard = this.ops.field.survivors.some((s) => s.job === j.id && s.state === 'aboard');
    const towing = j.target && this.ops.lineTarget === j.target;
    if (towing || (aboard && !this.ops.field.survivors.some((s) => s.job === j.id && (s.state === 'water' || s.state === 'raft')) && !(j.target && j.target.crew))) {
      const port = this.nearestPort(p, !towing);
      return { x: port.zone.x, z: port.zone.z, label: `Return to ${port.name}`, exact: true };
    }
    return exact ? { x, z, label: j.label, exact: true } : { x: j.cx, z: j.cz, label: `${j.label} · search area`, exact: false };
  }

  nearestPort(p, dropoffOnly) {
    let best = null;
    let bd = Infinity;
    for (const port of this.shape.ports) {
      if (dropoffOnly && !port.services.includes('dropoff')) {
        continue;
      }
      if (port.minReputation && this.career.reputation < port.minReputation) {
        continue;
      }
      const d = Math.hypot(port.zone.x - p.x, port.zone.z - p.z);
      if (d < bd) {
        bd = d;
        best = port;
      }
    }
    return best;
  }

  speedKn(sim) {
    return sim.speed / KN;
  }
}
