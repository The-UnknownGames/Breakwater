// Headless career loop (spec 14 V4): accept a job from the board, do it with
// the autopilot helper, bring it home to Kettle Harbor, get paid. Same
// Operations / Jobs / Career code as the game; nothing is teleported.

import { makeSim } from './boatTests.mjs';
import { Operations } from '../../src/gameplay/Operations.js';
import { Autopilot } from '../../src/gameplay/Autopilot.js';
import { Jobs } from '../../src/gameplay/Jobs.js';
import { Career } from '../../src/gameplay/Career.js';
import { Radio } from '../../src/gameplay/Radio.js';
import { WorldShape } from '../../src/world/WorldShape.js';
import { DepthMap } from '../../src/ocean/DepthMap.js';
import { mulberry32 } from '../../src/core/Rng.js';
import { TOW } from '../../src/config/tow.js';

const KN = 0.514444;

async function rig(cfg) {
  const shape = new WorldShape();
  const seabed = new DepthMap(shape);
  const sim = await makeSim(cfg, undefined, { x: 0, z: 0, heading: 5.3 }, { seabed });
  sim.waves.shelters = shape.shelters;
  const ops = new Operations(sim.physics, sim.boat, { seaState: 'calm' });
  const career = new Career();
  const radio = new Radio();
  const jobs = new Jobs(ops, career, shape, mulberry32(5), radio);
  jobs.timer = Infinity; // no random offers during the test
  const home = shape.ports.find((p) => p.home);
  return { sim, ops, career, jobs, shape, home, ap: new Autopilot(sim.boat) };
}

// Route into Kettle Harbor: channel mouth, then the harbor zone.
function homeRoute(home) {
  return [
    { x: home.center.x + home.out.x * 470, z: home.center.z + home.out.z * 470 },
    { x: home.center.x + home.out.x * 170, z: home.center.z + home.out.z * 170 },
    { x: home.zone.x, z: home.zone.z },
  ];
}

export async function towJob(cfg) {
  const { sim, ops, career, jobs, home, ap } = await rig(cfg);
  const o = jobs.makeOffer({ x: 0, z: 0 });
  Object.assign(o, { type: 'tow', vessel: 'trawler', name: 'Test', x: -260, z: 180, heading: 2.2, label: 'Disabled vessel', seaState: 'calm' });
  jobs.offers.push(o);
  jobs.accept(o.id);
  const target = jobs.active.target;
  const route = homeRoute(home);
  let leg = 0;
  let phase = 'approach';
  const log = { money0: career.money, rep0: career.reputation };
  const s = sim.boat.state;
  sim.run(900, (w) => {
    const dt = w.physics.dt;
    const cmd = { tow: 0, winch: 0, action: 0 };
    const tp = target.sim.state.pos;
    const fwd = target.sim.forward;
    const bow = { x: tp.x + fwd.x * 8, z: tp.z + fwd.z * 8 };
    if (phase === 'approach') {
      const side = { x: fwd.z, z: -fwd.x };
      const abeam = { x: tp.x + side.x * 14 - fwd.x * 6, z: tp.z + side.z * 14 - fwd.z * 6 };
      if (ap.update(dt, abeam, { cruiseKn: 10, arriveKn: 3, stopDist: 6 }) < 8) {
        phase = 'lineup';
      }
    } else if (phase === 'lineup') {
      ap.update(dt, { x: bow.x + fwd.x * 12, z: bow.z + fwd.z * 12 }, { cruiseKn: 4, arriveKn: 0.5, stopDist: 2 });
      const c = ops.attachCandidate();
      if (c.target && c.distance < TOW.attachRange - 0.5 && w.boat.speed / KN < TOW.attachMaxKn) {
        cmd.tow = 1;
        phase = 'tow';
      }
    } else if (phase === 'tow') {
      cmd.winch = ops.line && ops.line.length > 30 ? -1 : 0;
      const wp = route[leg];
      const last = leg === route.length - 1;
      const d = ap.update(dt, wp, { cruiseKn: last ? 3 : 7, arriveKn: last ? 1 : 4, stopDist: last ? 25 : 30 });
      if (d < (last ? 60 : 40) && !last) {
        leg++;
      }
      if (last && jobs.shape.portAt(tp.x, tp.z)) {
        cmd.tow = 1;
        phase = 'cast';
      }
    } else {
      ap.stop(dt);
    }
    ops.step(dt, cmd, w.waves, w.waves.time, w.env);
    jobs.update(dt, sim.boat, 'calm');
    return !(jobs.history.length && phase === 'cast');
  });
  const j = jobs.history[0];
  log.state = j ? j.state : jobs.active ? 'active' : 'none';
  log.pay = career.money - log.money0;
  log.rep = career.reputation - log.rep0;
  log.time = sim.t;
  log.pos = { x: s.pos.x, z: s.pos.z };
  return log;
}

export async function rescueJob(cfg) {
  const { sim, ops, career, jobs, home, ap } = await rig(cfg);
  const o = jobs.makeOffer({ x: 0, z: 0 });
  Object.assign(o, { type: 'pw', people: 2, x: -150, z: 250, label: 'Person in the water', seaState: 'calm' });
  jobs.offers.push(o);
  jobs.accept(o.id);
  const route = homeRoute(home);
  let leg = 0;
  const log = { money0: career.money };
  sim.run(600, (w) => {
    const dt = w.physics.dt;
    const cmd = { tow: 0, winch: 0, action: 0 };
    const next = ops.field.waiting().sort((a, b) => ops.hullDistance(a.x, a.z) - ops.hullDistance(b.x, b.z))[0];
    if (next) {
      const d = ops.hullDistance(next.x, next.z);
      if (ops.pull || d < 3) {
        ap.stop(dt);
        if (!ops.pull && w.boat.speed / KN < 2) {
          cmd.action = 1;
        }
      } else {
        ap.update(dt, next, { cruiseKn: 10, arriveKn: 1, stopDist: 3, creep: true });
      }
    } else {
      const wp = route[leg];
      if (ap.update(dt, wp, { cruiseKn: 12, arriveKn: 3, stopDist: 20 }) < 45 && leg < route.length - 1) {
        leg++;
      }
      const port = jobs.shape.portAt(w.boat.state.pos.x, w.boat.state.pos.z);
      if (port && ops.aboard > 0) {
        jobs.deliver(port);
      }
    }
    ops.step(dt, cmd, w.waves, w.waves.time, w.env);
    jobs.update(dt, sim.boat, 'calm');
    return jobs.history.length === 0;
  });
  const j = jobs.history[0];
  return { state: j ? j.state : 'active', pay: career.money - log.money0, rep: career.reputation, time: sim.t, delivered: j ? j.delivered : 0 };
}

// Shipyard: buying upgrades rewrites the live boat (fuel, tow line, pumps,
// engine, plating) and a second purchase of the same thing is refused.
export async function upgrades(cfg) {
  const { applyUpgrades } = await import('../../src/gameplay/Upgrades.js');
  const { UPGRADES } = await import('../../src/config/upgrades.js');
  const sim = await makeSim(structuredClone(cfg));
  const career = new Career();
  career.money = 30000;
  const bought = UPGRADES.filter((u) => career.buyUpgrade(u.id, cfg.id)).length;
  const again = career.buyUpgrade('engine2', cfg.id);
  applyUpgrades(sim.boat, cfg, (id) => career.has(id, cfg.id));
  const h = sim.boat.hull;
  const c = sim.boat.cfg;
  h.damage(10);
  const boat = career.buyBoat('kestrel') && !career.buyBoat('kestrel') && career.boats.includes('kestrel');
  return {
    boat,
    bought,
    again,
    spent: 30000 - career.money,
    fuel: h.fuelMax / cfg.fuelLitres,
    tow: c.towBreakingKN / cfg.towBreakingKN,
    pump: h.pumpRate / (cfg.pumpTonnesPerMin / 60),
    thrust: c.prop.thrustMax / cfg.prop.thrustMax,
    integrity: h.integrity,
    base: cfg.prop.thrustMax === 9200,
  };
}

// Trade (RP work): a passenger run or cargo contract from Kettle Harbor to
// Pellow Point with the autopilot: hold at the anchorage while loading, sail
// across, hold while unloading, get paid on time.
export async function tradeJob(cfg, type) {
  const { makeTradeOffer, tradeBerth } = await import('../../src/gameplay/Trade.js');
  const shape = new WorldShape();
  const seabed = new DepthMap(shape);
  const home = shape.ports.find((p) => p.home);
  const start = shape.berthFor(home, cfg.hull.length);
  const sim = await makeSim(structuredClone(cfg), undefined, { x: start.x, z: start.z, heading: start.heading }, { seabed });
  const ops = new Operations(sim.physics, sim.boat, { seaState: 'calm' });
  const career = new Career();
  const jobs = new Jobs(ops, career, shape, mulberry32(9), new Radio());
  jobs.timer = Infinity;
  jobs.player = sim.boat;
  let o = null;
  for (let i = 0; i < 40 && !(o && o.type === type && o.from === 'kettle' && o.to === 'pellow'); i++) {
    o = makeTradeOffer(jobs, sim.boat);
  }
  jobs.offers.push(o);
  jobs.accept(o.id);
  const ap = new Autopilot(sim.boat);
  const money0 = career.money;
  let draftLoaded = 0;
  sim.run(1800, (w) => {
    const dt = w.physics.dt;
    const j = jobs.active;
    if (j) {
      const port = shape.ports.find((p) => p.id === (j.phase === 'pickup' ? j.from : j.to));
      const b = tradeBerth(shape, port, cfg.hull.length);
      const d = Math.hypot(b.x - w.boat.state.pos.x, b.z - w.boat.state.pos.z);
      if (d < b.r * 0.6 && w.boat.speed / 0.514444 < 2) {
        ap.stop(dt);
      } else {
        ap.update(dt, b, { cruiseKn: cfg.targets.topSpeedKn * 0.8, arriveKn: 1, stopDist: b.r * 0.4 });
      }
      if (j.phase === 'enroute' && !draftLoaded) {
        draftLoaded = w.boat.cargo;
      }
    }
    ops.step(dt, { tow: 0, winch: 0, action: 0 }, w.waves, w.waves.time, w.env);
    jobs.update(dt, sim.boat, 'calm');
    return jobs.history.length === 0;
  });
  const j = jobs.history[0];
  return { state: j ? j.state : 'active', offered: o.pay, paid: career.money - money0, minutes: sim.t / 60, due: o.deadlineMin, loadedKg: draftLoaded, cargoAfter: sim.boat.cargo };
}
