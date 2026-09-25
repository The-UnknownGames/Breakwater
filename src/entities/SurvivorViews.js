// Visuals for people in the water and life rafts. Survivors: head and
// shoulders in an orange lifejacket with reflective tape, one arm waving
// (slower as they chill). Rafts: black buoyancy tube, orange canopy, a
// light on top; they pitch with the wave slope. Survivors aboard sit on the
// player's deck.

import * as THREE from 'three';
import { WORLD } from '../config/palette.js';

function std(color, rough = 0.6) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough });
}

const MATS = {
  skin: std(0xc99a7c, 0.7),
  jacket: std(WORLD.rescueOrange, 0.55),
  tape: std(0xdde2e2, 0.25),
  hood: std(0x1f2a33, 0.8),
  tube: std(0x1b1d1f, 0.5),
  canopy: std(0xe2622c, 0.7),
  floor: std(0x2a2c2e, 0.8),
  lamp: new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 2 }),
};

function survivorMesh() {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), MATS.skin);
  head.position.y = 0.32;
  g.add(head);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), MATS.hood);
  hood.position.y = 0.33;
  hood.rotation.x = -0.35;
  g.add(hood);
  const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.36, 12), MATS.jacket);
  vest.position.y = 0.06;
  g.add(vest);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.07, 8, 14), MATS.jacket);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.22;
  g.add(collar);
  const tape = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.24, 0.04, 12), MATS.tape);
  tape.position.y = 0.12;
  g.add(tape);
  const armPivot = new THREE.Group();
  armPivot.position.set(0.22, 0.18, 0);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.45, 4, 8), MATS.jacket);
  arm.position.y = 0.28;
  armPivot.add(arm);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), MATS.skin);
  hand.position.y = 0.56;
  armPivot.add(hand);
  g.add(armPivot);
  g.userData.arm = armPivot;
  g.traverse((o) => {
    o.castShadow = true;
  });
  return g;
}

function raftMesh() {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.22, 10, 28), MATS.tube);
  tube.rotation.x = Math.PI / 2;
  tube.position.y = 0.08;
  g.add(tube);
  const upper = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.18, 10, 28), MATS.tube);
  upper.rotation.x = Math.PI / 2;
  upper.position.y = 0.42;
  g.add(upper);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), MATS.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.05;
  g.add(floor);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 10, 0.5, Math.PI * 2 - 1.0, 0, Math.PI / 2), MATS.canopy);
  canopy.scale.y = 0.95;
  canopy.position.y = 0.5;
  canopy.material.side = THREE.DoubleSide;
  g.add(canopy);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 6, 24, Math.PI), MATS.tube);
  arch.position.y = 0.5;
  g.add(arch);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), MATS.lamp);
  lamp.position.y = 1.5;
  g.add(lamp);
  const tape = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.03, 6, 24), MATS.tape);
  tape.rotation.x = Math.PI / 2;
  tape.position.y = 1.08;
  g.add(tape);
  g.traverse((o) => {
    o.castShadow = true;
  });
  return g;
}

const tmpV = new THREE.Vector3();

export class SurvivorViews {
  constructor(scene, field) {
    this.scene = scene;
    this.field = field;
    this.people = new Map();
    this.rafts = new Map();
    this.n = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
    this.t = 0;
  }

  // Hauled up the hull side to the gunwale as the pull progresses.
  hauled(m, s, k, boatModel, hull) {
    const e = k * k * (3 - 2 * k);
    tmpV.set(s.x, s.y - 0.18, s.z);
    boatModel.worldToLocal(tmpV);
    const side = tmpV.x >= 0 ? 1 : -1;
    const z = Math.max(-hull.length / 2 + 1, Math.min(hull.length / 2 - 2, tmpV.z));
    const beam = hull.beam / 2;
    const deck = hull.freeboard + 0.35;
    const lx = tmpV.x + (side * (beam + 0.25) - tmpV.x) * Math.min(1, e * 2.2);
    const ly = tmpV.y + (deck - tmpV.y) * Math.max(0, (e - 0.35) / 0.65);
    const lz = tmpV.z + (z - tmpV.z) * e;
    m.position.set(lx, ly, lz);
    boatModel.localToWorld(m.position);
    m.userData.arm.rotation.z = -2.6;
    m.rotation.set(0, 0, 0);
    m.quaternion.premultiply(boatModel.quaternion);
  }

  // boatModel: the player's model (survivors aboard sit on its deck);
  // pull: Operations.pull ({ survivor, t }) while hauling someone aboard;
  // hull: player's hull config (for the side they are hauled up).
  update(dt, waves, boatModel, pull = null, hull = null, pullSeconds = 1) {
    this.t += dt;
    const seen = new Set();
    for (const r of this.field.rafts) {
      let m = this.rafts.get(r.id);
      if (!m) {
        m = raftMesh();
        this.rafts.set(r.id, m);
        this.scene.add(m);
      }
      seen.add(m);
      m.position.set(r.x, r.y - 0.12, r.z);
      const nrm = waves.normalAt(r.x, r.z);
      this.n.set(nrm.x, nrm.y, nrm.z).normalize();
      this.q.setFromUnitVectors(this.up, this.n);
      m.quaternion.copy(this.q).multiply(new THREE.Quaternion().setFromAxisAngle(this.up, r.heading));
    }
    let seat = 0;
    for (const s of this.field.survivors) {
      let m = this.people.get(s.id);
      if (!m) {
        m = survivorMesh();
        this.people.set(s.id, m);
        this.scene.add(m);
      }
      seen.add(m);
      m.visible = s.state === 'water' || s.state === 'aboard';
      if (s.state === 'water') {
        const bob = Math.sin(this.t * 1.7 + s.phase) * 0.04;
        m.position.set(s.x, s.y - 0.18 + bob, s.z);
        m.rotation.set(0, s.phase + this.t * 0.1, Math.sin(this.t * 1.3 + s.phase) * 0.12);
        // Waving slows as hypothermia sets in.
        const vigour = Math.max(0.15, 1 - s.urgency);
        m.userData.arm.rotation.z = -0.3 - vigour * (0.6 + 0.5 * Math.sin(this.t * (2 + 3 * vigour) + s.phase));
        if (pull && pull.survivor === s && boatModel && hull) {
          this.hauled(m, s, pull.t / pullSeconds, boatModel, hull);
        }
      } else if (s.state === 'aboard' && boatModel) {
        // Seated along the aft deck, huddled.
        const side = seat % 2 ? 1 : -1;
        const row = Math.floor(seat / 2);
        m.position.set(side * 1.25, 1.35, -2.2 - row * 0.9);
        m.rotation.set(0, side * -Math.PI / 2, 0);
        m.userData.arm.rotation.z = -0.25;
        boatModel.localToWorld(m.position);
        m.quaternion.premultiply(boatModel.quaternion);
        seat++;
      }
    }
    if (pull && pull.survivor.state === 'raft' && boatModel && hull) {
      // Out of the raft's doorway and up the side.
      const m = this.people.get(pull.survivor.id);
      if (m) {
        m.visible = true;
        this.hauled(m, pull.survivor, pull.t / pullSeconds, boatModel, hull);
      }
    }
    for (const map of [this.people, this.rafts]) {
      for (const [id, m] of map) {
        if (!seen.has(m)) {
          this.scene.remove(m);
          map.delete(id);
        }
      }
    }
  }
}
