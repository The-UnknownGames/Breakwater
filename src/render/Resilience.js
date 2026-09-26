// Keeping the game alive on phones:
// - DynamicResolution: when the frame rate stays low, render fewer pixels
//   (and more again when there is headroom). Touch devices only.
// - Context loss: if the browser drops the WebGL context (GPU memory
//   pressure in an in-app viewer), show a short notice and restart instead
//   of leaving a white canvas.

import { DYNAMIC_RES } from '../config/quality.js';

export class DynamicResolution {
  constructor(game) {
    this.game = game;
    this.base = game.renderer.getPixelRatio();
    this.scale = 1;
    this.low = 0;
    this.high = 0;
  }

  update(dt) {
    const c = DYNAMIC_RES;
    const fps = this.game.loop.fps;
    if (!fps) {
      return;
    }
    this.low = fps < c.lowFps ? this.low + dt : 0;
    this.high = fps > c.highFps ? this.high + dt : 0;
    if (this.low > c.holdSeconds && this.scale > c.minScale) {
      this.set(Math.max(c.minScale, this.scale * c.step));
    } else if (this.high > c.holdSeconds * 3 && this.scale < 1) {
      this.set(Math.min(1, this.scale / c.step));
    }
  }

  set(scale) {
    this.scale = scale;
    this.low = 0;
    this.high = 0;
    this.game.renderer.setPixelRatio(this.base * scale);
    this.game.resize();
  }
}

export function guardContextLoss(game) {
  const canvas = game.renderer.domElement;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    game.loop.running = false;
    const note = document.createElement('div');
    note.className = 'hud-banner';
    note.style.cssText = 'position:fixed;left:50%;top:40%;transform:translateX(-50%);z-index:20;border-color:#b08d57';
    note.textContent = 'Graphics reset, restarting…';
    document.body.appendChild(note);
    setTimeout(() => window.location.reload(), 1500);
  });
}
