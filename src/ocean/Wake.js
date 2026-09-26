// Moving wake (spec 2.5): a real wake spreads. Each boat drops wake
// particles as it goes; they live in world space and are redrawn into the
// foam map's B channel every frame (not accumulated), so they can move and
// grow:
//   centre wash  - turbulent prop wash, widens steadily with age
//   quarter      - streaks off the transom corners, drift slowly outward
//   kelvin       - bow-wave crests that run outward at tan(19.5°)·u, which
//                  draws the classic V of diverging waves
// Pure data + a paint() into Foam; no three.js.

import { WAKE } from '../config/render.js';

export class Wake {
  constructor(max = WAKE.maxParticles) {
    this.max = max;
    this.n = 0;
    this.x = new Float32Array(max);
    this.z = new Float32Array(max);
    this.vx = new Float32Array(max);
    this.vz = new Float32Array(max);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.r0 = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.str = new Float32Array(max);
  }

  emit(x, z, vx, vz, r0, grow, str, life, age = 0) {
    if (this.n >= this.max) {
      return;
    }
    const i = this.n++;
    this.vx[i] = vx;
    this.vz[i] = vz;
    this.age[i] = age;
    this.life[i] = life;
    this.x[i] = x + vx * age;
    this.z[i] = z + vz * age;
    this.r0[i] = r0;
    this.grow[i] = grow;
    this.str[i] = str;
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.kill(i);
        continue;
      }
      // Outward motion slows as the wave energy spreads.
      const damp = Math.exp(-dt * WAKE.drag);
      this.vx[i] *= damp;
      this.vz[i] *= damp;
      this.x[i] += this.vx[i] * dt;
      this.z[i] += this.vz[i] * dt;
      i++;
    }
  }

  kill(i) {
    const l = --this.n;
    if (i === l) {
      return;
    }
    for (const a of [this.x, this.z, this.vx, this.vz, this.age, this.life, this.r0, this.grow, this.str]) {
      a[i] = a[l];
    }
  }

  // Draw every live particle into the foam map (B channel, this frame).
  paint(foam) {
    for (let i = 0; i < this.n; i++) {
      const t = this.age[i] / this.life[i];
      const r = this.r0[i] + this.grow[i] * this.age[i];
      // Decays with age; spreading thins it (same foam over a wider area).
      const s = this.str[i] * (1 - t) * (1 - t) * Math.sqrt(this.r0[i] / r);
      foam.paint(this.x[i], this.z[i], r, s, 2);
    }
  }
}
