// Headless boat measurements for spec section 4 targets. Each function builds
// its own world on flat water (or a given sea state) and returns a number.

import { initRapier, PhysicsWorld } from '../../src/physics/PhysicsWorld.js';
import { BoatPhysics } from '../../src/physics/BoatPhysics.js';
import { Environment } from '../../src/physics/Environment.js';
import { Waves } from '../../src/ocean/Waves.js';
import { quatFromAxisAngle, quatMul } from '../../src/core/math.js';
import { WEATHER } from '../../src/config/weather.js';
import { PHYS } from '../../src/config/physics.js';
import { SEA_STATES } from '../../src/config/weather.js';
import { windTravelVector } from '../../src/ocean/Waves.js';
import { Autopilot } from '../../src/gameplay/Autopilot.js';

const KN = 0.514444;
const DEG = Math.PI / 180;

const FLAT = { hs: 0, lambdaMin: 1, lambdaMax: 10, steepness: 0, windKn: 0, windDirectionDeg: 0 };

export async function makeSim(cfg, sea = FLAT, spawn = {}, opts = {}) {
  const R = await initRapier();
  const physics = new PhysicsWorld(R);
  const waves = new Waves(WEATHER.waveSeed);
  waves.setParams({ windDirectionDeg: WEATHER.windDirectionDeg, ...sea });
  const env = new Environment();
  if (!opts.current) {
    env.currentAt = (x, z, out = {}) => {
      out.x = 0;
      out.z = 0;
      return out;
    };
  }
  const boat = physics.add(new BoatPhysics(physics, cfg, spawn));
  const ctx = { waves, env, time: 0, seabed: opts.seabed };
  const sim = {
    physics,
    boat,
    waves,
    env,
    t: 0,
    step() {
      env.update(physics.dt, { windKn: sea.windKn ?? 0, windDirectionDeg: sea.windDirectionDeg ?? WEATHER.windDirectionDeg });
      waves.update(physics.dt);
      ctx.time = waves.time;
      physics.step(ctx);
      sim.t += physics.dt;
    },
    run(seconds, each) {
      const n = Math.round(seconds / physics.dt);
      for (let i = 0; i < n; i++) {
        sim.step();
        if (each && each(sim) === false) {
          return false;
        }
      }
      return true;
    },
  };
  return sim;
}

export async function waterline(cfg) {
  const sim = await makeSim(cfg, FLAT, { y: 0.25 });
  sim.run(30);
  return { sinkage: sim.boat.state.pos.y, pitchDeg: sim.boat.hull.pitch / DEG, heelDeg: sim.boat.hull.heel / DEG };
}

export async function topSpeed(cfg) {
  const sim = await makeSim(cfg);
  sim.boat.input.throttle = 1;
  sim.run(110);
  let sum = 0;
  let n = 0;
  sim.run(10, (s) => {
    sum += s.boat.forwardSpeed;
    n++;
  });
  return sum / n / KN;
}

export async function acceleration(cfg, toKn) {
  const sim = await makeSim(cfg);
  sim.boat.input.throttle = 1;
  let time = null;
  sim.run(120, (s) => {
    if (s.boat.forwardSpeed >= toKn * KN) {
      time = s.t;
      return false;
    }
    return true;
  });
  return time ?? Infinity;
}

export async function stopping(cfg, fromKn) {
  const sim = await makeSim(cfg);
  sim.boat.input.throttle = 1;
  sim.run(120, (s) => s.boat.forwardSpeed < fromKn * KN);
  sim.boat.input.throttle = -1;
  const p0 = { ...sim.boat.state.pos };
  let dist = null;
  sim.run(120, (s) => {
    if (s.boat.forwardSpeed <= 0.05) {
      dist = Math.hypot(s.boat.state.pos.x - p0.x, s.boat.state.pos.z - p0.z);
      return false;
    }
    return true;
  });
  return dist ?? Infinity;
}

export async function turningCircle(cfg, throttle) {
  const sim = await makeSim(cfg);
  sim.boat.input.throttle = throttle;
  sim.run(45);
  sim.boat.input.rudder = 1;
  sim.boat.input.lock = true;
  sim.run(40);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let speed = 0;
  let n = 0;
  sim.run(60, (s) => {
    const p = s.boat.state.pos;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
    speed += s.boat.speed;
    n++;
  });
  const diameter = (maxX - minX + (maxZ - minZ)) / 2;
  return { diameter, lengths: diameter / cfg.hull.length, speedKn: speed / n / KN };
}

export async function rollPeriod(cfg, heelDeg = 15) {
  const sim = await makeSim(cfg);
  sim.run(8);
  const b = sim.boat.body;
  const rot = quatMul(b.rotation(), quatFromAxisAngle(0, 0, 1, -heelDeg * DEG));
  b.setRotation(rot, true);
  b.setAngvel({ x: 0, y: 0, z: 0 }, true);
  b.setLinvel({ x: 0, y: 0, z: 0 }, true);
  sim.boat.readState();
  const crossings = [];
  let prev = sim.boat.hull.heel;
  sim.run(40, (s) => {
    const h = s.boat.hull.heel;
    if ((prev > 0 && h <= 0) || (prev < 0 && h >= 0)) {
      const frac = prev / (prev - h);
      crossings.push(s.t - s.physics.dt * (1 - frac));
    }
    prev = h;
    return crossings.length < 7;
  });
  if (crossings.length < 3) {
    return Infinity;
  }
  const halves = [];
  for (let i = 1; i < crossings.length; i++) {
    halves.push(crossings[i] - crossings[i - 1]);
  }
  return (2 * halves.reduce((a, c) => a + c, 0)) / halves.length;
}

// Static stability: righting moment vs heel, with free sinkage. Returns the
// angle of vanishing stability (deg) and the GZ curve.
export async function staticStability(cfg) {
  const sim = await makeSim(cfg);
  const boat = sim.boat;
  const bu = boat.buoyancy;
  const weight = cfg.mass * PHYS.gravity;
  const zero = { x: 0, z: 0 };
  const curve = [];
  let vanish = null;
  let prevGz = 0;
  for (let deg = 1; deg <= 120; deg += 1) {
    const rot = quatFromAxisAngle(0, 0, 1, -deg * DEG);
    let lo = -4;
    let hi = 4;
    let out;
    for (let it = 0; it < 50; it++) {
      const y = (lo + hi) / 2;
      const state = makeState(boat, rot, y);
      out = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
      bu.compute(state, sim.waves, 0, zero, out);
      if (out.fy > weight) {
        lo = y;
      } else {
        hi = y;
      }
    }
    const gz = out.tz / weight;
    curve.push({ deg, gz });
    if (vanish === null && gz <= 0 && deg > 5) {
      vanish = deg - 1 + prevGz / (prevGz - gz);
    }
    prevGz = gz;
  }
  return { vanish: vanish ?? 120, curve };
}

function makeState(boat, rot, y) {
  const pos = { x: 0, y, z: 0 };
  const com = { ...boat.comLocal };
  const c = { x: 0, y: 0, z: 0 };
  // com world = pos + rot * comLocal
  const q = rot;
  const v = com;
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  c.x = v.x + q.w * tx + (q.y * tz - q.z * ty);
  c.y = y + v.y + q.w * ty + (q.z * tx - q.x * tz);
  c.z = v.z + q.w * tz + (q.x * ty - q.y * tx);
  return { pos, rot, linvel: { x: 0, y: 0, z: 0 }, angvel: { x: 0, y: 0, z: 0 }, com: c, dt: 1 / 60 };
}

// Hove to: start head to weather in a sea state and let the autopilot hold
// her there at steerage way; she must stay upright.
export async function heaveTo(cfg, stateId, seconds = 90, kn = 4) {
  const st = SEA_STATES.find((s) => s.id === stateId);
  const sim = await makeSim(cfg, { ...st, windDirectionDeg: WEATHER.windDirectionDeg }, { heading: WEATHER.windDirectionDeg * DEG }, { current: true });
  const tr = windTravelVector(WEATHER.windDirectionDeg);
  const ap = new Autopilot(sim.boat);
  let worst = 0;
  const p0 = { ...sim.boat.state.pos };
  // Station keeping: aim at a fixed point far upwind of the start.
  const aim = { x: p0.x - tr.x * 3000, z: p0.z - tr.z * 3000 };
  sim.run(seconds, (s) => {
    ap.update(s.physics.dt, aim, { cruiseKn: kn });
    worst = Math.max(worst, Math.abs(s.boat.hull.heel));
  });
  const p = sim.boat.state.pos;
  // Metres made good upwind (negative: blown downwind).
  const upwind = -((p.x - p0.x) * tr.x + (p.z - p0.z) * tr.z);
  return { upright: !sim.boat.hull.capsized && Number.isFinite(sim.boat.state.pos.y), maxHeelDeg: worst / DEG, seconds, upwind };
}

// Come head to wind (D103): start beam-on at rest in a sea state, steer for
// a point far upwind; seconds until the bow is within 20° of the wind.
export async function headUp(cfg, stateId, offDeg = 90, limit = 180) {
  const st = SEA_STATES.find((s) => s.id === stateId);
  const sim = await makeSim(cfg, { ...st, windDirectionDeg: WEATHER.windDirectionDeg }, { heading: (WEATHER.windDirectionDeg + offDeg) * DEG }, { current: true });
  const tr = windTravelVector(WEATHER.windDirectionDeg);
  const ap = new Autopilot(sim.boat);
  const p0 = { ...sim.boat.state.pos };
  const aim = { x: p0.x - tr.x * 3000, z: p0.z - tr.z * 3000 };
  let at = null;
  sim.run(limit, (s) => {
    ap.update(s.physics.dt, aim, { cruiseKn: 4 });
    if (Math.abs(ap.headingError) < 20 * DEG) {
      at = s.t;
      return false;
    }
    return true;
  });
  return { seconds: at ?? Infinity, upright: !sim.boat.hull.capsized };
}
