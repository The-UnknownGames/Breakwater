import { Game } from './core/Game.js';
import { Debug } from './debug/Debug.js';
import { initRapier } from './physics/PhysicsWorld.js';

const params = new URLSearchParams(window.location.search);
const hourParam = params.get('hour');
const headingParam = params.get('heading');

async function boot() {
  const R = await initRapier();
  const game = await Game.create(
    document.getElementById('app'),
    {
      quality: params.get('quality') || undefined,
      seaState: params.get('state') || 'calm',
      hour: hourParam !== null ? Number(hourParam) : undefined,
      freezeTime: params.has('freeze'),
      camera: params.get('cam') || undefined,
      heading: headingParam !== null ? (Number(headingParam) * Math.PI) / 180 : undefined,
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

boot();
