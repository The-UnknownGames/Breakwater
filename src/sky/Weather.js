// Weather state machine: sea states with smooth ~60 s transitions, plus a
// continuous intensity (0 = Calm … last = Hurricane, fractions blend two
// neighbouring states) and a wind direction the player can set. The Markov
// chain and forecast arrive in V5.

import { SEA_STATES, LERP_KEYS, LOG_LERP_KEYS, WEATHER, seaStateIndex } from '../config/weather.js';

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export class Weather {
  constructor(startId = 'calm') {
    const idx = Math.max(0, seaStateIndex(startId));
    this.from = { ...SEA_STATES[idx] };
    this.target = SEA_STATES[idx];
    this.toIndex = idx;
    this.intensity = idx;
    this.progress = 1;
    this.duration = WEATHER.transitionSeconds;
    this.windDirectionDeg = WEATHER.windDirectionDeg;
    this.params = {};
    this.blend();
  }

  get state() {
    return SEA_STATES[this.toIndex];
  }

  get transitioning() {
    return this.progress < 1;
  }

  setState(idOrIndex, immediate = false) {
    const idx = typeof idOrIndex === 'number' ? idOrIndex : seaStateIndex(idOrIndex);
    if (idx < 0) {
      return;
    }
    this.from = { ...this.params };
    this.rising = idx > this.intensity + 0.5;
    this.toIndex = idx;
    this.target = SEA_STATES[idx];
    this.intensity = idx;
    this.duration = WEATHER.transitionSeconds;
    this.progress = immediate ? 1 : 0;
    this.blend();
  }

  // Continuous storm control: 0..(states - 1); ramps over a few seconds.
  setIntensity(x, seconds = 8) {
    const max = SEA_STATES.length - 1;
    const v = Math.max(0, Math.min(max, x));
    const i = Math.min(max - 1, Math.floor(v));
    const f = v - i;
    const a = SEA_STATES[i];
    const b = SEA_STATES[i + 1];
    const t = { ...(f < 0.5 ? a : b) };
    for (const key of LERP_KEYS) {
      t[key] = a[key] + (b[key] - a[key]) * f;
    }
    for (const key of LOG_LERP_KEYS) {
      t[key] = a[key] * Math.pow(b[key] / a[key], f);
    }
    this.from = { ...this.params };
    this.rising = v > this.intensity + 0.5;
    this.target = t;
    this.toIndex = Math.round(v);
    this.intensity = v;
    this.duration = seconds;
    this.progress = seconds > 0 ? 0 : 1;
    this.blend();
  }

  // Wind direction (compass, where it blows from); waves follow it.
  setWindDirection(deg) {
    this.windDirectionDeg = ((deg % 360) + 360) % 360;
    this.from = { ...this.params };
    this.duration = 4;
    this.progress = 0;
    this.blend();
  }

  cycle(immediate = false) {
    this.setState((this.toIndex + 1) % SEA_STATES.length, immediate);
  }

  update(dt) {
    if (this.progress >= 1) {
      return;
    }
    this.progress = Math.min(1, this.progress + dt / this.duration);
    this.blend();
  }

  blend() {
    const to = this.target;
    const s = smooth(this.progress);
    const p = this.params;
    for (const key of LERP_KEYS) {
      p[key] = this.from[key] + (to[key] - this.from[key]) * s;
    }
    for (const key of LOG_LERP_KEYS) {
      p[key] = this.from[key] * Math.pow(to[key] / this.from[key], s);
    }
    p.id = to.id;
    p.name = to.name;
    p.windDirectionDeg = this.windDirectionDeg;
  }
}
