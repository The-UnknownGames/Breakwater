// Trade work for boats that carry people or freight (RP direction): passenger
// runs (ferry), charters (yacht) and cargo contracts (ferry vehicles,
// freighter) between ports. Sail to the origin berth, hold there while
// loading, sail to the destination, hold while unloading, get paid (less
// if late). Big ships use each port's anchorage; small ones the port zone.
// Ferry timetables chain several legs round the ports on a schedule: each
// arrival is due at a set time, and late passengers complain.
// Pure JS: called by Jobs for the trade job types.

import { TRADE, JOBS } from '../config/career.js';

const KN = 0.514444;
export const TRADE_TYPES = ['passenger', 'charter', 'cargo', 'timetable'];

export function isTrade(type) {
  return TRADE_TYPES.includes(type);
}

// What this boat can carry: kinds of trade it can take.
export function tradeKinds(cfg) {
  const kinds = [];
  if (cfg.passengers) {
    kinds.push(...(cfg.passengers <= TRADE.charter.maxHeads ? ['charter'] : ['passenger', 'timetable']));
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

// Passengers who turn up at a port: more where the service is trusted.
function headsAt(jobs, portId, capacity, fill) {
  const r = TRADE.rating;
  const k = r.headsBase + r.headsPerStar * jobs.career.rating(portId);
  return Math.min(capacity, Math.max(2, Math.round(capacity * fill * k)));
}

export function stars(v) {
  const n = Math.round(v);
  return `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
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
  if (type === 'timetable') {
    return timetableOffer(jobs, player, ports, byDist[0]);
  }
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
    o.heads = type === 'passenger' ? headsAt(jobs, from.id, player.cfg.passengers, fill) : Math.max(2, Math.round(player.cfg.passengers * fill));
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

const clock = (min) => `${Math.floor(min)}:${String(Math.floor((min % 1) * 60)).padStart(2, '0')}`;

// A round of 2-4 legs from the nearest port back to it, calling at some of
// the ports near it. Arrival times are cumulative from acceptance.
function timetableOffer(jobs, player, ports, start) {
  const rng = jobs.rng;
  const t = TRADE.timetable;
  const shape = jobs.shape;
  const L = player.cfg.hull.length;
  // Calls at 1-3 of the four ports nearest the start, in random order.
  const d = (p) => Math.hypot(p.zone.x - start.zone.x, p.zone.z - start.zone.z);
  const near = ports.filter((p) => p !== start).sort((a, b) => d(a) - d(b)).slice(0, 4);
  const calls = 1 + Math.floor(rng() * Math.min(3, near.length));
  const others = near.map((p) => [rng(), p]).sort((a, b) => a[0] - b[0]).slice(0, calls).map(([, p]) => p);
  const stops = [start, ...others, start];
  const v = player.cfg.targets.topSpeedKn * KN * TRADE.workingSpeed;
  const pos = player.state.pos;
  const a0 = tradeBerth(shape, start, L);
  let at = a0;
  const legs = [];
  let min = Math.hypot(a0.x - pos.x, a0.z - pos.z) / v / 60 + t.slackMinutes;
  let km = 0;
  let pay = 0;
  for (let i = 1; i < stops.length; i++) {
    const b = tradeBerth(shape, stops[i], L);
    const legKm = Math.hypot(b.x - at.x, b.z - at.z) / 1000;
    const fill = TRADE.fill[0] + (TRADE.fill[1] - TRADE.fill[0]) * rng();
    const heads = headsAt(jobs, stops[i - 1].id, player.cfg.passengers, fill);
    const loadSeconds = heads * t.loadSecondsPerHead;
    min += (legKm * 1000) / v / 60 * t.deadlineFactor + (loadSeconds * 2) / 60 + t.slackMinutes;
    const legPay = Math.round(heads * (t.perHead + t.perHeadKm * legKm) * t.bonus);
    legs.push({ from: stops[i - 1].id, to: stops[i].id, heads, loadSeconds, mass: heads * t.headMass, due: min, pay: legPay, km: legKm });
    km += legKm;
    pay += legPay;
    at = b;
  }
  const o = { id: jobs.newId(), type: 'timetable', legs, km, x: a0.x, z: a0.z, cx: a0.x, cz: a0.z, seaState: jobs.seaState, label: t.label, pay, estimate: pay, deadlineMin: min, expires: JOBS.expireSeconds[1] };
  o.text = `${start.name} ${stops.slice(1).map((p, i) => `→ ${p.name} ${clock(legs[i].due)}`).join(' ')}`;
  Object.assign(o, legOf(legs[0]));
  return o;
}

// The fields trackTrade() works from, for one timetable leg.
function legOf(leg) {
  return { from: leg.from, to: leg.to, heads: leg.heads, loadSeconds: leg.loadSeconds, mass: leg.mass, legPay: leg.pay };
}

// When the current leg (or the whole run) is due, in job minutes.
function dueMin(j) {
  return j.type === 'timetable' ? j.legs[j.leg].due : j.deadlineMin;
}

const COMPLAINTS = [
  (n) => `a passenger asks when we'll get to ${n}.`,
  (n) => `people are checking their watches. We're due at ${n}.`,
  (n) => `passengers are grumbling: they'll miss connections at ${n}.`,
  (n) => `a queue has formed at the purser's desk. Complaints about the ${n} arrival.`,
  (n) => `passengers are demanding refunds. How far off ${n} are we?`,
];

export function acceptTrade(jobs, o) {
  const job = { ...o, state: 'active', phase: 'pickup', started: 0, work: 0, delivered: 0, lost: 0, entities: [], leg: 0, complaints: 0, paid: 0 };
  jobs.active = job;
  jobs.radio.say(`${portName(jobs.shape, o.from)}: ${o.label.toLowerCase()} booked. ${o.text}.${o.type === 'timetable' ? '' : ` Due in ${Math.round(o.deadlineMin)} min.`}`, 'info');
  return job;
}

// Late on a timetable leg: the passengers let the bridge know.
function complain(jobs, j) {
  const late = j.started - dueMin(j) * 60;
  if (j.type !== 'timetable' || j.phase !== 'enroute' || late < j.complaints * TRADE.timetable.complainEvery) {
    return;
  }
  const say = COMPLAINTS[Math.min(j.complaints, COMPLAINTS.length - 1)];
  jobs.radio.say(`Purser: ${say(portName(jobs.shape, j.to))} ${Math.ceil(late / 60)} min late.`, 'warn');
  j.complaints++;
}

// Loading / unloading progress while held at a berth.
export function trackTrade(jobs, dt, player) {
  const j = jobs.active;
  j.started += dt;
  complain(jobs, j);
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
  const late = Math.max(0, j.started / 60 - dueMin(j));
  if (j.type === 'timetable') {
    arriveLeg(jobs, j, p, late);
    return;
  }
  const pay = Math.round(j.pay * Math.max(TRADE.minPay, 1 - late * TRADE.latePerMinute));
  jobs.career.addReputation(late > 0 ? 0 : TRADE.reputation);
  if (j.type === 'passenger') {
    jobs.career.ratePort(p.id, late);
  }
  jobs.career.earn(pay, `${j.label} to ${p.name}${late > 0 ? ` (${Math.ceil(late)} min late)` : ''}`);
  jobs.radio.say(`${p.name}: ${j.type === 'cargo' ? 'cargo landed' : 'passengers ashore'}. $${pay.toLocaleString()} paid.`, 'info');
  j.state = 'done';
  j.pay = pay;
  jobs.history.push(j);
  jobs.active = null;
}

// A timetable stop: pay this leg, then board for the next (or finish).
function arriveLeg(jobs, j, p, late) {
  const t = TRADE.timetable;
  const pay = Math.round(j.legPay * Math.max(TRADE.minPay, 1 - late * TRADE.latePerMinute));
  const onTime = late <= t.lateGraceMinutes;
  jobs.career.addReputation(onTime ? TRADE.reputation / 2 : t.lateReputation);
  const rating = jobs.career.ratePort(p.id, late);
  jobs.career.earn(pay, `Ferry to ${p.name}${late > 0 ? ` (${Math.ceil(late)} min late)` : ' on time'}`);
  j.paid += pay;
  j.delivered++;
  j.complaints = 0;
  const next = j.legs[j.leg + 1];
  if (next) {
    j.leg++;
    Object.assign(j, legOf(next));
    j.phase = 'pickup';
    jobs.radio.say(`${p.name}: ${onTime ? 'on time' : `${Math.ceil(late)} min late`} · passenger rating ${rating.toFixed(1)} ${stars(rating)}. ${next.heads} boarding for ${portName(jobs.shape, next.to)}, due ${clock(next.due)}.`, onTime ? 'info' : 'warn');
    return;
  }
  jobs.radio.say(`${p.name}: end of the line. $${j.paid.toLocaleString()} taken on the round · passenger rating ${rating.toFixed(1)} ${stars(rating)}.`, 'info');
  j.state = 'done';
  j.pay = j.paid;
  jobs.history.push(j);
  jobs.active = null;
}

export function tradeObjective(jobs, player) {
  const j = jobs.active;
  const id = j.phase === 'pickup' ? j.from : j.to;
  const p = jobs.shape.ports.find((q) => q.id === id);
  const b = tradeBerth(jobs.shape, p, player.cfg.hull.length);
  const verb = j.phase === 'pickup' ? (j.type === 'cargo' ? 'Load at' : 'Embark at') : j.type === 'cargo' ? 'Deliver to' : 'Land them at';
  const left = dueMin(j) - j.started / 60;
  const when = left >= 0 ? `due in ${clock(left)}` : `${Math.ceil(-left)} min late`;
  return { x: b.x, z: b.z, label: `${verb} ${p.name} · ${when}${j.type === 'timetable' ? ` · stop ${j.leg + 1}/${j.legs.length}` : ''}`, exact: true };
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
