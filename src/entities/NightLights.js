// Night lights (spec V5): the searchlight (L) with a visible beam, flares
// (R; rafts light red hand flares), navigation lights on every vessel,
// strobes on people in the water. The searchlight and the two brightest
// flares feed the shared local-light uniforms (ocean, rain) and matching
// Three.js lights (boats, survivors).

import * as THREE from 'three';
import { localLightUniforms } from '../render/localLights.js';
import { NIGHT } from '../config/rescue.js';

let glowTex = null;
function glowTexture() {
  if (glowTex) {
    return glowTex;
  }
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

function glow(color, size) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const s = new THREE.Sprite(m);
  s.userData.size = size;
  s.scale.setScalar(size);
  return s;
}

const beamVertex = /* glsl */ `
varying float vAlong;
varying float vEdge;
void main() {
  vAlong = clamp(-position.y, 0.0, 1.0);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vEdge = abs(dot(n, normalize(cameraPosition - wp.xyz)));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const beamFragment = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
varying float vAlong;
varying float vEdge;
void main() {
  float a = uOpacity * pow(1.0 - vAlong, 1.6) * pow(vEdge, 1.5);
  gl_FragColor = vec4(uColor * a, a);
}
`;

// Nav lights for a vessel, in its model frame (bow +Z, waterline y = 0).
function navLights(model, hull) {
  const L = hull.length;
  const B = hull.beam;
  const F = hull.freeboard + (hull.sheerRise || 0) * 0.5;
  const set = [];
  const add = (color, x, y, z, size) => {
    const s = glow(color, size);
    s.position.set(x, y, z);
    model.add(s);
    set.push(s);
  };
  const k = Math.max(1, L / 12);
  // Local +X is the port side (models face +Z).
  add(0xff2a1a, B * 0.46, F + 0.9, L * 0.12, 0.35 * k); // port: red
  add(0x22ff66, -B * 0.46, F + 0.9, L * 0.12, 0.35 * k); // starboard: green
  add(0xfff4dc, 0, F + Math.max(2.8, L * 0.14), L * 0.18, 0.4 * k); // masthead
  add(0xfff4dc, 0, F + 0.6, -L / 2 + 0.3, 0.3 * k); // stern
  return set;
}

export class NightLights {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    this.on = false; // searchlight
    this.spot = new THREE.SpotLight(0xfff2dc, 0, 300, 0.3, 0.4, 1);
    this.spot.castShadow = false;
    scene.add(this.spot);
    scene.add(this.spot.target);
    this.points = [new THREE.PointLight(0xffd9a0, 0, 900, 1), new THREE.PointLight(0xffd9a0, 0, 900, 1)];
    for (const p of this.points) {
      scene.add(p);
    }
    const geo = new THREE.ConeGeometry(1, 1, 32, 1, true);
    geo.translate(0, -0.5, 0);
    this.beam = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.95, 0.85) } },
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }));
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    scene.add(this.beam);
    this.flareSprites = new Map();
    this.nav = new Map(); // model -> sprites
    this.strobes = new Map(); // survivor -> sprite
    this.t = 0;
    this.tmp = { a: new THREE.Vector3(), d: new THREE.Vector3(), f: new THREE.Vector3() };
    this.darkness = 0;
  }

  toggle(force) {
    this.on = force !== undefined ? force : !this.on;
    return this.on;
  }

  // 0 in daylight .. 1 at night or in the murk of a storm at dusk.
  gloom() {
    const g = this.game;
    const day = g.dayNight.dayFactor * (1 - 0.55 * g.weather.params.cloudDark);
    return Math.min(1, Math.max(0, (NIGHT.darkFrom - day) / NIGHT.darkFrom + 0.15 * (1 - Math.min(1, g.weather.params.visibility / 1500))));
  }

  // Keep nav lights on every vessel model we know about.
  ensureNav(model, hull) {
    if (model && !this.nav.has(model)) {
      this.nav.set(model, navLights(model, hull));
    }
  }

  update(dt, ctx) {
    const g = this.game;
    this.t += dt;
    const dark = this.gloom();
    this.darkness = dark;
    const u = localLightUniforms;
    const cam = g.camera;
    const tmp = this.tmp;
    // --- searchlight ---
    const boat = ctx.boat;
    const sl = ctx.searchlight2 ? NIGHT.searchlight2 : NIGHT.searchlight;
    const lit = this.on && boat;
    if (lit) {
      boat.worldPoint('searchlight', tmp.a);
      cam.getWorldDirection(tmp.f);
      tmp.f.y = 0;
      tmp.f.normalize();
      // Pitch down so the beam lands on the water ~40% of its range ahead.
      const drop = Math.max(1.5, tmp.a.y + 0.5) / (sl.range * 0.4);
      tmp.d.set(tmp.f.x, -drop, tmp.f.z).normalize();
      this.spot.position.copy(tmp.a);
      this.spot.target.position.copy(tmp.a).addScaledVector(tmp.d, 50);
      this.spot.distance = sl.range * 1.2;
      this.spot.angle = Math.acos(sl.cosOuter);
      this.spot.penumbra = 1 - Math.acos(sl.cosInner) / Math.acos(sl.cosOuter);
      this.spot.intensity = sl.intensity * sl.threeScale;
      u.uSpotPos.value.copy(tmp.a);
      u.uSpotDir.value.copy(tmp.d);
      u.uSpotCone.value.set(sl.cosInner, sl.cosOuter);
      u.uSpotRange.value = sl.range;
      u.uSpotColor.value.setRGB(1.0, 0.95, 0.86).multiplyScalar(sl.intensity);
      const len = sl.range * 0.75;
      const rad = len * Math.tan(Math.acos(sl.cosOuter));
      this.beam.position.copy(tmp.a);
      this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), tmp.d);
      this.beam.scale.set(rad, len, rad);
      // More visible in rain and murk, faint in clear air by day.
      const air = 0.35 + 0.65 * Math.min(1, g.weather.params.rain + (1 - g.weather.params.visibility / 8000));
      this.beam.material.uniforms.uOpacity.value = sl.beamOpacity * air * (0.25 + 0.75 * dark);
    } else {
      this.spot.intensity = 0;
      u.uSpotColor.value.setRGB(0, 0, 0);
    }
    this.beam.visible = Boolean(lit);
    // --- flares ---
    const flares = ctx.flares ? ctx.flares.list : [];
    const ranked = flares
      .map((f) => ({ f, b: ctx.flares.brightness(f) }))
      .filter((x) => x.b > 0)
      .sort((a, b) => b.b * (b.f.kind === 'para' ? 3 : 1) - a.b * (a.f.kind === 'para' ? 3 : 1));
    for (let i = 0; i < 2; i++) {
      const r = ranked[i];
      const pl = this.points[i];
      if (!r) {
        pl.intensity = 0;
        u.uPointColor.value[i].setRGB(0, 0, 0);
        continue;
      }
      const c = r.f.kind === 'para' ? NIGHT.flare : NIGHT.handFlare;
      pl.position.set(r.f.x, r.f.y, r.f.z);
      pl.color.setRGB(...c.color);
      pl.distance = c.range * 1.5;
      pl.intensity = c.intensity * r.b * c.threeScale;
      u.uPointPos.value[i].set(r.f.x, r.f.y, r.f.z);
      u.uPointColor.value[i].setRGB(...c.color).multiplyScalar(c.intensity * r.b);
      u.uPointRange.value[i] = c.range;
    }
    // Flare sprites: a hot core that stays visible far off.
    for (const f of flares) {
      let s = this.flareSprites.get(f);
      if (!s) {
        const col = f.kind === 'para' ? 0xfff0d0 : 0xff4020;
        s = glow(col, f.kind === 'para' ? 14 : 3);
        g.scene.add(s);
        this.flareSprites.set(f, s);
      }
      const b = ctx.flares.brightness(f);
      s.position.set(f.x, f.y, f.z);
      s.visible = f.lit || f.kind === 'para';
      s.material.opacity = f.lit ? b : 0.6;
      this.fit(s, cam, f.lit ? 1 : 0.25);
    }
    for (const [f, s] of this.flareSprites) {
      if (!flares.includes(f)) {
        g.scene.remove(s);
        s.material.dispose();
        this.flareSprites.delete(f);
      }
    }
    // --- nav lights ---
    for (const v of ctx.vessels) {
      this.ensureNav(v.model, v.hull);
    }
    for (const [model, set] of this.nav) {
      const alive = ctx.vessels.some((v) => v.model === model);
      for (const s of set) {
        s.visible = alive && dark > 0.02;
        s.material.opacity = dark;
        this.fit(s, cam, 1);
      }
      if (!alive) {
        this.nav.delete(model);
      }
    }
    // --- strobes on people in the water ---
    const period = NIGHT.strobe.period;
    for (const s of ctx.survivors) {
      let sp = this.strobes.get(s);
      if (!sp) {
        sp = glow(0xeaf4ff, 1.4);
        g.scene.add(sp);
        this.strobes.set(s, sp);
        sp.userData.phase = Math.random() * period;
      }
      const flash = ((this.t + sp.userData.phase) % period) < NIGHT.strobe.on;
      sp.position.set(s.x, (s.y ?? 0) + 0.55, s.z);
      sp.visible = dark > 0.05 && flash;
      sp.material.opacity = Math.min(1, dark * 1.5);
      this.fit(sp, cam, 1);
    }
    for (const [s, sp] of this.strobes) {
      if (!ctx.survivors.includes(s)) {
        g.scene.remove(sp);
        sp.material.dispose();
        this.strobes.delete(s);
      }
    }
  }

  // Sprites keep at least a few pixels at distance (a light is a point).
  fit(s, cam, k) {
    const d = s.getWorldPosition(this.tmp.a).distanceTo(cam.position);
    s.scale.setScalar(Math.max(s.userData.size, d * 0.005) * k);
  }
}
