// Moving wake (spec 2.5): a real wake spreads. Each boat owns a few wake
// streams (centre wash, two quarter streaks, two Kelvin bow-wave arms). A
// stream is an ordered ring of particles dropped as the boat moves; they
// live in world space, drift outward and grow, and every frame each pair of
// neighbours is drawn as one tapered ribbon segment into the foam map
// (FoamRibbons), so the wake is a continuous band that widens with age:
//   centre  - turbulent prop wash, widens steadily
//   quarter - streaks off the transom corners, drift slowly outward
//   kelvin  - bow-wave crests running outward at tan(19.5°)·u (the V)
// Pure data; no three.js.

import { WAKE } from '../config/render.js';

class Stream {
  constructor(cap, life) {
    this.cap = cap;
    this.life = life;
    this.head = 0; // next write slot
    this.count = 0;
    this.x = new Float32Array(cap);
    this.z = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vz = new Float32Array(cap);
    this.age = new Float32Array(cap);
    this.r0 = new Float32Array(cap);
    this.grow = new Float32Array(cap);
    this.str = new Float32Array(cap);
    this.h = new Float32Array(cap);
    this.touched = 0;
  }

  emit(x, z, vx, vz, r0, grow, str, age = 0, h = 0) {
    const i = this.head;
    this.head = (this.head + 1) % this.cap;
    this.count = Math.min(this.cap, this.count + 1);
    this.x[i] = x + vx * age;
    this.z[i] = z + vz * age;
    this.vx[i] = vx;
    this.vz[i] = vz;
    this.age[i] = age;
    this.r0[i] = r0;
    this.grow[i] = grow;
    this.str[i] = str;
    this.h[i] = h;
    this.touched = 0;
  }

  // Oldest-first index k -> slot.
  slot(k) {
    return (this.head - this.count + k + this.cap) % this.cap;
  }

  update(dt) {
    const damp = Math.exp(-dt * WAKE.drag);
    for (let k = 0; k < this.count; k++) {
      const i = this.slot(k);
      this.age[i] += dt;
      this.vx[i] *= damp;
      this.vz[i] *= damp;
      this.x[i] += this.vx[i] * dt;
      this.z[i] += this.vz[i] * dt;
    }
    // Same life for the whole stream, so the oldest always die first.
    while (this.count > 0 && this.age[this.slot(0)] >= this.life) {
      this.count--;
    }
    this.touched += dt;
  }

  radius(i) {
    return this.r0[i] + this.grow[i] * this.age[i];
  }

  strength(i) {
    const t = this.age[i] / this.life;
    // Decays with age; spreading thins it (same foam over a wider area).
    return this.str[i] * (1 - t) * (1 - t) * Math.sqrt(this.r0[i] / this.radius(i));
  }

  // Wave height of a crest: decays as it spreads and ages.
  height(i) {
    const t = this.age[i] / this.life;
    return this.h[i] * (1 - t) * Math.sqrt(this.r0[i] / this.radius(i));
  }

  paint(foam) {
    const maxGap = WAKE.spacing * 6;
    for (let k = 0; k + 1 < this.count; k++) {
      const a = this.slot(k);
      const b = this.slot(k + 1);
      const gap = Math.hypot(this.x[b] - this.x[a], this.z[b] - this.z[a]);
      // Broken where the boat stopped emitting (or jumped).
      if (gap > maxGap + this.radius(a)) {
        continue;
      }
      foam.segment(this.x[a], this.z[a], this.x[b], this.z[b], this.radius(a), this.radius(b), this.strength(a), this.strength(b), this.height(a), this.height(b));
    }
  }
}

export class Wake {
  constructor() {
    this.streams = new Set();
  }

  // A new stream for one trail of one boat.
  stream(life, cap = WAKE.streamCap) {
    const s = new Stream(cap, life);
    this.streams.add(s);
    return s;
  }

  update(dt) {
    for (const s of this.streams) {
      s.update(dt);
      // Streams of boats that are gone empty out and are dropped.
      if (s.count === 0 && s.touched > 30) {
        this.streams.delete(s);
      }
    }
  }

  paint(foam) {
    for (const s of this.streams) {
      s.paint(foam);
    }
  }
}
