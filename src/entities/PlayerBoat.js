// The player's boat: physics body + visual model + helm input.
// Render pose is interpolated between the last two 60 Hz physics states.

import * as THREE from 'three';
import { BoatPhysics } from '../physics/BoatPhysics.js';
import { loadBoatModel } from './models/Models.js';
import { CONTROLS } from '../config/controls.js';

export class PlayerBoat {
  static async create(physics, cfg, spawn) {
    const model = await loadBoatModel(cfg);
    return new PlayerBoat(physics, cfg, spawn, model);
  }

  constructor(physics, cfg, spawn, model) {
    this.cfg = cfg;
    this.sim = physics.add(new BoatPhysics(physics, cfg, spawn));
    this.model = model;
    this.throttleLever = 0;
    this.holdTime = 0;
    this.empties = {};
    for (const name of ['towPoint', 'bowCleat', 'propeller', 'rudder', 'searchlight', 'helmCamera']) {
      this.empties[name] = model.getObjectByName(name);
    }
    this.radar = model.getObjectByName('radar');
    this.gear = model.userData.gear || {};
    this.propSpin = 0;
    this.q0 = new THREE.Quaternion();
    this.q1 = new THREE.Quaternion();
  }

  // Helm input, called every fixed step. input: core/Input.
  control(dt, input) {
    const c = CONTROLS;
    const up = input.isDown('KeyW');
    const down = input.isDown('KeyS');
    const upPresses = input.consume('KeyW');
    const downPresses = input.consume('KeyS');
    if (upPresses || downPresses) {
      this.throttleLever += (upPresses - downPresses) * c.throttleStep;
      this.holdTime = 0;
    }
    if (up || down) {
      this.holdTime += dt;
      if (this.holdTime > c.throttleHoldDelay) {
        this.throttleLever += (up ? 1 : -1) * c.throttleHoldRate * dt;
      }
    }
    if (input.consume('KeyX')) {
      this.throttleLever = 0;
    }
    this.throttleLever = Math.round(Math.min(1, Math.max(-1, this.throttleLever)) * 1000) / 1000;
    let rudder = 0;
    if (input.isDown('KeyA')) {
      rudder -= 1;
    }
    if (input.isDown('KeyD')) {
      rudder += 1;
    }
    const lock = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    this.sim.input.throttle = this.throttleLever;
    this.sim.input.rudder = rudder;
    this.sim.input.lock = lock;
  }

  // Interpolated render pose.
  updateVisual(dt, alpha) {
    const s = this.sim;
    const p0 = s.prev.pos;
    const p1 = s.state.pos;
    this.model.position.set(p0.x + (p1.x - p0.x) * alpha, p0.y + (p1.y - p0.y) * alpha, p0.z + (p1.z - p0.z) * alpha);
    this.q0.set(s.prev.rot.x, s.prev.rot.y, s.prev.rot.z, s.prev.rot.w);
    this.q1.set(s.state.rot.x, s.state.rot.y, s.state.rot.z, s.state.rot.w);
    this.model.quaternion.slerpQuaternions(this.q0, this.q1, alpha);
    if (this.radar) {
      this.radar.rotation.y += dt * 2.6;
    }
    const pr = s.propulsion;
    this.propSpin += dt * (pr.rpm / 60) * Math.PI * 2 * Math.sign(pr.load || 1) * 0.25;
    if (this.gear.prop) {
      this.gear.prop.rotation.y = this.propSpin;
    }
    if (this.gear.rudder) {
      this.gear.rudder.rotation.y = -pr.rudder;
    }
  }

  worldPoint(name, out = new THREE.Vector3()) {
    const e = this.empties[name];
    return e ? e.getWorldPosition(out) : out.copy(this.model.position);
  }
}
