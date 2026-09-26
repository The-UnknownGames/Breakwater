// Game root: ocean/sky world, the player's Marlin with full physics, and
// towing / rescue operations (V3). States (title, career, paused) arrive in V4.

import * as THREE from 'three';
import { createRenderer } from '../render/Renderer.js';
import { PostFX } from '../render/PostFX.js';
import { CameraRig } from '../render/CameraRig.js';
import { Loop, FIXED_DT } from './Loop.js';
import { Input } from './Input.js';
import { Events } from './Events.js';
import { Waves, MAX_WAVES } from '../ocean/Waves.js';
import { OceanMesh } from '../ocean/OceanMesh.js';
import { createDetailMaps } from '../ocean/DetailMaps.js';
import { SkySystem } from '../sky/Sky.js';
import { DayNight } from '../sky/DayNight.js';
import { Weather } from '../sky/Weather.js';
import { Atmosphere } from '../sky/Atmosphere.js';
import { Rain } from '../sky/Rain.js';
import { Lightning } from '../sky/Lightning.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { Environment } from '../physics/Environment.js';
import { AudioSystem } from '../audio/Audio.js';
import { BoatSession } from './BoatSession.js';
import { OpsSession } from './OpsSession.js';
import { World } from '../world/World.js';
import { DynamicResolution, guardContextLoss } from '../render/Resilience.js';
import { WEATHER } from '../config/weather.js';
import { QUALITY, DEFAULT_QUALITY } from '../config/quality.js';
import { BOATS } from '../config/boats.js';
import { fogUniforms } from '../render/fogGLSL.js';

export class Game {
  static async create(container, options, R) {
    const game = new Game(container, options, R);
    const cfg = BOATS[options.boat] || BOATS.marlin;
    // Careers start at the Kettle Harbor berth; debug/test views at sea.
    const home = game.world.ports.find((p) => p.home);
    const spawn = options.spawn === 'harbor' ? { x: home.dock.x, z: home.dock.z, heading: options.heading ?? home.dock.heading } : { x: 0, z: 0, heading: options.heading ?? 0.35 };
    game.session = await BoatSession.create(game, cfg, spawn);
    game.ops = new OpsSession(game, game.session, { autoTension: options.autoTension });
    game.session.onPaint = (dt) => game.ops.paintTargets(dt);
    for (const name of options.scenario || []) {
      game.ops.spawn(name);
    }
    game.rig.attachOrbitTo(game.session.boat);
    game.rig.setMode(options.camera || 'chase');
    return game;
  }

  constructor(container, options, R) {
    this.options = options;
    this.qualityName = QUALITY[options.quality] ? options.quality : DEFAULT_QUALITY;
    this.quality = QUALITY[this.qualityName];
    this.events = new Events();
    this.input = new Input();
    this.renderer = createRenderer(container, this.quality);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x888888, 0.0005);
    this.rig = new CameraRig(this.renderer.domElement);
    this.camera = this.rig.camera;
    this.camera.layers.enable(1);
    this.audio = new AudioSystem();

    this.weather = new Weather(options.seaState || 'calm');
    this.dayNight = new DayNight(options.hour);
    this.timeFrozen = Boolean(options.freezeTime);
    this.waves = new Waves(WEATHER.waveSeed);
    this.waves.setParams(this.weather.params);
    this.env = new Environment();
    this.physics = new PhysicsWorld(R, FIXED_DT);
    this.physicsCtx = { waves: this.waves, env: this.env, time: 0, seabed: null };

    this.ocean = new OceanMesh(this.quality.oceanGrid, createDetailMaps());
    this.scene.add(this.ocean.mesh);
    this.skySystem = new SkySystem(this.renderer, this.scene, this.quality);
    this.ocean.uniforms.uEnv.value = this.skySystem.envMap;
    this.world = new World(this, { coarse: this.qualityName === 'low' });
    this.seabed = this.world.depth;
    this.physicsCtx.seabed = this.seabed;
    this.waves.shelters = this.world.shape.shelters;
    this.waves.packShelters(this.ocean.uniforms.uShelter.value);
    for (const [k, v] of Object.entries(this.world.uniforms)) {
      this.ocean.uniforms[k].value = v.value;
    }
    this.atmosphere = new Atmosphere(this.scene);
    this.setupShadows();
    this.rain = new Rain(this.quality.rainCount);
    this.scene.add(this.rain.mesh);
    this.lightning = new Lightning(this.scene);
    this.post = new PostFX(this.renderer, this.scene, this.camera, this.quality);
    this.session = null;
    this.ops = null;

    this.renderTime = 0;
    this.loop = new Loop({
      fixed: (dt) => this.fixedUpdate(dt),
      render: (dt, alpha) => this.renderFrame(dt, alpha),
    });
    this.input.on('KeyC', () => this.rig.cycle());
    guardContextLoss(this);
    this.dynamicRes = options.dynamicRes ? new DynamicResolution(this) : null;
    window.addEventListener('resize', () => this.resize());
  }

  setupShadows() {
    const light = this.atmosphere.sunLight;
    light.castShadow = this.quality.shadows;
    const size = this.quality.shadowSize || 2048;
    light.shadow.mapSize.set(size, size);
    const c = light.shadow.camera;
    c.left = -14;
    c.right = 14;
    c.top = 14;
    c.bottom = -14;
    c.near = 1;
    c.far = 140;
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.03;
  }

  start() {
    this.atmosphere.apply(this.dayNight, this.weather, 0, { ocean: this.ocean, clouds: this.skySystem.clouds });
    this.loop.start();
  }

  setSeaState(id, immediate = false) {
    this.weather.setState(id, immediate);
    this.skySystem.forceRefresh = true;
  }

  fixedUpdate(dt) {
    this.weather.update(dt);
    this.env.update(dt, this.weather.params);
    const anchor = this.session ? this.session.sim.state.pos : this.camera.position;
    this.waves.setAnchor(anchor.x, anchor.z);
    if (this.weather.transitioning || this.weather.params.id !== this.lastWaveState) {
      this.waves.setParams(this.weather.params);
      this.lastWaveState = this.weather.params.id;
    }
    this.waves.update(dt);
    if (this.session) {
      this.session.fixed(dt, this.input);
    }
    if (this.ops) {
      this.ops.fixed(dt, this.input);
    }
    this.input.endFrame();
    this.physicsCtx.time = this.waves.time;
    this.physics.step(this.physicsCtx);
    if (!this.timeFrozen) {
      this.dayNight.update(dt);
    }
  }

  renderFrame(dt, alpha) {
    this.renderTime += dt;
    this.renderer.info.reset();
    const u = this.ocean.uniforms;
    this.waves.packUniforms(u.uWaveA.value, u.uWaveB.value);
    u.uWaveTau.value = -(1 - alpha) * FIXED_DT;
    u.uTime.value = this.renderTime % 3600;
    u.uMaxAmp.value = this.waves.maxAmplitude;

    const p = this.weather.params;
    this.lightning.update(dt, p.lightning, this.camera);
    const targets = { ocean: this.ocean, clouds: this.skySystem.clouds };
    this.atmosphere.apply(this.dayNight, this.weather, this.lightning.flash, targets, dt);
    this.scene.fog.color.copy(fogUniforms.uFogColor.value);
    this.scene.fog.density = fogUniforms.uFogDensity.value;
    let speedRatio = 0;
    if (this.session) {
      const sim = this.session.sim;
      speedRatio = Math.min(1, sim.speed / (sim.cfg.targets.topSpeedKn * 0.514444));
      this.session.boat.updateVisual(dt, alpha);
    }
    this.rig.update(dt, this.waves, this.session ? this.session.boat : null, speedRatio);
    if (this.session) {
      this.session.frame(dt, alpha);
    }
    if (this.ops) {
      this.ops.frame(dt, alpha);
    }
    this.ocean.follow(this.camera);
    this.world.update(dt, this.waves, 1 - this.dayNight.dayFactor);
    this.skySystem.clouds.update(dt, this.atmosphere.windTravel, p.windKn, this.camera);
    this.skySystem.update(dt, this.camera, this.dayNight.sunDir, p.turbidity);
    this.rain.update(dt, this.camera, p.rain, this.atmosphere.windTravel, p.windKn, this.atmosphere.skyAmbient);
    this.renderer.toneMappingExposure = this.atmosphere.exposure;
    this.post.setGrade(this.atmosphere.saturation, this.atmosphere.contrast);
    this.post.render();
    if (this.dynamicRes) {
      this.dynamicRes.update(dt);
    }
    this.events.emit('frame', dt);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.rig.resize(w, h);
    this.post.setSize(w, h);
  }

  // Snapshot for tests and the debug overlay (spec 16).
  snapshot() {
    const info = this.renderer.info.render;
    return {
      seaState: this.weather.params.id,
      seaStateTarget: this.weather.state.id,
      transitioning: this.weather.transitioning,
      hour: this.dayNight.hour,
      sunElevation: this.dayNight.elevationDeg,
      waveCount: Math.min(MAX_WAVES, this.waves.comps.length),
      physicsWaves: this.waves.physicsCount,
      waveTime: this.waves.time,
      fps: this.loop.fps,
      frameMs: this.loop.frameMs,
      physicsMs: this.physics.stepMs,
      drawCalls: info.calls,
      triangles: info.triangles,
      quality: this.qualityName,
      camera: this.camera.position.toArray(),
      cameraMode: this.rig.mode,
      ...(this.session ? this.session.snapshot() : {}),
      ...(this.ops ? this.ops.snapshot() : {}),
    };
  }
}
