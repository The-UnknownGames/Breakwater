// Navigation aids (spec 6): three lighthouses with sweeping beams at night,
// a red/green buoyed channel into Kettle Harbor (IALA A: red to port when
// entering), and hazard pillars over the reefs. Buoys ride the waves.

import * as THREE from 'three';

const std = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

function lamp(color) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0, roughness: 0.3 });
}

function buoyMesh(color, topShape) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.6, 12), std(color, 0.55));
  body.position.y = 0.4;
  g.add(body);
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), std(0x2a2e31, 0.5));
  cage.position.y = 1.8;
  g.add(cage);
  const top = new THREE.Mesh(topShape, std(color, 0.55));
  top.position.y = 2.5;
  g.add(top);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lamp(color));
  light.position.y = 2.9;
  g.add(light);
  g.userData.light = light;
  g.traverse((o) => {
    o.castShadow = true;
  });
  return g;
}

export class NavAids {
  constructor(scene, shape, harbors) {
    this.group = new THREE.Group();
    this.group.name = 'navaids';
    this.buoys = [];
    this.lighthouses = [];
    this.t = 0;
    for (const p of shape.ports) {
      if (p.harbor) {
        this.channel(p);
        this.lighthouse(p.breakwaterHead || p.zone, 2.5, 14);
      } else {
        const q = { x: p.center.x + p.along.x * 55 - p.out.x * 20, z: p.center.z + p.along.z * 55 - p.out.z * 20 };
        this.lighthouse(q, Math.max(1, shape.heightAt(q.x, q.z)), 22);
      }
    }
    for (const r of shape.reefs) {
      const b = buoyMesh(0xd6b21e, new THREE.ConeGeometry(0.45, 0.7, 10));
      b.children[0].material = std(0x1c1f21, 0.6);
      this.add(b, r.x, r.z, 0xffe9a8, 'hazard');
    }
    scene.add(this.group);
  }

  add(mesh, x, z, flash, kind) {
    mesh.position.set(x, 0, z);
    this.group.add(mesh);
    this.buoys.push({ mesh, x, z, flash, kind, phase: (x * 0.013 + z * 0.007) % 4 });
  }

  channel(p) {
    for (let o = 190; o <= 430; o += 80) {
      for (const side of [1, -1]) {
        const red = side > 0;
        const x = p.center.x + p.out.x * o + p.along.x * side * 34;
        const z = p.center.z + p.out.z * o + p.along.z * side * 34;
        const top = red ? new THREE.CylinderGeometry(0.4, 0.4, 0.6, 10) : new THREE.ConeGeometry(0.45, 0.8, 10);
        this.add(buoyMesh(red ? 0xb3261e : 0x1f7a3a, top), x, z, red ? 0xff3322 : 0x33ff66, red ? 'red' : 'green');
      }
    }
  }

  lighthouse(pos, base, height) {
    const g = new THREE.Group();
    const white = std(0xe9e6de, 0.7);
    const red = std(0xa52a22, 0.7);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, height, 16), white);
    tower.position.y = height / 2;
    g.add(tower);
    for (const k of [0.3, 0.7]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(2.2 - k * 0.8 + 0.02, 2.2 - (k + 0.1) * 0.8 + 0.02, height * 0.1, 16), red);
      band.position.y = height * (k + 0.05);
      g.add(band);
    }
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.3, 16), std(0x22272a, 0.5));
    gallery.position.y = height + 0.15;
    g.add(gallery);
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 12), lamp(0xfff2c8));
    lantern.position.y = height + 1.2;
    g.add(lantern);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.2, 12), red);
    cap.position.y = height + 2.7;
    g.add(cap);
    g.traverse((o) => {
      o.castShadow = true;
    });
    // Beam: two long soft cones, additive, visible at dusk and night.
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff0c8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    const beams = new THREE.Group();
    for (const dir of [1, -1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(18, 420, 20, 1, true), beamMat);
      cone.rotation.z = (dir * Math.PI) / 2;
      cone.position.x = dir * 210;
      beams.add(cone);
    }
    beams.position.y = height + 1.2;
    g.add(beams);
    g.position.set(pos.x, base, pos.z);
    this.group.add(g);
    this.lighthouses.push({ group: g, beams, beamMat, lantern: lantern.material });
  }

  // night: 0 (day) .. 1 (full night).
  update(dt, waves, night) {
    this.t += dt;
    for (const b of this.buoys) {
      const h = waves.heightAt(b.x, b.z);
      b.mesh.position.y = h - 0.5;
      b.mesh.rotation.z = Math.sin(this.t * 1.3 + b.phase) * 0.08;
      b.mesh.rotation.x = Math.cos(this.t * 1.1 + b.phase) * 0.08;
      const on = (this.t + b.phase) % 4 < 0.6 ? 1 : 0;
      b.mesh.userData.light.material.emissiveIntensity = on * (0.4 + 3 * night);
    }
    for (const l of this.lighthouses) {
      l.beams.rotation.y = this.t * 0.9;
      l.beamMat.opacity = 0.16 * night;
      l.lantern.emissiveIntensity = 0.3 + 4 * night;
    }
  }
}
