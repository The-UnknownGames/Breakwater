// Screenshot suite (AGENTS.md 7.1): captures standard views into
// shots/<date>/ and runs automated image checks (7.3).
// Usage: npm run shots

import { mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { startPreview, launchBrowser, openPage, snap, BASE } from './lib/browser.mjs';

const date = new Date().toISOString().slice(0, 10);
const outDir = join('shots', date);
mkdirSync(outDir, { recursive: true });

const VIEWS = [
  { name: 'calm-noon', q: 'state=calm&hour=12.5&look=160' },
  { name: 'golden-hour', q: 'state=calm&hour=18.6&look=280' },
  { name: 'rough-day', q: 'state=rough&hour=15&look=150' },
  { name: 'gale-storm-day', q: 'state=gale&hour=14&look=120' },
  { name: 'storm-night', q: 'state=storm&hour=22.5&look=90', strike: true },
  { name: 'chase-cam', q: 'state=moderate&hour=15&heading=235&look=150&camY=4', throttle: 10 },
  { name: 'helm-cam', q: 'state=moderate&hour=15&heading=235&look=0&camY=2.5', throttle: 5 },
  { name: 'on-foot-day', q: 'state=calm&hour=12&berth=1', foot: true },
  { name: 'on-foot-night', q: 'state=calm&hour=22&berth=1', foot: true },
  { name: 'ui-chart', q: 'state=calm&hour=12&berth=1', chart: true },
  { name: 'ui-job-board', q: 'state=calm&hour=12&berth=1', board: true },
  { name: 'ui-shipyard', q: 'state=calm&hour=12&berth=1', shipyard: true },
  { name: 'low-calm-noon', q: 'state=calm&hour=12.5&look=160&quality=low' },
  { name: 'low-storm-night', q: 'state=storm&hour=22.5&look=90&quality=low', strike: true },
];

const results = [];
const errors = [];

async function captureAll() {
  const preview = await startPreview();
  const browser = await launchBrowser();
  try {
    for (const v of VIEWS) {
      const errors2 = [];
      const page = await openPage(browser, `${BASE}?debug=1&freeze&${v.q}`, errors2, { width: 1024, height: 576 });
      await page.waitForTimeout(2500);
      if (v.throttle) {
        for (let i = 0; i < v.throttle; i++) {
          await page.keyboard.press('KeyW');
        }
        await page.evaluate(() => window.__game.advance(20));
      }
      if (v.strike) {
        await page.evaluate(() => window.__game.strike(0.7));
        await page.waitForTimeout(600);
      }
      if (v.foot) {
        await page.evaluate(() => {
          const g = window.__game;
          g.game.ops.ops.clear();
          g.game.career.returnToBerth();
          g.advance(1);
          const f = g.game.foot;
          if (f.canLeave && f.mooring.moored) {
            g.game.input.onDown({ code: 'KeyE', repeat: false, preventDefault() {} });
            g.advance(0.5);
          }
        });
        await page.waitForTimeout(1000);
      }
      if (v.chart) {
        await page.evaluate(() => {
          const g = window.__game;
          g.game.career.board.toggle(false);
          const c = g.game.career;
          const port = c.shape.ports.find((q) => q.id === 'pellow');
          c.waypoint = { x: port.zone.x, z: port.zone.z, label: 'Waypoint', exact: true };
          c.maps.chart.toggle(true);
        });
      }
      if (v.board) {
        await page.evaluate(() => window.__game.game.career.board.toggle(true));
      }
      if (v.shipyard) {
        await page.evaluate(() => {
          const g = window.__game;
          g.game.career.board.toggle(false);
          g.game.career.shipyard.toggle(true);
        });
      }
      await snap(page, `${outDir}/${v.name}.png`);
      const s = await page.evaluate(() => window.__game.state());
      results.push({ name: v.name, fps: s.fps, calls: s.drawCalls, errors: errors2.length });
      console.log(`  ${v.name}: ${s.fps.toFixed(1)} fps, ${s.drawCalls} calls${errors2.length ? `, ${errors2.length} errors` : ''}`);
      await page.close();
    }
  } finally {
    await browser.close();
    preview.kill();
  }
}

async function checkImages() {
  console.log('\n== automated image checks (7.3) ==');
  const preview = await startPreview();
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const files = readdirSync(outDir).filter((f) => f.endsWith('.png'));
    for (const file of files) {
      const path = join(outDir, file);
      const buf = readFileSync(path);
      const b64 = buf.toString('base64');
      const checks = await page.evaluate(async (dataUrl) => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let sum = 0, sumSq = 0, black = 0, white = 0, neon = 0;
        const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          sum += lum;
          sumSq += lum * lum;
          if (lum < 10) black++;
          if (lum > 245) white++;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat > 0.7 && max > 100) {
            const hue = r === max ? ((g - b) / (max - min)) * 60 : g === max ? 120 + ((b - r) / (max - min)) * 60 : 240 + ((r - g) / (max - min)) * 60;
            if ((hue >= 260 && hue <= 320) || (hue >= 170 && hue <= 200)) neon++;
          }
        }
        const mean = sum / n;
        const variance = sumSq / n - mean * mean;
        return { mean, std: Math.sqrt(variance), blackPct: black / n * 100, whitePct: white / n * 100, neonPct: neon / n * 100 };
      }, `data:image/png;base64,${b64}`);
      const problems = [];
      if (checks.std < 5) problems.push('blank');
      if (checks.blackPct > 95) problems.push('mostly black');
      if (checks.whitePct > 95) problems.push('mostly white');
      if (checks.neonPct > 2) problems.push(`neon ${checks.neonPct.toFixed(1)}%`);
      if (problems.length) {
        console.log(`  FAIL ${file}: ${problems.join(', ')} (mean ${checks.mean.toFixed(0)}, std ${checks.std.toFixed(1)})`);
        errors.push(`${file}: ${problems.join(', ')}`);
      } else {
        console.log(`  ok   ${file} (mean ${checks.mean.toFixed(0)}, std ${checks.std.toFixed(1)}, black ${checks.blackPct.toFixed(1)}%, white ${checks.whitePct.toFixed(1)}%)`);
      }
    }
  } finally {
    await browser.close();
    preview.kill();
  }
}

await captureAll();
await checkImages();

if (errors.length) {
  console.log(`\nSHOTS FAILED (${errors.length}):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log(`\nSHOTS PASSED — ${results.length} views in ${outDir}`);
