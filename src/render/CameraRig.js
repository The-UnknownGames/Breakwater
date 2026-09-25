// V1 camera: free orbit around a focus point near the sea surface.
// Chase/helm cameras arrive with the boat in V2.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraRig {
  constructor(domElement) {
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.2, 40000);
    this.camera.position.set(0, 7, 24);
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.target.set(0, 2, 0);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 600;
    this.controls.update();
  }

  // Place the camera looking along a compass bearing, e.g. toward the sun.
  lookAlong(pos, dir) {
    this.camera.position.copy(pos);
    this.controls.target.copy(pos).addScaledVector(dir, 30);
    this.controls.update();
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(waves) {
    // Keep the camera above the local wave surface.
    const p = this.camera.position;
    const surface = waves.heightAt(p.x, p.z);
    if (p.y < surface + 1.5) {
      const dy = surface + 1.5 - p.y;
      p.y += dy;
      this.controls.target.y += dy;
    }
    this.controls.update();
  }
}
