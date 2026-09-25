// Check a guest in with the keyboard, the way a player does: look at things,
// press E, pick replies with number keys, work the terminal with F1 and ENTER,
// take keys off the rack. node tools/playtest.mjs
import { launch } from './pw.mjs';

const T = await launch();
const { page, ev, wait, check } = T;
const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(90); } };
const state = () => ev(() => { const s = window.__game.shift; return { mode: s.mode, prompt: document.getElementById('prompt').innerText, dlg: s.runner.node ? { text: s.runner.node.text.slice(0, 80), choices: (s.runner.node.choices || []).map((c) => c.label) } : null }; });
/** Point the camera at a spot in the world. */
const aim = (x, y, z) => ev(({ x, y, z }) => {
  const p = window.__game.player;
  const ey = p.footY + p.eye;
  p.yaw = Math.atan2(x - p.x, z - p.z);
  p.pitch = Math.atan2(y - ey, Math.hypot(x - p.x, z - p.z));
}, { x, y, z });
const pickChoice = async (re) => {
  const st = await state();
  const i = st.dlg ? st.dlg.choices.findIndex((c) => new RegExp(re).test(c)) : -1;
  if (i < 0) { console.log('   no choice matching', re, st.dlg && st.dlg.choices); return false; }
  await key(`Digit${i + 1}`);
  await wait(250);
  return true;
};
const stand = (x, z) => ev(({ x, z }) => { const p = window.__game.player; p.x = x; p.z = z; p.vx = p.vz = 0; }, { x, z });
const faceGuest = async () => { const g = await ev(() => { const f = window.__game.shift.desk.front(); return f ? { x: f.x, z: f.z, id: f.id } : null; }); if (g) await aim(g.x, 1.45, g.z); return g; };

await ev(() => { window.__game.sound.muted = true; });
await key('Enter');
await wait(900);
await key('KeyQ');
await wait(200);
check('note closed, playing', (await state()).mode === null);

async function checkInOne(round) {
// fast-forward to the next guest at the counter
await ev(() => {
  const s = window.__game.shift;
  for (let i = 0; i < 60000; i++) { s.update(0.05, 'PLAY'); const f = s.desk.front(); if (f && f.deskReason === 'checkin' && (!f.ci || f.ci.stage === 'talk') && Math.hypot(f.x - 2.9, f.z + 3.55) < 0.25) break; if (f && f.deskReason !== 'checkin') { s.desk.finish(f); } if (s.phone.ringing().length) { for (const c of s.phone.ringing()) s.phone.end(c, 'done'); } }
  const p = window.__game.player; p.x = 2.3; p.z = -5.55;
});
const guest = await faceGuest();
await wait(300);
let st = await state();
check(`[${round}] ` + 'prompt offers to help the guest', /Help /.test(st.prompt), st.prompt);
await key('KeyE');
await wait(600);
st = await state();
check(`[${round}] ` + 'dialogue opened', st.mode === 'talk' && !!st.dlg, st.dlg && st.dlg.text);
// ask what there is to ask, then go to the system
for (let n = 0; n < 6; n++) {
  st = await state();
  if (!st.dlg) break;
  const ask = st.dlg.choices.findIndex((c) => !/system/i.test(c));
  if (ask >= 0 && n < 4) { await key(`Digit${ask + 1}`); await wait(300); continue; }
  await pickChoice('system');
  break;
}
st = await state();
check(`[${round}] ` + 'conversation handed off to the terminal', st.mode === null, JSON.stringify(st.dlg));
const stage = await ev((id) => window.__game.shift.npcs.find(id).ci.stage, guest.id);
check(`[${round}] ` + 'guest waiting on the system', stage === 'system', stage);

// the terminal: to the left of the stool, on the counter
await aim(1.4, 1.25, -4.65);
await wait(250);
st = await state();
check(`[${round}] ` + 'looking at the terminal', /terminal/i.test(st.prompt), st.prompt);
await key('KeyE');
await wait(300);
check(`[${round}] ` + 'terminal open', (await state()).mode === 'terminal');
await key('F1');
await wait(200);
const scr = await ev(() => document.getElementById('term-screen').innerText);
check(`[${round}] ` + 'F1 shows the check-in form with the guest', /F1 CHECK-IN/.test(scr) && /NAME/.test(scr), scr.split('\n').slice(3, 6).join(' | '));
await key('Enter'); await key('Enter'); await key('Enter');
await wait(300);
const posted = await ev((id) => window.__game.shift.npcs.find(id).ci.stage, guest.id);
check(`[${round}] ` + 'ENTER posts the check-in', posted === 'pay', posted);
await key('KeyQ'); await key('KeyQ');
await wait(200);
check(`[${round}] ` + 'stepped away from the terminal', (await state()).mode === null);

// the money
await faceGuest(); await wait(200);
await key('KeyE'); await wait(400);
await pickChoice("That'll be");
await wait(300);
st = await state();
const pay = await ev((id) => { const p = window.__game.shift.npcs.find(id); return { stage: p.ci.stage, pay: p.stay.pay }; }, guest.id);
console.log('   paying by', pay.pay, 'stage', pay.stage, st.dlg && st.dlg.choices);
if (pay.stage === 'voucher') await pickChoice('on file');
else if (pay.stage === 'cash') {
  await pickChoice('register');
  await stand(4.4, -5.5);                                // a step down the counter to the register
  await aim(5.16, 1.25, -4.72); await wait(250);
  const rp = (await state()).prompt; console.log('   register prompt:', rp);
  check(`[${round}] ` + 'register offers to ring it up', /Ring up/.test(rp), rp);
  await key('KeyE'); await wait(300);
  await stand(2.9, -5.5);
  await faceGuest(); await key('KeyE'); await wait(300);
  await pickChoice('change'); await wait(300);
}
else if (pay.stage === 'card') {
  await pickChoice('imprinter');
  await aim(4.41, 1.12, -4.78); await wait(250);
  console.log('   imprinter prompt:', (await state()).prompt);
  await page.keyboard.down('KeyE'); await wait(1100); await page.keyboard.up('KeyE'); await wait(200);
  await faceGuest(); await key('KeyE'); await wait(300); await pickChoice('Sign here'); await wait(300);
}
st = await state();
if (st.dlg) { const i = st.dlg.choices.findIndex((c) => /key/i.test(c)); if (i >= 0) { await key(`Digit${i + 1}`); await wait(200); } }
const afterPay = await ev((id) => window.__game.shift.npcs.find(id).ci.stage, guest.id);
check(`[${round}] ` + 'paid; now the key', afterPay === 'key', afterPay);
if ((await state()).mode === 'talk') { await key('Digit1'); await wait(250); }

// the rack, behind the stool
await aim(2.1, 1.55, -6.95);
await wait(250);
st = await state();
check(`[${round}] ` + 'looking at the key rack', /Key rack/.test(st.prompt), `${st.prompt} | mode=${st.mode} | ${JSON.stringify(await ev(() => { const p = window.__game.player; return { x: p.x.toFixed(2), z: p.z.toFixed(2), sit: p.sitting, ring: window.__game.shift.phone.ringing().length }; }))} ${st.dlg ? st.dlg.text : ''}`);
await key('KeyE'); await wait(300);
check(`[${round}] ` + 'key rack open', (await state()).mode === 'board');
await key('KeyE'); await wait(200);
const held = await ev(() => window.__game.player.held.filter((h) => h.kind === 'key').map((h) => h.room));
check(`[${round}] ` + 'took the key(s) the desk is waiting on', held.length > 0, held.join(','));
await key('KeyQ'); await wait(200);

// across the counter
await faceGuest(); await wait(200);
await key('KeyE'); await wait(400);
await pickChoice('Hand over');
for (let n = 0; n < 5; n++) { st = await state(); if (!st.dlg) break; await key('Digit1'); await wait(250); }
const done = await ev((id) => { const p = window.__game.shift.npcs.find(id); return { stage: p.ci.stage, inLine: window.__game.shift.desk.line.includes(p), queue: p.queue.map((a) => a.kind) }; }, guest.id);
check(`[${round}] ` + 'guest checked in and on the way to the room', done.stage === 'done' && !done.inLine && done.queue.length > 2, JSON.stringify(done));
}
for (let r = 1; r <= 4; r++) await checkInOne(r);
process.exit(await T.done() ? 1 : 0);
