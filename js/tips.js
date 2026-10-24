// Tipps: regelbasierte, persönliche Trainingsempfehlungen aus dem Verlauf (läuft komplett lokal, keine KI).
// Jede Regel prüft Kennzahlen der letzten Sessions und liefert höchstens einen Tipp mit Priorität.
// Grundlagen der Regeln: siehe SOURCES unten (auch im Tab sichtbar).
import { getSessions, getSettings, getLessonProgress, saveSettings } from './storage.js';
import { labelForCode, fingerForCode, FINGERS } from './keyboard.js';
import { LESSONS } from './lessons-data.js';
import { loadList } from './wordlists.js';
import { applyPreset } from './training.js';

const RECENT = 10;        // Grundlage für Schwachstellen
const AVG_N = 5;          // Grundlage für Ø-Werte
const ACC_GOAL = 95;      // Zielgenauigkeit, bevor Tempo trainiert wird
const MIN_HITS = 20;      // Mindestanschläge pro Taste für eine belastbare Fehlerquote
const DAY = 864e5;

const $ = (id) => document.getElementById(id);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text != null ? { textContent: text } : {});

export const SOURCES = [
  ['Baddeley & Longman (1978)', 'Tipp-Lernen: kurze, verteilte Übungseinheiten führen schneller zum Ziel als lange Blöcke.'],
  ['Ericsson, Krampe & Tesch-Römer (1993)', 'Gezieltes Üben (Deliberate Practice) an konkreten Schwächen bringt mehr als bloßes Wiederholen.'],
  ['Fitts (1966), Wickelgren (1977)', 'Speed-Accuracy-Tradeoff: Wer schneller wird, macht mehr Fehler – das Tempo muss zur Genauigkeit passen.'],
  ['Dhakal et al. (2018), 136 Mio. Anschläge', 'Schnelle Schreiber machen weniger Fehler; Korrigieren kostet viel Zeit.'],
  ['Feit, Weir & Oulasvirta (2016)', 'Eine feste Finger-Tasten-Zuordnung ist ein Kernmerkmal schneller Schreiber.'],
  ['Community (keybr, Monkeytype, r/typing)', 'Erst ~95 % Genauigkeit, dann Tempo; kurze Sprints gegen Plateaus; Blick weg von der Tastatur.'],
];

let busy = false;

export function initTips() {
  window.addEventListener('tabchange', (e) => { if (e.detail === 'tipps') render(); });
  if (!$('panel-tipps').hidden) render();
}

// ----- Analyse -----
function analyze() {
  const all = getSessions();
  const last = all.slice(-AVG_N);
  const prev = all.slice(-AVG_N * 2, -AVG_N);
  const recent = all.slice(-RECENT);
  const cfg = getSettings().training ?? {};
  const list = cfg.list ?? 'de-1000';
  const lessons = getLessonProgress();
  const lessonsDone = LESSONS.filter((l) => lessons[l.id]?.done).length;

  // Fehlerquote je Taste (nur Sessions mit Anschlagszahlen)
  const hits = {}, errs = {};
  for (const s of recent) {
    if (!s.hitsByKey) continue;
    for (const [k, n] of Object.entries(s.hitsByKey)) hits[k] = (hits[k] ?? 0) + n;
    for (const [k, n] of Object.entries(s.errorsByKey ?? {})) errs[k] = (errs[k] ?? 0) + n;
  }
  const totalHits = Object.values(hits).reduce((a, b) => a + b, 0);
  const totalErrs = Object.keys(hits).reduce((a, k) => a + (errs[k] ?? 0), 0);
  const baseRate = totalHits ? totalErrs / totalHits : 0;
  const weak = Object.keys(hits)
    .filter((k) => hits[k] >= MIN_HITS && /^[a-zäöüß]$/.test(labelForCode(k).toLowerCase()))
    .map((k) => ({ code: k, rate: (errs[k] ?? 0) / hits[k] }))
    .filter((k) => k.rate >= 0.05 && k.rate >= baseRate * 2)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);

  // Regelmäßigkeit
  const now = Date.now();
  const lastDate = all.length ? new Date(all.at(-1).date).getTime() : 0;
  const days14 = new Set(all.filter((s) => now - new Date(s.date) < 14 * DAY).map((s) => s.date.slice(0, 10)));
  const perDay = {};
  for (const s of all.filter((x) => now - new Date(x.date) < 14 * DAY)) {
    const d = s.date.slice(0, 10);
    perDay[d] = (perDay[d] ?? 0) + (s.durationSec ?? 0);
  }

  return {
    n: all.length,
    wpm: avg(last.map((s) => s.wpm)),
    acc: avg(last.map((s) => s.accuracy)),
    prevWpm: prev.length >= 3 ? avg(prev.map((s) => s.wpm)) : null,
    weak, baseRate,
    daysSince: lastDate ? (now - lastDate) / DAY : null,
    activeDays: days14.size,
    maxDayMin: Math.max(0, ...Object.values(perDay)) / 60,
    shortOnly: last.length >= AVG_N && last.every((s) => (s.durationSec ?? 0) <= 75),
    lang: list.split('-')[0] || 'de',
    size: Number(list.split('-')[1]) || 1000,
    caps: cfg.caps !== false,
    hideKb: !!getSettings().hideTrainKb,
    lessonsDone, lessonsTotal: LESSONS.length,
  };
}

// ----- Regeln -----
// Jeder Tipp: { prio, tag, title, text, why, action: { label, preset | run } }
function rules(a) {
  const t = [];
  const L = (size) => `${a.lang}-${size}`;
  const pct = (v) => `${nf.format(v)} %`;

  if (a.n === 0) {
    t.push(a.lessonsDone < a.lessonsTotal
      ? { prio: 100, tag: 'Start', title: 'Mit den Lektionen beginnen',
        text: `Erst die Grundstellung sicher lernen, dann frei trainieren. ${a.lessonsDone}/${a.lessonsTotal} Lektionen geschafft.`,
        why: 'Feste Finger-Tasten-Zuordnung zuerst (Feit et al. 2016).', action: { label: 'Zu den Lektionen', run: openLessons } }
      : { prio: 100, tag: 'Start', title: 'Ersten 1-Minuten-Test machen',
        text: 'Ein kurzer Test zeigt, wo du stehst. Danach bekommst du hier passende Tipps.',
        why: 'Ohne Messung kein gezieltes Üben (Ericsson 1993).', action: { label: 'Test starten', preset: { source: 'words', list: L(1000), length: 't60', strict: false } } });
    return t;
  }

  if (a.lessonsDone < a.lessonsTotal && a.wpm < 20) {
    t.push({ prio: 95, tag: 'Grundlagen', title: 'Lektionen abschließen',
      text: `${a.lessonsDone}/${a.lessonsTotal} geschafft. Mit allen Tasten im Griff wird das Training deutlich leichter.`,
      why: 'Feste Finger-Tasten-Zuordnung (Feit et al. 2016).', action: { label: 'Nächste Lektion', run: openLessons } });
  }

  if (a.acc < ACC_GOAL) {
    t.push({ prio: a.acc < 92 ? 90 : 75, tag: 'Präzision', title: 'Langsamer – dafür fehlerfrei',
      text: `Ø ${pct(a.acc)} Genauigkeit. Tippe bewusst ruhiger, bis du ${ACC_GOAL} % schaffst – das Tempo kommt danach von selbst.`,
      why: 'Speed-Accuracy-Tradeoff (Fitts 1966); schnelle Schreiber machen weniger Fehler (Dhakal 2018).',
      plan: ['Top 100', '1 Min', 'Stopp bei Fehler'],
      action: { label: 'Präzisions-Training', preset: { source: 'words', list: L(100), length: 't60', strict: true, caps: false } } });
  }

  if (a.weak.length) {
    const keys = a.weak.map((k) => labelForCode(k.code));
    const fingers = new Set(a.weak.map((k) => fingerForCode(k.code)));
    const finger = fingers.size === 1 ? FINGERS[[...fingers][0]] : null;
    const factor = a.baseRate ? a.weak[0].rate / a.baseRate : 0;
    t.push({ prio: a.acc < ACC_GOAL ? 80 : 85, tag: 'Schwachstellen', title: `${keys.join(', ')} gezielt üben`,
      text: (factor >= 2 ? `Bis zu ${nf.format(factor)}× so viele Fehler wie bei anderen Tasten. ` : '')
        + (finger ? `Alle mit: ${finger} – achte auf den richtigen Finger und zurück in die Grundstellung.` : 'Übe Wörter, die genau diese Tasten enthalten.'),
      why: 'Gezieltes Üben an Schwächen (Deliberate Practice, Ericsson 1993).',
      keys, plan: ['Wörter mit ' + keys.join(' · '), '1 Min'],
      action: { label: 'Schwachstellen trainieren', run: () => weakTraining(a) } });
  }

  if (a.daysSince != null && a.daysSince >= 3) {
    t.push({ prio: 70, tag: 'Routine', title: 'Wieder reinkommen',
      text: `Letzte Session vor ${nf.format(a.daysSince)} Tagen. Starte locker mit einer Minute – täglich kurz wirkt mehr als selten lang.`,
      why: 'Verteiltes Üben (Baddeley & Longman 1978).',
      action: { label: '1 Minute aufwärmen', preset: { source: 'words', list: L(100), length: 't60', strict: false } } });
  } else if (a.n >= 5 && (a.activeDays <= 2 || a.maxDayMin > 45)) {
    t.push({ prio: 40, tag: 'Routine', title: 'Lieber täglich 10–15 Minuten',
      text: a.maxDayMin > 45 ? `Bis zu ${nf.format(a.maxDayMin)} Min an einem Tag. Kürzere Einheiten über mehrere Tage verteilt bringen mehr.`
        : 'Mehrere kurze Einheiten pro Woche verankern die Bewegungen besser als ein langer Block.',
      why: 'Verteiltes Üben (Baddeley & Longman 1978).' });
  }

  if (a.acc >= 96 && a.n >= 8 && a.prevWpm != null && a.wpm < a.prevWpm * 1.03) {
    t.push({ prio: 65, tag: 'Tempo', title: 'Plateau knacken: Sprints',
      text: `Genauigkeit sitzt (${pct(a.acc)}), das Tempo stagniert bei ${nf.format(a.wpm)} WPM. Mach 5–10 Sprints à 30 s – bewusst etwas schneller als bequem.`,
      why: 'Gegen Plateaus hilft Üben knapp über der Komfortzone (Ericsson 1993; Community).',
      plan: ['Top 1.000', '30 s', 'ohne Stopp'],
      action: { label: 'Tempo-Sprint', preset: { source: 'words', list: L(1000), length: 't30', strict: false } } });
  }

  if (a.acc >= 96 && a.size === 100 && a.wpm >= 30) {
    t.push({ prio: 55, tag: 'Level up', title: 'Mehr Wortschatz',
      text: `Die Top 100 sitzen (${nf.format(a.wpm)} WPM). Wechsle zu den Top 1.000 für realistischere Texte.`,
      why: 'Variabel üben überträgt besser auf echte Texte (Community).',
      action: { label: 'Top 1.000 starten', preset: { source: 'words', list: L(1000), length: 't60' } } });
  } else if (a.acc >= 96 && a.size === 1000 && a.wpm >= 45) {
    t.push({ prio: 55, tag: 'Level up', title: 'Seltene Wörter dazunehmen',
      text: `${nf.format(a.wpm)} WPM bei ${pct(a.acc)} – Zeit für die Top 10.000 mit selteneren Buchstabenfolgen.`,
      why: 'Variabel üben überträgt besser auf echte Texte (Community).',
      action: { label: 'Top 10.000 starten', preset: { source: 'words', list: L(10000), length: 't60', caps: true } } });
  } else if (a.acc >= 95 && !a.caps && a.wpm >= 25) {
    t.push({ prio: 50, tag: 'Level up', title: 'Großschreibung einschalten',
      text: 'Echte Texte haben Großbuchstaben. Trainiere den Shift-Wechsel mit der jeweils anderen Hand.',
      why: 'Shift immer mit der Gegenhand (10-Finger-System).',
      action: { label: 'Mit Großschreibung', preset: { source: 'words', length: 't60', caps: true } } });
  }

  if (!a.hideKb && a.wpm >= 25 && a.acc >= 93) {
    t.push({ prio: 45, tag: 'Blind', title: 'Bildschirmtastatur ausblenden',
      text: 'Du brauchst sie nicht mehr als Stütze. Ohne sie bleibt der Blick ganz auf dem Text.',
      why: 'Nicht hinschauen ist der Kern des Tastschreibens (Community).',
      action: { label: 'Ausblenden & trainieren', run: hideKbAndTrain } });
  }

  if (a.shortOnly && a.acc >= ACC_GOAL && a.wpm >= 25) {
    t.push({ prio: 35, tag: 'Ausdauer', title: 'Auch mal länger tippen',
      text: 'Bisher nur kurze Runden. Ein 3-Minuten-Test zeigt, ob Tempo und Genauigkeit auch halten.',
      why: 'Gleichmäßiges Tempo über längere Zeit (Community).',
      action: { label: '3 Minuten starten', preset: { source: 'words', list: L(a.size), length: 't180', strict: false } } });
  }

  if (!t.length) {
    t.push({ prio: 10, tag: 'Weiter so', title: 'Alles im grünen Bereich',
      text: `${nf.format(a.wpm)} WPM bei ${pct(a.acc)}. Bleib dran – täglich kurz trainieren.`,
      why: 'Verteiltes Üben (Baddeley & Longman 1978).',
      action: { label: 'Training starten', preset: {} } });
  }
  return t.sort((x, y) => y.prio - x.prio);
}

// ----- Aktionen -----
function go(tab) {
  $(`tab-${tab}`).click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startTraining(preset) {
  go('training');
  applyPreset(preset);
  const form = $('train-settings');
  form.classList.remove('preset-flash');
  void form.offsetWidth;
  form.classList.add('preset-flash');
  requestAnimationFrame(() => $('typing-box').focus());
}

function openLessons() {
  go('lernen');
  $('lesson-continue')?.click();
}

function hideKbAndTrain() {
  const cb = $('set-kb-hide');
  if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
  else saveSettings({ hideTrainKb: true });
  startTraining({});
}

async function weakTraining(a) {
  if (busy) return;
  busy = true;
  try {
    const chars = a.weak.map((k) => labelForCode(k.code).toLowerCase());
    const words = (await loadList(`${a.lang}-10000`)).map((w) => w.toLowerCase())
      .filter((w) => w.length >= 2 && w.length <= 9);
    // Pro Taste gleich viele Wörter, Wörter mit mehreren Treffern bevorzugt
    const pools = chars.map((c) => shuffle(words.filter((w) => w.includes(c)))
      .sort((x, y) => count(y, chars) - count(x, chars)).slice(0, 60));
    const out = [];
    for (let i = 0; i < 60 && out.length < 120; i++) for (const p of pools) if (p[i] && !out.includes(p[i])) out.push(p[i]);
    startTraining({ source: 'custom', customText: shuffle(out).join(' '), length: 't60', strict: false });
  } catch {
    startTraining({ source: 'words', length: 't60' });
  } finally {
    busy = false;
  }
}

const count = (w, chars) => [...w].filter((c) => chars.includes(c)).length;
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ----- Darstellung -----
function render() {
  const a = analyze();
  const tips = rules(a);

  // Kennzahlen
  const stats = $('tips-stats');
  stats.hidden = a.n === 0;
  if (a.n) {
    const trend = a.prevWpm != null ? a.wpm - a.prevWpm : null;
    stats.replaceChildren(...[
      [nf.format(a.wpm), 'Ø WPM'],
      [`${nf.format(a.acc)} %`, 'Ø Genauigkeit'],
      [trend == null ? '–' : `${trend >= 0 ? '+' : '−'}${nf.format(Math.abs(trend))}`, 'Trend WPM'],
      [`${a.activeDays}/14`, 'Aktive Tage'],
    ].map(([v, l]) => {
      const d = el('div', 'stat');
      d.append(el('span', 'stat-val', v), el('span', 'stat-lbl', l));
      return d;
    }));
  }
  $('tips-basis').textContent = a.n
    ? `Grundlage: deine letzten ${Math.min(a.n, AVG_N)} Sessions (Schwachstellen: ${Math.min(a.n, RECENT)}). Alles wird nur in diesem Browser berechnet.`
    : 'Noch keine Sessions – sobald du trainierst, werden die Tipps persönlich.';

  const [main, ...rest] = tips;
  $('tips-hero').replaceChildren(card(main, true));
  $('tips-more').replaceChildren(...rest.slice(0, 4).map((t) => card(t, false)));
  $('tips-more-head').hidden = rest.length === 0;

  const src = $('tips-sources');
  if (!src.childElementCount) {
    src.append(...SOURCES.map(([who, what]) => {
      const li = el('li');
      li.append(el('strong', null, who), ` – ${what}`);
      return li;
    }));
  }
}

function card(t, hero) {
  const c = el('article', `tip-card${hero ? ' hero' : ''}`);
  c.dataset.tag = t.tag;
  const head = el('div', 'tip-head');
  head.append(el('span', 'tip-tag', hero ? `Dein Fokus · ${t.tag}` : t.tag));
  c.append(head, el(hero ? 'h3' : 'h4', 'tip-title', t.title), el('p', 'tip-text', t.text));
  if (t.plan) {
    const ul = el('ul', 'tip-plan');
    ul.setAttribute('aria-label', 'Trainingsplan');
    ul.append(...t.plan.map((p) => el('li', null, p)));
    c.append(ul);
  }
  const foot = el('div', 'tip-foot');
  if (t.action) {
    const b = el('button', `btn${hero ? ' primary' : ''}`, `${t.action.label} →`);
    b.type = 'button';
    b.addEventListener('click', () => (t.action.run ? t.action.run() : startTraining(t.action.preset)));
    foot.append(b);
  }
  foot.append(el('span', 'tip-why', t.why));
  c.append(foot);
  return c;
}
