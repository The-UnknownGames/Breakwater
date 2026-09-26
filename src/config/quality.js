// Quality presets (spec 2.4 / 12). Every post pass is toggleable here.

export const QUALITY = {
  low: {
    pixelRatio: 0.6,
    foamResolution: 256,
    sprayParticles: 2000,
    preserveBuffer: false,
    oceanGrid: 160,
    envSize: 64,
    rainCount: 5000,
    bloom: false,
    smaa: false,
    fxaa: true,
    grade: true,
    shadows: false,
    cloudOctaves: 3,
  },
  medium: {
    pixelRatio: 1,
    oceanGrid: 224,
    envSize: 128,
    rainCount: 10000,
    bloom: true,
    smaa: false,
    fxaa: true,
    grade: true,
    shadows: true,
    cloudOctaves: 4,
  },
  high: {
    pixelRatio: 1,
    oceanGrid: 288,
    envSize: 128,
    rainCount: 18000,
    bloom: true,
    smaa: true,
    fxaa: false,
    grade: true,
    shadows: true,
    cloudOctaves: 5,
  },
  ultra: {
    pixelRatio: 1.5,
    oceanGrid: 384,
    envSize: 256,
    rainCount: 26000,
    bloom: true,
    smaa: true,
    fxaa: false,
    grade: true,
    shadows: true,
    cloudOctaves: 6,
  },
};

export const DEFAULT_QUALITY = 'high';

// Phones (touch devices): the desktop Medium/High crashed a Pixel 10's GPU
// (bloom's extra render targets + 2x pixels + 2048² shadows), and a GPU crash
// gets WebGL blocked for the site until Chrome restarts. Phone presets never
// use bloom, keep render targets small and step up gently. No Ultra.
export const PHONE_QUALITY = {
  low: QUALITY.low,
  medium: {
    ...QUALITY.low,
    pixelRatio: 0.75,
    foamResolution: 512,
    sprayParticles: 3000,
    oceanGrid: 192,
    rainCount: 7000,
  },
  high: {
    ...QUALITY.low,
    pixelRatio: 0.9,
    foamResolution: 512,
    sprayParticles: 3500,
    oceanGrid: 224,
    envSize: 128,
    rainCount: 9000,
    shadows: true,
    shadowSize: 1024,
    cloudOctaves: 4,
  },
};

export function qualityTable(touch) {
  return touch ? PHONE_QUALITY : QUALITY;
}

// Next preset down (crash fallback), or null at the bottom.
export function lowerQuality(name) {
  const order = ['ultra', 'high', 'medium', 'low'];
  const i = order.indexOf(name);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

// Dynamic resolution: when the frame rate stays low, render fewer pixels.
export const DYNAMIC_RES = {
  lowFps: 26,
  highFps: 50,
  holdSeconds: 3,
  step: 0.85,
  minScale: 0.6,
};
