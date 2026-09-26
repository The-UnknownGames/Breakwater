import { Game } from './core/Game.js';
import { Debug } from './debug/Debug.js';
import { initRapier } from './physics/PhysicsWorld.js';
import { showNotice } from './render/Resilience.js';

const params = new URLSearchParams(window.location.search);

// Graphics preset picked in the menu (kept per browser).
function savedQuality() {
  try {
    return window.localStorage.getItem('breakwater.quality') || undefined;
  } catch {
    return undefined;
  }
}
const hourParam = params.get('hour');
const headingParam = params.get('heading');

async function boot() {
  const R = await initRapier();
  const game = await Game.create(
    document.getElementById('app'),
    {
      // The saved career's boat wins; ?boat= picks one on test pages.
      boat: params.get('boat') || undefined,
      // Phones and tablets default to the Low preset.
      quality: params.get('quality') || savedQuality() || (window.matchMedia('(pointer: coarse)').matches ? 'low' : undefined),
      seaState: params.get('state') || 'calm',
      hour: hourParam !== null ? Number(hourParam) : undefined,
      freezeTime: params.has('freeze'),
      camera: params.get('cam') || undefined,
      heading: headingParam !== null ? (Number(headingParam) * Math.PI) / 180 : undefined,
      // ?scenario=trawler,survivors spawns F8 scenarios at start.
      scenario: (params.get('scenario') || '').split(',').filter(Boolean),
      autoTension: params.has('autotension'),
      // Careers start in Kettle Harbor; debug/test pages start at sea.
      spawn: params.get('spawn') || (params.get('debug') === '1' ? 'sea' : 'harbor'),
      // Real careers save to localStorage; debug/test pages never do.
      persist: params.get('debug') !== '1',
      newCareer: params.has('new'),
      tutorial: params.has('tutorial'),
      seed: params.has('seed') ? Number(params.get('seed')) : undefined,
      // Phones: scale the render resolution with the frame rate.
      dynamicRes: params.has('dynres') || window.matchMedia('(pointer: coarse)').matches,
    },
    R,
  );
  new Debug(game, params.get('debug') === '1');

  // Optional screenshot framing (orbit camera): ?look=<compass deg>&camY=<m>
  const look = params.get('look');
  if (look !== null) {
    game.rig.setMode('orbit');
    const b = (Number(look) * Math.PI) / 180;
    const y = Number(params.get('camY') || 6);
    const pos = game.camera.position.clone().set(-Math.sin(b) * 30, y, Math.cos(b) * 30);
    const dir = pos.clone().set(Math.sin(b), -0.04, -Math.cos(b)).normalize();
    game.rig.lookAlong(pos, dir);
  }
  game.start();
}

// Never fail silently: a start-up error is shown on screen.
boot().catch((e) => {
  console.error(e);
  const msg = String((e && e.message) || e);
  const gl = /webgl|context/i.test(msg);
  showNotice(gl ? 'This browser could not start WebGL (graphics). Close other apps or tabs, then restart.' : `Breakwater could not start: ${msg}`);
});
