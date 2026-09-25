// Seabed depth (spec 3.7). V3 stub: open water plus the shoals listed in
// config/rescue.js SEABED; the real Grey Reach depth map replaces this in V4.
// depthAt returns metres below the still-water level (positive = deeper).

import { SEABED } from '../config/rescue.js';

export class DepthMap {
  constructor(cfg = SEABED) {
    this.cfg = cfg;
  }

  depthAt(x, z) {
    let d = this.cfg.openDepth;
    for (const s of this.cfg.shoals) {
      const r = Math.hypot(x - s.x, z - s.z) / s.radius;
      if (r < 1.6) {
        // Rocky dome: smooth rise with some knobbly relief.
        const dome = Math.max(0, 1 - r * r);
        const knobs = 0.35 * Math.sin(x * 0.21 + z * 0.13) * Math.sin(z * 0.17 - x * 0.07);
        const depth = s.minDepth + (this.cfg.openDepth - s.minDepth) * (1 - dome) ** 2 + knobs * dome;
        d = Math.min(d, depth);
      }
    }
    return d;
  }

  // Cheap reject: is anything shallower than `depth` within `radius` of (x, z)?
  shallowNear(x, z, radius, depth = 20) {
    for (const s of this.cfg.shoals) {
      if (Math.hypot(x - s.x, z - s.z) < s.radius * 1.6 + radius) {
        return depth > s.minDepth;
      }
    }
    return false;
  }
}
