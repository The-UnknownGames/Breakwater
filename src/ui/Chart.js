// Chart (M, spec 9): full-screen nautical chart of the Grey Reach: depth
// shading and contours, coastlines, buoys, lighthouses, ports, the active
// job's search circle, offers, radar returns, the player and the waypoint
// (click to set, again to clear), plus current weather.

import { CHART, drawBuoys, drawLighthouse, drawBoat, drawCircle, drawCross } from './chartBase.js';
import { JOBS } from '../config/career.js';
import { SEA_STATES } from '../config/weather.js';

const NM = 1852;

export class Chart {
  constructor(parent, map) {
    this.map = map;
    this.root = document.createElement('div');
    this.root.className = 'chart-panel';
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    const head = document.createElement('div');
    head.className = 'paper-head';
    this.title = document.createElement('span');
    this.title.className = 'paper-title';
    this.title.textContent = 'The Grey Reach';
    this.meta = document.createElement('span');
    this.meta.className = 'paper-meta';
    const close = document.createElement('button');
    close.className = 'paper-close';
    close.textContent = 'Close';
    close.addEventListener('click', () => this.toggle(false));
    head.append(this.title, this.meta, close);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'chart-canvas';
    this.canvas.addEventListener('click', (e) => this.click(e));
    this.hint = document.createElement('div');
    this.hint.className = 'chart-hint';
    this.root.append(head, this.canvas, this.hint);
    parent.appendChild(this.root);
    this.timer = 0;
  }

  get open() {
    return !this.root.hidden;
  }

  toggle(force) {
    this.root.hidden = force !== undefined ? !force : !this.root.hidden;
    if (!this.root.hidden) {
      this.draw();
    }
  }

  // World <-> canvas for the current canvas size (north up).
  proj() {
    const c = this.canvas;
    const half = this.map.half;
    const k = c.width / (half * 2);
    return {
      k,
      m: (x, z) => ({ x: (x + half) * k, y: (z + half) * k }),
      inv: (px, py) => ({ x: px / k - half, z: py / k - half }),
    };
  }

  click(e) {
    const r = this.canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * this.canvas.width;
    const py = ((e.clientY - r.top) / r.height) * this.canvas.height;
    const { inv, k } = this.proj();
    const w = inv(px, py);
    const cur = this.map.waypoint();
    if (cur && Math.hypot(cur.x - w.x, cur.z - w.z) * k < 14) {
      this.map.setWaypoint(null);
    } else {
      this.map.setWaypoint({ x: w.x, z: w.z, label: 'Waypoint', exact: true });
    }
    this.draw();
  }

  update(dt) {
    if (!this.open) {
      return;
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.25;
      this.draw();
    }
  }

  draw() {
    const map = this.map;
    const c = this.canvas;
    const size = Math.max(200, Math.floor(Math.min(c.clientWidth || 600, c.clientHeight || 600)));
    if (c.width !== size) {
      c.width = size;
      c.height = size;
    }
    const ctx = c.getContext('2d');
    const { m, k } = this.proj();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(map.base(), 0, 0, size, size);
    // Kilometre grid.
    ctx.strokeStyle = 'rgba(28, 42, 54, 0.12)';
    ctx.lineWidth = 1;
    for (let v = -3000; v <= 3000; v += 1000) {
      const a = m(v, -map.half);
      const b = m(-map.half, v);
      ctx.beginPath();
      ctx.moveTo(a.x, 0);
      ctx.lineTo(a.x, size);
      ctx.moveTo(0, b.y);
      ctx.lineTo(size, b.y);
      ctx.stroke();
    }
    const font = Math.max(10, Math.round(size / 60));
    ctx.font = `${font}px "IBM Plex Sans Condensed", "Arial Narrow", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(28, 42, 54, 0.75)';
    const portNames = new Set(map.shape.ports.map((q) => q.name));
    for (const s of map.shape.islands) {
      if (portNames.has(s.name)) {
        continue;
      }
      const p = m(s.x, s.z);
      ctx.fillText(s.name.toUpperCase(), p.x, p.y + 3);
    }
    ctx.fillStyle = 'rgba(28, 42, 54, 0.6)';
    ctx.font = `italic ${font}px "IBM Plex Sans Condensed", "Arial Narrow", sans-serif`;
    for (const r of map.shape.reefs) {
      const p = m(r.x, r.z);
      ctx.fillText(r.name, p.x, p.y + r.r * k + font + 4);
    }
    // Fishing grounds: dotted circles with names.
    ctx.font = `italic ${font}px "IBM Plex Sans Condensed", "Arial Narrow", sans-serif`;
    for (const g of map.shape.map.fishingGrounds) {
      const p = m(g.x, g.z);
      drawCircle(ctx, p, g.r * k, 'rgba(31, 122, 58, 0.55)', [2, 3]);
      ctx.fillStyle = 'rgba(31, 122, 58, 0.85)';
      ctx.fillText(g.name, p.x, p.y + 3);
    }
    drawBuoys(ctx, map.buoys(), m, Math.max(2, size / 260));
    for (const l of map.lighthouses()) {
      drawLighthouse(ctx, m(l.x, l.z), Math.max(5, size / 90));
    }
    ctx.font = `600 ${font}px "IBM Plex Sans Condensed", "Arial Narrow", sans-serif`;
    for (const port of map.shape.ports) {
      const p = m(port.zone.x, port.zone.z);
      drawCircle(ctx, p, port.zone.r * k, CHART.brass, [3, 3]);
      ctx.fillStyle = CHART.ink;
      const locked = port.minReputation && map.reputation() < port.minReputation;
      ctx.fillText(`${port.name}${locked ? ` (rep ${port.minReputation})` : ''}`, p.x, p.y - port.zone.r * k - 4);
    }
    // Offers: dashed search areas; the active job: solid, or its exact spot.
    for (const o of map.offers()) {
      drawCircle(ctx, m(o.cx, o.cz), JOBS.uncertainty * k, 'rgba(194, 53, 43, 0.45)', [4, 4]);
    }
    const obj = map.objective();
    if (obj) {
      const p = m(obj.x, obj.z);
      if (obj.exact) {
        drawCross(ctx, p, 6, CHART.job);
      } else {
        drawCircle(ctx, p, JOBS.uncertainty * k, CHART.job);
      }
    }
    for (const r of map.returns()) {
      const p = m(r.x, r.z);
      ctx.fillStyle = r.kind === 'vessel' ? CHART.ink : CHART.job;
      ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    }
    // Traffic (AIS): small hull marks with names.
    ctx.font = `${Math.max(9, font - 2)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'left';
    for (const t of map.traffic()) {
      const p = m(t.x, t.z);
      drawBoat(ctx, p, t.heading, Math.max(4, size / 140), '#4c5a66');
      ctx.fillStyle = '#4c5a66';
      ctx.fillText(t.name, p.x + 7, p.y + 3);
    }
    ctx.textAlign = 'center';
    const wp = map.waypoint();
    const me = map.player();
    if (wp) {
      const p = m(wp.x, wp.z);
      const a = m(me.x, me.z);
      ctx.save();
      ctx.strokeStyle = CHART.brass;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
      drawCircle(ctx, p, 6, CHART.brass);
    }
    drawBoat(ctx, m(me.x, me.z), me.heading, Math.max(7, size / 70));
    // Scale bar: 1 nm.
    const nm = NM * k;
    ctx.fillStyle = CHART.ink;
    ctx.fillRect(16, size - 22, nm, 3);
    ctx.textAlign = 'left';
    ctx.font = `${font}px "IBM Plex Mono", monospace`;
    ctx.fillText('1 nm', 16, size - 28);
    const ws = SEA_STATES.find((s) => s.id === map.seaState()) || SEA_STATES[0];
    this.meta.textContent = `${ws.name} · wind ${ws.windKn} kn · Hs ${ws.hs} m · vis ${(ws.visibility / 1000).toFixed(1)} km`;
    const d = wp ? Math.hypot(wp.x - me.x, wp.z - me.z) : 0;
    this.hint.textContent = wp
      ? `Waypoint ${(d / NM).toFixed(2)} nm · T autopilot${map.hasAutopilot() ? '' : ' (fit at the shipyard)'} · click it to clear`
      : 'Click to set a waypoint · M to close';
  }
}
