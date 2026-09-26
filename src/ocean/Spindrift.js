// Spindrift (spec 7 storm look): in strong wind the crests around the
// camera shed spray that streams downwind in layers of haze. Puffs are
// spawned on crests (sampled against the wave height) as mist particles in
// the shared Spray system, so they are lit and fogged the same way.

import { SPINDRIFT } from '../config/render.js';

export class Spindrift {
  constructor(spray) {
    this.spray = spray;
    this.acc = 0;
  }

  update(dt, camera, waves, windKn, wind) {
    const c = SPINDRIFT;
    const over = windKn - c.minWindKn;
    if (over <= 0) {
      return;
    }
    this.acc += over * c.ratePerKn * dt;
    const rng = this.spray.rng;
    const p = camera.position;
    const crest = waves.maxAmplitude * 0.45;
    let tries = 0;
    while (this.acc >= 1 && tries < 40) {
      tries++;
      const a = rng() * Math.PI * 2;
      const r = c.radius[0] + (c.radius[1] - c.radius[0]) * Math.sqrt(rng());
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      const h = waves.heightAt(x, z);
      if (h < crest) {
        continue;
      }
      this.acc -= 1;
      const size = c.size[0] + (c.size[1] - c.size[0]) * rng();
      this.spray.mist(1, x, h + 0.4, z, wind.x * 0.8, 0.8, wind.z * 0.8, 2, size, c.life);
    }
    this.acc = Math.min(this.acc, 5);
  }
}
