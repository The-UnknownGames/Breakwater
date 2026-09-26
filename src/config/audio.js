// Audio mix and synth voicing (spec 10). All audio is synthesized.

export const MIX = {
  master: 0.8,
  sfx: 0.9,
  ambience: 0.7,
  radio: 0.8,
};

// Engine voicing per boat. firingPerRev: firing pulses per crank revolution.
export const ENGINE_VOICES = {
  marlin: {
    firingPerRev: 3, // six-cylinder four-stroke diesel
    subMix: 0.55,
    sawMix: 0.35,
    noiseMix: 0.3,
    filterBase: 180,
    filterPerRpm: 0.45,
    gain: 0.34,
  },
  // Outboard: a high two-stroke whine.
  kestrel: {
    firingPerRev: 2,
    subMix: 0.2,
    sawMix: 0.6,
    noiseMix: 0.35,
    filterBase: 420,
    filterPerRpm: 0.35,
    gain: 0.26,
  },
  // Slow-turning medium-speed diesel: deep and throbbing.
  bulwark: {
    firingPerRev: 4,
    subMix: 0.85,
    sawMix: 0.25,
    noiseMix: 0.25,
    filterBase: 90,
    filterPerRpm: 0.5,
    gain: 0.42,
  },
};
