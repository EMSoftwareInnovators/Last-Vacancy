// The machines, by keyboard, the way a player does them: the supply room
// shelves (take, put back from the list, put back with G), loading a machine
// with one E, the coin box out and back in and out again, two snack boxes in
// one go, and the coins rung in at the register. node tools/vendtest.mjs
import { launch } from './pw.mjs';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT || 'shots';
mkdirSync(OUT, { recursive: true });
const T = await launch();
const { page, ev, wait, check } = T;
const key = async (k) => { await page.keyboard.press(k); await wait(150); };
const shot = async (n) => { await wait(300); await page.screenshot({ path: `${OUT}/vend-${n}.png` }); };
/** Stand somewhere and look at a point; give the HUD a moment to notice. */
const look = async (x, z, tx, ty, tz) => {
  await ev(({ x, z, tx, ty, tz }) => { const p = window.__game.player; p.x = x; p.z = z; p.lv = 0; p.vx = p.vz = 0; p.yaw = Math.atan2(tx - x, tz - z); p.pitch = Math.atan2(ty - (p.footY + p.eye), Math.hypot(tx - x, tz - z)); }, { x, z, tx, ty, tz });
  await wait(250);
};
const st = () => ev(() => {
  const s = window.__game.shift, V = s.vending;
  return {
    mode: s.mode, prompt: document.getElementById('prompt').innerText.replace(/\s+/g, ' '),
    held: s.g.player.held.map((h) => `${h.kind}:${h.product || h.machine || ''}:${h.qty || h.amount || ''}`),
    coke: V.count('soda', 'coke'), cokeShelf: s.memory.inv('v_coke'), sodaCoins: V.machine('soda').coins,
    funyuns: V.count('snack', 'funyuns'), honeybun: V.count('snack', 'honeybun'),
    floor: s.floorItems.length, drawer: s.ledger.drawer, vin: s.ledger.vendingIn,
    paper: document.getElementById('paper-body') ? document.getElementById('paper-body').innerText : '',
  };
});
const sel = () => ev(() => { const r = document.querySelector('#paper tr.sel'); return r ? r.innerText.replace(/\s+/g, ' ') : ''; });

await ev(() => { window.__game.sound.muted = true; });
await key('Enter'); await wait(800);
for (const k of ['Digit2', 'Digit2', 'Digit1']) await key(k);     // June: skip the tour

// the supply room door: the sign is on the wall over it, so opening the door leaves nothing floating
await look(2.75, 29.6, 2.75, 1.6, 31);
await shot('01-supply-door');
await ev(() => window.__game.doors.open('maint', 30)); await wait(900);
await shot('02-supply-door-open');

// the soda shelf
await look(3.4, 32.55, 2.2, 1.0, 32.55);
let s = await st();
check('the soda shelf says what the drink machine is out of', /Soda shelf: the drink machine is out of Coke\b/.test(s.prompt), s.prompt);
await shot('03-shelves');
await key('KeyE');
check('the list opens on "take what the drink machine needs"', /Take what the drink machine needs: Coca-Cola/.test(await sel()), await sel());
await shot('04-soda-list');
await key('KeyE');
s = await st();
check('...and E takes a case of Coke', s.held.some((h) => h.startsWith('vendPack:coke:20')) && s.cokeShelf === 20, JSON.stringify(s.held) + ' shelf ' + s.cokeShelf);
check('the Coke line now says PUT BACK, and it is highlighted', /Coca-Cola.*PUT BACK/.test(await sel()), await sel());
await shot('05-put-back');
await key('KeyE');
s = await st();
check('E on it puts the case back', !s.held.length && s.cokeShelf === 40, JSON.stringify(s.held) + ' shelf ' + s.cokeShelf);
await key('KeyE');
s = await st();
check('E again takes it again', s.held.some((h) => h.startsWith('vendPack:coke')), JSON.stringify(s.held));
await key('KeyQ');
s = await st();
check('the shelf prompt offers to put it back', /put back the case of Coca-Cola/.test(s.prompt), s.prompt);
await key('KeyG');
s = await st();
check('G in the supply room puts it back on the shelf, not the floor', !s.held.length && s.floor === 0 && s.cokeShelf === 40, JSON.stringify(s));
await key('KeyE'); await key('KeyE'); await key('KeyQ');           // take it for real

// the drink machine: E loads it straight in
await look(6.05, 32.7, 6.05, 1.2, 33.6);
s = await st();
check('the machine offers to load what you carry', /Load the case of Coca-Cola into the drink machine/.test(s.prompt), s.prompt);
await key('KeyE');
s = await st();
check('one E loads it: Coke full, hands empty, no panel', s.coke === 20 && !s.held.length && !s.mode, JSON.stringify(s));
await key('KeyE');
check('E again opens it, on the coin box', /Coin box/.test(await sel()), await sel());
await key('KeyE');
s = await st();
check('the coin box comes out', s.held.some((h) => h.startsWith('vendCoins')) && s.sodaCoins === 0, JSON.stringify(s.held));
await shot('06-coin-box');
await key('Digit8');
s = await st();
check('...and can go back in', !s.held.some((h) => h.startsWith('vendCoins')) && s.sodaCoins > 0, JSON.stringify(s));
await key('Digit7');
s = await st();
check('...and out again', s.held.some((h) => h.startsWith('vendCoins')), JSON.stringify(s.held));
await key('KeyQ');

// the snack shelf: one E takes both boxes the machine is out of
await look(3.4, 33.9, 2.2, 1.0, 33.9);
await key('KeyE');
check('the snack list opens on what the machine needs', /Take what the snack machine needs: .*Funyuns/.test(await sel()), await sel());
await key('KeyE');
s = await st();
check('...both boxes in one go', s.held.filter((h) => h.startsWith('vendPack')).length === 2, JSON.stringify(s.held));
await key('KeyQ');
await look(7.05, 32.7, 7.05, 1.2, 33.6);
await key('KeyE');
s = await st();
check('one E on the snack machine loads both', s.funyuns === 12 && s.honeybun === 12 && !s.held.some((h) => h.startsWith('vendPack')), JSON.stringify(s));

// the register
await look(4.4, -5.5, 5.16, 1.25, -4.72);
s = await st();
check('the register offers to ring in the coins', /Ring in the vending coins/.test(s.prompt), s.prompt);
await key('KeyE');
s = await st();
check('rung in: the drawer and the audit both know', s.vin > 0 && !s.held.some((h) => h.startsWith('vendCoins')), JSON.stringify(s));
process.exit(await T.done() ? 1 : 0);
