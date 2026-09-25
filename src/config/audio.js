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
};
