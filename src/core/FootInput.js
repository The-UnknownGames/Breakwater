// Walking controls (V7): WASD walk, Shift jog, mouse look (click to capture
// the pointer; arrow keys look too), gamepad left stick walk / right stick
// look / A to use, and on touch screens a drag on the left half walks and
// on the right half looks. Receives keys as the Input sink.

import { FOOT } from '../config/onfoot.js';
import { GAMEPAD } from '../config/controls.js';

export class FootInput {
  constructor(game, foot) {
    this.game = game;
    this.foot = foot;
    this.down = new Set();
    this.pressed = new Map();
    this.move = { forward: 0, strafe: 0, jog: false };
    this.look = { yaw: 0, pitch: 0 };
    this.mouse = { yaw: 0, pitch: 0 };
    this.touches = new Map(); // pointerId -> { kind: 'move'|'look', x0, y0, x, y }
    const el = game.renderer.domElement;
    el.addEventListener('click', () => {
      if (foot.walking && !game.input.blocked && el.requestPointerLock && !this.touchOnly) {
        el.requestPointerLock();
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (foot.walking && document.pointerLockElement === el) {
        this.mouse.yaw += e.movementX * FOOT.mouseSens;
        this.mouse.pitch -= e.movementY * FOOT.mouseSens;
      }
    });
    el.addEventListener('pointerdown', (e) => {
      if (!foot.walking || e.pointerType !== 'touch') {
        return;
      }
      this.touchOnly = true;
      const kind = e.clientX < window.innerWidth / 2 ? 'move' : 'look';
      this.touches.set(e.pointerId, { kind, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY });
    });
    el.addEventListener('pointermove', (e) => {
      const t = this.touches.get(e.pointerId);
      if (!t) {
        return;
      }
      if (t.kind === 'look') {
        this.mouse.yaw += (e.clientX - t.x) * FOOT.mouseSens * 1.6;
        this.mouse.pitch -= (e.clientY - t.y) * FOOT.mouseSens * 1.6;
      }
      t.x = e.clientX;
      t.y = e.clientY;
    });
    const end = (e) => this.touches.delete(e.pointerId);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  keyDown(code) {
    this.down.add(code);
    this.pressed.set(code, (this.pressed.get(code) || 0) + 1);
  }

  keyUp(code) {
    this.down.delete(code);
  }

  consume(code) {
    const n = this.pressed.get(code) || 0;
    this.pressed.delete(code);
    return n;
  }

  release() {
    this.down.clear();
    this.pressed.clear();
    this.touches.clear();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  // Fixed step: gather keys, pad and touch into move and look.
  poll(dt) {
    const d = this.down;
    let f = (d.has('KeyW') ? 1 : 0) - (d.has('KeyS') ? 1 : 0);
    let s = (d.has('KeyD') ? 1 : 0) - (d.has('KeyA') ? 1 : 0);
    let jog = d.has('ShiftLeft') || d.has('ShiftRight');
    const k = FOOT.lookSpeed * dt;
    this.look.yaw += ((d.has('ArrowRight') ? 1 : 0) - (d.has('ArrowLeft') ? 1 : 0)) * k;
    this.look.pitch += ((d.has('ArrowUp') ? 1 : 0) - (d.has('ArrowDown') ? 1 : 0)) * k;
    const pad = this.game.gamepad.pad();
    if (pad) {
      const dz = GAMEPAD.deadzone;
      const ax = (i) => {
        const v = pad.axes[i] || 0;
        return Math.abs(v) > dz ? Math.sign(v) * (Math.abs(v) - dz) / (1 - dz) : 0;
      };
      f -= ax(1);
      s += ax(0);
      this.look.yaw += ax(2) * k * 1.3;
      this.look.pitch -= ax(3) * k;
      jog = jog || Boolean(pad.buttons[10] && pad.buttons[10].pressed) || (pad.buttons[7] ? pad.buttons[7].value > 0.5 : false);
    }
    for (const t of this.touches.values()) {
      if (t.kind === 'move') {
        const r = 70;
        s += Math.max(-1, Math.min(1, (t.x - t.x0) / r));
        f += Math.max(-1, Math.min(1, -(t.y - t.y0) / r));
        jog = jog || Math.hypot(t.x - t.x0, t.y - t.y0) > r * 1.6;
      }
    }
    this.move.forward = Math.max(-1, Math.min(1, f));
    this.move.strafe = Math.max(-1, Math.min(1, s));
    this.move.jog = jog;
  }

  // Look since the last step (keys, pad, mouse, touch), then reset.
  takeLook() {
    const out = { yaw: this.look.yaw + this.mouse.yaw, pitch: this.look.pitch + this.mouse.pitch };
    this.look.yaw = 0;
    this.look.pitch = 0;
    this.mouse.yaw = 0;
    this.mouse.pitch = 0;
    return out;
  }
}
