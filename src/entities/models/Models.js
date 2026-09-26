// Model loading: a Blender-generated .glb when public/models/manifest.json
// lists one, otherwise the procedural fallback. The manifest avoids 404s.

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildMarlinModel } from './MarlinModel.js';
import { buildKestrelModel, buildBulwarkModel } from './BoatModels.js';
import { buildSolaceModel, buildIslanderModel, buildNorthfarerModel } from './ShipModels.js';
import { buildTrawlerModel } from './TargetModels.js';
import { hullStation } from '../../physics/HullShape.js';
import * as THREE from 'three';

// The traffic trawler as a player boat: add the named empties it lacks.
function buildKittiwakeModel(cfg) {
  const g = buildTrawlerModel(cfg);
  const h = cfg.hull;
  const deck = (z) => hullStation(h, Math.min(1, Math.max(0, z / h.length + 0.5))).deck;
  const add = (name, x, y, z) => {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(x, y, z);
    g.add(o);
  };
  add('helmCamera', -0.6, deck(2.5) + 1.75, 3.3);
  add('towPoint', 0, deck(-h.length / 2 + 1.3) + 0.45, -h.length / 2 + 1.3);
  add('bowCleat', 0, deck(h.length / 2 - 0.6) + 0.1, h.length / 2 - 0.6);
  add('searchlight', 0.6, deck(2.5) + 2.6, 3.8);
  add('propeller', ...cfg.prop.pos);
  add('rudder', ...cfg.rudder.pos);
  return g;
}

const FALLBACKS = {
  marlin: buildMarlinModel,
  kestrel: buildKestrelModel,
  bulwark: buildBulwarkModel,
  kittiwake: buildKittiwakeModel,
  solace: buildSolaceModel,
  islander: buildIslanderModel,
  northfarer: buildNorthfarerModel,
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
