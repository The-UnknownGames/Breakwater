// Headless physics tests (spec 17.1): wave model, boat targets (section 4),
// tow line, scripted tow + rescue, flooding and grounding (V3).
// Kestrel/Bulwark targets arrive in V4.

import { Waves, MAX_WAVES, PHYSICS_WAVES } from '../src/ocean/Waves.js';
import { shaderDisplace } from '../src/ocean/waveShaderPort.js';
import { SEA_STATES, WEATHER } from '../src/config/weather.js';
import { MARLIN } from '../src/config/boats.js';
import * as BT from './lib/boatTests.mjs';
import * as TT from './lib/towTests.mjs';
import * as CT from './lib/careerTests.mjs';
import { TRAWLER, SAILBOAT } from '../src/config/tow.js';

class Vec4 {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 0;
  }

  set(x, y, z, w) {
    this.x = Math.fround(x);
    this.y = Math.fround(y);
    this.z = Math.fround(z);
    this.w = Math.fround(w);
  }
}

const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
}

function waveAgreement() {
  for (const state of SEA_STATES) {
    const waves = new Waves(WEATHER.waveSeed);
    waves.setAnchor(0, 0);
    waves.setParams({ ...state, windDirectionDeg: WEATHER.windDirectionDeg });
    waves.update(1234.567);
    const A = Array.from({ length: MAX_WAVES }, () => new Vec4());
    const B = Array.from({ length: MAX_WAVES }, () => new Vec4());
    waves.packUniforms(A, B);
    let maxErr = 0;
    let maxErrPhys = 0;
    let seed = 7;
    for (let n = 0; n < 400; n++) {
      seed = (seed * 16807) % 2147483647;
      const x0 = (seed / 2147483647 - 0.5) * 6000;
      seed = (seed * 16807) % 2147483647;
      const z0 = (seed / 2147483647 - 0.5) * 6000;
      const gpu = shaderDisplace(A, B, 0, x0, z0, 0);
      const cpu = waves.heightAt(gpu.x, gpu.z, waves.time, MAX_WAVES);
      const cpuPhys = waves.heightAt(gpu.x, gpu.z, waves.time, PHYSICS_WAVES);
      maxErr = Math.max(maxErr, Math.abs(cpu - gpu.y));
      maxErrPhys = Math.max(maxErrPhys, Math.abs(cpuPhys - gpu.y));
    }
    record(
      `waves: CPU/GPU agreement (${state.name})`,
      maxErr < 0.02,
      `max err ${maxErr.toFixed(4)} m (limit 0.02); ${PHYSICS_WAVES}-wave physics subset vs full: ${maxErrPhys.toFixed(3)} m`,
    );
  }
}

function waveHeightStats() {
  for (const state of SEA_STATES) {
    const waves = new Waves(WEATHER.waveSeed);
    waves.setParams({ ...state, windDirectionDeg: WEATHER.windDirectionDeg });
    let sumSq = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      waves.update(0.37);
      const h = waves.heightAt(13.3, -7.1, waves.time, MAX_WAVES);
      sumSq += h * h;
    }
    const hs = 4 * Math.sqrt(sumSq / n);
    const err = Math.abs(hs - state.hs) / state.hs;
    record(`waves: Hs (${state.name})`, err < 0.25, `measured ${hs.toFixed(2)} m, target ${state.hs} m`);
  }
}

function transitionContinuity() {
  const waves = new Waves(WEATHER.waveSeed);
  const ax = 2400;
  const az = -1800;
  waves.setAnchor(ax, az);
  const calm = { ...SEA_STATES[0], windDirectionDeg: WEATHER.windDirectionDeg };
  const storm = { ...SEA_STATES[4], windDirectionDeg: WEATHER.windDirectionDeg };
  waves.setParams(calm);
  waves.update(100);
  let maxJump = 0;
  let prev = waves.heightAt(ax, az, waves.time, MAX_WAVES);
  const steps = 60 * 60;
  for (let i = 1; i <= steps; i++) {
    const s = i / steps;
    const blend = {};
    for (const key of Object.keys(calm)) {
      const a = calm[key];
      const b = storm[key];
      blend[key] = typeof a === 'number' ? a + (b - a) * s : a;
    }
    blend.lambdaMin = calm.lambdaMin * Math.pow(storm.lambdaMin / calm.lambdaMin, s);
    blend.lambdaMax = calm.lambdaMax * Math.pow(storm.lambdaMax / calm.lambdaMax, s);
    waves.setParams(blend);
    waves.update(1 / 60);
    const h = waves.heightAt(ax, az, waves.time, MAX_WAVES);
    maxJump = Math.max(maxJump, Math.abs(h - prev));
    prev = h;
  }
  record('waves: transition continuity at anchor', maxJump < 0.25, `max per-frame height change ${maxJump.toFixed(3)} m`);
}

function within(name, value, target, unit, tol = 0.15) {
  const err = Math.abs(value - target) / target;
  record(name, err <= tol, `${value.toFixed(2)} ${unit} (target ${target} ±${tol * 100}%)`);
}

async function boatTargets(cfg) {
  const tg = cfg.targets;
  const n = cfg.name;
  const wl = await BT.waterline(cfg);
  record(`${n}: design waterline`, Math.abs(wl.sinkage) <= 0.05, `sinkage ${(wl.sinkage * 100).toFixed(1)} cm (±5 cm), trim ${wl.pitchDeg.toFixed(2)}°`);
  within(`${n}: top speed`, await BT.topSpeed(cfg), tg.topSpeedKn, 'kn');
  within(`${n}: 0-${tg.accel.toKn} kn`, await BT.acceleration(cfg, tg.accel.toKn), tg.accel.seconds, 's');
  within(`${n}: stop from ${tg.stopping.fromKn} kn`, await BT.stopping(cfg, tg.stopping.fromKn), tg.stopping.metres, 'm');
  const tc = await BT.turningCircle(cfg, tg.cruiseThrottle);
  within(`${n}: turning circle`, tc.lengths, tg.turningCircleLengths, 'L');
  within(`${n}: roll period`, await BT.rollPeriod(cfg), tg.rollPeriod, 's');
  within(`${n}: capsize angle (static)`, (await BT.staticStability(cfg)).vanish, tg.capsizeDeg, '°');
}

// Seakeeping sanity: under way at 75% throttle in Rough the Marlin must stay
// upright and finite (spec 7: Marlin is dangerous only above Gale).
async function roughSea(cfg) {
  const rough = SEA_STATES.find((s) => s.id === 'rough');
  let ok = true;
  let worst = 0;
  let ms = 0;
  let steps = 0;
  for (const heading of [0, 1.6, 3.2, 4.8]) {
    const sim = await BT.makeSim(cfg, { ...rough, windDirectionDeg: WEATHER.windDirectionDeg }, { heading }, { current: true });
    sim.boat.input.throttle = 0.75;
    sim.run(60, (s) => {
      worst = Math.max(worst, Math.abs(s.boat.hull.heel));
      ms += s.physics.stepMs;
      steps++;
      if (!Number.isFinite(s.boat.state.pos.y)) {
        ok = false;
      }
    });
    ok = ok && !sim.boat.hull.capsized;
  }
  record(`${cfg.name}: Rough sea at 75% throttle`, ok, `upright, max heel ${((worst * 180) / Math.PI).toFixed(0)}°, ${(ms / steps).toFixed(3)} ms/step`);
}

async function towTargets(cfg) {
  const n = cfg.name;
  for (const t of [TRAWLER, SAILBOAT]) {
    const wl = await BT.waterline(t);
    const st = await BT.staticStability(t);
    record(`${t.name}: floats at DWL, stable`, Math.abs(wl.sinkage) <= 0.05 && st.vanish > 60, `sinkage ${(wl.sinkage * 100).toFixed(1)} cm, vanishing angle ${st.vanish.toFixed(0)}°`);
  }
  const tow = await TT.towSpeed(cfg, 'trawler');
  within(`${n}: tows 25 t trawler`, tow.kn, 8, 'kn');
  const calm = await TT.towLoads(cfg, 'trawler', null, 0.7);
  const rough = await TT.towLoads(cfg, 'trawler', 'rough', 0.7);
  const ratio = rough.peak / calm.mean;
  record(`${n}: snatch load in Rough`, ratio > 2 && !rough.broke, `peak ${(rough.peak / 1000).toFixed(1)} kN = ${ratio.toFixed(1)}x calm steady ${(calm.mean / 1000).toFixed(1)} kN (> 2x)`);
  const auto = await TT.towLoads(cfg, 'trawler', 'rough', 0.7, { autoTension: true });
  const cut = 1 - auto.peak / rough.peak;
  record(`${n}: auto-tension winch`, cut >= 0.3, `peak ${(auto.peak / 1000).toFixed(1)} kN vs ${(rough.peak / 1000).toFixed(1)} kN (-${(cut * 100).toFixed(0)}%, need -30%)`);
  const brk = await TT.breakTest(cfg, 'trawler', 5000);
  const r = brk.tension / brk.rating;
  record(`${n}: line breaks at its rating`, brk.broken && r >= 1 && r < 1.1 && brk.over >= 0.25 - 1e-6, `parted at ${(brk.tension / 1000).toFixed(1)} kN (rating ${brk.rating / 1000} kN) after ${brk.over.toFixed(2)} s over`);
  const inst = await TT.breakTest(cfg, 'trawler', 0, 250000);
  record(`${n}: instant break above 1.5x`, inst.broken && inst.over < 0.25 && inst.tension > 1.5 * inst.rating, `parted at ${(inst.tension / 1000).toFixed(0)} kN after ${inst.over.toFixed(2)} s over rating`);
}

async function scenarios(cfg) {
  const n = cfg.name;
  const tow = await TT.scriptedTow(cfg);
  record(`${n}: scripted tow (autopilot)`, tow.released && tow.moved > 150 && !tow.broke, `line passed at ${tow.attachedAt?.toFixed(0)} s, trawler towed ${tow.moved?.toFixed(0)} m, cast off at ${tow.arrivedAt?.toFixed(0)} s, peak ${(tow.maxTension / 1000).toFixed(1)} kN`);
  const res = await TT.scriptedRescue(cfg);
  record(`${n}: scripted rescue (autopilot)`, res.rescued === 2 && res.lost === 0, `${res.rescued}/2 pulled aboard in Rough in ${res.time.toFixed(0)} s`);
  const fl = await TT.floodTest(cfg);
  record(`${n}: leaks beat the pump when holed`, fl[70].flood < 0.01 && fl[15].flood > 1.5, `70% hull: ${fl[70].flood.toFixed(2)} t; 15% hull: ${fl[15].flood.toFixed(1)} t after 4 min (pump ${cfg.pumpTonnesPerMin} t/min)`);
  const gr = await TT.groundingTest(cfg);
  record(`${n}: grounding on the shoal`, gr.integrity < 95 && gr.speedKn < 1, `stopped at ${gr.speedKn.toFixed(1)} kn, hull ${gr.integrity.toFixed(0)}%`);
}

// Career loop (V4): board job -> autopilot -> Kettle Harbor -> paid.
async function career(cfg) {
  const n = cfg.name;
  const tow = await CT.towJob(cfg);
  record(`${n}: tow job into Kettle Harbor`, tow.state === 'done' && tow.pay > 1500 && tow.rep === 3, `${tow.state}, paid $${tow.pay} (target ~$2,100 calm trawler), +${tow.rep} rep, ${Math.round(tow.time)} s`);
  const up = await CT.upgrades(cfg);
  const upOk = up.bought === 9 && !up.again && up.spent === 20400 && up.fuel === 1.5 && up.tow === 1.5 && up.pump === 2 && Math.abs(up.thrust - 1.15) < 1e-9 && up.integrity === 94 && up.base;
  record(`${n}: shipyard upgrades apply`, upOk, `${up.bought} bought for $${up.spent}; fuel x${up.fuel}, line x${up.tow}, pump x${up.pump}, thrust x${up.thrust.toFixed(2)}, 10% hit -> ${up.integrity}%`);
  const res = await CT.rescueJob(cfg);
  record(`${n}: rescue job delivered to port`, res.state === 'done' && res.delivered === 2 && res.pay === 800, `${res.state}, ${res.delivered}/2 delivered, paid $${res.pay} (spec: ~$800), ${Math.round(res.time)} s`);
}

const t0 = performance.now();
waveAgreement();
waveHeightStats();
transitionContinuity();
await boatTargets(MARLIN);
await roughSea(MARLIN);
await towTargets(MARLIN);
await scenarios(MARLIN);
await career(MARLIN);
const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

const width = Math.max(...results.map((r) => r.name.length));
console.log('\nBREAKWATER physics tests\n');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.detail}`);
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed in ${elapsed}s\n`);
process.exit(failed ? 1 : 0);
