// Dynamic foam (spec 2.5): a ping-pong render target covering FOAM.extent
// metres around the player. Each frame the previous map is shifted (the
// window follows the player, snapped to texels) and faded, then new stamps
// (wake, bow wave, hull contact, slams) are splatted additively into R.
// G holds this frame's hull footprint (not persisted): the ocean shader
// darkens the water there and drops its sky reflection.

import * as THREE from 'three';
import { FOAM } from '../config/render.js';

const quadVS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fadeFS = /* glsl */ `
uniform sampler2D uPrev;
uniform vec2 uShift;
uniform float uFade;
varying vec2 vUv;
void main() {
  vec2 uv = vUv + uShift;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float v = texture2D(uPrev, uv).r * uFade * inside;
  gl_FragColor = vec4(v, 0.0, 0.0, 1.0);
}
`;

const stampVS = /* glsl */ `
attribute float aSize;
attribute float aStrength;
attribute float aChannel;
varying float vStrength;
varying float vChannel;
void main() {
  vStrength = aStrength;
  vChannel = aChannel;
  gl_PointSize = aSize;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const stampFS = /* glsl */ `
varying float vStrength;
varying float vChannel;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, 0.2, r) * vStrength;
  gl_FragColor = vec4(a * (1.0 - vChannel), a * vChannel, 0.0, 1.0);
}
`;

function makeTarget(size) {
  return new THREE.WebGLRenderTarget(size, size, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
}

export class Foam {
  constructor(renderer) {
    this.renderer = renderer;
    this.size = FOAM.resolution;
    this.extent = FOAM.extent;
    this.texel = this.extent / this.size;
    this.read = makeTarget(this.size);
    this.write = makeTarget(this.size);
    this.center = new THREE.Vector2();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fadeMat = new THREE.ShaderMaterial({
      uniforms: { uPrev: { value: null }, uShift: { value: new THREE.Vector2() }, uFade: { value: 1 } },
      vertexShader: quadVS,
      fragmentShader: fadeFS,
      depthTest: false,
      depthWrite: false,
    });
    this.fadeScene = new THREE.Scene();
    this.fadeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fadeMat));
    const max = FOAM.maxStamps;
    this.stampPos = new Float32Array(max * 3);
    this.stampSize = new Float32Array(max);
    this.stampStrength = new Float32Array(max);
    this.stampChannel = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.stampPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.stampSize, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aStrength', new THREE.BufferAttribute(this.stampStrength, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aChannel', new THREE.BufferAttribute(this.stampChannel, 1).setUsage(THREE.DynamicDrawUsage));
    this.stampGeo = geo;
    const stampMat = new THREE.ShaderMaterial({
      vertexShader: stampVS,
      fragmentShader: stampFS,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.stamps = new THREE.Points(geo, stampMat);
    this.stamps.frustumCulled = false;
    this.stampScene = new THREE.Scene();
    this.stampScene.add(this.stamps);
    this.count = 0;
    this.uniforms = {
      uFoamMap: { value: this.read.texture },
      uFoamCenter: { value: this.center },
      uFoamExtent: { value: this.extent },
    };
  }

  // Splat foam at world (x, z). radius in metres, strength ~0..1 per call.
  paint(x, z, radius, strength, channel = 0) {
    if (this.count >= FOAM.maxStamps) {
      return;
    }
    const i = this.count++;
    this.stampPos[i * 3] = ((x - this.center.x) / this.extent) * 2;
    this.stampPos[i * 3 + 1] = ((z - this.center.y) / this.extent) * 2;
    this.stampSize[i] = Math.max(1.5, (radius * 2) / this.texel);
    this.stampStrength[i] = strength;
    this.stampChannel[i] = channel;
  }

  // Hull footprint for this frame only (G channel).
  paintShade(x, z, radius, strength) {
    this.paint(x, z, radius, strength, 1);
  }

  // Call before painting each frame: moves the window and fades old foam.
  begin(dt, focusX, focusZ) {
    const nx = Math.round(focusX / this.texel) * this.texel;
    const nz = Math.round(focusZ / this.texel) * this.texel;
    const shift = this.fadeMat.uniforms.uShift.value;
    shift.set((nx - this.center.x) / this.extent, (nz - this.center.y) / this.extent);
    this.center.set(nx, nz);
    this.fadeMat.uniforms.uFade.value = Math.exp(-dt / FOAM.fadeSeconds);
    this.count = 0;
  }

  end() {
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevAuto = r.autoClear;
    this.fadeMat.uniforms.uPrev.value = this.read.texture;
    r.setRenderTarget(this.write);
    r.autoClear = true;
    r.render(this.fadeScene, this.camera);
    if (this.count > 0) {
      const g = this.stampGeo;
      g.setDrawRange(0, this.count);
      for (const name of ['position', 'aSize', 'aStrength', 'aChannel']) {
        g.attributes[name].needsUpdate = true;
      }
      r.autoClear = false;
      r.render(this.stampScene, this.camera);
    }
    r.setRenderTarget(prevTarget);
    r.autoClear = prevAuto;
    const t = this.read;
    this.read = this.write;
    this.write = t;
    this.uniforms.uFoamMap.value = this.read.texture;
  }
}
