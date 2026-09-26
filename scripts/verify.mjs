// npm run verify (spec 17.2). Must finish in under 3 minutes.
// Build, physics tests, browser smoke test (sea states, time of day, boat
// under way, cameras, errors, NaNs) and milestone screenshots.
// New career / tutorial / UI checks are added as those milestones land.

import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { startPreview, launchBrowser, openPage, snap, BASE } from './lib/browser.mjs';

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

// Physics tests run headless in Node alongside the browser smoke test
// (separate cores); their output is printed when both are done.
step('physics tests (in parallel)');
const physicsRun = new Promise((resolve) => {
  // Low priority: the browser lanes (software GL) are the critical path.
  const proc = spawn('nice', ['-n', '10', 'node', 'scripts/test-physics.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  proc.stdout.on('data', (d) => (out += d));
  proc.stderr.on('data', (d) => (out += d));
  proc.on('close', (code) => resolve({ code, out }));
});

step('browser smoke test');
mkdirSync(SHOTS, { recursive: true });
const preview = await startPreview();
// One browser per lane: each has its own GPU process (SwiftShader), so a
// screenshot in one lane doesn't queue behind the other lane's WebGL work.
const browser = await launchBrowser();
const browserB = await launchBrowser();
const errors = [];

// Poll the game state until pred(state) holds (frames are slow under
// software GL, so fixed sleeps are flaky).
async function until(page, pred, timeout = 8000) {
  const end = Date.now() + timeout;
  let st = null;
  while (Date.now() < end) {
    st = await page.evaluate(() => window.__game.state());
    if (pred(st)) {
      return st;
    }
    await page.waitForTimeout(100);
  }
  return st;
}

async function smoke() {
  // Functional checks run on the Low preset (fewer pixels under software GL);
  // the milestone screenshots use the default preset.
  // Small viewport: SwiftShader renders on every core, so a cheap smoke page
  // leaves more CPU to the screenshot lane.
  const page = await openPage(browser, `${BASE}?debug=1&quality=low&state=calm&hour=12&freeze`, errors, { width: 800, height: 450 });
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

  // V3: F8 spawner, passing the line with Space, winch, pull-aboard with E.
  await page.keyboard.press('F8');
  await page.keyboard.press('Digit1');
  await page.keyboard.press('F8');
  await page.keyboard.press('Digit4');
  const s3 = await until(page, (st) => st.targets.length === 1 && st.survivorsWaiting === 3);
  check(s3.targets.length === 1 && s3.survivorsWaiting === 3, `F8 spawns a trawler and 3 survivors (${s3.targets.length}, ${s3.survivorsWaiting})`);
  // Setup placement only: her bow cleat ~5 m astern of our tow point.
  await page.evaluate(() => window.__game.setupTow(5, false));
  await page.waitForTimeout(300);
  const prompt = (await page.evaluate(() => window.__game.state())).prompt || '';
  await page.keyboard.press('Space');
  const s4 = await until(page, (st) => st.towing);
  check(s4.towing, `Space passes the tow line (prompt: "${prompt}")`);
  await page.keyboard.down('KeyQ');
  await page.evaluate(() => window.__game.advance(2));
  await page.keyboard.up('KeyQ');
  const s5 = await page.evaluate(() => window.__game.state());
  check(s5.towLength > s4.towLength + 2, `Q pays out line (${s4.towLength.toFixed(1)} -> ${s5.towLength.toFixed(1)} m)`);
  await page.keyboard.press('Space');
  check(!(await until(page, (st) => !st.towing)).towing, 'Space casts off');
  await page.evaluate(() => window.__game.setupPickup());
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await until(page, (st) => (st.prompt || '').startsWith('Pulling'), 4000);
  await page.evaluate(() => window.__game.advance(3));
  const s6 = await page.evaluate(() => window.__game.state());
  check(s6.survivorsAboard === 1, `E pulls a survivor aboard (${s6.survivorsAboard} aboard, ${s6.survivorsWaiting} waiting)`);

  // V4: career basics on the same page (money, offers, board, accepting).
  const c0 = await page.evaluate(() => window.__game.state());
  check(c0.money === 1500 && c0.offers >= 2, `career starts with $1,500 and ${c0.offers} job offers`);
  await page.keyboard.press('Tab');
  const boardOpen = await page.evaluate(() => !document.querySelector('.job-board').hidden);
  check(boardOpen, 'Tab opens the job board');
  await page.evaluate(() => document.querySelector('.job-board .paper-card .paper-btn').click());
  const c1 = await until(page, (st) => st.activeJob !== null, 3000);
  check(c1.activeJob !== null, `accepting an offer starts a job (${c1.activeJob})`);

  // Chart (M) and minimap (V4).
  await page.keyboard.press('KeyM');
  const chart = await page.evaluate(() => ({ open: !document.querySelector('.chart-panel').hidden, mini: Boolean(document.querySelector('.hud .minimap')) }));
  check(chart.open && chart.mini, `M opens the chart; minimap on the HUD (${chart.open}, ${chart.mini})`);
  await page.keyboard.press('KeyM');

  // Shipyard (V4): open it, buy Tow line II, the live boat gets it.
  await page.evaluate(() => window.__game.game.career.shipyard.toggle(true));
  await page.evaluate(() => document.querySelector('.shipyard [data-upgrade="towline2"]').click());
  const y = await page.evaluate(() => ({ st: window.__game.state(), kn: window.__game.game.session.sim.cfg.towBreakingKN }));
  check(y.st.money === 0 && y.st.upgrades.includes('towline2') && y.kn === 120, `shipyard sells Tow line II ($${y.st.money} left, line ${y.kn} kN)`);
  await snap(page, `${SHOTS}/v4-shipyard.png`, true);
  await page.evaluate(() => window.__game.game.career.shipyard.toggle(false));

  // Boat under way (spec 17.2) on the same page (a page load costs ~20 s
  // under software GL): clear the scene, open water, throttle up and step
  // 20 s of sim time, sampling once a second.
  await page.evaluate(() => {
    const g = window.__game;
    g.game.career.board.toggle(false);
    g.game.career.jobs.abandon();
    g.game.ops.ops.clear();
    g.setSeaState('moderate', true);
    g.place(0, 0, 235);
    g.advance(1);
  });
  const start = await page.evaluate(() => window.__game.state());
  check(start.buoyancyPoints > 0 && start.buoyancyPoints <= 64, `Marlin has ${start.buoyancyPoints} buoyancy points (<= 64)`);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('KeyW');
  }
  const run = await page.evaluate(() => {
    const g = window.__game;
    g.game.loop.running = false;
    const ys = [];
    let bad = false;
    for (let i = 0; i < 20; i++) {
      g.advance(1);
      const s = g.state();
      ys.push(s.pos[1]);
      if (![...s.pos, ...s.vel, s.heel, s.pitch].every(Number.isFinite) || (s.pos[1] < -5 && !s.capsized)) {
        bad = true;
      }
    }
    g.game.loop.start();
    return { ys, bad };
  });
  const end = await page.evaluate(() => window.__game.state());
  check(!run.bad, 'boat state finite and afloat for 20 s');
  check(Math.abs(end.throttle - 0.8) < 1e-6, `throttle lever at 80% after 8 presses (${end.throttle})`);
  check(end.speedKn > start.speedKn + 2, `speed increases under throttle (${start.speedKn.toFixed(1)} -> ${end.speedKn.toFixed(1)} kn)`);
  const ys = run.ys;
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sd = Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length);
  check(sd > 0.02, `hull Y varies with the waves (sd ${sd.toFixed(3)} m)`);
  for (const mode of ['helm', 'orbit', 'chase']) {
    await page.keyboard.press('KeyC');
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => window.__game.state());
    check(s.cameraMode === mode, `C cycles camera -> ${s.cameraMode}`);
  }
  await page.close();

  // V4 boats: the Kestrel and the Bulwark load, float and make way.
  for (const id of ['kestrel', 'bulwark']) {
    const bp = await openPage(browser, `${BASE}?debug=1&quality=low&state=calm&hour=12&boat=${id}`, errors, { width: 480, height: 270 });
    const r = await bp.evaluate(() => {
      const g = window.__game;
      g.game.loop.running = false;
      g.game.session.boat.throttleLever = 0.8;
      g.advance(15);
      const s = g.state();
      return { boat: s.boat, pts: s.buoyancyPoints, kn: s.speedKn, y: s.pos[1] };
    });
    check(r.boat === id && r.pts > 0 && r.kn > 4 && Math.abs(r.y) < 2, `${id} loads, floats and makes ${r.kn.toFixed(1)} kn (${r.pts} buoyancy points)`);
    await bp.close();
  }
}

  // Milestone screenshots (debug overlay off).
const views = [
  { name: 'v1-calm-noon', q: 'state=calm&hour=12.5&look=160' },
  // Same page, reconfigured (saves two page loads + shader compiles).
  { name: 'v1-rough-golden', reuse: { state: 'rough', hour: 18.6, look: 280 } },
  { name: 'v1-storm-night', reuse: { state: 'storm', hour: 22.5, look: 90 }, strike: true },
  { name: 'v2-rough-pitching', q: 'state=rough&hour=15&heading=235&look=150&camY=4', throttle: 10, wait: 3000 },
  // Reuses the pitching page: already at full speed; calmer sea, chase cam.
  { name: 'v2-wake', reuse: { state: 'moderate', chase: true }, wait: 5500 },
  // Reuses the wake page too: same heading, already at speed.
  { name: 'v2-bow-spray', reuse: { state: 'gale', hour: 13 }, slam: true },
  // Same page again: rougher sea, a trawler to tow.
  { name: 'v3-tow-taut', reuse: { state: 'rough', hour: 15, chase: true, trawler: true }, tow: true },
  // Reuses the tow page: cast off, then haul a survivor out of the Rough sea.
  { name: 'v3-pull-aboard', reuse: { survivors: true }, pickup: true },
  // Home port and the job board (same page; setup moves the boat to its berth).
  { name: 'v4-kettle-harbor', reuse: { berth: true, state: 'moderate', hour: 10 }, harbor: true },
  // Lane A (after the V1 shots): the job board over the harbor.
  { name: 'v4-job-board', reuse: { berth: true, state: 'moderate', hour: 10, board: true }, harbor: true, laneA: true },
  { name: 'v4-chart', reuse: { chart: true }, laneA: true },
];

async function shoot(list, browser) {
  let p = null;
  for (const v of list) {
    if (v.reuse) {
      await p.evaluate((r) => {
        const g = window.__game;
        if (!g.game.loop.running) {
          g.game.loop.start();
        }
        // A held lightning flash (storm-night shot) is released.
        g.game.lightning.hold = 0;
        if (r.state) {
          g.setSeaState(r.state, true);
        }
        if (r.hour !== undefined) {
          g.setHour(r.hour);
        }
        g.game.skySystem.forceRefresh = true;
        if (r.look !== undefined) {
          g.look(r.look, r.camY ?? 6);
        }
        if (r.chase) {
          g.game.rig.setMode('chase');
        }
        if (r.berth) {
          g.game.ops.ops.clear();
          g.game.career.returnToBerth();
        }
        if (r.board) {
          g.game.career.board.toggle(true);
        }
        if (r.chart) {
          const c = g.game.career;
          c.board.toggle(false);
          // A waypoint out to Pellow Point so the route line shows.
          const port = c.shape.ports.find((q) => q.id === 'pellow');
          c.waypoint = { x: port.zone.x, z: port.zone.z, label: 'Waypoint', exact: true };
          c.maps.chart.toggle(true);
        }
        if (r.trawler) {
          g.spawn('trawler');
        }
        if (r.survivors) {
          g.game.ops.ops.release();
          g.game.input.pressed.clear();
          g.game.session.boat.throttleLever = 0;
          // Setup only: stop the boat, stow the old line, lay on survivors.
          g.game.session.sim.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          g.advance(4);
          g.game.ops.ropes.forEach((rope) => (rope.alive = false));
          g.spawn('survivors');
        }
      }, v.reuse);
    } else {
      if (p) {
        await p.close();
      }
      // Medium preset: the software-GL time budget (spec 17.2 does not fix a preset).
      // 1024x576: SwiftShader rasterises on the CPU, so pixels are the budget.
      p = await openPage(browser, `${BASE}?debug=1&freeze&quality=medium&${v.q}`, errors, { width: 1024, height: 576 });
    }
    await p.waitForTimeout(v.throttle ? 1500 : v.reuse && !v.reuse.look ? 300 : v.reuse ? 1500 : 2500);
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
      // Setup: step the paused sim to the next hard slam and let the spray
      // fly for ~0.45 s (deterministic; no wall-clock waiting at 4 fps).
      const speed = await p.evaluate(() => {
        const g = window.__game;
        const hit = g.stepToSlam(40, 0.45);
        g.view(40, 13, 3);
        g.render();
        return hit;
      });
      console.log(`  (slam at ${speed.toFixed(1)} m/s)`);
    }
    if (v.tow) {
      // Setup: line made fast astern, under way 40 s, then pause on a frame
      // with the line loaded.
      await p.evaluate(() => window.__game.setupTow(28));
      for (let i = 0; i < 8; i++) {
        await p.keyboard.press('KeyW');
      }
      // Paused, step the sim until the line is loaded (deterministic, no
      // wall-clock polling), then settle the rope visual.
      await p.evaluate(() => {
        const g = window.__game;
        g.advance(40);
        g.game.loop.running = false;
        for (let i = 0; i < 400 && g.state().towRatio < 0.12; i++) {
          g.advance(0.05);
        }
      });
      await p.evaluate(() => {
        window.__game.viewTow(-70, 34, 7);
        for (let i = 0; i < 6; i++) {
          window.__game.render();
        }
        window.__game.hideToast();
        window.__game.render();
      });
    }
    if (v.pickup) {
      await p.evaluate(() => window.__game.setupPickup());
      await p.waitForTimeout(400);
      await p.keyboard.press('KeyE');
      await p.waitForTimeout(300);
      await p.evaluate(() => {
        window.__game.game.loop.running = false;
        window.__game.advance(1.5);
        window.__game.view(60, 9, 3.5);
        window.__game.hideToast();
        window.__game.render();
      });
    }
    if (v.harbor) {
      await p.evaluate(() => {
        const g = window.__game;
        g.game.loop.running = false;
        g.advance(1);
        g.view(150, 80, 45);
        g.hideToast();
        g.render();
      });
    }
    if (v.strike) {
      await p.evaluate(() => window.__game.strike(0.7));
      await p.waitForTimeout(600);
    }
    await snap(p, `${SHOTS}/${v.name}.png`);
    console.log(`  shot ${SHOTS}/${v.name}.png (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  }
  await p.close();
}

// Two browser lanes in parallel (smoke test + V1 shots | V2/V3 shots) so
// the run fits in the 3-minute budget; physics runs on a third core.
try {
  await Promise.all([
    smoke().then(() => shoot(views.filter((v) => v.name.startsWith('v1') || v.laneA), browser)),
    shoot(views.filter((v) => !v.name.startsWith('v1') && !v.laneA), browserB),
  ]);
} catch (e) {
  failures.push(`smoke test threw: ${e.message}`);
} finally {
  await browser.close();
  await browserB.close();
  preview.kill();
}

const phys = await physicsRun;
step('physics tests (results)');
console.log(phys.out.replace(/^using deprecated.*\n/gm, ''));
if (phys.code !== 0) {
  failures.push('physics tests failed');
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
