// Post chain: render (linear HDR) -> bloom (high threshold: sun, lightning,
// searchlight core only) -> output (ACES tone map + sRGB) -> grade + vignette
// -> SMAA or FXAA. Every pass is toggled by the quality preset.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { POST } from '../config/render.js';
import { LensDrops, LensShader } from './LensDrops.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1 },
    uContrast: { value: 1 },
    uTint: { value: new THREE.Vector3(0.97, 1.0, 1.03) },
    uVignette: { value: POST.vignette },
    uAspect: { value: 16 / 9 },
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
    uniform float uSaturation;
    uniform float uContrast;
    uniform vec3 uTint;
    uniform float uVignette;
    uniform float uAspect;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      // S-curve contrast that keeps black at black (no crushed night scenes).
      vec3 s = clamp(col, 0.0, 1.0);
      col = mix(col, s * s * (3.0 - 2.0 * s), clamp((uContrast - 1.0) * 2.0, 0.0, 1.0));
      col *= uTint;
      vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0);
      float v = 1.0 - uVignette * smoothstep(0.35, 1.05, length(d));
      col *= v;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer;
    const size = renderer.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(size.clone(), POST.bloomStrength, POST.bloomRadius, POST.bloomThreshold);
    this.bloom.enabled = quality.bloom;
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    // Rain on the lens / windows (V5), in display space.
    this.drops = new LensDrops();
    this.lens = new ShaderPass(LensShader);
    this.lens.uniforms.tDrops.value = this.drops.texture;
    this.lens.enabled = false;
    this.lensAllowed = quality.drops !== false;
    this.composer.addPass(this.lens);
    this.grade = new ShaderPass(GradeShader);
    this.grade.enabled = quality.grade;
    this.composer.addPass(this.grade);
    this.smaa = new SMAAPass(size.x, size.y);
    this.smaa.enabled = quality.smaa;
    this.composer.addPass(this.smaa);
    this.fxaa = new ShaderPass(FXAAShader);
    this.fxaa.enabled = quality.fxaa;
    this.composer.addPass(this.fxaa);
    this.setSize(size.x, size.y);
  }

  setCamera(camera) {
    this.renderPass.camera = camera;
  }

  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    this.grade.uniforms.uAspect.value = w / h;
  }

  // warmth 0..1: golden hour pulls the neutral cool tint toward amber.
  setGrade(saturation, contrast, warmth = 0) {
    this.grade.uniforms.uSaturation.value = saturation;
    this.grade.uniforms.uContrast.value = contrast;
    const w = Math.min(1, warmth) * POST.goldenWarmth;
    this.grade.uniforms.uTint.value.set(0.97 + 0.13 * w, 1.0 - 0.02 * w, 1.03 - 0.2 * w);
  }

  // rain 0..1, facing: looking into the wind 0..1, helm: window mode.
  // drawBlade: false when the boat model has its own wiper arms.
  updateDrops(dt, rain, facing, helm, drawBlade = true) {
    if (!this.lensAllowed) {
      return;
    }
    this.drops.update(dt, rain, facing, helm);
    this.lens.enabled = this.drops.active;
    const u = this.lens.uniforms;
    u.uBlade.value.set(this.drops.bladeAngle ?? 0, this.drops.wiperOn ? 1 : 0, drawBlade ? this.grade.uniforms.uAspect.value : 0);
  }

  render() {
    this.composer.render();
  }
}
