/* ============================================================
   render.js -- one frame of the Starlite.

   Final Rental's render() drew one static mesh, a television, two
   doors, some tapes and the people, then handed the buffer to the
   tape deck. This is the same order of operations over a bigger
   place: the chunks the camera can see, the rooms you could be
   looking into, every door at its angle, every curtain lit or dark,
   the pool, the cars, the people, what is in your hands, and then
   the post pass -- with the tape switched off by default, because
   this is a motel and not a videocassette.
   ============================================================ */
import { mat, mul, setPosYaw, setTranslate, setRotX, invertRigid } from '../engine/mathx.js';
import { buildCamera, heldMatrix, heldCashMatrix } from './player.js';
import { drawActor } from './actor.js';
import { lightAt } from './world/lighting.js';
import { ROOMS, toWorld, BTV } from './world/layout.js';
import { leafYaw } from './world/doors.js';
import { WIN_L } from './world/roombuild.js';

const M = { view: mat(), cam: mat(), m: mat(), tmp: mat(), I: mat() };

export function renderFrame(g, dt) {
  const rz = g.raster, p = g.player;
  const W = g.world, T = g.T;
  const dawn = g.clock ? g.clock.dawn() : 0;

  /* ---- camera ---- */
  const cam = g.camOverride || p;
  buildCamera(cam, M.cam);
  if (cam.roll) {
    const c = Math.cos(cam.roll), s = Math.sin(cam.roll), r = M.tmp;
    r[0] = c; r[1] = -s; r[2] = 0; r[3] = 0; r[4] = s; r[5] = c; r[6] = 0; r[7] = 0; r[8] = 0; r[9] = 0; r[10] = 1; r[11] = 0;
    mul(M.cam, M.cam, r);
  }
  invertRigid(M.view, M.cam);
  rz.setCamera(M.view, 1.2);

  /* ---- fog: short indoors, long outside, lifting at dawn ---- */
  const indoor = g.playerZone && g.playerZone !== 'outside' && g.playerZone !== 'alcove';
  const fogFar = indoor ? 18 : 30 + dawn * 22;
  rz.fogNear += ((indoor ? 5 : 9) - rz.fogNear) * Math.min(1, dt * 4);
  rz.fogFar += (fogFar - rz.fogFar) * Math.min(1, dt * 4);

  const sky = skyColor(dawn);
  rz.clear(sky);

  /* ---- the sky and the treeline ---- */
  const bdTex = dawn > 0.66 ? T.backdrop.dawn : dawn > 0.2 ? T.backdrop.predawn : T.backdrop.night;
  const bd = W.dyn.backdrop;
  const bdTx = g._bdTx || (g._bdTx = bd.textures.slice());
  bdTx[bd.slot] = bdTex;
  setTranslate(M.m, cam.x, 0, cam.z);
  rz.drawMesh(bd, M.m, { textures: bdTx });

  /* ---- static chunks ---- */
  const outShade = 1 + dawn * 0.55;
  setTranslate(M.I, 0, 0, 0);
  let chunksDrawn = 0;
  for (const c of W.chunks) {
    const b = c.mesh.bounds;
    if (!c.always && !rz.sphereVisible(b.x, b.y, b.z, b.r)) continue;
    rz.drawMesh(c.mesh, M.I, { shade: c.indoor ? 1 : outShade });
    chunksDrawn++;
  }

  /* ---- rooms you could see into ---- */
  let roomsDrawn = 0;
  for (const r of ROOMS) {
    const mesh = W.roomMeshes[r.no];
    const inside = g.playerRoom === r;
    if (!inside) {
      const d = g.doors.room(r.no);
      if (!d || d.swing < 0.05) continue;
      if (Math.hypot(cam.x - r.center.x, cam.z - r.center.z) > 16) continue;
    }
    const b = mesh.bounds;
    if (!rz.sphereVisible(b.x, b.y, b.z, b.r)) continue;
    const st = g.rooms ? g.rooms.get(r.no) : null;
    const lit = inside || !st || st.lightsOn ? 1 : 0.3;
    rz.drawMesh(mesh, M.I, { shade: lit });
    roomsDrawn++;
  }

  /* ---- doors and gates ---- */
  const dyn = W.dyn;
  for (const d of g.doors.list) {
    if (!rz.sphereVisible(d.hx, d.y + 1, d.hz, 1.4)) continue;
    let mesh;
    if (d.kind === 'room') mesh = d.lv ? dyn.roomDoorUp : dyn.roomDoor;
    else if (d.kind === 'glass') mesh = dyn.glassDoor;
    else if (d.kind === 'steel') mesh = dyn.steelDoor;
    else if (d.kind === 'gate') mesh = dyn.gate;
    else mesh = dyn.interiorDoor;
    setPosYaw(M.m, d.hx, d.y, d.hz, leafYaw(d));
    const sh = d.kind === 'interior' ? lightAt(d.hx, 1.2, d.hz, 0) : Math.min(1.2, lightAt(d.hx, 1.2, d.hz, d.lv) * 1.1) * (d.kind === 'room' ? outShade : 1);
    rz.drawMesh(mesh, M.m, { shade: sh });
  }

  /* ---- every window: curtains lit if somebody is up in there ---- */
  const cur = dyn.curtain;
  const cTx = g._cTx || (g._cTx = cur.textures.slice());
  for (const r of ROOMS) {
    const [wx, wz] = toWorld(r, r.win.x0, 0);
    if (!rz.sphereVisible(wx, r.y + 1.4, wz, 1.2)) continue;
    const st = g.rooms ? g.rooms.get(r.no) : null;
    const glow = st ? st.windowGlow : 'dark';
    cTx[cur.slot] = glow === 'lit' ? T.curtainLit : glow === 'tv' ? T.curtainTv : T.curtainDark;
    setPosYaw(M.m, wx, r.y + WIN_L.y0, wz, r.yaw);
    rz.drawMesh(cur, M.m, { shade: glow === 'dark' ? 0.55 * outShade : 1, textures: cTx });
  }

  /* ---- the breakfast television ---- */
  const tv = dyn.tv;
  if (rz.sphereVisible(BTV.x, BTV.y, BTV.z, 0.8)) {
    const tvTx = g._tvTx || (g._tvTx = tv.textures.slice());
    tvTx[tv.screenSlot] = g.tvFrame ? g.tvFrame() : T.channels.OFF[0];
    setPosYaw(M.m, BTV.x, BTV.y, BTV.z, BTV.yaw);
    rz.drawMesh(tv, M.m, { shade: 0.95, textures: tvTx });
  }

  /* ---- the pool ---- */
  const pw = dyn.poolWater;
  if (rz.sphereVisible(pw.bounds.x, pw.bounds.y, pw.bounds.z, pw.bounds.r)) {
    const pTx = g._pTx || (g._pTx = pw.textures.slice());
    pTx[pw.slot] = T.poolWater[Math.floor(g.time * 3) % T.poolWater.length];
    setTranslate(M.m, 0, 0, 0);
    rz.drawMesh(pw, M.m, { shade: 0.85, textures: pTx });
  }

  /* ---- everything the systems want drawn this frame ---- */
  for (const d of g.draws) {
    if (!rz.sphereVisible(d.x, d.y + 0.3, d.z, d.r || 1.2)) continue;
    setPosYaw(M.m, d.x, d.y, d.z, d.yaw || 0);
    if (d.pitch) { setRotX(M.tmp, d.pitch); mul(M.m, M.m, M.tmp); }
    if (d.scale) { const k = d.scale; M.m[0] *= k; M.m[1] *= k; M.m[2] *= k; M.m[4] *= k; M.m[5] *= k; M.m[6] *= k; M.m[8] *= k; M.m[9] *= k; M.m[10] *= k; }
    rz.drawMesh(d.mesh, M.m, { shade: d.shade !== undefined ? d.shade : lightAt(d.x, d.y + 0.5, d.z, d.lv || 0), textures: d.textures, flags: d.flags });
  }

  /* ---- people ---- */
  for (const c of g.people()) {
    if (c.hidden) continue;
    const shade = lightAt(c.x, 1.1, c.z, c.lv || 0) * (c.lv === 0 && g.zoneOf(c) === 'outside' ? outShade : 1);
    drawActor(rz, g.actorMeshes, c, Math.min(1.35, shade));
  }

  /* ---- your hands ---- */
  const hs = Math.min(1.1, lightAt(p.x, 1.2, p.z, p.lv) * 1.15);
  if (!g.camOverride) {
    const bulky = p.held.some((h) => h.bulky);
    for (let i = 0; i < p.held.length; i++) {
      const it = p.held[i];
      const mesh = dyn.items[it.mesh] || dyn.items.box;
      heldMatrix(p, i, M.m, Math.sin(p.bobPhase) * 0.6, bulky);
      rz.drawMesh(mesh, M.m, { shade: hs });
    }
    if (p.cash && (p.cash.tendered > 0.001 || p.changeInHand > 0.001)) {
      heldCashMatrix(p, M.m, Math.sin(p.bobPhase) * 0.6);
      rz.drawMesh(dyn.items.cash, M.m, { shade: hs });
    }
  }

  g.stats.chunks = chunksDrawn; g.stats.rooms = roomsDrawn; g.stats.tris = rz.tris;

  /* ---- post ---- */
  const o = g.opts;
  const tape = o.vhs;
  g.post.render(rz.color, {
    dt,
    dither: o.dither,
    vhs: tape,
    bleed: tape ? 1 : 0,
    scan: o.scan ? (tape ? 0.8 : 0.9) : 1,
    ghost: tape ? 0.16 : 0,
    grain: tape ? 6 + o.grain * 12 : 2,
    warp: 0,
    fade: g.fade,
    flash: 0,
    dark: 1.08,
    tintR: indoor ? 1.02 : 1.05, tintG: 1, tintB: indoor ? 0.97 : 0.95,
    distress: tape ? o.grain * 0.3 : 0,
  });
}

/** The sky behind everything: nearly black, going blue-gray toward seven. */
function skyColor(dawn) {
  const lerp = (a, b) => Math.round(a + (b - a) * dawn);
  const r = lerp(8, 70), gg = lerp(12, 88), b = lerp(24, 128);
  return (0xFF000000 | (b << 16) | (gg << 8) | r) >>> 0;
}
