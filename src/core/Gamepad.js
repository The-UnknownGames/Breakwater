// Gamepad support (V6): polls the first connected pad each fixed step.
// Buttons press and hold the keys they map to (so every screen and prompt
// works as with a keyboard), the left stick steers like the touch wheel and
// the triggers move the throttle lever (right ahead, left astern).

import { GAMEPAD } from '../config/controls.js';

export class GamepadInput {
  constructor(input) {
    this.input = input;
    this.held = new Set();
    this.connected = false;
    this.steering = false;
  }

  pad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      return null;
    }
    for (const p of navigator.getGamepads()) {
      if (p && p.connected) {
        return p;
      }
    }
    return null;
  }

  // boat: PlayerBoat (or null on the title screen).
  poll(dt, boat) {
    const p = this.pad();
    this.connected = Boolean(p);
    if (!p) {
      for (const code of this.held) {
        this.input.down.delete(code);
      }
      this.held.clear();
      return;
    }
    for (const [i, code] of Object.entries(GAMEPAD.buttons)) {
      const b = p.buttons[i];
      const on = Boolean(b && b.pressed);
      if (on && !this.held.has(code)) {
        this.held.add(code);
        this.input.onDown({ code, repeat: false, preventDefault() {} });
      } else if (!on && this.held.has(code)) {
        this.held.delete(code);
        this.input.down.delete(code);
      }
    }
    if (!boat || this.input.blocked) {
      return;
    }
    // Left stick: left is port (+), like the A key.
    const x = p.axes[0] || 0;
    const dz = GAMEPAD.deadzone;
    if (Math.abs(x) > dz) {
      boat.wheel = -Math.sign(x) * (Math.abs(x) - dz) / (1 - dz);
      this.steering = true;
    } else if (this.steering) {
      boat.wheel = 0;
    }
    const rt = p.buttons[7] ? p.buttons[7].value : 0;
    const lt = p.buttons[6] ? p.buttons[6].value : 0;
    const t = rt - lt;
    if (Math.abs(t) > 0.05) {
      boat.throttleLever = Math.max(-1, Math.min(1, boat.throttleLever + t * GAMEPAD.throttleRate * dt));
    }
  }
}
