// Rapier world wrapper (spec 3.1). Fixed 60 Hz; bodies compute their
// hydrodynamic forces before each world step. Runs headless in Node.

import RAPIER from '@dimforge/rapier3d-compat';
import { PHYS } from '../config/physics.js';

let ready = null;

export function initRapier() {
  if (!ready) {
    ready = RAPIER.init().then(() => RAPIER);
  }
  return ready;
}

export class PhysicsWorld {
  constructor(R, dt = 1 / 60) {
    this.R = R;
    this.world = new R.World({ x: 0, y: -PHYS.gravity, z: 0 });
    this.world.timestep = dt;
    this.dt = dt;
    this.bodies = [];
    this.stepMs = 0;
  }

  add(body) {
    this.bodies.push(body);
    return body;
  }

  // ctx: { waves, env, time }
  step(ctx) {
    const t0 = performance.now();
    for (const b of this.bodies) {
      b.preStep(this.dt, ctx);
    }
    this.world.step();
    for (const b of this.bodies) {
      b.postStep(this.dt, ctx);
    }
    this.stepMs = performance.now() - t0;
  }
}
