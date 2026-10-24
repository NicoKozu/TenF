// Speicherschicht. Aktuell localStorage – später durch ein Backend austauschbar,
// solange die exportierte API gleich bleibt.

const PREFIX = 'tenf:';
const KEYS = { settings: 'settings', sessions: 'sessions' };
const DATA_VERSION = 1;

const DEFAULT_SETTINGS = {
  theme: 'system', // 'system' | 'light' | 'dark'
  layout: 'de-qwertz',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false; // z. B. privater Modus oder Speicher voll
  }
}

// ----- Einstellungen -----
export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write(KEYS.settings, next);
  return next;
}

// ----- Sessions -----
/**
 * Session-Format:
 * { id, date (ISO), durationSec, mode, wpm, accuracy, errorsByKey: {code: n}, errorsByFinger: {finger: n} }
 */
export function getSessions() {
  return read(KEYS.sessions, []);
}

export function addSession(session) {
  const sessions = getSessions();
  const entry = { id: crypto.randomUUID?.() ?? String(Date.now()), date: new Date().toISOString(), ...session };
  sessions.push(entry);
  write(KEYS.sessions, sessions);
  return entry;
}

// ----- Export / Import / Löschen -----
export function exportData() {
  return JSON.stringify(
    { app: 'tenf', version: DATA_VERSION, exportedAt: new Date().toISOString(), settings: getSettings(), sessions: getSessions() },
    null,
    2,
  );
}

/** Importiert JSON (String). Wirft bei ungültigen Daten. merge=true hängt Sessions an. */
export function importData(json, { merge = false } = {}) {
  let data;
  try { data = JSON.parse(json); } catch { throw new Error('Datei ist kein gültiges JSON.'); }
  if (data?.app !== 'tenf' || !Array.isArray(data.sessions)) {
    throw new Error('Keine gültige TenF-Datei.');
  }
  if (data.version > DATA_VERSION) throw new Error('Datei stammt aus einer neueren TenF-Version.');
  const valid = data.sessions.every((x) => x && typeof x.date === 'string' && Number.isFinite(x.wpm));
  if (!valid) throw new Error('Datei enthält ungültige Sessions.');
  const sessions = merge ? mergeById(getSessions(), data.sessions) : data.sessions;
  write(KEYS.sessions, sessions);
  if (data.settings) saveSettings(data.settings);
  return sessions.length;
}

/**
 * Fügt Sessions hinzu wie frisch beendete; gleiche ID → aktualisiert.
 * @returns {{added:number, updated:number, total:number}}
 */
export function importSessions(list) {
  const cur = getSessions();
  const ids = new Set(cur.map((s) => s.id));
  const withIds = list.map((s) => ({ ...s, id: s.id || (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`) }));
  const updated = withIds.filter((s) => ids.has(s.id)).length;
  const merged = mergeById(cur, withIds);
  if (!write(KEYS.sessions, merged)) throw new Error('Speichern fehlgeschlagen (Speicher voll oder gesperrt).');
  return { added: withIds.length - updated, updated, total: merged.length };
}

export function deleteSession(id) {
  write(KEYS.sessions, getSessions().filter((s) => s.id !== id));
}

/** Nur den Verlauf löschen, Einstellungen bleiben. */
export function clearSessions() {
  try { localStorage.removeItem(PREFIX + KEYS.sessions); } catch { /* ignorieren */ }
}

export function clearAll() {
  Object.values(KEYS).forEach((k) => {
    try { localStorage.removeItem(PREFIX + k); } catch { /* ignorieren */ }
  });
}

function mergeById(a, b) {
  const map = new Map(a.map((s) => [s.id, s]));
  b.forEach((s) => map.set(s.id, s));
  return [...map.values()].sort((x, y) => x.date.localeCompare(y.date));
}
