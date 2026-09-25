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
    // Scripted input: "KeyW*8;wait:12000;KeyD~3000" (press n times / hold ms).
    for (const cmd of action.split(';').filter((c) => c && c !== 'strike')) {
      if (cmd.startsWith('wait:')) {
        await page.waitForTimeout(Number(cmd.slice(5)));
      } else if (cmd.includes('~')) {
        const [key, ms] = cmd.split('~');
        await page.keyboard.down(key);
        await page.waitForTimeout(Number(ms));
        await page.keyboard.up(key);
      } else if (cmd.startsWith('eval:')) {
        await page.evaluate(cmd.slice(5));
      } else {
        const [key, n = '1'] = cmd.split('*');
        for (let k = 0; k < Number(n); k++) {
          await page.keyboard.press(key);
        }
      }
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
