// Everything attached to the player's boat: physics + model, foam/spray
// effects, engine and sea audio, the instrument HUD, camera shake, capsize.

import * as THREE from 'three';
import { WAKE } from '../config/render.js';
import { PlayerBoat } from '../entities/PlayerBoat.js';
import { BoatEffects } from '../entities/BoatEffects.js';
import { Foam } from '../ocean/Foam.js';
import { Spray } from '../ocean/Spray.js';
import { Wake } from '../ocean/Wake.js';
import { Spindrift } from '../ocean/Spindrift.js';
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
    this.foam = new Foam(game.renderer, game.quality.foamResolution);
    Object.assign(game.ocean.uniforms, this.foam.uniforms);
    this.spray = new Spray(game.quality.sprayParticles);
    game.scene.add(this.spray.points);
    this.wake = new Wake();
    this.spindrift = new Spindrift(this.spray);
    this.effects = new BoatEffects(boat, this.foam, this.spray, this.wake);
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

  // 0..1: breaking water (shallows) within ~350 m, sampled twice a second.
  surfNearby(dt) {
    this.surfTimer = (this.surfTimer || 0) - dt;
    if (this.surfTimer > 0) {
      return this.surf || 0;
    }
    this.surfTimer = 0.5;
    const shape = this.game.world && this.game.world.shape;
    if (!shape) {
      return 0;
    }
    const p = this.sim.state.pos;
    let best = 0;
    for (let a = 0; a < 8; a++) {
      for (const r of [60, 160, 350]) {
        const x = p.x + Math.cos((a * Math.PI) / 4) * r;
        const z = p.z + Math.sin((a * Math.PI) / 4) * r;
        const d = shape.depthAt(x, z);
        if (d > -1 && d < 3) {
          best = Math.max(best, 1 - r / 420);
        }
      }
    }
    this.surf = best;
    return best;
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
      // Green spray over the wheelhouse glass (or, hard slams, the lens).
      if (g.post.lensAllowed && ((g.rig.mode === 'helm' && slamPeak > 3.5) || (g.rig.mode === 'chase' && slamPeak > 5.5))) {
        g.post.drops.splash();
      }
      this.lastSlamTime = g.renderTime;
    }
    const p = this.boat.model.position;
    this.hullWaves(p);
    this.foam.begin(dt, p.x, p.z);
    this.effects.update(dt, this.slams, g.waves);
    if (this.onPaint) {
      this.onPaint(dt);
    }
    this.wake.update(dt);
    this.wake.paint(this.foam);
    this.foam.end();
    const a = g.atmosphere;
    // Spray scatters light: sky dome + a forward-scattering sun term.
    this.sprayLight.copy(a.skyAmbient).multiplyScalar(1.5);
    this.spindrift.update(dt, g.camera, g.waves, g.weather.params.windKn, g.env.wind);
    this.spray.update(dt, g.env.wind, this.sprayLight, a.lightDir, a.sunRadiance);
    this.updateAudio(slamPeak, dt);
    this.hud.update(sim);
    this.fitShadow();
  }

  // The player's hull waves (ocean/boatWaveGLSL.js): pose and bow-wave
  // height from the stagnation head, capped by the beam.
  hullWaves(p) {
    const sim = this.sim;
    const u = Math.max(0, sim.forwardSpeed);
    const h = sim.cfg.hull;
    const f = sim.forward;
    const hb = Math.min(WAKE.bowHeightPerBeam * h.beam, (WAKE.bowHeadK * u * u) / 19.62);
    const uni = this.game.ocean.uniforms;
    const fl = Math.hypot(f.x, f.z) || 1;
    uni.uBoat.value.set(p.x, p.z, f.x / fl, f.z / fl);
    uni.uBoatHull.value.set(h.length, h.beam, u, sim.hull.capsized ? 0 : hb);
  }

  updateAudio(slamPeak, dt = 1 / 60) {
    const sim = this.sim;
    const pr = sim.propulsion;
    if (this.engine) {
      this.engine.update(pr.rpm, pr.load, pr.ventilation, pr.enabled);
    }
    if (this.sea) {
      const v = sim.state.linvel;
      const g = this.game;
      this.sea.update(Math.abs(v.y), sim.speed, g.weather.params.windKn, g.weather.params.hs, { rain: g.weather.params.rain, helm: g.rig.mode === 'helm', surf: this.surfNearby(dt) });
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
