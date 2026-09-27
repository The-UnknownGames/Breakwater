// Model loading: a Blender-generated .glb when public/models/manifest.json
// lists one, otherwise the procedural fallback. The manifest avoids 404s.

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildMarlinModel } from './MarlinModel.js';
import { buildKestrelModel, buildBulwarkModel } from './BoatModels.js';
import { buildSolaceModel, buildIslanderModel, buildNorthfarerModel } from './ShipModels.js';
import { buildTrawlerModel } from './TargetModels.js';
import { hullStation } from '../../physics/HullShape.js';
import * as THREE from 'three';
import { mergeStatic } from './mergeStatic.js';

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

export const FALLBACK_MODELS = {
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

// Manifest entries: a boat id (a glb built for the game: right size, bow
// +Z, waterline at y = 0, named empties) or, for a downloaded model,
// { id, file, yawDeg, scale, lift, credit }: it is fitted to the hull.
function entryFor(m, id) {
  for (const e of m.models) {
    if (e === id) {
      return { id, native: true };
    }
    if (e && e.id === id) {
      return e;
    }
  }
  return null;
}

const EMPTIES = ['helmCamera', 'towPoint', 'bowCleat', 'searchlight', 'propeller', 'rudder'];

// Fit a downloaded model to the boat: turn it bow-forward (+Z; the longest
// horizontal side, or yawDeg), scale it to the hull length, centre it and
// sit its keel at the design draft (+ lift). The named empties it lacks
// (tow point, helm camera...) come from the procedural model, so gameplay
// attaches where the physics expects.
export function fitImported(scene, cfg, e = {}) {
  const inner = new THREE.Group();
  inner.add(scene);
  scene.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const yaw = e.yawDeg !== undefined ? (e.yawDeg * Math.PI) / 180 : size.x > size.z ? -Math.PI / 2 : 0;
  inner.rotation.y = yaw;
  inner.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(inner);
  const len = box.max.z - box.min.z;
  const k = (cfg.hull.length / len) * (e.scale || 1);
  inner.scale.setScalar(k);
  inner.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(inner);
  inner.position.set(-(box.min.x + box.max.x) / 2, -cfg.hull.draft - box.min.y + (e.lift || 0), -(box.min.z + box.max.z) / 2);
  const root = new THREE.Group();
  root.add(inner);
  const proc = FALLBACK_MODELS[cfg.id](cfg);
  proc.updateMatrixWorld(true);
  for (const name of EMPTIES) {
    if (scene.getObjectByName(name)) {
      continue;
    }
    const src = proc.getObjectByName(name);
    if (src) {
      const o = new THREE.Object3D();
      o.name = name;
      src.getWorldPosition(o.position);
      root.add(o);
    }
  }
  root.userData.credit = e.credit || '';
  return root;
}

export async function loadBoatModel(cfg) {
  const m = await loadManifest();
  const e = entryFor(m, cfg.id);
  if (e) {
    try {
      const gltf = await new GLTFLoader().loadAsync(`models/${e.file || `${cfg.id}.glb`}`);
      const root = e.native ? gltf.scene : fitImported(gltf.scene, cfg, e);
      root.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      root.userData.source = 'glb';
      return root;
    } catch (err) {
      console.warn(`model ${cfg.id} failed, using procedural`, err);
    }
  }
  const root = mergeStatic(FALLBACK_MODELS[cfg.id](cfg));
  root.userData.source = 'procedural';
  return root;
}

// Credits for downloaded models (manifest), for the settings screen.
export async function modelCredits() {
  const m = await loadManifest();
  return m.models.filter((e) => e && e.credit).map((e) => e.credit);
}
