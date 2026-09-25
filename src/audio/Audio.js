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
    this.sfx = this.bus(MIX.sfx);
    this.ambience = this.bus(MIX.ambience);
    this.radio = this.bus(MIX.radio);
    this.noise = this.makeNoise(3);
    this.ready = true;
    for (const fn of this.listeners) {
      fn(this);
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
