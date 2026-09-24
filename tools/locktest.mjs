// Escape and the mouse: pause, resume, overlays, and taking the pointer back
// on the next real keypress. node tools/locktest.mjs
import { launch } from './pw.mjs';

const T = await launch();
const { page, ev, wait, check } = T;
await ev(() => {
  const g = window.__game; g.sound.muted = true;
  // record every lock request and whether it came from inside a real input event
  window.__lockCalls = [];
  const orig = g.input.requestLock.bind(g.input);
  g.input.requestLock = () => { window.__lockCalls.push(window.event ? window.event.type : 'frame'); orig(); };
});
const calls = () => ev(() => window.__lockCalls.splice(0));
const st = () => ev(() => ({ state: window.__game.state, mode: window.__game.shift && window.__game.shift.mode, locked: window.__game.input.locked, want: window.__game.wantLock }));
/** What the browser does on Escape while locked: drop the lock, then deliver the key. */
const escape = async () => { await ev(() => { if (document.exitPointerLock) document.exitPointerLock(); }); await page.keyboard.press('Escape'); await wait(300); };

await page.keyboard.press('Enter'); await wait(900);     // clock in: June's note is open
await calls();
await page.keyboard.press('KeyE'); await wait(300);      // put the note down
let c = await calls();
check('after the note, the mouse is held or was asked for from inside the keypress', (await st()).locked || c.includes('keydown'), c.join(','));
const locksHeadless = (await st()).locked;
console.log('   (headless Chromium grants pointer lock:', locksHeadless, ')');

// Escape in the world pauses; Enter on "Back to the desk" resumes and asks from inside that keypress
await escape();
check('Escape in the world pauses', (await st()).state === 'PAUSE');
await calls();
await page.keyboard.press('Enter'); await wait(300);
c = await calls();
let s = await st();
check('Enter resumes', s.state === 'PLAY');
check('...and asks for the mouse from inside the Enter keypress', c.includes('keydown'), c.join(','));

// Escape closing the terminal does not pause, and the next key takes the mouse back
await ev(() => window.__game.shift.openTerminal()); await wait(200);
await escape();
s = await st();
check('Escape closes the terminal without pausing', s.state === 'PLAY' && !s.mode, JSON.stringify(s));
await ev(() => { if (document.exitPointerLock) document.exitPointerLock(); }); await wait(100);
await calls();
await page.keyboard.down('KeyW'); await wait(120); await page.keyboard.up('KeyW');
c = await calls();
check('the next key (W) asks for the mouse from inside the keypress', c.includes('keydown'), c.join(','));
const hint = await ev(() => document.getElementById('prompt').innerText);
if (!locksHeadless) check('a loose mouse is explained on screen', /look around/.test(hint), hint);

// Escape to resume (no gesture): the next ordinary key takes it back
await escape();
check('paused again', (await st()).state === 'PAUSE');
await page.keyboard.press('Escape'); await wait(300);
s = await st();
check('Escape resumes too', s.state === 'PLAY' && s.want);
await calls();
await page.keyboard.press('KeyD'); await wait(200);
c = await calls();
s = await st();
check('...and the mouse is back, or the next key asked for it from inside the keypress', s.locked || c.includes('keydown'), `${c.join(',')} locked=${s.locked}`);
process.exit(await T.done() ? 1 : 0);
