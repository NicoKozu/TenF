// Verlauf & Statistik: Kennzahlen, Diagramm, Schwachstellen, Session-Liste, Export/Import.
import { createKeyboard, labelForCode, FINGERS } from './keyboard.js';
import { getSessions, deleteSession, clearSessions, exportData, importData, importSessions } from './storage.js';

const $ = (id) => document.getElementById(id);
const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dtf = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const dShort = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });

const WEAK_WINDOW = 20; // Sessions für die Schwachstellen-Analyse
const MIN_HITS = 5;     // Mindestanschläge, damit eine Fehlerquote zählt
const PAGE = 20;
const FOCUS_LABEL = { all: 'Alle Tasten', home: 'Grundreihe', 'home-top': 'Grund + oben', 'home-bottom': 'Grund + unten', custom: 'Eigener Text' };

let panel, heatKb, chart = null, showAll = false, dirty = true;

// ----- Chart.js lokal und erst bei Bedarf laden (keine Anfrage an Dritte) -----
let chartLib;
function loadChart() {
  chartLib ??= new Promise((resolve, reject) => {
    if (window.Chart) return resolve(window.Chart);
    const sc = document.createElement('script');
    sc.src = 'js/vendor/chart.umd.min.js';
    sc.onload = () => resolve(window.Chart);
    sc.onerror = () => { chartLib = null; reject(new Error('Chart.js konnte nicht geladen werden.')); };
    document.head.append(sc);
  });
  return chartLib;
}

// ----- Hilfen -----
const sum = (a) => a.reduce((x, y) => x + y, 0);
const avg = (a) => (a.length ? sum(a) / a.length : 0);
const keyName = (code) => (code === 'Space' ? 'Leertaste' : labelForCode(code));

function fmtDur(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h} h ${m} min`;
  return m ? `${m}:${String(s).padStart(2, '0')} min` : `${s} s`;
}

function modeLabel(cfg = {}) {
  const l = cfg.length ?? '';
  if (l === 'full') return 'Ganzer Text';
  const n = Number(l.slice(1));
  return l[0] === 't' ? `${n / 60} Min` : l[0] === 'w' ? `${n} Wörter` : '–';
}

function focusLabel(cfg = {}) {
  const parts = [FOCUS_LABEL[cfg.focus] ?? 'Alle Tasten'];
  if (cfg.finger && cfg.finger !== 'all') parts.push(FINGERS[cfg.finger]);
  return parts.join(', ');
}

function rangeFilter(sessions) {
  const days = Number($('hist-range').value);
  if (!days) return sessions;
  const from = Date.now() - days * 864e5;
  return sessions.filter((s) => Date.parse(s.date) >= from);
}

function el(tag, props = {}, ...children) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
}

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ----- Kennzahlen -----
function renderSummary(all) {
  const last = all.slice(-10);
  const prev = all.slice(-20, -10);
  const avgWpm = avg(last.map((s) => s.wpm));
  let delta = '';
  if (prev.length >= 3) {
    const d = avgWpm - avg(prev.map((s) => s.wpm));
    delta = ` (${d >= 0 ? '+' : '−'}${nf1.format(Math.abs(d))})`;
  }
  const tiles = [
    ['Sessions', String(all.length)],
    ['Übungszeit', fmtDur(sum(all.map((s) => s.durationSec || 0)))],
    ['Bestwert WPM', nf1.format(Math.max(...all.map((s) => s.wpm)))],
    ['Ø WPM (letzte 10)', nf1.format(avgWpm) + delta],
    ['Ø Genauigkeit (letzte 10)', `${nf1.format(avg(last.map((s) => s.accuracy)))} %`],
  ];
  $('hist-summary').replaceChildren(
    ...tiles.map(([lbl, val]) => el('div', { className: 'stat' },
      el('span', { className: 'stat-val', textContent: val }),
      el('span', { className: 'stat-lbl', textContent: lbl }))),
  );
}

// ----- Diagramm -----
async function renderChart(list) {
  const canvas = $('hist-chart');
  const desc = $('hist-chart-desc');
  if (list.length < 2) {
    chart?.destroy(); chart = null;
    canvas.hidden = true;
    desc.textContent = 'Das Diagramm erscheint ab zwei Sessions im gewählten Zeitraum.';
    return;
  }
  canvas.hidden = false;
  const first = list[0], last = list.at(-1);
  const label = `Verlauf über ${list.length} Sessions: WPM von ${nf1.format(first.wpm)} auf ${nf1.format(last.wpm)}, `
    + `Genauigkeit von ${nf1.format(first.accuracy)} % auf ${nf1.format(last.accuracy)} %.`;
  canvas.setAttribute('aria-label', label);
  desc.textContent = label + ' Details in der Tabelle unten.';

  let Chart;
  try { Chart = await loadChart(); } catch (e) { desc.textContent = e.message; canvas.hidden = true; return; }

  const c = { text: css('--muted'), grid: css('--border'), wpm: css('--accent'), acc: css('--ok') };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const data = {
    labels: list.map((s) => dShort.format(new Date(s.date))),
    datasets: [
      { label: 'WPM', data: list.map((s) => +s.wpm.toFixed(1)), borderColor: c.wpm, backgroundColor: c.wpm,
        yAxisID: 'y', tension: 0.25, pointRadius: list.length > 60 ? 0 : 3 },
      { label: 'Genauigkeit %', data: list.map((s) => +s.accuracy.toFixed(1)), borderColor: c.acc, backgroundColor: c.acc,
        yAxisID: 'y1', tension: 0.25, borderDash: [6, 4], pointRadius: list.length > 60 ? 0 : 3, pointStyle: 'rectRot' },
    ],
  };
  const options = {
    responsive: true, maintainAspectRatio: false, animation: reduce ? false : undefined,
    interaction: { mode: 'index', intersect: false },
    color: c.text,
    plugins: {
      legend: { labels: { color: c.text, usePointStyle: true } },
      tooltip: { callbacks: { title: (items) => dtf.format(new Date(list[items[0].dataIndex].date)) } },
    },
    scales: {
      x: { ticks: { color: c.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { color: c.grid } },
      y: { beginAtZero: true, title: { display: true, text: 'WPM', color: c.text }, ticks: { color: c.text }, grid: { color: c.grid } },
      y1: { position: 'right', suggestedMin: 80, max: 100, title: { display: true, text: 'Genauigkeit %', color: c.text },
        ticks: { color: c.text }, grid: { drawOnChartArea: false } },
    },
  };
  chart?.destroy();
  chart = new Chart(canvas, { type: 'line', data, options });
}

// ----- Schwachstellen -----
function renderWeak(all) {
  const recent = all.slice(-WEAK_WINDOW);
  const errs = {}, hits = {}, rated = {}, fingers = {};
  const add = (o, k, n) => { o[k] = (o[k] ?? 0) + n; };
  for (const s of recent) {
    const hasH = s.hitsByKey && Object.keys(s.hitsByKey).length > 0;
    for (const [k, n] of Object.entries(s.errorsByKey ?? {})) { add(errs, k, n); if (hasH) add(rated, k, n); }
    for (const [k, n] of Object.entries(s.hitsByKey ?? {})) add(hits, k, n);
    for (const [k, n] of Object.entries(s.errorsByFinger ?? {})) fingers[k] = (fingers[k] ?? 0) + n;
  }
  const hasHits = Object.keys(hits).length > 0;

  // Fehlerquote, wenn Anschlagszahlen vorliegen (neuere Sessions), sonst absolute Fehler.
  const keys = Object.entries(errs).map(([code, n]) => ({
    code, n, rate: hits[code] >= MIN_HITS ? (rated[code] ?? 0) / hits[code] : null,
  }));
  keys.sort((a, b) => (hasHits ? (b.rate ?? -1) - (a.rate ?? -1) : 0) || b.n - a.n);
  const top = keys.slice(0, 8);

  $('weak-note').textContent = `Grundlage: letzte ${recent.length} Session${recent.length === 1 ? '' : 's'}`
    + (hasHits ? ', sortiert nach Fehlerquote.' : '.');

  const maxN = Math.max(0, ...top.map((k) => (hasHits && k.rate != null ? k.rate : k.n))) || 1;
  $('weak-keys').replaceChildren(...(top.length
    ? top.map((k) => {
      const v = hasHits && k.rate != null ? k.rate : k.n;
      const val = k.rate != null ? `${nf1.format(k.rate * 100)} % (${k.n}×)` : `${k.n}×`;
      return el('li', {},
        el('kbd', { textContent: keyName(k.code) }),
        el('span', { className: 'bar', style: `--v:${(v / maxN).toFixed(3)}` }),
        el('span', { className: 'bar-val', textContent: val }));
    })
    : [el('li', { className: 'hint', textContent: 'Keine Fehler – stark!' })]));

  const fTop = Object.entries(fingers).sort((a, b) => b[1] - a[1]);
  const maxF = Math.max(1, ...fTop.map(([, n]) => n));
  $('weak-fingers').replaceChildren(...(fTop.length
    ? fTop.map(([f, n]) => el('li', {},
      el('span', { className: 'swatch', style: `background:var(--f-${f})` }),
      el('span', { className: 'finger-name', textContent: FINGERS[f] ?? f }),
      el('span', { className: 'bar', style: `--v:${(n / maxF).toFixed(3)}` }),
      el('span', { className: 'bar-val', textContent: `${n}×` })))
    : [el('li', { className: 'hint', textContent: '–' })]));

  heatKb.heat(hasHits
    ? Object.fromEntries(keys.map((k) => [k.code, k.rate ?? 0]))
    : errs);
}

// ----- Session-Tabelle -----
function renderTable(all) {
  const rows = [...all].reverse();
  const shown = showAll ? rows : rows.slice(0, PAGE);
  $('hist-rows').replaceChildren(...shown.map((s) => {
    const when = dtf.format(new Date(s.date));
    const del = el('button', { type: 'button', className: 'icon-btn small', textContent: '✕',
      title: 'Session löschen' });
    del.setAttribute('aria-label', `Session vom ${when} löschen`);
    del.addEventListener('click', () => {
      if (!confirm(`Session vom ${when} löschen?`)) return;
      deleteSession(s.id);
      msg('Session gelöscht.');
      render();
    });
    return el('tr', {},
      el('td', { textContent: when }),
      el('td', { textContent: modeLabel(s.config) }),
      el('td', { textContent: focusLabel(s.config) }),
      el('td', { className: 'num', textContent: fmtDur(s.durationSec ?? 0) }),
      el('td', { className: 'num', textContent: nf1.format(s.wpm) }),
      el('td', { className: 'num', textContent: `${nf1.format(s.accuracy)} %` }),
      el('td', { className: 'num', textContent: String(s.errors ?? '–') }),
      el('td', {}, del));
  }));
  const more = $('hist-more');
  more.hidden = rows.length <= PAGE;
  more.textContent = showAll ? 'Weniger anzeigen' : `Alle ${rows.length} anzeigen`;
}

// ----- Gesamt -----
function render() {
  dirty = false;
  const all = getSessions();
  const empty = all.length === 0;
  $('hist-empty').hidden = !empty;
  $('hist-content').hidden = empty;
  $('hist-export').disabled = empty;
  $('hist-export-xlsx').disabled = empty;
  $('hist-clear').disabled = empty;
  if (empty) { chart?.destroy(); chart = null; return; }
  renderSummary(all);
  renderChart(rangeFilter(all));
  renderWeak(all);
  renderTable(all);
}

function msg(text, isErr = false) {
  const m = $('hist-msg');
  m.textContent = text;
  m.classList.toggle('err', isErr);
}

// ----- Daten-Aktionen -----
const today = () => new Date().toISOString().slice(0, 10);

function saveFile(data, type, name) {
  const a = el('a', { href: URL.createObjectURL(new Blob([data], { type })), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportJson() {
  saveFile(exportData(), 'application/json', `tenf-backup-${today()}.json`);
  msg('JSON-Backup erstellt.');
}

async function exportExcel() {
  try {
    const { sessionsToXlsx } = await import('./excel.js');
    saveFile(sessionsToXlsx(getSessions()),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `tenf-verlauf-${today()}.xlsx`);
    msg('Excel-Datei erstellt.');
  } catch (err) {
    msg(`Excel-Export fehlgeschlagen: ${err.message}`, true);
  }
}

async function importFile(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const isZip = buf[0] === 0x50 && buf[1] === 0x4b; // "PK" → .xlsx
    if (isZip) {
      const { xlsxToSessions } = await import('./excel.js');
      const { sessions, skipped } = xlsxToSessions(buf);
      if (!sessions.length) throw new Error('Keine gültigen Zeilen gefunden.');
      const r = importSessions(sessions);
      const skip = skipped.length
        ? ` ${skipped.length} ungültige Zeile(n) übersprungen (Zeile ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? ' …' : ''}).`
        : '';
      msg(`Excel importiert: ${r.added} neu, ${r.updated} aktualisiert, insgesamt ${r.total}.${skip}`, skipped.length > 0);
    } else {
      const before = getSessions().length;
      const total = importData(new TextDecoder().decode(buf), { merge: true });
      msg(`JSON importiert: ${total - before} neue Session(s), insgesamt ${total}.`);
    }
    render();
  } catch (err) {
    msg(`Import fehlgeschlagen: ${err.message}`, true);
  }
}

export function initHistory() {
  panel = $('panel-verlauf');
  heatKb = createKeyboard($('keyboard-heat'));

  $('hist-range').addEventListener('change', () => renderChart(rangeFilter(getSessions())));
  $('hist-more').addEventListener('click', () => { showAll = !showAll; renderTable(getSessions()); });
  $('hist-export-xlsx').addEventListener('click', exportExcel);
  $('hist-export').addEventListener('click', exportJson);
  $('hist-import').addEventListener('change', importFile);
  $('hist-clear').addEventListener('click', () => {
    if (!confirm('Gesamten Verlauf unwiderruflich löschen? Tipp: Vorher exportieren.')) return;
    clearSessions();
    msg('Verlauf gelöscht.');
    render();
  });

  // Neu zeichnen, wenn der Tab sichtbar wird bzw. bei Theme-Wechsel (Farben aus CSS).
  window.addEventListener('tabchange', (e) => { if (e.detail === 'verlauf') render(); else dirty = true; });
  window.addEventListener('themechange', () => { if (!panel.hidden) render(); else dirty = true; });
  if (!panel.hidden && dirty) render();
}
