// Gerstner wave model: the single source of truth for the sea surface.
// The CPU API (heightAt / normalAt / velocityAt) and the GPU uniforms are
// built from the same component list. See spec section 3.2.
//
// Phase of component i at undisplaced point p0 and time t:
//   theta = kx*x0 + kz*z0 - acc_i - omega_i*(t - this.time)
// acc_i is an accumulated phase advanced every update. When the wave list
// changes (weather transition) acc_i is compensated so the phase stays
// continuous at the anchor point (the camera / player), so nothing pops
// or swims where the player is looking.

import { mulberry32 } from '../core/Rng.js';

export const MAX_WAVES = 16;
export const PHYSICS_WAVES = 12;
export const SOLVE_ITERATIONS = 5;
const G = 9.81;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const SPREAD_DEG = 40;

// Direction the waves travel TOWARD, as a unit xz vector, from a compass
// bearing the wind blows FROM. World: +X east, -Z north.
export function windTravelVector(fromBearingDeg) {
  const b = (fromBearingDeg + 180) * DEG;
  return { x: Math.sin(b), z: -Math.cos(b) };
}

// Build the component list for a (possibly blended) sea-state parameter set.
// Index 0 is always the longest and largest component; index order is stable
// across sea states so transitions interpolate component-by-component.
export function buildWaveList(params, seed, count = MAX_WAVES) {
  const rng = mulberry32(seed);
  const travel = windTravelVector(params.windDirectionDeg);
  const baseAngle = Math.atan2(travel.z, travel.x);
  const ratio = params.lambdaMax / params.lambdaMin;
  const comps = [];
  for (let i = 0; i < count; i++) {
    const jitter = rng();
    const dirU = rng();
    const phaseU = rng();
    const t = 1 - (i + 0.2 + 0.6 * jitter) / count;
    const wavelength = params.lambdaMin * Math.pow(ratio, t);
    // Longer swells stay closer to the wind direction.
    const spread = SPREAD_DEG * DEG * (0.65 + 0.35 * (i / (count - 1)));
    const angle = baseAngle + (dirU * 2 - 1) * spread;
    const k = TAU / wavelength;
    comps.push({
      dirX: Math.cos(angle),
      dirZ: Math.sin(angle),
      wavelength,
      k,
      speed: Math.sqrt((G * wavelength) / TAU),
      omega: Math.sqrt(G * k),
      amplitude: Math.pow(wavelength, 1.0),
      steepness: 0,
      qa: 0,
      phase0: phaseU * TAU,
    });
  }
  // Scale amplitudes to the significant wave height: Hs = 4 * sqrt(sum(A^2)/2).
  let sumSq = 0;
  for (const c of comps) {
    sumSq += c.amplitude * c.amplitude;
  }
  const scale = params.hs / (4 * Math.sqrt(sumSq / 2));
  let sumKA = 0;
  for (const c of comps) {
    c.amplitude *= scale;
    sumKA += c.k * c.amplitude;
  }
  // Horizontal (Gerstner) amplitude: sum of Q*k*A equals the global steepness.
  const q = sumKA > 0 ? params.steepness / sumKA : 0;
  for (const c of comps) {
    c.qa = q * c.amplitude;
    c.steepness = q * c.k * c.amplitude;
  }
  return comps;
}

export class Waves {
  constructor(seed = 1) {
    this.seed = seed;
    this.time = 0;
    this.comps = [];
    this.acc = new Float64Array(MAX_WAVES);
    this.anchorX = 0;
    this.anchorZ = 0;
    this.maxAmplitude = 0;
    this.physicsCount = PHYSICS_WAVES;
  }

  setAnchor(x, z) {
    this.anchorX = x;
    this.anchorZ = z;
  }

  // Replace the component list, keeping phase continuous at the anchor.
  setParams(params) {
    const next = buildWaveList(params, this.seed);
    const first = this.comps.length === 0;
    for (let i = 0; i < next.length; i++) {
      const n = next[i];
      if (first) {
        this.acc[i] = -n.phase0;
        continue;
      }
      const o = this.comps[i];
      const dkx = n.k * n.dirX - o.k * o.dirX;
      const dkz = n.k * n.dirZ - o.k * o.dirZ;
      this.acc[i] += dkx * this.anchorX + dkz * this.anchorZ;
    }
    this.comps = next;
    this.maxAmplitude = 0;
    for (const c of next) {
      this.maxAmplitude += c.amplitude;
    }
    this.wrapPhases();
  }

  update(dt) {
    this.time += dt;
    for (let i = 0; i < this.comps.length; i++) {
      this.acc[i] += this.comps[i].omega * dt;
    }
    this.wrapPhases();
  }

  wrapPhases() {
    for (let i = 0; i < this.comps.length; i++) {
      this.acc[i] = this.acc[i] - TAU * Math.floor(this.acc[i] / TAU);
    }
  }

  theta(i, x0, z0, t) {
    const c = this.comps[i];
    return c.k * (c.dirX * x0 + c.dirZ * z0) - this.acc[i] - c.omega * (t - this.time);
  }

  // Displaced surface point for undisplaced (x0, z0). Writes into out.
  displace(x0, z0, t = this.time, count = MAX_WAVES, out = {}) {
    let x = x0;
    let y = 0;
    let z = z0;
    const n = Math.min(count, this.comps.length);
    for (let i = 0; i < n; i++) {
      const c = this.comps[i];
      const th = this.theta(i, x0, z0, t);
      const cs = Math.cos(th);
      x += c.qa * c.dirX * cs;
      z += c.qa * c.dirZ * cs;
      y += c.amplitude * Math.sin(th);
    }
    out.x = x;
    out.y = y;
    out.z = z;
    return out;
  }

  // Find the undisplaced point whose displaced xz lands on (x, z).
  solveUndisplaced(x, z, t = this.time, count = MAX_WAVES, out = {}) {
    let x0 = x;
    let z0 = z;
    const d = {};
    for (let it = 0; it < SOLVE_ITERATIONS; it++) {
      this.displace(x0, z0, t, count, d);
      x0 -= d.x - x;
      z0 -= d.z - z;
    }
    out.x = x0;
    out.z = z0;
    return out;
  }

  heightAt(x, z, t = this.time, count = this.physicsCount) {
    const p0 = this.solveUndisplaced(x, z, t, count);
    const d = this.displace(p0.x, p0.z, t, count);
    return d.y;
  }

  normalAt(x, z, t = this.time, count = this.physicsCount, out = {}) {
    const p0 = this.solveUndisplaced(x, z, t, count);
    let dxx = 1;
    let dxy = 0;
    let dxz = 0;
    let dzx = 0;
    let dzy = 0;
    let dzz = 1;
    const n = Math.min(count, this.comps.length);
    for (let i = 0; i < n; i++) {
      const c = this.comps[i];
      const th = this.theta(i, p0.x, p0.z, t);
      const s = Math.sin(th);
      const cs = Math.cos(th);
      const wa = c.qa * c.k;
      dxx -= wa * c.dirX * c.dirX * s;
      dxz -= wa * c.dirX * c.dirZ * s;
      dxy += c.amplitude * c.k * c.dirX * cs;
      dzx -= wa * c.dirX * c.dirZ * s;
      dzz -= wa * c.dirZ * c.dirZ * s;
      dzy += c.amplitude * c.k * c.dirZ * cs;
    }
    // normal = cross(dP/dz0, dP/dx0)
    const nx = dzy * dxz - dzz * dxy;
    const ny = dzz * dxx - dzx * dxz;
    const nz = dzx * dxy - dzy * dxx;
    const len = Math.hypot(nx, ny, nz);
    out.x = nx / len;
    out.y = ny / len;
    out.z = nz / len;
    return out;
  }

  // Orbital velocity of the surface water particle at (x, z).
  velocityAt(x, z, t = this.time, count = this.physicsCount, out = {}) {
    const p0 = this.solveUndisplaced(x, z, t, count);
    let vx = 0;
    let vy = 0;
    let vz = 0;
    const n = Math.min(count, this.comps.length);
    for (let i = 0; i < n; i++) {
      const c = this.comps[i];
      const th = this.theta(i, p0.x, p0.z, t);
      const s = Math.sin(th);
      vx += c.qa * c.omega * c.dirX * s;
      vz += c.qa * c.omega * c.dirZ * s;
      vy -= c.amplitude * c.omega * Math.cos(th);
    }
    out.x = vx;
    out.y = vy;
    out.z = vz;
    return out;
  }

  // Pack for the shader: A = (kx, kz, amplitude, qa), B = (acc, k, omega, 0).
  packUniforms(arrA, arrB) {
    for (let i = 0; i < MAX_WAVES; i++) {
      const c = this.comps[i];
      const a = arrA[i];
      const b = arrB[i];
      if (!c) {
        a.set(0, 0, 0, 0);
        b.set(0, 1, 0, 0);
        continue;
      }
      a.set(c.k * c.dirX, c.k * c.dirZ, c.amplitude, c.qa);
      b.set(this.acc[i], c.k, c.omega, 0);
    }
  }
}
