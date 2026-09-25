// Fixed 60 Hz simulation step, independent of frame rate. Rendering gets an
// interpolation factor alpha in [0, 1) between the last two sim states.

export const FIXED_DT = 1 / 60;
const MAX_STEPS = 16;

export class Loop {
  constructor({ fixed, render }) {
    this.fixed = fixed;
    this.render = render;
    this.acc = 0;
    this.last = 0;
    this.timeScale = 1;
    this.running = false;
    this.frame = this.frame.bind(this);
    this.fps = 0;
    this.frameMs = 0;
    this.fixedMs = 0;
    this.fpsFrames = 0;
    this.fpsTime = 0;
  }

  start() {
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  frame(now) {
    if (!this.running) {
      return;
    }
    const realDt = Math.min((now - this.last) / 1000, 0.25);
    this.last = now;
    this.acc += realDt * this.timeScale;
    let steps = 0;
    const t0 = performance.now();
    while (this.acc >= FIXED_DT && steps < MAX_STEPS) {
      this.fixed(FIXED_DT);
      this.acc -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS) {
      this.acc = 0;
    }
    const t1 = performance.now();
    this.fixedMs = t1 - t0;
    this.render(realDt, this.acc / FIXED_DT);
    this.frameMs = performance.now() - t0;
    this.fpsFrames++;
    this.fpsTime += realDt;
    if (this.fpsTime >= 0.5) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    requestAnimationFrame(this.frame);
  }
}
