// npm run verify (spec 17.2). Must finish in under 3 minutes.
// Build, physics tests, browser smoke test (sea states, time of day, boat
// under way, cameras, errors, NaNs) and milestone screenshots.
// New career / tutorial / UI checks are added as those milestones land.

import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { startPreview, launchBrowser, openPage, BASE } from './lib/browser.mjs';

const SHOTS = 'verify-shots';
const started = Date.now();
const failures = [];

function step(name) {
  console.log(`\n== ${name} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
}

function check(cond, message) {
  if (!cond) {
    failures.push(message);
    console.log(`  FAIL ${message}`);
  } else {
    console.log(`  ok   ${message}`);
  }
}

step('build');
execSync('npx vite build', { stdio: 'inherit' });

step('physics tests');
try {
  execSync('node scripts/test-physics.mjs', { stdio: 'inherit' });
} catch {
  failures.push('physics tests failed');
}

step('browser smoke test');
mkdirSync(SHOTS, { recursive: true });
const preview = await startPreview();
const browser = await launchBrowser();
const errors = [];

try {
  const page = await openPage(browser, `${BASE}?debug=1&state=calm&hour=12&freeze`, errors);
  await page.waitForTimeout(1500);
  const s0 = await page.evaluate(() => window.__game.state());
  check(s0.waveCount === 16, `16 wave components active (${s0.waveCount})`);
  const t0 = s0.waveTime;
  await page.waitForTimeout(2000);
  const s1 = await page.evaluate(() => window.__game.state());
  check(s1.waveTime > t0, 'simulation time advances');

  // Cycle every sea state with F6 and make sure nothing breaks.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('F6');
    await page.waitForTimeout(600);
    const s = await page.evaluate(() => window.__game.state());
    const finite = [s.waveTime, s.hour, s.sunElevation, ...s.camera].every(Number.isFinite);
    check(finite, `F6 -> ${s.seaStateTarget}: state finite`);
  }
  await page.keyboard.press('F7');
  await page.waitForTimeout(300);
  const s2 = await page.evaluate(() => window.__game.state());
  check(Math.abs(((s2.hour - 15 + 24) % 24)) < 0.2, `F7 advances time by 3 h (${s2.hour.toFixed(2)})`);
  await page.close();

  // Boat under way (spec 17.2): throttle up 20 s, speed rises, hull floats.
  const drive = await openPage(browser, `${BASE}?debug=1&state=moderate&hour=14&heading=235`, errors);
  await drive.waitForTimeout(1500);
  const start = await drive.evaluate(() => window.__game.state());
  check(start.buoyancyPoints > 0 && start.buoyancyPoints <= 64, `Marlin has ${start.buoyancyPoints} buoyancy points (<= 64)`);
  await drive.keyboard.press('KeyW');
  await drive.keyboard.press('KeyW');
  await drive.keyboard.press('KeyW');
  await drive.keyboard.press('KeyW');
  await drive.keyboard.press('KeyW');
  await drive.keyboard.press('KeyW');
  await drive.keyboard.press('KeyW');
  await drive.keyboard.press('KeyW');
  const ys = [];
  let bad = false;
  for (let i = 0; i < 20; i++) {
    await drive.waitForTimeout(1000);
    const s = await drive.evaluate(() => window.__game.state());
    ys.push(s.pos[1]);
    if (![...s.pos, ...s.vel, s.heel, s.pitch].every(Number.isFinite) || (s.pos[1] < -5 && !s.capsized)) {
      bad = true;
    }
  }
  const end = await drive.evaluate(() => window.__game.state());
  check(!bad, 'boat state finite and afloat for 20 s');
  check(Math.abs(end.throttle - 0.8) < 1e-6, `throttle lever at 80% after 8 presses (${end.throttle})`);
  check(end.speedKn > start.speedKn + 2, `speed increases under throttle (${start.speedKn.toFixed(1)} -> ${end.speedKn.toFixed(1)} kn)`);
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sd = Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length);
  check(sd > 0.02, `hull Y varies with the waves (sd ${sd.toFixed(3)} m)`);
  for (const mode of ['helm', 'orbit', 'chase']) {
    await drive.keyboard.press('KeyC');
    await drive.waitForTimeout(300);
    const s = await drive.evaluate(() => window.__game.state());
    check(s.cameraMode === mode, `C cycles camera -> ${s.cameraMode}`);
  }
  await drive.close();

  // Milestone screenshots (debug overlay off).
  const views = [
    { name: 'v1-calm-noon', q: 'state=calm&hour=12.5&look=160' },
    { name: 'v1-rough-golden', q: 'state=rough&hour=18.6&look=280' },
    { name: 'v1-storm-night', q: 'state=storm&hour=22.5&look=90', strike: true },
    { name: 'v2-rough-pitching', q: 'state=rough&hour=15&heading=235&look=150&camY=4', throttle: 10, wait: 3000 },
    { name: 'v2-wake', q: 'state=moderate&hour=16&heading=70', throttle: 10, wait: 8000 },
    { name: 'v2-bow-spray', q: 'state=gale&hour=13&heading=235&look=300&camY=5', throttle: 8, wait: 2000, slam: true },
  ];
  for (const v of views) {
    const p = await openPage(browser, `${BASE}?debug=1&freeze&${v.q}`, errors);
    await p.waitForTimeout(v.throttle ? 1500 : 2500);
    for (let i = 0; i < (v.throttle || 0); i++) {
      await p.keyboard.press('KeyW');
    }
    if (v.throttle) {
      // Screenshot setup only: fast-forward to cruising speed (spec 0.2).
      await p.waitForTimeout(300);
      await p.evaluate(() => window.__game.advance(20));
    }
    if (v.wait) {
      await p.waitForTimeout(v.wait);
    }
    if (v.slam) {
      // Wait (bounded) for a slam so the shot shows its spray burst.
      // Software GL renders ~4 fps, so pause the loop on the frame the spray
      // is up (like pausing the game) and capture that exact frame.
      for (let i = 0; i < 80; i++) {
        const caught = await p.evaluate(() => {
          const s = window.__game.state();
          if (s.slamAge > 0.3 && s.slamAge < 1.0) {
            window.__game.game.loop.running = false;
            return true;
          }
          return false;
        });
        if (caught) {
          break;
        }
        await p.waitForTimeout(80);
      }
    }
    if (v.strike) {
      await p.evaluate(() => window.__game.strike(0.7));
      await p.waitForTimeout(600);
    }
    await p.screenshot({ path: `${SHOTS}/${v.name}.png` });
    if (v.slam) {
      const s = await p.evaluate(() => window.__game.state());
      console.log(`  (slam ${s.slamAge.toFixed(2)} s before capture, ${s.sprayParticles} spray particles)`);
    }
    console.log(`  shot ${SHOTS}/${v.name}.png`);
    await p.close();
  }
} catch (e) {
  failures.push(`smoke test threw: ${e.message}`);
} finally {
  await browser.close();
  preview.kill();
}

for (const e of errors) {
  failures.push(e);
}

const secs = (Date.now() - started) / 1000;
check(secs < 180, `verify finished in ${secs.toFixed(0)}s (< 180s)`);
if (failures.length) {
  console.log(`\nVERIFY FAILED (${failures.length}):`);
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
}
console.log('\nVERIFY PASSED');
