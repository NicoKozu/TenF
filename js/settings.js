// Darstellung: Design (Farbschema) und Größen. Wird früh angewendet, damit nichts flackert.
import { getSettings, saveSettings } from './storage.js';

export const THEMES = {
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',
  black: 'Schwarz',
  beige: 'Beige',
  lila: 'Lila',
};
export const SIZE_DEFAULTS = { ui: 100, text: 100, kb: 100, width: 65 };
const SIZE_KEYS = ['ui', 'text', 'width', 'kb'];

const $ = (id) => document.getElementById(id);
const clamp = (v, min, max, def) => (Number.isFinite(+v) ? Math.min(max, Math.max(min, +v)) : def);

function sizes() {
  const s = { ...SIZE_DEFAULTS, ...getSettings().sizes };
  return { ui: clamp(s.ui, 80, 150, 100), text: clamp(s.text, 70, 200, 100), kb: clamp(s.kb, 60, 150, 100), width: clamp(s.width, 50, 100, 65) };
}

export function applyTheme(theme) {
  if (!(theme in THEMES)) theme = 'system';
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = theme;
  const btn = $('theme-toggle');
  if (btn) {
    btn.setAttribute('aria-label', `Design: ${THEMES[theme]} (klicken zum Wechseln)`);
    btn.title = `Design: ${THEMES[theme]}`;
  }
  const radio = document.querySelector(`input[name="theme"][value="${theme}"]`);
  if (radio) radio.checked = true;
  window.dispatchEvent(new Event('themechange'));
}

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
}

function applyKbHide(on) {
  document.documentElement.classList.toggle('hide-train-kb', !!on);
}

export function initSettings() {
  const cfg = getSettings();
  applyTheme(cfg.theme);
  applySizes();
  applyKbHide(cfg.hideTrainKb);

  // Header-Knopf: Designs der Reihe nach durchschalten
  $('theme-toggle').addEventListener('click', () => {
    const keys = Object.keys(THEMES);
    const next = keys[(keys.indexOf(getSettings().theme) + 1) % keys.length];
    saveSettings({ theme: next });
    applyTheme(next);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getSettings().theme === 'system') window.dispatchEvent(new Event('themechange'));
  });

  // Design-Auswahl
  const picker = $('theme-picker');
  for (const [id, name] of Object.entries(THEMES)) {
    const label = document.createElement('label');
    label.className = 'theme-opt';
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'theme', value: id, className: 'visually-hidden' });
    input.checked = (getSettings().theme in THEMES ? getSettings().theme : 'system') === id;
    const prev = document.createElement('span');
    prev.className = `theme-prev tp-${id}`;
    prev.setAttribute('aria-hidden', 'true');
    prev.innerHTML = '<span class="tp-bar"></span><span class="tp-line"></span><span class="tp-line short"></span>';
    const txt = document.createElement('span');
    txt.className = 'theme-name';
    txt.textContent = name;
    label.append(input, prev, txt);
    picker.append(label);
  }
  picker.addEventListener('change', (e) => {
    if (e.target.name !== 'theme') return;
    saveSettings({ theme: e.target.value });
    applyTheme(e.target.value);
  });

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
