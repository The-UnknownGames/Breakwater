// Lightning: random strikes weighted by the weather's lightning value.
// Produces a flash envelope (sky + a brief directional light) and a jagged
// bolt mesh in the distance. Thunder (delayed by distance) is added in V5.

import * as THREE from 'three';
import { mulberry32 } from '../core/Rng.js';
import { LIGHT } from '../config/render.js';

export class Lightning {
  constructor(scene) {
    this.rng = mulberry32(9001);
    this.timer = 6;
    this.flash = 0;
    this.pulses = [];
    this.strikeAge = 99;
    this.light = new THREE.DirectionalLight(0xcfd8ff, 0);
    this.light.position.set(0, 1, 0);
    scene.add(this.light);
    scene.add(this.light.target);
    this.boltMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(9, 9.5, 12),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    this.bolt = new THREE.Mesh(new THREE.BufferGeometry(), this.boltMaterial);
    this.hold = 0;
    this.bolt.frustumCulled = false;
    this.bolt.visible = false;
    scene.add(this.bolt);
    this.onStrike = null;
  }

  // Force a strike now (debug / screenshots).
  strike(camera, inView = false) {
    const rng = this.rng;
    let ang = rng() * Math.PI * 2;
    if (inView) {
      const f = new THREE.Vector3();
      camera.getWorldDirection(f);
      ang = Math.atan2(f.z, f.x) + (rng() - 0.5) * 0.6;
    }
    const dist = 350 + rng() * 900;
    const base = new THREE.Vector3(
      camera.position.x + Math.cos(ang) * dist,
      0,
      camera.position.z + Math.sin(ang) * dist,
    );
    this.buildBolt(base, camera.position);
    this.pulses = [0, 0.09 + rng() * 0.05, 0.22 + rng() * 0.1];
    this.strikeAge = 0;
    this.light.position.copy(base).add(new THREE.Vector3(0, 900, 0));
    this.light.target.position.copy(base);
    if (this.onStrike) {
      this.onStrike({ position: base, distance: dist });
    }
  }

  // Camera-facing ribbon so the bolt keeps a visible width at distance.
  buildBolt(base, eye) {
    const pts = [];
    const rng = this.rng;
    const p = base.clone().setY(700);
    const side = new THREE.Vector3();
    const toEye = new THREE.Vector3();
    const seg = new THREE.Vector3();
    const quad = (a, b, w) => {
      seg.subVectors(b, a);
      toEye.subVectors(eye, a);
      side.crossVectors(seg, toEye).normalize().multiplyScalar(w / 2);
      const a0 = a.clone().sub(side);
      const a1 = a.clone().add(side);
      const b0 = b.clone().sub(side);
      const b1 = b.clone().add(side);
      pts.push(...a0.toArray(), ...b0.toArray(), ...a1.toArray());
      pts.push(...a1.toArray(), ...b0.toArray(), ...b1.toArray());
    };
    const addBranch = (start, steps, spread, width) => {
      let q = start.clone();
      for (let i = 0; i < steps && q.y > 0; i++) {
        const n = q.clone().add(new THREE.Vector3((rng() - 0.5) * spread, -700 / steps, (rng() - 0.5) * spread));
        n.y = Math.max(n.y, 0);
        quad(q, n, width);
        if (rng() < 0.14 && steps > 6) {
          addBranch(n, Math.floor(steps / 3), spread * 0.8, width * 0.5);
        }
        q = n;
      }
    };
    addBranch(p, 30, 60, 2.2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.bolt.geometry.dispose();
    this.bolt.geometry = geo;
  }

  update(dt, amount, camera) {
    this.strikeAge += dt;
    if (amount > 0.01) {
      this.timer -= dt * amount;
      if (this.timer <= 0) {
        this.timer = 4 + this.rng() * 12;
        this.strike(camera);
      }
    }
    let f = 0;
    for (const t0 of this.pulses) {
      const t = this.strikeAge - t0;
      if (t >= 0) {
        f = Math.max(f, Math.exp(-t * 18) * (t < 0.02 ? t / 0.02 : 1));
      }
    }
    if (this.hold > 0) {
      f = this.hold;
      this.strikeAge = Math.min(this.strikeAge, 0.1);
    }
    this.flash = f;
    this.light.intensity = f * LIGHT.lightningIntensity;
    this.bolt.visible = this.strikeAge < 0.35 && f > 0.05;
    this.boltMaterial.opacity = Math.min(1, f * 1.5);
  }
}
