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

const RELOAD_KEY = 'breakwater.glReloads';

function storage(fn) {
  try {
    return fn(window.sessionStorage);
  } catch {
    return null;
  }
}

// On-screen notice with an optional Restart button (never a silent stop).
export function showNotice(text, restart = true) {
  let box = document.getElementById('bw-notice');
  if (!box) {
    box = document.createElement('div');
    box.id = 'bw-notice';
    box.style.cssText =
      'position:fixed;left:50%;top:38%;transform:translateX(-50%);z-index:50;max-width:80vw;padding:12px 16px;' +
      'background:rgba(21,27,33,0.96);border:1px solid #2c3640;border-top:2px solid #b08d57;color:#e8e4da;' +
      'font:14px/1.45 "IBM Plex Sans Condensed",Arial,sans-serif;text-align:center';
    document.body.appendChild(box);
  }
  box.textContent = text;
  if (restart) {
    const b = document.createElement('button');
    b.textContent = 'Restart';
    b.style.cssText = 'display:block;margin:10px auto 0;padding:6px 18px;background:#b08d57;color:#151b21;border:0;font:600 13px Arial,sans-serif';
    b.addEventListener('click', () => {
      storage((st) => st.removeItem(RELOAD_KEY));
      window.location.reload();
    });
    box.appendChild(b);
  }
}

// If the browser drops the WebGL context, restart once automatically; if it
// happens again this session, stop and offer a Restart button (reload loops
// can get WebGL blocked for the page entirely).
export function guardContextLoss(game) {
  const canvas = game.renderer.domElement;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    game.loop.running = false;
    const n = Number(storage((st) => st.getItem(RELOAD_KEY)) || 0);
    if (n < 1) {
      storage((st) => st.setItem(RELOAD_KEY, String(n + 1)));
      showNotice('Graphics reset, restarting…', false);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showNotice('The graphics driver stopped the game twice. Close other apps or tabs, then restart.');
    }
  });
  // A healthy minute clears the retry budget.
  setTimeout(() => storage((st) => st.removeItem(RELOAD_KEY)), 60000);
}
