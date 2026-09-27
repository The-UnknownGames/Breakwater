// Browser side of towing and rescue: turns keys into Operations commands
// (Space, Q/Z, E), and drives the visuals (tow targets, rope, survivors,
// rafts), sounds and HUD from the pure-JS Operations state.

import * as THREE from 'three';
import { Operations } from '../gameplay/Operations.js';
import { RopeVisual } from '../physics/RopeVisual.js';
import { SurvivorViews } from '../entities/SurvivorViews.js';
import { BoatEffects } from '../entities/BoatEffects.js';
import { TARGET_MODELS } from '../entities/models/TargetModels.js';
import { loadBoatModel } from '../entities/models/Models.js';
import { Sfx } from '../audio/Sfx.js';
import { TOW } from '../config/tow.js';
import { RESCUE } from '../config/rescue.js';

const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion();

function poseModel(model, sim, alpha) {
  const p0 = sim.prev.pos;
  const p1 = sim.state.pos;
  model.position.set(p0.x + (p1.x - p0.x) * alpha, p0.y + (p1.y - p0.y) * alpha, p0.z + (p1.z - p0.z) * alpha);
  q0.set(sim.prev.rot.x, sim.prev.rot.y, sim.prev.rot.z, sim.prev.rot.w);
  q1.set(sim.state.rot.x, sim.state.rot.y, sim.state.rot.z, sim.state.rot.w);
  model.quaternion.slerpQuaternions(q0, q1, alpha);
}

export class OpsSession {
  constructor(game, session, opts = {}) {
    this.game = game;
    this.session = session;
    this.ops = new Operations(game.physics, session.sim, { autoTension: opts.autoTension, seaState: game.weather.state.id });
    this.views = new Map();
    this.ropes = [];
    this.rope = null;
    this.survivors = new SurvivorViews(game.scene, this.ops.field);
    this.sfx = null;
    game.audio.onReady((a) => {
      this.sfx = new Sfx(a);
    });
    // Thunder follows each strike by its distance.
    game.lightning.onStrike = (s) => this.sfx?.thunder(Math.hypot(s.position.x - game.camera.position.x, s.position.z - game.camera.position.z));
    this.a = new THREE.Vector3();
    this.b = new THREE.Vector3();
    this.cmd = { tow: 0, winch: 0, action: 0 };
  }

  get hud() {
    return this.session.hud;
  }

  // Fixed step: read the helm keys, advance the rules.
  fixed(dt, input) {
    const cmd = this.cmd;
    cmd.tow = input.consume('Space');
    cmd.chain = input.consume('KeyF');
    cmd.action = input.consume('KeyE');
    cmd.winch = (input.isDown('KeyQ') ? 1 : 0) - (input.isDown('KeyZ') ? 1 : 0);
    const g = this.game;
    const ops = this.ops;
    // E with nothing to act on here goes to the career (port services).
    const idle = cmd.action && !ops.pull && !ops.transfer && !ops.pullCandidate() && !ops.crewCandidate() && !ops.hoseCandidate();
    ops.seaState = g.weather.state.id;
    ops.step(dt, cmd, g.waves, g.waves.time, g.env);
    if (idle && this.onAction) {
      this.onAction();
    }
  }

  // Scenario spawner (F8 / URL / touch page). Positions are relative to
  // the player: `ahead` metres along the heading, `side` to starboard.
  spawn(name) {
    const sim = this.session.sim;
    const p = sim.state.pos;
    const f = sim.forward;
    const at = (ahead, side = 0) => ({ x: p.x + f.x * ahead - f.z * side, z: p.z + f.z * ahead + f.x * side });
    const hdg = sim.heading;
    const ops = this.ops;
    if (name === 'trawler') {
      const q = at(70, 10);
      ops.addTarget('trawler', q.x, q.z, hdg + 1.3);
    } else if (name === 'sailboat') {
      const q = at(60, -12);
      ops.addTarget('sailboat', q.x, q.z, hdg - 1.1);
    } else if (name === 'sinking') {
      const q = at(80, 0);
      ops.addTarget('trawler', q.x, q.z, hdg + 2.2, { leak: 1.6 });
    } else if (name === 'survivors') {
      for (const [a, s] of [
        [45, -6],
        [62, 8],
        [80, -2],
      ]) {
        const q = at(a, s);
        ops.addSurvivor(q.x, q.z);
      }
    } else if (name === 'raft') {
      const q = at(65, 6);
      ops.addRaft(q.x, q.z, 4);
    } else if (name === 'repair') {
      sim.hull.repair();
      sim.propulsion.enabled = true;
      sim.payload = 0;
      ops.aboard = 0;
      this.hud.toast('Repaired and refuelled at port', 'ok');
      return;
    } else if (name === 'clear') {
      ops.clear();
      return;
    } else {
      return;
    }
    this.hud.toast(`Spawned: ${name}`, 'ok', 2);
  }

  syncTargets() {
    const scene = this.game.scene;
    for (const t of this.ops.targets) {
      if (!this.views.has(t)) {
        const view = { model: null, effects: null, cleat: null };
        const place = (model) => {
          view.model = model;
          view.cleat = model.getObjectByName('bowCleat');
          scene.add(model);
        };
        if (TARGET_MODELS[t.kind]) {
          place(TARGET_MODELS[t.kind](t.cfg));
        } else {
          // One of the player's own boats (a fleet breakdown): its own model.
          place(new THREE.Group());
          loadBoatModel(t.cfg).then((m) => {
            if (this.views.get(t) === view) {
              scene.remove(view.model);
              place(m);
            }
          });
        }
        view.effects = new BoatEffects({ sim: t.sim }, this.session.foam, this.session.spray, this.session.wake);
        this.views.set(t, view);
      }
    }
    for (const [t, v] of this.views) {
      if (!this.ops.targets.includes(t)) {
        scene.remove(v.model);
        this.views.delete(t);
      }
    }
  }

  // Render frame (after the player's session.frame, which owns the foam pass).
  frame(dt, alpha) {
    const ops = this.ops;
    const g = this.game;
    this.syncTargets();
    for (const [t, v] of this.views) {
      poseModel(v.model, t.sim, alpha);
      // Wrecks that went down are gone once they're well under.
      if (t.sim.hull.foundered && t.sim.state.pos.y < -12) {
        ops.removeTarget(t);
      }
    }
    this.events();
    this.updateRopes(dt);
    this.survivors.update(dt, g.waves, this.session.boat.model, ops.pull, this.session.cfg.hull, RESCUE.pullSeconds);
    const line = ops.line;
    if (this.sfx) {
      this.sfx.update(dt, line ? line.ratio : 0, this.session.sim.hull.scrape);
    }
    if (line && line.ratio > TOW.warnRatio) {
      g.rig.addShake(Math.min(0.02, (line.ratio - TOW.warnRatio) * 0.03) * dt * 60);
    }
    const prompt = ops.prompt() || (this.extraPrompt ? this.extraPrompt() : null);
    this.hud.setPrompt(prompt);
    this.hud.updateOps(dt, ops, this.objectiveTarget ? this.objectiveTarget() : null);
  }

  // Effects for targets' hull foam run inside the player's foam pass.
  paintTargets(dt) {
    for (const [t, v] of this.views) {
      const slams = t.sim.slamEvents.splice(0);
      v.effects.update(dt, slams, this.game.waves);
    }
  }

  events() {
    const hud = this.hud;
    for (const e of this.ops.events.splice(0)) {
      if (e.type === 'attach') {
        hud.toast('Line made fast', 'ok', 2);
        this.sfx?.clunk();
      } else if (e.type === 'release') {
        hud.toast('Line cast off', 'ok', 2);
        this.rope?.release(0);
        this.rope = null;
      } else if (e.type === 'break') {
        hud.toast(`Line parted · ${(e.tension / 1000).toFixed(0)} kN`, 'crit', 4);
        this.sfx?.snap();
        this.game.rig.addShake(0.3);
        this.rope?.release(e.tension / 1000);
        this.rope = null;
      } else if (e.type === 'rescued') {
        hud.toast(`Survivor aboard · ${this.ops.aboard}/${this.ops.capacity}`, 'ok', 2.5);
        this.sfx?.splash();
      } else if (e.type === 'lost') {
        hud.toast('Survivor lost to the cold', 'crit', 4);
      } else if (e.type === 'full') {
        hud.toast('No room aboard', 'warn', 2);
      } else if (e.type === 'founder') {
        hud.toast(`${e.target.cfg.name} is going down`, 'crit', 4);
      } else if (e.type === 'chain') {
        hud.toast(`Container chained · ${e.count} in tow`, 'ok', 2.5);
      } else if (e.type === 'chainBreak') {
        hud.toast('Chain strop parted', 'crit', 3);
      } else if (e.type === 'hose') {
        hud.toast('Pump hose across', 'ok', 2);
      }
    }
  }

  updateRopes(dt) {
    const ops = this.ops;
    const g = this.game;
    if (ops.line && !this.rope) {
      this.rope = new RopeVisual();
      this.rope.line = ops.line;
      this.ropes.push(this.rope);
      g.scene.add(this.rope.mesh);
    }
    this.session.boat.worldPoint('towPoint', this.a);
    for (const r of this.ropes) {
      const line = r.line;
      const v = this.views.get(ops.lineTarget);
      if (!r.freeEnd && v && v.cleat) {
        v.cleat.getWorldPosition(this.b);
      }
      r.update(dt, this.a, this.b, line.length, r.freeEnd ? 0 : line.tension, g.waves, g.camera.position, this.session.spray);
    }
    for (const r of this.ropes.filter((x) => !x.alive)) {
      g.scene.remove(r.mesh);
      r.dispose();
      this.ropes.splice(this.ropes.indexOf(r), 1);
    }
    // Daisy-chain strops between containers (ends from the link's own
    // world points).
    this.chainRopes = this.chainRopes || new Map();
    for (const c of ops.chain) {
      if (!this.chainRopes.has(c)) {
        const r = new RopeVisual();
        this.chainRopes.set(c, r);
        g.scene.add(r.mesh);
      }
      const l = c.line;
      this.chainRopes.get(c).update(dt, l.pa, l.pb, l.length, l.tension, g.waves, g.camera.position, this.session.spray);
    }
    for (const [c, r] of this.chainRopes) {
      if (!ops.chain.includes(c)) {
        g.scene.remove(r.mesh);
        r.dispose();
        this.chainRopes.delete(c);
      }
    }
  }

  snapshot() {
    const ops = this.ops;
    const line = ops.line;
    return {
      towing: Boolean(line),
      towTarget: line ? ops.lineTarget.id : null,
      towTension: line ? line.tension : 0,
      towRatio: line ? line.ratio : 0,
      towLength: line ? line.length : 0,
      targets: ops.targets.map((t) => ({ id: t.id, pos: [t.sim.state.pos.x, t.sim.state.pos.y, t.sim.state.pos.z], flood: t.sim.hull.flood })),
      survivorsAboard: ops.aboard,
      survivorsWaiting: ops.field.waiting().length,
      survivorsLost: ops.field.survivors.filter((s) => s.state === 'lost').length,
      prompt: ops.prompt(),
    };
  }
}
