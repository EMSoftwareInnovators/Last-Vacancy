// Boot, clock in, and run the night forward with nobody at the desk.
// node tools/smoke.mjs [minutes]
import { launch } from './pw.mjs';

const T = await launch();
const mins = Number(process.argv[2] || 60);
await T.ev(() => { window.__game.sound.muted = true; });
await T.page.keyboard.press('Enter');
await T.wait(800);
T.check('shift started', await T.ev(() => !!window.__game.shift && window.__game.state === 'PLAY'));
T.check('note is open', await T.ev(() => window.__game.shift.mode === 'paper'));
await T.page.keyboard.press('Escape');
await T.wait(200);
T.check('note closed', await T.ev(() => window.__game.shift.mode === null));
const out = await T.ev((mins) => {
  const g = window.__game, s = g.shift;
  const start = s.clock.min;
  const errs = [];
  let steps = 0;
  while (s.clock.min < start + mins && steps < 200000) {
    try { s.update(0.05, 'PLAY'); } catch (e) { errs.push(String(e.stack || e).split('\n').slice(0, 4).join(' | ')); if (errs.length > 5) break; }
    if (s.mode && s.mode !== 'paper') { /* leave it */ }
    steps++;
  }
  return {
    steps, errs, time: s.clock.label(), people: s.npcs.list.length, visible: s.people().length,
    desk: s.desk.line.map((p) => `${p.name}:${p.deskReason}`), ringing: s.phone.ringing().length, calls: s.phone.log.length,
    cars: s.cars.list.map((c) => `${c.desc}:${c.state}`).slice(0, 12), events: s.director.events.filter((e) => e.done).map((e) => e.label).slice(-20),
  };
}, mins);
console.log(JSON.stringify(out, null, 1));
T.check('no errors while running', out.errs.length === 0);
process.exit(await T.done() ? 1 : 0);
