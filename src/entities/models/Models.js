// Model loading: a Blender-generated .glb when public/models/manifest.json
// lists one, otherwise the procedural fallback. The manifest avoids 404s.

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildMarlinModel } from './MarlinModel.js';
import { buildKestrelModel, buildBulwarkModel } from './BoatModels.js';

const FALLBACKS = {
  marlin: buildMarlinModel,
  kestrel: buildKestrelModel,
  bulwark: buildBulwarkModel,
};

let manifest = null;

async function loadManifest() {
  if (manifest) {
    return manifest;
  }
  try {
    const res = await fetch('models/manifest.json');
    manifest = res.ok ? await res.json() : { models: [] };
  } catch {
    manifest = { models: [] };
  }
  return manifest;
}

export async function loadBoatModel(cfg) {
  const m = await loadManifest();
  if (m.models.includes(cfg.id)) {
    try {
      const gltf = await new GLTFLoader().loadAsync(`models/${cfg.id}.glb`);
      const root = gltf.scene;
      root.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      root.userData.source = 'glb';
      return root;
    } catch (e) {
      console.warn(`model ${cfg.id}.glb failed, using procedural`, e);
    }
  }
  const root = FALLBACKS[cfg.id](cfg);
  root.userData.source = 'procedural';
  return root;
}
