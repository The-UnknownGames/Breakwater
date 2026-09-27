// People in the water and life rafts (spec 14 V3). Pure JS: survivors bob
// on the wave surface and drift with the orbital velocity, the current and
// a little wind (rafts catch much more wind). Each has a hypothermia timer
// set by the sea state; a raft slows the cooling. Aboard, the clock stops.

import { RESCUE } from '../config/rescue.js';

let nextId = 1;

export class Survivor {
  constructor(x, z, minutes) {
    this.id = nextId++;
    this.x = x;
    this.z = z;
    this.y = 0;
    this.state = 'water'; // water | raft | aboard | lost
    this.timerMax = minutes * 60;
    this.timer = this.timerMax;
    this.raft = null;
    this.phase = Math.random() * Math.PI * 2;
  }

  get urgency() {
    return 1 - this.timer / this.timerMax;
  }
}

export class LifeRaft {
  constructor(x, z) {
    this.id = nextId++;
    this.x = x;
    this.z = z;
    this.y = 0;
    this.heading = Math.random() * Math.PI * 2;
    this.occupants = [];
  }
}

export class SurvivorField {
  constructor() {
    this.survivors = [];
    this.rafts = [];
    this.tmp = {};
  }

  addSurvivor(x, z, minutes) {
    const s = new Survivor(x, z, minutes);
    this.survivors.push(s);
    return s;
  }

  addRaft(x, z, count, minutes) {
    const raft = new LifeRaft(x, z);
    this.rafts.push(raft);
    for (let i = 0; i < Math.min(count, RESCUE.raftCapacity); i++) {
      const s = this.addSurvivor(x, z, minutes);
      s.state = 'raft';
      s.raft = raft;
      raft.occupants.push(s);
    }
    return raft;
  }

  clear() {
    this.survivors.length = 0;
    this.rafts.length = 0;
  }

  // Drift one floating object; returns the surface sample.
  drift(o, dt, waves, t, env, leeway) {
    const w = waves.sample(o.x, o.z, t, undefined, this.tmp, 0, 1.2);
    o.y = w.height;
    // On a lifebuoy line the boat holds them against wind and current.
    if (o.held) {
      return w;
    }
    const c = env.currentAt(o.x, o.z);
    o.x += (w.vx * 0.6 + c.x + env.wind.x * leeway) * dt;
    o.z += (w.vz * 0.6 + c.z + env.wind.z * leeway) * dt;
    return w;
  }

  // events: array to push {type, survivor} into.
  update(dt, waves, t, env, events) {
    for (const raft of this.rafts) {
      this.drift(raft, dt, waves, t, env, RESCUE.raftLeeway);
    }
    for (const s of this.survivors) {
      if (s.state === 'aboard' || s.state === 'lost') {
        continue;
      }
      if (s.state === 'raft') {
        s.x = s.raft.x;
        s.z = s.raft.z;
        s.y = s.raft.y;
        s.timer -= dt / RESCUE.raftFactor;
      } else {
        this.drift(s, dt, waves, t, env, RESCUE.survivorLeeway);
        s.timer -= dt;
      }
      if (s.timer <= 0) {
        s.timer = 0;
        s.state = 'lost';
        if (s.raft) {
          s.raft.occupants.splice(s.raft.occupants.indexOf(s), 1);
        }
        events.push({ type: 'lost', survivor: s });
      }
    }
  }

  // Survivors still waiting (in the water or a raft).
  waiting() {
    return this.survivors.filter((s) => s.state === 'water' || s.state === 'raft');
  }

  // Most urgent waiting survivor (drives the HUD time-pressure bar).
  mostUrgent() {
    let best = null;
    for (const s of this.waiting()) {
      if (!best || s.timer < best.timer) {
        best = s;
      }
    }
    return best;
  }
}
