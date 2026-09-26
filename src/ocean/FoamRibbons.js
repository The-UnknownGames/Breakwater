// Continuous foam ribbons for the wake: each segment is a tapered capsule
// between two wake particles (radius and strength interpolated along it),
// drawn into the foam map's B channel with MAX blending, so joints never
// double up and a stream reads as one smooth band instead of a string of
// dots. Positions are uploaded relative to the foam window centre.

import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute vec4 aSeg;    // A.xy, B.xy (metres, relative to the window centre)
attribute vec4 aRS;     // rA, rB, sA, sB
attribute vec2 aCorner; // -1..1 along, -1..1 across
uniform float uExtent;
uniform float uMinR;
varying vec2 vP;
varying vec4 vSeg;
varying vec4 vRS;
void main() {
  vec2 A = aSeg.xy;
  vec2 B = aSeg.zw;
  vec2 d = B - A;
  float len = length(d);
  vec2 t = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  // Ribbons thinner than ~1.5 texels would hit some texel centres and miss
  // others (beads): widen them to the minimum and thin the foam to match.
  vec2 rr = max(aRS.xy, vec2(uMinR));
  float r = max(rr.x, rr.y);
  vec2 p = mix(A - t * r, B + t * r, aCorner.x * 0.5 + 0.5) + n * r * aCorner.y;
  vP = p;
  vSeg = aSeg;
  vRS = vec4(rr, aRS.zw * aRS.xy / rr);
  gl_Position = vec4(p / uExtent * 2.0, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
varying vec2 vP;
varying vec4 vSeg;
varying vec4 vRS;
void main() {
  vec2 A = vSeg.xy;
  vec2 d = vSeg.zw - A;
  float h = clamp(dot(vP - A, d) / max(dot(d, d), 1e-6), 0.0, 1.0);
  float r = mix(vRS.x, vRS.y, h);
  float s = mix(vRS.z, vRS.w, h);
  float dist = length(vP - (A + d * h)) / r;
  float a = smoothstep(1.0, 0.15, dist) * s;
  gl_FragColor = vec4(0.0, 0.0, a, 0.0);
}
`;

export class FoamRibbons {
  constructor(max, extent, texel) {
    this.max = max;
    this.count = 0;
    this.seg = new Float32Array(max * 16);
    this.rs = new Float32Array(max * 16);
    const corner = new Float32Array(max * 8);
    const index = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) {
      corner.set([-1, -1, 1, -1, 1, 1, -1, 1], i * 8);
      const v = i * 4;
      index.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 12), 3));
    geo.setAttribute('aSeg', new THREE.BufferAttribute(this.seg, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRS', new THREE.BufferAttribute(this.rs, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uExtent: { value: extent }, uMinR: { value: texel * 1.5 } },
      vertexShader,
      fragmentShader,
      blending: THREE.CustomBlending,
      blendEquation: THREE.MaxEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
  }

  // A, B relative to the window centre (m); radii (m); strengths.
  add(ax, az, bx, bz, ra, rb, sa, sb) {
    if (this.count >= this.max) {
      return;
    }
    const i = this.count++;
    for (let k = 0; k < 4; k++) {
      const o = (i * 4 + k) * 4;
      this.seg[o] = ax;
      this.seg[o + 1] = az;
      this.seg[o + 2] = bx;
      this.seg[o + 3] = bz;
      this.rs[o] = ra;
      this.rs[o + 1] = rb;
      this.rs[o + 2] = sa;
      this.rs[o + 3] = sb;
    }
  }

  render(renderer, camera) {
    if (this.count === 0) {
      return;
    }
    this.geo.setDrawRange(0, this.count * 6);
    for (const name of ['aSeg', 'aRS']) {
      const attr = this.geo.attributes[name];
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, this.count * 16);
      attr.needsUpdate = true;
    }
    renderer.render(this.scene, camera);
    this.count = 0;
  }
}
