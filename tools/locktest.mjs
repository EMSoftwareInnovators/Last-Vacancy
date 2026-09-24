// Escape and the mouse: pause, resume, the rack, the terminal, a note, and
// taking the pointer back on the next real keypress. node tools/locktest.mjs
//
// While the mouse is held, Firefox and Chrome keep Escape for themselves: the
// lock drops and the page never hears the key. Playwright's key presses go
// straight to the page, so that Escape is acted out here as the lock dropping
// on its own (`eaten`). Some browsers might hand the key over as well
// (`handed`); that must still count as one Escape.
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
const st = () => ev(() => { const g = window.__game; return { state: g.state, mode: g.shift && g.shift.mode, screen: g.shift && g.shift.terminal.screen, locked: g.input.locked, want: g.wantLock }; });
const press = async (k) => { await page.keyboard.press(k); await wait(250); };
/** Hold the mouse again, the way a player would: walk a step. */
const relock = async () => { await page.keyboard.down('KeyW'); await wait(60); await page.keyboard.up('KeyW'); await wait(250); };
const exitLock = () => ev(() => { if (document.exitPointerLock) document.exitPointerLock(); });
/** Escape with the mouse held, as Firefox and Chrome do it: the lock goes, the key never arrives. */
const eaten = async () => { await exitLock(); await wait(300); };
/** ...and as a browser that drops the lock and then passes the key on anyway. */
const handed = async () => { await exitLock(); await page.keyboard.press('Escape'); await wait(300); };

await press('Enter'); await wait(700);                     // clock in: June's note is open
await calls();
await press('KeyE');                                       // put the note down
let c = await calls();
let s = await st();
check('after the note, the mouse is held or was asked for from inside the keypress', s.locked || c.includes('keydown'), c.join(','));
const locksHeadless = s.locked;
console.log('   (headless Chromium grants pointer lock:', locksHeadless, '; page has focus:', await ev(() => document.hasFocus()), ')');
if (!locksHeadless) { console.log('   this browser will not lock the pointer; nothing more to check'); process.exit(await T.done() ? 1 : 0); }

// in the world: Escape pauses; Enter on "Back to the desk" resumes and asks from inside that keypress
await eaten();
check('Escape in the world pauses', (await st()).state === 'PAUSE');
await calls();
await press('Enter');
c = await calls(); s = await st();
check('Enter resumes', s.state === 'PLAY');
check('...and asks for the mouse from inside the Enter keypress', c.includes('keydown'), c.join(','));

// the key rack: Escape closes it and does not pause; the next key takes the mouse back
if (!(await st()).locked) await relock();
await ev(() => window.__game.shift.openBoard()); await wait(200);
await eaten();
s = await st();
check('Escape closes the key rack', s.state === 'PLAY' && !s.mode, JSON.stringify(s));
await wait(300);
check('...and stays closed, not paused', (await st()).state === 'PLAY');
const hint = await ev(() => document.getElementById('prompt').innerText);
check('a loose mouse is explained on screen', /look around/.test(hint), hint);
await calls();
await relock();
c = await calls(); s = await st();
check('the next key (W) asks for the mouse from inside the keypress', c.includes('keydown'), c.join(','));
check('...and has it', s.locked);

// a browser that hands the Escape over as well: still one Escape, the rack closes, no pause
await ev(() => window.__game.shift.openBoard()); await wait(200);
await handed();
s = await st();
check('Escape passed on as well still closes the rack once, no pause', s.state === 'PLAY' && !s.mode, JSON.stringify(s));

// the terminal: Escape backs out a screen, like it does with the mouse loose
await relock();
await ev(() => window.__game.shift.openTerminal()); await wait(200);
await press('F1');
check('terminal on the check-in screen', (await st()).screen === 'checkin');
await eaten();
s = await st();
check('Escape backs the terminal out to its menu', s.mode === 'terminal' && s.screen === 'main' && s.state === 'PLAY', JSON.stringify(s));
await press('Escape');                                     // the mouse is loose now, so the page hears this one
s = await st();
check('the next Escape closes it', s.state === 'PLAY' && !s.mode, JSON.stringify(s));

// a note on the desk
await relock();
await ev(() => window.__game.shift.openPaper('<div class="sheet"><p>test</p></div>')); await wait(200);
await eaten();
s = await st();
check('Escape puts a note down', s.state === 'PLAY' && !s.mode, JSON.stringify(s));

// switching windows is not an Escape: the rack stays open
await relock();
await ev(() => window.__game.shift.openBoard()); await wait(200);
await ev(() => dispatchEvent(new Event('blur')));
await eaten();
s = await st();
check('leaving the window with the rack open leaves the rack open', s.state === 'PLAY' && s.mode === 'board', JSON.stringify(s));
await press('Escape');
await relock();

// Escape to resume (no gesture): the next ordinary key takes it back
await eaten();
check('paused again', (await st()).state === 'PAUSE');
await press('Escape');
s = await st();
check('Escape resumes too', s.state === 'PLAY' && s.want);
await calls();
await press('KeyD');
c = await calls(); s = await st();
check('...and the mouse is back, or the next key asked for it from inside the keypress', s.locked && (c.includes('keydown') || !c.length), `${c.join(',')} locked=${s.locked}`);
process.exit(await T.done() ? 1 : 0);
