// Top-right objective block (spec 9): nearest job item with distance and
// bearing, a time-pressure bar (hypothermia of the most urgent survivor),
// and survivors aboard out of capacity.

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) {
    e.textContent = text;
  }
  parent.appendChild(e);
  return e;
}

function clock(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export class Objective {
  constructor(parent) {
    this.root = el('div', 'objective', parent);
    this.root.hidden = true;
    this.title = el('div', 'obj-title', this.root, '');
    this.detail = el('div', 'obj-detail inst-num', this.root, '');
    const bar = el('div', 'obj-bar', this.root);
    this.barLabel = el('span', 'inst-label', bar, 'Hypothermia');
    const track = el('div', 'inst-track', bar);
    this.fill = el('div', 'inst-fill', track);
    this.time = el('span', 'inst-num', bar, '');
    this.bar = bar;
    this.aboard = el('div', 'obj-aboard', this.root, '');
  }

  // ops: Operations
  update(ops) {
    const p = ops.player.state.pos;
    const waiting = ops.field.waiting();
    let item = null;
    let best = Infinity;
    for (const s of waiting) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < best) {
        best = d;
        item = { name: s.state === 'raft' ? 'Life raft' : 'Person in the water', x: s.x, z: s.z };
      }
    }
    if (!item && !ops.line) {
      for (const t of ops.targets) {
        const q = t.sim.state.pos;
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < best && !t.sim.hull.foundered) {
          best = d;
          item = { name: `Disabled ${t.cfg.name.toLowerCase()}`, x: q.x, z: q.z };
        }
      }
    }
    const show = Boolean(item || ops.aboard || ops.line);
    this.root.hidden = !show;
    if (!show) {
      return;
    }
    if (item) {
      const brg = ((Math.atan2(item.x - p.x, -(item.z - p.z)) * 180) / Math.PI + 360) % 360;
      this.title.textContent = item.name;
      this.detail.textContent = `${Math.round(best)} m · ${String(Math.round(brg) % 360).padStart(3, '0')}°`;
    } else if (ops.line) {
      this.title.textContent = `Towing ${ops.lineTarget.cfg.name.toLowerCase()}`;
      this.detail.textContent = '';
    } else {
      this.title.textContent = 'Return to harbour';
      this.detail.textContent = '';
    }
    const u = ops.field.mostUrgent();
    this.bar.hidden = !u;
    if (u) {
      const f = u.timer / u.timerMax;
      this.fill.style.width = `${f * 100}%`;
      this.bar.dataset.state = f < 0.15 ? 'crit' : f < 0.4 ? 'warn' : 'ok';
      this.time.textContent = clock(u.timer);
    }
    this.aboard.textContent = `Survivors aboard ${ops.aboard} / ${ops.capacity}`;
    this.aboard.dataset.state = ops.aboard >= ops.capacity ? 'warn' : 'ok';
  }
}
