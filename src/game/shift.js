/* Temporary stub: walk the property. Replaced by the real shift. */
import { ST } from './game.js';
import { SPOTS, zoneAt } from './world/layout.js';
import { createPlayer } from './player.js';

export class Shift {
  constructor(game) { this.g = game; this.clock = null; this.rooms = null; this.breakfast = null; }
  start() {
    const g = this.g;
    g.player = createPlayer();
    g.player.x = SPOTS.clerk.x; g.player.z = SPOTS.clerk.z; g.player.yaw = 0;
    g.state = ST.PLAY; g.ui.setHudVisible(true); g.wantLock = true; g.grabLock();
  }
  update(dt) {
    const g = this.g;
    if (g.input.hit('Escape')) { g.pause(); return; }
    const ctx = { solids: g.solids, dynSolids: g.doors.solids, playerStep: () => g.sound.footstep(0, false, zoneAt(g.player.x, g.player.z, g.player.lv) === 'outside' ? 'concrete' : 'carpet') };
    g.updateWalk(dt, ctx);
    g.doors.update(dt, [{ ...g.player, isPlayer: true }]);
    g.sound.setListener(g.player.x, g.player.z, g.player.yaw, zoneAt(g.player.x, g.player.z, g.player.lv) === 'outside' ? 0 : 1);
    g.placeAmbience(this);
  }
  idleDraw() {}
  focus() { return null; }
  people() { return []; }
  voiceBlip() {}
  onSchemeChanged() {}
  onPause() {}
  onResume() { this.g.wantLock = true; this.g.grabLock(); }
  dispose() {}
}
