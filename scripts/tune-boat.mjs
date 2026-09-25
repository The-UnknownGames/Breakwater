// Dev tool: print all section-4 measurements for a boat (default marlin).
import { BOATS } from '../src/config/boats.js';
import * as T from './lib/boatTests.mjs';

const cfg = BOATS[process.argv[2] || 'marlin'];
const tg = cfg.targets;
const t0 = performance.now();
const wl = await T.waterline(cfg);
console.log('waterline sinkage', wl.sinkage.toFixed(3), 'm  pitch', wl.pitchDeg.toFixed(2), 'heel', wl.heelDeg.toFixed(2));
console.log('top speed', (await T.topSpeed(cfg)).toFixed(2), 'kn  target', tg.topSpeedKn);
console.log('accel 0->' + tg.accel.toKn, (await T.acceleration(cfg, tg.accel.toKn)).toFixed(2), 's  target', tg.accel.seconds);
console.log('stopping from ' + tg.stopping.fromKn, (await T.stopping(cfg, tg.stopping.fromKn)).toFixed(1), 'm  target', tg.stopping.metres);
const tc = await T.turningCircle(cfg, tg.cruiseThrottle);
console.log('turning circle', tc.lengths.toFixed(2), 'L (', tc.diameter.toFixed(1), 'm, at', tc.speedKn.toFixed(1), 'kn) target', tg.turningCircleLengths);
console.log('roll period', (await T.rollPeriod(cfg)).toFixed(2), 's  target', tg.rollPeriod);
const st = await T.staticStability(cfg);
console.log('vanishing stability', st.vanish.toFixed(1), 'deg  target', tg.capsizeDeg, ' GZmax', Math.max(...st.curve.map((c) => c.gz)).toFixed(3));
console.log('GZ', st.curve.filter((c) => c.deg % 10 === 0).map((c) => `${c.deg}:${c.gz.toFixed(2)}`).join(' '));
console.log(`(${((performance.now() - t0) / 1000).toFixed(1)}s)`);
