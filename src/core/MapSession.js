// Chart (M) and minimap for the career: one data adapter over the world,
// the jobs and the player that both views draw from. The chart base image is
// baked once from the world's depth texture.

import { bakeChartBase } from '../ui/chartBase.js';
import { Chart } from '../ui/Chart.js';
import { Minimap } from '../ui/Minimap.js';

const RADAR_RANGE = 3000;

export class MapSession {
  constructor(career) {
    this.career = career;
    const game = career.game;
    const world = game.world;
    this.world = world;
    this.baseCanvas = null;
    const self = this;
    const map = {
      shape: world.shape,
      half: world.uniforms.uDepthHalf.value,
      base: () => self.base(),
      buoys: () => world.nav.buoys,
      structures: () => world.harbors.outlines,
      lighthouses: () => world.nav.lighthouses.map((l) => ({ x: l.group.position.x, z: l.group.position.z })),
      offers: () => career.jobs.offers,
      objective: () => career.jobs.objective(career.player),
      returns: () => self.returns(),
      waypoint: () => career.waypoint,
      setWaypoint: (w) => {
        career.waypoint = w;
      },
      player: () => {
        const s = career.player;
        return { x: s.state.pos.x, z: s.state.pos.z, heading: s.heading };
      },
      reputation: () => career.career.reputation,
      seaState: () => game.weather.state.id,
      forecast: () => (game.weatherChain ? game.weatherChain.forecastText(game.dayNight.hour, 3) : ''),
      hasAutopilot: () => career.career.has('autopilot'),
      traffic: () => (game.traffic ? game.traffic.list() : []),
    };
    this.chart = new Chart(document.body, map);
    this.minimap = new Minimap(career.hud.root, map);
    game.input.on('KeyM', () => this.chart.toggle());
  }

  base() {
    if (!this.baseCanvas) {
      const tex = this.world.depthTexture;
      this.baseCanvas = bakeChartBase(tex.image.data, tex.image.width, this.world.uniforms.uDepthMax.value);
    }
    return this.baseCanvas;
  }

  // Radar (upgrade): vessels and people in the water within 3 km.
  returns() {
    const c = this.career;
    if (!c.career.has('radar')) {
      return [];
    }
    const p = c.player.state.pos;
    const near = (x, z) => Math.hypot(x - p.x, z - p.z) < RADAR_RANGE;
    const out = [];
    const ops = c.ops.ops;
    for (const t of ops.targets) {
      const q = t.sim.state.pos;
      if (near(q.x, q.z)) {
        out.push({ x: q.x, z: q.z, kind: 'vessel' });
      }
    }
    for (const s of ops.field.waiting()) {
      if (near(s.x, s.z)) {
        out.push({ x: s.x, z: s.z, kind: 'person' });
      }
    }
    return out;
  }

  update(dt) {
    this.chart.update(dt);
    this.minimap.update(dt);
  }
}
