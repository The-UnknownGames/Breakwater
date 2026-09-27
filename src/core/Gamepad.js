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

  // Buttons of the open menu or panel (title/pause first, then the paper
  // panels: job board, port, shipyard, chart), in page order.
  uiButtons() {
    if (typeof document === 'undefined') {
      return [];
    }
    for (const sel of ['.menu-screen:not([hidden])', '.paper-panel:not([hidden])', '.chart-panel:not([hidden])']) {
      const root = document.querySelector(sel);
      if (root) {
        return [...root.querySelectorAll('button, input[type=range]')].filter((b) => !b.disabled && b.offsetParent !== null);
      }
    }
    return [];
  }

  // Menus and panels: the d-pad moves a focus ring, A presses, B backs out.
  navigate(code, list) {
    let i = list.indexOf(this.focused);
    if (code === 'KeyE') {
      this.focused?.click();
      return;
    }
    if (code === 'back') {
      this.input.onDown({ code: 'Escape', repeat: false, preventDefault() {} });
      return;
    }
    const step = code === 'up' || code === 'left' ? -1 : 1;
    if (this.focused && this.focused.type === 'range' && (code === 'left' || code === 'right')) {
      const r = this.focused;
      r.value = String(Number(r.value) + step * Number(r.step || 1));
      r.dispatchEvent(new Event('input'));
      return;
    }
    i = i < 0 ? 0 : (i + step + list.length) % list.length;
    this.focus(list[i]);
  }

  focus(b) {
    this.focused?.classList.remove('pad-focus');
    this.focused = b;
    b.classList.add('pad-focus');
    b.focus({ preventScroll: false });
  }

  // boat: PlayerBoat (or null on the title screen).
  poll(dt, boat) {
    const p = this.pad();
    this.connected = Boolean(p);
    if (!p) {
      for (const tag of this.held) {
        this.input.down.delete(GAMEPAD.buttons[tag.slice(1)]);
      }
      this.held.clear();
      return;
    }
    const ui = this.uiButtons();
    const UI = { 0: 'KeyE', 1: 'back', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
    for (const [i, code] of Object.entries(GAMEPAD.buttons)) {
      const b = p.buttons[i];
      const on = Boolean(b && b.pressed);
      const tag = `b${i}`;
      if (on && !this.held.has(tag)) {
        this.held.add(tag);
        if (ui.length && UI[i]) {
          this.navigate(UI[i], ui);
          continue;
        }
        this.input.onDown({ code, repeat: false, preventDefault() {} });
        this.input.down.add(code);
      } else if (!on && this.held.has(tag)) {
        this.held.delete(tag);
        this.input.down.delete(code);
      }
    }
    if (!ui.length && this.focused) {
      this.focused.classList.remove('pad-focus');
      this.focused = null;
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
