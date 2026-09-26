// Towing and rescue rules (spec 5, 14 V3). Pure JS so the scripted scenario
// tests drive exactly what the player drives. Commands per fixed step:
//   { tow: presses of Space, winch: -1 | 0 | 1, action: presses of E }
// Space passes the line (tow point within 8 m of a target's bow cleat, under
// 3 kn) or casts it off; Q/Z winch; E pulls a survivor aboard (in range,
// slow, room aboard) or connects the pump hose to a flooding target.

import { BoatPhysics } from '../physics/BoatPhysics.js';
import { TowLine } from '../physics/TowLine.js';
import { towPointLocal, bowCleatLocal, sternLocal } from '../physics/fittings.js';
import { hullStation } from '../physics/HullShape.js';
import { rotate, rotateInv, vec } from '../core/math.js';
import { SurvivorField } from './Survivors.js';
import { TOW, TOW_TARGETS, CHAIN } from '../config/tow.js';
import { RESCUE } from '../config/rescue.js';
import { JOBS } from '../config/career.js';

const KN = 0.514444;
const HOSE_RANGE = 10;
const HOSE_BREAK = 25;

export class Operations {
  constructor(physics, player, opts = {}) {
    this.physics = physics;
    this.player = player;
    this.autoTension = Boolean(opts.autoTension);
    this.towPoint = towPointLocal(player.cfg.hull, player.cfg.towPointFromStern);
    this.targets = [];
    this.field = new SurvivorField();
    this.line = null;
    this.lineTarget = null;
    this.chain = []; // { line, from, to }: containers strung behind the tow
    this.pull = null; // { survivor, t }
    this.transfer = null; // { target, t } crew crossing from a sinking vessel
    this.hose = null; // target with our pump hose connected
    this.aboard = 0;
    this.rescued = 0;
    this.events = [];
    this.seaState = opts.seaState || 'moderate';
    this.tmp = { a: vec(), b: vec(), l: vec() };
  }

  get capacity() {
    return this.player.cfg.survivorCapacity;
  }

  // kind: a TOW_TARGETS id, or (opts.cfg) any boat config, e.g. one of the
  // player's own boats broken down.
  addTarget(kind, x, z, heading = 0, opts = {}) {
    const cfg = opts.cfg || TOW_TARGETS[kind];
    const sim = this.physics.add(new BoatPhysics(this.physics, cfg, { x, z, y: 0, heading }));
    const t = { id: `${kind}-${this.targets.length + 1}`, kind, cfg, sim, cleat: bowCleatLocal(cfg.hull) };
    if (opts.leak) {
      sim.hull.extraLeak = opts.leak / 60;
    }
    if (opts.flood) {
      sim.hull.flood = opts.flood;
    }
    t.crew = opts.crew || 0;
    t.pumped = 0;
    t.job = opts.job || null;
    this.targets.push(t);
    return t;
  }

  removeTarget(t) {
    if (this.lineTarget === t) {
      this.release();
    }
    for (const c of this.chain.filter((x) => x.from === t || x.to === t)) {
      this.unchain(c);
    }
    this.physics.remove(t.sim);
    this.targets.splice(this.targets.indexOf(t), 1);
  }

  minutes() {
    return RESCUE.hypothermiaMinutes[this.seaState] ?? 10;
  }

  addSurvivor(x, z) {
    return this.field.addSurvivor(x, z, this.minutes());
  }

  addRaft(x, z, count) {
    return this.field.addRaft(x, z, count, this.minutes());
  }

  clear() {
    this.release();
    for (const t of [...this.targets]) {
      this.removeTarget(t);
    }
    this.field.clear();
    this.pull = null;
  }

  // World position of a body-frame point.
  world(sim, local, out) {
    const s = sim.state;
    rotate(s.rot, local, out);
    out.x += s.pos.x;
    out.y += s.pos.y;
    out.z += s.pos.z;
    return out;
  }

  // Closest target whose bow cleat is within reach of our tow point.
  attachCandidate() {
    const a = this.world(this.player, this.towPoint, this.tmp.a);
    let best = null;
    let bestD = Infinity;
    for (const t of this.targets) {
      if (t.sim.hull.foundered) {
        continue;
      }
      const b = this.world(t.sim, t.cleat, this.tmp.b);
      const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return { target: best, distance: bestD };
  }

  attach(target) {
    const line = new TowLine(
      { body: this.player, local: this.towPoint },
      { body: target.sim, local: target.cleat },
      { autoTension: this.autoTension },
    );
    // Start with the line just slack at the current distance.
    const a = this.world(this.player, this.towPoint, this.tmp.a);
    const b = this.world(target.sim, target.cleat, this.tmp.b);
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    line.length = line.setLength = Math.min(TOW.maxLength, Math.max(TOW.minLength, d + 1));
    line.onBreak = () => {
      this.events.push({ type: 'break', target, tension: line.maxTension });
      this.physics.removeLink(line);
      this.line = null;
      this.lineTarget = null;
    };
    this.physics.addLink(line);
    this.line = line;
    this.lineTarget = target;
    this.events.push({ type: 'attach', target });
  }

  // ---- daisy chain (containers) ----
  // The last container in the string behind the tug.
  chainTail() {
    if (!this.lineTarget || this.lineTarget.kind !== 'container') {
      return null;
    }
    let tail = this.lineTarget;
    for (let i = 0; i < this.chain.length; i++) {
      const next = this.chain.find((c) => c.from === tail);
      if (!next) {
        break;
      }
      tail = next.to;
    }
    return tail;
  }

  chained(t) {
    return this.chain.some((c) => c.to === t || c.from === t);
  }

  // Next container to string on: its lug near the tail's stern.
  chainCandidate() {
    const tail = this.chainTail();
    if (!tail || this.chain.length >= CHAIN.maxLength - 1) {
      return null;
    }
    const a = this.world(tail.sim, sternLocal(tail.cfg.hull), this.tmp.a);
    let best = null;
    let bestD = Infinity;
    for (const t of this.targets) {
      if (t.kind !== 'container' || t === this.lineTarget || this.chained(t) || t.sim.hull.foundered) {
        continue;
      }
      const b = this.world(t.sim, t.cleat, this.tmp.b);
      const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best && bestD <= CHAIN.range ? { target: best, tail, distance: bestD } : null;
  }

  chainNext() {
    const c = this.chainCandidate();
    if (!c || this.player.speed / KN >= TOW.attachMaxKn) {
      return false;
    }
    const line = new TowLine({ body: c.tail.sim, local: sternLocal(c.tail.cfg.hull) }, { body: c.target.sim, local: c.target.cleat }, { breakingN: CHAIN.breakingKN * 1000 });
    line.length = line.setLength = c.distance + 1;
    const link = { line, from: c.tail, to: c.target };
    line.onBreak = () => {
      this.events.push({ type: 'chainBreak', target: c.target });
      this.unchain(link);
    };
    this.physics.addLink(line);
    this.chain.push(link);
    this.events.push({ type: 'chain', target: c.target, count: this.chain.length + 1 });
    return true;
  }

  unchain(link) {
    link.line.detach();
    this.physics.removeLink(link.line);
    this.chain.splice(this.chain.indexOf(link), 1);
  }

  release() {
    if (!this.line) {
      return;
    }
    this.line.detach();
    this.physics.removeLink(this.line);
    this.events.push({ type: 'release', target: this.lineTarget });
    this.line = null;
    this.lineTarget = null;
  }

  // Distance from a world point to the player's hull side at the waterline.
  hullDistance(x, z) {
    const h = this.player.cfg.hull;
    const s = this.player.state;
    const l = this.tmp.l;
    l.x = x - s.pos.x;
    l.y = 0;
    l.z = z - s.pos.z;
    rotateInv(s.rot, l, l);
    const zc = Math.max(-h.length / 2, Math.min(h.length / 2, l.z));
    const half = hullStation(h, zc / h.length + 0.5).halfBeam;
    const dx = Math.max(0, Math.abs(l.x) - half);
    const dz = Math.abs(l.z) - Math.abs(zc);
    return Math.hypot(dx, dz);
  }

  // Nearest waiting survivor within pull range.
  pullCandidate() {
    let best = null;
    let bestD = RESCUE.pullRange;
    for (const s of this.field.waiting()) {
      const d = this.hullDistance(s.x, s.z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  hoseCandidate() {
    const p = this.player.state.pos;
    for (const t of this.targets) {
      if (t.sim.hull.flood > 0.05 && !t.sim.hull.foundered) {
        const q = t.sim.state.pos;
        if (Math.hypot(q.x - p.x, q.z - p.z) < HOSE_RANGE + t.cfg.hull.length / 2) {
          return t;
        }
      }
    }
    return null;
  }

  step(dt, cmd, waves, t, env) {
    const speedKn = this.player.speed / KN;
    if (cmd.tow) {
      if (this.line) {
        this.release();
      } else {
        const c = this.attachCandidate();
        if (c.target && c.distance <= TOW.attachRange && speedKn < TOW.attachMaxKn) {
          this.attach(c.target);
        }
      }
    }
    if (this.line) {
      this.line.winchInput = cmd.winch || 0;
    }
    if (cmd.chain) {
      this.chainNext();
    }
    if (cmd.action) {
      this.action(speedKn);
    }
    this.updatePull(dt, speedKn);
    this.updateTransfer(dt);
    this.updateHose();
    if (this.hose) {
      this.hose.pumped += dt;
    }
    this.field.update(dt, waves, t, env, this.events);
    for (const tg of this.targets) {
      if (tg.sim.hull.foundered && !tg.reportedLost) {
        tg.reportedLost = true;
        this.events.push({ type: 'founder', target: tg });
        if (this.lineTarget === tg) {
          this.release();
        }
      }
    }
  }

  action(speedKn) {
    if (this.pull) {
      return;
    }
    const s = this.pullCandidate();
    if (s) {
      if (this.aboard >= this.capacity) {
        this.events.push({ type: 'full' });
      } else if (speedKn <= RESCUE.pullMaxKn) {
        this.pull = { survivor: s, t: 0 };
      }
      return;
    }
    const c = this.crewCandidate();
    if (c) {
      if (this.aboard >= this.capacity) {
        this.events.push({ type: 'full' });
      } else if (!this.transfer) {
        this.transfer = { target: c, t: 0 };
      }
      return;
    }
    const t = this.hoseCandidate();
    if (t) {
      this.connectHose(this.hose === t ? null : t);
    }
  }

  // Gap between our hull and a target's (rough: beam-sized circles).
  hullGap(t) {
    const p = this.player.state.pos;
    const q = t.sim.state.pos;
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    const lp = this.player.cfg.hull;
    const lt = t.cfg.hull;
    // Side by side: centre distance minus the half-beams.
    return d - (lp.beam + lt.beam) / 2;
  }

  crewCandidate() {
    for (const t of this.targets) {
      if (t.crew > 0 && !t.sim.hull.foundered && this.hullGap(t) < JOBS.crewRange) {
        return t;
      }
    }
    return null;
  }

  updateTransfer(dt) {
    const tr = this.transfer;
    if (!tr) {
      return;
    }
    const t = tr.target;
    const rel = Math.hypot(t.sim.state.linvel.x - this.player.state.linvel.x, t.sim.state.linvel.z - this.player.state.linvel.z) / KN;
    if (t.sim.hull.foundered || t.crew <= 0 || this.hullGap(t) > JOBS.crewRange + 1 || rel > 3) {
      this.transfer = null;
      return;
    }
    tr.t += dt;
    if (tr.t >= JOBS.crewTransferSeconds) {
      t.crew--;
      const s = this.field.addSurvivor(t.sim.state.pos.x, t.sim.state.pos.z, 999);
      s.state = 'aboard';
      s.job = t.job;
      this.aboard++;
      this.rescued++;
      this.player.payload += RESCUE.survivorMass;
      this.events.push({ type: 'rescued', survivor: s });
      tr.t = 0;
      if (t.crew <= 0 || this.aboard >= this.capacity) {
        this.transfer = null;
      }
    }
  }

  connectHose(t) {
    if (this.hose) {
      this.hose.sim.hull.extraPump = 0;
    }
    this.hose = t;
    if (t) {
      t.sim.hull.extraPump = this.player.hull.pumpRate * 0.5;
      this.events.push({ type: 'hose', target: t });
    }
  }

  updateHose() {
    if (!this.hose) {
      return;
    }
    const p = this.player.state.pos;
    const q = this.hose.sim.state.pos;
    if (Math.hypot(q.x - p.x, q.z - p.z) > HOSE_BREAK || this.hose.sim.hull.foundered || !this.targets.includes(this.hose)) {
      this.connectHose(null);
    }
  }

  updatePull(dt, speedKn) {
    const p = this.pull;
    if (!p) {
      return;
    }
    const s = p.survivor;
    const inRange = this.hullDistance(s.x, s.z) < RESCUE.pullRange + 0.8;
    if (s.state === 'lost' || !inRange || speedKn > RESCUE.pullMaxKn + 1) {
      this.pull = null;
      return;
    }
    p.t += dt;
    if (p.t >= RESCUE.pullSeconds) {
      if (s.raft) {
        s.raft.occupants.splice(s.raft.occupants.indexOf(s), 1);
        s.raft = null;
      }
      s.state = 'aboard';
      this.aboard++;
      this.rescued++;
      this.player.payload += RESCUE.survivorMass;
      this.events.push({ type: 'rescued', survivor: s });
      this.pull = null;
    }
  }

  // Contextual prompt for the HUD (null = none).
  prompt() {
    const speedKn = this.player.speed / KN;
    if (this.pull) {
      return `Pulling aboard… ${Math.round((this.pull.t / RESCUE.pullSeconds) * 100)}%`;
    }
    if (this.transfer) {
      return `Crew crossing… ${this.transfer.target.crew} left · hold alongside`;
    }
    const cc = this.crewCandidate();
    if (cc) {
      return this.aboard >= this.capacity ? `Boat full (${this.aboard}/${this.capacity})` : `E  Take off the crew (${cc.crew})`;
    }
    const s = this.pullCandidate();
    if (s) {
      if (this.aboard >= this.capacity) {
        return `Boat full (${this.aboard}/${this.capacity})`;
      }
      return speedKn > RESCUE.pullMaxKn ? 'Slow down to pull them aboard' : 'E  Pull survivor aboard';
    }
    if (this.line) {
      const ch = this.chainCandidate();
      if (ch) {
        return speedKn < TOW.attachMaxKn ? `F  Chain this container behind (${this.chain.length + 2} in tow)` : 'Under 3 kn to chain the next container';
      }
      return null;
    }
    const c = this.attachCandidate();
    if (c.target && c.distance <= TOW.attachRange) {
      return speedKn < TOW.attachMaxKn ? `Space  Pass the tow line to the ${c.target.cfg.name.toLowerCase()}` : 'Under 3 kn to pass the line';
    }
    if (c.target && c.distance <= TOW.attachRange * 3) {
      return 'Bring your stern within 8 m of her bow';
    }
    const t = this.hoseCandidate();
    if (t) {
      return this.hose === t ? 'E  Disconnect pump hose' : 'E  Pass the pump hose';
    }
    return null;
  }
}
