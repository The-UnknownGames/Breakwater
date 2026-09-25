// Writes tools/blender/boats.json from src/config/boats.js so the Blender
// generator builds exactly the hull the physics voxelizes.
import { writeFileSync } from 'node:fs';
import { BOATS } from '../src/config/boats.js';
import { WORLD } from '../src/config/palette.js';

const out = { palette: WORLD, boats: {} };
for (const [id, b] of Object.entries(BOATS)) {
  out.boats[id] = { hull: b.hull, prop: b.prop, rudder: b.rudder };
}
writeFileSync('tools/blender/boats.json', JSON.stringify(out, null, 2));
console.log('wrote tools/blender/boats.json');
