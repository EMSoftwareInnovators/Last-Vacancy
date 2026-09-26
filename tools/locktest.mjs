// Escape, Q and the mouse. node tools/locktest.mjs
//
// While the mouse is held, Firefox and Chrome keep Escape for themselves: the
// lock drops and the page never hears the key. So Escape is pause and only
// pause, and Q steps away from the rack, the terminal and papers without the
// mouse ever leaving. Playwright's key presses go straight to the page, so
// that Escape is acted out here as the lock dropping on its own (`eaten`).
// A browser might hand the key over as well (`handed`); that must still be
// one pause, not a pause and an unpause.
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
const st = () => ev(() => {
  const g = window.__game;
  return { state: g.state, mode: g.shift && g.shift.mode, screen: g.shift && g.shift.terminal.screen, locked: g.input.locked, want: g.wantLock };
});
const panel = () => ev(() => document.getElementById('panel-body').innerText);
const press = async (k) => { await page.keyboard.press(k); await wait(250); };
/** Hold the mouse again, the way a player would: walk a step. */
const relock = async () => { await page.keyboard.down('KeyW'); await wait(60); await page.keyboard.up('KeyW'); await wait(250); };
const exitLock = () => ev(() => { if (document.exitPointerLock) document.exitPointerLock(); });
/** Escape with the mouse held, as Firefox and Chrome do it: the lock goes, the key never arrives. */
const eaten = async () => { await exitLock(); await wait(300); };
/** ...and as a browser that drops the lock and then passes the key on anyway. */
const handed = async () => { await exitLock(); await page.keyboard.press('Escape'); await wait(300); };

await press('Enter'); await wait(700);                     // clock in: night one, June is at the desk
check('June is talking', (await st()).mode === 'talk');
if (!(await st()).locked) await relock();
await eaten();
check('Escape while she talks pauses', (await st()).state === 'PAUSE' && /Back to the conversation/.test(await panel()));
await press('Enter');
check('...and Enter goes back to her', (await st()).state === 'PLAY' && (await st()).mode === 'talk');
for (const k of ['Digit2', 'Digit2', 'Digit1']) await press(k);   // skip the tour
let s = await st();
check('skipping the tour: talk over, playing', s.state === 'PLAY' && !s.mode, JSON.stringify(s));
await calls();
if (!s.locked) await relock();
s = await st();
console.log('   (headless Chromium grants pointer lock:', s.locked, ')');
if (!s.locked) { console.log('   this browser will not lock the pointer; nothing more to check'); process.exit(await T.done() ? 1 : 0); }

// in the world: Escape pauses; Enter on the first line resumes and asks from inside that keypress
await eaten();
check('Escape in the world pauses', (await st()).state === 'PAUSE');
check('...and the pause menu offers the desk', /Back to the desk/.test(await panel()));
await calls();
await press('Enter');
let c = await calls();
s = await st();
check('Enter resumes', s.state === 'PLAY');
check('...and asks for the mouse from inside the Enter keypress', c.includes('keydown'), c.join(','));

// the key rack: Q steps away and the mouse never leaves
if (!(await st()).locked) await relock();
await ev(() => window.__game.shift.openBoard()); await wait(200);
const rackHint = await ev(() => document.getElementById('board-info').innerText);
check('the rack says Q steps away', /Q\s*step away/.test(rackHint), rackHint.replace(/\s+/g, ' ').slice(-60));
await press('KeyQ');
s = await st();
check('Q closes the key rack', s.state === 'PLAY' && !s.mode, JSON.stringify(s));
check('...with the mouse still held', s.locked);

// Escape on the rack pauses, says how to step away, and resuming goes back to the rack
await ev(() => window.__game.shift.openBoard()); await wait(200);
await eaten();
s = await st();
check('Escape on the rack pauses', s.state === 'PAUSE' && s.mode === 'board', JSON.stringify(s));
const p = await panel();
check('...the pause menu goes back to the key rack and says Q steps away from it', /Back to the key rack/.test(p) && /Q\s*steps away from the key rack/.test(p), p.replace(/\s+/g, ' ').slice(0, 160));
await calls();
await press('Enter');
c = await calls(); s = await st();
check('Enter goes back to the rack, mouse asked for inside the keypress', s.state === 'PLAY' && s.mode === 'board' && c.includes('keydown'), `${JSON.stringify(s)} ${c.join(',')}`);
await press('KeyQ');
check('...and Q closes it', !(await st()).mode);

// a browser that hands the Escape over as well: one pause, not a pause and an unpause
if (!(await st()).locked) await relock();
await ev(() => window.__game.shift.openBoard()); await wait(200);
await handed();
s = await st();
check('Escape passed on as well is still one pause', s.state === 'PAUSE', JSON.stringify(s));
await press('Enter'); await press('KeyQ');

// the terminal: Q backs out a screen at a time, and the mouse stays
if (!(await st()).locked) await relock();
await ev(() => window.__game.shift.openTerminal()); await wait(200);
const termFoot = await ev(() => document.getElementById('term-screen').innerText);
check('the terminal says [Q] STEP AWAY', /\[Q\] STEP AWAY/.test(termFoot));
await press('F1');
check('terminal on the check-in screen', (await st()).screen === 'checkin');
await press('KeyQ');
s = await st();
check('Q backs the terminal out to its menu', s.mode === 'terminal' && s.screen === 'main', JSON.stringify(s));
await press('Backspace');
s = await st();
check('Backspace closes it', s.state === 'PLAY' && !s.mode, JSON.stringify(s));
check('...with the mouse still held', s.locked);

// a note on the desk
await ev(() => window.__game.shift.openPaper('<div class="sheet"><p>test</p></div>')); await wait(200);
await press('KeyQ');
s = await st();
check('Q puts a note down, mouse held', s.state === 'PLAY' && !s.mode && s.locked, JSON.stringify(s));

// the pause menu: Escape and Q both resume (the mouse is loose there, so the page hears Escape)
await eaten();
check('paused again', (await st()).state === 'PAUSE');
await press('Escape');
s = await st();
check('Escape resumes', s.state === 'PLAY' && s.want);
await calls();
await press('KeyD');
c = await calls(); s = await st();
check('...and the mouse is back, or the next key asked for it from inside the keypress', s.locked && (c.includes('keydown') || !c.length), `${c.join(',')} locked=${s.locked}`);
await eaten();
await press('KeyQ');
check('Q resumes too', (await st()).state === 'PLAY');

// with the mouse loose in the world, the page does hear Escape: still a pause, and only one
await ev(() => window.__game.dropLock()); await wait(150);    // let go of it ourselves: no pause
check('the game letting go of the mouse is not a pause', (await st()).state === 'PLAY');
await press('Escape');
check('Escape with the mouse loose pauses', (await st()).state === 'PAUSE');
process.exit(await T.done() ? 1 : 0);
