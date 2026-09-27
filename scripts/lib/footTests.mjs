// Headless on-foot tests (V7): mooring at the Kettle Harbor pier, and the
// acceptance walk: off the boat, to the pub, the shipyard and the house,
// back aboard and cast off. Uses the game's own layout, walker, decks,
// navigation and mooring; nothing is teleported once the walk starts.

import { makeSim } from './boatTests.mjs';
import { WorldShape } from '../../src/world/WorldShape.js';
import { buildTowns } from '../../src/world/TownLayout.js';
import { TownGround, BoatDeck } from '../../src/foot/Ground.js';
import { Walker } from '../../src/foot/Walker.js';
import { TownNav } from '../../src/foot/TownNav.js';
import { Mooring } from '../../src/gameplay/Mooring.js';
import { FOOT, DECKS } from '../../src/config/onfoot.js';

const KN = 0.514444;

let world = null;
function kettle() {
  if (!world) {
    const shape = new WorldShape();
    const towns = buildTowns(shape);
    world = { shape, towns, ground: new TownGround(towns), home: shape.ports.find((p) => p.home) };
    world.town = towns.find((t) => t.port.home);
    world.nav = new TownNav(world.town);
  }
  return world;
}

// A boat at her Kettle Harbor berth alongside the pier, in a breeze.
async function berthed(cfg, windKn = 15) {
  const w = kettle();
  const b = w.shape.berthFor(w.home, cfg.hull.length, cfg.hull.beam);
  const sea = { hs: 0, lambdaMin: 1, lambdaMax: 10, steepness: 0, windKn, windDirectionDeg: 250 };
  const sim = await makeSim(cfg, sea, { x: b.x, z: b.z, heading: b.heading });
  const mooring = new Mooring(sim.boat, w.ground);
  return { sim, mooring, w };
}

// Lines ashore at the berth, she holds in a 15 kn breeze for a minute,
// then throttling away slips them.
export async function mooringTest(cfg) {
  const { sim, mooring } = await berthed(cfg);
  let ev = null;
  sim.run(2, () => {
    ev = mooring.update(sim.physics.dt, 0) || ev;
  });
  const moored = ev === 'moored';
  const p0 = { ...sim.boat.state.pos };
  let drift = 0;
  sim.run(60, (s) => {
    mooring.update(s.physics.dt, 0);
    drift = Math.max(drift, Math.hypot(s.boat.state.pos.x - p0.x, s.boat.state.pos.z - p0.z));
  });
  sim.boat.input.throttle = 0.5;
  let slipped = false;
  sim.run(25, (s) => {
    slipped = mooring.update(s.physics.dt, s.boat.input.throttle) === 'slipped' || slipped;
  });
  const away = Math.hypot(sim.boat.state.pos.x - p0.x, sim.boat.state.pos.z - p0.z);
  return { moored, drift, slipped, away, rearmed: mooring.armed || !mooring.moored };
}

// Steer the walker toward world (x, z); true when there.
function steer(walker, x, z, dt, tol = 0.6) {
  const dx = x - walker.pos.x;
  const dz = z - walker.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < tol) {
    walker.step(dt, { forward: 0, strafe: 0 }, { yaw: 0, pitch: 0 });
    return true;
  }
  const want = Math.atan2(dx, -dz);
  let e = want - walker.yaw;
  e = Math.atan2(Math.sin(e), Math.cos(e));
  const turn = Math.max(-FOOT.lookSpeed * dt, Math.min(FOOT.lookSpeed * dt, e));
  walker.step(dt, { forward: Math.abs(e) < 0.6 ? 1 : 0.15, strafe: 0 }, { yaw: turn, pitch: 0 });
  return false;
}

// The V7 acceptance walk (ROADMAP_V7): boat -> pub -> shipyard -> house ->
// boat -> helm -> cast off, never off a support.
export async function acceptanceWalk(cfg) {
  const { sim, mooring, w } = await berthed(cfg, 10);
  sim.run(2, () => mooring.update(sim.physics.dt, 0));
  const deck = new BoatDeck(sim.boat);
  const walker = new Walker(w.ground, () => [deck]);
  const stand = deck.spot(DECKS[cfg.id].stand);
  walker.place(stand.x, stand.y, stand.z, sim.boat.heading);
  const log = { legs: [], lowest: Infinity, unsupported: 0, time: 0, surfaces: new Set() };
  const f = w.town.frame;
  const P = w.town.port;
  const pierA = 35;
  // Points in the frame -> world.
  const W = (a, o) => f.toWorld(a, o, {});
  const B = (id) => w.town.buildings.find((b) => b.id === id);
  const bl = f.toLocal(sim.boat.state.pos.x, sim.boat.state.pos.z, {});
  const onPier = { a: pierA - 1, o: bl.o };
  const legs = [
    ['ashore', [W(onPier.a, onPier.o)]],
    ['to the pub', null, onPier, B('pub').service],
    ['to the shipyard', null, B('pub').service, B('shipyard').service],
    ['to the house', null, B('shipyard').service, B('home').service],
    ['back to the pier', null, B('home').service, onPier],
  ];
  let ok = true;
  for (const [name, direct, from, to] of legs) {
    const pts = direct || (w.nav.path(from, to) || []).map((p) => W(p.a, p.o));
    const t0 = log.time;
    let reached = pts.length > 0;
    for (const p of pts) {
      let done = false;
      for (let i = 0; i < 60 * 90 && !done; i++) {
        sim.step();
        mooring.update(sim.physics.dt, 0);
        done = steer(walker, p.x, p.z, sim.physics.dt);
        log.time += sim.physics.dt;
        log.lowest = Math.min(log.lowest, walker.pos.y);
        log.surfaces.add(walker.surface);
        if (!walker.support) {
          log.unsupported++;
        }
      }
      reached = reached && done;
    }
    log.legs.push({ name, reached, seconds: log.time - t0, waypoints: pts.length });
    ok = ok && reached;
  }
  // Back aboard: to the stand spot on deck (she moves; re-aim each step),
  // then up to the helm.
  let aboard = false;
  let atHelm = false;
  for (let i = 0; i < 60 * 40 && !atHelm; i++) {
    sim.step();
    mooring.update(sim.physics.dt, 0);
    const target = deck.spot(aboard ? DECKS[cfg.id].helm : DECKS[cfg.id].stand);
    const there = steer(walker, target.x, target.z, sim.physics.dt, aboard ? FOOT.helmReach * 0.6 : 0.6);
    aboard = aboard || (there && walker.onBoat);
    atHelm = aboard && there;
    log.time += sim.physics.dt;
    log.lowest = Math.min(log.lowest, walker.pos.y);
    if (!walker.support) {
      log.unsupported++;
    }
  }
  log.legs.push({ name: 'aboard and at the helm', reached: atHelm, seconds: 0 });
  // Cast off: throttle up slips the lines; she leaves the pier.
  const p0 = { ...sim.boat.state.pos };
  sim.boat.input.throttle = 0.5;
  let slipped = false;
  sim.run(20, (s) => {
    slipped = mooring.update(s.physics.dt, 0.5) === 'slipped' || slipped;
  });
  const away = Math.hypot(sim.boat.state.pos.x - p0.x, sim.boat.state.pos.z - p0.z);
  return { ok: ok && atHelm && slipped && away > 15 && log.unsupported === 0, legs: log.legs, lowest: log.lowest, unsupported: log.unsupported, minutes: log.time / 60, surfaces: [...log.surfaces], slipped, away, speedKn: sim.boat.speed / KN, port: P.id };
}
