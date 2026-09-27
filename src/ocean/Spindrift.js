// Spindrift (spec 7 storm look): in strong wind the crests around the
// camera shed spray that streams downwind in layers of haze. Puffs are
// spawned on crests (sampled against the wave height) as mist particles in
// the shared Spray system, so they are lit and fogged the same way.

import { SPINDRIFT, BREAKERS } from '../config/render.js';

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
      // Low wisps torn off the crest, skimming the surface downwind.
      this.spray.mist(1, x, h + 0.15, z, wind.x * 0.3, 0.3, wind.z * 0.3, 0.8, size, c.life, c.alpha);
    }
    this.acc = Math.min(this.acc, 5);
    this.breakers(dt, camera, waves, windKn, wind);
  }

  // Gale and up: the tallest crests break, throwing a burst of whitewater
  // droplets and a sheet of spray downwind.
  breakers(dt, camera, waves, windKn, wind) {
    const c = BREAKERS;
    const over = windKn - c.minWindKn;
    if (over <= 0) {
      return;
    }
    this.bacc = (this.bacc || 0) + over * c.ratePerKn * dt;
    const rng = this.spray.rng;
    const p = camera.position;
    const crest = waves.maxAmplitude * c.crestFraction;
    let tries = 0;
    while (this.bacc >= 1 && tries < 30) {
      tries++;
      const a = rng() * Math.PI * 2;
      const r = c.radius[0] + (c.radius[1] - c.radius[0]) * Math.sqrt(rng());
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      const h = waves.heightAt(x, z);
      if (h < crest) {
        continue;
      }
      this.bacc -= 1;
      this.spray.droplets(14, x, h + 0.3, z, wind.x * 0.45, 2.2, wind.z * 0.45, 1.6, 0.4, 1.4);
      this.spray.mist(2, x, h + 0.4, z, wind.x * 0.5, 0.8, wind.z * 0.5, 1.4, 3.2, 2.6, 0.22);
    }
    this.bacc = Math.min(this.bacc, 4);
  }
}
