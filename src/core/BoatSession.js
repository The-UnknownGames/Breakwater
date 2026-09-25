// Everything attached to the player's boat: physics + model, foam/spray
// effects, engine and sea audio, the instrument HUD, camera shake, capsize.

import * as THREE from 'three';
import { PlayerBoat } from '../entities/PlayerBoat.js';
import { BoatEffects } from '../entities/BoatEffects.js';
import { Foam } from '../ocean/Foam.js';
import { Spray } from '../ocean/Spray.js';
import { EngineSound } from '../audio/Engine.js';
import { SeaSound } from '../audio/SeaSound.js';
import { HUD } from '../ui/HUD.js';

const KN = 0.514444;

export class BoatSession {
  static async create(game, cfg, spawn) {
    const boat = await PlayerBoat.create(game.physics, cfg, spawn);
    return new BoatSession(game, boat);
  }

  constructor(game, boat) {
    this.game = game;
    this.boat = boat;
    this.cfg = boat.cfg;
    game.scene.add(boat.model);
    this.foam = new Foam(game.renderer);
    Object.assign(game.ocean.uniforms, this.foam.uniforms);
    this.spray = new Spray();
    game.scene.add(this.spray.points);
    this.effects = new BoatEffects(boat, this.foam, this.spray);
    this.hud = new HUD();
    this.sprayLight = new THREE.Color();
    this.engine = null;
    this.sea = null;
    game.audio.onReady((a) => {
      this.engine = new EngineSound(a, this.cfg.id);
      this.sea = new SeaSound(a);
    });
    boat.sim.hull.onCapsize = () => this.hud.showBanner('Capsized');
    this.slams = [];
    this.lastSlamTime = -99;
  }

  get sim() {
    return this.boat.sim;
  }

  fixed(dt, input) {
    this.boat.control(dt, input);
  }

  frame(dt, alpha) {
    const g = this.game;
    const sim = this.sim;
    this.slams.length = 0;
    this.slams.push(...sim.slamEvents);
    sim.slamEvents.length = 0;
    let slamPeak = 0;
    for (const s of this.slams) {
      slamPeak = Math.max(slamPeak, s.speed);
    }
    if (slamPeak > 0) {
      g.rig.addShake(Math.min(0.3, (slamPeak - 2.5) * 0.05));
      this.lastSlamTime = g.renderTime;
    }
    const p = this.boat.model.position;
    this.foam.begin(dt, p.x, p.z);
    this.effects.update(dt, this.slams, g.waves);
    if (this.onPaint) {
      this.onPaint(dt);
    }
    this.foam.end();
    const a = g.atmosphere;
    // Spray scatters light: sky dome + a forward-scattering sun term.
    this.sprayLight.copy(a.skyAmbient).multiplyScalar(1.5);
    this.spray.update(dt, g.env.wind, this.sprayLight, a.lightDir, a.sunRadiance);
    this.updateAudio(slamPeak);
    this.hud.update(sim);
    this.fitShadow();
  }

  updateAudio(slamPeak) {
    const sim = this.sim;
    const pr = sim.propulsion;
    if (this.engine) {
      this.engine.update(pr.rpm, pr.load, pr.ventilation, pr.enabled);
    }
    if (this.sea) {
      const v = sim.state.linvel;
      this.sea.update(Math.abs(v.y), sim.speed, this.game.weather.params.windKn, this.game.weather.params.hs);
      if (slamPeak > 3) {
        this.sea.slam(slamPeak);
      }
    }
  }

  // Tight directional shadow around the boat (spec 2.4).
  fitShadow() {
    const light = this.game.atmosphere.sunLight;
    if (!light.castShadow) {
      return;
    }
    const p = this.boat.model.position;
    light.target.position.copy(p);
    light.position.copy(p).addScaledVector(this.game.atmosphere.lightDir, 60);
  }

  snapshot() {
    const sim = this.sim;
    const s = sim.state;
    return {
      boat: this.cfg.id,
      model: this.boat.model.userData.source,
      pos: [s.pos.x, s.pos.y, s.pos.z],
      vel: [s.linvel.x, s.linvel.y, s.linvel.z],
      speedKn: sim.speed / KN,
      heading: (sim.heading * 180) / Math.PI,
      heel: (sim.hull.heel * 180) / Math.PI,
      pitch: (sim.hull.pitch * 180) / Math.PI,
      throttle: sim.input.throttle,
      rpm: sim.propulsion.rpm,
      rudder: (sim.propulsion.rudder * 180) / Math.PI,
      ventilation: sim.propulsion.ventilation,
      flood: sim.hull.flood,
      integrity: sim.hull.integrity,
      fuel: sim.hull.fuel,
      capsized: sim.hull.capsized,
      buoyancyPoints: sim.buoyancy.points.length,
      submerged: sim.buoyancy.submergedVolume,
      sprayParticles: this.spray.alive,
      slamAge: this.game.renderTime - this.lastSlamTime,
    };
  }
}
