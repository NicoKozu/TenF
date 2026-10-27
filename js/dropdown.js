// Eigene Dropdowns im App-Design. Das native <select> bleibt (versteckt) die Datenquelle:
// Werte, change-Events und bestehender Code funktionieren unverändert.

const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
const indexDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
let uid = 0;
let openDd = null;

export function enhanceSelects(selects) {
  for (const sel of selects) if (!sel.dataset.dd) enhance(sel);
}

function enhance(sel) {
  sel.dataset.dd = '1';
  const id = `dd-${++uid}`;
  const root = document.createElement('div');
  root.className = 'dd';
  const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'dd-btn' });
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', id);
  const list = Object.assign(document.createElement('ul'), { id, className: 'dd-list', tabIndex: -1, hidden: true });
  list.setAttribute('role', 'listbox');
  root.append(btn, list);
  sel.after(root);
  sel.classList.add('dd-native');
  sel.tabIndex = -1;
  sel.setAttribute('aria-hidden', 'true');

  // Beschriftung vom umgebenden <label> übernehmen
  const lbl = sel.closest('label');
  const name = lbl ? [...lbl.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim() : '';
  if (name) { btn.setAttribute('aria-label', name); list.setAttribute('aria-label', name); }

  let active = -1;
  const opts = () => [...list.querySelectorAll('[role="option"]')];

  const sync = () => {
    const o = sel.selectedOptions[0];
    btn.textContent = o ? o.textContent : '';
    if (name) btn.setAttribute('aria-label', `${name}: ${btn.textContent}`);
  };

  const build = () => {
    list.replaceChildren();
    const add = (o) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = `${id}-${o.index}`;
      li.dataset.i = o.index;
      li.textContent = o.textContent;
      li.className = 'dd-opt';
      if (o.selected) li.setAttribute('aria-selected', 'true');
      if (o.disabled) li.setAttribute('aria-disabled', 'true');
      return li;
    };
    for (const ch of sel.children) {
      if (ch.tagName === 'OPTGROUP') {
        const g = document.createElement('li');
        g.setAttribute('role', 'group');
        g.setAttribute('aria-label', ch.label);
        const h = Object.assign(document.createElement('div'), { className: 'dd-group', textContent: ch.label });
        h.setAttribute('aria-hidden', 'true');
        const ul = document.createElement('ul');
        ul.setAttribute('role', 'none');
        for (const o of ch.children) if (!o.hidden) ul.append(add(o));
        g.append(h, ul);
        list.append(g);
      } else if (ch.tagName === 'OPTION' && !ch.hidden) list.append(add(ch));
    }
  };

  const setActive = (i) => {
    const all = opts();
    if (!all.length) return;
    all[active]?.classList.remove('active');
    active = Math.max(0, Math.min(all.length - 1, i));
    const li = all[active];
    li.classList.add('active');
    list.setAttribute('aria-activedescendant', li.id);
    li.scrollIntoView({ block: 'nearest' });
  };
  const step = (dir) => {
    const all = opts();
    let i = active;
    do { i += dir; } while (all[i] && all[i].getAttribute('aria-disabled') === 'true');
    if (all[i]) setActive(i);
  };

  const open = () => {
    if (openDd && openDd !== close) openDd();
    build();
    list.hidden = false;
    root.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    const all = opts();
    setActive(Math.max(0, all.findIndex((li) => li.getAttribute('aria-selected') === 'true')));
    list.focus({ preventScroll: true });
    openDd = close;
  };
  function close(focusBtn = true) {
    if (list.hidden) return;
    list.hidden = true;
    root.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    if (openDd === close) openDd = null;
    if (focusBtn) btn.focus({ preventScroll: true });
  }
  const choose = (li) => {
    if (!li || li.getAttribute('aria-disabled') === 'true') return;
    const i = +li.dataset.i;
    close();
    if (sel.selectedIndex !== i) {
      indexDesc.set.call(sel, i);
      sync();
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  // Klicks innerhalb des <label> nicht an das versteckte <select> weiterreichen
  root.addEventListener('click', (e) => e.preventDefault());
  btn.addEventListener('click', () => (list.hidden ? open() : close()));
  btn.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); }
  });
  list.addEventListener('click', (e) => choose(e.target.closest('[role="option"]')));
  list.addEventListener('pointermove', (e) => {
    const li = e.target.closest('[role="option"]');
    if (li && li.getAttribute('aria-disabled') !== 'true') setActive(opts().indexOf(li));
  });
  list.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowDown') step(1);
    else if (k === 'ArrowUp') step(-1);
    else if (k === 'Home') setActive(0);
    else if (k === 'End') setActive(opts().length - 1);
    else if (k === 'Enter' || k === ' ') choose(opts()[active]);
    else if (k === 'Escape') close();
    else if (k === 'Tab') { close(false); return; }
    else return;
    e.preventDefault();
  });
  list.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) close(false); });
  document.addEventListener('pointerdown', (e) => { if (!root.contains(e.target)) close(false); });
  if (lbl) lbl.addEventListener('click', (e) => { if (!root.contains(e.target)) { e.preventDefault(); btn.focus(); } });

  // Änderungen von außen (Code setzt .value, Optionen werden neu befüllt/deaktiviert)
  Object.defineProperty(sel, 'value', {
    configurable: true,
    get() { return valueDesc.get.call(this); },
    set(v) { valueDesc.set.call(this, v); sync(); },
  });
  Object.defineProperty(sel, 'selectedIndex', {
    configurable: true,
    get() { return indexDesc.get.call(this); },
    set(v) { indexDesc.set.call(this, v); sync(); },
  });
  sel.addEventListener('change', sync);
  new MutationObserver(() => { sync(); if (!list.hidden) build(); })
    .observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'selected', 'label'] });
  sync();
}
