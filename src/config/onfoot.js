// On foot (V7, ROADMAP_V7 "Life ashore"): walking, looking, boarding and
// mooring. Distances in metres, speeds in m/s.

export const FOOT = {
  walkSpeed: 1.45,
  jogSpeed: 3.4,
  accel: 9, // m/s² toward the wanted velocity (feet grip)
  radius: 0.3, // body radius for collision
  eyeHeight: 1.66,
  stepUp: 0.5, // tallest step climbed without breaking stride
  climb: 1.7, // boat <-> pier: clamber over the gunwale or onto the quay
  dropMax: 2.6, // highest drop taken (onto a deck from a quay)
  gravity: 9.81,
  lookSpeed: 2.2, // rad/s for arrow keys / right stick
  mouseSens: 0.0022, // rad per pixel
  pitchLimit: 1.35,
  bob: { amplitude: 0.035, sway: 0.02, walkHz: 1.8, jogHz: 2.6 },
  // Leaving the helm: only moored, or anchored in calm water, and slow.
  deckWalk: { maxKn: 1.2, anchoredMaxSea: 'moderate' },
  helmReach: 1.6, // m from the helm station to take the wheel
  doorReach: 1.8, // m from a door to use it
  // Deck roll/pitch passed to the eye while standing on a deck (0..1).
  deckTilt: 0.85,
};

// Footsteps: one synthesized step per stride, voiced by the surface.
export const FOOTSTEPS = {
  strideWalk: 0.72, // m per step
  strideJog: 1.25,
  volume: 0.32,
  surfaces: {
    wood: { freq: 190, q: 3.5, noise: 700, decay: 0.09, body: 0.9 },
    concrete: { freq: 1400, q: 1.2, noise: 2600, decay: 0.045, body: 0.25 },
    gravel: { freq: 900, q: 0.8, noise: 3200, decay: 0.14, body: 0.1, grains: 6 },
    deck: { freq: 620, q: 9, noise: 1800, decay: 0.12, body: 0.7 },
    grass: { freq: 500, q: 0.7, noise: 1200, decay: 0.08, body: 0.15 },
  },
};

// Mooring lines (automatic, V7): slow and parallel to a pier edge with
// bollards, the lines go ashore; they hold her alongside with springs.
export const MOORING = {
  maxKn: 1.4, // lines are thrown only below this
  captureGap: 3.5, // m from her side to the pier edge
  maxAngleDeg: 28, // heading within this of the edge
  fender: 0.35, // gap kept between hull and pier face
  periodSec: 5, // natural period of the boat on her lines
  damping: 0.9, // damping ratio
  maxForceG: 0.25, // line pull cap, fraction of her weight per line
  slipThrottle: 0.3, // lever past this slips the lines
  rearmGap: 5, // m clear of the edge before lines can be thrown again
};

// Walkable decks, boat frame (+X port, +Z bow, origin midships on the DWL).
// The deck is the hull's deck line inset by `inset`; `blocks` are solid
// rectangles on deck [x0, x1, z0, z1]; `helm` is where you take the wheel
// (the helm station, or the wheelhouse door); `stand` is where you stand up
// when you leave it. Other boats get a guessed house block.
export const DECKS = {
  marlin: { inset: 0.35, blocks: [[-1.5, 1.5, -0.6, 3.05], [-0.45, 0.45, -3.2, -2.8]], helm: [0, -1.0], stand: [0.6, -1.6], surface: 'deck' },
  kestrel: { inset: 0.45, blocks: [[-0.45, 0.45, -0.1, 0.7]], helm: [0, -0.45], stand: [0.7, -1.0], surface: 'deck' },
  bulwark: { inset: 0.5, blocks: [[-2.85, 2.85, -0.6, 7.0], [-0.7, 0.7, -0.9, 0.5], [-1.2, 1.2, -6.75, -6.25]], helm: [0, -1.3], stand: [1.5, -2.2], surface: 'deck' },
  kittiwake: { inset: 0.4, blocks: [[-1.5, 1.5, 0.8, 4.6]], helm: [0, 0.2], stand: [0.9, -0.6], surface: 'deck' },
  solace: { inset: 0.4, blocks: [[-2.15, 2.15, -4.8, 3.8]], helm: [0, -5.3], stand: [1.2, -6], surface: 'wood' },
  islander: { inset: 0.6, blocks: [[-4.85, 4.85, -5, 17]], helm: [0, -5.6], stand: [2, -7], surface: 'deck' },
  northfarer: { inset: 0.8, blocks: [[-5.6, 5.6, -32.6, -23.4], [-5.3, 5.3, -20, 34]], helm: [0, -22.8], stand: [3, -22], surface: 'deck' },
};
