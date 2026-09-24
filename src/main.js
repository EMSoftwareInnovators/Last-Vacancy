/* ============================================================
   main.js -- boot. Waits for the DOM, builds the game, and gets
   out of the way. (Final Rental's, with the motel's modules on the
   window for the console and the headless checks under tools/.)
   ============================================================ */
import { Game } from './game/game.js';
import * as layout from './game/world/layout.js';
import * as appearance from './game/appearance.js';
import * as mathx from './engine/mathx.js';
import * as inputmod from './engine/input.js';

const start = async () => {
  const game = new Game();
  window.__game = game;
  window.__layout = layout;
  window.__app = appearance;
  window.__mathx = mathx;
  window.__input = inputmod;
  try {
    await game.boot();
  } catch (err) {
    console.error(err);
    document.body.innerHTML =
      `<pre style="color:#5ff2e4;font:14px monospace;padding:2rem;white-space:pre-wrap">`
      + `LAST VACANCY failed to start.\n\n${err && err.stack ? err.stack : err}\n\n`
      + `Serve the folder over http:// (npm start) -- ES modules will not load from file://.</pre>`;
  }
};

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
else start();
