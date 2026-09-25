// Engine synth: sawtooth + square sub at the firing frequency plus filtered
// noise; pitch and filter follow RPM. Ventilation (racing prop) thins it out.

import { ENGINE_VOICES } from '../config/audio.js';

export class EngineSound {
  constructor(audio, boatId) {
    this.voice = ENGINE_VOICES[boatId] || ENGINE_VOICES.marlin;
    const c = audio.ctx;
    this.c = c;
    this.saw = c.createOscillator();
    this.saw.type = 'sawtooth';
    this.sub = c.createOscillator();
    this.sub.type = 'square';
    this.noise = audio.noiseSource();
    this.noiseFilter = c.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.Q.value = 1.2;
    this.sawGain = c.createGain();
    this.subGain = c.createGain();
    this.noiseGain = c.createGain();
    this.sawGain.gain.value = this.voice.sawMix;
    this.subGain.gain.value = this.voice.subMix;
    this.noiseGain.gain.value = this.voice.noiseMix;
    this.filter = c.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 2;
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.saw.connect(this.sawGain).connect(this.filter);
    this.sub.connect(this.subGain).connect(this.filter);
    this.noise.connect(this.noiseFilter).connect(this.noiseGain).connect(this.filter);
    this.filter.connect(this.out).connect(audio.sfx);
    this.saw.start();
    this.sub.start();
    this.noise.start();
  }

  update(rpm, load, ventilation, running) {
    const v = this.voice;
    const t = this.c.currentTime;
    const f = (rpm / 60) * v.firingPerRev;
    this.saw.frequency.setTargetAtTime(f, t, 0.05);
    this.sub.frequency.setTargetAtTime(f / 2, t, 0.05);
    this.noiseFilter.frequency.setTargetAtTime(f * 4, t, 0.08);
    const cutoff = v.filterBase + rpm * v.filterPerRpm * (0.6 + 0.6 * Math.abs(load)) + ventilation * 900;
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.06);
    this.subGain.gain.setTargetAtTime(v.subMix * (1 - 0.6 * ventilation), t, 0.05);
    const g = running ? v.gain * (0.45 + 0.55 * Math.abs(load)) : 0;
    this.out.gain.setTargetAtTime(g, t, running ? 0.1 : 0.6);
  }
}
