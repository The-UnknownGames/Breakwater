// Seabed depth (spec 3.7): metres below still water at (x, z), from the
// Grey Reach terrain (islands, shallows, reefs, dredged harbors).
// Positive = water depth; negative = dry land (height above the sea).

import { WorldShape } from '../world/WorldShape.js';

export class DepthMap {
  constructor(shape = new WorldShape()) {
    this.shape = shape;
  }

  get reefs() {
    return this.shape.reefs;
  }

  depthAt(x, z) {
    return this.shape.depthAt(x, z);
  }

  shallowNear(x, z, radius, depth = 20) {
    return this.shape.shallowNear(x, z, radius, depth);
  }
}
