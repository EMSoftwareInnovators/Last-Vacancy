/* ============================================================
   nav.js -- how people get around the property.

   Final Rental hand-placed eighteen waypoints and ran Dijkstra over
   them, and walked straight lines wherever a straight line was
   clear. Same here, except the waypoints come from the floor plan
   (a node outside and inside every door, along every walk, round
   the pool and through the office), carry a floor, and are joined
   automatically wherever two of them can see each other. Stairs and
   doorways are joined by hand.
   ============================================================ */
import {
  ROOMS, WEST, EAST, NORTH, STAIRS, SPOTS, LAUNDRY, MAINT, POOL, ROOM_W, SEATS,
} from './layout.js';
import { clearPath } from './collision.js';

export function buildNav(solids) {
  const N = [];
  const node = (x, z, lv = 0, tag = '') => { const n = { i: N.length, x, z, lv, tag }; N.push(n); return n; };
  const E = [];
  const link = (a, b) => E.push([a.i, b.i]);

  /* ---- the office ---- */
  const lobIn = node(4.0, -1.0, 0, 'lobbyIn');
  const lobOut = node(4.0, 1.4, 0, 'lobbyOut');
  link(lobIn, lobOut);
  node(2.9, -3.4); node(5.6, -2.6); node(6.9, -4.3); node(0.3, -2.4);
  const deskGap = node(7.1, -4.9);
  node(5.6, -5.7); node(2.3, -5.7); node(0.2, -5.8);
  const boDoor = node(5.7, -6.6); const boIn = node(5.7, -7.6);
  link(boDoor, boIn); link(deskGap, boDoor);
  node(4.0, -10.4); node(1.6, -12.6); node(5.2, -12.7); node(6.7, -9.2);
  const pd1 = node(-0.5, -11.55); const pd2 = node(-1.6, -11.55);
  link(pd1, pd2);
  node(-4.5, -11.0); node(-3.0, -12.8);
  const pdb1 = node(-2.0, -8.6); const pdb2 = node(-2.0, -7.4);
  link(pdb1, pdb2);
  const archL = node(-0.3, -2.5); const archB = node(-1.8, -2.5);
  link(archL, archB);
  node(-4.0, -4.6); node(-6.4, -4.0); node(-6.4, -6.5); node(-6.4, -1.8); node(-4.0, -1.2); node(-4.0, -7.2);
  for (const s of SEATS) node(s.x + Math.sin(s.yaw) * -0.05, s.z, 0, 'seat');

  /* ---- outside: the front of the office and the drive ---- */
  node(9.3, 1.4); node(-1.2, 1.4); node(-7.0, 1.6); node(10.0, -3.0); node(-10.0, -3.0);
  node(-11.0, -9.0); node(10.8, -10.0); node(0.0, -15.6); node(-8, -15.6); node(8, -15.6);
  // round the lot on the drive lanes
  for (let z = 3.2; z <= 20.6; z += 3.6) { node(-4.4, z); node(4.4, z); }
  node(0, 4.4); node(0, 12); node(-7.4, 20.0); node(7.4, 20.0); node(-8.2, 30.2); node(8.2, 30.2);
  node(-10.2, 34); node(10.2, 34); node(-11.0, 30.8); node(11.0, 30.8);

  /* ---- the walks, and a node outside and inside every door ---- */
  const bandW0 = node(-13.0, 4.3), bandW1 = node(-13.0, 28.9);
  const bandE0 = node(13.0, 7.9), bandE1 = node(13.0, 28.9);
  const upW0 = node(-13.0, 4.5, 1), upW1 = node(-13.0, 28.9, 1);
  const upE0 = node(13.0, 8.1, 1), upE1 = node(13.0, 28.9, 1);
  void bandW0; void bandW1; void bandE0; void bandE1; void upW0; void upW1; void upE0; void upE1;
  for (const r of ROOMS) {
    const o = node(r.outside.x, r.outside.z, r.lv, 'out:' + r.no);
    const i = node(r.inside.x, r.inside.z, r.lv, 'in:' + r.no);
    const c = node(r.center.x, r.center.z, r.lv, 'room:' + r.no);
    link(o, i); link(i, c);
    r.navOut = o.i; r.navIn = i.i; r.navCenter = c.i;
  }
  // mid-points along the walks so long runs have somewhere to turn
  for (let z = WEST.z0 + ROOM_W; z < 29; z += ROOM_W) { node(-12.9, z); node(-12.9, z, 1); }
  for (let z = 7.6 + ROOM_W; z < 29; z += ROOM_W) { node(12.9, z); node(12.9, z, 1); }

  /* ---- stairs ---- */
  for (const s of STAIRS) {
    const cx = (s.x0 + s.x1) / 2;
    const bot = node(cx, s.bottom - 0.6, 0, 'stairBot:' + s.id);
    const top = node(cx, s.top + 0.35, 1, 'stairTop:' + s.id);
    link(bot, top);
    s.navBot = bot.i; s.navTop = top.i;
  }

  /* ---- the north block and the pool ---- */
  const lIn = node(0.8, 33.4, 0, 'laundry'); const lOut = node(-0.05, 30.2);
  link(lIn, lOut);
  const mIn = node(2.75, 32.4, 0, 'maint'); const mOut = node(2.75, 30.2);
  link(mIn, mOut);
  node(7.2, 32.4, 0, 'alcove'); node(4.6, 30.2);
  const gS0 = node(0, 19.9, 0, 'gateS'); const gS1 = node(0, 21.4, 0, 'gateSin');
  const gN0 = node(0, 30.1, 0, 'gateN'); const gN1 = node(0, 28.6, 0, 'gateNin');
  link(gS0, gS1); link(gN0, gN1);
  node(-5.2, 21.6); node(5.2, 21.6); node(-5.4, 28.6); node(5.0, 26.9); node(3.2, 28.4);
  void LAUNDRY; void MAINT; void POOL; void NORTH; void EAST; void SPOTS;

  /* ---- join everything that can see everything else ---- */
  const MAXD = 9.5;
  for (let a = 0; a < N.length; a++) {
    for (let b = a + 1; b < N.length; b++) {
      const A = N[a], B = N[b];
      if (A.lv !== B.lv) continue;
      const d = Math.hypot(A.x - B.x, A.z - B.z);
      if (d > MAXD || d < 0.05) continue;
      if (clearPath(A.x, A.z, B.x, B.z, A.lv, solids, 0.26)) E.push([a, b]);
    }
  }
  const adj = N.map(() => []);
  for (const [a, b] of E) {
    const w = Math.hypot(N[a].x - N[b].x, N[a].z - N[b].z) + (N[a].lv !== N[b].lv ? 2 : 0);
    adj[a].push([b, w]); adj[b].push([a, w]);
  }
  return { nodes: N, adj, solids };
}

function nearestNode(nav, x, z, lv, r) {
  let best = -1, bestD = Infinity;
  for (const n of nav.nodes) {
    if (n.lv !== lv) continue;
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bestD && d < 14 && clearPath(x, z, n.x, n.z, lv, nav.solids, r)) { bestD = d; best = n.i; }
  }
  if (best >= 0) return best;
  for (const n of nav.nodes) {
    if (n.lv !== lv) continue;
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bestD) { bestD = d; best = n.i; }
  }
  return best;
}

/**
 * A route from (fx, fz, flv) to (tx, tz, tlv): a list of {x, z, lv}
 * waypoints ending at the target. Straight there if it can be.
 */
export function navPath(nav, fx, fz, flv, tx, tz, tlv, r = 0.3) {
  if (flv === tlv && clearPath(fx, fz, tx, tz, flv, nav.solids, r)) return [{ x: tx, z: tz, lv: tlv }];
  const a = nearestNode(nav, fx, fz, flv, r);
  const b = nearestNode(nav, tx, tz, tlv, r);
  if (a < 0 || b < 0) return [{ x: tx, z: tz, lv: tlv }];
  const N = nav.nodes;
  const dist = new Float64Array(N.length).fill(Infinity);
  const prev = new Int32Array(N.length).fill(-1);
  const seen = new Uint8Array(N.length);
  dist[a] = 0;
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < N.length; i++) if (!seen[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0 || u === b) break;
    seen[u] = 1;
    for (const [v, w] of nav.adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
  }
  if (!isFinite(dist[b])) return [{ x: tx, z: tz, lv: tlv }];
  const out = [];
  for (let c = b; c >= 0; c = prev[c]) { out.unshift({ x: N[c].x, z: N[c].z, lv: N[c].lv }); if (c === a) break; }
  // skip the first node if we can already see the second
  if (out.length > 1 && out[0].lv === flv && out[1].lv === flv && clearPath(fx, fz, out[1].x, out[1].z, flv, nav.solids, r)) out.shift();
  out.push({ x: tx, z: tz, lv: tlv });
  return out;
}
