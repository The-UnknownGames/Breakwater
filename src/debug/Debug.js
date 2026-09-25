// Debug tools (spec 16), enabled with ?debug=1.
// F3 overlay, F6 cycle sea state, F7 +3 h, window.__game for tests.
// F8 scenario spawner and F9 physics drawing arrive with V2/V3.

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
    game.events.on('frame', () => this.draw());
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
      `physics    ${s.physicsMs.toFixed(2)} ms`,
      `draw calls ${s.drawCalls}`,
      `triangles  ${s.triangles}`,
      `buoyancy   0 pts`,
      `sea state  ${s.seaState}${s.transitioning ? ` -> ${s.seaStateTarget}` : ''}`,
      `waves      ${s.waveCount} (physics ${s.physicsWaves})`,
      `time       ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}  sun ${s.sunElevation.toFixed(1)}°`,
      `quality    ${s.quality}`,
    ].join('\n');
  }
}
