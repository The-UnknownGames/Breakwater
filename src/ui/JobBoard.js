// Job board (Tab) and port services (E when berthed). Chart-paper cards with
// ink text (spec 2.3 / 9): offers with distance, bearing and pay; the active
// job with an abandon button; fuel and repairs with prices.

import { stars } from '../gameplay/Trade.js';
import { NIGHT } from '../config/rescue.js';

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) {
    e.className = cls;
  }
  if (text !== undefined) {
    e.textContent = text;
  }
  if (parent) {
    parent.appendChild(e);
  }
  return e;
}

function money(n) {
  return `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

export class JobBoard {
  constructor(parent, session) {
    this.session = session;
    this.root = el('div', 'paper-panel job-board', parent);
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  get open() {
    return !this.root.hidden;
  }

  toggle(force) {
    this.root.hidden = force !== undefined ? !force : !this.root.hidden;
    if (!this.root.hidden) {
      this.render();
    }
  }

  render() {
    const s = this.session;
    const { jobs, career } = s;
    const p = s.player.state.pos;
    this.root.textContent = '';
    const head = el('div', 'paper-head', this.root);
    el('span', 'paper-title', head, 'Job board');
    el('span', 'paper-meta', head, `${money(career.money)} · Rep ${Math.round(career.reputation)}`);
    el('button', 'paper-close', head, 'Close').addEventListener('click', () => this.toggle(false));
    if (s.weatherChain) {
      el('div', 'paper-forecast', this.root, `Forecast · ${s.weatherChain.forecastText(s.game.dayNight.hour)}`);
    }
    if (jobs.active) {
      const j = jobs.active;
      const card = el('div', 'paper-card active', this.root);
      el('div', 'card-kind', card, `Active · ${j.label}`);
      el('div', 'card-text', card, j.text);
      const b = el('button', 'paper-btn warn', card, 'Abandon job');
      b.addEventListener('click', () => {
        jobs.abandon();
        this.render();
      });
    }
    if (!jobs.offers.length) {
      el('div', 'card-empty', this.root, 'No calls right now. Worse weather brings more.');
    }
    for (const o of jobs.offers) {
      const card = el('div', 'paper-card', this.root);
      el('div', 'card-kind', card, o.label);
      el('div', 'card-text', card, o.text);
      const d = Math.hypot(o.cx - p.x, o.cz - p.z);
      const brg = ((Math.atan2(o.cx - p.x, -(o.cz - p.z)) * 180) / Math.PI + 360) % 360;
      const row = el('div', 'card-row', card);
      el('span', 'card-num', row, `${(d / 1852).toFixed(1)} nm · ${String(Math.round(brg) % 360).padStart(3, '0')}°`);
      el('span', 'card-num', row, `~${money(o.estimate)}`);
      const due = o.deadlineMin ? `${o.km.toFixed(1)} km run · due in ${Math.round(o.deadlineMin)} min` : null;
      el('span', 'card-num dim', row, due || (o.type === 'crew' ? `sinks ~${Math.round(jobs.sinkMinutes(o))} min after accepting` : `${Math.ceil(o.expires / 60)} min left`));
      const b = el('button', 'paper-btn', card, jobs.active ? 'Finish the active job first' : 'Accept');
      b.disabled = Boolean(jobs.active);
      b.addEventListener('click', () => {
        jobs.accept(o.id);
        this.toggle(false);
      });
    }
  }
}

export class PortMenu {
  constructor(parent, session) {
    this.session = session;
    this.root = el('div', 'paper-panel port-menu', parent);
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  get open() {
    return !this.root.hidden;
  }

  // only: optional list of services to show (a building's counter, V7):
  // 'fuel', 'fish', 'flares', 'repair', 'jobs', 'shipyard'.
  toggle(force, port, only = null, title = null) {
    this.port = port || this.port;
    if (force !== false) {
      this.only = only;
      this.title = title;
    }
    this.root.hidden = force !== undefined ? !force : !this.root.hidden;
    if (!this.root.hidden) {
      this.render();
    }
  }

  render() {
    const s = this.session;
    const hull = s.player.hull;
    const port = this.port;
    this.root.textContent = '';
    const head = el('div', 'paper-head', this.root);
    el('span', 'paper-title', head, this.title || (port ? port.name : 'Port'));
    el('span', 'paper-meta', head, `${money(s.career.money)} · Rep ${Math.round(s.career.reputation)}${port ? ` · passengers ${stars(s.career.rating(port.id))}` : ''}`);
    el('button', 'paper-close', head, 'Close').addEventListener('click', () => this.toggle(false));
    const services = port ? port.services : [];
    const show = (k) => !this.only || this.only.includes(k);
    const add = (label, cost, enabled, fn, verb = 'Buy') => {
      const card = el('div', 'paper-card', this.root);
      const row = el('div', 'card-row', card);
      el('span', 'card-kind', row, label);
      el('span', 'card-num', row, cost > 0 ? money(cost) : 'nothing to do');
      const b = el('button', 'paper-btn', card, cost > 0 ? verb : 'OK');
      b.disabled = !enabled || cost <= 0;
      b.addEventListener('click', () => {
        fn();
        this.render();
      });
    };
    if (services.includes('fuel') && show('fuel')) {
      add(`Fuel · ${Math.round(hull.fuel)} / ${hull.fuelMax} L`, s.career.refuelCost(hull), true, () => s.career.refuel(hull));
    }
    const fish = s.fishing;
    if ((services.includes('fuel') || this.only) && show('fish') && fish && fish.catchKg > 0) {
      add(`Sell catch · ${Math.round(fish.catchKg)} kg`, Math.round(fish.value), true, () => s.career.earn(fish.sell(s.player), `Catch landed at ${port.name}`), 'Sell');
    }
    const ops = s.game.ops;
    if ((services.includes('fuel') || this.only) && show('flares') && ops && ops.flareStock < NIGHT.flare.stock) {
      const n = NIGHT.flare.stock - ops.flareStock;
      add(`Flares · ${ops.flareStock} / ${NIGHT.flare.stock}`, n * NIGHT.flare.price, true, () => {
        s.career.spend(n * NIGHT.flare.price, 'Flares');
        ops.flareStock = NIGHT.flare.stock;
      });
    }
    if (services.includes('repair') && show('repair')) {
      add(`Repairs · hull ${Math.round(hull.integrity)}%`, s.career.repairCost(hull, s.boatId), true, () => s.career.repair(hull, s.boatId, s.player.propulsion));
    }
    if (services.includes('jobs') && show('jobs')) {
      const b = el('button', 'paper-btn', this.root, 'Job board');
      b.addEventListener('click', () => {
        this.toggle(false);
        s.board.toggle(true);
      });
    }
    if (services.includes('shipyard') && show('shipyard')) {
      const b = el('button', 'paper-btn', this.root, 'Shipyard · boats and upgrades');
      b.addEventListener('click', () => {
        this.toggle(false);
        s.shipyard.toggle(true);
      });
    }
    if (this.root.children.length === 1) {
      el('div', 'paper-card', this.root, 'Nothing needed here right now.');
    }
  }
}
