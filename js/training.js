// Trainingsmodus: zufällige Wörter abtippen, Live-Auswertung, Session speichern.
import { createKeyboard, keyForChar, labelForCode, fingerForCode, FINGERS } from './keyboard.js';
import { getSettings, saveSettings, addSession } from './storage.js';

const ROW_CHARS = { home: 'asdfghjklöä', top: 'qwertzuiopü', bottom: 'yxcvbnm' };
const FOCUS_ROWS = {
  all: null,
  home: ['home'],
  'home-top': ['home', 'top'],
  'home-bottom': ['home', 'bottom'],
};
const DEFAULTS = { source: 'words', length: 't60', focus: 'all', finger: 'all', caps: true, strict: false, customText: '' };
const CUSTOM_MAX = 5000;
const MIN_REAL_WORDS = 20; // darunter werden Übungs-Silben beigemischt

const $ = (id) => document.getElementById(id);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const inc = (obj, k) => { obj[k] = (obj[k] || 0) + 1; };

let wordlist = [];
let cfg;
let kb;
let s; // Zustand der laufenden Übung
let box, textEl, hintEl, panel;

export async function initTraining() {
  panel = $('panel-training');
  box = $('typing-box');
  textEl = $('typing-text');
  hintEl = $('next-key');
  cfg = { ...DEFAULTS, ...getSettings().training };
  kb = createKeyboard($('keyboard-training'));
  setupForm();
  bindEvents();
  try {
    const res = await fetch('data/wordlist-de.json');
    wordlist = (await res.json()).words ?? [];
  } catch {
    wordlist = []; // Fallback: nur Übungs-Silben
  }
  reset();
}

// ----- Einstellungen -----
function setupForm() {
  const finger = $('ts-finger');
  finger.append(
    new Option('Alle Finger', 'all'),
    ...Object.entries(FINGERS).filter(([k]) => k !== 'th').map(([k, v]) => new Option(v, k)),
  );
  const set = (id, val, def) => {
    const el = $(id);
    el.value = val;
    if (el.value === '') el.value = def;
  };
  set('ts-source', cfg.source, DEFAULTS.source);
  set('ts-length', cfg.length, DEFAULTS.length);
  set('ts-focus', cfg.focus, DEFAULTS.focus);
  set('ts-finger', cfg.finger, DEFAULTS.finger);
  $('ts-caps').checked = cfg.caps;
  $('ts-strict').checked = cfg.strict;
  $('ts-custom').value = cfg.customText ?? '';
  syncForm();
  cfg.length = $('ts-length').value;

  const apply = (e) => {
    // Beim Moduswechsel passende Standardlänge wählen
    if (e?.target?.id === 'ts-source') $('ts-length').value = $('ts-source').value === 'custom' ? 'full' : DEFAULTS.length;
    cfg = {
      source: $('ts-source').value,
      length: $('ts-length').value,
      focus: $('ts-focus').value,
      finger: $('ts-finger').value,
      caps: $('ts-caps').checked,
      strict: $('ts-strict').checked,
      customText: $('ts-custom').value.slice(0, CUSTOM_MAX),
    };
    syncForm();
    cfg.length = $('ts-length').value;
    saveSettings({ training: cfg });
    reset();
  };
  $('train-settings').addEventListener('change', apply);
  $('ts-custom-apply').addEventListener('click', () => { apply(); box.focus(); });
  $('train-settings').addEventListener('submit', (e) => e.preventDefault());
  $('ts-restart').addEventListener('click', () => { reset(); box.focus(); });
}

// Modusabhängige Felder ein-/ausblenden, ungültige Länge korrigieren
function syncForm() {
  const custom = $('ts-source').value === 'custom';
  document.querySelectorAll('#train-settings .words-only').forEach((el) => { el.hidden = custom; });
  $('ts-custom-wrap').hidden = !custom;
  const len = $('ts-length');
  for (const opt of len.options) opt.disabled = custom ? opt.value[0] === 'w' : opt.value === 'full';
  $('ts-length').querySelector('option[value="full"]').hidden = !custom;
  if (len.selectedOptions[0]?.disabled) len.value = custom ? 'full' : DEFAULTS.length;
}

// ----- Eigener Text -----
function customWords() {
  return (cfg.customText ?? '')
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u2033]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2039\u203A\u00B4\u0060]/g, "'")
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .split(/\s+/)
    .filter(Boolean);
}

// ----- Wortgenerator -----
function makeGenerator() {
  if (cfg.source === 'custom') {
    const words = customWords();
    let i = 0;
    return () => words[i++ % words.length];
  }
  const rows = FOCUS_ROWS[cfg.focus] ?? null;
  const allowed = new Set((rows ?? Object.keys(ROW_CHARS)).flatMap((r) => [...ROW_CHARS[r]]));
  let fingerChars = null;
  if (cfg.finger !== 'all') {
    fingerChars = [...allowed].filter((c) => keyForChar(c)?.finger === cfg.finger);
    if (!fingerChars.length) fingerChars = null;
  }

  const real = wordlist
    .filter((w) => {
      const lw = w.toLowerCase();
      if (rows && ![...lw].every((c) => allowed.has(c))) return false;
      if (fingerChars && ![...lw].some((c) => fingerChars.includes(c))) return false;
      return true;
    })
    .map((w) => (cfg.caps ? w : w.toLowerCase()));

  const pool = [...allowed];
  const pseudo = () => {
    const len = 2 + Math.floor(Math.random() * 4);
    let w = '';
    for (let i = 0; i < len; i++) w += fingerChars && Math.random() < 0.5 ? pick(fingerChars) : pick(pool);
    return cfg.caps && Math.random() < 0.15 ? w[0].toUpperCase() + w.slice(1) : w;
  };

  let last = '';
  return () => {
    let w;
    let tries = 0;
    do {
      const useReal = real.length >= MIN_REAL_WORDS || (real.length > 0 && Math.random() < 0.5);
      w = useReal ? pick(real) : pseudo();
    } while (w === last && ++tries < 10);
    last = w;
    return w;
  };
}

// ----- Ablauf -----
function reset() {
  clearInterval(s?.timer);
  const custom = cfg.source === 'custom';
  const words = custom ? customWords().length : 0;
  const full = custom && cfg.length === 'full';
  const type = full ? 'w' : cfg.length[0]; // 't' = Zeit, 'w' = Wörter
  const n = full ? words : Number(cfg.length.slice(1));
  s = {
    type, n, gen: makeGenerator(),
    chars: [], spans: [], typed: [], pos: 0,
    start: 0, timer: null, done: false,
    strokes: 0, correctStrokes: 0, correctChars: 0,
    errorsByKey: {}, errorsByFinger: {}, hitsByKey: {},
  };
  textEl.replaceChildren();
  textEl.style.transform = '';
  s.empty = custom && words === 0;
  if (s.empty) {
    textEl.textContent = 'Gib oben deinen eigenen Text ein und klick auf „Text übernehmen“.';
  } else {
    appendWords(type === 'w' ? n : 40);
  }
  $('st-words-wrap').hidden = type !== 'w';
  $('train-result').replaceChildren();
  $('train-result').hidden = true;
  box.classList.remove('running', 'done');
  updateCursor();
  updateStats();
}

function appendWords(count) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    if (s.chars.length) {
      s.chars.push(' ');
      const sp = document.createElement('span');
      sp.className = 'ch sp';
      sp.textContent = ' ';
      s.spans.push(sp);
      frag.append(sp);
    }
    const word = document.createElement('span');
    word.className = 'word';
    for (const c of s.gen()) {
      const span = document.createElement('span');
      span.className = 'ch';
      span.textContent = c;
      s.chars.push(c);
      s.spans.push(span);
      word.append(span);
    }
    frag.append(word);
  }
  textEl.append(frag);
}

function start() {
  s.start = performance.now();
  s.timer = setInterval(tick, 250);
  box.classList.add('running');
}

function elapsedSec() {
  if (!s.start) return 0;
  const e = (performance.now() - s.start) / 1000;
  return s.type === 't' ? Math.min(e, s.n) : e;
}

function tick() {
  if (s.type === 't' && elapsedSec() >= s.n) finish();
  else updateStats();
}

function input(ch, code) {
  if (!s.start) start();
  const expected = s.chars[s.pos];
  const ok = ch === expected;
  const info = keyForChar(expected);
  s.strokes++;
  if (info) inc(s.hitsByKey, info.code);
  if (ok) {
    s.correctStrokes++;
  } else {
    if (info) { inc(s.errorsByKey, info.code); inc(s.errorsByFinger, info.finger); }
    kb.flashWrong(code);
    if (cfg.strict) {
      const cur = s.spans[s.pos];
      cur.classList.remove('miss');
      void cur.offsetWidth; // Animation neu starten
      cur.classList.add('miss');
      updateStats();
      return;
    }
  }
  s.typed[s.pos] = ch;
  s.spans[s.pos].classList.add(ok ? 'ok' : 'bad');
  if (ok) s.correctChars++;
  s.pos++;

  if (s.type === 'w' && s.pos >= s.chars.length) { finish(); return; }
  if (s.type === 't' && s.pos > s.chars.length - 60) appendWords(15);
  updateCursor();
  updateStats();
}

function back() {
  if (s.pos === 0 || cfg.strict) return;
  s.pos--;
  if (s.typed[s.pos] === s.chars[s.pos]) s.correctChars--;
  s.typed[s.pos] = undefined;
  s.spans[s.pos].classList.remove('ok', 'bad');
  updateCursor();
  updateStats();
}

function updateCursor() {
  textEl.querySelector('.cur')?.classList.remove('cur');
  const cur = s.spans[s.pos];
  if (!cur || s.done || s.empty) { kb.clearHighlight(); hintEl.textContent = ''; return; }
  cur.classList.add('cur');

  // Aktuelle Zeile als zweite Zeile halten
  const lh = parseFloat(getComputedStyle(textEl).lineHeight) || 40;
  const offset = Math.max(0, cur.offsetTop - lh);
  textEl.style.transform = `translateY(${-offset}px)`;

  const ch = s.chars[s.pos];
  const info = kb.highlightChar(ch);
  if (!info) { hintEl.textContent = ''; return; }
  const name = ch === ' ' ? 'Leertaste' : labelForCode(info.code);
  const shift = info.shift ? ` + Umschalt ${info.shift === 'ShiftLeft' ? 'links' : 'rechts'}` : '';
  hintEl.textContent = `Nächste Taste: ${name}${shift} – ${FINGERS[info.finger]}`;
}

function calc() {
  const sec = elapsedSec();
  const min = Math.max(sec, 1) / 60;
  return {
    sec,
    wpm: Math.round((s.correctChars / 5 / min) * 10) / 10,
    accuracy: s.strokes ? Math.round((s.correctStrokes / s.strokes) * 1000) / 10 : 100,
    errors: s.strokes - s.correctStrokes,
  };
}

const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function updateStats() {
  const r = calc();
  $('st-time').textContent = fmtTime(s.type === 't' ? s.n - r.sec : r.sec);
  $('st-time-lbl').textContent = s.type === 't' ? 'Restzeit' : 'Zeit';
  $('st-wpm').textContent = s.start ? r.wpm.toFixed(0) : '–';
  $('st-acc').textContent = s.strokes ? `${r.accuracy.toFixed(0)} %` : '–';
  $('st-err').textContent = r.errors;
  if (s.type === 'w') {
    let done = 0;
    for (let i = 0; i < s.pos; i++) if (s.chars[i] === ' ') done++;
    $('st-words').textContent = `${done}/${s.n}`;
  }
}

function finish() {
  clearInterval(s.timer);
  const r = calc();
  s.done = true;
  box.classList.remove('running');
  box.classList.add('done');
  updateCursor();
  updateStats();
  if (s.type === 'w') $('st-words').textContent = `${s.n}/${s.n}`;

  if (s.strokes > 0) {
    const { customText, ...rest } = cfg;
    const config = cfg.source === 'custom'
      ? { source: 'custom', length: cfg.length, focus: 'custom', strict: cfg.strict }
      : { ...rest };
    addSession({
      mode: 'training',
      config,
      durationSec: Math.round(r.sec),
      wpm: r.wpm,
      accuracy: r.accuracy,
      chars: s.correctChars,
      strokes: s.strokes,
      errors: r.errors,
      errorsByKey: s.errorsByKey,
      errorsByFinger: s.errorsByFinger,
      hitsByKey: s.hitsByKey,
    });
  }
  showResult(r);
}

function showResult(r) {
  const out = $('train-result');
  const weak = Object.entries(s.errorsByKey).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const h = document.createElement('h3');
  h.textContent = 'Ergebnis';
  const dl = document.createElement('dl');
  dl.className = 'result-grid';
  for (const [k, v] of [
    ['WPM', r.wpm.toFixed(1)],
    ['Genauigkeit', `${r.accuracy.toFixed(1)} %`],
    ['Zeit', fmtTime(r.sec)],
    ['Fehler', r.errors],
  ]) {
    const div = document.createElement('div');
    div.append(Object.assign(document.createElement('dt'), { textContent: k }),
      Object.assign(document.createElement('dd'), { textContent: v }));
    dl.append(div);
  }

  const weakP = document.createElement('p');
  if (weak.length) {
    weakP.append('Schwächste Tasten: ');
    weak.forEach(([code, n], i) => {
      const kbd = document.createElement('kbd');
      kbd.textContent = code === 'Space' ? 'Leertaste' : labelForCode(code);
      kbd.title = FINGERS[fingerForCode(code)] ?? '';
      weakP.append(i ? ', ' : '', kbd, ` ${n}×`);
    });
  } else {
    weakP.textContent = 'Keine Fehler – stark!';
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = 'Nochmal (Esc)';
  btn.addEventListener('click', () => { reset(); box.focus(); });

  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = 'Gespeichert im Verlauf (nur lokal in diesem Browser).';

  out.replaceChildren(h, dl, weakP, btn, note);
  out.hidden = false;
  btn.focus();
}

// ----- Events -----
function onKey(e) {
  if (e.metaKey || (e.ctrlKey && !e.altKey)) return; // Browser-Kürzel nicht abfangen
  if (e.key === 'Escape') { e.preventDefault(); reset(); box.focus(); return; }
  if (s.done || s.empty) return;
  if (e.key === 'Backspace') { e.preventDefault(); back(); return; }
  if (e.key.length !== 1) return; // Shift, Tab, Dead-Keys usw.
  e.preventDefault();
  input(e.key, e.code);
}

function bindEvents() {
  box.addEventListener('keydown', onKey);
  box.addEventListener('click', () => box.focus());

  // Tippen startet auch, wenn der Fokus noch nicht im Textfeld liegt
  window.addEventListener('keydown', (e) => {
    if (panel.hidden) return;
    kb.press(e.code);
    if (e.target === box || e.defaultPrevented) return;
    const t = e.target;
    if (t.matches?.('input, select, textarea')) return;
    if (e.key === 'Escape') { onKey(e); return; }
    if (s.done || s.empty || e.key.length !== 1 || e.ctrlKey || e.metaKey) return;
    if (e.key === ' ' && t.matches?.('button, [role="tab"]')) return; // Leertaste aktiviert Buttons
    box.focus();
    onKey(e);
  });
  window.addEventListener('keyup', (e) => kb.release(e.code));
  window.addEventListener('blur', () => kb.releaseAll());
  window.addEventListener('resize', () => { if (s && !panel.hidden) updateCursor(); });

  // Tab verlassen → laufende Übung abbrechen (ohne Speichern)
  window.addEventListener('tabchange', (e) => {
    if (!s) return;
    if (e.detail !== 'training' && s?.start && !s.done) reset();
    if (e.detail === 'training') requestAnimationFrame(updateCursor); // Layout erst jetzt sichtbar
  });
}
