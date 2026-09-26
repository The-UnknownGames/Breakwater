// Trade work for boats that carry people or freight (RP direction): passenger
// runs (ferry), charters (yacht) and cargo contracts (ferry vehicles,
// freighter) between ports. Sail to the origin berth, hold there while
// loading, sail to the destination, hold while unloading, get paid (less
// if late). Big ships use each port's anchorage; small ones the port zone.
// Pure JS: called by Jobs for the trade job types.

import { TRADE, JOBS } from '../config/career.js';

const KN = 0.514444;
export const TRADE_TYPES = ['passenger', 'charter', 'cargo'];

export function isTrade(type) {
  return TRADE_TYPES.includes(type);
}

// What this boat can carry: kinds of trade it can take.
export function tradeKinds(cfg) {
  const kinds = [];
  if (cfg.passengers) {
    kinds.push(cfg.passengers <= TRADE.charter.maxHeads ? 'charter' : 'passenger');
  }
  if (cfg.cargoTonnes) {
    kinds.push('cargo');
  }
  return kinds;
}

// Where a boat of this length loads at a port, and how close counts.
export function tradeBerth(shape, port, length) {
  const b = shape.berthFor(port, length);
  const anchored = b === port.anchorage;
  return { x: anchored ? b.x : port.zone.x, z: anchored ? b.z : port.zone.z, r: anchored ? TRADE.berthRadius : port.zone.r };
}

function portName(shape, id) {
  return shape.ports.find((p) => p.id === id).name;
}

export function makeTradeOffer(jobs, player) {
  const kinds = tradeKinds(player.cfg);
  if (!kinds.length) {
    return null;
  }
  const rng = jobs.rng;
  const shape = jobs.shape;
  const ports = shape.ports.filter((p) => !p.minReputation || jobs.career.reputation >= p.minReputation);
  if (ports.length < 2) {
    return null;
  }
  const type = kinds[Math.floor(rng() * kinds.length)];
  const L = player.cfg.hull.length;
  // Often from the port you are nearest to.
  const pos = player.state.pos;
  const byDist = [...ports].sort((a, b) => Math.hypot(a.zone.x - pos.x, a.zone.z - pos.z) - Math.hypot(b.zone.x - pos.x, b.zone.z - pos.z));
  const from = rng() < 0.6 ? byDist[0] : ports[Math.floor(rng() * ports.length)];
  const rest = ports.filter((p) => p !== from);
  const to = rest[Math.floor(rng() * rest.length)];
  const a = tradeBerth(shape, from, L);
  const b = tradeBerth(shape, to, L);
  const km = Math.hypot(b.x - a.x, b.z - a.z) / 1000;
  const fill = TRADE.fill[0] + (TRADE.fill[1] - TRADE.fill[0]) * rng();
  const o = { id: jobs.newId(), type, from: from.id, to: to.id, km, x: a.x, z: a.z, cx: a.x, cz: a.z, seaState: jobs.seaState };
  if (type === 'cargo') {
    o.tonnes = Math.max(5, Math.round((player.cfg.cargoTonnes * fill) / 5) * 5);
    o.pay = Math.round(o.tonnes * (TRADE.cargo.perTonne + TRADE.cargo.perTonneKm * km));
    o.loadSeconds = o.tonnes * TRADE.cargo.loadSecondsPerTonne;
    o.mass = o.tonnes * 1000;
    o.text = `${o.tonnes} t of freight from ${from.name} to ${to.name}`;
  } else {
    const t = TRADE[type];
    o.heads = Math.max(2, Math.round(player.cfg.passengers * fill));
    o.pay = Math.round(o.heads * (t.perHead + t.perHeadKm * km));
    o.loadSeconds = o.heads * t.loadSecondsPerHead;
    o.mass = o.heads * t.headMass;
    o.text = type === 'charter' ? `A party of ${o.heads} out of ${from.name}, set down at ${to.name}` : `${o.heads} passengers, ${from.name} to ${to.name}`;
  }
  o.label = TRADE[type].label;
  const v = player.cfg.targets.topSpeedKn * KN * TRADE.workingSpeed;
  const toOrigin = Math.hypot(a.x - pos.x, a.z - pos.z);
  o.deadlineMin = ((toOrigin + km * 1000) / v / 60) * TRADE.deadlineFactor + (o.loadSeconds * 2) / 60 + TRADE.slackMinutes;
  o.estimate = o.pay;
  o.expires = JOBS.expireSeconds[1];
  return o;
}

export function acceptTrade(jobs, o) {
  const job = { ...o, state: 'active', phase: 'pickup', started: 0, work: 0, delivered: 0, lost: 0, entities: [] };
  jobs.active = job;
  jobs.radio.say(`${portName(jobs.shape, o.from)}: ${o.label.toLowerCase()} booked. ${o.text}. Due in ${Math.round(o.deadlineMin)} min.`, 'info');
  return job;
}

// Loading / unloading progress while held at a berth.
export function trackTrade(jobs, dt, player) {
  const j = jobs.active;
  j.started += dt;
  const L = player.cfg.hull.length;
  const port = j.phase === 'pickup' ? j.from : j.to;
  const p = jobs.shape.ports.find((q) => q.id === port);
  const b = tradeBerth(jobs.shape, p, L);
  const pos = player.state.pos;
  const there = Math.hypot(pos.x - b.x, pos.z - b.z) < b.r && player.speed / KN < TRADE.arriveKn;
  j.atBerth = there;
  if (!there) {
    return;
  }
  j.work += dt;
  if (j.work < j.loadSeconds) {
    return;
  }
  j.work = 0;
  if (j.phase === 'pickup') {
    j.phase = 'enroute';
    player.cargo += j.mass;
    jobs.radio.say(`${p.name}: all aboard. ${j.text}.`, 'info');
    return;
  }
  player.cargo = Math.max(0, player.cargo - j.mass);
  const late = Math.max(0, j.started / 60 - j.deadlineMin);
  const pay = Math.round(j.pay * Math.max(TRADE.minPay, 1 - late * TRADE.latePerMinute));
  jobs.career.addReputation(late > 0 ? 0 : TRADE.reputation);
  jobs.career.earn(pay, `${j.label} to ${p.name}${late > 0 ? ` (${Math.ceil(late)} min late)` : ''}`);
  jobs.radio.say(`${p.name}: ${j.type === 'cargo' ? 'cargo landed' : 'passengers ashore'}. $${pay.toLocaleString()} paid.`, 'info');
  j.state = 'done';
  j.pay = pay;
  jobs.history.push(j);
  jobs.active = null;
}

export function tradeObjective(jobs, player) {
  const j = jobs.active;
  const id = j.phase === 'pickup' ? j.from : j.to;
  const p = jobs.shape.ports.find((q) => q.id === id);
  const b = tradeBerth(jobs.shape, p, player.cfg.hull.length);
  const verb = j.phase === 'pickup' ? (j.type === 'cargo' ? 'Load at' : 'Embark at') : j.type === 'cargo' ? 'Deliver to' : 'Land them at';
  return { x: b.x, z: b.z, label: `${verb} ${p.name}`, exact: true };
}

// HUD prompt while held at a berth.
export function tradePrompt(jobs) {
  const j = jobs.active;
  if (!j || !isTrade(j.type) || !j.atBerth) {
    return null;
  }
  const pct = Math.round((j.work / j.loadSeconds) * 100);
  const what = j.type === 'cargo' ? (j.phase === 'pickup' ? 'Loading cargo' : 'Unloading cargo') : j.phase === 'pickup' ? 'Boarding' : 'Disembarking';
  return `${what}… ${pct}% · hold here`;
}
