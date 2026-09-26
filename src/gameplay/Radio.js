// Radio (spec 8.3): mayday calls and harbormaster traffic as a short log.
// Listeners (HUD panel, audio beep) are told about each new message.

export class Radio {
  constructor() {
    this.log = [];
    this.listeners = [];
    this.time = 0;
  }

  on(fn) {
    this.listeners.push(fn);
  }

  say(text, kind = 'info') {
    const m = { text, kind, time: this.time };
    this.log.push(m);
    if (this.log.length > 30) {
      this.log.shift();
    }
    for (const fn of this.listeners) {
      fn(m);
    }
  }

  update(dt) {
    this.time += dt;
  }
}
