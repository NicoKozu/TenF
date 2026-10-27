// Darstellung: Design (Vorlagen + eigene Farben), Effekte und Größen.
// Das Inline-Skript in index.html wendet den gespeicherten Cache vor dem ersten Zeichnen an.
import { getSettings, saveSettings } from './storage.js';
import {
  PRESETS, LEGACY, SYSTEM, COLOR_KEYS, FX_DEFAULTS, FONTS, BG_STYLES, CARETS,
  cleanPalette, cleanFx, deriveVars, contrast, isDark, encodePalette, decodePalette,
} from './themes.js';

export const SIZE_DEFAULTS = { ui: 100, text: 100, kb: 100, width: 65 };
const SIZE_KEYS = ['ui', 'text', 'width', 'kb'];
const FX_SLIDERS = { blur: 'px', glass: '%', radius: 'px', finger: '%' };

const $ = (id) => document.getElementById(id);
const clamp = (v, min, max, def) => (Number.isFinite(+v) ? Math.min(max, Math.max(min, +v)) : def);
const darkMq = matchMedia('(prefers-color-scheme: dark)');

function sizes() {
  const s = { ...SIZE_DEFAULTS, ...getSettings().sizes };
  return { ui: clamp(s.ui, 80, 150, 100), text: clamp(s.text, 70, 200, 100), kb: clamp(s.kb, 60, 150, 100), width: clamp(s.width, 50, 100, 65) };
}

// ----- Design-Zustand -----
function themeId() {
  let t = getSettings().theme;
  t = LEGACY[t] ?? t;
  if (t === 'custom' && !getSettings().custom) t = 'system';
  return t === 'system' || t === 'custom' || t in PRESETS ? t : 'system';
}
const fx = () => cleanFx(getSettings().fx);

function palette(id = themeId(), dark = darkMq.matches) {
  if (id === 'custom') return cleanPalette(getSettings().custom);
  if (id === 'system') return PRESETS[SYSTEM[dark ? 'dark' : 'light']];
  return PRESETS[id];
}

/** Design anwenden und Cache für das nächste Laden schreiben */
export function applyDesign() {
  const id = themeId();
  const f = fx();
  const light = deriveVars(palette(id, false), f);
  const dark = deriveVars(palette(id, true), f);
  const vars = darkMq.matches ? dark : light;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.theme = id;
  root.dataset.bg = f.bg;
  root.dataset.caret = f.caret;
  root.dataset.smooth = f.smooth ? '1' : '0';
  saveSettings({ cache: { light, dark, bg: f.bg, caret: f.caret, smooth: f.smooth } });

  syncDesignUi();
  window.dispatchEvent(new Event('themechange'));
}

function setTheme(id) {
  saveSettings({ theme: id });
  applyDesign();
}

function setCustom(pal) {
  saveSettings({ theme: 'custom', custom: cleanPalette(pal) });
  applyDesign();
}

function setFx(patch) {
  saveSettings({ fx: cleanFx({ ...fx(), ...patch }) });
  applyDesign();
}

// ----- Zufallsfarben -----
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function randomPalette() {
  const h = Math.random() * 360;
  const dark = Math.random() < 0.7;
  const shift = [150, 180, 210, 40, -40][Math.floor(Math.random() * 5)];
  let p;
  if (dark) {
    p = { bg: hsl(h, 35, 7), bg2: hsl(h + 40, 50, 16), glass: hsl(h, 30, 17), text: hsl(h, 40, 95), muted: hsl(h, 22, 72),
      accent: hsl(h + shift, 90, 68), accent2: hsl(h + shift + 50, 85, 64), ok: '#4ade80', err: '#ff6b8a' };
  } else {
    p = { bg: hsl(h, 45, 94), bg2: hsl(h + 40, 55, 87), glass: '#ffffff', text: hsl(h, 40, 12), muted: hsl(h, 16, 36),
      accent: hsl(h + shift, 75, 36), accent2: hsl(h + shift + 50, 70, 38), ok: '#15803d', err: '#c8203b' };
  }
  return p;
}

// ----- Einstellungs-UI -----
function previewCard(id, p, name) {
  const label = document.createElement('label');
  label.className = 'theme-opt';
  const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'theme', value: id, className: 'visually-hidden' });
  const prev = document.createElement('span');
  prev.className = 'theme-prev';
  prev.setAttribute('aria-hidden', 'true');
  if (id === 'system') {
    const l = PRESETS[SYSTEM.light], d = PRESETS[SYSTEM.dark];
    prev.style.background = `linear-gradient(135deg, ${l.bg} 0 50%, ${d.bg} 50% 100%)`;
    prev.innerHTML = `<span class="tp-glass" style="background:${l.glass}cc;border-color:${l.text}22"><i style="background:${l.accent}"></i><b style="background:${l.text}"></b></span>`
      + `<span class="tp-glass" style="background:${d.glass}cc;border-color:${d.text}22"><i style="background:${d.accent}"></i><b style="background:${d.text}"></b></span>`;
  } else {
    prev.style.background = `radial-gradient(circle at 15% 20%, ${p.accent}66, transparent 55%), radial-gradient(circle at 90% 90%, ${p.accent2}55, transparent 55%), linear-gradient(135deg, ${p.bg}, ${p.bg2})`;
    prev.innerHTML = `<span class="tp-glass" style="background:${p.glass}aa;border-color:${p.text}22"><i style="background:linear-gradient(90deg, ${p.accent}, ${p.accent2})"></i><b style="background:${p.text}"></b><b class="short" style="background:${p.muted}"></b></span>`;
  }
  const txt = document.createElement('span');
  txt.className = 'theme-name';
  txt.textContent = name;
  label.append(input, prev, txt);
  return label;
}

function renderPicker() {
  const picker = $('theme-picker');
  picker.replaceChildren(previewCard('system', null, 'System'));
  for (const [id, p] of Object.entries(PRESETS)) picker.append(previewCard(id, p, p.name));
  if (getSettings().custom) picker.append(previewCard('custom', cleanPalette(getSettings().custom), 'Eigenes'));
}

function renderColorEditor() {
  const wrap = $('color-editor');
  for (const [k, name] of Object.entries(COLOR_KEYS)) {
    const label = document.createElement('label');
    label.className = 'color-field';
    const input = Object.assign(document.createElement('input'), { type: 'color', id: `col-${k}` });
    input.dataset.key = k;
    const txt = document.createElement('span');
    txt.className = 'color-name';
    txt.textContent = name;
    const hex = document.createElement('code');
    hex.id = `col-${k}-hex`;
    label.append(input, txt, hex);
    wrap.append(label);
  }
  // Live-Vorschau beim Ziehen, Speichern beim Loslassen
  let frame = 0;
  wrap.addEventListener('input', (e) => {
    const k = e.target.dataset.key;
    if (!k) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => setCustom({ ...palette(), [k]: e.target.value }));
  });
}

function syncDesignUi() {
  const id = themeId();
  if (!$('theme-picker')) return;
  if (id === 'custom' && !document.querySelector('input[name="theme"][value="custom"]')) renderPicker();
  const radio = document.querySelector(`input[name="theme"][value="${id}"]`);
  if (radio) radio.checked = true;

  const p = palette();
  for (const k of Object.keys(COLOR_KEYS)) {
    const input = $(`col-${k}`);
    if (input && document.activeElement !== input) input.value = p[k];
    const hex = $(`col-${k}-hex`);
    if (hex) hex.textContent = p[k];
  }
  const code = $('theme-code');
  if (code && document.activeElement !== code) code.value = encodePalette(p);

  // Kontrastprüfung (gegen Hintergrund und Glas)
  const checks = [
    ['Text', p.text, p.bg, 4.5], ['Nebentext', p.muted, p.bg, 4.5],
    ['Fehler', p.err, p.bg, 4.5], ['Akzent', p.accent, p.bg, 3],
  ];
  const out = $('contrast-out');
  out.replaceChildren(...checks.map(([n, a, b, min]) => {
    const r = contrast(a, b);
    const li = document.createElement('li');
    li.className = r >= min ? 'good' : 'warn';
    li.textContent = `${r >= min ? '✓' : '⚠'} ${n} ${r.toFixed(1)}:1`;
    li.title = `Mindestens ${min}:1 empfohlen`;
    return li;
  }));

  const f = fx();
  for (const [k, unit] of Object.entries(FX_SLIDERS)) {
    const input = $(`fx-${k}`);
    if (document.activeElement !== input) input.value = f[k];
    $(`fx-${k}-out`).textContent = `${f[k]} ${unit}`;
  }
  $('fx-bg').value = f.bg;
  $('fx-caret').value = f.caret;
  $('fx-font').value = f.font;
  $('fx-smooth').checked = f.smooth;
  $('dark-note').textContent = isDark(p) ? 'Dunkles Design' : 'Helles Design';
}

function fillSelect(id, opts) {
  $(id).append(...Object.entries(opts).map(([v, n]) => new Option(typeof n === 'string' ? n : n.name, v)));
}

function initDesignUi() {
  renderPicker();
  $('theme-picker').addEventListener('change', (e) => {
    if (e.target.name === 'theme') setTheme(e.target.value);
  });
  renderColorEditor();

  $('theme-random').addEventListener('click', () => {
    const ids = Object.keys(PRESETS).filter((i) => i !== themeId());
    setTheme(ids[Math.floor(Math.random() * ids.length)]);
  });
  $('theme-dice').addEventListener('click', () => { setCustom(randomPalette()); renderPicker(); syncDesignUi(); });

  const msg = $('code-msg');
  $('code-copy').addEventListener('click', async () => {
    const code = encodePalette(palette());
    try { await navigator.clipboard.writeText(code); msg.textContent = 'Design-Code kopiert.'; }
    catch { $('theme-code').select(); msg.textContent = 'Code markiert – mit Strg+C kopieren.'; }
  });
  $('code-apply').addEventListener('click', () => {
    const p = decodePalette($('theme-code').value);
    if (!p) { msg.textContent = 'Ungültiger Code. Format: TENF- gefolgt von 9 Hex-Farben.'; return; }
    setCustom(p); renderPicker(); syncDesignUi();
    msg.textContent = 'Design übernommen.';
  });

  fillSelect('fx-bg', BG_STYLES);
  fillSelect('fx-caret', CARETS);
  fillSelect('fx-font', FONTS);
  for (const k of Object.keys(FX_SLIDERS)) {
    $(`fx-${k}`).addEventListener('input', (e) => setFx({ [k]: +e.target.value }));
  }
  for (const k of ['bg', 'caret', 'font']) $(`fx-${k}`).addEventListener('change', (e) => setFx({ [k]: e.target.value }));
  $('fx-smooth').addEventListener('change', (e) => setFx({ smooth: e.target.checked }));
  $('fx-reset').addEventListener('click', () => setFx(FX_DEFAULTS));
}

// ----- Größen -----
export function applySizes(s = sizes()) {
  const st = document.documentElement.style;
  st.setProperty('--ui-scale', s.ui / 100);
  st.setProperty('--type-scale', s.text / 100);
  st.setProperty('--kb-scale', s.kb / 100);
  st.setProperty('--page-w', s.width);
  for (const k of SIZE_KEYS) {
    const out = $(`set-${k}-out`);
    if (out) out.textContent = `${s[k]} %`;
  }
  window.dispatchEvent(new Event('layoutchange'));
}

function applyKbHide(on) {
  document.documentElement.classList.toggle('hide-train-kb', !!on);
}

export function initSettings() {
  const cfg = getSettings();
  initDesignUi();
  applyDesign();
  applySizes();
  applyKbHide(cfg.hideTrainKb);

  darkMq.addEventListener('change', () => { if (themeId() === 'system') applyDesign(); });

  // Größen: live anwenden, beim Loslassen speichern
  const s = sizes();
  for (const k of SIZE_KEYS) {
    const input = $(`set-${k}`);
    input.value = s[k];
    input.addEventListener('input', () => applySizes({ ...sizes(), ...readSliders() }));
    input.addEventListener('change', () => { saveSettings({ sizes: readSliders() }); applySizes(); });
  }
  $('set-reset').addEventListener('click', () => {
    saveSettings({ sizes: { ...SIZE_DEFAULTS } });
    for (const k of SIZE_KEYS) $(`set-${k}`).value = SIZE_DEFAULTS[k];
    applySizes();
  });

  const hide = $('set-kb-hide');
  hide.checked = !!cfg.hideTrainKb;
  hide.addEventListener('change', () => { saveSettings({ hideTrainKb: hide.checked }); applyKbHide(hide.checked); });
}

function readSliders() {
  return Object.fromEntries(SIZE_KEYS.map((k) => [k, +$(`set-${k}`).value]));
}
