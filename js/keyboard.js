// Virtuelle Tastatur: deutsches QWERTZ (ISO), Zuordnung über event.code.

export const FINGERS = {
  lp: 'Links kleiner Finger',
  lr: 'Links Ringfinger',
  lm: 'Links Mittelfinger',
  li: 'Links Zeigefinger',
  ri: 'Rechts Zeigefinger',
  rm: 'Rechts Mittelfinger',
  rr: 'Rechts Ringfinger',
  rp: 'Rechts kleiner Finger',
  th: 'Daumen',
};

// [code, Beschriftung, Finger, Breite?, Zusatzklasse?]
const ROWS = [
  [
    ['Backquote', '^', 'lp'], ['Digit1', '1', 'lp'], ['Digit2', '2', 'lr'], ['Digit3', '3', 'lm'],
    ['Digit4', '4', 'li'], ['Digit5', '5', 'li'], ['Digit6', '6', 'ri'], ['Digit7', '7', 'ri'],
    ['Digit8', '8', 'rm'], ['Digit9', '9', 'rr'], ['Digit0', '0', 'rp'], ['Minus', 'ß', 'rp'],
    ['Equal', '´', 'rp'], ['Backspace', '⌫', 'rp', 2, 'mod'],
  ],
  [
    ['Tab', 'Tab', 'lp', 1.5, 'mod'], ['KeyQ', 'q', 'lp'], ['KeyW', 'w', 'lr'], ['KeyE', 'e', 'lm'],
    ['KeyR', 'r', 'li'], ['KeyT', 't', 'li'], ['KeyY', 'z', 'ri'], ['KeyU', 'u', 'ri'],
    ['KeyI', 'i', 'rm'], ['KeyO', 'o', 'rr'], ['KeyP', 'p', 'rp'], ['BracketLeft', 'ü', 'rp'],
    ['BracketRight', '+', 'rp'], ['Enter', '⏎', 'rp', 1.5, 'mod'],
  ],
  [
    ['CapsLock', 'Caps', 'lp', 1.75, 'mod'], ['KeyA', 'a', 'lp'], ['KeyS', 's', 'lr'], ['KeyD', 'd', 'lm'],
    ['KeyF', 'f', 'li', 1, 'home'], ['KeyG', 'g', 'li'], ['KeyH', 'h', 'ri'], ['KeyJ', 'j', 'ri', 1, 'home'],
    ['KeyK', 'k', 'rm'], ['KeyL', 'l', 'rr'], ['Semicolon', 'ö', 'rp'], ['Quote', 'ä', 'rp'],
    ['Backslash', '#', 'rp'], [null, '', null, 1.25],
  ],
  [
    ['ShiftLeft', '⇧', 'lp', 1.25, 'mod'], ['IntlBackslash', '<', 'lp'], ['KeyZ', 'y', 'lp'],
    ['KeyX', 'x', 'lr'], ['KeyC', 'c', 'lm'], ['KeyV', 'v', 'li'], ['KeyB', 'b', 'li'],
    ['KeyN', 'n', 'ri'], ['KeyM', 'm', 'ri'], ['Comma', ',', 'rm'], ['Period', '.', 'rr'],
    ['Slash', '-', 'rp'], ['ShiftRight', '⇧', 'rp', 2.75, 'mod'],
  ],
  [
    [null, '', null, 4], ['Space', '', 'th', 7], [null, '', null, 4],
  ],
];

// Zeichen, die mit Shift auf einer Taste liegen: Zeichen → Grundbeschriftung
const SHIFTED = {
  '°': '^', '!': '1', '"': '2', '§': '3', '$': '4', '%': '5', '&': '6', '/': '7',
  '(': '8', ')': '9', '=': '0', '?': 'ß', '`': '´', '*': '+', "'": '#',
  '>': '<', ';': ',', ':': '.', '_': '-',
};

// Lookup-Tabellen
const KEY_BY_CODE = new Map();
const CODE_BY_LABEL = new Map();
for (const row of ROWS) {
  for (const [code, label, finger] of row) {
    if (!code) continue;
    KEY_BY_CODE.set(code, { code, label, finger });
    if (label.length === 1) CODE_BY_LABEL.set(label, code);
  }
}
CODE_BY_LABEL.set(' ', 'Space');
CODE_BY_LABEL.set('\n', 'Enter');

/**
 * Welche Taste(n) braucht ein Zeichen?
 * @returns {{code:string, finger:string, shift:string|null}|null}
 *   shift = Code der Shift-Taste (immer die der Gegenhand) oder null.
 */
export function keyForChar(char) {
  let base = char;
  let needsShift = false;
  if (SHIFTED[char]) {
    base = SHIFTED[char];
    needsShift = true;
  } else if (char !== char.toLowerCase() && char.length === 1) {
    base = char.toLowerCase();
    needsShift = true;
  } else if (char === 'ẞ') {
    base = 'ß';
    needsShift = true;
  }
  const code = CODE_BY_LABEL.get(base);
  if (!code) return null;
  const { finger } = KEY_BY_CODE.get(code);
  let shift = null;
  if (needsShift) shift = finger.startsWith('l') ? 'ShiftRight' : 'ShiftLeft';
  return { code, finger, shift };
}

export function fingerForCode(code) {
  return KEY_BY_CODE.get(code)?.finger ?? null;
}

/** Anzeigename einer Taste (Buchstaben groß). */
export function labelForCode(code) {
  if (code === 'Space') return 'Leertaste';
  const label = KEY_BY_CODE.get(code)?.label ?? code;
  return label.length === 1 && label !== 'ß' ? label.toUpperCase() : label;
}

/**
 * Rendert die Tastatur in `container` und liefert ein Steuerobjekt.
 */
export function createKeyboard(container) {
  const kb = document.createElement('div');
  kb.className = 'keyboard';
  kb.setAttribute('aria-hidden', 'true'); // rein visuell; Infos werden als Text ausgegeben
  const els = new Map();

  for (const row of ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    for (const [code, label, finger, w = 1, extra] of row) {
      const el = document.createElement('div');
      el.style.setProperty('--w', w);
      if (!code) {
        el.className = 'kb-gap';
      } else {
        el.className = 'key' + (extra ? ' ' + extra : '');
        el.dataset.code = code;
        el.dataset.finger = finger;
        el.textContent = label.length === 1 && label !== 'ß' ? label.toUpperCase() : label;
        els.set(code, el);
      }
      rowEl.append(el);
    }
    kb.append(rowEl);
  }
  container.replaceChildren(kb);

  const clear = (cls) => kb.querySelectorAll('.' + cls).forEach((e) => e.classList.remove(cls));

  return {
    /** Nächstes Zeichen hervorheben (inkl. Shift). Gibt Info zurück oder null. */
    highlightChar(char) {
      clear('target');
      const info = keyForChar(char);
      if (!info) return null;
      els.get(info.code)?.classList.add('target');
      if (info.shift) els.get(info.shift)?.classList.add('target');
      return info;
    },
    clearHighlight() { clear('target'); },
    press(code) { els.get(code)?.classList.add('pressed'); },
    release(code) { els.get(code)?.classList.remove('pressed'); },
    releaseAll() { clear('pressed'); },
    /** Kurz eine Taste als falsch markieren. */
    flashWrong(code, ms = 300) {
      const el = els.get(code);
      if (!el) return;
      el.classList.add('wrong');
      setTimeout(() => el.classList.remove('wrong'), ms);
    },
  };
}

/** Legende der Fingerfarben in eine <ul> rendern. */
export function renderLegend(ul) {
  ul.replaceChildren(
    ...Object.entries(FINGERS).map(([id, name]) => {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = `var(--f-${id})`;
      li.append(sw, name);
      return li;
    }),
  );
}
