// Keyboard state + one-shot key presses. Keys are KeyboardEvent.code values.

export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Map(); // code -> presses since last consume
    this.handlers = new Map();
    // Menus open: keys don't reach the game (Escape still does).
    this.blocked = false;
    target.addEventListener('keydown', (e) => this.onDown(e));
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  onDown(e) {
    if (this.blocked && e.code !== 'Escape') {
      return;
    }
    if (e.code.startsWith('F') && e.code.length <= 3) {
      e.preventDefault();
    }
    if (e.code === 'Tab') {
      e.preventDefault();
    }
    if (!e.repeat) {
      this.pressed.set(e.code, (this.pressed.get(e.code) || 0) + 1);
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

  // Number of presses since the last consume (0 if none).
  consume(code) {
    const n = this.pressed.get(code) || 0;
    this.pressed.delete(code);
    return n;
  }

  endFrame() {
    this.pressed.clear();
  }
}
