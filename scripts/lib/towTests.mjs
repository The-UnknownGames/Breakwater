// Headless tow, rescue, flooding and grounding measurements (spec 17.1, V3).
// Everything goes through Operations/TowLine/Autopilot, the same code the
// game runs; nothing is teleported once a scenario starts.

import { makeSim } from './boatTests.mjs';
import { Operations } from '../../src/gameplay/Operations.js';
import { RESCUE } from '../../src/config/rescue.js';
import { Autopilot } from '../../src/gameplay/Autopilot.js';
import { DepthMap } from '../../src/ocean/DepthMap.js';
import { SEA_STATES, WEATHER } from '../../src/config/weather.js';
import { TOW } from '../../src/config/tow.js';

const KN = 0.514444;
const NO_CMD = { tow: 0, winch: 0, action: 0 };

function sea(id) {
  if (!id) {
    return undefined;
  }
  return { ...SEA_STATES.find((s) => s.id === id), windDirectionDeg: WEATHER.windDirectionDeg };
}

// Marlin + one target on a line of `length` m, target astern, both heading
// `heading` (compass rad).
async function towRig(cfg, kind, opts = {}) {
  const heading = opts.heading ?? 0;
  const sim = await makeSim(cfg, sea(opts.sea), { heading }, { current: false });
  const ops = new Operations(sim.physics, sim.boat, { autoTension: opts.autoTension, seaState: opts.sea });
  const back = { x: -Math.sin(heading), z: Math.cos(heading) };
  // Spaced from the tow point, so the line starts the same whatever the
  // hook position (the rig was laid out for a bitt 1.3 m from the stern).
  const hookFwd = (cfg.towPointFromStern ?? 1.3) - 1.3;
  const gap = cfg.hull.length / 2 - hookFwd + (opts.length ?? 40) + 8;
  const target = ops.addTarget(kind, back.x * gap, back.z * gap, heading);
  sim.run(3);
  ops.attach(target);
  ops.line.length = ops.line.setLength = opts.length ?? 40;
  sim.ops = ops;
  sim.each = (fn) => (s) => {
    ops.step(s.physics.dt, NO_CMD, s.waves, s.waves.time, s.env);
    return fn ? fn(s) : true;
  };
  return sim;
}

// Steady tow speed at full throttle in calm water (kn).
export async function towSpeed(cfg, kind) {
  const sim = await towRig(cfg, kind, { length: 40 });
  sim.boat.input.throttle = 1;
  sim.run(100, sim.each());
  let sum = 0;
  let n = 0;
  let tension = 0;
  sim.run(20, sim.each((s) => {
    sum += s.boat.forwardSpeed;
    tension += s.ops.line.tension;
    n++;
  }));
  return { kn: sum / n / KN, tension: tension / n, broken: !sim.ops.line };
}

// Peak and mean tension towing at `throttle` for `seconds`.
export async function towLoads(cfg, kind, seaId, throttle, opts = {}) {
  const sim = await towRig(cfg, kind, { length: 30, sea: seaId, autoTension: opts.autoTension, heading: opts.heading ?? 3.6 });
  sim.boat.input.throttle = throttle;
  sim.run(25, sim.each());
  let peak = 0;
  let sum = 0;
  let n = 0;
  let broke = false;
  sim.run(opts.seconds ?? 90, sim.each((s) => {
    if (!s.ops.line) {
      broke = true;
      return false;
    }
    peak = Math.max(peak, s.ops.line.tension);
    sum += s.ops.line.tension;
    n++;
    return true;
  }));
  return { peak, mean: sum / Math.max(1, n), broke };
}

// Ramp an opposing pull on both hulls until the line parts; returns the
// tension (N) when it broke and how long it held above the rating.
export async function breakTest(cfg, kind, rampNps = 20000, stepN = 0) {
  const sim = await towRig(cfg, kind, { length: 20 });
  const line = sim.ops.line;
  let pull = stepN;
  let over = 0;
  let brokeAt = null;
  let time = 0;
  const B = line.breakingN;
  const tug = sim.boat;
  const tgt = sim.ops.targets[0].sim;
  const push = (sign) => (s, f) => {
    f.fz += sign * pull;
  };
  tug.extraForces.push(push(-1));
  tgt.extraForces.push(push(1));
  sim.run(60, sim.each((s) => {
    pull += rampNps * s.physics.dt;
    time += s.physics.dt;
    if (!line.broken) {
      over = line.tension > B ? over + s.physics.dt : 0;
      brokeAt = line.maxTension;
      return true;
    }
    return false;
  }));
  return { broken: line.broken, tension: Math.max(brokeAt ?? 0, line.maxTension), over, rating: B, time };
}

// Scripted tow: autopilot to the trawler's bow, pass the line, tow it to a
// point 250 m away, cast off. Returns a log of milestones.
export async function scriptedTow(cfg) {
  const sim = await makeSim(cfg, sea('moderate'), { heading: 1.2 }, { current: true });
  const ops = new Operations(sim.physics, sim.boat, { seaState: 'moderate' });
  const target = ops.addTarget('trawler', 90, -60, 4.2);
  const ap = new Autopilot(sim.boat);
  const log = { attachedAt: null, arrivedAt: null, released: false, maxTension: 0 };
  let phase = 'approach';
  let dest = null;
  const s = sim.boat.state;
  sim.run(420, (w) => {
    const dt = w.physics.dt;
    const cmd = { tow: 0, winch: 0, action: 0 };
    const tp = target.sim.state.pos;
    const fwd = target.sim.forward;
    const bow = { x: tp.x + fwd.x * 8, z: tp.z + fwd.z * 8 };
    if (phase === 'approach') {
      // Come up abeam of her, then ahead of her bow, heading her way.
      const side = { x: fwd.z, z: -fwd.x };
      const abeam = { x: tp.x + side.x * 14 - fwd.x * 6, z: tp.z + side.z * 14 - fwd.z * 6 };
      if (ap.update(dt, abeam, { cruiseKn: 9, arriveKn: 3, stopDist: 6 }) < 8) {
        phase = 'lineup';
      }
    } else if (phase === 'lineup') {
      const spot = { x: bow.x + fwd.x * 12, z: bow.z + fwd.z * 12 };
      ap.update(dt, spot, { cruiseKn: 4, arriveKn: 0.5, stopDist: 2 });
      const c = ops.attachCandidate();
      if (c.target && c.distance < TOW.attachRange - 0.5 && w.boat.speed / KN < TOW.attachMaxKn) {
        cmd.tow = 1;
      }
    } else if (phase === 'tow') {
      cmd.winch = ops.line && ops.line.length > 30 ? -1 : 0;
      if (ap.update(dt, dest, { cruiseKn: 7, arriveKn: 1, stopDist: 20 }) < 30) {
        const td = Math.hypot(tp.x - dest.x, tp.z - dest.z);
        if (td < 70) {
          log.arrivedAt = w.t;
          cmd.tow = 1;
          phase = 'done';
        }
      }
    } else {
      ap.stop(dt);
    }
    ops.step(dt, cmd, w.waves, w.waves.time, w.env);
    for (const e of ops.events.splice(0)) {
      if (e.type === 'attach') {
        log.attachedAt = w.t;
        phase = 'tow';
        dest = { x: s.pos.x + sim.boat.forward.x * 250, z: s.pos.z + sim.boat.forward.z * 250 };
        log.start = { x: tp.x, z: tp.z };
      } else if (e.type === 'release') {
        log.released = true;
      } else if (e.type === 'break') {
        log.broke = true;
      }
    }
    if (ops.line) {
      log.maxTension = Math.max(log.maxTension, ops.line.tension);
    }
    return phase !== 'done' && !log.broke;
  });
  if (log.start) {
    const tp = target.sim.state.pos;
    log.moved = Math.hypot(tp.x - log.start.x, tp.z - log.start.z);
  }
  log.phase = phase;
  return log;
}

// Scripted rescue: two survivors in the water; autopilot alongside each at
// a crawl, E to pull them aboard.
// state: sea state; raft: also a life raft with this many aboard.
export async function scriptedRescue(cfg, state = 'rough', raft = 0, seconds = 360, heading = 0.3) {
  const sim = await makeSim(cfg, sea(state), { heading }, { current: true });
  const ops = new Operations(sim.physics, sim.boat, { seaState: state });
  ops.addSurvivor(40, -110);
  ops.addSurvivor(-30, -170);
  if (raft) {
    ops.addRaft(120, -230, raft);
  }
  const ap = new Autopilot(sim.boat);
  let lost = 0;
  sim.run(seconds, (w) => {
    const dt = w.physics.dt;
    const cmd = { tow: 0, winch: 0, action: 0 };
    const next = ops.field.waiting().sort((a, b) => ops.hullDistance(a.x, a.z) - ops.hullDistance(b.x, b.z))[0];
    if (!next) {
      return false;
    }
    const d = ops.hullDistance(next.x, next.z);
    // Within reach (arm's length, or a lifebuoy's throw in heavy weather)
    // and slow enough: stop and press E; the line hauls them in.
    const reach = (state === 'rough' || state === 'calm' || state === 'moderate' ? RESCUE.pullRange : RESCUE.lineRange) - 1.5;
    if (ops.pull || ops.buoy || d < reach) {
      ap.stop(dt);
      if (!ops.pull && !ops.buoy && w.boat.speed / KN < RESCUE.pullMaxKn - 0.3) {
        cmd.action = 1;
      }
    } else {
      // Heavy weather: come up to them from downwind, heading into the wind,
      // so the wind does the braking and she can hold station.
      const wv = w.env.wind;
      const ws = Math.hypot(wv.x, wv.z);
      let aim = next;
      if (ws > 12 && d > 25 && ap.decel < 0.15) {
        const off = { x: next.x + (wv.x / ws) * 40, z: next.z + (wv.z / ws) * 40 };
        if (Math.hypot(off.x - w.boat.state.pos.x, off.z - w.boat.state.pos.z) > 15 && !next.approached) {
          aim = off;
        } else {
          next.approached = true;
        }
      }
      // Heavy boats (long stopping distance) creep the last 150 m in.
      const cruiseKn = ap.decel < 0.15 && d < 150 ? 4 : 10;
      ap.update(dt, aim, { cruiseKn, arriveKn: aim === next ? 1 : 4, stopDist: aim === next ? reach - 1 : 0, creep: true });
    }
    ops.step(dt, cmd, w.waves, w.waves.time, w.env);
    for (const e of ops.events.splice(0)) {
      if (e.type === 'lost') {
        lost++;
      }
    }
    return true;
  });
  return { rescued: ops.rescued, lost, time: sim.t, payload: sim.boat.payload };
}

// Flooding: a badly holed Marlin (15% integrity) leaks faster than her pump;
// the same hull at 70% stays dry.
export async function floodTest(cfg) {
  const out = {};
  for (const integrity of [70, 15]) {
    const sim = await makeSim(cfg);
    sim.boat.hull.integrity = integrity;
    let foundered = null;
    sim.run(240, (s) => {
      if (s.boat.hull.foundered && foundered === null) {
        foundered = s.t;
      }
      return true;
    });
    out[integrity] = { flood: sim.boat.hull.flood, foundered, y: sim.boat.state.pos.y };
  }
  return out;
}

// Grounding: drive onto Widow Reef.
export async function groundingTest(cfg) {
  const seabed = new DepthMap();
  const shoal = seabed.reefs[0];
  const start = { x: shoal.x - 220, z: shoal.z };
  const sim = await makeSim(cfg, undefined, { x: start.x, z: start.z, heading: Math.PI / 2 }, { seabed });
  sim.boat.input.throttle = 0.6;
  let maxDamageRate = 0;
  sim.run(90, (s) => {
    maxDamageRate = Math.max(maxDamageRate, s.boat.io.groundDamage);
    return true;
  });
  return { integrity: sim.boat.hull.integrity, grounded: sim.boat.hull.grounded, speedKn: sim.boat.speed / KN, x: sim.boat.state.pos.x - shoal.x };
}

// Performance (spec 12): the Bulwark towing 3 chained containers in a
// Storm; mean and worst physics step (ms) over a minute of towing.
export async function towPerf(cfg, state = 'storm') {
  const sim = await makeSim(cfg, sea(state), { heading: 0 }, { current: true });
  const ops = new Operations(sim.physics, sim.boat, { seaState: state });
  const L = 12.2;
  const t0 = -cfg.hull.length / 2 + (cfg.towPointFromStern || 1.3);
  const cs = [0, 1, 2].map((i) => ops.addTarget('container', 0, -t0 + 2 + L / 2 + i * (L + 5), 0));
  sim.run(1);
  ops.attach(cs[0]);
  ops.chainNext();
  ops.chainNext();
  sim.boat.input.throttle = 0.6;
  const times = [];
  sim.run(60, (w) => {
    ops.step(w.physics.dt, { tow: 0, winch: 0, action: 0 }, w.waves, w.waves.time, w.env);
    times.push(w.physics.stepMs);
    return true;
  });
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  return { chain: ops.chain.length + 1, towing: Boolean(ops.line), mean, p99: times[Math.floor(times.length * 0.99)] };
}

// Steering under tow (D104): towing at 70% throttle, put the helm hard to
// port for 30 s and see how far her heading comes round. A tow hook far aft
// pins the stern and she barely answers ("girting").
export async function steerUnderTow(cfg, kind, seaId) {
  const sim = await towRig(cfg, kind, { length: 30, sea: seaId, heading: 3.6 });
  sim.boat.input.throttle = 0.7;
  sim.run(40, sim.each());
  const h0 = sim.boat.heading;
  sim.boat.input.rudder = 1;
  sim.boat.input.lock = true;
  let peak = 0;
  sim.run(30, sim.each((s) => {
    peak = Math.max(peak, s.ops.line ? s.ops.line.tension : 0);
  }));
  const d = sim.boat.heading - h0;
  return { turnDeg: (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * 180) / Math.PI, towing: !!sim.ops.line, peak };
}

// Course keeping under tow: helm amidships, how far does she wander?
export async function wanderUnderTow(cfg, kind, seaId, seconds = 90, heading = 3.6) {
  const sim = await towRig(cfg, kind, { length: 30, sea: seaId, heading });
  sim.boat.input.throttle = 0.7;
  sim.run(20, sim.each());
  const h0 = sim.boat.heading;
  let worst = 0;
  sim.run(seconds, sim.each((s) => {
    const d = s.boat.heading - h0;
    worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(d), Math.cos(d))));
  }));
  return { worstDeg: (worst * 180) / Math.PI };
}
