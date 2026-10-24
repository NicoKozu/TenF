// Sessions ⇄ Excel (.xlsx). Wird erst bei Export/Import nachgeladen.
import { writeXlsx, readXlsx, fromSerial, STYLE } from './xlsx.js';
import { labelForCode, codeForLabel, FINGERS } from './keyboard.js';

const SHEET = 'Sessions';
const FOCUS = { all: 'Alle Tasten', home: 'Grundreihe', 'home-top': 'Grund + oben', 'home-bottom': 'Grund + unten', custom: 'Eigener Text' };
const MODE = { training: 'Training' };

// [Überschrift, Breite, Stil]
const COLS = [
  ['Datum', 17, STYLE.date], ['Modus', 10], ['Länge', 11], ['Fokus', 14], ['Finger', 21],
  ['Großschreibung', 10], ['Bei Fehler stoppen', 10], ['Dauer (s)', 9, STYLE.int], ['WPM', 8, STYLE.dec1],
  ['Genauigkeit (%)', 12, STYLE.pct], ['Korrekte Zeichen', 10, STYLE.int], ['Anschläge', 10, STYLE.int],
  ['Fehler', 8, STYLE.int], ['Fehler je Taste', 38], ['Fehler je Finger', 38], ['Anschläge je Taste', 48], ['ID', 38],
];

// ----- Hilfen -----
const yesNo = (b) => (b ? 'Ja' : 'Nein');
const round1 = (n) => Math.round(n * 10) / 10;

function lengthLabel(l = '') {
  if (l === 'full') return 'Ganzer Text';
  const n = Number(l.slice(1));
  return l[0] === 't' ? `${n / 60} Min` : l[0] === 'w' ? `${n} Wörter` : '';
}

function parseLength(v) {
  const s = String(v ?? '').trim();
  if (/^[tw]\d+$/.test(s)) return s;
  if (s === 'full' || /^ganzer text$/i.test(s)) return 'full';
  const n = parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(n)) return undefined;
  if (/min/i.test(s)) return 't' + Math.round(n * 60);
  if (/w/i.test(s)) return 'w' + Math.round(n);
  return undefined;
}

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v ?? '').trim().toLowerCase();
  if (['ja', 'j', 'true', 'wahr', 'x', 'yes', '1'].includes(s)) return true;
  if (['nein', 'n', 'false', 'falsch', 'no', '0'].includes(s)) return false;
  return undefined;
}

function parseNum(v) {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return NaN;
  // "1.234,5" oder "93,4 %" → 1234.5 / 93.4
  let s = String(v).replace(/[%\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return Number(s);
}

function parseDate(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return fromSerial(v);
  const s = String(v ?? '').trim();
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:[,\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (de) {
    const y = de[3].length === 2 ? 2000 + Number(de[3]) : Number(de[3]);
    return new Date(y, de[2] - 1, de[1], de[4] ?? 0, de[5] ?? 0, de[6] ?? 0);
  }
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(s) : new Date(NaN);
}

/** {code:n} → "Q:3; Ö:2" (absteigend) */
function encodeMap(map, label) {
  return Object.entries(map ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${label(k)}:${n}`).join('; ');
}

/** "Q:3; Ö:2" → {code:n}; unbekannte Einträge werden übersprungen. */
function decodeMap(str, resolve) {
  const out = {};
  for (const part of String(str ?? '').split(';')) {
    const i = part.lastIndexOf(':');
    if (i < 1) continue;
    const key = resolve(part.slice(0, i).trim());
    const n = parseInt(part.slice(i + 1), 10);
    if (key && n > 0) out[key] = (out[key] ?? 0) + n;
  }
  return out;
}

const fingerByName = (name) => {
  if (name in FINGERS) return name;
  const l = name.toLowerCase();
  return Object.keys(FINGERS).find((id) => FINGERS[id].toLowerCase() === l) ?? null;
};
const reverse = (obj, v) => Object.keys(obj).find((k) => obj[k].toLowerCase() === String(v ?? '').trim().toLowerCase());

// ----- Export -----
export function sessionsToXlsx(sessions) {
  const head = COLS.map(([h]) => ({ v: h, s: STYLE.header }));
  const rows = sessions.map((s) => {
    const c = s.config ?? {};
    const vals = [
      new Date(s.date), MODE[s.mode] ?? s.mode ?? '', lengthLabel(c.length), FOCUS[c.focus] ?? '',
      c.finger && c.finger !== 'all' ? FINGERS[c.finger] ?? c.finger : 'Alle',
      c.caps == null ? '' : yesNo(c.caps), c.strict == null ? '' : yesNo(c.strict),
      s.durationSec, round1(s.wpm), round1(s.accuracy), s.chars, s.strokes, s.errors,
      encodeMap(s.errorsByKey, labelForCode), encodeMap(s.errorsByFinger, (f) => FINGERS[f] ?? f),
      encodeMap(s.hitsByKey, labelForCode), s.id,
    ];
    return vals.map((v, i) => (v == null || v === '' ? null : { v, s: COLS[i][2] ?? STYLE.text }));
  });

  const info = [
    [{ v: 'TenF – Trainingsverlauf', s: STYLE.title }],
    [`Exportiert am ${new Date().toLocaleString('de-DE')} · ${sessions.length} Session(s)`],
    [],
    [{ v: 'Wieder einlesen', s: STYLE.header }],
    [{ v: 'Im Verlauf-Tab unter „Importieren“ diese Datei wählen. Jede Zeile im Blatt „Sessions“ wird übernommen, als wäre die Session gerade beendet worden.', s: STYLE.wrap }],
    [{ v: 'Zeilen mit vorhandener ID werden aktualisiert, Zeilen ohne oder mit neuer ID kommen hinzu. Pflichtspalten: Datum, WPM, Genauigkeit (%).', s: STYLE.wrap }],
    [{ v: 'Spaltenüberschriften und das Blatt „Sessions“ bitte nicht umbenennen. Die Reihenfolge der Spalten ist egal.', s: STYLE.wrap }],
    [],
    [{ v: 'Spalten', s: STYLE.header }],
    ['WPM = (korrekte Zeichen / 5) / Minuten · Genauigkeit = korrekte Anschläge / alle Anschläge'],
    ['„Fehler je Taste“ usw.: Format Taste:Anzahl, getrennt mit Semikolon, z. B. Q:3; Ö:2; Leertaste:1'],
    ['Großschreibung / Bei Fehler stoppen: Ja oder Nein'],
  ];

  return writeXlsx([
    { name: SHEET, rows: [head, ...rows], widths: COLS.map(([, w]) => w), freeze: true, filter: true },
    { name: 'Info', rows: info, widths: [110] },
  ]);
}

// ----- Import -----
/**
 * Liest Sessions aus einer .xlsx-Datei.
 * @returns {{sessions:object[], skipped:number[]}} skipped = Excel-Zeilennummern ungültiger Zeilen
 */
export function xlsxToSessions(buf) {
  const { rows } = readXlsx(buf, SHEET);
  const hi = rows.findIndex((r) => r.some((c) => String(c ?? '').trim().toLowerCase() === 'wpm'));
  if (hi < 0) throw new Error('Keine Spalte „WPM“ gefunden – ist das ein TenF-Export?');

  const col = {};
  rows[hi].forEach((h, i) => { if (h != null) col[String(h).trim().toLowerCase()] = i; });
  const get = (row, name) => row[col[name.toLowerCase()]];
  for (const need of ['Datum', 'WPM', 'Genauigkeit (%)']) {
    if (!(need.toLowerCase() in col)) throw new Error(`Pflichtspalte „${need}“ fehlt.`);
  }

  const sessions = [];
  const skipped = [];
  rows.slice(hi + 1).forEach((row, i) => {
    if (!row.some((c) => c != null && c !== '')) return; // leere Zeile
    const date = parseDate(get(row, 'Datum'));
    const wpm = parseNum(get(row, 'WPM'));
    let accuracy = parseNum(get(row, 'Genauigkeit (%)'));
    // Als Excel-Prozentwert eingetragen (93 % wird als 0,93 gespeichert)
    if (typeof get(row, 'Genauigkeit (%)') === 'number' && accuracy > 0 && accuracy <= 1) accuracy *= 100;
    if (Number.isNaN(date.getTime()) || !(wpm >= 0) || !(accuracy >= 0 && accuracy <= 100)) {
      skipped.push(hi + i + 2);
      return;
    }

    const length = parseLength(get(row, 'Länge'));
    const focus = reverse(FOCUS, get(row, 'Fokus')) ?? 'all';
    const fingerTxt = String(get(row, 'Finger') ?? '').trim();
    const config = {
      ...(focus === 'custom' ? { source: 'custom' } : {}),
      length, focus,
      finger: fingerTxt && fingerTxt.toLowerCase() !== 'alle' ? fingerByName(fingerTxt) ?? 'all' : 'all',
      caps: parseBool(get(row, 'Großschreibung')),
      strict: parseBool(get(row, 'Bei Fehler stoppen')),
    };
    Object.keys(config).forEach((k) => config[k] === undefined && delete config[k]);

    const int = (name) => { const n = parseNum(get(row, name)); return n >= 0 ? Math.round(n) : undefined; };
    const errorsByKey = decodeMap(get(row, 'Fehler je Taste'), codeForLabel);
    const modeTxt = String(get(row, 'Modus') ?? '').trim();
    let durationSec = int('Dauer (s)');
    if (durationSec === undefined) durationSec = length?.[0] === 't' ? Number(length.slice(1)) : 0;

    const s = {
      // Ohne ID: stabile ID aus Datum + Werten, damit erneuter Import nicht doppelt anlegt.
      id: String(get(row, 'ID') ?? '').trim() || `xl-${date.getTime()}-${round1(wpm)}-${round1(accuracy)}`,
      date: date.toISOString(),
      mode: reverse(MODE, modeTxt) ?? (modeTxt.toLowerCase() || 'training'),
      config,
      durationSec,
      wpm,
      accuracy,
      chars: int('Korrekte Zeichen'),
      strokes: int('Anschläge'),
      errors: int('Fehler') ?? Object.values(errorsByKey).reduce((a, b) => a + b, 0),
      errorsByKey,
      errorsByFinger: decodeMap(get(row, 'Fehler je Finger'), fingerByName),
      hitsByKey: decodeMap(get(row, 'Anschläge je Taste'), codeForLabel),
    };
    Object.keys(s).forEach((k) => s[k] === undefined && delete s[k]);
    sessions.push(s);
  });
  return { sessions, skipped };
}
