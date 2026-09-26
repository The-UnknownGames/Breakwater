// Leisure (RP): anchoring and photo mode.
// N lets go the anchor (nearly stopped, bottom within reach) or weighs it.
// P toggles photo mode: time stands still, the HUD hides and the camera
// circles the boat slowly (drag to look round; P or Esc to leave).

import * as THREE from 'three';
import { Anchor } from '../physics/Anchor.js';
import { ANCHOR } from '../config/tow.js';
import { bowCleatLocal } from '../physics/fittings.js';

const KN = 0.514444;

export class LeisureSession {
  constructor(career) {
    this.career = career;
    this.game = career.game;
    this.anchor = null;
    this.photo = false;
    this.game.input.on('KeyN', () => this.toggleAnchor());
    this.game.input.on('KeyP', () => this.togglePhoto());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    this.rode = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x3b3326 }));
    this.rode.visible = false;
    this.rode.frustumCulled = false;
    this.game.scene.add(this.rode);
  }

  get player() {
    return this.career.player;
  }

  toggleAnchor() {
    const hud = this.career.hud;
    if (this.anchor) {
      this.game.physics.removeLink(this.anchor);
      this.anchor.detach();
      this.anchor = null;
      this.rode.visible = false;
      hud.toast('Anchor aweigh', 'ok', 2);
      return;
    }
    const sim = this.player;
    const p = sim.state.pos;
    const depth = this.career.shape.depthAt(p.x, p.z);
    if (sim.speed / KN > ANCHOR.maxKn) {
      hud.toast(`Slow below ${ANCHOR.maxKn} kn to anchor`, 'warn', 2);
      return;
    }
    if (depth > ANCHOR.maxDepth) {
      hud.toast(`Too deep to anchor (${Math.round(depth)} m)`, 'warn', 2);
      return;
    }
    if (this.career.ops.ops.line) {
      hud.toast('Cast off the tow first', 'warn', 2);
      return;
    }
    const local = bowCleatLocal(sim.cfg.hull);
    const f = sim.forward;
    // It holds a little ahead of the bow (where it was let go).
    const x = p.x + f.x * (sim.cfg.hull.length / 2 + 2);
    const z = p.z + f.z * (sim.cfg.hull.length / 2 + 2);
    this.anchor = this.game.physics.addLink(new Anchor(sim, local, x, z, Math.max(2, depth)));
    this.rode.visible = true;
    hud.toast(`Anchored in ${Math.round(depth)} m · ${Math.round(this.anchor.scope)} m of rode`, 'ok', 3);
  }

  togglePhoto(force) {
    const on = force !== undefined ? force : !this.photo;
    if (on === this.photo) {
      return;
    }
    const g = this.game;
    const rig = g.rig;
    this.photo = on;
    g.loop.timeScale = on ? 0 : 1;
    this.career.hud.root.style.visibility = on ? 'hidden' : '';
    if (on) {
      this.wasMode = rig.mode;
      rig.setMode('orbit');
      rig.orbitPlace = true;
      rig.controls.autoRotate = true;
      rig.controls.autoRotateSpeed = 0.6;
      for (const p of [this.career.board, this.career.portMenu, this.career.shipyard, this.career.maps.chart]) {
        p.toggle(false);
      }
    } else {
      rig.controls.autoRotate = false;
      rig.setMode(this.wasMode || 'chase');
    }
  }

  prompt() {
    if (!this.anchor) {
      return null;
    }
    const a = this.anchor;
    return `${a.dragging ? 'Anchor dragging!' : 'Anchored'} · ${Math.round(a.depth)} m, ${Math.round(a.scope)} m of rode${a.tension > 1000 ? ` · ${(a.tension / 1000).toFixed(1)} kN` : ''} · N to weigh`;
  }

  frame() {
    if (!this.anchor) {
      return;
    }
    // Rode: bow roller down to the water toward where it holds.
    const a = this.anchor;
    const pos = this.rode.geometry.attributes.position;
    const w = this.game.waves;
    const run = Math.min(a.distance, 12);
    const dx = (a.x - a.p.x) / a.distance;
    const dz = (a.z - a.p.z) / a.distance;
    const wx = a.p.x + dx * run;
    const wz = a.p.z + dz * run;
    pos.setXYZ(0, a.p.x, a.p.y, a.p.z);
    pos.setXYZ(1, a.p.x + dx * run * 0.6, (a.p.y + w.heightAt(wx, wz)) / 2 - 0.3, a.p.z + dz * run * 0.6);
    pos.setXYZ(2, wx, w.heightAt(wx, wz) - 0.2, wz);
    pos.needsUpdate = true;
  }
}
