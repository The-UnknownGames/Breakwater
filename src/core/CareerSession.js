// Browser side of the career (spec 8, 11): job board (Tab), radio log,
// port services (E when berthed), deliveries, tow-home after a capsize or
// sinking, money / reputation display and autosave.

import { Career } from '../gameplay/Career.js';
import { Jobs } from '../gameplay/Jobs.js';
import { Radio } from '../gameplay/Radio.js';
import { RadioPanel } from '../ui/RadioPanel.js';
import { JobBoard, PortMenu } from '../ui/JobBoard.js';
import { mulberry32 } from './Rng.js';
import { ECONOMY, JOBS } from '../config/career.js';

const KN = 0.514444;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class CareerSession {
  constructor(game, opts = {}) {
    this.game = game;
    this.ops = game.ops;
    this.shape = game.world.shape;
    const st = storage();
    if (opts.newCareer) {
      Career.clear(st);
    }
    this.career = (opts.persist && Career.load(st)) || new Career(opts.persist ? st : null);
    this.radio = new Radio();
    this.jobs = new Jobs(this.ops.ops, this.career, this.shape, mulberry32(opts.seed ?? Date.now() % 100000), this.radio);
    const hud = this.hud;
    this.radioPanel = new RadioPanel(hud.root);
    this.radio.on((m) => {
      this.radioPanel.push(m);
      this.ops.sfx?.radio?.(m.kind);
    });
    this.board = new JobBoard(document.body, this);
    this.portMenu = new PortMenu(document.body, this);
    this.pill = document.createElement('div');
    this.pill.className = 'money-pill';
    hud.root.appendChild(this.pill);
    this.career.onChange((e) => {
      if (e.amount) {
        hud.toast(`${e.amount > 0 ? '+' : '−'}$${Math.abs(e.amount).toLocaleString()} · ${e.why}`, e.amount > 0 ? 'ok' : 'warn', 3);
      }
    });
    this.port = null;
    this.saveTimer = ECONOMY.autosaveSeconds;
    this.wreckTimer = 0;
    game.input.on('Tab', () => this.board.toggle());
    game.input.on('Escape', () => {
      this.board.toggle(false);
      this.portMenu.toggle(false);
    });
    this.ops.onAction = () => this.action();
    this.ops.extraPrompt = () => this.prompt();
    this.ops.objectiveTarget = () => this.jobs.objective(this.player);
    if (opts.intro !== false) {
      this.radio.say('Kettle Harbor: morning, skipper. The Marlin is fuelled at the berth. Tab for the job board; calls come in over the radio.', 'info');
    }
    for (let i = 0; i < JOBS.firstOffers; i++) {
      this.jobs.offers.push(this.jobs.makeOffer(this.player.state.pos));
    }
  }

  get hud() {
    return this.game.session.hud;
  }

  get player() {
    return this.game.session.sim;
  }

  get boatId() {
    return this.game.session.cfg.id;
  }

  fixed(dt) {
    const g = this.game;
    this.radio.update(dt);
    this.jobs.update(dt, this.player, g.weather.state.id);
    const p = this.player.state.pos;
    const port = this.shape.portAt(p.x, p.z);
    if (port !== this.port) {
      this.port = port;
      if (port) {
        this.radio.say(`${port.name}: welcome in.`, 'info');
        this.save();
      }
    }
    if (port && port.services.includes('dropoff') && this.ops.ops.aboard > 0) {
      this.jobs.deliver(port);
    }
    this.checkWreck(dt);
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) {
      this.saveTimer = ECONOMY.autosaveSeconds;
      this.save();
    }
  }

  // Capsized or sunk: towed home for a fee, job lost.
  checkWreck(dt) {
    const hull = this.player.hull;
    if (!hull.capsized && !hull.foundered) {
      this.wreckTimer = 0;
      return;
    }
    this.wreckTimer += dt;
    if (this.wreckTimer < 5) {
      return;
    }
    this.wreckTimer = 0;
    if (this.jobs.active) {
      this.jobs.abandon();
    }
    this.ops.ops.clear();
    this.career.towHome(hull, this.boatId);
    this.returnToBerth();
    this.radio.say('Kettle Harbor: we got you home. The tow and the repairs are on your account.', 'warn');
    this.hud.banner.hidden = true;
  }

  returnToBerth() {
    const sim = this.player;
    const home = this.shape.ports.find((p) => p.home);
    const b = sim.body;
    const h = home.dock.heading;
    b.setTranslation({ x: home.dock.x, y: 0, z: home.dock.z }, true);
    b.setRotation({ x: 0, y: Math.sin((Math.PI - h) / 2), z: 0, w: Math.cos((Math.PI - h) / 2) }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    sim.readState();
    sim.copyPrev();
    const hull = sim.hull;
    hull.capsized = false;
    hull.foundered = false;
    hull.overTime = 0;
    hull.integrity = 100;
    hull.flood = 0;
    hull.fuel = hull.fuelMax;
    sim.propulsion.enabled = true;
    sim.payload = 0;
    this.game.session.boat.throttleLever = 0;
  }

  berthed() {
    return this.port && this.player.speed / KN < 2.5 ? this.port : null;
  }

  action() {
    const port = this.berthed();
    if (port) {
      this.portMenu.toggle(true, port);
    }
  }

  prompt() {
    const port = this.berthed();
    if (port && !this.portMenu.open) {
      return `E  ${port.name} services · Tab  Job board`;
    }
    return null;
  }

  frame(dt) {
    this.radioPanel.update(dt);
    this.pill.textContent = `$${Math.round(this.career.money).toLocaleString()} · Rep ${Math.round(this.career.reputation)}`;
    if (this.board.open && Math.floor(this.jobs.timer) % 5 === 0) {
      // Keep distances fresh while it is open.
      this.boardRefresh = (this.boardRefresh || 0) + dt;
      if (this.boardRefresh > 2) {
        this.boardRefresh = 0;
        this.board.render();
      }
    }
  }

  save() {
    const g = this.game;
    const hull = this.player.hull;
    this.career.save({ hour: g.dayNight.hour, weather: g.weather.state.id, fuel: hull.fuel, integrity: hull.integrity });
  }

  snapshot() {
    return {
      money: this.career.money,
      reputation: this.career.reputation,
      offers: this.jobs.offers.length,
      activeJob: this.jobs.active ? this.jobs.active.type : null,
      port: this.port ? this.port.id : null,
    };
  }
}
