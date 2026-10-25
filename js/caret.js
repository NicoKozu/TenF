// Weich gleitender Cursor für Tippfelder. Beobachtet die Klasse .cur im Text und
// bewegt ein eigenes Element dorthin – unabhängig von den Tipp-Engines.

export function attachCaret(textEl) {
  const view = textEl.parentElement; // .typing-view (position: relative)
  const caret = document.createElement('span');
  caret.className = 'caret';
  caret.setAttribute('aria-hidden', 'true');
  view.append(caret);

  let frame = 0;
  let idle = 0;

  function place() {
    frame = 0;
    const cur = textEl.querySelector('.ch.cur');
    if (!cur) { caret.hidden = true; return; }
    caret.hidden = false;
    // Ziel-Verschiebung des Textes (nicht den Zwischenstand der Animation) verwenden
    const mx = /translateX\((-?[\d.]+)px\)/.exec(textEl.style.transform);
    const my = /translateY\((-?[\d.]+)px\)/.exec(textEl.style.transform);
    const x = textEl.offsetLeft + cur.offsetLeft + (mx ? +mx[1] : 0);
    const y = textEl.offsetTop + cur.offsetTop + (my ? +my[1] : 0);
    caret.style.setProperty('--cw', `${cur.offsetWidth}px`);
    caret.style.setProperty('--ch', `${cur.offsetHeight}px`);
    caret.style.transform = `translate(${x}px, ${y}px)`;
    caret.classList.remove('idle');
    clearTimeout(idle);
    idle = setTimeout(() => caret.classList.add('idle'), 700);
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(place); };

  new MutationObserver(schedule).observe(textEl, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
  window.addEventListener('resize', schedule);
  window.addEventListener('layoutchange', schedule);
  window.addEventListener('themechange', schedule);
  window.addEventListener('tabchange', () => setTimeout(schedule, 0));
  schedule();
}
