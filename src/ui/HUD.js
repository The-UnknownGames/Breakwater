// HUD root (spec 9). V2: instrument cluster, contextual prompt and status
// banner. Tow panel, objective and radio log arrive in V3/V4.

import { Instruments } from './Instruments.js';

export class HUD {
  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    document.body.appendChild(this.root);
    this.instruments = new Instruments(this.root);
    this.prompt = document.createElement('div');
    this.prompt.className = 'hud-prompt';
    this.prompt.hidden = true;
    this.root.appendChild(this.prompt);
    this.banner = document.createElement('div');
    this.banner.className = 'hud-banner';
    this.banner.hidden = true;
    this.root.appendChild(this.banner);
    this.visible = true;
  }

  setVisible(v) {
    this.visible = v;
    this.root.hidden = !v;
  }

  setPrompt(text) {
    this.prompt.hidden = !text;
    if (text && this.prompt.textContent !== text) {
      this.prompt.textContent = text;
    }
  }

  showBanner(text, state = 'crit') {
    this.banner.textContent = text;
    this.banner.dataset.state = state;
    this.banner.hidden = false;
  }

  update(boatSim) {
    if (!this.visible || !boatSim) {
      return;
    }
    this.instruments.update(boatSim);
  }
}
