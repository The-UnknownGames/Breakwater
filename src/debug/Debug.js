// Debug tools (spec 16), enabled with ?debug=1.
// F3 overlay, F6 cycle sea state, F7 +3 h, F9 buoyancy points,
// window.__game for tests. The F8 scenario spawner arrives with jobs (V3).

import * as THREE from 'three';

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
        const p = s.sim.state.pos;
        const b = s.sim.heading + (bearing * Math.PI) / 180;
        const pos = new THREE.Vector3(p.x + Math.sin(b) * dist, p.y + height, p.z - Math.cos(b) * dist);
        const dir = new THREE.Vector3(p.x, p.y + 1, p.z).sub(pos).normalize();
        game.rig.setMode('orbit');
        game.rig.lookAlong(pos, dir);
        game.rig.controls.target.set(p.x, p.y + 1, p.z);
        game.rig.controls.update();
      },
      // Draw one frame without advancing time (for a paused loop).
      render: () => game.renderFrame(0, 0),
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
    game.events.on('frame', () => {
      this.draw();
      this.drawPoints();
    });
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
      `sea state  ${s.seaState}${s.transitioning ? ` -> ${s.seaStateTarget}` : ''}`,
      `waves      ${s.waveCount} (physics ${s.physicsWaves})`,
      `time       ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}  sun ${s.sunElevation.toFixed(1)}°`,
      `quality    ${s.quality}`,
    ].join('\n');
  }
}
