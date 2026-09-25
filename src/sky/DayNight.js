// Time of day and sun/moon position. One game day = DAY.realMinutesPerDay.

import * as THREE from 'three';
import { DAY } from '../config/render.js';
import { WORLD } from '../config/palette.js';

const DEG = Math.PI / 180;
const golden = new THREE.Color(WORLD.goldenSun);
const white = new THREE.Color(1.0, 0.97, 0.93);
const deepRed = new THREE.Color(0.9, 0.42, 0.22);

function smoothstep(e0, e1, x) {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

export class DayNight {
  constructor(hour = DAY.startHour) {
    this.hour = hour;
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.sunColor = new THREE.Color();
    this.elevationDeg = 0;
    this.dayFactor = 1;
    this.recompute();
  }

  get gameHoursPerSecond() {
    return 24 / (DAY.realMinutesPerDay * 60);
  }

  update(dt) {
    this.hour = (this.hour + dt * this.gameHoursPerSecond) % 24;
    this.recompute();
  }

  setHour(h) {
    this.hour = ((h % 24) + 24) % 24;
    this.recompute();
  }

  recompute() {
    const lat = DAY.latitudeDeg * DEG;
    const dec = DAY.declinationDeg * DEG;
    const ha = (this.hour - 12) * 15 * DEG;
    const sinEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
    const el = Math.asin(sinEl);
    const cosAz = (Math.sin(dec) - Math.sin(el) * Math.sin(lat)) / (Math.cos(el) * Math.cos(lat));
    let az = Math.acos(Math.min(Math.max(cosAz, -1), 1));
    if (ha > 0) {
      az = Math.PI * 2 - az;
    }
    this.elevationDeg = el / DEG;
    // Compass azimuth -> world (+X east, -Z north).
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
    // Moon: roughly opposite the sun, kept above the horizon at night.
    this.moonDir.set(-this.sunDir.x, Math.max(0.35, -this.sunDir.y), -this.sunDir.z).normalize();
    // Warm colour near the horizon, white by goldenEndDeg.
    const e = this.elevationDeg;
    const warm = smoothstep(DAY.goldenEndDeg, 1, e);
    const red = smoothstep(4, -2, e);
    this.sunColor.copy(white).lerp(golden, warm).lerp(deepRed, red * 0.6);
    this.dayFactor = smoothstep(DAY.twilightDeg, 6, e);
    this.goldenFactor = warm * smoothstep(-3, 1, e);
    this.sunFactor = smoothstep(-1.5, 3, e);
  }
}
