// npm run verify (spec 17.2). Must finish in under 3 minutes.
// V1 scope: build, physics tests, browser smoke test of the ocean/sky
// sandbox (sea states, time of day, errors, NaNs) and milestone screenshots.
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

  // Milestone screenshots (debug overlay off).
  const views = [
    { name: 'v1-calm-noon', q: 'state=calm&hour=12.5&look=160' },
    { name: 'v1-rough-golden', q: 'state=rough&hour=18.6&look=280' },
    { name: 'v1-storm-night', q: 'state=storm&hour=22.5&look=90', strike: true },
  ];
  for (const v of views) {
    const p = await openPage(browser, `${BASE}?debug=1&freeze&${v.q}`, errors);
    await p.waitForTimeout(3500);
    if (v.strike) {
      await p.evaluate(() => window.__game.strike(0.7));
      await p.waitForTimeout(600);
    }
    await p.screenshot({ path: `${SHOTS}/${v.name}.png` });
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
