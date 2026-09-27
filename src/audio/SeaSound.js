// Sea ambience: wave wash shaped by the motion of the water under the boat,
// spray hiss at speed, wind (a band plus a resonant howl that gusts in
// gales), rain (a hiss, and a drumming patter on the wheelhouse roof in the
// helm view), surf roar near shores; hull slap/slam one-shots.

export class SeaSound {
  constructor(audio) {
    this.audio = audio;
    const c = audio.ctx;
    this.c = c;
    this.wash = this.noiseVoice('lowpass', 520, 0.7);
    this.hiss = this.noiseVoice('highpass', 2600, 0.5);
    this.wind = this.noiseVoice('bandpass', 700, 3);
    this.howl = this.noiseVoice('bandpass', 900, 14);
    this.rain = this.noiseVoice('highpass', 3200, 0.4);
    this.roof = this.noiseVoice('bandpass', 1300, 0.9);
    this.surf = this.noiseVoice('lowpass', 260, 0.6);
    this.gust = 0;
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

  // waterMotion: |vertical relative velocity| (m/s); speed m/s; windKn;
  // env: { rain 0..1, helm (in the wheelhouse), surf 0..1 (shore nearby) }.
  update(waterMotion, speed, windKn, hs, env = {}) {
    const t = this.c.currentTime;
    const wash = Math.min(0.6, 0.06 + hs * 0.05 + waterMotion * 0.12 + speed * 0.012);
    this.wash.g.gain.setTargetAtTime(wash, t, 0.15);
    this.wash.f.frequency.setTargetAtTime(380 + speed * 30 + waterMotion * 180, t, 0.2);
    this.hiss.g.gain.setTargetAtTime(Math.min(0.25, Math.max(0, speed - 3) * 0.02), t, 0.2);
    const w = Math.min(0.5, windKn * 0.007);
    this.wind.g.gain.setTargetAtTime(w, t, 0.5);
    this.wind.f.frequency.setTargetAtTime(420 + windKn * 14 + Math.sin(t * 0.7) * 60, t, 0.3);
    // Gusts: a slow wandering envelope; the howl sings above ~28 kn.
    this.gust = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1.7);
    const howl = Math.max(0, windKn - 28) / 40;
    this.howl.g.gain.setTargetAtTime(Math.min(0.35, howl * (0.3 + 0.7 * this.gust)) * (env.helm ? 0.55 : 1), t, 0.4);
    this.howl.f.frequency.setTargetAtTime(600 + windKn * 9 + this.gust * 380, t, 0.5);
    const rain = env.rain || 0;
    this.rain.g.gain.setTargetAtTime(rain * (env.helm ? 0.12 : 0.22), t, 0.5);
    this.roof.g.gain.setTargetAtTime(env.helm ? rain * 0.35 : 0, t, 0.3);
    const surf = env.surf || 0;
    this.surf.g.gain.setTargetAtTime(surf * Math.min(0.6, 0.2 + hs * 0.08) * (0.7 + 0.3 * Math.sin(t * 0.9)), t, 0.6);
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
