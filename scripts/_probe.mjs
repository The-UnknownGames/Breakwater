import { startPreview, launchBrowser, openPage, BASE } from './lib/browser.mjs';
const preview = await startPreview(); const browser = await launchBrowser(); const errors = [];
const p = await openPage(browser, `${BASE}?debug=1&freeze&state=moderate&hour=14&look=200&camY=3`, errors);
await p.waitForTimeout(2500);
const r0 = await p.evaluate(() => { const g = window.__game.game; const c = g.camera.position; const d = new c.constructor(); g.camera.getWorldDirection(d); const s = g.session.spray; const before = s.alive; s.droplets(200, c.x + d.x * 9, c.y + 0.5, c.z + d.z * 9, 0, 3, 0, 4, 0.3, 3); return { before, after: s.alive, cam: c.toArray().map((v) => +v.toFixed(1)), p0: Array.from(s.pos.slice(before * 3, before * 3 + 3)).map((v) => +v.toFixed(1)), floor: s.floor[before], life: s.life[before], kind: s.kind[before] }; });
console.log(JSON.stringify(r0));
for (let i = 0; i < 3; i++) { await p.waitForTimeout(250); console.log(await p.evaluate(() => { const s = window.__game.game.session.spray; return `alive ${s.alive} y0 ${s.pos[1].toFixed(2)} kinds ${Array.from(s.kind.slice(0, s.alive)).reduce((a, b) => a + (b === 0 ? 1 : 0), 0)}`; })); }
await browser.close(); preview.kill(); console.log(errors);
