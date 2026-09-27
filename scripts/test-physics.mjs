// Headless physics tests (spec 17.1): wave model, boat targets (section 4),
// tow line, scripted tow + rescue, flooding and grounding (V3).
// Kestrel/Bulwark targets arrive in V4.

import { Waves, MAX_WAVES, PHYSICS_WAVES } from '../src/ocean/Waves.js';
import { shaderDisplace } from '../src/ocean/waveShaderPort.js';
import { SEA_STATES, WEATHER } from '../src/config/weather.js';
import { MARLIN, KESTREL, BULWARK, SOLACE, ISLANDER, NORTHFARER } from '../src/config/boats.js';
import * as BT from './lib/boatTests.mjs';
import * as TT from './lib/towTests.mjs';
import * as CT from './lib/careerTests.mjs';
import { JOBS } from '../src/config/career.js';
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
async function roughSea(cfg, stateId = 'rough', headings = [0, 1.6, 3.2, 4.8]) {
  const rough = SEA_STATES.find((s) => s.id === stateId);
  let ok = true;
  let worst = 0;
  let ms = 0;
  let steps = 0;
  for (const heading of headings) {
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
  record(`${cfg.name}: ${rough.name || stateId} sea at 75% throttle`, ok, `upright, max heel ${((worst * 180) / Math.PI).toFixed(0)}°, ${(ms / steps).toFixed(3)} ms/step`);
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

// Career loop (V4 acceptance, spec 14): one career from the Kettle Harbor
// berth: the guided first job (the Wren), a tow, a rescue and a cargo
// recovery back to back, each done with the autopilot helper and paid
// correctly; the ledger reconciles. Plus the shipyard.
async function career(cfg) {
  const n = cfg.name;
  const a = await CT.acceptance(cfg);
  const paidFair = (j) => j.state === 'done' && j.pay <= j.estimate && j.pay >= j.estimate * 0.9;
  const t = a.tutorial;
  record(`${n}: first job (tow the Wren in)`, paidFair(t) && t.rep === 3, `${t.state}, paid $${t.pay} of $${t.estimate} (condition), +${t.rep} rep, ${Math.round(t.time)} s`);
  const tow = a.tow;
  record(`${n}: tow job into Kettle Harbor`, paidFair(tow) && tow.rep === 3, `${tow.state}, paid $${tow.pay} of $${tow.estimate} (condition), +${tow.rep} rep, ${Math.round(tow.time)} s`);
  const res = a.rescue;
  record(`${n}: rescue job delivered to port`, res.state === 'done' && res.delivered === 2 && res.pay === res.estimate, `${res.state}, ${res.delivered}/2 delivered, paid $${res.pay} of $${res.estimate}, ${Math.round(res.time)} s`);
  const r = a.recovery;
  record(`${n}: cargo recovery (3 containers)`, r.state === 'done' && r.delivered === 3 && r.paid === r.estimate, `${r.state}, ${r.delivered}/3 landed, ${r.lost} lost, paid $${r.paid} of $${r.estimate}, ${r.minutes.toFixed(1)} min`);
  const sum = t.pay + tow.pay + res.pay + r.paid;
  const ok = a.jobs.length === 4 && a.jobs.every((s) => s === 'done') && a.money === sum && a.earned === sum;
  record(`${n}: V4 acceptance playthrough`, ok, `4/4 jobs done in ${a.minutes.toFixed(0)} min, +$${a.money} = sum of payouts, ledger $${a.earned}`);
  const up = await CT.upgrades(cfg);
  const upOk = up.bought === 9 && !up.again && up.spent === 29400 && up.fuel === 1.5 && up.tow === 1.5 && up.pump === 2 && Math.abs(up.thrust - 1.15) < 1e-9 && up.integrity === 94 && up.base && up.boat;
  record(`${n}: shipyard upgrades apply`, upOk, `${up.bought} upgrades + Kestrel for $${up.spent}; fuel x${up.fuel}, line x${up.tow}, pump x${up.pump}, thrust x${up.thrust.toFixed(2)}, 10% hit -> ${up.integrity}%`);
}

// Fleet: a hired crew works the Bulwark while you drive the Marlin; an hour
// in a Moderate sea pays gross less wages; stormbound past her limit (a
// Violent storm) only the wages run.
{
  const { Career } = await import('../src/gameplay/Career.js');
  const { Fleet, hireFee } = await import('../src/gameplay/Fleet.js');
  const { FLEET } = await import('../src/config/career.js');
  const c = new Career();
  c.money = 200000;
  c.boats.push('bulwark');
  const cantSelf = !c.hireCrew('marlin');
  const hired = c.hireCrew('bulwark') && !c.hireCrew('bulwark');
  const fleet = new Fleet(c, null);
  const m0 = c.money;
  for (let t = 0; t < 3600; t += 1) {
    fleet.update(1, 'moderate');
  }
  fleet.settle();
  const hour = c.money - m0;
  const m1 = c.money;
  for (let t = 0; t < 600; t += 1) {
    fleet.update(1, 'violent');
  }
  fleet.settle();
  const storm = c.money - m1;
  const r = FLEET.routes.bulwark;
  const ok = cantSelf && hired && m0 === 200000 - hireFee('bulwark') && Math.abs(hour - (r.grossPerHour - r.wagePerHour)) <= 1 && Math.abs(storm + r.wagePerHour / 6) <= 1;
  record('Fleet: hired crew works the Bulwark', ok, `hire $${hireFee('bulwark')}, +$${hour} in 1 h Moderate, $${storm} in 10 min Violent (wages)`);

  // Breakdowns: working at her limit she loses her engine (forced here);
  // she stops earning; a lapsed call costs the yard bill and idles her crew.
  const { BOAT_PRICES } = await import('../src/config/upgrades.js');
  c.boats.push('kittiwake');
  c.hireCrew('kittiwake');
  const calls = [];
  const f2 = new Fleet(c, null, () => 0);
  f2.onBreakdown = (id) => calls.push(id);
  f2.update(1, 'gale');
  const down = f2.status.kittiwake === 'broken down' && calls.includes('kittiwake');
  const m2 = c.money;
  f2.lost('kittiwake');
  const bill = m2 - c.money;
  f2.update(60, 'calm');
  const idle = f2.status.kittiwake === 'at the yard';
  const want = Math.round(BOAT_PRICES.kittiwake * FLEET.breakdown.repairShare);
  record('Fleet: breakdown, yard bill, idle crew', down && bill === want && idle, `calls ${calls.join(', ')}; yard bill $${bill} (want $${want}); then ${f2.status.kittiwake}`);
}

// A fleet breakdown is a tow of your own boat (her real hull as the target):
// the Marlin brings the drifting Kittiwake in; no fee, +rep.
{
  const r = await CT.towJob(MARLIN, null, { type: 'tow', fleet: 'kittiwake', vessel: 'kittiwake', name: 'Kittiwake', x: -260, z: 180, heading: 2.2, label: 'Fleet breakdown', seaState: 'calm' });
  record('Marlin: tows her own Kittiwake home', r.state === 'done' && r.pay === 0 && r.rep === 3, `${r.state}, fee $${r.pay}, +${r.rep} rep, ${Math.round(r.time)} s`);
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
// Kestrel and Bulwark (V4): section 4 targets and seakeeping where each is
// meant to work (Kestrel is dangerous above Rough; Bulwark works a Storm).
await boatTargets(KESTREL);
await roughSea(KESTREL, 'moderate', [0, 1.6]);
await boatTargets(BULWARK);
await roughSea(BULWARK, 'gale', [0, 1.6]);
// Tougher weather (beyond the spec): the tug rides out a violent storm and
// the freighter a hurricane.
await roughSea(BULWARK, 'violent', [0, 1.6]);
await roughSea(NORTHFARER, 'hurricane', [0, 1.6]);
// Weather chain (spec 7): 60 sim hours of seeded weather. Storms happen but
// are not the norm, heavy weather builds over 10-20 min, and the forecast
// always reaches 2 game days ahead.
{
  const { WeatherChain } = await import('../src/gameplay/WeatherChain.js');
  const { WEATHER_CHAIN } = await import('../src/config/weather.js');
  const w = { intensity: 1, setIntensity(i, sec) { this.intensity = i; this.ramp = sec; } };
  const secPerHour = 60;
  const c = new WeatherChain(w, secPerHour, 12);
  const share = new Array(7).fill(0);
  let minBuild = Infinity;
  let horizon = Infinity;
  for (let t = 0; t < 3600 * 60; t++) {
    const before = w.intensity;
    c.update(1);
    if (w.intensity >= 3 && w.intensity > before) {
      minBuild = Math.min(minBuild, w.ramp);
    }
    share[Math.round(w.intensity)]++;
    horizon = Math.min(horizon, (c.periods[c.periods.length - 1].end - c.t) / secPerHour);
  }
  const storm = (share[4] + share[5] + share[6]) / (3600 * 60);
  const calm = share[0] / (3600 * 60);
  const ok = storm > 0.03 && storm < 0.25 && calm > 0.05 && minBuild >= WEATHER_CHAIN.buildMinutes[0] * 60 - 1 && horizon >= 48;
  record('Weather chain: climate, storm build, forecast', ok, `storm+ ${(storm * 100).toFixed(0)}% of the time, calm ${(calm * 100).toFixed(0)}%, heavy weather builds over >= ${(minBuild / 60).toFixed(1)} min, forecast >= ${horizon.toFixed(0)} game h`);
}

// V5 acceptance (spec 14): a storm rescue is playable. Two people in the
// water and a raft of three in a Storm: lifebuoys from 14 m, the line holds
// them against the drift. Swimmers last 5.5 min in a Storm; losing one of
// them is a fair storm outcome, the rest must come aboard.
{
  const r = await TT.scriptedRescue(MARLIN, 'storm', 3, 900);
  record('Marlin: storm rescue, 2 swimmers + raft of 3', r.rescued >= 4 && r.rescued + r.lost === 5, `${r.rescued}/5 aboard, ${r.lost} lost, ${(r.time / 60).toFixed(1)} min`);
}

// Daisy chain: two containers in tow, the second on a strop behind the first.
{
  const r = await CT.chainTow(MARLIN);
  record('Marlin: tows two chained containers', r.candidate && r.chained && r.intact && r.moved > 300, `chained ${r.chained}, both in tow after 3 min at ${r.kn.toFixed(1)} kn, second moved ${Math.round(r.moved)} m, strop peak ${(r.peak / 1000).toFixed(0)} kN`);
}
// The barge (spec 8.1 / 4: the Bulwark tows a 250 t barge at ~6 kn).
{
  const b = await TT.towSpeed(BULWARK, 'barge');
  within('Bulwark: tows 250 t barge', b.kn, 6, 'kn');
}

// Trade: the ferry's timetable (Kettle -> Pellow -> Kettle) and the
// freighter's cargo contract.
for (const [cfg, type] of [[ISLANDER, 'timetable'], [NORTHFARER, 'cargo']]) {
  const r = await CT.tradeJob(cfg, type);
  if (type === 'timetable') {
    // On time at both stops: both ports' passenger ratings rise; 5 min late
    // cuts one (capped).
    const c = r.career;
    const up = r.ratings.pellow === 3.2 && r.ratings.kettle === 3.2;
    const late = c.ratePort('pellow', 5);
    record('Islander: passenger ratings follow punctuality', up && late === 2.7, `on time: Pellow ${r.ratings.pellow}, Kettle ${r.ratings.kettle}; 5 min late -> Pellow ${late}`);
  }
  record(`${cfg.name}: ${type} ${type === 'timetable' ? 'Kettle-Pellow-Kettle' : 'run Kettle -> Pellow'}`, r.state === 'done' && r.paid === r.offered && r.loadedKg > 0 && r.cargoAfter === 0, `${r.state}, paid $${r.paid} of $${r.offered} in ${r.minutes.toFixed(1)} min (due ${r.due.toFixed(1)}), carried ${(r.loadedKg / 1000).toFixed(1)} t`);
}

// Bigger boats (no spec targets): float level, make their design speed,
// stay stable to their capsize angle.
for (const cfg of [SOLACE, ISLANDER, NORTHFARER]) {
  const wl = await BT.waterline(cfg);
  const top = await BT.topSpeed(cfg);
  const st = await BT.staticStability(cfg);
  const ok = Math.abs(wl.sinkage) <= 0.05 && Math.abs(top - cfg.targets.topSpeedKn) <= cfg.targets.topSpeedKn * 0.15 && st.vanish >= cfg.capsizeDeg * 0.85;
  record(`${cfg.name}: floats, speed, stability`, ok, `sinkage ${(wl.sinkage * 100).toFixed(1)} cm, ${top.toFixed(1)} kn (design ${cfg.targets.topSpeedKn}), vanishing ${st.vanish.toFixed(0)}°`);
}
const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

const width = Math.max(...results.map((r) => r.name.length));
console.log('\nBREAKWATER physics tests\n');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.detail}`);
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed in ${elapsed}s\n`);
process.exit(failed ? 1 : 0);
