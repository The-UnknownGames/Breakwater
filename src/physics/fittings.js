// Deck fittings shared by physics and models: where tow lines attach.
// Body frame (+Z bow, +Y up, origin on the DWL midships).

import { hullStation } from './HullShape.js';

function deckAt(h, z) {
  const s = Math.min(1, Math.max(0, z / h.length + 0.5));
  return hullStation(h, s).deck;
}

// Towing bitt aft on the tug (the line leads from its crossbar).
export function towPointLocal(h) {
  const z = -h.length / 2 + 1.3;
  return { x: 0, y: deckAt(h, z) + 0.45, z };
}

// Bow cleat / samson post on a tow target.
export function bowCleatLocal(h) {
  const z = h.length / 2 - 0.6;
  return { x: 0, y: deckAt(h, z) + 0.1, z };
}
