// One-shot and loop effects for V3 (spec 10): the tow line's snap and
// creak, a heavy clunk when the line is made fast, grounding scrape, and
// the splash of a survivor being hauled over the side. All synthesized.

export class Sfx {
  constructor(audio) {
    this.audio = audio;
    this.c = audio.ctx;
    this.creak = this.loop('bandpass', 420, 9);
    this.scrape = this.loop('bandpass', 180, 1.2);
    this.creakPhase = 0;
  }

  loop(type, freq, q) {
    const src = this.audio.noiseSource();
    const f = this.c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.audio.sfx);
    src.start();
    return { f, g };
  }

  burst(type, f0, f1, dur, level, q = 1) {
    const c = this.c;
    const now = c.currentTime;
    const src = this.audio.noiseSource();
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, now);
    f.frequency.exponentialRampToValueAtTime(f1, now + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(level, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(f).connect(g).connect(this.audio.sfx);
    src.start(now);
    src.stop(now + dur + 0.05);
  }

  tone(f0, f1, dur, level, type = 'sine') {
    const c = this.c;
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(f1, now + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(level, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g).connect(this.audio.sfx);
    o.start(now);
    o.stop(now + dur + 0.05);
  }

  // Line parting: a whip-crack followed by a low thud.
  snap() {
    this.burst('highpass', 5000, 1800, 0.12, 1.0, 0.7);
    this.burst('bandpass', 1400, 300, 0.35, 0.8, 1.5);
    this.tone(90, 40, 0.4, 0.7);
  }

  clunk() {
    this.burst('lowpass', 900, 200, 0.18, 0.6, 2);
    this.tone(140, 90, 0.2, 0.35, 'triangle');
  }

  // Radio: a squelch of static and a beep (two for a mayday).
  radio(kind) {
    this.burst('bandpass', 2400, 1600, 0.25, 0.25, 1.2);
    this.tone(1250, 1250, 0.12, 0.18, 'square');
    if (kind === 'mayday') {
      setTimeout(() => this.tone(1250, 1250, 0.12, 0.18, 'square'), 180);
    }
  }

  // Thunder: arrives distance / 343 m/s after the flash. Close strikes crack
  // first; far ones only rumble, low and long.
  thunder(distance) {
    const c = this.c;
    const delay = distance / 343;
    const near = Math.max(0, 1 - distance / 2500);
    const at = c.currentTime + delay;
    const rumble = (t0, dur, level, f) => {
      const src = this.audio.noiseSource();
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(f, t0);
      lp.frequency.exponentialRampToValueAtTime(60, t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(level, t0 + 0.08 + 0.3 * (1 - near));
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(lp).connect(g).connect(this.audio.ambience || this.audio.sfx);
      src.start(t0);
      src.stop(t0 + dur + 0.1);
    };
    if (near > 0.6) {
      rumble(at, 0.35, 0.9 * near, 3500);
    }
    rumble(at + 0.05, 3 + 3 * (1 - near), 0.25 + 0.6 * near, 180 + 420 * near);
    rumble(at + 0.6 + Math.random(), 2.5, 0.2 + 0.3 * near, 140);
  }

  splash() {
    this.burst('lowpass', 2400, 400, 0.6, 0.55, 0.8);
  }

  // ratio: tension / breaking strength; scrape: m/s sliding on the seabed.
  update(dt, ratio, scrape) {
    const t = this.c.currentTime;
    // Creak above 70%: a stuttering, pitch-wandering squeal.
    this.creakPhase += dt * (6 + ratio * 14);
    const on = ratio > 0.7 ? Math.min(1, (ratio - 0.7) / 0.25) : 0;
    const stutter = 0.55 + 0.45 * Math.sin(this.creakPhase * 2.3) * Math.sin(this.creakPhase * 0.7);
    this.creak.g.gain.setTargetAtTime(on * 0.5 * stutter, t, 0.03);
    this.creak.f.frequency.setTargetAtTime(320 + ratio * 380 + 60 * Math.sin(this.creakPhase), t, 0.05);
    const s = Math.min(1, scrape / 2);
    this.scrape.g.gain.setTargetAtTime(s * 0.9, t, 0.08);
    this.scrape.f.frequency.setTargetAtTime(120 + s * 260, t, 0.1);
  }
}
