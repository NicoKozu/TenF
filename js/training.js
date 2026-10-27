// Trainingsmodus: Wörter aus einer Wortliste abtippen, Live-Auswertung, Session speichern.
import { createKeyboard, keyForChar, labelForCode, fingerForCode, FINGERS } from './keyboard.js';
import { getSettings, saveSettings, addSession } from './storage.js';
import { LISTS, DEFAULT_LIST, loadList } from './wordlists.js';
import { enhanceSelects } from './dropdown.js';

const DEFAULTS = {
  source: 'words', list: DEFAULT_LIST, length: 't60', customLen: { n: 2, unit: 'min' },
  caps: true, strict: false, customText: '',
};
const CUSTOM_MAX = 5000;
const LEN_LIMITS = { sec: [5, 3600], min: [1, 60], words: [5, 1000] };

const $ = (id) => document.getElementById(id);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const inc = (obj, k) => { obj[k] = (obj[k] || 0) + 1; };
const clamp = (v, [min, max]) => Math.min(max, Math.max(min, Math.round(+v) || min));

let wordlist = [];
let loadErr = false;
let cfg;
let kb;
let s; // Zustand der laufenden Übung
let box, textEl, panel;

export async function initTraining() {
  panel = $('panel-training');
  box = $('typing-box');
  textEl = $('typing-text');
  cfg = { ...DEFAULTS, ...getSettings().training };
  if (!(cfg.list in LISTS)) cfg.list = DEFAULT_LIST;
  kb = createKeyboard($('keyboard-training'));
  setupForm();
  bindEvents();
  enhanceSelects(document.querySelectorAll('#train-settings select'));
  await useList(cfg.list);
  // Sofort lostippen: Fokus direkt ins Tippfeld, wenn Training offen ist
  if (!panel.hidden && (document.activeElement === document.body || !document.activeElement)) box.focus({ preventScroll: true });
}

async function useList(id) {
  textEl.textContent = 'Wortliste wird geladen …';
  try {
    wordlist = await loadList(id);
    loadErr = false;
  } catch {
    wordlist = [];
    loadErr = true;
  }
  reset();
}

// ----- Einstellungen -----
function setupForm() {
  const list = $('ts-list');
  for (const [id, l] of Object.entries(LISTS)) list.append(new Option(l.name, id));
  const set = (id, val, def) => {
    const el = $(id);
    el.value = val;
    if (el.value === '') el.value = def;
  };
  set('ts-source', cfg.source, DEFAULTS.source);
  set('ts-list', cfg.list, DEFAULTS.list);
  set('ts-length', cfg.length, DEFAULTS.length);
  set('ts-len-unit', cfg.customLen?.unit, DEFAULTS.customLen.unit);
  $('ts-len-n').value = cfg.customLen?.n ?? DEFAULTS.customLen.n;
  $('ts-caps').checked = cfg.caps;
  $('ts-strict').checked = cfg.strict;
  $('ts-custom').value = cfg.customText ?? '';
  syncForm();
  cfg.length = $('ts-length').value;

  const apply = (e) => {
    // Beim Moduswechsel passende Standardlänge wählen
    if (e?.target?.id === 'ts-source') $('ts-length').value = $('ts-source').value === 'custom' ? 'full' : DEFAULTS.length;
    const prevList = cfg.list;
    cfg = {
      source: $('ts-source').value,
      list: $('ts-list').value,
      length: $('ts-length').value,
      customLen: { n: +$('ts-len-n').value, unit: $('ts-len-unit').value },
      caps: $('ts-caps').checked,
      strict: $('ts-strict').checked,
      customText: $('ts-custom').value.slice(0, CUSTOM_MAX),
    };
    syncForm();
    cfg.length = $('ts-length').value;
    cfg.customLen = { n: +$('ts-len-n').value, unit: $('ts-len-unit').value };
    saveSettings({ training: cfg });
    if (cfg.list !== prevList) useList(cfg.list);
    else reset();
  };
  $('train-settings').addEventListener('change', apply);
  $('ts-custom-apply').addEventListener('click', () => { apply(); box.focus(); });
  $('train-settings').addEventListener('submit', (e) => { e.preventDefault(); apply(); box.focus(); });
}

/**
 * Übernimmt eine Voreinstellung (z. B. aus dem Tipps-Tab) ins Formular und startet neu.
 * preset: { source, list, length ('t60' | 'w50' | beliebig 't<sek>'), caps, strict, customText }
 */
export function applyPreset(p = {}) {
  if (!cfg) return;
  const set = (id, v) => { if (v !== undefined) $(id).value = v; };
  set('ts-source', p.source);
  if (p.list in LISTS) set('ts-list', p.list);
  set('ts-custom', p.customText);
  if (p.caps !== undefined) $('ts-caps').checked = p.caps;
  if (p.strict !== undefined) $('ts-strict').checked = p.strict;
  if (p.length) {
    const len = $('ts-length');
    if ([...len.options].some((o) => o.value === p.length)) len.value = p.length;
    else {
      const n = Number(p.length.slice(1));
      len.value = 'custom';
      const [v, unit] = p.length[0] === 'w' ? [n, 'words'] : n % 60 ? [n, 'sec'] : [n / 60, 'min'];
      $('ts-len-n').value = v;
      $('ts-len-unit').value = unit;
    }
  }
  $('train-settings').dispatchEvent(new Event('change'));
}

// Modusabhängige Felder ein-/ausblenden, ungültige Werte korrigieren
function syncForm() {
  const custom = $('ts-source').value === 'custom';
  document.querySelectorAll('#train-settings .words-only').forEach((el) => { el.hidden = custom; });
  $('ts-custom-wrap').hidden = !custom;
  const len = $('ts-length');
  for (const opt of len.options) opt.disabled = custom ? opt.value[0] === 'w' : opt.value === 'full';
  len.querySelector('option[value="full"]').hidden = !custom;
  if (len.selectedOptions[0]?.disabled) len.value = custom ? 'full' : DEFAULTS.length;

  // Eigene Länge: Wörter nur bei Wortlisten
  const unit = $('ts-len-unit');
  unit.querySelector('option[value="words"]').disabled = custom;
  if (custom && unit.value === 'words') unit.value = 'min';
  $('ts-len-wrap').hidden = len.value !== 'custom';
  const n = $('ts-len-n');
  const lim = LEN_LIMITS[unit.value];
  [n.min, n.max] = lim;
  n.value = clamp(n.value, lim);
}

/** Tatsächliche Länge als Code: t<Sekunden>, w<Wörter> oder full */
function lengthCode() {
  if (cfg.length !== 'custom') return cfg.length;
  const { n, unit } = cfg.customLen;
  const v = clamp(n, LEN_LIMITS[unit] ?? LEN_LIMITS.min);
  return unit === 'words' ? `w${v}` : `t${unit === 'min' ? v * 60 : v}`;
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
  const words = cfg.caps ? wordlist : wordlist.map((w) => w.toLowerCase());
  let last = '';
  return () => {
    let w;
    let tries = 0;
    do { w = pick(words); } while (w === last && ++tries < 10);
    last = w;
    return w;
  };
}

// ----- Ablauf -----
function reset() {
  clearInterval(s?.timer);
  const custom = cfg.source === 'custom';
  const words = custom ? customWords().length : 0;
  const code = lengthCode();
  const full = custom && code === 'full';
  const type = full ? 'w' : code[0]; // 't' = Zeit, 'w' = Wörter
  const n = full ? words : Number(code.slice(1));
  s = {
    type, n, gen: makeGenerator(),
    chars: [], spans: [], typed: [], pos: 0,
    start: 0, timer: null, done: false,
    strokes: 0, correctStrokes: 0, correctChars: 0,
    errorsByKey: {}, errorsByFinger: {}, hitsByKey: {},
  };
  textEl.replaceChildren();
  textEl.style.transform = '';
  s.empty = custom ? words === 0 : wordlist.length === 0;
  if (s.empty) {
    textEl.textContent = custom
      ? 'Gib oben deinen eigenen Text ein und klick auf „Text übernehmen“.'
      : loadErr ? 'Die Wortliste konnte nicht geladen werden. Bitte Seite neu laden.' : 'Wortliste wird geladen …';
  } else {
    appendWords(type === 'w' ? n : 40);
  }
  $('st-words-wrap').hidden = type !== 'w';
  $('panel-training').dataset.len = type;
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
  if (!cur || s.done || s.empty) { kb.clearHighlight(); return; }
  cur.classList.add('cur');

  // Eine Zeile: aktuelles Zeichen bleibt in der Mitte, Text läuft nach links
  textEl.style.transform = `translateX(${textEl.parentElement.clientWidth / 2 - cur.offsetLeft}px)`;

  kb.highlightChar(s.chars[s.pos]);
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
    const config = cfg.source === 'custom'
      ? { source: 'custom', length: lengthCode(), focus: 'custom', strict: cfg.strict }
      : { source: 'words', list: cfg.list, length: lengthCode(), caps: cfg.caps, strict: cfg.strict };
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
  btn.textContent = 'Nochmal';
  btn.id = 'train-again';
  btn.addEventListener('click', () => { reset(); box.focus(); });

  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = 'Neue Runde: Tab + Enter oder Esc. Gespeichert im Verlauf (nur lokal in diesem Browser).';

  out.replaceChildren(h, dl, weakP, btn, note);
  out.hidden = false;
}

// ----- Events -----
let tabArmed = false;
function onKey(e) {
  if (e.metaKey || (e.ctrlKey && !e.altKey)) return; // Browser-Kürzel nicht abfangen
  // Tab + Enter = Neustart (2× Tab = normal weiter zu den Buttons)
  if (e.key === 'Tab' && !e.shiftKey && !e.altKey) {
    if (tabArmed) { tabArmed = false; return; }
    e.preventDefault(); tabArmed = true; return;
  }
  if (tabArmed) {
    tabArmed = false;
    if (e.key === 'Enter') { e.preventDefault(); reset(); box.focus(); return; }
  }
  if (e.key === 'Escape') { e.preventDefault(); reset(); box.focus(); return; }
  if (s.done) {
    if (e.key === ' ') e.preventDefault(); // Nach dem Ende: Leertaste allein tut nichts
    return;
  }
  if (s.empty) return;
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
    if (e.key === 'Tab' && (t === document.body || t === panel)) { box.focus(); onKey(e); return; }
    // Enter setzt den Fokus ins Tippfeld
    if (e.key === 'Enter' && !s.done && !t.matches?.('button, a, [role="tab"], label')) { e.preventDefault(); box.focus(); return; }
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
