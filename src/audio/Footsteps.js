// Footsteps (V7), synthesized: a short noise burst through a resonant
// filter voiced by the surface (hollow planks, crisp concrete, crunching
// gravel, ringing deck plate, soft grass), plus a low body thump.

import { FOOTSTEPS } from '../config/onfoot.js';

export class Footsteps {
  constructor(audio) {
    this.audio = audio;
    this.c = audio.ctx;
    this.next = FOOTSTEPS.strideWalk;
    this.alt = false;
  }

  // Called each frame with the walker's distance walked so far.
  update(walker) {
    const jog = walker.speed > 2.2;
    const stride = jog ? FOOTSTEPS.strideJog : FOOTSTEPS.strideWalk;
    if (walker.moved >= this.next) {
      this.next = walker.moved + stride;
      if (walker.speed > 0.2 || walker.transition) {
        this.step(walker.surface, jog ? 1.25 : 1);
      }
    }
  }

  step(surface, force = 1) {
    const v = FOOTSTEPS.surfaces[surface] || FOOTSTEPS.surfaces.concrete;
    const c = this.c;
    const now = c.currentTime;
    const level = FOOTSTEPS.volume * force * (this.alt ? 0.85 : 1);
    this.alt = !this.alt;
    const grains = v.grains || 1;
    for (let i = 0; i < grains; i++) {
      const t = now + i * 0.012 + Math.random() * 0.006;
      const src = this.audio.noiseSource();
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = v.noise * (0.85 + Math.random() * 0.3);
      f.Q.value = 0.9;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level / grains ** 0.6, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0008, t + v.decay);
      src.connect(f).connect(g).connect(this.audio.sfx);
      src.start(t);
      src.stop(t + v.decay + 0.05);
    }
    // Resonant body: the plank, plate or slab ringing under the heel.
    if (v.body > 0.05) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(v.freq * (0.95 + Math.random() * 0.1), now);
      o.frequency.exponentialRampToValueAtTime(v.freq * 0.7, now + v.decay * 1.5);
      const g = c.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(level * v.body * 0.6, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0006, now + v.decay * (1 + v.q * 0.1));
      o.connect(g).connect(this.audio.sfx);
      o.start(now);
      o.stop(now + v.decay * 2 + 0.05);
    }
  }
}
