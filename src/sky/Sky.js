// Atmospheric sky (Three.js Preetham Sky) + cloud dome, and the reflection
// environment: sky and clouds are rendered to a cube camera every few
// seconds (layer 1 only) for the ocean, and PMREM-filtered for PBR materials.

import * as THREE from 'three';
import { Sky as SkyShader } from 'three/examples/jsm/objects/Sky.js';
import { Clouds } from './Clouds.js';
import { SKY } from '../config/render.js';

export const SKY_LAYER = 1;

export class SkySystem {
  constructor(renderer, scene, quality) {
    this.renderer = renderer;
    this.scene = scene;
    this.sky = new SkyShader();
    this.sky.scale.setScalar(SKY.cloudRadius * 1.2);
    this.sky.renderOrder = -2;
    this.sky.frustumCulled = false;
    this.sky.material.depthTest = false;
    const u = this.sky.material.uniforms;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;
    u.rayleigh.value = SKY.rayleigh;
    // Preetham output is ~4x brighter than the rest of the lighting model.
    u.uSkyScale = { value: SKY.preethamScale };
    this.sky.material.fragmentShader = this.sky.material.fragmentShader
      .replace('void main() {', 'uniform float uSkyScale;\nvoid main() {')
      .replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * uSkyScale, 1.0 );');
    this.clouds = new Clouds(quality.cloudOctaves);
    for (const obj of [this.sky, this.clouds.mesh]) {
      obj.layers.enable(SKY_LAYER);
      scene.add(obj);
    }
    this.cubeTarget = new THREE.WebGLCubeRenderTarget(quality.envSize, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.cubeCamera = new THREE.CubeCamera(1, SKY.cloudRadius * 2, this.cubeTarget);
    this.cubeCamera.layers.set(SKY_LAYER);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmremTarget = null;
    this.refreshTimer = 0;
    this.forceRefresh = true;
  }

  get envMap() {
    return this.cubeTarget.texture;
  }

  update(dt, camera, sunDir, turbidity) {
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(sunDir);
    u.turbidity.value = turbidity;
    this.sky.position.copy(camera.position);
    this.refreshTimer -= dt;
    if (this.refreshTimer <= 0 || this.forceRefresh) {
      this.refreshTimer = SKY.envRefreshSeconds;
      this.forceRefresh = false;
      this.refreshEnvironment(camera);
    }
  }

  refreshEnvironment(camera) {
    this.cubeCamera.position.set(camera.position.x, 2, camera.position.z);
    this.sky.position.copy(this.cubeCamera.position);
    this.clouds.mesh.position.copy(this.cubeCamera.position);
    this.cubeCamera.update(this.renderer, this.scene);
    const next = this.pmrem.fromCubemap(this.cubeTarget.texture, this.pmremTarget || undefined);
    this.pmremTarget = next;
    this.scene.environment = next.texture;
    this.sky.position.copy(camera.position);
    this.clouds.mesh.position.copy(camera.position);
  }
}
