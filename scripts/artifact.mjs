// Playable page: build with a relative base, then put the bundle next to
// tools/artifact/page.html (touch pads, bridge panel) with the bundle CSS
// inlined. Outputs:
//   artifact-out/  claude.ai artifact (the host wraps the page skeleton)
//   site/          standalone page for GitHub Pages (full HTML document)

import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build --base ./', { stdio: 'inherit' });
const out = 'artifact-out';
mkdirSync(`${out}/models`, { recursive: true });
const assets = readdirSync('dist/assets');
// The page loads one bundle: take the entry dist/index.html names, and
// refuse a split build (a dynamic import makes extra chunks the page would
// 404 on).
const entry = readFileSync('dist/index.html', 'utf8').match(/assets\/([^"']+\.js)/);
const chunks = assets.filter((f) => f.endsWith('.js'));
if (!entry || chunks.length !== 1) {
  throw new Error(`artifact: expected one JS bundle, got ${chunks.join(', ')} (avoid dynamic import())`);
}
const js = entry[1];
const css = assets.find((f) => f.endsWith('.css'));
copyFileSync(`dist/assets/${js}`, `${out}/breakwater.js`);
copyFileSync('dist/models/manifest.json', `${out}/models/manifest.json`);
const page = readFileSync('tools/artifact/page.html', 'utf8');
const body = page.replace('/*BUNDLE_CSS*/', readFileSync(`dist/assets/${css}`, 'utf8').trim());
writeFileSync(`${out}/index.html`, body);
console.log(`artifact-out/: index.html, breakwater.js (${js}), models/manifest.json`);

const site = 'site';
mkdirSync(`${site}/models`, { recursive: true });
copyFileSync(`dist/assets/${js}`, `${site}/breakwater.js`);
copyFileSync('dist/models/manifest.json', `${site}/models/manifest.json`);
const head = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n';
writeFileSync(`${site}/index.html`, `${head}${body.replace('<title>Breakwater</title>', '<title>Breakwater</title>\n</head>\n<body>')}\n</body>\n</html>\n`);
writeFileSync(`${site}/.nojekyll`, '');
console.log('site/: GitHub Pages build');
