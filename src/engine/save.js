/* ============================================================
   save.js -- what survives closing the window.

   Final Rental remembered exactly one thing between sessions, the
   controller layout, and wrote it straight to localStorage from the
   middle of game.js. The motel has to remember a great deal more --
   who has stayed, in which room, what they said last time, what the
   owner thought of your last shift -- so storage gets its own small
   module: versioned keys, JSON, and a failure mode that is always
   "carry on with the defaults" rather than a dead game.
   ============================================================ */

const PREFIX = 'lastvacancy.';
export const SAVE_VERSION = 1;

function read(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) { return null; }
}
function write(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch (err) { return false; }
}
function drop(key) { try { localStorage.removeItem(PREFIX + key); } catch (err) { /* nothing to do */ } }

/* ---- settings: everything in the options screen ---- */
export function loadSettings(defaults) {
  const s = read('settings');
  return s && typeof s === 'object' ? { ...defaults, ...s } : { ...defaults };
}
export function saveSettings(o) { return write('settings', o); }

/* ---- controller bindings, kept where Final Rental kept them conceptually ---- */
export function loadBinds() { return read('padbinds'); }
export function saveBinds(b) { return write('padbinds', b); }

/* ---- the motel: guests, rooms, residents, inventory, the owner's notes ---- */
export function loadGame() {
  const g = read('game');
  if (!g || g.version !== SAVE_VERSION) return null;
  return g;
}
export function saveGame(data) { return write('game', { ...data, version: SAVE_VERSION, savedAt: Date.now() }); }
export function clearGame() { drop('game'); }
export function hasGame() { return !!loadGame(); }
