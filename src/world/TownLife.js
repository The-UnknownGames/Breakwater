// Life in the towns (V7): townspeople as distant silhouettes (standing,
// fishing off the pier and the breakwater, strolling the street) that are
// never seen up close, shapes moving in the pub windows at night, and cars
// on the coastal road. A rigged `townsperson` model listed in
// public/models/manifest.json replaces the silhouettes automatically.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TownNav } from '../foot/TownNav.js';
import { KETTLE, TOWN_Y } from '../config/town.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadManifest } from '../entities/models/Models.js';

const COATS = [0x2b3f55, 0x3d4a3a, 0x5a3d26, 0x6b6f72, 0x1c2a36, 0x7a3b2e, 0xd2a22a, 0xe0582a];
const HIDE_NEAR = 14; // m: people step away from the viewer before this (never seen up close)
const CAR_SPEED = 11;

function colored(g, color) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}

// A 1.75 m figure: legs, coat, head; white coat (instance colour tints it).
function personGeometry() {
  const legs = colored(new THREE.BoxGeometry(0.36, 0.85, 0.22).translate(0, 0.43, 0), 0x2a2c2e);
  const coat = colored(new THREE.CylinderGeometry(0.2, 0.25, 0.7, 8).translate(0, 1.2, 0), 0xffffff);
  const head = colored(new THREE.SphereGeometry(0.12, 8, 6).translate(0, 1.66, 0), 0xc9a58a);
  const cap = colored(new THREE.CylinderGeometry(0.12, 0.13, 0.08, 8).translate(0, 1.76, 0), 0x1f2326);
  return mergeGeometries([legs, coat, head, cap]);
}

function carGeometry(color) {
  const body = colored(new THREE.BoxGeometry(1.75, 0.7, 4.2).translate(0, 0.62, 0), color);
  const cab = colored(new THREE.BoxGeometry(1.55, 0.55, 2.1).translate(0, 1.24, -0.2), 0x1c262c);
  const wheels = [[0.8, 1.35], [-0.8, 1.35], [0.8, -1.35], [-0.8, -1.35]].map(([x, z]) => colored(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 10).rotateZ(Math.PI / 2).translate(x, 0.33, z), 0x151617));
  return mergeGeometries([body, cab, ...wheels]);
}

export class TownLife {
  constructor(scene, towns) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'town-life';
    this.people = [];
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3(1, 1, 1);
    this.color = new THREE.Color();
    let k = 0;
    for (const t of towns) {
      for (const p of t.people) {
        this.people.push({ town: t, a: p.a, o: p.o, y: p.y, face: p.face, pose: p.pose, color: COATS[k++ % COATS.length], phase: k * 1.7 });
      }
      if (t.kind === 'kettle') {
        this.kettle = t;
        this.nav = new TownNav(t);
        for (let i = 0; i < 7; i++) {
          this.people.push({ town: t, a: -100 + i * 28, o: -38 + (i % 2) * 4, y: TOWN_Y, face: 0, pose: 'walk', color: COATS[k++ % COATS.length], phase: i * 2.3, path: null });
        }
      }
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    this.mesh = new THREE.InstancedMesh(personGeometry(), mat, this.people.length);
    this.mesh.name = 'townspeople';
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.people.forEach((p, i) => this.mesh.setColorAt(i, this.color.set(p.color)));
    this.group.add(this.mesh);
    // Fishing rods (one thin line each, angled out over the water).
    const fishers = this.people.filter((p) => p.pose === 'fishing');
    const rod = new THREE.CylinderGeometry(0.012, 0.02, 3, 4).translate(0, 1.5, 0).rotateX(0.9).translate(0, 1.0, 0.15);
    this.rods = new THREE.InstancedMesh(rod, new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6 }), fishers.length);
    this.rods.frustumCulled = false;
    this.fishers = fishers;
    this.group.add(this.rods);
    this.pubShapes();
    this.cars();
    scene.add(this.group);
    this.upgrade();
  }

  // Dark shapes drifting across the pub's lit front windows at night.
  pubShapes() {
    const t = this.kettle;
    const pub = t && t.buildings.find((b) => b.id === 'pub');
    this.shapes = [];
    if (!pub) {
      return;
    }
    const geo = new THREE.PlaneGeometry(0.45, 1.0);
    this.shapeMat = new THREE.MeshBasicMaterial({ color: 0x120c08, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(geo, this.shapeMat);
      this.group.add(m);
      this.shapes.push({ mesh: m, a0: pub.a - pub.w / 2 + 1.2, a1: pub.a + pub.w / 2 - 1.2, o: pub.front + 0.1, y: pub.y + 1.75, speed: 0.15 + i * 0.07, phase: i * 2.1, frame: t.frame });
    }
  }

  cars() {
    this.traffic = [];
    const t = this.kettle;
    if (!t) {
      return;
    }
    const lights = new Float32Array(4 * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(lights, 3));
    this.headMat = new THREE.PointsMaterial({ color: 0xfff2d8, size: 0.9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.heads = new THREE.Points(g, this.headMat);
    this.heads.frustumCulled = false;
    this.group.add(this.heads);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 });
    for (let i = 0; i < 2; i++) {
      const mesh = new THREE.Mesh(carGeometry([0xb9b6ad, 0x8a2a24][i]), mat);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.traffic.push({ mesh, dir: i ? -1 : 1, a: i ? KETTLE.road.a1 : KETTLE.road.a0, wait: i * 9, o: i ? -97 : -101 });
    }
  }

  // A rigged model in the manifest replaces the silhouettes (V7 asset hook).
  async upgrade() {
    try {
      const m = await loadManifest();
      const e = m.models.find((x) => x && x.id === 'townsperson');
      if (!e) {
        return;
      }
      const gltf = await new GLTFLoader().loadAsync(`models/${e.file}`);
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const k = (e.height || 1.75) / Math.max(0.1, box.max.y - box.min.y);
      this.rigged = this.people.map((p) => {
        const o = clone(gltf.scene);
        o.scale.setScalar(k);
        const mixer = new THREE.AnimationMixer(o);
        const clip = gltf.animations.find((c) => /walk/i.test(c.name) && p.pose === 'walk') || gltf.animations.find((c) => /idle/i.test(c.name)) || gltf.animations[0];
        if (clip) {
          mixer.clipAction(clip).play();
        }
        this.group.add(o);
        return { o, mixer };
      });
      this.mesh.visible = false;
    } catch (err) {
      console.warn('townsperson model not used:', err && err.message);
    }
  }

  // Strollers pick a new spot along the street and walk there.
  stroll(p, dt) {
    if (!p.path || !p.path.length) {
      const to = { a: -110 + Math.random() * 190, o: -44 + Math.random() * 12 };
      p.path = this.nav.path({ a: p.a, o: p.o }, to) || [];
      p.pause = 2 + Math.random() * 6;
    }
    if (p.pause > 0) {
      p.pause -= dt;
      return;
    }
    const n = p.path[0];
    const da = n.a - p.a;
    const dO = n.o - p.o;
    const d = Math.hypot(da, dO);
    const step = 1.25 * dt;
    if (d <= step) {
      p.a = n.a;
      p.o = n.o;
      p.path.shift();
      return;
    }
    p.a += (da / d) * step;
    p.o += (dO / d) * step;
    p.face = Math.atan2(-da, dO);
  }

  update(dt, night, camera, storm = 0) {
    const cam = camera.position;
    const t = performance.now() / 1000;
    this.people.forEach((p, i) => {
      if (p.pose === 'walk') {
        this.stroll(p, dt);
      }
      const w = p.town.frame.toWorld(p.a, p.o, {});
      const near = Math.hypot(w.x - cam.x, w.z - cam.z) < HIDE_NEAR;
      // Storms clear the piers and the breakwater.
      const away = near || (storm > 0.6 && p.pose !== 'walk') || (night > 0.8 && p.pose === 'fishing');
      const bob = p.pose === 'walk' ? Math.abs(Math.sin(t * 5 + p.phase)) * 0.04 : Math.sin(t * 0.7 + p.phase) * 0.01;
      this.v.set(w.x, p.y + bob, w.z);
      this.q.setFromAxisAngle(this.up, p.town.frame.yaw + p.face);
      this.s.setScalar(away ? 0 : 1);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      if (this.rigged) {
        const r = this.rigged[i];
        r.o.position.copy(this.v);
        r.o.quaternion.copy(this.q);
        r.o.visible = !away;
        r.mixer.update(dt);
      }
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.fishers.forEach((p, i) => {
      this.mesh.getMatrixAt(this.people.indexOf(p), this.m);
      this.rods.setMatrixAt(i, this.m);
    });
    this.rods.instanceMatrix.needsUpdate = true;
    const on = Math.min(1, night * 1.6);
    if (this.shapeMat) {
      this.shapeMat.opacity = on * 0.55;
      for (const s of this.shapes) {
        const k = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
        const w = s.frame.toWorld(s.a0 + (s.a1 - s.a0) * k, s.o, {});
        s.mesh.position.set(w.x, s.y, w.z);
        s.mesh.rotation.set(0, s.frame.yaw, 0);
      }
    }
    this.driveCars(dt, on);
  }

  driveCars(dt, on) {
    if (!this.traffic.length) {
      return;
    }
    const pos = this.heads.geometry.attributes.position;
    const R = KETTLE.road;
    this.traffic.forEach((c, i) => {
      if (c.wait > 0) {
        c.wait -= dt;
        c.mesh.visible = false;
      } else {
        c.a += c.dir * CAR_SPEED * dt;
        c.mesh.visible = true;
        if (c.a > R.a1 || c.a < R.a0) {
          c.a = c.dir > 0 ? R.a0 : R.a1;
          c.wait = 8 + Math.random() * 25;
        }
      }
      const f = this.kettle.frame;
      const w = f.toWorld(c.a, c.o, {});
      c.mesh.position.set(w.x, TOWN_Y - 0.02, w.z);
      c.mesh.rotation.y = f.yaw - (c.dir * Math.PI) / 2;
      for (const s of [-0.6, 0.6]) {
        const h = f.toWorld(c.a + c.dir * 2.15, c.o + s, {});
        pos.setXYZ(i * 2 + (s > 0 ? 1 : 0), h.x, TOWN_Y + 0.7, h.z);
      }
      if (!c.mesh.visible) {
        pos.setXYZ(i * 2, 0, -1000, 0);
        pos.setXYZ(i * 2 + 1, 0, -1000, 0);
      }
    });
    pos.needsUpdate = true;
    this.headMat.opacity = on;
  }
}
