// HUD root (spec 9): instrument cluster, tow panel, objective block,
// contextual prompt, event toasts and the status banner. The radio log
// arrives in V4.

import { Instruments } from './Instruments.js';
import { TowPanel } from './TowPanel.js';
import { Objective } from './Objective.js';

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
    this.tow = new TowPanel(this.root);
    this.objective = new Objective(this.root);
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'hud-toast';
    this.toastEl.hidden = true;
    this.root.appendChild(this.toastEl);
    this.toastTime = 0;
    this.visible = true;
  }

  toast(text, state = 'ok', seconds = 3) {
    this.toastEl.textContent = text;
    this.toastEl.dataset.state = state;
    this.toastEl.hidden = false;
    this.toastTime = seconds;
  }

  updateOps(dt, ops) {
    if (this.toastTime > 0) {
      this.toastTime -= dt;
      if (this.toastTime <= 0) {
        this.toastEl.hidden = true;
      }
    }
    if (!this.visible || !ops) {
      return;
    }
    this.tow.update(ops);
    this.objective.update(ops);
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
