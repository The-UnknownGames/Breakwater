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

const touch = window.matchMedia('(pointer: coarse)').matches;

// After a failed start, the next start is on Low (the menu's choice and the
// URL's are both dropped).
function resetToLow() {
  try {
    window.localStorage.setItem('breakwater.quality', 'low');
  } catch {
    // storage blocked
  }
  const url = new URL(window.location.href);
  url.searchParams.set('quality', 'low');
  return url.toString();
}

async function boot() {
  const R = await initRapier();
  const game = await Game.create(
    document.getElementById('app'),
    {
      // The saved career's boat wins; ?boat= picks one on test pages.
      boat: params.get('boat') || undefined,
      // Phones and tablets default to the Low preset.
      quality: params.get('quality') || savedQuality() || (touch ? 'low' : undefined),
      touch,
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
      traffic: params.get('debug') !== '1' || params.has('traffic'),
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
  // Screenshot framing on foot: ?foot=<port>:<a>:<o>:<yawDeg>[:<pitchDeg>]
  // (harbor frame; yaw 0 faces out to sea).
  const foot = params.get('foot');
  if (foot && game.foot) {
    const [port, a, o, yaw, pitch] = foot.split(':');
    game.foot.debugPlace(port, Number(a), Number(o), Number(yaw || 0), Number(pitch || 0));
  }
  game.start();
}

// Never fail silently: a start-up error is shown on screen.
boot().catch((e) => {
  console.error(e);
  const msg = String((e && e.message) || e);
  const gl = /webgl|context/i.test(msg);
  if (!gl) {
    showNotice(`Breakwater could not start: ${msg}`);
    return;
  }
  // Usually Chrome blocking WebGL for this site after a graphics crash: only
  // a full browser restart lifts it. Next start is on Low either way.
  const low = resetToLow();
  showNotice(
    'Graphics could not start. After a graphics crash the browser pauses 3D for this site: close the browser completely (swipe it away from recent apps), reopen it and load the game again. It will start on Low.',
    true,
    low,
  );
});
