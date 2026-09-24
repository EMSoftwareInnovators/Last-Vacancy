// Screenshots of the shift's screens: node tools/uishots.mjs  -> shots/ui-*.png
import { launch } from './pw.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.env.OUT || 'shots';
mkdirSync(OUT, { recursive: true });
const T = await launch();
const shot = async (name) => { await T.wait(350); await T.page.screenshot({ path: `${OUT}/ui-${name}.png` }); console.log('shot', name); };
await T.ev(() => { window.__game.sound.muted = true; });
await T.page.keyboard.press('Enter');
await T.wait(900);
await shot('01-note');
await T.page.keyboard.press('Escape');
await T.wait(200);
// run until somebody is at the desk
await T.ev(() => {
  const s = window.__game.shift;
  for (let i = 0; i < 60000; i++) {
    s.update(0.05, 'PLAY');
    const f = s.desk.front();
    if (f && Math.hypot(f.x - 2.9, f.z + 3.55) < 0.3 && f.deskReason === 'checkin') break;
  }
  const p = window.__game.player; p.x = 2.3; p.z = -5.55; p.yaw = 0.18; p.pitch = -0.02;
});
await shot('02-desk');
await T.ev(() => { const s = window.__game.shift; s.talkTo(s.desk.front()); });
await T.wait(1200);
await shot('03-dialogue');
await T.page.keyboard.press('ArrowDown'); await T.page.keyboard.press('Enter'); await T.wait(1400);
await shot('04-dialogue-answer');
await T.ev(() => {
  const s = window.__game.shift; const R = s.runner;
  for (let n = 0; n < 12 && R.node; n++) { const ch = R.node.choices || []; const i = ch.findIndex((c) => !/system/i.test(c.label)); R.sel = i >= 0 ? i : ch.length - 1; R.pick(); }
  s.openTerminal(); s.terminal.go('checkin');
});
await shot('05-terminal-checkin');
await T.ev(() => { const s = window.__game.shift; s.terminal.go('main'); });
await shot('06-terminal-main');
await T.ev(() => { const s = window.__game.shift; s.closeOverlay(); s.openBoard(); });
await shot('07-keyrack');
await T.ev(() => { const s = window.__game.shift; s.closeOverlay(); });
await T.ev(async () => {
  const s = window.__game.shift;
  const { OUTSIDE_CALLS } = await import('/src/game/dialogue/calls.js');
  const c = s.incoming(OUTSIDE_CALLS.find((x) => x.id === 'gordy').make(s));
  s.startCall(c);
});
await T.wait(1500);
await shot('08-phone');
await T.ev(() => { const s = window.__game.shift; s.runner.cancel(); s.mode = null; window.__game.ui.hidePhone(); });
await T.ev(async () => { const s = window.__game.shift; const { binderHtml } = await import('/src/game/ui/papers.js'); s.openPaper(binderHtml(s)); });
await shot('09-binder');
await T.ev(() => { const s = window.__game.shift; s.closeOverlay(); s.openPaper(s.wakeups.html()); });
await shot('10-wakeups');
await T.ev(() => { const s = window.__game.shift; s.closeOverlay(); s.notesOpen = true; });
await T.wait(200);
await shot('11-notepad');
await T.ev(() => { const s = window.__game.shift; s.notesOpen = false; const p = window.__game.player; p.x = 5; p.z = 6; p.yaw = 2.6; p.pitch = 0.05; });
await shot('12-lot');
process.exit(await T.done() ? 1 : 0);
