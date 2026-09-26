// Night one, June's tour, start to finish, the way a player takes it: follow
// her to each stop, answer her, fill the Coke from the supply room, pull the
// coin box, ring it in; then check that the night starts, she comes back
// behind the desk, and she answers questions. node tools/tourtest.mjs
import { launch } from './pw.mjs';
import { mkdirSync } from 'node:fs';
const SP = process.env.OUT || 'shots';
mkdirSync(SP, { recursive: true });
const T = await launch();
const { page, ev, wait, check } = T;
const key = async (k) => { await page.keyboard.press(k); await wait(140); };
const st = () => ev(() => { const s = window.__game.shift, t = s.training, j = t && t.june; return { mode: s.mode, phase: t && t.phase, i: t && t.i, stop: t && (t.phase === 'tour') ? (window.__tour || [])[t.i] : null, arrived: t && t.arrived, waiting: t && t.waiting, jx: j && +j.x.toFixed(2), jz: j && +j.z.toFixed(2), clock: s.clock.label(), min: s.clock.min, hold: !!s.clock.hold, obj: document.getElementById('objective').innerText, dlg: s.runner.node ? s.runner.node.text.slice(0, 70) : null, choices: s.runner.node && s.runner.node.choices ? s.runner.node.choices.map((c) => c.label) : null }; });
await ev(async () => { window.__game.sound.muted = true; const m = await import('/src/game/dialogue/june.js'); window.__tour = m.TOUR.map((x) => x.id); });
await key('Enter'); await wait(900);
let s = await st();
check('night one opens with June talking, the clock held', s.mode === 'talk' && s.phase === 'tour' && s.hold && /June Whitfield/.test(s.dlg), JSON.stringify(s));
await page.screenshot({ path: `${SP}/tour-intro.png` });
/** Pick a reply by text (or the first), until the talk ends. */
const talkThrough = async (re, max = 8) => { for (let n = 0; n < max; n++) { s = await st(); if (s.mode !== 'talk') return; const i = re ? Math.max(0, s.choices.findIndex((c) => re.test(c))) : 0; await key(`Digit${i + 1}`); await wait(120); } };
/** Walk behind her the way a player does, a couple of steps back, until she stops at the next stop. */
const followJune = async () => {
  for (let n = 0; n < 600; n++) {
    s = await st();
    if (s.arrived || s.mode) break;
    await ev(() => { const s = window.__game.shift, j = s.training.june, p = s.g.player; p.x = j.x - Math.sin(j.yaw) * 2.0; p.z = j.z - Math.cos(j.yaw) * 2.0; p.lv = j.lv || 0; p.vx = p.vz = 0; });
    await wait(100);
  }
};
const goNearJune = async () => {
  await followJune();
  await ev(() => { const s = window.__game.shift, j = s.training.june, p = s.g.player; const a = Math.atan2(p.x - j.x, p.z - j.z); p.x = j.x + Math.sin(a) * 1.8; p.z = j.z + Math.cos(a) * 1.8; p.lv = j.lv || 0; p.vx = p.vz = 0; p.yaw = Math.atan2(j.x - p.x, j.z - p.z); });
  for (let n = 0; n < 30; n++) { s = await st(); if (s.mode === 'talk') break; await wait(100); }
};
await talkThrough(/Lead the way|Every dollar|rack is the truth|Follow/);
// stay behind the desk while she goes through to the back office (a short walk: she does not need to wait)
for (let n = 0; n < 300 && !(await st()).arrived; n++) await wait(100);
// close to her through the back office wall is not next to her
await ev(() => { const p = window.__game.player; p.x = 4.3; p.z = -6.6; p.lv = 0; p.yaw = Math.PI; });
await wait(1200);
s = await st();
check('three meters away through a wall, she does not start talking', s.mode !== 'talk' && s.arrived, `${s.mode} | ${s.obj}`);
await ev(() => { const p = window.__game.player; p.x = 4.3; p.z = -8.4; p.yaw = Math.PI; });
for (let n = 0; n < 20 && (await st()).mode !== 'talk'; n++) await wait(100);
check('next to her in the back office, she starts', (await st()).mode === 'talk');
await talkThrough();
const seen = ['back'];
for (let guard = 0; guard < 30; guard++) {
  s = await st();
  if (s.phase !== 'tour') break;
  seen.push(s.stop);
  if (s.stop === 'coke') {
    // the supply room: the SODA shelf opens on what the machine needs; then one E on the machine loads it
    await ev(() => { const p = window.__game.player; p.x = 3.4; p.z = 32.55; p.yaw = -Math.PI / 2; p.pitch = -0.2; });
    await wait(300); await key('KeyE'); await key('KeyE'); await key('KeyQ');
    await ev(() => { const p = window.__game.player; p.x = 6.05; p.z = 32.7; p.yaw = 0; p.pitch = -0.05; });
    await wait(300); await key('KeyE');
    await wait(300);
    continue;
  }
  if (s.stop === 'pull') {
    await ev(() => { const p = window.__game.player; p.x = 6.05; p.z = 32.7; p.yaw = 0; p.pitch = -0.05; });
    await wait(300); await key('KeyE');
    await key('Digit7'); await key('KeyQ'); await wait(300);
    continue;
  }
  if (s.stop === 'ring') {
    await ev(() => { const p = window.__game.player; p.x = 4.4; p.z = -5.5; p.yaw = Math.atan2(5.16 - 4.4, -4.72 + 5.5); p.pitch = Math.atan2(1.25 - 1.62, Math.hypot(0.76, 0.78)); });
    await wait(300); await key('KeyE'); await wait(300);
    continue;
  }
  if (s.stop === 'machines') {
    // the long walk out to the machines: stay put in the breakfast room, and she stops and waits for you
    await wait(6000);
    s = await st();
    const gap = await ev(() => { const s = window.__game.shift, j = s.training.june, p = s.g.player; return Math.hypot(j.x - p.x, j.z - p.z); });
    check('left behind, June stops and waits for you', s.waiting && gap < 7.5 && !s.arrived, `waiting=${s.waiting} ${gap.toFixed(1)} m | ${s.obj}`);
    await page.screenshot({ path: `${SP}/tour-waiting.png` });
  }
  await goNearJune();
  if (s.stop === 'machines') await page.screenshot({ path: `${SP}/tour-machines.png` });
  await talkThrough();
  await wait(200);
}
s = await st();
console.log('   stops:', seen.join(' > '));
check('the tour ran to the end and the night started', s.phase === 'ride' && !s.hold, JSON.stringify(s));
const v = await ev(() => { const s = window.__game.shift; return { coke: s.vending.count('soda', 'coke'), vin: s.ledger.vendingIn, tasks: s.tasks.open().map((t) => t.text) }; });
check('Coke filled, coins rung in, the other machines on the notepad', v.coke === 20 && v.vin > 0 && v.tasks.length >= 2, JSON.stringify(v));
// the night runs; she follows
await ev(() => { const p = window.__game.player; p.x = 2.3; p.z = -5.55; p.yaw = 0; });
const m0 = (await st()).min;
await wait(2500);
s = await st();
check('the clock runs after the tour', s.min > m0, `${m0.toFixed(2)} -> ${s.min.toFixed(2)}`);
const jd = await ev(() => { const s = window.__game.shift, j = s.training.june; return { x: +j.x.toFixed(1), z: +j.z.toFixed(1), zone: s.g.zoneOf(j) }; });
check('June comes back behind the desk with you', jd.zone === 'desk', JSON.stringify(jd));
await ev(() => { const p = window.__game.player; p.yaw = Math.atan2(-0.5 - p.x, -6.4 - p.z); p.pitch = 0; });
await wait(400);
await page.screenshot({ path: `${SP}/tour-ride.png` });
// ask her something
await ev(() => { const s = window.__game.shift; s.talkTo(s.training.june); });
await wait(200);
s = await st();
check('talking to June offers questions', s.mode === 'talk' && s.choices.some((c) => /doing right now/.test(c)), JSON.stringify(s.choices));
await key('Digit1'); await wait(300);
s = await st();
console.log('   June says:', s.dlg, '|', (s.choices || []).join(' / '));
await page.screenshot({ path: `${SP}/tour-ask.png` });
process.exit(await T.done() ? 1 : 0);
