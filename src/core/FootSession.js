// On foot (V7): leave the helm (E) when she is moored or anchored in calm
// water, walk the deck, step ashore and into town, and take the wheel
// again. Owns the walker, the mooring lines, the first-person camera,
// footsteps, and the building counters (job board, shipyard, fuel...).

import * as THREE from 'three';
import { Walker } from '../foot/Walker.js';
import { BoatDeck } from '../foot/Ground.js';
import { Mooring } from '../gameplay/Mooring.js';
import { RopeVisual } from '../physics/RopeVisual.js';
import { Footsteps } from '../audio/Footsteps.js';
import { FOOT } from '../config/onfoot.js';
import { SEA_STATES } from '../config/weather.js';
import { FootInput } from './FootInput.js';

const KN = 0.514444;

export class FootSession {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.sim = game.session.sim;
    this.deck = new BoatDeck(this.sim);
    this.walker = new Walker(this.world.ground, () => [this.deck]);
    this.mooring = new Mooring(this.sim, this.world.ground);
    this.walking = false;
    this.controls = new FootInput(game, this);
    this.prevPos = new THREE.Vector3();
    this.curPos = new THREE.Vector3();
    this.eye = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.tilt = new THREE.Quaternion();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.ropes = [];
    this.lastCam = 'chase';
    this.footsteps = null;
    game.audio.onReady((a) => {
      this.footsteps = new Footsteps(a);
    });
    this.initial = true;
  }

  get hud() {
    return this.game.session.hud;
  }

  get career() {
    return this.game.career;
  }

  // Why she can't be left, or null when she can.
  leaveBlock() {
    const sim = this.sim;
    if (sim.speed / KN > FOOT.deckWalk.maxKn) {
      return 'Stop her first';
    }
    if (this.mooring.moored) {
      return null;
    }
    const anchored = this.career && this.career.leisure && this.career.leisure.anchor;
    const limit = SEA_STATES.findIndex((s) => s.id === FOOT.deckWalk.anchoredMaxSea);
    const sea = SEA_STATES.findIndex((s) => s.id === this.game.weather.state.id);
    if (anchored && sea <= limit) {
      return null;
    }
    return anchored ? 'Too rough to leave the helm' : null;
  }

  canLeave() {
    const anchored = this.career && this.career.leisure && this.career.leisure.anchor;
    return (this.mooring.moored || anchored) && this.leaveBlock() === null;
  }

  opsBusy() {
    const o = this.game.ops && this.game.ops.ops;
    return Boolean(o && (o.pull || o.transfer || o.buoy || o.pullCandidate() || o.crewCandidate() || o.hoseCandidate()));
  }

  // Fixed step, before the ops/career keys are read.
  fixed(dt, input) {
    const sim = this.sim;
    const ev = this.mooring.update(dt, this.walking ? 0 : sim.input.throttle);
    if (ev === 'moored' && !this.initial) {
      this.hud.toast('Lines ashore', 'ok', 2);
      this.game.audio.click();
    } else if (ev === 'slipped') {
      this.hud.toast('Lines slipped', 'ok', 1.5);
    }
    this.initial = false;
    if (this.walking) {
      this.controls.poll(dt);
      this.prevPos.copy(this.curPos);
      this.walker.step(dt, this.controls.move, this.controls.takeLook());
      this.curPos.set(this.walker.pos.x, this.walker.pos.y, this.walker.pos.z);
      if (this.controls.consume('KeyE')) {
        this.action();
      }
      return;
    }
    // At the helm: E stands up (nothing else to do with it), Space casts off.
    if (input.pressed.get('KeyE') && !this.opsBusy() && this.canLeave()) {
      input.consume('KeyE');
      this.standUp();
      return;
    }
    const ops = this.game.ops && this.game.ops.ops;
    if (this.mooring.moored && input.pressed.get('Space') && ops && !ops.line && !ops.attachCandidate().target) {
      input.consume('Space');
      this.mooring.release();
      this.hud.toast('Cast off', 'ok', 1.5);
    }
  }

  standUp() {
    const boat = this.game.session.boat;
    boat.throttleLever = 0;
    boat.wheel = null;
    this.sim.input.throttle = 0;
    this.sim.input.rudder = 0;
    const s = this.deck.spot(this.deck.plan.stand);
    // Face the pier when moored (the way ashore), else look aft.
    let yaw = this.sim.heading + Math.PI;
    const m = this.mooring.lines;
    if (m) {
      const d = m.town.frame.dirToWorld(-m.edge.n.a, -m.edge.n.o, {});
      yaw = Math.atan2(d.x, -d.z);
    }
    this.walker.place(s.x, s.y, s.z, yaw);
    this.walker.pitch = -0.05;
    this.curPos.set(this.walker.pos.x, this.walker.pos.y, this.walker.pos.z);
    this.prevPos.copy(this.curPos);
    this.walking = true;
    this.lastCam = this.game.rig.mode;
    this.game.rig.setMode('foot');
    this.game.input.sink = this.controls;
    this.hud.root.classList.add('on-foot');
    if (this.career && this.career.autopilot) {
      this.career.autopilot.disengage('left the helm');
    }
  }

  // Debug / screenshots: stand at frame point (a, o) of a port's town.
  debugPlace(portId, a, o, yawDeg = 0, pitchDeg = 0) {
    const t = this.world.towns.find((x) => x.id === portId);
    if (!t) {
      return false;
    }
    if (!this.walking) {
      this.standUp();
    }
    const w = t.frame.toWorld(a, o, {});
    const d = t.frame.dirToWorld(Math.sin((yawDeg * Math.PI) / 180), Math.cos((yawDeg * Math.PI) / 180), {});
    const ok = this.walker.place(w.x, 4, w.z, Math.atan2(d.x, -d.z));
    this.walker.pitch = (pitchDeg * Math.PI) / 180;
    this.curPos.set(this.walker.pos.x, this.walker.pos.y, this.walker.pos.z);
    this.prevPos.copy(this.curPos);
    return ok;
  }

  takeHelm() {
    this.walking = false;
    this.game.input.sink = null;
    this.controls.release();
    this.game.rig.setMode(this.lastCam === 'foot' ? 'chase' : this.lastCam);
    this.hud.root.classList.remove('on-foot');
  }

  // What E does here on foot: { label, run } or null.
  interaction() {
    const w = this.walker;
    if (w.onBoat) {
      const h = this.deck.spot(this.deck.plan.helm);
      if (Math.hypot(h.x - w.pos.x, h.z - w.pos.z) < FOOT.helmReach) {
        return { label: 'E  Take the wheel', run: () => this.takeHelm() };
      }
      return null;
    }
    const t = this.world.ground.townAt(w.pos.x, w.pos.z);
    if (!t) {
      return null;
    }
    const l = t.frame.toLocal(w.pos.x, w.pos.z, {});
    for (const b of t.buildings) {
      if (b.service && Math.hypot(l.a - b.service.a, l.o - b.service.o) < FOOT.doorReach) {
        return this.service(b, t);
      }
    }
    return null;
  }

  // The counter of building b in town t.
  service(b, t) {
    const c = this.career;
    if (!c) {
      return null;
    }
    const port = t.port;
    const menu = (only, title) => () => c.portMenu.toggle(true, port, only, title);
    const here = this.mooring.moored && this.mooring.lines.town === t;
    switch (b.opens) {
      case 'jobs':
        return { label: 'E  Job board (harbormaster)', run: () => c.board.toggle(true) };
      case 'shipyard':
        return { label: 'E  Shipyard · repairs, boats, upgrades', run: menu(['repair', 'shipyard'], b.name) };
      case 'fuel':
        return here ? { label: 'E  Fuel and flares', run: menu(['fuel', 'flares'], b.name) } : { label: 'Bring her alongside to take fuel', run: () => {} };
      case 'fish':
        return { label: 'E  Sell your catch', run: menu(['fish'], b.name) };
      case 'gear':
        return { label: 'E  Chandlery · flares and gear', run: menu(['flares'], b.name) };
      case 'port':
        return { label: `E  ${port.name} services`, run: menu(null, port.name) };
      case 'pub':
        return { label: 'E  Buy a drink ($4) · hear the talk', run: () => this.pub(port) };
      case 'home':
        return { label: 'E  Sleep until morning (saves)', run: () => this.sleep() };
      default:
        return null;
    }
  }

  action() {
    const it = this.interaction();
    if (it) {
      it.run();
    }
  }

  pub(port) {
    const c = this.career;
    if (c.career.money < 4) {
      this.hud.toast('Not enough for a drink', 'warn', 2);
      return;
    }
    c.career.spend(4, `A drink at ${port.name}`);
    const chain = this.game.weatherChain;
    const lines = [
      chain ? `Old Ewan at the bar, reading the glass: "${chain.forecastText(this.game.dayNight.hour, 3)}."` : null,
      c.jobs.offers.length ? `A trawlerman: "There's ${c.jobs.offers.length} call${c.jobs.offers.length > 1 ? 's' : ''} on the board. Harbormaster's been looking for you."` : 'A trawlerman: "Quiet out there. Won\'t last."',
      '"Crane Marine had two boats out past the Teeth last night. Didn\'t say what for."',
      '"Mind Widow Reef on the ebb. Took the Ellen Mary\'s rudder clean off."',
    ].filter(Boolean);
    c.radio.say(lines[Math.floor(Math.random() * lines.length)], 'info');
  }

  sleep() {
    const g = this.game;
    const h = g.dayNight.hour;
    g.dayNight.setHour(h < 6 ? 7 : 31);
    if (this.career) {
      this.career.save();
    }
    this.hud.toast('Slept until morning · saved', 'ok', 3);
  }

  prompt() {
    if (this.walking) {
      const it = this.interaction();
      if (it) {
        return it.label;
      }
      const b = this.walker.inside;
      return b && b.enter ? b.name : null;
    }
    if (this.opsBusy()) {
      return null;
    }
    const parts = [];
    if (this.canLeave()) {
      parts.push(this.mooring.moored ? 'E  Go ashore' : 'E  Leave the helm');
    } else if (this.career && this.career.leisure && this.career.leisure.anchor && this.leaveBlock()) {
      parts.push(this.leaveBlock());
    }
    if (this.mooring.moored) {
      parts.push('Space  Cast off');
    }
    return parts.length ? parts.join(' · ') : null;
  }

  // Render frame: eyes, footsteps, mooring lines.
  frame(dt, alpha) {
    this.updateLines(dt);
    if (!this.walking) {
      return;
    }
    const w = this.walker;
    const cam = this.game.camera;
    const model = this.game.session.boat.model;
    if (w.onBoat && !w.transition) {
      // Ride the interpolated model (no judder against the rendered deck).
      const s = w.support.local;
      const d = this.deck.deckY(s.x, s.z) ?? 0;
      this.eye.set(s.x, d, s.z).applyMatrix4(model.matrixWorld);
      const e = w.eye(this.tmpE || (this.tmpE = new THREE.Vector3()));
      this.eye.x += e.x - w.pos.x;
      this.eye.y += e.y - w.pos.y;
      this.eye.z += e.z - w.pos.z;
    } else {
      const e = w.eye(this.tmpE || (this.tmpE = new THREE.Vector3()));
      this.eye.set(this.prevPos.x + (this.curPos.x - this.prevPos.x) * alpha, 0, this.prevPos.z + (this.curPos.z - this.prevPos.z) * alpha);
      this.eye.x += e.x - w.pos.x;
      this.eye.z += e.z - w.pos.z;
      this.eye.y = e.y;
    }
    cam.position.copy(this.eye);
    this.euler.set(w.pitch, -w.yaw, 0);
    this.q.setFromEuler(this.euler);
    if (w.onBoat) {
      // The deck pitches and rolls under you.
      const yawOnly = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(2 * (model.quaternion.w * model.quaternion.y + model.quaternion.x * model.quaternion.z), 1 - 2 * (model.quaternion.y ** 2 + model.quaternion.x ** 2)));
      this.tilt.copy(model.quaternion).multiply(yawOnly.invert());
      this.tilt.slerp(new THREE.Quaternion(), 1 - FOOT.deckTilt);
      cam.quaternion.copy(this.tilt).multiply(this.q);
    } else {
      cam.quaternion.copy(this.q);
    }
    if (this.footsteps) {
      this.footsteps.update(w);
    }
  }

  // Bow and stern lines to the bollards while moored.
  updateLines(dt) {
    const m = this.mooring;
    const g = this.game;
    if (!m.moored) {
      for (const r of this.ropes) {
        g.scene.remove(r.mesh);
        r.dispose();
      }
      this.ropes = [];
      return;
    }
    const lines = [m.lines.bow, m.lines.stern].filter((l) => l.bollard);
    while (this.ropes.length < lines.length) {
      const r = new RopeVisual(0xd8cfb8);
      g.scene.add(r.mesh);
      this.ropes.push(r);
    }
    const model = g.session.boat.model;
    lines.forEach((l, i) => {
      const a = new THREE.Vector3(0, this.deck.deckY(0, l.local.z) ?? 1, l.local.z).applyMatrix4(model.matrixWorld);
      const b = l.bollard;
      const len = Math.hypot(a.x - b.x, a.z - b.z) * 1.02;
      this.ropes[i].update(dt, a, b, len, l.tension || 0, g.waves, g.camera.position, g.session.spray);
    });
  }

  snapshot() {
    const w = this.walker;
    return {
      onFoot: this.walking,
      moored: this.mooring.moored,
      footPos: this.walking ? [w.pos.x, w.pos.y, w.pos.z] : null,
      footSurface: this.walking ? w.surface : null,
      footOnBoat: this.walking ? w.onBoat : null,
      footInside: this.walking && w.inside ? w.inside.id || null : null,
    };
  }
}
