// Tow panel (spec 9): line length and winch state, tension gauge (percent of
// breaking strength) with a peak-hold needle and ok / warning / critical
// zones, target condition, tow speed. Shown only while towing.

import { TOW } from '../config/tow.js';

const KN = 0.514444;
const SPAN = 1.25; // gauge full scale (fraction of breaking strength)

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) {
    e.textContent = text;
  }
  parent.appendChild(e);
  return e;
}

export class TowPanel {
  constructor(parent) {
    this.root = el('div', 'tow-panel', parent);
    this.root.hidden = true;
    const head = el('div', 'tow-head', this.root);
    el('span', 'inst-label', head, 'Tow line');
    this.auto = el('span', 'tow-auto', head, 'AUTO-TENSION');
    this.length = el('span', 'inst-num tow-length', head, '0.0 m');
    this.winch = el('span', 'tow-winch', head, '');
    const g = el('div', 'tow-gauge', this.root);
    const track = el('div', 'tow-track', g);
    for (const [cls, a, b] of [
      ['ok', 0, TOW.warnRatio],
      ['warn', TOW.warnRatio, TOW.critRatio],
      ['crit', TOW.critRatio, 1],
      ['over', 1, SPAN],
    ]) {
      const z = el('div', `tow-zone ${cls}`, track);
      z.style.left = `${(a / SPAN) * 100}%`;
      z.style.width = `${((b - a) / SPAN) * 100}%`;
    }
    this.fill = el('div', 'tow-fill', track);
    this.peak = el('div', 'tow-peak', track);
    el('div', 'tow-rating', track).style.left = `${(1 / SPAN) * 100}%`;
    const row = el('div', 'tow-row', this.root);
    this.pct = el('span', 'inst-num tow-pct', row, '0%');
    this.kn = el('span', 'inst-num dim', row, '0.0 kN');
    this.speed = el('span', 'inst-num tow-speed', row, '0.0 kn');
    this.target = el('div', 'tow-target', this.root, '');
  }

  // ops: Operations; player: BoatPhysics.
  update(ops) {
    const line = ops.line;
    this.root.hidden = !line;
    if (!line) {
      return;
    }
    const r = line.ratio;
    const state = r >= TOW.critRatio ? 'crit' : r >= TOW.warnRatio ? 'warn' : 'ok';
    this.root.dataset.state = state;
    this.fill.style.width = `${Math.min(1, r / SPAN) * 100}%`;
    this.peak.style.left = `${Math.min(1, line.peak / line.breakingN / SPAN) * 100}%`;
    this.pct.textContent = `${Math.round(r * 100)}%`;
    this.pct.dataset.state = state;
    this.kn.textContent = `${(line.tension / 1000).toFixed(1)} kN`;
    this.length.textContent = `${line.length.toFixed(1)} m`;
    this.winch.textContent = line.winchInput > 0 ? 'PAY OUT' : line.winchInput < 0 ? 'HAUL' : line.taut ? '' : 'SLACK';
    this.auto.hidden = !line.autoTension;
    const t = ops.lineTarget;
    const h = t.sim.hull;
    const cond = h.foundered ? 'sinking' : h.flood > 0.05 ? `flooding ${h.flood.toFixed(1)} t` : 'dry';
    this.target.textContent = `${t.cfg.name} · hull ${Math.round(h.integrity)}% · ${cond}`;
    this.speed.textContent = `${(t.sim.speed / KN).toFixed(1)} kn`;
  }
}
