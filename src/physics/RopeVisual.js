// Tow line visual (spec 3.6): 40-node Verlet rope pinned at the tow point
// and the bow cleat. Slack line sags under gravity and floats on the wave
// surface; taut line straightens to a shallow catenary, lifts clear and
// sheds drips. Rendered as a tube with rope-lay normals; its radius grows
// with camera distance so it reads at every range. After a break the target
// end whips free and the line is hauled back aboard.

import * as THREE from 'three';
import { TOW } from '../config/tow.js';

const SIDES = 6;
// Wet line weight for the drawn catenary (a soaked 32 mm line plus the
// water it carries), so the sag reads heavy at working loads.
const WEIGHT = 2.6; // kg/m

function layTextures() {
  const n = 64;
  const nrm = new Uint8Array(n * n * 4);
  const col = new Uint8Array(n * n * 4);
  const hgt = (x, y) => {
    // Three strands laid diagonally around the rope (u along, v around).
    const s = ((x / n) * 3 + y / n) % 1;
    return Math.sin(s * Math.PI);
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = hgt((x + 1) % n, y) - hgt((x + n - 1) % n, y);
      const dy = hgt(x, (y + 1) % n) - hgt(x, (y + n - 1) % n);
      const v = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize();
      const i = (y * n + x) * 4;
      nrm[i] = (v.x * 0.5 + 0.5) * 255;
      nrm[i + 1] = (v.y * 0.5 + 0.5) * 255;
      nrm[i + 2] = (v.z * 0.5 + 0.5) * 255;
      nrm[i + 3] = 255;
      const shade = 0.72 + 0.28 * hgt(x, y);
      col[i] = 255 * shade;
      col[i + 1] = 255 * shade;
      col[i + 2] = 255 * shade;
      col[i + 3] = 255;
    }
  }
  const make = (data, srgb) => {
    const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { normal: make(nrm, false), color: make(col, true) };
}

export class RopeVisual {
  constructor(color = 0xe0a32e) {
    const n = TOW.rope.nodes;
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.freeEnd = false;
    this.age = 0;
    this.drip = 0;
    this.alive = true;
    const tex = layTextures();
    const verts = n * (SIDES + 1);
    const geo = new THREE.BufferGeometry();
    this.vPos = new Float32Array(verts * 3);
    this.vNrm = new Float32Array(verts * 3);
    this.vUv = new Float32Array(verts * 2);
    geo.setAttribute('position', new THREE.BufferAttribute(this.vPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.vNrm, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.vUv, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < SIDES; k++) {
        const a = i * (SIDES + 1) + k;
        const b = a + SIDES + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    geo.setIndex(idx);
    // Tangents for the normal map come from the uv layout.
    geo.setAttribute('tangent', new THREE.BufferAttribute(new Float32Array(verts * 4), 4).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.material = new THREE.MeshStandardMaterial({
      color,
      map: tex.color,
      normalMap: tex.normal,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.75,
      metalness: 0,
      transparent: true,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.name = 'towRope';
    this.tmp = { t: new THREE.Vector3(), nrm: new THREE.Vector3(1, 0, 0), b: new THREE.Vector3(), p: new THREE.Vector3() };
    this.initialized = false;
  }

  // Lay the rope out between a and b (slack sag toward the water).
  reset(a, b) {
    for (let i = 0; i < this.n; i++) {
      const u = i / (this.n - 1);
      const o = i * 3;
      this.pos[o] = a.x + (b.x - a.x) * u;
      this.pos[o + 1] = a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 1.5;
      this.pos[o + 2] = a.z + (b.z - a.z) * u;
    }
    this.prev.set(this.pos);
    this.initialized = true;
  }

  // Whip the target end free (line parted or cast off).
  release(whip = 0) {
    this.freeEnd = true;
    this.age = 0;
    const n = this.n;
    const o = (n - 1) * 3;
    const a = 0;
    const dx = this.pos[a] - this.pos[o];
    const dy = this.pos[a + 1] - this.pos[o + 1];
    const dz = this.pos[a + 2] - this.pos[o + 2];
    const d = Math.hypot(dx, dy, dz) || 1;
    // Stored stretch snaps back: the free half recoils toward the tug.
    for (let i = n >> 1; i < n; i++) {
      const w = ((i - (n >> 1)) / (n >> 1)) * whip * 0.06;
      const p = i * 3;
      this.prev[p] -= (dx / d) * w;
      this.prev[p + 1] -= (dy / d) * w - w * 0.3;
      this.prev[p + 2] -= (dz / d) * w;
    }
  }

  // a, b: world end points (THREE.Vector3); length: line length (m);
  // tension: N; waves: surface; camPos for distance-scaled thickness.
  update(dt, a, b, length, tension, waves, camPos, spray) {
    if (!this.initialized) {
      this.reset(a, b);
    }
    const n = this.n;
    const pos = this.pos;
    const prev = this.prev;
    dt = Math.min(dt, 1 / 20);
    if (this.freeEnd) {
      this.age += dt;
      // Hauled back aboard.
      length = Math.max(1, length * Math.max(0, 1 - this.age / 3));
      this.material.opacity = Math.max(0, 1 - Math.max(0, this.age - 3) / 1.5);
      if (this.age > 4.5) {
        this.alive = false;
      }
    }
    const g = 9.81 * dt * dt;
    for (let i = 1; i < n; i++) {
      if (i === n - 1 && !this.freeEnd) {
        break;
      }
      const o = i * 3;
      const h = waves.heightAt(pos[o], pos[o + 2]);
      const inWater = pos[o + 1] < h;
      const damp = inWater ? 0.8 : 0.997;
      for (let k = 0; k < 3; k++) {
        const v = (pos[o + k] - prev[o + k]) * damp;
        prev[o + k] = pos[o + k];
        pos[o + k] += v;
      }
      pos[o + 1] -= inWater ? g * 0.15 : g;
      if (inWater) {
        // Nearly neutral in water: slack line hangs just under the surface,
        // carried by the waves (it never sinks deeper than floatDepth).
        const sink = h - TOW.rope.floatDepth;
        if (pos[o + 1] < sink) {
          pos[o + 1] += (sink - pos[o + 1]) * 0.35;
        }
      }
    }
    this.pin(0, a);
    if (!this.freeEnd) {
      this.pin(n - 1, b);
    }
    const seg = length / (n - 1);
    for (let it = 0; it < TOW.rope.iterations; it++) {
      for (let i = 0; i < n - 1; i++) {
        this.constrain(i, i + 1, seg, i === 0, i + 1 === n - 1 && !this.freeEnd);
      }
    }
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (!this.freeEnd && tension > 0 && d > 0.5) {
      this.straighten(a, b, d, tension, spray, dt);
    }
    this.build(camPos);
  }

  pin(i, p) {
    const o = i * 3;
    this.pos[o] = this.prev[o] = p.x;
    this.pos[o + 1] = this.prev[o + 1] = p.y;
    this.pos[o + 2] = this.prev[o + 2] = p.z;
  }

  constrain(i, j, rest, pinI, pinJ) {
    const p = this.pos;
    const a = i * 3;
    const b = j * 3;
    const dx = p[b] - p[a];
    const dy = p[b + 1] - p[a + 1];
    const dz = p[b + 2] - p[a + 2];
    const d = Math.hypot(dx, dy, dz) || 1e-6;
    if (d <= rest) {
      return;
    }
    const diff = (d - rest) / d;
    const wa = pinI ? 0 : pinJ ? 1 : 0.5;
    const wb = pinJ ? 0 : pinI ? 1 : 0.5;
    p[a] += dx * diff * wa;
    p[a + 1] += dy * diff * wa;
    p[a + 2] += dz * diff * wa;
    p[b] -= dx * diff * wb;
    p[b + 1] -= dy * diff * wb;
    p[b + 2] -= dz * diff * wb;
  }

  // Taut: pull toward the catenary (parabolic sag w·L²/8T), shed drips.
  straighten(a, b, d, tension, spray, dt) {
    const n = this.n;
    const sag = Math.min(4, (WEIGHT * 9.81 * d * d) / (8 * Math.max(tension, 1)));
    // Pull toward the catenary gently so the line keeps its own inertia
    // (it swings and settles instead of snapping into place).
    const pull = Math.min(0.55, 0.12 + tension / 25000);
    for (let i = 1; i < n - 1; i++) {
      const u = i / (n - 1);
      const o = i * 3;
      const tx = a.x + (b.x - a.x) * u;
      const ty = a.y + (b.y - a.y) * u - 4 * sag * u * (1 - u);
      const tz = a.z + (b.z - a.z) * u;
      this.pos[o] += (tx - this.pos[o]) * pull;
      this.pos[o + 1] += (ty - this.pos[o + 1]) * pull;
      this.pos[o + 2] += (tz - this.pos[o + 2]) * pull;
    }
    if (spray) {
      this.drip += dt * Math.min(40, 4 + tension / 800);
      while (this.drip >= 1) {
        this.drip -= 1;
        const o = (1 + Math.floor(Math.random() * (n - 2))) * 3;
        spray.droplets(1, this.pos[o], this.pos[o + 1] - 0.05, this.pos[o + 2], 0, -0.3, 0, 0.4, 0.07, 0.9);
      }
    }
  }

  build(camPos) {
    const n = this.n;
    const t = this.tmp;
    let arc = 0;
    const tan = this.geo.attributes.tangent.array;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const i0 = Math.max(0, i - 1) * 3;
      const i1 = Math.min(n - 1, i + 1) * 3;
      t.t.set(this.pos[i1] - this.pos[i0], this.pos[i1 + 1] - this.pos[i0 + 1], this.pos[i1 + 2] - this.pos[i0 + 2]).normalize();
      // Parallel transport of the ring frame.
      t.nrm.addScaledVector(t.t, -t.nrm.dot(t.t));
      if (t.nrm.lengthSq() < 1e-6) {
        t.nrm.set(0, 1, 0).addScaledVector(t.t, -t.t.y);
      }
      t.nrm.normalize();
      t.b.crossVectors(t.t, t.nrm);
      if (i > 0) {
        arc += Math.hypot(this.pos[o] - this.pos[o - 3], this.pos[o + 1] - this.pos[o - 2], this.pos[o + 2] - this.pos[o - 1]);
      }
      const dist = Math.hypot(this.pos[o] - camPos.x, this.pos[o + 1] - camPos.y, this.pos[o + 2] - camPos.z);
      const r = Math.max(TOW.rope.radius, dist * 0.0016); // ~3 px at any range
      for (let k = 0; k <= SIDES; k++) {
        const th = (k / SIDES) * Math.PI * 2;
        const c = Math.cos(th);
        const s = Math.sin(th);
        const v = i * (SIDES + 1) + k;
        const nx = t.nrm.x * c + t.b.x * s;
        const ny = t.nrm.y * c + t.b.y * s;
        const nz = t.nrm.z * c + t.b.z * s;
        this.vNrm[v * 3] = nx;
        this.vNrm[v * 3 + 1] = ny;
        this.vNrm[v * 3 + 2] = nz;
        this.vPos[v * 3] = this.pos[o] + nx * r;
        this.vPos[v * 3 + 1] = this.pos[o + 1] + ny * r;
        this.vPos[v * 3 + 2] = this.pos[o + 2] + nz * r;
        // One lay repeat every ~3 rope diameters.
        this.vUv[v * 2] = arc / (TOW.rope.radius * 6);
        this.vUv[v * 2 + 1] = k / SIDES;
        tan[v * 4] = t.t.x;
        tan[v * 4 + 1] = t.t.y;
        tan[v * 4 + 2] = t.t.z;
        tan[v * 4 + 3] = 1;
      }
    }
    for (const name of ['position', 'normal', 'uv', 'tangent']) {
      this.geo.attributes[name].needsUpdate = true;
    }
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
  }
}
