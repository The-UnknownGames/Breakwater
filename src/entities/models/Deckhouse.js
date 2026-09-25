// Hollow wheelhouse with window openings, glass, console and wheel, so the
// helm camera looks out through real windows (spec 5: helm camera).
// Local frame: origin on the deck at the house centre, +Z forward.

import * as THREE from 'three';
import { WORLD } from '../../config/palette.js';

const W = 2.9;
const L = 3.6;
const H = 1.95;
const T = 0.06;
const SILL = 1.12;
const HEAD = 1.78;

function std(color, rough = 0.5, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 0.55 });
}

// A wall in the XY plane of width w with window openings between `panes`
// (array of [x0, x1] spans), built from boxes.
function wall(w, panes, mat, doorSpan = null) {
  const g = new THREE.Group();
  const box = (x0, x1, y0, y1) => {
    if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3) {
      return;
    }
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, T), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  };
  const lowTop = SILL;
  if (doorSpan) {
    box(-w / 2, doorSpan[0], 0, lowTop);
    box(doorSpan[1], w / 2, 0, lowTop);
    box(doorSpan[0], doorSpan[1], HEAD, H);
  } else {
    box(-w / 2, w / 2, 0, lowTop);
  }
  box(-w / 2, w / 2, HEAD, H);
  let x = -w / 2;
  for (const [a, b] of panes) {
    const top = doorSpan && a >= doorSpan[0] && b <= doorSpan[1] ? HEAD : HEAD;
    box(x, a, SILL, top);
    x = b;
  }
  box(x, w / 2, SILL, HEAD);
  return g;
}

function glass(w, h) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      color: 0x223038,
      roughness: 0.05,
      metalness: 0.3,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  m.renderOrder = 2;
  return m;
}

function spans(width, count, frame = 0.1) {
  const out = [];
  const pane = (width - frame * (count + 1)) / count;
  let x = -width / 2 + frame;
  for (let i = 0; i < count; i++) {
    out.push([x, x + pane]);
    x += pane + frame;
  }
  return out;
}

export function buildDeckhouse() {
  const white = std(0xe4e5e0, 0.55);
  const navy = std(WORLD.workboatNavy, 0.5);
  const house = new THREE.Group();
  const frontPanes = spans(W, 3);
  const sidePanes = spans(L, 3);
  const aftPanes = [[0.25, 1.1]];
  const door = [-1.05, -0.3];

  const front = wall(W, frontPanes, white);
  front.position.z = L / 2;
  house.add(front);
  const aft = wall(W, aftPanes, white, door);
  aft.position.z = -L / 2;
  aft.rotation.y = Math.PI;
  house.add(aft);
  for (const side of [1, -1]) {
    const s = wall(L, sidePanes, white);
    s.position.x = (side * W) / 2;
    s.rotation.y = (side * Math.PI) / 2;
    house.add(s);
  }
  const addGlass = (list, w, pos, rotY) => {
    for (const [a, b] of list) {
      const gl = glass(b - a, HEAD - SILL);
      gl.position.set((a + b) / 2, (SILL + HEAD) / 2, 0);
      const holder = new THREE.Group();
      holder.add(gl);
      holder.position.copy(pos);
      holder.rotation.y = rotY;
      house.add(holder);
    }
  };
  addGlass(frontPanes, W, new THREE.Vector3(0, 0, L / 2), 0);
  addGlass(aftPanes, W, new THREE.Vector3(0, 0, -L / 2), Math.PI);
  addGlass(sidePanes, L, new THREE.Vector3(W / 2, 0, 0), Math.PI / 2);
  addGlass(sidePanes, L, new THREE.Vector3(-W / 2, 0, 0), -Math.PI / 2);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.1, L + 0.4), navy);
  roof.position.set(0, H + 0.05, 0.1);
  roof.castShadow = true;
  house.add(roof);
  // Visor over the windscreen.
  const visor = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.05, 0.35), navy);
  visor.position.set(0, H - 0.02, L / 2 + 0.25);
  visor.rotation.x = 0.25;
  house.add(visor);

  // Interior: console, wheel, instrument screen, seat.
  const dark = std(0x1d2327, 0.7);
  const console = new THREE.Mesh(new THREE.BoxGeometry(W - 0.25, 0.95, 0.55), dark);
  console.position.set(0, 0.475, L / 2 - 0.35);
  house.add(console);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x0d1a1f, emissive: 0x16323a, emissiveIntensity: 0.6, roughness: 0.3 }),
  );
  screen.position.set(0.1, 1.04, L / 2 - 0.5);
  screen.rotation.x = -0.9;
  house.add(screen);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 24), std(0x2a2e31, 0.4, 0.4));
  wheel.position.set(0.55, 1.05, L / 2 - 0.68);
  wheel.rotation.x = -0.5;
  wheel.name = 'wheel';
  house.add(wheel);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), dark);
  seat.position.set(0.55, 0.35, L / 2 - 1.5);
  house.add(seat);
  return { house, height: H, length: L, width: W, eye: new THREE.Vector3(0.55, 1.58, L / 2 - 1.2) };
}
