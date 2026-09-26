// WebGL renderer setup (spec 2.4): sRGB output, ACES filmic tone mapping.

import * as THREE from 'three';

export function createRenderer(container, quality) {
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    // Only needed for test screenshots; costs memory on phones.
    preserveDrawingBuffer: quality.preserveBuffer !== false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * quality.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}
