// Cameras (spec 5): chase (spring-smoothed, horizon level by default, pulls
// back and widens with speed), helm (first person at the wheel), orbit.
// Shake is physical: slams and impacts add decaying impulses.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA } from '../config/controls.js';

export const CAMERA_MODES = ['chase', 'helm', 'orbit'];

export class CameraRig {
  constructor(domElement) {
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, 0.1, 40000);
    this.camera.position.set(0, 7, 24);
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.target.set(0, 2, 0);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 600;
    this.mode = 'orbit';
    this.horizonLock = true;
    this.chaseYaw = null;
    this.chasePos = new THREE.Vector3();
    this.shake = 0;
    this.shakeVec = new THREE.Vector3();
    this.lastTarget = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.q = new THREE.Quaternion();
  }

  setMode(mode) {
    this.mode = mode;
    // Orbit follows the boat by its motion since the last orbit frame; start
    // that fresh so switching modes never jumps the camera.
    this.orbitFresh = true;
    this.controls.enabled = mode === 'orbit';
    this.chaseYaw = null;
    this.camera.fov = mode === 'helm' ? CAMERA.helmFov : CAMERA.fov;
    this.camera.near = mode === 'helm' ? 0.05 : 0.1;
    this.camera.updateProjectionMatrix();
  }

  cycle() {
    const i = CAMERA_MODES.indexOf(this.mode);
    this.setMode(CAMERA_MODES[(i + 1) % CAMERA_MODES.length]);
  }

  addShake(amount) {
    this.shake = Math.min(CAMERA.maxShake, this.shake + amount);
  }

  // Place the camera looking along a direction (screenshots / sandbox).
  lookAlong(pos, dir) {
    this.camera.position.copy(pos);
    this.controls.target.copy(pos).addScaledVector(dir, 30);
    this.controls.update();
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // boat: PlayerBoat (may be null), speedRatio 0..1.
  update(dt, waves, boat, speedRatio = 0) {
    if (boat && this.mode === 'chase') {
      this.updateChase(dt, boat, speedRatio);
    } else if (boat && this.mode === 'helm') {
      this.updateHelm(boat);
    } else {
      this.updateOrbit(boat, waves);
    }
    this.applyShake(dt);
  }

  updateChase(dt, boat, speedRatio) {
    const m = boat.model;
    const fwd = this.tmp.set(0, 0, 1).applyQuaternion(m.quaternion);
    const yaw = Math.atan2(fwd.x, fwd.z);
    if (this.chaseYaw === null) {
      this.chaseYaw = yaw;
      this.chasePos.copy(m.position);
    }
    let dy = yaw - this.chaseYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.chaseYaw += dy * Math.min(1, dt * CAMERA.yawStiffness);
    const k = Math.min(1, dt * CAMERA.positionStiffness);
    this.chasePos.lerp(m.position, k);
    const dist = CAMERA.chaseDistance + CAMERA.chaseDistanceAtSpeed * speedRatio;
    const back = this.tmp2.set(Math.sin(this.chaseYaw), 0, Math.cos(this.chaseYaw));
    this.camera.position.copy(this.chasePos).addScaledVector(back, -dist);
    this.camera.position.y = this.chasePos.y + CAMERA.chaseHeight + dist * 0.05;
    const target = this.tmp.copy(this.chasePos).addScaledVector(back, CAMERA.lookAhead);
    target.y += 1.5;
    this.camera.up.set(0, 1, 0);
    if (!this.horizonLock) {
      this.camera.up.set(0, 1, 0).applyQuaternion(m.quaternion);
    }
    this.camera.lookAt(target);
    const fov = CAMERA.fov + CAMERA.fovAtSpeed * speedRatio;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  updateHelm(boat) {
    const m = boat.model;
    m.updateMatrixWorld(true);
    boat.worldPoint('helmCamera', this.camera.position);
    this.camera.quaternion.copy(m.quaternion);
    // Models face +Z; cameras look down -Z.
    this.camera.quaternion.multiply(this.q.setFromAxisAngle(this.tmp.set(0, 1, 0), Math.PI));
    this.camera.up.set(0, 1, 0).applyQuaternion(m.quaternion);
  }

  updateOrbit(boat, waves) {
    if (boat) {
      if (!this.orbitFresh) {
        const delta = this.tmp.copy(boat.model.position).sub(this.lastTarget);
        this.camera.position.add(delta);
        this.controls.target.add(delta);
      }
      this.orbitFresh = false;
      this.lastTarget.copy(boat.model.position);
    }
    const p = this.camera.position;
    const surface = waves.heightAt(p.x, p.z);
    if (p.y < surface + 1.5) {
      const dy = surface + 1.5 - p.y;
      p.y += dy;
      this.controls.target.y += dy;
    }
    this.controls.update();
  }

  applyShake(dt) {
    if (this.shake < 1e-3 || this.mode === 'orbit') {
      return;
    }
    const s = this.shake;
    this.shakeVec.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    this.camera.position.add(this.shakeVec);
    this.shake *= Math.exp(-dt * CAMERA.shakeDecay);
  }

  attachOrbitTo(boat) {
    this.lastTarget.copy(boat.model.position);
    this.controls.target.copy(boat.model.position).add(this.tmp.set(0, 2, 0));
    this.camera.position.copy(boat.model.position).add(this.tmp.set(-14, 7, -18));
    this.controls.update();
  }
}
