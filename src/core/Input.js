// Keyboard state + one-shot key presses. Keys are KeyboardEvent.code values.

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();
    this.handlers = new Map();
    target.addEventListener('keydown', (e) => this.onDown(e));
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  onDown(e) {
    if (e.code.startsWith('F') && e.code.length <= 3) {
      e.preventDefault();
    }
    if (e.code === 'Tab') {
      e.preventDefault();
    }
    if (!e.repeat) {
      this.pressed.add(e.code);
      const list = this.handlers.get(e.code);
      if (list) {
        for (const fn of list) {
          fn(e);
        }
      }
    }
    this.down.add(e.code);
  }

  on(code, fn) {
    if (!this.handlers.has(code)) {
      this.handlers.set(code, []);
    }
    this.handlers.get(code).push(fn);
  }

  isDown(code) {
    return this.down.has(code);
  }

  consume(code) {
    const had = this.pressed.has(code);
    this.pressed.delete(code);
    return had;
  }

  endFrame() {
    this.pressed.clear();
  }
}
