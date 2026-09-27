// Nautical-chart base image (spec 9): paper, depth bands, depth contours and
// ink coastlines, from the world's baked depth texture (no extra terrain
// sampling). Shared by the chart (M) and the minimap. Plus the overlay
// painters both use: nav aids, ports, job circles, markers.

export const CHART = {
  paper: '#ede8dc',
  ink: '#1c2a36',
  land: '#d8c9a2',
  landEdge: '#b9a57a',
  bands: [
    [2, '#a9c7cf'],
    [5, '#bdd5da'],
    [10, '#cfe0e1'],
    [20, '#dfe8e4'],
  ],
  contours: [5, 10, 20],
  brass: '#b08d57',
  red: '#b3261e',
  green: '#1f7a3a',
  hazard: '#d6b21e',
  job: '#c2352b',
};

// data: RGBA bytes, n x n; R = depth / maxDepth, G = land.
export function bakeChartBase(data, n, maxDepth) {
  const canvas = document.createElement('canvas');
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(n, n);
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const paper = hex(CHART.paper);
  const land = hex(CHART.land);
  const ink = hex(CHART.ink);
  const bands = CHART.bands.map(([d, c]) => [d, hex(c)]);
  const depth = (i, j) => (data[(j * n + i) * 4] / 255) * maxDepth;
  const isLand = (i, j) => data[(j * n + i) * 4 + 1] > 127;
  const band = (d) => CHART.contours.findIndex((c) => d < c);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const o = (j * n + i) * 4;
      let c = paper;
      if (isLand(i, j)) {
        c = land;
      } else {
        const d = depth(i, j);
        for (const [limit, col] of bands) {
          if (d < limit) {
            c = col;
            break;
          }
        }
      }
      let a = 1;
      // Coastline: land next to water, in ink.
      const l = isLand(i, j);
      const edge = (di, dj) => {
        const x = Math.min(n - 1, Math.max(0, i + di));
        const y = Math.min(n - 1, Math.max(0, j + dj));
        return x !== i || y !== j ? [x, y] : null;
      };
      let coast = false;
      let contour = false;
      for (const [di, dj] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const e = edge(di, dj);
        if (!e) {
          continue;
        }
        if (isLand(e[0], e[1]) !== l) {
          coast = coast || l;
        } else if (!l && band(depth(e[0], e[1])) !== band(depth(i, j))) {
          contour = true;
        }
      }
      if (coast) {
        c = ink;
      } else if (contour) {
        c = c.map((v, k) => v * 0.55 + ink[k] * 0.45);
        a = 1;
      }
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Overlay painters. `m` maps world (x, z) to canvas {x, y}; `k` is canvas
// pixels per metre.
// Breakwaters and piers (harbor outlines), at least `minPx` wide.
export function drawStructures(ctx, outlines, m, k, minPx = 1.5) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const o of outlines) {
    ctx.strokeStyle = o.kind === 'mole' ? CHART.ink : '#6b5a44';
    ctx.lineWidth = Math.max(minPx, o.width * k);
    ctx.beginPath();
    o.pts.forEach((q, i) => {
      const p = m(q.x, q.z);
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    });
    ctx.stroke();
  }
}

export function drawBuoys(ctx, buoys, m, size) {
  for (const b of buoys) {
    const p = m(b.x, b.z);
    ctx.fillStyle = b.kind === 'red' ? CHART.red : b.kind === 'green' ? CHART.green : CHART.hazard;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = CHART.ink;
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }
}

export function drawLighthouse(ctx, p, r) {
  // Light star: a magenta flare as on real charts.
  ctx.fillStyle = '#a4287a';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rr = i % 2 ? r * 0.4 : r;
    ctx.lineTo(p.x + Math.sin(a) * rr, p.y - Math.cos(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawBoat(ctx, p, heading, size, color = CHART.ink) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(heading);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.6, size * 0.8);
  ctx.lineTo(0, size * 0.4);
  ctx.lineTo(-size * 0.6, size * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawCircle(ctx, p, r, color, dash = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawCross(ctx, p, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x - r, p.y - r);
  ctx.lineTo(p.x + r, p.y + r);
  ctx.moveTo(p.x + r, p.y - r);
  ctx.lineTo(p.x - r, p.y + r);
  ctx.stroke();
}
