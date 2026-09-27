// Web Audio context + mix buses (spec 10). The context starts on the first
// user gesture (browsers block audio before that).

import { MIX } from '../config/audio.js';

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.listeners = [];
    const unlock = () => this.unlock();
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('pointerdown', unlock, { once: false });
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      return;
    }
    this.ctx = new Ctx();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = MIX.master;
    this.master.connect(c.destination);
    this.levels = { master: MIX.master, sfx: MIX.sfx, ambience: MIX.ambience, radio: MIX.radio, ...(this.pendingLevels || {}) };
    this.sfx = this.bus(this.levels.sfx);
    this.ambience = this.bus(this.levels.ambience);
    this.radio = this.bus(this.levels.radio);
    this.master.gain.value = this.levels.master;
    // UI: a soft mechanical click on any button press.
    window.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('button')) {
        this.click();
      }
    });
    this.noise = this.makeNoise(3);
    this.ready = true;
    for (const fn of this.listeners) {
      fn(this);
    }
  }

  // Mix levels 0..1 per bus (settings sliders).
  setLevels(levels) {
    if (!this.ctx) {
      this.pendingLevels = { ...(this.pendingLevels || {}), ...levels };
      return;
    }
    Object.assign(this.levels, levels);
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.levels.master, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.levels.sfx * (this.ducked ? MIX.duck : 1), t, 0.05);
    this.ambience.gain.setTargetAtTime(this.levels.ambience * (this.ducked ? MIX.duck : 1), t, 0.05);
    this.radio.gain.setTargetAtTime(this.levels.radio, t, 0.05);
  }

  // The radio speaks: SFX and ambience dip, then come back.
  duck() {
    if (!this.ctx) {
      return;
    }
    const t = this.ctx.currentTime;
    this.ducked = true;
    for (const [bus, key] of [[this.sfx, 'sfx'], [this.ambience, 'ambience']]) {
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(this.levels[key] * MIX.duck, t, 0.08);
      bus.gain.setTargetAtTime(this.levels[key], t + MIX.duckSeconds, 0.4);
    }
    clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      this.ducked = false;
    }, MIX.duckSeconds * 1000 + 800);
  }

  // Listener at the camera (spatial sounds: whistles).
  setListener(camera) {
    if (!this.ctx) {
      return;
    }
    const l = this.ctx.listener;
    const p = camera.position;
    const f = camera.getWorldDirection(this.fwd || (this.fwd = camera.position.clone()));
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(p.x, t);
      l.positionY.setValueAtTime(p.y, t);
      l.positionZ.setValueAtTime(p.z, t);
      l.forwardX.setValueAtTime(f.x, t);
      l.forwardY.setValueAtTime(f.y, t);
      l.forwardZ.setValueAtTime(f.z, t);
      l.upX.setValueAtTime(0, t);
      l.upY.setValueAtTime(1, t);
      l.upZ.setValueAtTime(0, t);
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
  }

  click() {
    if (!this.ctx) {
      return;
    }
    const c = this.ctx;
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(2200, now);
    const g = c.createGain();
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    o.connect(g).connect(this.sfx);
    o.start(now);
    o.stop(now + 0.04);
  }

  // Soft two-note chime (money in, job done).
  chime() {
    if (!this.ctx) {
      return;
    }
    const c = this.ctx;
    const now = c.currentTime;
    for (const [f, dt] of [[880, 0], [1320, 0.12]]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, now + dt);
      const g = c.createGain();
      g.gain.setValueAtTime(0, now + dt);
      g.gain.linearRampToValueAtTime(0.12, now + dt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + dt + 0.7);
      o.connect(g).connect(this.sfx);
      o.start(now + dt);
      o.stop(now + dt + 0.75);
    }
  }

  onReady(fn) {
    if (this.ready) {
      fn(this);
    } else {
      this.listeners.push(fn);
    }
  }

  bus(level) {
    const g = this.ctx.createGain();
    g.gain.value = level;
    g.connect(this.master);
    return g;
  }

  makeNoise(seconds) {
    const c = this.ctx;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) {
      // Slightly pinked white noise.
      const w = Math.random() * 2 - 1;
      b = 0.97 * b + 0.03 * w;
      d[i] = w * 0.6 + b * 2.2;
    }
    return buf;
  }

  noiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random();
    return src;
  }
}
