// Browser side of the career (spec 8, 11): job board (Tab), radio log,
// port services (E when berthed), deliveries, tow-home after a capsize or
// sinking, money / reputation display and autosave.

import { Career } from '../gameplay/Career.js';
import { Jobs } from '../gameplay/Jobs.js';
import { Radio } from '../gameplay/Radio.js';
import { RadioPanel } from '../ui/RadioPanel.js';
import { JobBoard, PortMenu } from '../ui/JobBoard.js';
import { Shipyard } from '../ui/Shipyard.js';
import { Menus } from '../ui/Menus.js';
import { mulberry32 } from './Rng.js';
import { ECONOMY, JOBS } from '../config/career.js';
import { BOATS } from '../config/boats.js';
import { applyUpgrades } from '../gameplay/Upgrades.js';
import { AutopilotSession } from './AutopilotSession.js';
import { MapSession } from './MapSession.js';
import { makeTradeOffer, tradeKinds, tradePrompt } from '../gameplay/Trade.js';
import { TutorialSession } from './TutorialSession.js';

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
    this.jobs.traffic = () => (game.traffic ? game.traffic.list() : []);
    const hud = this.hud;
    this.radioPanel = new RadioPanel(hud.root);
    this.radio.on((m) => {
      this.radioPanel.push(m);
      this.ops.sfx?.radio?.(m.kind);
    });
    this.board = new JobBoard(document.body, this);
    this.portMenu = new PortMenu(document.body, this);
    this.shipyard = new Shipyard(document.body, this);
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
    // Esc closes an open panel first, otherwise it pauses.
    game.input.on('Escape', () => {
      const panels = [this.board, this.portMenu, this.shipyard, this.maps.chart];
      if (!this.menus.open && panels.some((p) => p.open)) {
        panels.forEach((p) => p.toggle(false));
        return;
      }
      this.menus.escape();
    });
    // A saved career resumes with its boat's fuel and hull state.
    const saved = this.career.saved;
    if (saved && saved.hullOf === this.boatId) {
      const hull = this.player.hull;
      hull.fuel = Math.min(hull.fuelMax, saved.fuel ?? hull.fuel);
      hull.integrity = saved.integrity ?? hull.integrity;
    }
    this.waypoint = null; // chart waypoint (M), else the job objective
    this.baseAutoTension = this.ops.ops.autoTension;
    this.autopilot = new AutopilotSession(this);
    this.maps = new MapSession(this);
    // Real careers open on the title screen; test pages go straight in.
    this.menus = new Menus(this, { title: Boolean(opts.persist), hasSave: Boolean(this.career.saved) });
    this.applyUpgrades();
    this.ops.onAction = () => this.action();
    this.ops.extraPrompt = () => this.prompt();
    this.ops.objectiveTarget = () => this.jobs.objective(this.player);
    if (opts.intro !== false) {
      this.radio.say(`Kettle Harbor: morning, skipper. The ${game.session.cfg.name} is fuelled and ready. Tab for the job board; calls come in over the radio.`, 'info');
    }
    for (let i = 0; i < JOBS.firstOffers; i++) {
      this.jobs.offers.push(this.jobs.makeOffer(this.player.state.pos));
    }
    // Ferries, freighters and yachts start with trade on the board too.
    if (tradeKinds(this.player.cfg).length) {
      this.jobs.player = this.player;
      for (let i = 0; i < 2; i++) {
        const t = makeTradeOffer(this.jobs, this.player);
        if (t) {
          this.jobs.offers.push(t);
        }
      }
    }
    // A new career starts with the guided first job (spec 15).
    this.tutorial = opts.tutorial && !this.career.tutorialDone ? new TutorialSession(this) : null;
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

  // Upgrades act on the live boat and the tow gear (after every purchase).
  applyUpgrades() {
    const id = this.boatId;
    applyUpgrades(this.player, BOATS[id], (u) => this.career.has(u, id));
    const ops = this.ops.ops;
    ops.autoTension = this.baseAutoTension || this.career.has('autotension');
    if (ops.line) {
      ops.line.autoTension = ops.autoTension;
      ops.line.breakingN = this.player.cfg.towBreakingKN * 1000;
    }
  }

  // Boats are kept at Kettle Harbor and switched at the dock: the career is
  // saved and the game restarts at the berth with the other boat.
  canSwitch() {
    const port = this.berthed();
    return Boolean(port && port.home && !this.jobs.active && !this.ops.ops.line);
  }

  switchBoat(id) {
    if (!this.career.boats.includes(id) || id === this.boatId || !this.canSwitch()) {
      return false;
    }
    this.career.boat = id;
    this.save();
    const url = new URL(window.location.href);
    url.searchParams.set('boat', id);
    url.searchParams.delete('new');
    window.location.replace(url.toString());
    return true;
  }

  // Graphics preset (menu): saved per browser, applied by restarting.
  setQuality(name) {
    try {
      window.localStorage.setItem('breakwater.quality', name);
    } catch {
      // storage blocked: the URL still carries it
    }
    this.save();
    const url = new URL(window.location.href);
    url.searchParams.set('quality', name);
    window.location.replace(url.toString());
  }

  // Admin menu: take any boat, anywhere (restarts at the berth with it).
  adminBoat(id) {
    if (!BOATS[id]) {
      return false;
    }
    if (!this.career.boats.includes(id)) {
      this.career.boats.push(id);
    }
    if (this.jobs.active) {
      this.jobs.abandon();
    }
    this.career.boat = id;
    this.save();
    const url = new URL(window.location.href);
    url.searchParams.set('boat', id);
    url.searchParams.delete('new');
    window.location.replace(url.toString());
    return true;
  }

  buyBoat(id) {
    if (this.career.buyBoat(id)) {
      this.save();
      return true;
    }
    return false;
  }

  buyUpgrade(id) {
    if (this.career.buyUpgrade(id, this.boatId)) {
      this.applyUpgrades();
      this.save();
      return true;
    }
    return false;
  }

  fixed(dt) {
    const g = this.game;
    this.autopilot.fixed(dt);
    if (this.tutorial) {
      this.tutorial.fixed(dt);
    }
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
    const berth = this.shape.berthFor(home, sim.cfg.hull.length);
    const h = berth.heading;
    b.setTranslation({ x: berth.x, y: 0, z: berth.z }, true);
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
    sim.cargo = 0;
    this.game.session.boat.throttleLever = 0;
  }

  // In a port zone (or, for big ships, at the home anchorage) and slow.
  berthed() {
    if (this.player.speed / KN >= 2.5) {
      return null;
    }
    if (this.port) {
      return this.port;
    }
    const home = this.shape.ports.find((p) => p.home);
    const p = this.player.state.pos;
    return Math.hypot(p.x - home.anchorage.x, p.z - home.anchorage.z) < 150 ? home : null;
  }

  action() {
    const port = this.berthed();
    if (port) {
      this.portMenu.toggle(true, port);
    }
  }

  prompt() {
    const tp = (this.tutorial ? this.tutorial.prompt() : null) || tradePrompt(this.jobs);
    if (tp) {
      return tp;
    }
    const ap = this.autopilot;
    if (ap.engaged) {
      return `Autopilot${ap.compression > 1 ? ` · time ×${ap.compression}` : ''} · T or helm to take over`;
    }
    const port = this.berthed();
    if (port && !this.portMenu.open) {
      return `E  ${port.name} services · Tab  Job board`;
    }
    return null;
  }

  frame(dt) {
    this.radioPanel.update(dt);
    this.maps.update(dt);
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
    // Fuel and damage belong to the boat in use (restored only onto it).
    this.career.save({ hour: g.dayNight.hour, weather: g.weather.state.id, fuel: hull.fuel, integrity: hull.integrity, hullOf: this.boatId });
  }

  snapshot() {
    return {
      money: this.career.money,
      reputation: this.career.reputation,
      offers: this.jobs.offers.length,
      activeJob: this.jobs.active ? this.jobs.active.type : null,
      port: this.port ? this.port.id : null,
      upgrades: [...this.career.upgrades],
      autopilot: this.autopilot.engaged,
      timeScale: this.autopilot.compression,
    };
  }
}
