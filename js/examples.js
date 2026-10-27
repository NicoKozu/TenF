// Beispieltexte im Lernen-Tab: Karten mit Vorschau, „Abtippen“ startet im Training als eigener Text.
import { EXAMPLES } from './examples-data.js';
import { applyPreset } from './training.js';

const $ = (id) => document.getElementById(id);
const LEVELS = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer' };

export function initExamples() {
  renderExamples();
  // Sprunglinks ohne Hash-Änderung (Hash steuert die Tabs)
  document.querySelectorAll('.learn-jump a').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const t = document.querySelector(a.getAttribute('href'));
      t?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      t?.querySelector('h3')?.focus({ preventScroll: true });
    });
  });
}

function renderExamples() {
  const list = $('example-list');
  const frag = document.createDocumentFragment();
  EXAMPLES.forEach((ex) => {
    const words = ex.text.trim().split(/\s+/).length;
    const li = document.createElement('li');
    li.className = 'learn-card example-card';

    const head = document.createElement('div');
    head.className = 'ex-head';
    const h = document.createElement('h4');
    h.textContent = ex.title;
    const lvl = document.createElement('span');
    lvl.className = `ex-level lvl-${ex.level}`;
    lvl.textContent = LEVELS[ex.level] ?? ex.level;
    head.append(h, lvl);

    const p = document.createElement('p');
    p.className = 'ex-preview';
    p.textContent = ex.text;

    const foot = document.createElement('div');
    foot.className = 'ex-foot';
    const meta = document.createElement('span');
    meta.className = 'hint';
    meta.textContent = `${words} Wörter · ${ex.text.length} Zeichen`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn primary';
    btn.textContent = 'Abtippen';
    btn.setAttribute('aria-label', `${ex.title} abtippen`);
    btn.addEventListener('click', () => start(ex.text));
    foot.append(meta, btn);

    li.append(head, p, foot);
    frag.append(li);
  });
  list.replaceChildren(frag);
}

function start(text) {
  $('tab-training').click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  applyPreset({ source: 'custom', customText: text, length: 'full' });
  requestAnimationFrame(() => $('typing-box').focus());
}
