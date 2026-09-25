// Dev tool: screenshot arbitrary views. Usage:
//   node scripts/shots.mjs out-dir "name|query|waitMs" ...
// Expects a built dist/ (npx vite build).

import { mkdirSync } from 'node:fs';
import { startPreview, launchBrowser, openPage, BASE } from './lib/browser.mjs';

const [outDir, ...specs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const preview = await startPreview();
const browser = await launchBrowser();
const errors = [];
try {
  for (const spec of specs) {
    const [name, query, wait = '3000', action = ''] = spec.split('|');
    const page = await openPage(browser, `${BASE}?debug=1&freeze&${query}`, errors);
    await page.waitForTimeout(Number(wait));
    if (action === 'strike') {
      await page.evaluate(() => window.__game.strike(0.7));
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: `${outDir}/${name}.png` });
    const s = await page.evaluate(() => window.__game.state());
    console.log(name, `fps ${s.fps.toFixed(1)} calls ${s.drawCalls} tris ${s.triangles}`);
    await page.close();
  }
} finally {
  await browser.close();
  preview.kill();
}
for (const e of errors) {
  console.log('ERROR', e);
}
