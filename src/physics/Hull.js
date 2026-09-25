// Hull state (spec 3.5): stability monitor + capsize, fuel, integrity,
// flooding and pumps. Stability itself emerges from the buoyancy
// distribution; flood water is extra weight low in the hull that runs to
// the low side (free surface), applied by BoatPhysics.
//   inflow: green water over the deck edge + leaks below 60% integrity
//   outflow: pumps at their rated capacity
//   founder: flood above 60% of reserve buoyancy -> the boat sinks

import { heelPitch } from '../core/math.js';
import { FLOOD } from '../config/rescue.js';

const DEG = Math.PI / 180;

export class HullState {
  constructor(cfg, reserveTonnes = 10) {
    this.cfg = cfg;
    this.heel = 0;
    this.pitch = 0;
    this.overTime = 0;
    this.capsized = false;
    this.foundered = false;
    this.integrity = 100;
    this.flood = 0; // tonnes of water aboard
    this.inflow = 0; // t/s, last step
    this.pumping = false;
    this.pumpRate = (cfg.pumpTonnesPerMin || 0) / 60; // t/s
    this.extraPump = 0; // t/s from a connected pump hose
    this.extraLeak = 0; // t/s scripted (a target already taking on water)
    this.reserve = reserveTonnes;
    this.founderAt = FLOOD.founderRatio * reserveTonnes;
    this.fuel = cfg.fuelLitres || 0;
    this.fuelMax = cfg.fuelLitres || 0;
    this.grounded = false;
    this.scrape = 0; // sliding speed on the seabed (m/s), for audio
    this.onCapsize = null;
    this.onFounder = null;
  }

  get heelRatio() {
    return Math.abs(this.heel) / (this.cfg.capsizeDeg * DEG);
  }

  get floodRatio() {
    return this.flood / this.founderAt;
  }

  get leakRate() {
    const below = FLOOD.leakThreshold - this.integrity;
    return below > 0 ? ((below / FLOOD.leakThreshold) * FLOOD.leakMaxPerMin) / 60 : 0;
  }

  damage(percent) {
    this.integrity = Math.max(0, this.integrity - percent);
  }

  // Port repair: hull, water and fuel restored.
  repair() {
    this.integrity = 100;
    this.flood = 0;
    this.fuel = this.fuelMax;
    this.extraLeak = 0;
  }

  // io: { greenWater (m of deck-edge immersion, summed), groundDamage (%/s),
  //       scrape (m/s) }
  update(dt, rot, propulsion, io) {
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
    if (io) {
      this.damage(io.groundDamage * dt);
      this.grounded = io.groundDamage > 0 || io.scrape > 0;
      this.scrape = io.scrape;
      this.flooding(dt, io.greenWater, propulsion);
    }
    // Fuel: full throttle empties the tank in fuelMinutesFullThrottle.
    if (this.fuelMax > 0) {
      const burn = (this.fuelMax / (this.cfg.fuelMinutesFullThrottle * 60)) * (0.08 + 0.92 * Math.abs(propulsion.load));
      this.fuel = Math.max(0, this.fuel - burn * dt);
      if (this.fuel <= 0) {
        propulsion.enabled = false;
      }
    }
  }

  flooding(dt, greenWater, propulsion) {
    this.inflow = greenWater * FLOOD.greenWaterRate + this.leakRate + this.extraLeak;
    if (this.foundered) {
      this.inflow += FLOOD.sinkRate;
    }
    const pump = this.foundered ? 0 : this.pumpRate + this.extraPump;
    this.pumping = pump > 0 && this.flood > 0.001;
    const cap = this.reserve * 1.5;
    this.flood = Math.min(cap, Math.max(0, this.flood + (this.inflow - (this.pumping ? pump : 0)) * dt));
    if (!this.foundered && this.flood > this.founderAt) {
      this.foundered = true;
      propulsion.enabled = false;
      if (this.onFounder) {
        this.onFounder();
      }
    }
  }
}
