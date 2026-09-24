// Stand somewhere and take a picture: node tools/look.mjs name x z yaw pitch [lv]
import { launch } from './pw.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.env.OUT || 'shots';
mkdirSync(OUT, { recursive: true });
const T = await launch();
const views = process.argv.slice(2).join(' ').split(';').map((s) => s.trim()).filter(Boolean).map((s) => s.split(/\s+/));
await T.ev(() => { window.__game.sound.muted = true; });
await T.page.keyboard.press('Enter');
await T.wait(600);
for (const [name, x, z, yaw, pitch, lv, hour] of views) {
  await T.ev(({ x, z, yaw, pitch, lv, hour }) => {
    const g = window.__game;
    const p = g.player;
    p.x = +x; p.z = +z; p.yaw = +yaw; p.pitch = +pitch; p.lv = +(lv || 0); p.vx = 0; p.vz = 0;
    if (g.shift && g.shift.clock && hour) g.shift.clock.setHour(+hour);
  }, { x, z, yaw, pitch, lv, hour });
  await T.wait(700);
  const st = await T.ev(() => ({ tris: window.__game.stats.tris, chunks: window.__game.stats.chunks, rooms: window.__game.stats.rooms, zone: window.__game.playerZone }));
  console.log(name, JSON.stringify(st));
  await T.page.screenshot({ path: `${OUT}/${name}.png` });
}
process.exit(await T.done() ? 1 : 0);
