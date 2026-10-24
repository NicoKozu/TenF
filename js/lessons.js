// Lern-Lektionen: Übersicht, Lektionsansicht, Übungstext-Generator, Tipp-Engine (stoppt bei Fehler).
import { LESSONS, GROUPS } from './lessons-data.js';
import { createKeyboard, keyForChar, labelForCode, FINGERS } from './keyboard.js';
import { getLessonProgress, saveLessonProgress, clearLessonProgress } from './storage.js';

const PASS = 90; // Mindest-Genauigkeit (%) zum Bestehen einer Übung
const EX_NAMES = {
  letters: ['Tastendrill', 'Kombinationen', 'Wörter'],
  shift: ['Paare', 'Nomen', 'Gemischt'],
  umlaut: ['Tastendrill', 'Wörter', 'Gemischt'],
  numbers: ['Tastendrill', 'Zahlen', 'Mit Wörtern'],
  punct: ['Zeichen', 'Sätze', 'Mehr Sätze'],
};
const ALL_LETTERS = 'abcdefghijklmnopqrstuvwxyzäöü';
const UMLAUTS = /[äöüßÄÖÜ]/;

const $ = (id) => document.getElementById(id);
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const shuffle = (a) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = rnd(i + 1); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
};

let wordlist = [];
let ctxById = new Map(); // id → { lesson, index, known:Set, caps, knownCodes, freshCodes }
let kb, panel, home, view, box, textEl;
let cur = null; // { lesson, ctx, ex }
let s = null;   // laufende Übung

export async function initLessons() {
  panel = $('panel-lernen');
  home = $('learn-home');
  view = $('lesson-view');
  box = $('lv-box');
  textEl = $('lv-text');
  kb = createKeyboard($('keyboard-lesson'));
  buildContexts();
  bindEvents();
  renderList();
  try {
    const res = await fetch('data/wordlist-de.json');
    wordlist = (await res.json()).words ?? [];
  } catch {
    wordlist = [];
  }
}

// ----- Kumulatives Wissen je Lektion -----
function buildContexts() {
  const known = new Set();
  let caps = false;
  LESSONS.forEach((lesson, index) => {
    if (lesson.kind === 'shift') caps = true;
    if (lesson.kind === 'umlaut') ['ß', 'ä', 'ö', 'ü'].forEach((c) => known.add(c));
    [...lesson.keys].forEach((c) => known.add(caps ? c : c.toLowerCase()));
    const k = new Set(known);
    const knownCodes = new Set(['Space']);
    for (const c of k) {
      const info = keyForChar(c);
      if (info) { knownCodes.add(info.code); if (info.shift) knownCodes.add(info.shift); }
    }
    if (caps) { knownCodes.add('ShiftLeft'); knownCodes.add('ShiftRight'); }
    const freshCodes = new Set();
    for (const c of lesson.kind === 'shift' ? '' : lesson.keys) {
      const info = keyForChar(c);
      if (info) { freshCodes.add(info.code); if (info.shift) freshCodes.add(info.shift); }
    }
    if (lesson.kind === 'shift') { freshCodes.add('ShiftLeft'); freshCodes.add('ShiftRight'); }
    ctxById.set(lesson.id, { lesson, index, known: k, caps, knownCodes, freshCodes });
  });
}

// ----- Textgenerator -----
function fill(gen, target) {
  const out = [];
  let len = 0;
  let last = '';
  while (len < target) {
    let w = gen(out.length);
    for (let t = 0; w === last && t < 5; t++) w = gen(out.length);
    out.push(w);
    len += w.length + 1;
    last = w;
  }
  return out.join(' ');
}

const isPunct = (c) => /[,.\-]/.test(c);
const fits = (w, ctx) => [...w].every((c) => ctx.known.has(c) || (ctx.caps && ctx.known.has(c.toLowerCase())));

function wordPool(ctx, { keepCase = ctx.caps } = {}) {
  const extra = ctx.lesson.words ?? [];
  const src = [...wordlist, ...extra].map((w) => (keepCase ? w : w.toLowerCase()));
  return [...new Set(src)].filter((w) => fits(w, ctx));
}

function genLetters(ctx, ex) {
  const fresh = [...ctx.lesson.keys];
  const freshLetters = fresh.filter((c) => !isPunct(c));
  const freshPunct = fresh.filter(isPunct);
  const letters = [...ctx.known].filter((c) => ALL_LETTERS.includes(c));

  const pseudo = () => {
    const len = 3 + rnd(3);
    const a = Array.from({ length: len }, () => pick(letters));
    if (freshLetters.length) a[rnd(len)] = pick(freshLetters);
    return a.join('');
  };
  const pool = wordPool(ctx);
  const punctuate = (w) => {
    if (!freshPunct.length || Math.random() > 0.5) return w;
    const p = pick(freshPunct);
    return p === '-' ? `${w}-${pool.length ? pick(pool) : pseudo()}` : w + p;
  };

  if (ex === 0) {
    const base = [...fresh, ...(ctx.lesson.drillWith ?? '')];
    const start = fresh.flatMap((c) => [c.repeat(3), c.repeat(3)]);
    return fill((i) => {
      if (i < start.length) return start[i];
      const len = 2 + rnd(3);
      const a = Array.from({ length: len }, () => pick(base));
      a[rnd(len)] = pick(fresh);
      return a.join('');
    }, 55);
  }
  if (ex === 1) return fill(() => punctuate(pseudo()), 60);

  if (pool.length < 6) return fill(() => punctuate(pseudo()), 65);
  const withNew = pool.filter((w) => freshLetters.some((c) => w.includes(c)));
  return fill(() => punctuate(withNew.length >= 3 && Math.random() < 0.7 ? pick(withNew) : pick(pool)), 70);
}

function genShift(ctx, ex) {
  const letters = [...ctx.known].filter((c) => /[a-z]/.test(c));
  if (ex === 0) return fill(() => { const c = pick(letters); return c.toUpperCase() + c; }, 55);
  const pool = wordPool(ctx, { keepCase: true });
  let nouns = pool.filter((w) => w[0] !== w[0].toLowerCase());
  if (nouns.length < 6) nouns = pool.map((w) => w[0].toUpperCase() + w.slice(1));
  if (ex === 1) return fill(() => pick(nouns), 70);
  const others = pool.filter((w) => !nouns.includes(w));
  return fill((i) => (i % 2 || !others.length ? pick(nouns) : pick(others)), 80);
}

function genUmlaut(ctx, ex) {
  const chars = ['ß', 'Ä', 'Ö', 'Ü', 'ä', 'ö', 'ü'];
  if (ex === 0) {
    const start = ['ßßß', 'ÄÄ', 'ÖÖ', 'ÜÜ'];
    return fill((i) => (i < start.length ? start[i] : Array.from({ length: 2 + rnd(2) }, () => pick(chars)).join('')), 45);
  }
  const special = ctx.lesson.words ?? [];
  if (ex === 1) return fill(() => pick(special), 70);
  const pool = wordPool(ctx, { keepCase: true });
  const um = [...new Set([...special, ...pool.filter((w) => UMLAUTS.test(w))])];
  return fill(() => (Math.random() < 0.6 ? pick(um) : pick(pool.length ? pool : um)), 80);
}

function genNumbers(ctx, ex) {
  const fresh = [...ctx.lesson.keys];
  const digits = [...ctx.known].filter((c) => /\d/.test(c));
  const num = () => Array.from({ length: 1 + rnd(4) }, () => (Math.random() < 0.6 ? pick(fresh) : pick(digits))).join('');
  if (ex === 0) {
    const start = fresh.map((c) => c.repeat(3));
    return fill((i) => (i < start.length ? start[i] : Array.from({ length: 2 + rnd(2) }, () => pick(fresh)).join('')), 50);
  }
  if (ex === 1) return fill(num, 55);
  const pool = wordPool(ctx, { keepCase: true });
  return fill((i) => (i % 2 ? pick(pool.length ? pool : ['Tage']) : num()), 70);
}

function genPunct(ctx, ex) {
  const sentences = ctx.lesson.sentences ?? [];
  if (ex === 0) {
    const pool = wordPool(ctx, { keepCase: false }).filter((w) => w.length <= 5);
    const forms = [(w) => w + '?', (w) => w + '!', (w) => w + ':', (w) => w + ';', (w) => `"${w}"`, (w) => `(${w})`];
    return fill(() => pick(forms)(pick(pool.length ? pool : ['ja', 'so', 'gut'])), 60);
  }
  const half = Math.ceil(sentences.length / 2);
  const part = ex === 1 ? sentences.slice(0, half) : sentences.slice(half);
  const out = [];
  let len = 0;
  for (const st of shuffle(part)) {
    if (len > 70) break;
    out.push(st);
    len += st.length + 1;
  }
  return out.join(' ');
}

const GENERATORS = { letters: genLetters, shift: genShift, umlaut: genUmlaut, numbers: genNumbers, punct: genPunct };

// ----- Übersicht -----
function exState(id) {
  const p = getLessonProgress()[id];
  const ex = p?.ex ?? [];
  const passed = [0, 1, 2].filter((i) => (ex[i] ?? 0) >= PASS).length;
  return { passed, done: !!p?.done, bestWpm: p?.bestWpm };
}

function nextLesson() {
  return LESSONS.find((l) => !exState(l.id).done) ?? null;
}

function keysLabel(lesson) {
  if (lesson.kind === 'shift') return ['⇧ Umschalt'];
  return [...lesson.keys].map((c) => (c === ',' ? ',' : c.toUpperCase()));
}

function renderList() {
  const list = $('lesson-list');
  const next = nextLesson();
  const frag = document.createDocumentFragment();

  const doneCount = LESSONS.filter((l) => exState(l.id).done).length;
  $('lesson-progress').textContent = `${doneCount} von ${LESSONS.length} Lektionen abgeschlossen.`;
  const cont = $('lesson-continue');
  cont.hidden = !next;
  if (next) {
    cont.textContent = doneCount ? `Weiter mit Lektion ${ctxById.get(next.id).index + 1}` : 'Mit Lektion 1 starten';
    cont.onclick = () => openLesson(next.id);
  }

  for (const [gid, gname] of Object.entries(GROUPS)) {
    const items = LESSONS.filter((l) => l.group === gid);
    if (!items.length) continue;
    const h = document.createElement('h4');
    h.textContent = gname;
    const ol = document.createElement('ol');
    ol.className = 'lesson-list';
    for (const l of items) {
      const { index } = ctxById.get(l.id);
      const st = exState(l.id);
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lesson-card' + (st.done ? ' done' : '') + (next?.id === l.id ? ' next' : '');
      btn.dataset.id = l.id;

      const num = document.createElement('span');
      num.className = 'lc-num';
      num.textContent = st.done ? '✓' : index + 1;
      num.setAttribute('aria-hidden', 'true');
      const title = document.createElement('span');
      title.className = 'lc-title';
      title.textContent = l.title;
      const keys = document.createElement('span');
      keys.className = 'lc-keys';
      keysLabel(l).forEach((k) => { const kbd = document.createElement('kbd'); kbd.textContent = k; keys.append(kbd); });
      const status = document.createElement('span');
      status.className = 'lc-status';
      status.textContent = st.done
        ? `Abgeschlossen${st.bestWpm ? ` · ${Math.round(st.bestWpm)} WPM` : ''}`
        : st.passed ? `${st.passed}/3 Übungen` : next?.id === l.id ? 'Als Nächstes' : 'Offen';

      btn.setAttribute('aria-label', `Lektion ${index + 1}: ${l.title} – ${status.textContent}`);
      btn.append(num, title, keys, status);
      btn.addEventListener('click', () => openLesson(l.id));
      li.append(btn);
      ol.append(li);
    }
    frag.append(h, ol);
  }
  list.replaceChildren(frag);
}

// ----- Lektionsansicht -----
function openLesson(id, ex = null) {
  const ctx = ctxById.get(id);
  const prog = getLessonProgress()[id]?.ex ?? [];
  const firstOpen = [0, 1, 2].find((i) => (prog[i] ?? 0) < PASS) ?? 0;
  cur = { lesson: ctx.lesson, ctx, ex: ex ?? firstOpen };

  $('lv-group').textContent = `Lektion ${ctx.index + 1} · ${GROUPS[ctx.lesson.group]}`;
  $('lv-title').textContent = ctx.lesson.title;
  $('lv-intro').textContent = ctx.lesson.intro;
  renderNewKeys();
  kb.mark(ctx.knownCodes, ctx.freshCodes);

  home.hidden = true;
  view.hidden = false;
  window.scrollTo({ top: 0 });
  startExercise(cur.ex);
  $('lv-title').focus();
}

function closeLesson() {
  const id = cur?.lesson.id;
  s = null;
  cur = null;
  view.hidden = true;
  home.hidden = false;
  renderList();
  document.querySelector(`.lesson-card[data-id="${id}"]`)?.focus();
}

function renderNewKeys() {
  const out = $('lv-keys');
  const { lesson } = cur;
  if (lesson.kind === 'shift') {
    out.textContent = 'Neu: Umschalt links (linker kleiner Finger) und Umschalt rechts (rechter kleiner Finger).';
    return;
  }
  out.replaceChildren('Neu: ');
  [...lesson.keys].forEach((c, i) => {
    const info = keyForChar(c);
    const kbd = document.createElement('kbd');
    kbd.textContent = c === ' ' ? 'Leertaste' : c.toUpperCase() === c && c.toLowerCase() !== c ? c : c.toUpperCase();
    const shift = info?.shift ? ` + Umschalt ${info.shift === 'ShiftLeft' ? 'links' : 'rechts'}` : '';
    out.append(i ? ' · ' : '', kbd, ` ${FINGERS[info?.finger] ?? ''}${shift}`);
  });
}

function renderSteps() {
  const ol = $('lv-steps');
  const names = EX_NAMES[cur.lesson.kind];
  const prog = getLessonProgress()[cur.lesson.id]?.ex ?? [];
  ol.replaceChildren(...names.map((name, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'step';
    const ok = (prog[i] ?? 0) >= PASS;
    if (ok) btn.classList.add('ok');
    if (i === cur.ex) btn.setAttribute('aria-current', 'step');
    btn.textContent = `${ok ? '✓ ' : ''}Übung ${i + 1}: ${name}`;
    btn.addEventListener('click', () => { startExercise(i); box.focus(); });
    li.append(btn);
    return li;
  }));
}

// ----- Tipp-Engine -----
function startExercise(ex) {
  cur.ex = ex;
  const text = GENERATORS[cur.lesson.kind](cur.ctx, ex);
  s = { chars: [...text], spans: [], pos: 0, strokes: 0, errors: 0, start: 0, done: false, errorsByKey: {} };

  const frag = document.createDocumentFragment();
  let word = null;
  for (const c of s.chars) {
    const span = document.createElement('span');
    span.className = 'ch' + (c === ' ' ? ' sp' : '');
    span.textContent = c;
    s.spans.push(span);
    if (c === ' ') { frag.append(span); word = null; continue; }
    if (!word) { word = document.createElement('span'); word.className = 'word'; frag.append(word); }
    word.append(span);
  }
  textEl.replaceChildren(frag);
  textEl.style.transform = '';
  box.classList.remove('done');
  $('lv-result').hidden = true;
  $('lv-result').replaceChildren();
  renderSteps();
  updateCursor();
  updateStats();
}

function input(ch, code) {
  if (!s.start) s.start = performance.now();
  s.strokes++;
  const expected = s.chars[s.pos];
  if (ch !== expected) {
    s.errors++;
    const info = keyForChar(expected);
    if (info) s.errorsByKey[info.code] = (s.errorsByKey[info.code] || 0) + 1;
    kb.flashWrong(code);
    const span = s.spans[s.pos];
    span.classList.remove('miss');
    void span.offsetWidth;
    span.classList.add('miss', 'had-err');
    updateStats();
    return;
  }
  s.spans[s.pos].classList.add(s.spans[s.pos].classList.contains('had-err') ? 'bad' : 'ok');
  s.pos++;
  if (s.pos >= s.chars.length) { finish(); return; }
  updateCursor();
  updateStats();
}

function calc() {
  const sec = s.start ? (performance.now() - s.start) / 1000 : 0;
  const correct = s.strokes - s.errors;
  return {
    sec,
    wpm: Math.round((s.pos / 5 / (Math.max(sec, 1) / 60)) * 10) / 10,
    accuracy: s.strokes ? Math.round((correct / s.strokes) * 1000) / 10 : 100,
  };
}

function updateStats() {
  const r = calc();
  $('lv-st-prog').textContent = `${s.pos}/${s.chars.length}`;
  $('lv-st-wpm').textContent = s.start ? r.wpm.toFixed(0) : '–';
  $('lv-st-acc').textContent = s.strokes ? `${r.accuracy.toFixed(0)} %` : '–';
  $('lv-st-err').textContent = s.errors;
}

function updateCursor() {
  textEl.querySelector('.cur')?.classList.remove('cur');
  const span = s.spans[s.pos];
  if (!span || s.done) { kb.clearHighlight(); return; }
  span.classList.add('cur');
  const lh = parseFloat(getComputedStyle(textEl).lineHeight) || 40;
  textEl.style.transform = `translateY(${-Math.max(0, span.offsetTop - lh)}px)`;

  const ch = s.chars[s.pos];
  kb.highlightChar(ch);
}

function finish() {
  s.done = true;
  box.classList.add('done');
  updateCursor();
  updateStats();
  const r = calc();
  const passed = r.accuracy >= PASS;

  const id = cur.lesson.id;
  const prev = getLessonProgress()[id] ?? {};
  const ex = [...(prev.ex ?? [null, null, null])];
  ex[cur.ex] = Math.max(ex[cur.ex] ?? 0, r.accuracy);
  const done = ex.every((a) => (a ?? 0) >= PASS);
  saveLessonProgress(id, { ex, done, bestWpm: Math.max(prev.bestWpm ?? 0, r.wpm) });
  renderSteps();
  showResult(r, passed, done && !prev.done);
}

function showResult(r, passed, lessonJustDone) {
  const out = $('lv-result');
  const h = document.createElement('h3');
  const isLast = cur.ex === 2;
  const lessonDone = getLessonProgress()[cur.lesson.id]?.done;
  h.textContent = !passed ? 'Fast geschafft' : lessonJustDone ? 'Lektion abgeschlossen!' : 'Bestanden';

  const p = document.createElement('p');
  p.textContent = `Genauigkeit ${r.accuracy.toFixed(1)} % · ${r.wpm.toFixed(0)} WPM · ${s.errors} Fehler. `
    + (passed ? '' : `Ziel: mindestens ${PASS} % Genauigkeit – langsamer tippen hilft.`);

  const actions = document.createElement('div');
  actions.className = 'data-actions';
  const btn = (label, fn, primary) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (primary ? ' primary' : '');
    b.textContent = label;
    b.addEventListener('click', fn);
    actions.append(b);
    return b;
  };

  let main;
  if (!passed) {
    main = btn('Nochmal (Esc)', () => { startExercise(cur.ex); box.focus(); }, true);
  } else if (!isLast && !lessonDone) {
    main = btn(`Weiter: Übung ${cur.ex + 2}`, () => { startExercise(cur.ex + 1); box.focus(); }, true);
    btn('Wiederholen', () => { startExercise(cur.ex); box.focus(); });
  } else {
    const nextIdx = cur.ctx.index + 1;
    const nl = LESSONS[nextIdx];
    if (lessonDone && nl) main = btn(`Nächste Lektion: ${nl.title}`, () => openLesson(nl.id), true);
    if (!isLast) {
      const b = btn(`Übung ${cur.ex + 2}`, () => { startExercise(cur.ex + 1); box.focus(); });
      main ??= b;
    }
    const b = btn('Wiederholen', () => { startExercise(cur.ex); box.focus(); });
    main ??= b;
    btn('Zur Übersicht', closeLesson);
  }

  out.replaceChildren(h, p, actions);
  out.hidden = false;
  main.id = 'lesson-again';
}

// ----- Events -----
function onKey(e) {
  if (e.metaKey || (e.ctrlKey && !e.altKey)) return;
  if (e.key === 'Escape') { e.preventDefault(); startExercise(cur.ex); box.focus(); return; }
  if (s.done) {
    if (e.key === ' ') e.preventDefault();
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); $('lesson-again')?.focus(); }
    return;
  }
  if (e.key.length !== 1) return;
  e.preventDefault();
  input(e.key, e.code);
}

function bindEvents() {
  box.addEventListener('keydown', onKey);
  box.addEventListener('click', () => box.focus());
  $('lv-back').addEventListener('click', closeLesson);
  $('lesson-reset').addEventListener('click', () => {
    if (!confirm('Lektionsfortschritt wirklich zurücksetzen? Der Trainings-Verlauf bleibt erhalten.')) return;
    clearLessonProgress();
    renderList();
  });

  window.addEventListener('keydown', (e) => {
    if (panel.hidden || view.hidden || !s) return;
    kb.press(e.code);
    if (e.target === box || e.defaultPrevented) return;
    const t = e.target;
    if (t.matches?.('input, select, textarea')) return;
    if (e.key === 'Escape') { onKey(e); return; }
    if (e.key === 'Enter' && !s.done && !t.matches?.('button, a, [role="tab"], label')) { e.preventDefault(); box.focus(); return; }
    if (s.done || e.key.length !== 1 || e.ctrlKey || e.metaKey) return;
    if (e.key === ' ' && t.matches?.('button, [role="tab"]')) return;
    box.focus();
    onKey(e);
  });
  window.addEventListener('keyup', (e) => kb.release(e.code));
  window.addEventListener('blur', () => kb.releaseAll());

  window.addEventListener('resize', () => { if (s && !$('lesson-view').hidden) updateCursor(); });
  window.addEventListener('tabchange', (e) => {
    if (!s) return;
    if (e.detail !== 'lernen' && s.start && !s.done) startExercise(cur.ex);
    if (e.detail === 'lernen') requestAnimationFrame(() => s && updateCursor());
  });
}
