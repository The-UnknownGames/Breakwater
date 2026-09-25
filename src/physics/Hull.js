// Hull state (spec 3.5): stability monitor + capsize, fuel, integrity and
// flooding. Stability itself emerges from the buoyancy distribution; this
// only watches heel. Flooding/damage mechanics are completed in V3.

import { heelPitch } from '../core/math.js';

const DEG = Math.PI / 180;

export class HullState {
  constructor(cfg) {
    this.cfg = cfg;
    this.heel = 0;
    this.pitch = 0;
    this.overTime = 0;
    this.capsized = false;
    this.integrity = 100;
    this.flood = 0; // tonnes of water aboard
    this.fuel = cfg.fuelLitres;
    this.fuelMax = cfg.fuelLitres;
    this.onCapsize = null;
  }

  get heelRatio() {
    return Math.abs(this.heel) / (this.cfg.capsizeDeg * DEG);
  }

  update(dt, rot, propulsion) {
    const hp = heelPitch(rot);
    this.heel = hp.heel;
    this.pitch = hp.pitch;
    if (!this.capsized) {
      if (Math.abs(this.heel) > this.cfg.capsizeDeg * DEG) {
        this.overTime += dt;
        if (this.overTime >= this.cfg.capsizeHoldSeconds) {
          this.capsized = true;
          propulsion.enabled = false;
          if (this.onCapsize) {
            this.onCapsize();
          }
        }
      } else {
        this.overTime = 0;
      }
    }
    // Fuel: full throttle empties the tank in fuelMinutesFullThrottle.
    const burn = (this.fuelMax / (this.cfg.fuelMinutesFullThrottle * 60)) * (0.08 + 0.92 * Math.abs(propulsion.load));
    this.fuel = Math.max(0, this.fuel - burn * dt);
    if (this.fuel <= 0) {
      propulsion.enabled = false;
    }
  }
}
