// Helm and camera tuning (spec 5).

export const CONTROLS = {
  throttleStep: 0.1,
  throttleHoldDelay: 0.35, // s before a held W/S starts moving continuously
  throttleHoldRate: 0.5, // lever units per second while held
};

export const CAMERA = {
  chaseDistance: 19,
  chaseHeight: 6.5,
  chaseDistanceAtSpeed: 7, // extra metres at top speed
  fov: 55,
  fovAtSpeed: 8,
  positionStiffness: 3.2,
  yawStiffness: 2.4,
  lookAhead: 6,
  helmFov: 62,
  shakeDecay: 6,
  maxShake: 0.35,
};
