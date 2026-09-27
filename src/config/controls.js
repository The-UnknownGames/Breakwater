// Helm and camera tuning (spec 5).

export const CONTROLS = {
  throttleStep: 0.1,
  throttleHoldDelay: 0.35, // s before a held W/S starts moving continuously
  throttleHoldRate: 0.5, // lever units per second while held
};

export const CAMERA = {
  orbitDistance: 16, // m behind the boat when orbit is picked (x length / 12)
  orbitHeight: 6,
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

// Gamepad (standard mapping). Buttons act like the keys they name; the left
// stick steers (a wheel), the triggers move the throttle lever.
export const GAMEPAD = {
  deadzone: 0.15,
  throttleRate: 0.7, // lever units per second at full trigger
  buttons: {
    0: 'KeyE', // A: pull aboard / lifebuoy / port services
    1: 'KeyF', // B: chain container
    2: 'Space', // X: pass / cast off the tow line
    3: 'KeyC', // Y: camera
    4: 'KeyZ', // LB: winch in (hold)
    5: 'KeyQ', // RB: winch out (hold)
    8: 'KeyM', // Back / View: chart
    9: 'Escape', // Start / Menu: pause
    10: 'KeyX', // left stick click: throttle to neutral
    11: 'KeyT', // right stick click: autopilot
    12: 'KeyL', // d-pad up: searchlight
    13: 'KeyR', // d-pad down: flare
    14: 'Tab', // d-pad left: job board
    15: 'KeyN', // d-pad right: anchor
  },
};
