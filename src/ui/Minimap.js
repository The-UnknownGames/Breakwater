// Minimap (spec 9): chart-style, north up, ~1.2 km radius around the
// player: coastlines and depths, buoys, the job circle or spot, the
// waypoint, and radar returns when radar is fitted.

import { CHART, drawBuoys, drawBoat, drawCircle, drawCross } from './chartBase.js';
import { JOBS } from '../config/career.js';

export class Minimap {
  constructor(parent, map, opts = {}) {
    this.map = map;
    this.range = opts.range ?? 1200; // metres from centre to edge
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    this.canvas.width = 180;
    this.canvas.height = 180;
    parent.appendChild(this.canvas);
    this.timer = 0;
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer > 0) {
      return;
    }
    this.timer = 0.2;
    this.draw();
  }

  draw() {
    const map = this.map;
    const c = this.canvas;
    const n = c.width;
    const ctx = c.getContext('2d');
    const me = map.player();
    const k = n / (this.range * 2);
    const m = (x, z) => ({ x: n / 2 + (x - me.x) * k, y: n / 2 + (z - me.z) * k });
    ctx.fillStyle = CHART.paper;
    ctx.fillRect(0, 0, n, n);
    // Base image crop around the player.
    const base = map.base();
    const bk = base.width / (map.half * 2);
    const sx = (me.x - this.range + map.half) * bk;
    const sz = (me.z - this.range + map.half) * bk;
    const sw = this.range * 2 * bk;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, sx, sz, sw, sw, 0, 0, n, n);
    ctx.strokeStyle = 'rgba(28, 42, 54, 0.15)';
    ctx.lineWidth = 1;
    drawCircle(ctx, { x: n / 2, y: n / 2 }, (this.range / 2) * k, 'rgba(28, 42, 54, 0.18)');
    drawBuoys(ctx, map.buoys(), m, 1.8);
    const obj = map.objective();
    if (obj) {
      const p = m(obj.x, obj.z);
      if (obj.exact) {
        drawCross(ctx, p, 4, CHART.job);
      } else {
        drawCircle(ctx, p, JOBS.uncertainty * k, CHART.job);
      }
      // Off the edge: a pointer on the rim toward it.
      if (p.x < 0 || p.y < 0 || p.x > n || p.y > n) {
        const a = Math.atan2(p.y - n / 2, p.x - n / 2);
        ctx.fillStyle = CHART.job;
        ctx.beginPath();
        ctx.arc(n / 2 + Math.cos(a) * (n / 2 - 6), n / 2 + Math.sin(a) * (n / 2 - 6), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const r of map.returns()) {
      const p = m(r.x, r.z);
      ctx.fillStyle = r.kind === 'vessel' ? CHART.ink : CHART.job;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    for (const t of map.traffic()) {
      drawBoat(ctx, m(t.x, t.z), t.heading, 4, '#4c5a66');
    }
    const wp = map.waypoint();
    if (wp) {
      drawCircle(ctx, m(wp.x, wp.z), 4, CHART.brass);
    }
    drawBoat(ctx, { x: n / 2, y: n / 2 }, me.heading, 7);
    ctx.fillStyle = CHART.ink;
    ctx.font = '600 11px "IBM Plex Sans Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', n / 2, 12);
  }
}
