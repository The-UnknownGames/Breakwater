// Flares (V5 night): parachute illumination flares the player fires (R),
// and red hand flares that survivors in rafts light when they see a boat
// in the dark. Pure JS: positions and burn time; the render side turns them
// into lights.

import { NIGHT } from '../config/rescue.js';

export class Flares {
  constructor() {
    this.list = [];
  }

  // A parachute flare from (x, y, z), fired up and a little ahead.
  fire(x, y, z, dirX = 0, dirZ = 0) {
    const c = NIGHT.flare;
    this.list.push({ kind: 'para', x, y, z, vx: dirX * 8, vz: dirZ * 8, vy: c.climb, t: 0, burn: c.burnSeconds, lit: false });
  }

  hand(x, z, owner = null) {
    this.list.push({ kind: 'hand', x, y: 1.2, z, vx: 0, vz: 0, vy: 0, t: 0, burn: NIGHT.handFlare.burnSeconds, lit: true, owner });
  }

  // wind: {x, z} m/s drift under the parachute.
  update(dt, wind) {
    const c = NIGHT.flare;
    for (const f of this.list) {
      f.t += dt;
      if (f.owner) {
        f.x = f.owner.x;
        f.z = f.owner.z;
      }
      if (f.kind === 'para') {
        if (!f.lit) {
          // Rocket: climbs, slowing, and ignites at the apex.
          f.vy = Math.max(0, f.vy - 9.81 * 0.55 * dt);
          f.y += f.vy * dt;
          f.x += f.vx * dt;
          f.z += f.vz * dt;
          if (f.vy <= 0 || f.y >= c.apex) {
            f.lit = true;
            f.litAt = f.t;
          }
        } else {
          f.y = Math.max(0, f.y - c.fall * dt);
          f.x += wind.x * 0.6 * dt;
          f.z += wind.z * 0.6 * dt;
        }
      }
    }
    this.list = this.list.filter((f) => (f.kind === 'para' ? !f.lit || f.t - f.litAt < f.burn : f.t < f.burn) && f.y > 0.5);
  }

  // 0..1 brightness (flickers a little; fades at the end of its burn).
  brightness(f) {
    if (!f.lit) {
      return 0;
    }
    const age = f.kind === 'para' ? f.t - f.litAt : f.t;
    const fade = Math.min(1, age / 0.6) * Math.min(1, (f.burn - age) / 4);
    const flicker = 0.85 + 0.15 * Math.sin(age * 23) * Math.sin(age * 7.3);
    return Math.max(0, fade * flicker);
  }
}
