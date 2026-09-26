// Guided first job (spec 15, 11.2): a new career starts with the sailboat
// Wren disabled just outside the Kettle Harbor breakwater. Contextual
// prompts only (no popups): throttle, low-speed steering, passing the line,
// the winch, casting off in the harbor. Weather stays Calm and daylight
// until she is in.

import { TUTORIAL } from '../config/career.js';

const KN = 0.514444;

export class TutorialSession {
  constructor(career) {
    this.career = career;
    this.game = career.game;
    this.step = 'throttle';
    this.steerHint = 0;
    this.doneHint = 0;
    this.active = true;
    const g = this.game;
    this.frozeTime = g.timeFrozen;
    g.setSeaState('calm', true);
    if (g.dayNight.hour < 8 || g.dayNight.hour > 17) {
      g.dayNight.setHour(9);
    }
    g.timeFrozen = true;
    const jobs = career.jobs;
    this.offerTimer = jobs.timer;
    jobs.timer = Infinity;
    jobs.offers.length = 0;
    const home = career.shape.ports.find((p) => p.home);
    const o = jobs.makeOffer(home.zone);
    const x = home.center.x + home.out.x * TUTORIAL.out + home.along.x * TUTORIAL.side;
    const z = home.center.z + home.out.z * TUTORIAL.out + home.along.z * TUTORIAL.side;
    Object.assign(o, { type: 'tow', vessel: 'sailboat', name: 'Wren', x, z, cx: x, cz: z, heading: Math.atan2(home.along.x, -home.along.z), label: 'Disabled vessel', seaState: 'calm' });
    o.estimate = jobs.estimate(o);
    o.text = 'The sailboat Wren has lost her engine outside the breakwater';
    jobs.offers.push(o);
    career.radio.say('Kettle Harbor: sailboat Wren has lost her engine just outside the breakwater. Take the Marlin out and bring her in.', 'mayday');
    jobs.accept(o.id);
    this.job = jobs.active;
  }

  // The prompt for this moment, or null to let the game speak.
  prompt() {
    if (!this.active) {
      return this.doneHint > 0 ? 'Job complete · Tab (JOBS) for the job board' : null;
    }
    if (this.step === 'throttle') {
      return 'W  Set the throttle';
    }
    if (this.steerHint > 0) {
      return 'A / D  Steer · slow? a blip of throttle makes the rudder bite';
    }
    if (this.step === 'approach') {
      return this.nearWren() < TUTORIAL.nearRange ? 'Stern within 8 m of her bow, under 3 kn · Space passes the line' : 'Head out of the channel to the Wren';
    }
    if (this.step === 'towing') {
      return this.inHarbor() ? 'Space  Cast off: she is in' : 'Q / Z  Winch out / in · keep the tension in the green';
    }
    return null;
  }

  nearWren() {
    const t = this.job.target;
    const p = this.career.player.state.pos;
    const q = t.sim.state.pos;
    return Math.hypot(q.x - p.x, q.z - p.z);
  }

  inHarbor() {
    const q = this.job.target.sim.state.pos;
    const port = this.career.shape.portAt(q.x, q.z);
    return Boolean(port && port.home);
  }

  fixed(dt) {
    this.doneHint = Math.max(0, this.doneHint - dt);
    if (!this.active) {
      return;
    }
    const c = this.career;
    const sim = c.player;
    const input = this.game.input;
    this.steerHint = Math.max(0, this.steerHint - dt);
    if (this.step === 'throttle' && c.game.session.boat.throttleLever > 0.2) {
      this.step = 'approach';
    }
    // Steering at under 3 kn: the rudder needs prop wash.
    const steering = input.isDown('KeyA') || input.isDown('KeyD') || (c.game.session.boat.wheel !== null && Math.abs(c.game.session.boat.wheel) > 0.3);
    if (!this.steerShown && this.step !== 'throttle' && steering && sim.speed / KN < 3) {
      this.steerShown = true;
      this.steerHint = TUTORIAL.hintSeconds;
    }
    if (this.step === 'approach' && c.ops.ops.lineTarget === this.job.target) {
      this.step = 'towing';
    }
    if (this.step === 'towing' && c.ops.ops.lineTarget !== this.job.target && !this.inHarbor()) {
      this.step = 'approach'; // line parted or cast off early: go again
    }
    if (this.job.state !== 'active') {
      this.finish(this.job.state === 'done');
    }
  }

  finish(ok) {
    this.active = false;
    const g = this.game;
    g.timeFrozen = this.frozeTime;
    this.career.jobs.timer = Math.min(this.offerTimer, TUTORIAL.firstOfferSeconds);
    this.career.career.tutorialDone = true;
    this.career.save();
    this.doneHint = ok ? TUTORIAL.hintSeconds : 0;
    if (!ok) {
      this.career.radio.say('Kettle Harbor: the Wren is lost. The job board has more work when you are ready.', 'warn');
    }
  }
}
