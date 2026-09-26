// Debug tools (spec 16), enabled with ?debug=1.
// F3 overlay, F6 cycle sea state, F7 +3 h, F8 scenario spawner, F9 buoyancy
// points, window.__game for tests (spawn() works without ?debug too, for the
// touch test page).

import * as THREE from 'three';
import { Autopilot } from '../gameplay/Autopilot.js';
import { BOATS } from '../config/boats.js';
import { loadBoatModel } from '../entities/models/Models.js';
import { TutorialSession } from '../core/TutorialSession.js';

const SCENARIOS = [
  ['trawler', 'Disabled trawler (25 t)'],
  ['sailboat', 'Dismasted sailboat'],
  ['sinking', 'Trawler taking on water'],
  ['survivors', 'Three people in the water'],
  ['raft', 'Life raft, four aboard'],
  ['repair', 'Repair + refuel (port stub)'],
  ['clear', 'Clear scenario'],
];

export class Debug {
  constructor(game, enabled) {
    this.game = game;
    this.enabled = enabled;
    this.overlay = document.createElement('pre');
    this.overlay.className = 'debug-overlay';
    this.overlay.hidden = true;
    document.body.appendChild(this.overlay);
    window.__game = {
      game,
      state: () => game.snapshot(),
      setSeaState: (id, immediate = true) => game.setSeaState(id, immediate),
      setHour: (h) => game.dayNight.setHour(h),
      // hold: freeze the flash at this level (0 = normal decay) for screenshots.
      // Fast-forward the simulation without rendering (test/screenshot setup).
      advance: (seconds) => {
        const n = Math.round(seconds * 60);
        for (let i = 0; i < n; i++) {
          game.fixedUpdate(1 / 60);
        }
        if (game.session) {
          game.session.sim.slamEvents.length = 0;
        }
      },
      // Orbit camera framing relative to the boat: compass bearing from the
      // boat (deg, relative to its heading), distance and height (m).
      view: (bearing, dist = 14, height = 4) => {
        const s = game.session;
        if (!s) {
          return;
        }
        s.boat.updateVisual(0, 1);
        const p = s.sim.state.pos;
        const b = s.sim.heading + (bearing * Math.PI) / 180;
        const pos = new THREE.Vector3(p.x + Math.sin(b) * dist, p.y + height, p.z - Math.cos(b) * dist);
        const dir = new THREE.Vector3(p.x, p.y + 1, p.z).sub(pos).normalize();
        game.rig.setMode('orbit');
        game.rig.lookAlong(pos, dir);
        game.rig.controls.target.set(p.x, p.y + 1, p.z);
        game.rig.controls.update();
      },
      // Frame the tow: camera abeam of the midpoint between the two hulls.
      viewTow: (bearing = -90, dist = 40, height = 8) => {
        const o = game.ops.ops;
        const t = o.lineTarget || o.targets[0];
        if (!t) {
          return;
        }
        game.session.boat.updateVisual(0, 1);
        const a = o.player.state.pos;
        const c = t.sim.state.pos;
        const m = new THREE.Vector3((a.x + c.x) / 2, 1, (a.z + c.z) / 2);
        const b = o.player.heading + (bearing * Math.PI) / 180;
        const pos = new THREE.Vector3(m.x + Math.sin(b) * dist, height, m.z - Math.cos(b) * dist);
        game.rig.setMode('orbit');
        game.rig.lookAlong(pos, m.clone().sub(pos).normalize());
        game.rig.controls.target.copy(m);
        game.rig.controls.update();
      },
      // Test setup: put the player at (x, z) at rest, compass heading in deg.
      place: (x, z, headingDeg = 0) => {
        const sim = game.session.sim;
        const h = (headingDeg * Math.PI) / 180;
        const b = sim.body;
        b.setTranslation({ x, y: 0, z }, true);
        b.setRotation({ x: 0, y: Math.sin((Math.PI - h) / 2), z: 0, w: Math.cos((Math.PI - h) / 2) }, true);
        b.setLinvel({ x: 0, y: 0, z: 0 }, true);
        b.setAngvel({ x: 0, y: 0, z: 0 }, true);
        sim.readState();
        sim.copyPrev();
        game.session.boat.throttleLever = 0;
      },
      // Put the nearest waiting survivor 2 m off the starboard side.
      setupPickup: () => {
        const o = game.ops.ops;
        const s = o.field.waiting()[0];
        if (!s) {
          return;
        }
        const st = o.player.state;
        const f = o.player.forward;
        const half = o.player.cfg.hull.beam / 2 + 2;
        s.x = st.pos.x - f.z * half - f.x * 1.5;
        s.z = st.pos.z + f.x * half - f.z * 1.5;
      },
      // Same framing as the ?look=&camY= URL options (orbit, 30 m out).
      look: (deg, camY = 6) => {
        const b = (deg * Math.PI) / 180;
        const pos = new THREE.Vector3(-Math.sin(b) * 30, camY, Math.cos(b) * 30);
        game.rig.setMode('orbit');
        game.rig.lookAlong(pos, new THREE.Vector3(Math.sin(b), -0.04, -Math.cos(b)).normalize());
      },
      hideToast: () => {
        game.session.hud.toastEl.hidden = true;
      },
      // Screenshot setup: pause, step the sim until the hull slams, then
      // play `after` seconds at 15 fps so the spray is in the air.
      stepToSlam: (maxSeconds = 40, after = 0.45, minSpeed = 4) => {
        game.loop.running = false;
        const sim = game.session.sim;
        let hit = 0;
        for (let i = 0; i < maxSeconds * 60 && !hit; i++) {
          game.fixedUpdate(1 / 60);
          for (const e of sim.slamEvents) {
            hit = Math.max(hit, e.speed >= minSpeed ? e.speed : 0);
          }
        }
        for (let t = 0; t < after; t += 1 / 15) {
          for (let k = 0; k < 4; k++) {
            game.fixedUpdate(1 / 60);
          }
          game.renderFrame(1 / 15, 0);
        }
        return hit;
      },
      // Draw one frame without advancing time (for a paused loop).
      render: () => game.renderFrame(0, 0),
      spawn: (name) => game.ops && game.ops.spawn(name),
      // Screenshot setup (spec 0.2 allows debug placement to reach a shot):
      // put the first target astern on `length` m of line, made fast.
      setupTow: (length = 30, attach = true) => {
        const o = game.ops.ops;
        const t = o.targets[0];
        const s = o.player.state;
        const f = o.player.forward;
        const gap = length + (o.player.cfg.hull.length + t.cfg.hull.length) / 2 - 2;
        t.sim.body.setTranslation({ x: s.pos.x - f.x * gap, y: 0, z: s.pos.z - f.z * gap }, true);
        t.sim.body.setRotation(s.rot, true);
        t.sim.body.setLinvel(s.linvel, true);
        t.sim.readState();
        t.sim.copyPrev();
        if (attach) {
          o.attach(t);
          o.line.length = o.line.setLength = length;
        }
      },
      // Test setup: back to the berth and start the guided first job.
      startTutorial: () => {
        const c = game.career;
        if (c.jobs.active) {
          c.jobs.abandon();
        }
        game.ops.ops.clear();
        c.returnToBerth();
        c.career.tutorialDone = false;
        c.tutorial = new TutorialSession(c);
        return c.prompt();
      },
      // Verify (spec 17.2): drive the tutorial job with the autopilot helper
      // (the same one the headless tests use) until the line is passed.
      // Paused and stepped; returns what happened.
      tutorialToAttach: (maxSeconds = 400) => {
        const c = game.career;
        const t = c.tutorial;
        const o = game.ops.ops;
        const target = t.job.target;
        const boat = game.session.boat;
        const sim = game.session.sim;
        const ap = new Autopilot(sim);
        const home = c.shape.ports.find((p) => p.home);
        // Out through the harbor mouth (past the mole head at along 30,
        // out 150 in the harbor frame) and down the buoyed channel.
        const route = [
          [60, 100],
          [65, 190],
          [0, 260],
          [0, 400],
        ].map(([a, d]) => ({ x: home.center.x + home.along.x * a + home.out.x * d, z: home.center.z + home.along.z * a + home.out.z * d }));
        let leg = 0;
        let phase = 'channel';
        const log = { steps: [] };
        const mark = (s) => log.steps.push(`${s}@${Math.round(t0)}`);
        let t0 = 0;
        game.loop.running = false;
        boat.throttleLever = 0.5;
        game.fixedUpdate(1 / 60);
        mark(t.step);
        boat.driver = (dt) => {
          const tp = target.sim.state.pos;
          const fwd = target.sim.forward;
          if (phase === 'channel') {
            if (ap.update(dt, route[leg], { cruiseKn: 6, arriveKn: 4, stopDist: 20 }) < 40) {
              leg++;
              phase = leg < route.length ? 'channel' : 'approach';
            }
          } else if (phase === 'approach') {
            // Ahead of her on her own heading, then back down onto her bow.
            const lead = target.cfg.hull.length / 2 - 0.6 + sim.cfg.hull.length / 2 - 1.3 + 3;
            const p1 = { x: tp.x + fwd.x * (lead + 30), z: tp.z + fwd.z * (lead + 30) };
            if (ap.update(dt, p1, { cruiseKn: 8, arriveKn: 3, stopDist: 8, creep: true }) < 12) {
              phase = 'align';
            }
          } else if (phase === 'align') {
            ap.update(dt, { x: tp.x + fwd.x * 90, z: tp.z + fwd.z * 90 }, { cruiseKn: 3, arriveKn: 3 });
            if (Math.abs(Math.atan2(Math.sin(sim.heading - target.sim.heading), Math.cos(sim.heading - target.sim.heading))) < 0.15) {
              phase = 'back';
            }
          } else {
            const me = sim.state.pos;
            ap.backDown(dt, target.sim.heading, (me.x - tp.x) * fwd.z - (me.z - tp.z) * fwd.x);
            const cand = o.attachCandidate();
            if (cand.target === target && cand.distance < 7.5 && sim.speed / 0.514444 < 3) {
              game.input.pressed.set('Space', 1);
            }
          }
        };
        const n = maxSeconds * 60;
        let last = t.step;
        for (let i = 0; i < n && !o.line; i++) {
          game.fixedUpdate(1 / 60);
          t0 = i / 60;
          if (t.step !== last) {
            last = t.step;
            mark(t.step);
          }
        }
        boat.driver = null;
        boat.throttleLever = 0;
        log.attached = o.lineTarget === target;
        log.step = t.step;
        log.seconds = Math.round(t0);
        log.prompt = c.prompt();
        game.loop.start();
        return log;
      },
      scenarios: SCENARIOS.map((x) => x[0]),
      boats: Object.values(BOATS).map((b) => ({ id: b.id, name: b.name, role: b.role })),
      // Test: build a boat's model (no physics); resolves to its mesh count.
      buildModel: async (id) => {
        const root = await loadBoatModel(BOATS[id]);
        let n = 0;
        root.traverse((o) => {
          n += o.isMesh ? 1 : 0;
        });
        return { n, towPoint: Boolean(root.getObjectByName('towPoint')), helm: Boolean(root.getObjectByName('helmCamera')) };
      },
      qualities: Object.keys(game.qualityTable),
      strike: (hold = 0) => {
        game.lightning.hold = hold;
        game.lightning.strike(game.camera, true);
      },
    };
    if (!enabled) {
      return;
    }
    const input = game.input;
    input.on('F3', () => {
      this.overlay.hidden = !this.overlay.hidden;
    });
    input.on('F6', () => game.setSeaState((game.weather.toIndex + 1) % 5, false));
    input.on('F7', () => game.dayNight.setHour(game.dayNight.hour + 3));
    input.on('F9', () => this.togglePoints());
    input.on('F8', () => this.toggleSpawner());
    SCENARIOS.forEach(([name], i) => {
      input.on(`Digit${i + 1}`, () => {
        if (this.menu && !this.menu.hidden) {
          game.ops.spawn(name);
          this.menu.hidden = true;
        }
      });
    });
    game.events.on('frame', () => {
      this.draw();
      this.drawPoints();
    });
  }

  toggleSpawner() {
    if (!this.menu) {
      this.menu = document.createElement('pre');
      this.menu.className = 'f8-menu';
      this.menu.textContent = `SPAWN SCENARIO (F8 to close)\n\n${SCENARIOS.map(([, label], i) => `${i + 1}  ${label}`).join('\n')}`;
      this.menu.hidden = true;
      document.body.appendChild(this.menu);
    }
    this.menu.hidden = !this.menu.hidden;
  }

  togglePoints() {
    const session = this.game.session;
    if (!session) {
      return;
    }
    if (!this.points) {
      const n = session.sim.buoyancy.points.length;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const mat = new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, vertexColors: true, depthTest: false, fog: false });
      this.points = new THREE.Points(geo, mat);
      this.points.frustumCulled = false;
      this.points.renderOrder = 10;
      this.points.visible = false;
      this.game.scene.add(this.points);
    }
    this.points.visible = !this.points.visible;
  }

  // Buoyancy points: dry = grey, partly wet = orange, submerged = green.
  drawPoints() {
    if (!this.points || !this.points.visible) {
      return;
    }
    const w = this.game.session.sim.buoyancy.world;
    const pos = this.points.geometry.attributes.position;
    const col = this.points.geometry.attributes.color;
    for (let i = 0; i < w.length; i++) {
      pos.setXYZ(i, w[i].x, w[i].y, w[i].z);
      const f = w[i].f;
      if (f <= 0) {
        col.setXYZ(i, 0.5, 0.5, 0.5);
      } else if (f < 1) {
        col.setXYZ(i, 0.88, 0.35, 0.16);
      } else {
        col.setXYZ(i, 0.5, 0.64, 0.54);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  draw() {
    if (this.overlay.hidden) {
      return;
    }
    const s = this.game.snapshot();
    const h = Math.floor(s.hour);
    const m = Math.floor((s.hour - h) * 60);
    this.overlay.textContent = [
      `FPS        ${s.fps.toFixed(0)}`,
      `frame      ${s.frameMs.toFixed(1)} ms`,
      `physics    ${s.physicsMs.toFixed(2)} ms/step`,
      `draw calls ${s.drawCalls}`,
      `triangles  ${s.triangles}`,
      `buoyancy   ${s.buoyancyPoints ?? 0} pts (${(s.submerged ?? 0).toFixed(1)} m³ wet)`,
      `boat       ${(s.speedKn ?? 0).toFixed(1)} kn  heel ${(s.heel ?? 0).toFixed(1)}°  ${s.model ?? ''}`,
      `spray      ${s.sprayParticles ?? 0}`,
      `tow        ${s.towing ? `${(s.towTension / 1000).toFixed(1)} kN (${Math.round(s.towRatio * 100)}%) ${s.towLength.toFixed(1)} m` : '-'}`,
      `hull       ${(s.integrity ?? 100).toFixed(0)}%  flood ${(s.flood ?? 0).toFixed(2)} t  aboard ${s.survivorsAboard ?? 0}`,
      `sea state  ${s.seaState}${s.transitioning ? ` -> ${s.seaStateTarget}` : ''}`,
      `waves      ${s.waveCount} (physics ${s.physicsWaves})`,
      `time       ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}  sun ${s.sunElevation.toFixed(1)}°`,
      `quality    ${s.quality}`,
    ].join('\n');
  }
}
