// Sea ambience: wave wash shaped by the motion of the water under the boat,
// spray hiss at speed, wind band from the weather; hull slap/slam one-shots.

export class SeaSound {
  constructor(audio) {
    this.audio = audio;
    const c = audio.ctx;
    this.c = c;
    this.wash = this.noiseVoice('lowpass', 520, 0.7);
    this.hiss = this.noiseVoice('highpass', 2600, 0.5);
    this.wind = this.noiseVoice('bandpass', 700, 3);
    this.lastSlam = 0;
  }

  noiseVoice(type, freq, q) {
    const src = this.audio.noiseSource();
    const f = this.c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.audio.ambience);
    src.start();
    return { src, f, g };
  }

  // waterMotion: |vertical relative velocity| (m/s); speed m/s; windKn.
  update(waterMotion, speed, windKn, hs) {
    const t = this.c.currentTime;
    const wash = Math.min(0.6, 0.06 + hs * 0.05 + waterMotion * 0.12 + speed * 0.012);
    this.wash.g.gain.setTargetAtTime(wash, t, 0.15);
    this.wash.f.frequency.setTargetAtTime(380 + speed * 30 + waterMotion * 180, t, 0.2);
    this.hiss.g.gain.setTargetAtTime(Math.min(0.25, Math.max(0, speed - 3) * 0.02), t, 0.2);
    const w = Math.min(0.5, windKn * 0.007);
    this.wind.g.gain.setTargetAtTime(w, t, 0.5);
    this.wind.f.frequency.setTargetAtTime(420 + windKn * 14 + Math.sin(t * 0.7) * 60, t, 0.3);
  }

  // Hull slam: filtered noise thump + low sine drop, scaled by impact speed.
  slam(speed) {
    const c = this.c;
    const now = c.currentTime;
    if (now - this.lastSlam < 0.12) {
      return;
    }
    this.lastSlam = now;
    const amp = Math.min(1, (speed - 2) / 6);
    const src = this.audio.noiseSource();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900 + amp * 900, now);
    f.frequency.exponentialRampToValueAtTime(180, now + 0.35);
    const g = c.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.9 * amp, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.connect(f).connect(g).connect(this.audio.sfx);
    src.start(now);
    src.stop(now + 0.6);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(70, now);
    o.frequency.exponentialRampToValueAtTime(35, now + 0.3);
    const og = c.createGain();
    og.gain.setValueAtTime(0.6 * amp, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    o.connect(og).connect(this.audio.sfx);
    o.start(now);
    o.stop(now + 0.4);
  }
}
