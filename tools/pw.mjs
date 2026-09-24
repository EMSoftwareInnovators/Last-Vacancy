/* Shared harness for the headless checks: boots a static server if one is
   not already up, launches the pre-installed Chromium, and gives back a page
   with the game loaded and a couple of helpers. Final Rental's tools each
   did this by hand; it is one import here. */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';

export const PORT = Number(process.env.PORT || 8080);
const EXE = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function up() {
  return new Promise((res) => {
    const r = http.get(`http://localhost:${PORT}/index.html`, (x) => { x.resume(); res(x.statusCode === 200); });
    r.on('error', () => res(false));
  });
}

export async function launch(opts = {}) {
  let server = null;
  if (!(await up())) {
    server = spawn(process.execPath, ['serve.cjs'], { stdio: 'ignore', env: { ...process.env, PORT: String(PORT) } });
    for (let i = 0; i < 40 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
  }
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: opts.w || 1024, height: opts.h || 768 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message + '\n' + (e.stack || '').split('\n').slice(1, 4).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  if (opts.clear !== false) {
    await page.addInitScript(() => { try { if (!sessionStorage.getItem('lv-keep')) { localStorage.clear(); sessionStorage.setItem('lv-keep', '1'); } } catch (e) { /* */ } });
  }
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.state !== 'BOOT', null, { timeout: 30000 });
  const ev = (f, a) => page.evaluate(f, a);
  const wait = (ms) => page.waitForTimeout(ms);
  let fails = 0;
  const check = (label, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? ' ok ' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); return ok; };
  const done = async () => {
    await browser.close();
    if (server) server.kill();
    if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); fails += errors.length; }
    return fails;
  };
  return { browser, page, ev, wait, check, errors, done, get fails() { return fails; } };
}
