// Player autopilot (spec 8.4, after the upgrade): T steers to the chart
// waypoint (or the active job's objective) with the same Autopilot helper
// the tests use, and compresses time up to 4× in open water. Any helm input,
// a radio call, an object within 300 m, rising seas or shoal water ahead
// hands control back.

import { Autopilot } from '../gameplay/Autopilot.js';
import { AUTOPILOT } from '../config/upgrades.js';
import { SEA_STATES } from '../config/weather.js';

const HELM_KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyX'];

export class AutopilotSession {
  constructor(career) {
    this.career = career;
    this.game = career.game;
    this.engaged = false;
    this.compression = 1;
    this.ap = null;
    this.message = '';
    this.game.input.on('KeyT', () => this.toggle());
    career.radio.on(() => this.setCompression(1));
  }

  get player() {
    return this.career.player;
  }

  target() {
    return this.career.waypoint || this.career.jobs.objective(this.player);
  }

  toggle(force) {
    const on = force !== undefined ? force : !this.engaged;
    if (on && !this.career.career.has('autopilot')) {
      this.career.hud.toast('Autopilot: fit one at the Kettle Harbor shipyard', 'warn', 2.5);
      return;
    }
    if (on && !this.target()) {
      this.career.hud.toast('Autopilot: no waypoint or job to steer to', 'warn', 2.5);
      return;
    }
    this.engaged = on;
    if (on) {
      this.ap = new Autopilot(this.player);
      this.lever = this.game.session.boat.throttleLever;
      this.wheel = this.game.session.boat.wheel;
    } else {
      this.setCompression(1);
    }
    this.career.hud.toast(on ? 'Autopilot engaged' : 'Autopilot off', 'ok', 1.5);
  }

  disengage(why) {
    if (!this.engaged) {
      return;
    }
    this.engaged = false;
    this.setCompression(1);
    this.game.session.boat.throttleLever = 0;
    this.career.hud.toast(`Autopilot off · ${why}`, 'warn', 2.5);
  }

  setCompression(k) {
    this.compression = k;
    this.game.loop.timeScale = k;
  }

  // After the helm has read the player's input: steer if engaged.
  fixed(dt) {
    if (!this.engaged) {
      return;
    }
    const g = this.game;
    const boat = g.session.boat;
    const input = g.input;
    if (HELM_KEYS.some((k) => input.isDown(k) || input.pressed.has(k)) || boat.throttleLever !== this.lever || boat.wheel !== this.wheel) {
      this.disengage('helm');
      return;
    }
    const t = this.target();
    if (!t) {
      this.disengage('arrived');
      return;
    }
    const sim = this.player;
    const top = sim.cfg.targets.topSpeedKn;
    const d = this.ap.update(dt, t, { cruiseKn: top * AUTOPILOT.cruiseFraction, arriveKn: AUTOPILOT.arriveKn, stopDist: AUTOPILOT.stopDist });
    // Keep the lever display in step with what the autopilot commands.
    boat.throttleLever = this.lever = Math.round(sim.input.throttle * 1000) / 1000;
    if (d < AUTOPILOT.stopDist) {
      this.disengage('arrived');
      return;
    }
    if (this.shoalAhead()) {
      this.disengage('shoal water ahead');
      return;
    }
    this.setCompression(this.clear(d) ? AUTOPILOT.maxCompression : 1);
  }

  // Seabed shallower than 4 m within 150 m ahead.
  shoalAhead() {
    const sim = this.player;
    const p = sim.state.pos;
    const f = sim.forward;
    const shape = this.career.shape;
    for (let r = 20; r <= 150; r += 20) {
      if (shape.depthAt(p.x + f.x * r, p.z + f.z * r) < 4) {
        return true;
      }
    }
    return false;
  }

  // Open water, fair weather, nothing within range: time may run fast.
  clear(dist) {
    const g = this.game;
    const seaIndex = SEA_STATES.findIndex((s) => s.id === g.weather.state.id);
    if (seaIndex > AUTOPILOT.maxSeaIndex || g.weather.transitioning || dist < AUTOPILOT.clearRange) {
      return false;
    }
    const p = this.player.state.pos;
    const r = AUTOPILOT.clearRange;
    const ops = g.ops.ops;
    const near = (x, z) => Math.hypot(x - p.x, z - p.z) < r;
    if (ops.targets.some((t) => near(t.sim.state.pos.x, t.sim.state.pos.z))) {
      return false;
    }
    if (ops.field.waiting().some((s) => near(s.x, s.z))) {
      return false;
    }
    return !this.career.shape.shallowNear(p.x, p.z, r, 3) && !this.career.shape.portAt(p.x, p.z);
  }
}
