import { createKeyboard, renderLegend } from './keyboard.js';
import { getSettings, saveSettings } from './storage.js';
import { initTraining } from './training.js';

// ----- Theme -----
const THEMES = ['system', 'light', 'dark'];
const THEME_LABEL = { system: 'System', light: 'Hell', dark: 'Dunkel' };

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = theme;
  const btn = document.getElementById('theme-toggle');
  btn.setAttribute('aria-label', `Farbschema: ${THEME_LABEL[theme]} (klicken zum Wechseln)`);
  btn.title = `Farbschema: ${THEME_LABEL[theme]}`;
}

function initTheme() {
  applyTheme(getSettings().theme);
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const cur = getSettings().theme;
    const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
    saveSettings({ theme: next });
    applyTheme(next);
  });
}

// ----- Tabs (WAI-ARIA Tabs-Pattern) -----
function initTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];

  function select(tab, focus = true) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    const id = tab.id.replace('tab-', '');
    history.replaceState(null, '', '#' + id);
    window.dispatchEvent(new CustomEvent('tabchange', { detail: id }));
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const n = tabs.length;
      const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: n - 1 };
      if (e.key in map) {
        e.preventDefault();
        select(tabs[(map[e.key] + n) % n]);
      }
    });
  });

  const fromHash = document.getElementById('tab-' + location.hash.slice(1));
  if (fromHash) select(fromHash, false);
}

// ----- Tastatur-Demo im Lernen-Tab -----
function initLearnKeyboard() {
  const kb = createKeyboard(document.getElementById('keyboard-lernen'));
  renderLegend(document.getElementById('finger-legend'));

  const panel = document.getElementById('panel-lernen');
  window.addEventListener('keydown', (e) => {
    if (!panel.hidden) kb.press(e.code);
  });
  window.addEventListener('keyup', (e) => kb.release(e.code));
  window.addEventListener('blur', () => kb.releaseAll());
}

initTheme();
initLearnKeyboard();
initTabs();
initTraining();
