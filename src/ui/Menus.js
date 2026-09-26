// Title screen, pause menu, settings and controls (spec 11). The title
// flies a slow camera round Kettle Harbor with the sea running; Continue
// (when a save exists) or New Career starts play. Esc (or the pause button)
// pauses: Resume, Settings, Controls, Save & Quit. Settings are kept per
// browser: graphics preset (restart), master volume, horizon-lock camera.

import { modelCredits } from '../entities/models/Models.js';

const SETTINGS_KEY = 'breakwater.settings';

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

export function loadSettings() {
  try {
    return { volume: 0.8, horizonLock: true, ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { volume: 0.8, horizonLock: true };
  }
}

function saveSettings(s) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // storage blocked
  }
}

const CONTROLS = [
  ['W / S', 'Throttle lever up / down (stays set)'],
  ['X', 'Throttle to neutral'],
  ['A / D', 'Rudder (Shift holds it)'],
  ['Space', 'Pass or cast off the tow line'],
  ['Q / Z', 'Winch: pay out / haul in'],
  ['F', 'Chain the next container behind the one in tow'],
  ['E', 'Pull aboard, take off crew, pump hose, port services'],
  ['T', 'Autopilot to the waypoint or job (upgrade)'],
  ['M', 'Chart (click to set a waypoint)'],
  ['Tab', 'Job board'],
  ['C', 'Camera: chase / helm / orbit'],
  ['N', 'Let go / weigh the anchor'],
  ['G', 'Shoot / haul the nets (trawler, on a fishing ground)'],
  ['P', 'Photo mode (time stops, camera circles)'],
  ['Esc', 'Pause'],
];

export class Menus {
  constructor(session, opts = {}) {
    this.session = session;
    this.game = session.game;
    this.settings = loadSettings();
    this.applySettings();
    this.root = el('div', 'menu-screen', document.body);
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.mode = null;
    this.angle = 0;
    this.pauseBtn = el('button', 'pause-btn', session.hud.root, 'II');
    this.pauseBtn.title = 'Pause (Esc)';
    this.pauseBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.pause(true);
    });
    this.game.events.on('frame', (dt) => this.titleCamera(dt));
    if (opts.title) {
      this.showTitle(opts.hasSave);
    }
  }

  get open() {
    return this.mode !== null;
  }

  applySettings() {
    const s = this.settings;
    this.game.rig.horizonLock = s.horizonLock;
    this.game.audio.onReady((a) => {
      if (a.baseMaster === undefined) {
        a.baseMaster = a.master.gain.value;
      }
      a.master.gain.value = a.baseMaster * s.volume;
    });
  }

  // ---- screens ----
  frame(title, sub) {
    this.root.textContent = '';
    this.root.hidden = false;
    this.game.input.blocked = true;
    const card = el('div', 'menu-card', this.root);
    el('div', 'menu-title', card, title);
    if (sub) {
      el('div', 'menu-sub', card, sub);
    }
    return card;
  }

  button(card, label, fn, primary = false) {
    const b = el('button', `menu-btn${primary ? ' primary' : ''}`, card, label);
    b.addEventListener('click', fn);
    return b;
  }

  close() {
    this.mode = null;
    this.root.hidden = true;
    this.game.input.blocked = false;
    this.game.input.down.clear();
    this.game.input.pressed.clear();
  }

  showTitle(hasSave) {
    this.mode = 'title';
    this.session.hud.root.style.visibility = 'hidden';
    this.hasSave = hasSave;
    this.titleWas = this.game.rig.mode;
    this.game.rig.setMode('orbit');
    const card = this.frame('Breakwater', 'Salvage, towing and rescue on the Grey Reach');
    card.classList.add('title');
    if (hasSave) {
      this.button(card, 'Continue', () => this.start(), true);
    }
    this.button(card, 'New Career', () => this.newCareer(), !hasSave);
    this.button(card, 'Settings', () => this.showSettings());
    this.button(card, 'Controls', () => this.showControls());
  }

  start() {
    this.close();
    this.session.hud.root.style.visibility = '';
    this.game.rig.setMode(this.titleWas === 'orbit' ? 'chase' : this.titleWas || 'chase');
  }

  newCareer() {
    if (!this.hasSave) {
      this.start();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('new', '1');
    url.searchParams.delete('boat');
    window.location.replace(url.toString());
  }

  pause(on) {
    if (on && this.mode === null) {
      this.mode = 'pause';
      this.game.loop.running = false;
      const card = this.frame('Paused');
      this.button(card, 'Resume', () => this.pause(false), true);
      this.button(card, 'Settings', () => this.showSettings());
      this.button(card, 'Controls', () => this.showControls());
      this.button(card, 'Save & Quit', () => {
        this.session.save();
        const url = new URL(window.location.href);
        url.searchParams.delete('new');
        window.location.replace(url.toString());
      });
    } else if (!on && this.mode !== null && this.mode !== 'title') {
      this.close();
      this.game.loop.start();
    }
  }

  // Esc: back out of a sub-screen, or toggle pause.
  escape() {
    if (this.mode === 'settings' || this.mode === 'controls') {
      this.back();
    } else if (this.mode === 'pause') {
      this.pause(false);
    } else if (this.mode === null) {
      this.pause(true);
    }
  }

  back() {
    if (this.from === 'title') {
      this.showTitle(this.hasSave);
    } else {
      this.mode = null;
      this.pause(true);
    }
  }

  showSettings() {
    this.from = this.mode === 'title' ? 'title' : 'pause';
    this.mode = 'settings';
    const card = this.frame('Settings');
    const s = this.settings;
    el('div', 'menu-label', card, 'Graphics (restarts the game)');
    const row = el('div', 'menu-row', card);
    for (const q of Object.keys(this.game.qualityTable)) {
      const b = el('button', `menu-chip${q === this.game.qualityName ? ' on' : ''}`, row, q);
      b.addEventListener('click', () => {
        if (q !== this.game.qualityName) {
          this.session.setQuality(q);
        }
      });
    }
    el('div', 'menu-label', card, `Volume · ${Math.round(s.volume * 100)}%`);
    const vol = el('input', 'menu-range', card);
    Object.assign(vol, { type: 'range', min: '0', max: '1', step: '0.05', value: String(s.volume) });
    vol.addEventListener('input', () => {
      s.volume = Number(vol.value);
      card.querySelectorAll('.menu-label')[1].textContent = `Volume · ${Math.round(s.volume * 100)}%`;
      this.applySettings();
      saveSettings(s);
    });
    const lock = el('button', `menu-chip wide${s.horizonLock ? ' on' : ''}`, card, s.horizonLock ? 'Chase camera: horizon level' : 'Chase camera: rolls with the boat');
    lock.addEventListener('click', () => {
      s.horizonLock = !s.horizonLock;
      this.applySettings();
      saveSettings(s);
      this.showSettingsAgain();
    });
    this.button(card, 'Back', () => this.back(), true);
  }

  showSettingsAgain() {
    const from = this.from;
    this.showSettings();
    this.from = from;
  }

  showControls() {
    this.from = this.mode === 'title' ? 'title' : 'pause';
    this.mode = 'controls';
    const card = this.frame('Controls', 'On a phone: wheel (left), throttle lever and buttons (right)');
    const table = el('div', 'menu-keys', card);
    for (const [k, v] of CONTROLS) {
      el('span', 'menu-key', table, k);
      el('span', 'menu-desc', table, v);
    }
    // Attribution for downloaded boat models (CC BY needs it).
    modelCredits().then((list) => {
      if (list.length) {
        el('div', 'menu-desc', card, `Models: ${list.join(' · ')}`);
      }
    });
    this.button(card, 'Back', () => this.back(), true);
  }

  // Title backdrop: a slow circle over Kettle Harbor, the sea running.
  titleCamera(dt) {
    if (this.mode !== 'title' && !(this.mode === 'settings' && this.from === 'title') && !(this.mode === 'controls' && this.from === 'title')) {
      return;
    }
    const home = this.session.shape.ports.find((p) => p.home);
    const rig = this.game.rig;
    if (rig.mode !== 'orbit') {
      // Game start sets the chase camera after the menus exist.
      this.titleWas = rig.mode;
      rig.setMode('orbit');
    }
    this.angle += dt * 0.035;
    const r = 320;
    rig.camera.position.set(home.center.x + Math.cos(this.angle) * r, 70, home.center.z + Math.sin(this.angle) * r);
    rig.controls.target.set(home.center.x + home.out.x * 120, 0, home.center.z + home.out.z * 120);
    rig.controls.update();
  }
}
