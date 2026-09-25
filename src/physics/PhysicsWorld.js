// Rapier world wrapper (spec 3.1). Fixed 60 Hz; links (tow lines) compute
// first from the current body states, then bodies compute their
// hydrodynamic forces, then the world steps. Contact force events feed hull
// damage. Runs headless in Node.

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
    this.links = [];
    this.events = new R.EventQueue(true);
    this.colliderOwner = new Map();
    this.stepMs = 0;
  }

  add(body) {
    this.bodies.push(body);
    return body;
  }

  remove(body) {
    const i = this.bodies.indexOf(body);
    if (i >= 0) {
      this.bodies.splice(i, 1);
    }
    if (body.body) {
      for (let k = 0; k < body.body.numColliders(); k++) {
        this.colliderOwner.delete(body.body.collider(k).handle);
      }
      this.world.removeRigidBody(body.body);
    }
  }

  addLink(link) {
    this.links.push(link);
    return link;
  }

  removeLink(link) {
    const i = this.links.indexOf(link);
    if (i >= 0) {
      this.links.splice(i, 1);
    }
  }

  // Colliders that report contact forces back to their owner (onContact).
  watchCollider(collider, owner) {
    collider.setActiveEvents(this.R.ActiveEvents.CONTACT_FORCE_EVENTS);
    collider.setContactForceEventThreshold(1000);
    this.colliderOwner.set(collider.handle, owner);
  }

  // ctx: { waves, env, time }
  step(ctx) {
    const t0 = performance.now();
    for (const l of this.links) {
      l.preStep(this.dt, ctx);
    }
    for (const b of this.bodies) {
      b.preStep(this.dt, ctx);
    }
    this.world.step(this.events);
    this.events.drainContactForceEvents((e) => {
      const f = e.totalForceMagnitude();
      for (const h of [e.collider1(), e.collider2()]) {
        const owner = this.colliderOwner.get(h);
        if (owner && owner.onContact) {
          owner.onContact(f, this.dt);
        }
      }
    });
    for (const b of this.bodies) {
      b.postStep(this.dt, ctx);
    }
    this.stepMs = performance.now() - t0;
  }
}
