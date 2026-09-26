// npm run sim:economy (spec 17.3): career progression from average job
// durations and the game's own pay rules, with a simple player: take the
// next job with the best boat owned for the weather, sit out weather no
// owned boat can work, buy the next item on the shopping list when money
// beyond the reserve allows. Prints money over time and unlock times and
// fails when they miss the section 8.5 pacing targets by more than 25%.

import { JOBS, ECONOMY } from '../src/config/career.js';
import { UPGRADES, BOAT_PRICES } from '../src/config/upgrades.js';
import { ECON_SIM, WEATHER_CHAIN, PACING } from '../src/config/economy.js';
import { Jobs } from '../src/gameplay/Jobs.js';
import { mulberry32 } from '../src/core/Rng.js';

const SEA = WEATHER_CHAIN.states;
const seaIndex = (id) => SEA.indexOf(id);

function pickWeighted(rng, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r <= 0) {
      return id;
    }
  }
  return entries[entries.length - 1][0];
}

// An offer shaped like Jobs.makeOffer(), priced by the game's estimate().
function offer(rng, seaState) {
  const type = pickWeighted(
    rng,
    Object.entries(JOBS.types).map(([id, t]) => [id, t.weight]),
  );
  const cfg = JOBS.types[type];
  const o = { type, seaState };
  if (type === 'containers') {
    o.count = Math.round(cfg.count[0] + (cfg.count[1] - cfg.count[0]) * rng());
  } else if (type === 'tow' || type === 'swamped') {
    o.vessel = type === 'swamped' || rng() < 0.5 ? 'trawler' : 'sailboat';
  } else {
    o.people = Math.round(cfg.people[0] + (cfg.people[1] - cfg.people[0]) * rng());
  }
  o.pay = Jobs.prototype.estimate.call(null, o);
  return o;
}

function priceOf(item) {
  if (item.startsWith('boat:')) {
    return BOAT_PRICES[item.slice(5)];
  }
  return UPGRADES.find((u) => u.id === item.split('@')[0]).price;
}

// Best owned boat for this job in this weather (null: sit it out).
function chooseBoat(owned, job, seaState) {
  const s = seaIndex(seaState);
  const ok = (id) => owned.includes(id) && s <= seaIndex(ECON_SIM.boats[id].maxSea);
  const tow = job.type === 'tow' || job.type === 'swamped' || job.type === 'containers';
  const order = tow ? (s >= 2 ? ['bulwark', 'marlin'] : ['marlin', 'bulwark']) : ['kestrel', 'marlin', 'bulwark'];
  return order.find((id) => ok(id) && (!tow || ECON_SIM.boats[id].tows)) || null;
}

// One career. fixedWeather: a list of states to cycle (for rate checks).
export function simulate(seed, opts = {}) {
  const rng = mulberry32(seed);
  const hours = opts.hours ?? ECON_SIM.hours;
  const st = {
    t: 0,
    money: ECONOMY.startMoney,
    net: 0,
    owned: opts.boats ? [...opts.boats] : ['marlin'],
    bought: [],
    firstUpgrade: null,
    affordable: {},
    everything: null,
    earned: 0,
    workMin: 0,
    log: [],
  };
  let w = opts.weather ? opts.weather[0] : 'calm';
  let nextWeather = WEATHER_CHAIN.periodMin;
  const shopping = opts.noShopping ? [] : [...ECON_SIM.shopping];
  let lastLog = -60;
  while (st.t < hours * 60) {
    // Weather advances in periods.
    while (st.t >= nextWeather) {
      nextWeather += WEATHER_CHAIN.periodMin;
      if (opts.weather) {
        w = opts.weather[Math.floor(nextWeather / WEATHER_CHAIN.periodMin) % opts.weather.length];
      } else {
        const row = WEATHER_CHAIN.p[seaIndex(w)];
        w = pickWeighted(rng, SEA.map((id, i) => [id, row[i]]));
      }
    }
    const job = offer(rng, w);
    const boat = chooseBoat(st.owned, job, w);
    if (!boat) {
      st.t += 5; // wait in port for the weather
      continue;
    }
    const b = ECON_SIM.boats[boat];
    const sea = ECON_SIM.sea[w];
    const tow = job.type === 'tow' || job.type === 'swamped' || job.type === 'containers';
    const has = (id) => st.bought.includes(id) || st.bought.includes(`${id}@${boat}`);
    let minutes = ECON_SIM.minutes[job.type] * sea.time * (tow ? b.tow : b.rescue);
    if (has('autopilot') && seaIndex(w) <= 1) {
      minutes *= 1 - ECON_SIM.autopilotSaving;
    }
    minutes += ECON_SIM.overheadMin;
    const failed = rng() < sea.fail * b.fail * (has('plating') ? 0.8 : 1);
    let pay = 0;
    if (!failed) {
      // Tow pay scales with the vessel's condition after the weather.
      pay = tow ? job.pay * (1 - (sea.damage * 1.5) / 100) : job.pay;
    }
    const damage = sea.damage * b.damage * (has('plating') ? 0.6 : 1);
    const repairs = damage * ECONOMY.repairPerPercent[boat];
    const fuel = (b.fuelPerHour * minutes) / 60;
    const cost = repairs + fuel;
    st.t += minutes;
    st.money += pay - cost;
    st.net += pay - cost;
    st.earned += pay;
    st.workMin += minutes;
    for (const id of ['kestrel', 'bulwark']) {
      if (st.affordable[id] === undefined && st.net >= BOAT_PRICES[id]) {
        st.affordable[id] = st.t;
      }
    }
    // Shopping, keeping the reserve.
    while (shopping.length && st.money - priceOf(shopping[0]) >= ECON_SIM.reserve) {
      const item = shopping.shift();
      st.money -= priceOf(item);
      if (item.startsWith('boat:')) {
        st.owned.push(item.slice(5));
      } else {
        st.bought.push(item);
        if (st.firstUpgrade === null) {
          st.firstUpgrade = st.t;
        }
      }
      if (!shopping.length) {
        st.everything = st.t;
      }
    }
    if (st.t - lastLog >= 60) {
      lastLog = st.t;
      st.log.push({ t: st.t, money: st.money, net: st.net, owned: st.owned.length, bought: st.bought.length, w });
    }
  }
  st.ratePerHour = (st.earned - 0) / (st.t / 60);
  return st;
}

function mean(xs) {
  const v = xs.filter((x) => x !== null && x !== undefined);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function run() {
  const results = [];
  const careers = [];
  for (let s = 1; s <= ECON_SIM.seeds; s++) {
    careers.push(simulate(s * 7919));
  }
  // Earning rates: Marlin in Calm/Moderate; Bulwark working storms.
  const calm = mean(Array.from({ length: 6 }, (_, i) => simulate(100 + i, { hours: 3, weather: ['calm', 'moderate'], noShopping: true }).ratePerHour));
  const storm = mean(Array.from({ length: 6 }, (_, i) => simulate(200 + i, { hours: 3, weather: ['storm'], boats: ['marlin', 'bulwark'], noShopping: true }).ratePerHour));
  const tol = PACING.tolerance;
  const inRange = (v, [lo, hi]) => v !== null && v >= lo * (1 - tol) && v <= hi * (1 + tol);
  const near = (v, target) => v !== null && Math.abs(v - target) <= target * tol;
  const first = mean(careers.map((c) => c.firstUpgrade));
  const kestrel = mean(careers.map((c) => c.affordable.kestrel));
  const bulwark = mean(careers.map((c) => c.affordable.bulwark));
  const done = careers.filter((c) => c.everything !== null).length;
  const everything = mean(careers.map((c) => c.everything));
  results.push(['earnings, Calm/Moderate (Marlin)', inRange(calm, PACING.calmRatePerHour), `$${Math.round(calm).toLocaleString()}/h (target $7-10k)`]);
  results.push(['earnings, working storms (Bulwark)', inRange(storm, PACING.stormRatePerHour), `$${Math.round(storm).toLocaleString()}/h (target $15-25k)`]);
  results.push(['first upgrade', inRange(first, PACING.firstUpgradeMin), `${first.toFixed(0)} min (target 10-15)`]);
  results.push(['Kestrel affordable', near(kestrel, PACING.kestrelMin), `${kestrel.toFixed(0)} min (target ~60)`]);
  results.push(['Bulwark affordable', inRange(bulwark, PACING.bulwarkMin), `${(bulwark / 60).toFixed(2)} h (target 2-2.5)`]);
  results.push(['everything owned', done === careers.length && inRange(everything, PACING.everythingMin), `${everything === null ? 'never' : `${(everything / 60).toFixed(2)} h`} in ${done}/${careers.length} careers (target 5-6)`]);
  console.log('\nBREAKWATER economy simulation (spec 17.3)\n');
  console.log('money over time (career 1):');
  for (const e of careers[0].log) {
    console.log(`  ${(e.t / 60).toFixed(1).padStart(4)} h  $${Math.round(e.money).toLocaleString().padStart(7)}  boats ${e.owned}  upgrades ${String(e.bought).padStart(2)}  ${e.w}`);
  }
  console.log('');
  const width = Math.max(...results.map((r) => r[0].length));
  for (const [name, ok, detail] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(width)}  ${detail}`);
  }
  const failed = results.filter((r) => !r[1]).length;
  console.log(`\n${results.length - failed}/${results.length} pacing targets within ±${tol * 100}% (${careers.length} careers averaged)`);
  process.exitCode = failed ? 1 : 0;
}

run();
