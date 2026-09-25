import { Game } from './core/Game.js';
import { Debug } from './debug/Debug.js';

const params = new URLSearchParams(window.location.search);
const hourParam = params.get('hour');
const game = new Game(document.getElementById('app'), {
  quality: params.get('quality') || undefined,
  seaState: params.get('state') || 'calm',
  hour: hourParam !== null ? Number(hourParam) : undefined,
  freezeTime: params.has('freeze'),
});
new Debug(game, params.get('debug') === '1');

// Optional screenshot framing: ?look=<compass deg>&camY=<m>
const look = params.get('look');
if (look !== null) {
  const b = (Number(look) * Math.PI) / 180;
  const y = Number(params.get('camY') || 6);
  const pos = game.camera.position.clone().set(0, y, 0);
  const dir = pos.clone().set(Math.sin(b), -0.04, -Math.cos(b)).normalize();
  game.rig.lookAlong(pos, dir);
}
game.start();
