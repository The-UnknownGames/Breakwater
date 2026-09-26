// Weather chain (spec 7): drives Weather through a seeded Markov chain of
// periods and keeps a forecast of what's coming. Pure JS: time is sim
// seconds; the caller converts to game hours for display.

import { SEA_STATES, WEATHER_CHAIN } from '../config/weather.js';
import { mulberry32 } from '../core/Rng.js';

const C = WEATHER_CHAIN;
const between = (rng, [a, b]) => a + (b - a) * rng();

export class WeatherChain {
  // weather: sky/Weather; secondsPerGameHour: from DayNight.
  constructor(weather, secondsPerGameHour, seed = 7, startIndex = null) {
    this.weather = weather;
    this.secondsPerGameHour = secondsPerGameHour;
    this.rng = mulberry32(seed);
    this.t = 0;
    this.paused = false;
    this.warned = null;
    this.onWarning = null; // (period) => void
    this.onChange = null; // (period) => void
    const first = startIndex ?? Math.round(weather.intensity);
    this.periods = [{ index: first, start: 0, end: this.length(first), ramp: 0 }];
    this.extend();
  }

  length(index) {
    return between(this.rng, C.periodMinutes) * 60 * (index >= 4 ? C.stormPeriodScale : 1);
  }

  // Next state: a weighted step from this one.
  next(index) {
    const max = SEA_STATES.length - 1;
    const opts = [];
    let total = 0;
    for (const [k, w] of Object.entries(C.stepWeights)) {
      const j = index + Number(k);
      if (j < 0 || j > max) {
        continue;
      }
      const weight = w * (C.climate[j] ?? 0.01);
      opts.push([j, weight]);
      total += weight;
    }
    let r = this.rng() * total;
    for (const [j, w] of opts) {
      r -= w;
      if (r <= 0) {
        return j;
      }
    }
    return opts[opts.length - 1][0];
  }

  // Keep periods queued to cover the forecast horizon.
  extend() {
    const horizon = this.t + C.forecastGameDays * 24 * this.secondsPerGameHour;
    let last = this.periods[this.periods.length - 1];
    while (last.end < horizon) {
      const index = this.next(last.index);
      const heavy = index >= 3 && index > last.index;
      const ramp = index === last.index ? 0 : between(this.rng, heavy ? C.buildMinutes : C.easeMinutes) * 60;
      // The ramp runs inside the previous period: make sure it fits.
      last.end = Math.max(last.end, last.start + ramp + 60);
      last = { index, start: last.end, end: last.end + this.length(index), ramp };
      this.periods.push(last);
    }
  }

  get current() {
    return this.periods[0];
  }

  update(dt) {
    if (this.paused) {
      return;
    }
    this.t += dt;
    // Start ramping into the next period so it has arrived by its start.
    const nx = this.periods[1];
    if (nx && !nx.begun && this.t >= nx.start - nx.ramp) {
      nx.begun = true;
      if (nx.index !== this.current.index) {
        this.weather.setIntensity(nx.index, Math.max(1, nx.start - this.t));
        this.onChange?.(nx);
      }
    }
    if (nx && this.t >= nx.start) {
      this.periods.shift();
    }
    // Warning ahead of heavy weather building.
    const heavy = this.periods.find((p, i) => i > 0 && p.index >= 3 && p.index > this.periods[i - 1].index);
    if (heavy && heavy !== this.warned && heavy.start - heavy.ramp - this.t < C.warnAheadMinutes * 60) {
      this.warned = heavy;
      this.onWarning?.(heavy);
    }
    this.extend();
  }

  // Forecast entries: { index, name, inHours } for each coming change.
  forecast() {
    const out = [];
    for (const p of this.periods) {
      const at = Math.max(0, p.start - p.ramp - this.t);
      if (out.length && out[out.length - 1].index === p.index) {
        continue;
      }
      out.push({ index: p.index, name: SEA_STATES[p.index].name, inHours: at / this.secondsPerGameHour, building: p.ramp > 0 && p.index >= 3 });
    }
    return out;
  }

  // "now Rough · 14:30 Gale (building) · tomorrow 02:10 Moderate"
  forecastText(hourNow, max = 4) {
    const parts = [];
    for (const [i, f] of this.forecast().slice(0, max).entries()) {
      if (i === 0) {
        parts.push(`now ${f.name}`);
        continue;
      }
      const h = hourNow + f.inHours;
      const day = Math.floor(h / 24);
      const hh = Math.floor(h % 24);
      const mm = Math.floor((h % 1) * 60 / 10) * 10;
      const when = `${day >= 2 ? 'in 2 days ' : day === 1 ? 'tomorrow ' : ''}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      parts.push(`${when} ${f.name}${f.building ? ' (building)' : ''}`);
    }
    return parts.join(' · ');
  }

  serialize() {
    return { t: this.t, periods: this.periods.map(({ index, start, end, ramp, begun }) => ({ index, start, end, ramp, begun })) };
  }

  restore(d) {
    if (d && Array.isArray(d.periods) && d.periods.length) {
      this.t = d.t;
      this.periods = d.periods;
      this.extend();
    }
  }
}
