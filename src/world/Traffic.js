// Ambient traffic (spec 6): ferries between ports, trawlers working the
// fishing grounds, a yacht and a sloop. Kinematic vessels: each fixed step
// they follow their route (turning at a rate that suits their size), give
// way to the player ahead, ride the waves (heave, pitch and roll from four
// hull samples) and push a kinematic Rapier body the player can hit. They
// leave wakes (centre wash + Kelvin crests) like the player's boat.

import * as THREE from 'three';
import { TRAFFIC, TRAFFIC_RULES } from '../config/world.js';
import { WAKE } from '../config/render.js';
import { BOATS } from '../config/boats.js';
import { TOW_TARGETS } from '../config/tow.js';
import { TARGET_MODELS } from '../entities/models/TargetModels.js';
import { loadBoatModel } from '../entities/models/Models.js';

const KN = 0.514444;
const KELVIN = Math.tan((19.5 * Math.PI) / 180);

function wrap(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// Compass heading (0 = north, -Z) as a rotation about +Y for a +Z-forward model.
function yawOf(heading) {
  return Math.PI - heading;
}

class Vessel {
  constructor(def, cfg, model, route, physics) {
    this.def = def;
    this.name = def.name;
    this.kind = def.kind;
    this.cfg = cfg;
    this.model = model;
    this.route = route;
    this.leg = 0;
    const a = route[0];
    const b = route[1 % route.length];
    this.x = a.x;
    this.z = a.z;
    this.heading = Math.atan2(b.x - a.x, -(b.z - a.z));
    this.speed = 0;
    this.dwell = 0;
    this.y = 0;
    this.pitch = 0;
    this.roll = 0;
    this.travel = 0;
    const R = physics.R;
    const h = cfg.hull;
    this.body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.x, 0, this.z));
    const height = h.draft + h.freeboard;
    physics.world.createCollider(R.ColliderDesc.cuboid(h.beam * 0.45, height / 2, h.length * 0.46).setTranslation(0, (h.freeboard - h.draft) / 2, 0), this.body);
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  // PhysicsWorld body interface (kinematic: no forces).
  preStep(dt, ctx) {
    this.move(dt, ctx);
    this.body.setNextKinematicTranslation({ x: this.x, y: this.y, z: this.z });
    this.e.set(this.pitch, yawOf(this.heading), this.roll);
    this.q.setFromEuler(this.e);
    this.body.setNextKinematicRotation({ x: this.q.x, y: this.q.y, z: this.q.z, w: this.q.w });
  }

  postStep() {}

  move(dt, ctx) {
    const h = this.cfg.hull;
    const target = this.route[this.leg];
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const dist = Math.hypot(dx, dz);
    const cruise = this.def.speedKn * KN;
    let want = cruise;
    if (this.dwell > 0) {
      this.dwell -= dt;
      want = 0;
    } else if (dist < TRAFFIC_RULES.arriveRadius) {
      this.leg = (this.leg + 1) % this.route.length;
      this.dwell = target.stop ? this.def.dwellSeconds || 0 : 0;
    }
    if (this.dwell <= 0 && target.stop) {
      // Slow into a port stop.
      want = Math.min(want, Math.max(1, Math.sqrt(2 * 0.08 * Math.max(0, dist - TRAFFIC_RULES.arriveRadius * 0.5))));
    }
    // Give way: the player close ahead.
    const p = ctx.player;
    if (p) {
      const px = p.x - this.x;
      const pz = p.z - this.z;
      const d = Math.hypot(px, pz);
      const fx = Math.sin(this.heading);
      const fz = -Math.cos(this.heading);
      if (d < TRAFFIC_RULES.giveWayRange + h.length / 2 && (px * fx + pz * fz) / Math.max(d, 1) > TRAFFIC_RULES.giveWayCone) {
        want = Math.min(want, cruise * Math.max(0, (d - h.length) / TRAFFIC_RULES.giveWayRange));
      }
    }
    const acc = 0.25 * (12 / Math.max(12, h.length)) + 0.03;
    this.speed += Math.max(-acc * dt * 2, Math.min(acc * dt, want - this.speed));
    const bearing = Math.atan2(dx, -dz);
    const turn = ((TRAFFIC_RULES.turnDegPerSec * Math.PI) / 180) * Math.min(1.5, 12 / h.length + 0.3) * dt * Math.min(1, this.speed / 1.5 + 0.2);
    this.heading = wrap(this.heading + Math.max(-turn, Math.min(turn, wrap(bearing - this.heading))));
    const step = this.speed * dt;
    this.x += Math.sin(this.heading) * step;
    this.z -= Math.cos(this.heading) * step;
    this.travel += step;
    // Ride the waves: heave from the centre, pitch/roll from the ends/sides.
    const w = ctx.waves;
    const fx = Math.sin(this.heading);
    const fz = -Math.cos(this.heading);
    const l2 = h.length * 0.35;
    const b2 = h.beam * 0.4;
    const bow = w.heightAt(this.x + fx * l2, this.z + fz * l2);
    const stern = w.heightAt(this.x - fx * l2, this.z - fz * l2);
    const port = w.heightAt(this.x + fz * b2, this.z - fx * b2);
    const stbd = w.heightAt(this.x - fz * b2, this.z + fx * b2);
    const k = Math.min(1, dt * 2.5);
    this.y += ((bow + stern + port + stbd) / 4 - this.y) * k;
    this.pitch += (-Math.atan2(bow - stern, 2 * l2) * 0.8 - this.pitch) * k;
    this.roll += (Math.atan2(port - stbd, 2 * b2) * 0.7 - this.roll) * k;
  }
}

export class Traffic {
  constructor(game, session) {
    this.game = game;
    this.session = session;
    this.vessels = [];
    this.ready = this.build();
  }

  routeFor(def, L) {
    const shape = this.game.world.shape;
    if (def.route) {
      return def.route.map((id) => {
        const port = shape.ports.find((p) => p.id === id);
        const b = shape.berthFor(port, L);
        const at = b === port.anchorage ? b : port.zone;
        return { x: at.x, z: at.z, stop: true };
      });
    }
    const g = shape.map.fishingGrounds[def.ground];
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      // A lumpy loop, not a perfect circle.
      const r = g.r * (0.75 + 0.25 * Math.sin(i * 2.3 + def.ground));
      pts.push({ x: g.x + Math.cos(a) * r, z: g.z + Math.sin(a) * r, stop: false });
    }
    return pts;
  }

  async build() {
    const game = this.game;
    for (const def of TRAFFIC) {
      const cfg = BOATS[def.model] || TOW_TARGETS[def.model];
      const model = TARGET_MODELS[def.model] ? TARGET_MODELS[def.model](cfg) : await loadBoatModel(cfg);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = false;
        }
      });
      game.scene.add(model);
      const v = new Vessel(def, cfg, model, this.routeFor(def, cfg.hull.length), game.physics);
      // Spread them along their routes so they don't all start in port.
      v.leg = Math.floor(v.route.length * ((this.vessels.length * 0.37) % 1));
      const s = v.route[(v.leg + v.route.length - 1) % v.route.length];
      v.x = s.x;
      v.z = s.z;
      game.physics.add(v);
      this.vessels.push(v);
    }
  }

  // Visuals: pose the models and lay their wakes.
  frame() {
    for (const v of this.vessels) {
      v.model.position.set(v.x, v.y, v.z);
      v.model.quaternion.copy(v.q);
      this.wake(v);
    }
  }

  wake(v) {
    const wake = this.session.wake;
    if (!v.streams) {
      v.streams = { centre: wake.stream(WAKE.centreLife), kelvin: [wake.stream(WAKE.kelvinLife), wake.stream(WAKE.kelvinLife)], acc: 0, last: v.travel };
    }
    const st = v.streams;
    st.acc += v.travel - st.last;
    st.last = v.travel;
    const u = v.speed;
    const h = v.cfg.hull;
    const fx = Math.sin(v.heading);
    const fz = -Math.cos(v.heading);
    const spacing = WAKE.spacing * 1.5;
    while (st.acc >= spacing && u > 0.6) {
      st.acc -= spacing;
      const sx = v.x - fx * h.length * 0.5;
      const sz = v.z - fz * h.length * 0.5;
      const wk = Math.min(1, u / 4);
      st.centre.emit(sx, sz, 0, 0, h.beam * 0.24, WAKE.centreGrow, WAKE.centreStrength * wk * 0.8, 0);
      for (const [i, s] of [[0, 1], [1, -1]]) {
        const k = s * KELVIN * u;
        const bx = v.x + fx * (h.length * 0.45) + fz * s * h.beam * 0.45;
        const bz = v.z + fz * (h.length * 0.45) - fx * s * h.beam * 0.45;
        const hk = Math.min(WAKE.crestHeightPerBeam * h.beam, (WAKE.crestHeadK * u * u) / 19.62);
        st.kelvin[i].emit(bx, bz, fz * k, -fx * k, 0.7 + 0.08 * h.beam, 0.12, WAKE.kelvinStrength * wk * 0.8, 0, hk);
      }
    }
  }

  // For the chart (AIS) and jobs.
  list() {
    return this.vessels.map((v) => ({ name: v.name, kind: v.kind, x: v.x, z: v.z, heading: v.heading, length: v.cfg.hull.length }));
  }
}
