// Wind (with gusts) and a slow procedural surface current. Pure JS.
// Channel-strengthened currents arrive with the island terrain in V4.

import { PHYS } from '../config/physics.js';
import { windTravelVector } from '../ocean/Waves.js';

const KN = 0.514444;

export class Environment {
  constructor() {
    this.time = 0;
    this.wind = { x: 0, z: 0, speed: 0 };
    this.current = { x: 0, z: 0 };
  }

  update(dt, weatherParams) {
    this.time += dt;
    const t = this.time;
    const gust = 1 + PHYS.gustAmount * (0.6 * Math.sin((t * 2 * Math.PI) / PHYS.gustPeriod) + 0.4 * Math.sin(t * 1.93 + 1.1));
    const speed = weatherParams.windKn * KN * gust;
    const dir = windTravelVector(weatherParams.windDirectionDeg);
    this.wind.x = dir.x * speed;
    this.wind.z = dir.z * speed;
    this.wind.speed = speed;
  }

  currentAt(x, z, out = this.current) {
    const s = PHYS.currentScale;
    const a = Math.sin(x / s + 0.3 * Math.cos(z / (s * 1.7))) + Math.cos(z / (s * 1.3));
    const b = Math.cos(x / (s * 1.1)) - Math.sin(z / s + 0.7);
    out.x = PHYS.currentBase * 0.6 + PHYS.currentVariation * 0.5 * a;
    out.z = -PHYS.currentBase * 0.8 + PHYS.currentVariation * 0.5 * b;
    return out;
  }
}
