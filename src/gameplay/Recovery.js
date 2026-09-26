// Cargo recovery (spec 8.1): 3-6 containers adrift after a deck-cargo spill.
// Tow each into Kettle Harbor (cast off inside the harbor zone); each one
// pays on arrival. Containers are sealed and float low; one that founders
// is lost. Pure JS: called by Jobs for the 'containers' type.

import { JOBS, REPUTATION } from '../config/career.js';

export function isRecovery(type) {
  return type === 'containers';
}

export function describeRecovery(o) {
  return `${o.count} containers adrift after a spill from the ${o.source}: tow each into Kettle Harbor`;
}

export function acceptRecovery(jobs, o, job) {
  const rng = jobs.rng;
  job.count = o.count;
  job.containers = [];
  for (let i = 0; i < o.count; i++) {
    const t = jobs.ops.addTarget('container', o.x + (rng() - 0.5) * 160, o.z + (rng() - 0.5) * 160, rng() * 6.28, { job: job.id });
    job.containers.push(t);
    job.entities.push(t);
  }
}

// Deliveries and losses; the job ends when every container is accounted for.
export function trackRecovery(jobs, dt) {
  const j = jobs.active;
  j.started += dt;
  const ops = jobs.ops;
  const home = jobs.shape.ports.find((p) => p.home);
  const m = jobs.weatherMultiplier(j.seaState);
  for (const t of [...j.containers]) {
    if (t.sim.hull.foundered || !ops.targets.includes(t)) {
      j.containers.splice(j.containers.indexOf(t), 1);
      j.lost++;
      jobs.radio.say('Kettle Harbor: a container has gone down.', 'warn');
      continue;
    }
    const p = t.sim.state.pos;
    if (jobs.shape.portAt(p.x, p.z) === home && ops.lineTarget !== t) {
      j.containers.splice(j.containers.indexOf(t), 1);
      ops.removeTarget(t);
      j.delivered++;
      const pay = Math.round(JOBS.types.containers.perContainer * m);
      j.pay = (j.pay || 0) + pay;
      jobs.career.addReputation(REPUTATION.perContainer);
      jobs.career.earn(pay, `Container ${j.delivered} of ${j.count} landed at Kettle Harbor`);
    }
  }
  if (j.containers.length === 0) {
    j.state = j.delivered > 0 ? 'done' : 'failed';
    jobs.radio.say(j.delivered > 0 ? `Kettle Harbor: that's the lot. ${j.delivered} of ${j.count} containers landed.` : 'Kettle Harbor: all the containers went down.', j.delivered > 0 ? 'info' : 'warn');
    jobs.history.push(j);
    jobs.active = null;
  }
}

export function recoveryObjective(jobs, player) {
  const j = jobs.active;
  const ops = jobs.ops;
  const p = player.state.pos;
  if (ops.lineTarget && j.containers.includes(ops.lineTarget)) {
    const home = jobs.shape.ports.find((q) => q.home);
    return { x: home.zone.x, z: home.zone.z, label: `Tow it into Kettle Harbor · ${j.delivered}/${j.count} landed`, exact: true };
  }
  let best = null;
  let bd = Infinity;
  for (const t of j.containers) {
    const q = t.sim.state.pos;
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  if (!best) {
    return null;
  }
  const exact = bd < JOBS.revealRange;
  return exact ? { x: best.x, z: best.z, label: `Container · ${j.containers.length} adrift`, exact: true } : { x: j.cx, z: j.cz, label: 'Cargo recovery · search area', exact: false };
}
