// Rain on the glass (V5): drops on the camera lens in chase/orbit view, and
// on the wheelhouse windows in the helm view, where a wiper sweeps them.
// A small CPU simulation draws each drop into a canvas as a refraction
// offset (RG) and mask (B); a post pass bends the image through them.

import * as THREE from 'three';
import { DROPS } from '../config/render.js';

function dropSprite(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - r) / r;
      const dy = (y + 0.5 - r) / r;
      const d = Math.hypot(dx, dy);
      const o = (y * size + x) * 4;
      if (d >= 1) {
        img.data[o + 3] = 0;
        continue;
      }
      img.data[o] = 128 + dx * 127;
      img.data[o + 1] = 128 + dy * 127;
      img.data[o + 2] = 255 * Math.min(1, (1 - d) * 5);
      img.data[o + 3] = 255 * Math.min(1, (1 - d) * 4);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export class LensDrops {
  constructor() {
    const [w, h] = DROPS.canvas;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.sprite = dropSprite(32);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.drops = [];
    this.acc = 0;
    this.wiper = 0; // phase
    this.wiperOn = false;
    this.redraw = 0;
    this.clear();
  }

  clear() {
    const [w, h] = DROPS.canvas;
    this.ctx.fillStyle = 'rgb(128,128,0)';
    this.ctx.fillRect(0, 0, w, h);
    this.texture.needsUpdate = true;
  }

  add(n, big = false) {
    const [w, h] = DROPS.canvas;
    for (let i = 0; i < n && this.drops.length < DROPS.maxDrops; i++) {
      const [r0, r1] = DROPS.radius;
      const r = r0 + (r1 - r0) * Math.pow(Math.random(), big ? 1 : 2.5);
      const life = DROPS.lensLife[0] + Math.random() * (DROPS.lensLife[1] - DROPS.lensLife[0]);
      this.drops.push({ x: Math.random() * w, y: Math.random() * h, r, vy: 0, age: 0, life, wob: Math.random() * 6 });
    }
  }

  // Spray over the glass (a slam in the helm view).
  splash() {
    this.add(DROPS.slamDrops, true);
  }

  // rain 0..1; facing 0..1 (looking into the wind); helm: window mode.
  update(dt, rain, facing, helm) {
    const [w, h] = DROPS.canvas;
    const rate = helm ? DROPS.helmRate * rain : DROPS.lensRate * rain * (0.2 + 0.8 * facing);
    this.acc += rate * dt;
    const n = Math.floor(this.acc);
    this.acc -= n;
    this.add(n);
    // Wiper: sweeps while it rains in the helm view.
    this.wiperOn = helm && rain > 0.05;
    let bladeA = null;
    if (this.wiperOn) {
      this.wiper += dt / DROPS.wiperPeriod;
      bladeA = Math.sin(this.wiper * Math.PI) * DROPS.wiperArc;
    }
    const pivot = { x: w * 0.5, y: h * 1.08 };
    for (const d of this.drops) {
      d.age += dt;
      if (d.r > DROPS.slideFrom) {
        // Heavy drops run down, wobbling, and shrink as they leave a trail.
        d.vy = Math.min(90, d.vy + (d.r - DROPS.slideFrom) * 60 * dt);
        d.y += d.vy * dt;
        d.x += Math.sin(d.age * 3 + d.wob) * 6 * dt;
        d.r -= dt * 0.25;
      }
      if (bladeA !== null) {
        const a = Math.atan2(d.x - pivot.x, pivot.y - d.y);
        if (Math.abs(a - bladeA) < 0.06) {
          d.dead = true;
        }
      }
      if ((!helm && d.age > d.life) || d.y - d.r > h) {
        d.dead = true;
      }
    }
    this.drops = this.drops.filter((d) => !d.dead);
    this.bladeAngle = bladeA;
    // Redraw at ~30 Hz.
    this.redraw -= dt;
    if (this.redraw > 0) {
      return;
    }
    this.redraw = 1 / 30;
    const g = this.ctx;
    g.fillStyle = 'rgb(128,128,0)';
    g.fillRect(0, 0, w, h);
    for (const d of this.drops) {
      const fade = helm ? 1 : Math.min(1, (d.life - d.age) / 1.5);
      g.globalAlpha = Math.max(0, fade);
      // Drops are a little taller than wide as they run.
      const s = d.r * 2;
      g.drawImage(this.sprite, d.x - d.r, d.y - d.r * (d.vy > 0 ? 1.3 : 1), s, s * (d.vy > 0 ? 1.3 : 1));
    }
    g.globalAlpha = 1;
    this.texture.needsUpdate = true;
  }

  get active() {
    return this.drops.length > 0 || this.wiperOn;
  }
}

export const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDrops: { value: null },
    uRefract: { value: DROPS.refract },
    uBlade: { value: new THREE.Vector3(0, 0, 0) }, // angle, on, aspect
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDrops;
    uniform float uRefract;
    uniform vec3 uBlade;
    varying vec2 vUv;
    void main() {
      vec2 duv = vec2(vUv.x, 1.0 - vUv.y);
      vec4 d = texture2D(tDrops, duv);
      float m = d.b;
      vec2 n = (d.rg - 0.5) * 2.0;
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      // A drop is a tiny lens: the scene seen through it, flipped and blurred.
      vec2 off = vec2(n.x, -n.y) * uRefract * m;
      vec3 seen = (texture2D(tDiffuse, vUv - off).rgb * 2.0 + texture2D(tDiffuse, vUv - off * 1.4).rgb + texture2D(tDiffuse, vUv - off * 0.6).rgb) * 0.25;
      float rim = smoothstep(0.55, 1.0, length(n));
      seen *= 1.0 - 0.35 * rim;
      float spec = pow(max(dot(normalize(vec3(n.x, -n.y, 0.7)), normalize(vec3(-0.35, 0.55, 0.75))), 0.0), 18.0);
      seen += spec * 0.35;
      vec3 col = mix(base, seen, m);
      // Wiper blade (helm view) for boats without modelled wipers.
      if (uBlade.y > 0.5 && uBlade.z > 0.0) {
        vec2 p = vec2((vUv.x - 0.5) * uBlade.z, vUv.y + 0.08);
        vec2 dir = vec2(sin(uBlade.x), cos(uBlade.x));
        float along = dot(p, dir);
        float across = abs(p.x * dir.y - p.y * dir.x);
        float blade = (1.0 - smoothstep(0.004, 0.009, across)) * step(0.12, along) * step(along, 0.95);
        col = mix(col, vec3(0.02), blade * 0.9);
      }
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
