import { createKeyboard, renderLegend } from './keyboard.js';
import { initSettings } from './settings.js';
import { initTraining } from './training.js';
import { initHistory } from './history.js';
import { initLessons } from './lessons.js';

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

  const fromHash = () => document.getElementById('tab-' + location.hash.slice(1));
  if (fromHash()) select(fromHash(), false);
  window.addEventListener('hashchange', () => { if (fromHash()) select(fromHash()); });
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

initSettings();
initLearnKeyboard();
initTabs();
initLessons();
initTraining();
initHistory();
