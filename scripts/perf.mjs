// Performance report (spec 12): draw calls, triangles and CPU time per frame
// in representative scenes on each preset, plus physics step time. Headless
// Chromium renders with SwiftShader, so GPU frame rate is not measured here:
// run `npm run dev` with ?debug=1 and F3 on real hardware for fps.
import { startPreview, launchBrowser, openPage, BASE } from './lib/browser.mjs';

const SCENES = [
  { name: 'harbor calm noon', q: 'state=calm&hour=12', setup: 'berth' },
  { name: 'open sea rough', q: 'state=rough&hour=15', setup: 'sea' },
  { name: 'storm night rescue', q: 'state=storm&hour=23', setup: 'rescue' },
];

const presets = (process.argv[2] || 'low,high').split(',');
const srv = await startPreview();
const browser = await launchBrowser();
const rows = [];
for (const preset of presets) {
  for (const sc of SCENES) {
    const errors = [];
    const page = await openPage(browser, `${BASE}?debug=1&quality=${preset}&${sc.q}&freeze`, errors, { width: 1280, height: 720 });
    const r = await page.evaluate((setup) => {
      const g = window.__game;
      const G = g.game;
      if (G.weatherChain) {
        G.weatherChain.paused = true;
      }
      G.loop.running = false;
      if (setup === 'sea') {
        g.place(200, -400, 90);
        G.session.boat.throttleLever = 0.6;
      } else if (setup === 'rescue') {
        g.place(0, 0, 90);
        const o = G.ops;
        o.ops.addRaft(90, -8, 3);
        o.ops.addSurvivor(55, 6);
        o.ops.addSurvivor(62, 10);
        o.ops.addTarget('trawler', 150, 40, 1);
        o.lights.toggle(true);
        o.fireFlare();
        G.rig.setMode('chase');
      }
      g.advance(10);
      const frame = [];
      const fixed = [];
      let calls = 0;
      let tris = 0;
      for (let i = 0; i < 12; i++) {
        let t = performance.now();
        for (let k = 0; k < 2; k++) {
          G.fixedUpdate(1 / 60);
        }
        fixed.push((performance.now() - t) / 2);
        t = performance.now();
        G.renderFrame(1 / 30, 1);
        frame.push(performance.now() - t);
        calls = Math.max(calls, G.renderer.info.render.calls);
        tris = Math.max(tris, G.renderer.info.render.triangles);
      }
      frame.sort((a, b) => a - b);
      fixed.sort((a, b) => a - b);
      return { calls, tris, frameMs: frame[6], stepMs: fixed[6], physicsMs: G.physics.stepMs };
    }, sc.setup);
    rows.push({ preset, scene: sc.name, ...r, errors: errors.length });
    await page.close();
  }
}
await browser.close();
srv.kill?.();
console.log('\npreset  scene                 draw calls  triangles   step ms  render CPU ms (SwiftShader)');
for (const r of rows) {
  console.log(`${r.preset.padEnd(7)} ${r.scene.padEnd(21)} ${String(r.calls).padStart(10)}  ${String(r.tris).padStart(9)}  ${r.stepMs.toFixed(2).padStart(7)}  ${r.frameMs.toFixed(0).padStart(6)}${r.errors ? `  (${r.errors} errors)` : ''}`);
}
const over = rows.filter((r) => r.calls >= 300);
console.log(over.length ? `\nDRAW CALLS OVER 300: ${over.map((r) => `${r.preset}/${r.scene} ${r.calls}`).join(', ')}` : '\nall scenes under 300 draw calls');
process.exit(0);
