// Shared helpers: start `vite preview` and launch headless Chromium with
// software WebGL (SwiftShader).

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

export const PORT = 4173;
export const BASE = `http://localhost:${PORT}/`;

// External font requests may fail in sandboxed CI; they are not game errors.
export const IGNORED_ERRORS = [/fonts\.googleapis\.com/, /fonts\.gstatic\.com/, /ERR_NAME_NOT_RESOLVED/, /ERR_TUNNEL/];

export async function startPreview() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE);
      if (res.ok) {
        return proc;
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  proc.kill();
  throw new Error('vite preview did not start');
}

export async function launchBrowser() {
  return chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
}

export function ignorable(text) {
  return IGNORED_ERRORS.some((re) => re.test(text));
}

export async function openPage(browser, url, errors, size = { width: 1280, height: 720 }) {
  const page = await browser.newPage({ viewport: size });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !ignorable(msg.text())) {
      errors.push(`console: ${msg.text()}`);
    }
  });
  page.on('requestfailed', (req) => {
    if (!ignorable(req.url())) {
      errors.push(`requestfailed: ${req.url()}`);
    }
  });
  // Serve fonts as empty CSS so sandboxed runs don't depend on the network.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  );
  await page.goto(url);
  await page.waitForFunction(() => window.__game && window.__game.state().fps > 0, null, { timeout: 90000 });
  return page;
}
