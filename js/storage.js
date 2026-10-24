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
  const data = JSON.parse(json);
  if (data?.app !== 'tenf' || !Array.isArray(data.sessions)) {
    throw new Error('Keine gültige TenF-Datei.');
  }
  const sessions = merge ? mergeById(getSessions(), data.sessions) : data.sessions;
  write(KEYS.sessions, sessions);
  if (data.settings) saveSettings(data.settings);
  return sessions.length;
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
