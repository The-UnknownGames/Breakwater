// Survivors' whistles (spec 10): three sharp blasts from people waiting in
// the water or in a raft within earshot, placed in 3D at the survivor
// (HRTF panner, inverse distance), so they can be found by ear in fog and
// at night. Rafts blow them too.

import { NIGHT } from '../config/rescue.js';

export class Whistles {
  constructor(audio) {
    this.audio = audio;
    this.c = audio.ctx;
    this.timers = new Map();
  }

  blow(x, y, z) {
    const c = this.c;
    const pan = c.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = 25;
    pan.rolloffFactor = 1.3;
    const now = c.currentTime;
    if (pan.positionX) {
      pan.positionX.setValueAtTime(x, now);
      pan.positionY.setValueAtTime(y, now);
      pan.positionZ.setValueAtTime(z, now);
    } else {
      pan.setPosition(x, y, z);
    }
    pan.connect(this.audio.sfx);
    const f0 = 2800 + Math.random() * 500;
    for (let i = 0; i < 3; i++) {
      const t0 = now + i * 0.32;
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f0, t0);
      // The pea rattles: a fast warble.
      const lfo = c.createOscillator();
      lfo.frequency.value = 32;
      const depth = c.createGain();
      depth.gain.value = 90;
      lfo.connect(depth).connect(o.frequency);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.5, t0 + 0.02);
      g.gain.setValueAtTime(0.5, t0 + 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
      o.connect(g).connect(pan);
      o.start(t0);
      lfo.start(t0);
      o.stop(t0 + 0.26);
      lfo.stop(t0 + 0.26);
    }
    setTimeout(() => pan.disconnect(), 1500);
  }

  // survivors: waiting (water or raft); listener: {x, y, z}.
  update(dt, survivors, listener) {
    const w = NIGHT.whistle;
    for (const s of survivors) {
      const d = Math.hypot(s.x - listener.x, s.z - listener.z);
      if (d > w.range) {
        continue;
      }
      // One whistle per raft (its occupants take turns).
      const key = s.raft || s;
      let t = this.timers.get(key);
      if (t === undefined) {
        t = Math.random() * w.every[1];
      }
      t -= dt;
      if (t <= 0) {
        this.blow(s.x, (s.y ?? 0) + 0.5, s.z);
        t = w.every[0] + Math.random() * (w.every[1] - w.every[0]);
      }
      this.timers.set(key, t);
    }
  }
}
