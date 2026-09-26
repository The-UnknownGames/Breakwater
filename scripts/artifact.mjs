// Playable page (claude.ai artifact): build with a relative base, then put
// the bundle next to tools/artifact/page.html (touch pads, bridge panel)
// with the bundle CSS inlined. Output: artifact-out/ (publish index.html
// with breakwater.js and models/manifest.json as supporting files).

import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build --base ./', { stdio: 'inherit' });
const out = 'artifact-out';
mkdirSync(`${out}/models`, { recursive: true });
const assets = readdirSync('dist/assets');
const js = assets.find((f) => f.endsWith('.js'));
const css = assets.find((f) => f.endsWith('.css'));
copyFileSync(`dist/assets/${js}`, `${out}/breakwater.js`);
copyFileSync('dist/models/manifest.json', `${out}/models/manifest.json`);
const page = readFileSync('tools/artifact/page.html', 'utf8');
writeFileSync(`${out}/index.html`, page.replace('/*BUNDLE_CSS*/', readFileSync(`dist/assets/${css}`, 'utf8').trim()));
console.log(`artifact-out/: index.html, breakwater.js (${js}), models/manifest.json`);
