// Weather state machine: five sea states with smooth ~60 s transitions.
// The Markov chain and forecast arrive in V5; for now states change by
// request (debug F6 or setState).

import { SEA_STATES, LERP_KEYS, LOG_LERP_KEYS, WEATHER, seaStateIndex } from '../config/weather.js';

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export class Weather {
  constructor(startId = 'calm') {
    const idx = Math.max(0, seaStateIndex(startId));
    this.from = { ...SEA_STATES[idx] };
    this.toIndex = idx;
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
    this.toIndex = idx;
    this.progress = immediate ? 1 : 0;
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
    const to = SEA_STATES[this.toIndex];
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
