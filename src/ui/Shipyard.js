// Shipyard (Kettle Harbor, spec 8.5 / 9): chart-paper cards for upgrades
// (shared or per boat) and boats. Purchases go through CareerSession so the
// effects land on the live boat at once.

import { UPGRADES } from '../config/upgrades.js';

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

export class Shipyard {
  constructor(parent, session) {
    this.session = session;
    this.root = el('div', 'paper-panel shipyard', parent);
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    // Extra sections (boats) register here.
    this.sections = [];
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
    const c = s.career;
    const boat = s.boatId;
    this.root.textContent = '';
    const head = el('div', 'paper-head', this.root);
    el('span', 'paper-title', head, 'Shipyard');
    el('span', 'paper-meta', head, `${money(c.money)} · Rep ${Math.round(c.reputation)}`);
    el('button', 'paper-close', head, 'Close').addEventListener('click', () => this.toggle(false));
    for (const fn of this.sections) {
      fn(this.root, el, money);
    }
    el('div', 'paper-rule', this.root, `Upgrades · fitting to the ${boat[0].toUpperCase()}${boat.slice(1)}`);
    const grid = el('div', 'yard-grid', this.root);
    for (const u of UPGRADES) {
      const owned = c.has(u.id, boat);
      const card = el('div', `paper-card yard-card${owned ? ' owned' : ''}`, grid);
      el('div', 'card-kind', card, `${u.label}${u.perBoat ? ' · this boat' : ''}`);
      el('div', 'card-text', card, u.effect);
      const row = el('div', 'card-row', card);
      el('span', 'card-num', row, owned ? 'Fitted' : money(u.price));
      if (!owned) {
        const b = el('button', 'paper-btn', row, 'Buy');
        b.disabled = c.money < u.price;
        b.dataset.upgrade = u.id;
        b.addEventListener('click', () => {
          s.buyUpgrade(u.id);
          this.render();
        });
      }
    }
  }
}
