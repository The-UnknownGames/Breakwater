// Instrument cluster (spec 9): speed, compass tape, throttle + RPM, rudder,
// heel inclinometer, fuel, hull integrity, flooding + pump. Flat, solid,
// marine-instrument styling; numbers in tabular mono.

const DEG = 180 / Math.PI;
const KN = 0.514444;

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

function bar(parent, label) {
  const row = el('div', 'inst-bar', parent);
  el('span', 'inst-label', row, label);
  const track = el('div', 'inst-track', row);
  const fill = el('div', 'inst-fill', track);
  const value = el('span', 'inst-num', row, '');
  return { row, fill, value };
}

const COMPASS = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];

export class Instruments {
  constructor(parent) {
    this.root = el('div', 'instruments', parent);
    // Compass tape.
    const compass = el('div', 'inst-compass', this.root);
    this.tape = el('div', 'inst-tape', compass);
    for (let rep = 0; rep < 3; rep++) {
      for (let i = 0; i < 36; i++) {
        const tick = el('span', i % 3 === 0 ? 'tick major' : 'tick', this.tape);
        if (i % 3 === 0) {
          el('span', 'tick-label', tick, COMPASS[i / 3]);
        }
      }
    }
    el('div', 'inst-caret', compass);
    this.heading = el('div', 'inst-heading', compass, '000°');

    const mid = el('div', 'inst-row', this.root);
    const speedBox = el('div', 'inst-speed', mid);
    el('span', 'inst-label', speedBox, 'Speed');
    this.speed = el('span', 'inst-big', speedBox, '0.0');
    this.speedUnit = el('span', 'inst-unit', speedBox, 'kn');

    const helm = el('div', 'inst-helm', mid);
    const thr = el('div', 'inst-throttle', helm);
    el('span', 'inst-label', thr, 'Throttle');
    const lever = el('div', 'inst-lever', thr);
    el('div', 'inst-lever-zero', lever);
    this.leverFill = el('div', 'inst-lever-fill', lever);
    this.throttle = el('span', 'inst-num', thr, '0%');
    this.rpm = el('span', 'inst-num dim', thr, '650 rpm');

    const rud = el('div', 'inst-rudder', helm);
    this.rudderLabel = el('span', 'inst-label', rud, 'Rudder');
    const rtrack = el('div', 'inst-rudder-track', rud);
    el('div', 'inst-rudder-zero', rtrack);
    this.rudderNeedle = el('div', 'inst-rudder-needle', rtrack);
    this.rudder = el('span', 'inst-num', rud, '0°');

    const low = el('div', 'inst-row', this.root);
    const heelBox = el('div', 'inst-heel', low);
    el('span', 'inst-label', heelBox, 'Heel');
    heelBox.insertAdjacentHTML(
      'beforeend',
      `<svg viewBox="-60 -8 120 62" class="inst-incl" aria-hidden="true">
        <path d="M-50 0 A50 50 0 0 0 50 0" class="arc"/>
        <path class="warn-l"/><path class="warn-r"/><path class="crit-l"/><path class="crit-r"/>
        <line x1="0" y1="0" x2="0" y2="46" class="needle"/>
        <circle r="3" class="hub"/>
      </svg>`,
    );
    this.heelSvg = heelBox.querySelector('svg');
    this.needle = heelBox.querySelector('.needle');
    this.heel = el('span', 'inst-num', heelBox, '0.0°');
    this.bars = el('div', 'inst-bars', low);
    this.fuel = bar(this.bars, 'Fuel');
    this.hull = bar(this.bars, 'Hull');
    this.flood = bar(this.bars, 'Flood');
    this.pump = el('span', 'inst-pump', this.flood.row, 'PUMP');
    this.capsizeDeg = null;
    this.units = 'kn';
  }

  setCapsizeAngle(deg) {
    if (this.capsizeDeg === deg) {
      return;
    }
    this.capsizeDeg = deg;
    const arc = (a0, a1) => {
      const p = (a) => {
        const r = (a * Math.PI) / 180;
        return `${(Math.sin(r) * 50).toFixed(2)} ${(Math.cos(r) * 50).toFixed(2)}`;
      };
      return `M${p(a0)} A50 50 0 0 ${a1 > a0 ? 0 : 1} ${p(a1)}`;
    };
    const w = Math.min(0.7 * deg, 88);
    const c = Math.min(0.9 * deg, 89);
    this.heelSvg.querySelector('.warn-l').setAttribute('d', arc(-w, -c));
    this.heelSvg.querySelector('.warn-r').setAttribute('d', arc(w, c));
    this.heelSvg.querySelector('.crit-l').setAttribute('d', arc(-c, -89.9));
    this.heelSvg.querySelector('.crit-r').setAttribute('d', arc(c, 89.9));
  }

  // s: BoatPhysics
  update(s) {
    const cfg = s.cfg;
    this.setCapsizeAngle(cfg.capsizeDeg);
    const v = this.units === 'kmh' ? (s.speed * 3.6) : s.speed / KN;
    this.speed.textContent = v.toFixed(1);
    this.speedUnit.textContent = this.units === 'kmh' ? 'km/h' : 'kn';
    const hdg = s.heading * DEG;
    this.heading.textContent = `${String(Math.round(hdg) % 360).padStart(3, '0')}°`;
    // 36 ticks x 3 reps; each tick = 10° = 16 px.
    this.tape.style.transform = `translateX(${-(360 + hdg) * 1.6}px)`;
    const pr = s.propulsion;
    const lever = s.input.throttle;
    this.leverFill.style.height = `${Math.abs(lever) * 50}%`;
    this.leverFill.style.bottom = lever >= 0 ? '50%' : `${50 - Math.abs(lever) * 50}%`;
    this.leverFill.classList.toggle('astern', lever < 0);
    this.throttle.textContent = lever === 0 ? 'Neutral' : `${lever > 0 ? 'Ahead' : 'Astern'} ${Math.round(Math.abs(lever) * 100)}%`;
    this.rpm.textContent = `${Math.round(pr.rpm)} rpm`;
    this.rpm.classList.toggle('warn', pr.ventilation > 0.2);
    // Azimuth boats show the pod angle (the helm swings them up to 90°).
    const az = !!cfg.azimuth;
    this.rudderLabel.textContent = az ? 'Pods' : 'Rudder';
    const rd = (az ? pr.podAngle : pr.rudder) * DEG;
    const span = az ? 90 : cfg.rudder.maxAngleDeg;
    // Positive rudder / heel = port (local +X). Port is drawn on the left.
    this.rudderNeedle.style.left = `${50 - (rd / span) * 50}%`;
    this.rudder.textContent = `${Math.abs(rd).toFixed(0)}° ${rd > 0.5 ? 'P' : rd < -0.5 ? 'S' : ''}`;
    const heel = s.hull.heel * DEG;
    this.needle.setAttribute('transform', `rotate(${Math.max(-90, Math.min(90, heel)).toFixed(1)})`);
    this.heel.textContent = `${Math.abs(heel).toFixed(1)}° ${heel > 0.5 ? 'P' : heel < -0.5 ? 'S' : ''}`;
    const r = s.hull.heelRatio;
    const state = r >= 0.9 ? 'crit' : r >= 0.7 ? 'warn' : 'ok';
    this.heel.dataset.state = state;
    this.needle.dataset.state = state;
    this.setBar(this.fuel, s.hull.fuel / s.hull.fuelMax, `${Math.round(s.hull.fuel)} L`, true);
    this.setBar(this.hull, s.hull.integrity / 100, `${Math.round(s.hull.integrity)}%`, true);
    this.setBar(this.flood, s.hull.floodRatio, `${s.hull.flood.toFixed(1)} t`, false);
    this.pump.classList.toggle('on', s.hull.pumping);
  }

  setBar(b, frac, text, highIsGood) {
    const f = Math.max(0, Math.min(1, frac));
    b.fill.style.width = `${f * 100}%`;
    b.value.textContent = text;
    const bad = highIsGood ? 1 - f : f;
    b.row.dataset.state = bad > 0.85 ? 'crit' : bad > 0.6 ? 'warn' : 'ok';
  }
}
