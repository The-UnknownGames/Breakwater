// Fishing (RP): with a boat that has a fish hold, shoot the nets (G) on a
// fishing ground and trawl at 2-5.5 kn; the catch fills the hold (it weighs
// the boat down) at a rate set by the ground and the weather. The nets drag
// hard (they hold a trawler to trawling speed). Haul (G) and sell the catch
// at any port with fuel. Pure JS.

import { FISHING } from '../config/career.js';
import { SEA_STATES } from '../config/weather.js';

const KN = 0.514444;

export class Fishing {
  constructor(shape) {
    this.shape = shape;
    this.nets = false; // out
    this.busy = 0; // seconds left shooting / hauling
    this.catchKg = 0;
    this.value = 0; // $ of the catch aboard
    this.ground = -1;
    this.hook = null;
  }

  canFish(player) {
    return Boolean(player.cfg.fishHoldKg);
  }

  groundAt(x, z) {
    const gs = this.shape.map.fishingGrounds;
    return gs.findIndex((g) => Math.hypot(x - g.x, z - g.z) < g.r);
  }

  // G: shoot or haul the nets (takes a little while either way).
  toggleNets(player) {
    if (!this.canFish(player) || this.busy > 0) {
      return false;
    }
    this.busy = FISHING.shootSeconds;
    this.nets = !this.nets;
    if (this.nets) {
      this.attach(player);
    } else {
      this.detach(player);
    }
    return true;
  }

  // Net drag at the stern, against the boat's motion through the water.
  attach(player) {
    const k = player.cfg.netDrag;
    this.hook = (s, f) => {
      const v = s.linvel;
      const sp = Math.hypot(v.x, v.z);
      if (sp < 0.05) {
        return;
      }
      f.fx -= (v.x / sp) * k * sp * sp;
      f.fz -= (v.z / sp) * k * sp * sp;
    };
    player.extraForces.push(this.hook);
  }

  detach(player) {
    const i = player.extraForces.indexOf(this.hook);
    if (i >= 0) {
      player.extraForces.splice(i, 1);
    }
    this.hook = null;
  }

  update(dt, player, seaState) {
    if (!this.canFish(player)) {
      return;
    }
    this.busy = Math.max(0, this.busy - dt);
    const p = player.state.pos;
    this.ground = this.groundAt(p.x, p.z);
    const sea = SEA_STATES.findIndex((s) => s.id === seaState);
    const kn = player.speed / KN;
    this.trawling = this.nets && this.busy === 0 && this.ground >= 0 && sea <= FISHING.maxSeaIndex && kn >= FISHING.trawlKn[0] && kn <= FISHING.trawlKn[1];
    if (!this.trawling) {
      return;
    }
    const room = player.cfg.fishHoldKg - this.catchKg;
    const kg = Math.min(room, (FISHING.kgPerMinute / 60) * FISHING.seaFactor[sea] * dt);
    if (kg <= 0) {
      return;
    }
    this.catchKg += kg;
    this.value += kg * FISHING.pricePerKg[this.ground];
    player.cargo += kg;
  }

  // At a port: land and sell the catch.
  sell(player) {
    const value = Math.round(this.value);
    player.cargo = Math.max(0, player.cargo - this.catchKg);
    this.catchKg = 0;
    this.value = 0;
    return value;
  }

  prompt(player) {
    if (!this.canFish(player)) {
      return null;
    }
    const hold = `${Math.round(this.catchKg)} / ${player.cfg.fishHoldKg} kg`;
    if (this.busy > 0) {
      return `${this.nets ? 'Shooting' : 'Hauling'} the nets… · ${hold}`;
    }
    const g = this.ground >= 0 ? this.shape.map.fishingGrounds[this.ground].name : null;
    if (this.nets) {
      if (this.catchKg >= player.cfg.fishHoldKg) {
        return `Hold full · ${hold} · G to haul, sell in port`;
      }
      return this.trawling ? `Trawling ${g} · ${hold} · G to haul` : g ? `Nets out · trawl at 2–5.5 kn · ${hold}` : `Nets out, off the grounds · ${hold} · G to haul`;
    }
    return g ? `${g} · G to shoot the nets · ${hold}` : null;
  }
}
