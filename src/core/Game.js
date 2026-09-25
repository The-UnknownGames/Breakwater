// Game root. V1: ocean + sky sandbox with weather and day/night.
// States (title, career, paused) arrive in V4.

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
import { WEATHER } from '../config/weather.js';
import { QUALITY, DEFAULT_QUALITY } from '../config/quality.js';

export class Game {
  constructor(container, options = {}) {
    this.options = options;
    this.qualityName = QUALITY[options.quality] ? options.quality : DEFAULT_QUALITY;
    this.quality = QUALITY[this.qualityName];
    this.events = new Events();
    this.input = new Input();
    this.renderer = createRenderer(container, this.quality);
    this.scene = new THREE.Scene();
    this.rig = new CameraRig(this.renderer.domElement);
    this.camera = this.rig.camera;
    this.camera.layers.enable(1);

    this.weather = new Weather(options.seaState || 'calm');
    this.dayNight = new DayNight(options.hour);
    this.timeFrozen = Boolean(options.freezeTime);
    this.waves = new Waves(WEATHER.waveSeed);
    this.waves.setParams(this.weather.params);

    this.ocean = new OceanMesh(this.quality.oceanGrid, createDetailMaps());
    this.scene.add(this.ocean.mesh);
    this.skySystem = new SkySystem(this.renderer, this.scene, this.quality);
    this.ocean.uniforms.uEnv.value = this.skySystem.envMap;
    this.atmosphere = new Atmosphere(this.scene);
    this.rain = new Rain(this.quality.rainCount);
    this.scene.add(this.rain.mesh);
    this.lightning = new Lightning(this.scene);
    this.post = new PostFX(this.renderer, this.scene, this.camera, this.quality);

    this.renderTime = 0;
    this.loop = new Loop({
      fixed: (dt) => this.fixedUpdate(dt),
      render: (dt, alpha) => this.renderFrame(dt, alpha),
    });
    window.addEventListener('resize', () => this.resize());
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
    const cam = this.camera.position;
    this.waves.setAnchor(cam.x, cam.z);
    if (this.weather.transitioning || this.weather.params.id !== this.lastWaveState) {
      this.waves.setParams(this.weather.params);
      this.lastWaveState = this.weather.params.id;
    }
    this.waves.update(dt);
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

    this.rig.update(this.waves);
    this.ocean.follow(this.camera);
    const p = this.weather.params;
    this.lightning.update(dt, p.lightning, this.camera);
    const targets = { ocean: this.ocean, clouds: this.skySystem.clouds };
    this.atmosphere.apply(this.dayNight, this.weather, this.lightning.flash, targets, dt);
    this.skySystem.clouds.update(dt, this.atmosphere.windTravel, p.windKn, this.camera);
    this.skySystem.update(dt, this.camera, this.dayNight.sunDir, p.turbidity);
    this.rain.update(dt, this.camera, p.rain, this.atmosphere.windTravel, p.windKn, this.atmosphere.skyAmbient);
    this.renderer.toneMappingExposure = this.atmosphere.exposure;
    this.post.setGrade(this.atmosphere.saturation, this.atmosphere.contrast);
    this.post.render();
    this.input.endFrame();
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
      physicsMs: this.loop.fixedMs,
      drawCalls: info.calls,
      triangles: info.triangles,
      quality: this.qualityName,
      camera: this.camera.position.toArray(),
    };
  }
}
