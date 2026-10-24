// Farbpaletten (Vorlagen) und Ableitung aller CSS-Variablen. Reine Funktionen, kein DOM.

/** Bearbeitbare Farben eines Designs (Reihenfolge = Reihenfolge im Editor) */
export const COLOR_KEYS = {
  bg: 'Hintergrund',
  bg2: 'Hintergrund 2 (Verlauf)',
  glass: 'Glasflächen',
  text: 'Text',
  muted: 'Nebentext',
  accent: 'Akzent',
  accent2: 'Akzent 2',
  ok: 'Richtig',
  err: 'Fehler',
};

export const PRESETS = {
  aurora:   { name: 'Aurora',   bg: '#0b0d1a', bg2: '#1c1040', glass: '#1b2140', text: '#eef0ff', muted: '#a3abd0', accent: '#8b7bff', accent2: '#3fd0ff', ok: '#4ade80', err: '#ff6b8a' },
  frost:    { name: 'Frost',    bg: '#eaf0fb', bg2: '#dfe4ff', glass: '#ffffff', text: '#141a2e', muted: '#4e5973', accent: '#4f46e5', accent2: '#0e7490', ok: '#15803d', err: '#c8203b' },
  midnight: { name: 'Midnight', bg: '#000000', bg2: '#07071a', glass: '#141418', text: '#f5f5f7', muted: '#a1a1aa', accent: '#3b9bff', accent2: '#7d7bff', ok: '#30d158', err: '#ff5a4f' },
  graphit:  { name: 'Graphit',  bg: '#f5f5f7', bg2: '#e4e4ec', glass: '#ffffff', text: '#1d1d1f', muted: '#5f5f66', accent: '#0066cc', accent2: '#6e56cf', ok: '#1f7a35', err: '#c8102e' },
  sunset:   { name: 'Sunset',   bg: '#190c14', bg2: '#3a1226', glass: '#2a1520', text: '#fff1ea', muted: '#d6aea5', accent: '#ff8a4c', accent2: '#ff4d8d', ok: '#7ee08a', err: '#ff6b6b' },
  ocean:    { name: 'Ocean',    bg: '#03121b', bg2: '#06324a', glass: '#0c2533', text: '#e6f7ff', muted: '#94bccb', accent: '#2dd4bf', accent2: '#38bdf8', ok: '#4ade80', err: '#fb7185' },
  neon:     { name: 'Neon',     bg: '#07070d', bg2: '#1a0a2e', glass: '#14142a', text: '#f0f0ff', muted: '#a5a5cc', accent: '#00e5ff', accent2: '#ff2bd6', ok: '#39ff88', err: '#ff5c7a' },
  lila:     { name: 'Lila',     bg: '#150e29', bg2: '#2e1758', glass: '#261d42', text: '#f2ecff', muted: '#bcb0d8', accent: '#c6a4ff', accent2: '#f0abfc', ok: '#62d68f', err: '#ff8f8f' },
  honig:    { name: 'Honig',    bg: '#2b2d31', bg2: '#1f2023', glass: '#35373b', text: '#ece8dc', muted: '#a3a4a8', accent: '#e2b714', accent2: '#f59e0b', ok: '#8bd17c', err: '#f2737f' },
  matcha:   { name: 'Matcha',   bg: '#edf2e4', bg2: '#d8e6c6', glass: '#fbfdf7', text: '#1f2a17', muted: '#4f5e43', accent: '#3f6b0c', accent2: '#9a5b07', ok: '#166534', err: '#b42318' },
  sakura:   { name: 'Sakura',   bg: '#fdeff4', bg2: '#f3ddf3', glass: '#ffffff', text: '#3a1f2b', muted: '#74505f', accent: '#c81e6a', accent2: '#9333ea', ok: '#15803d', err: '#b42318' },
  papier:   { name: 'Papier',   bg: '#f1e8d6', bg2: '#e6d6b8', glass: '#fffaf0', text: '#2e2418', muted: '#62523c', accent: '#94501a', accent2: '#8f5a0e', ok: '#2d6b1f', err: '#b0261c' },
};

/** Alte Design-IDs (vor dem Redesign) */
export const LEGACY = { light: 'frost', dark: 'aurora', black: 'midnight', beige: 'papier' };
export const SYSTEM = { light: 'frost', dark: 'aurora' };

export const FX_DEFAULTS = {
  blur: 24,        // px
  glass: 60,       // Deckkraft der Glasflächen in %
  radius: 18,      // px
  finger: 35,      // Stärke der Fingerfarben in %
  bg: 'aurora',    // 'aurora' | 'still' | 'gradient' | 'solid'
  caret: 'line',   // 'line' | 'under' | 'block' | 'box'
  smooth: true,    // weich gleitender Cursor
  font: 'mono',    // Schrift im Tippfeld
};
export const FX_RANGES = { blur: [0, 40], glass: [20, 100], radius: [0, 28], finger: [0, 70] };

export const FONTS = {
  mono: { name: 'Monospace', css: 'ui-monospace, "SF Mono", "Cascadia Mono", "JetBrains Mono", Menlo, Consolas, monospace' },
  sans: { name: 'Sans', css: 'system-ui, -apple-system, "SF Pro Text", "Segoe UI", Roboto, sans-serif' },
  rounded: { name: 'Rund', css: 'ui-rounded, "SF Pro Rounded", Nunito, "Varela Round", system-ui, sans-serif' },
  serif: { name: 'Serif', css: 'ui-serif, "New York", Georgia, Cambria, "Times New Roman", serif' },
};
export const BG_STYLES = { aurora: 'Aurora (animiert)', still: 'Aurora (still)', gradient: 'Verlauf', solid: 'Einfarbig' };
export const CARETS = { line: 'Strich', under: 'Unterstrich', block: 'Block', box: 'Rahmen' };

// ----- Farbhelfer -----
const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v) => typeof v === 'string' && HEX.test(v);

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (hex, a) => `rgba(${rgb(hex).join(', ')}, ${+a.toFixed(3)})`;

export function luminance(hex) {
  const [r, g, b] = rgb(hex).map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Mischfarbe (a über b mit Anteil t) als Hex */
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((c, i) => Math.round(c * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
}

export const isDark = (p) => luminance(p.bg) < 0.2;

/** Fehlende/ungültige Werte mit einer Basis auffüllen */
export function cleanPalette(p, base = PRESETS.aurora) {
  const out = {};
  for (const k of Object.keys(COLOR_KEYS)) out[k] = isHex(p?.[k]) ? p[k].toLowerCase() : base[k];
  return out;
}

export function cleanFx(fx = {}) {
  const out = { ...FX_DEFAULTS };
  for (const [k, [min, max]] of Object.entries(FX_RANGES)) {
    if (Number.isFinite(+fx[k])) out[k] = Math.min(max, Math.max(min, +fx[k]));
  }
  if (fx.bg in BG_STYLES) out.bg = fx.bg;
  if (fx.caret in CARETS) out.caret = fx.caret;
  if (fx.font in FONTS) out.font = fx.font;
  if (typeof fx.smooth === 'boolean') out.smooth = fx.smooth;
  return out;
}

/** Alle CSS-Variablen für eine Palette + Effekte */
export function deriveVars(pal, fx) {
  const p = cleanPalette(pal);
  const dark = isDark(p);
  const a = fx.glass / 100;
  const accentText = contrast('#ffffff', p.accent) >= contrast('#0b0b10', p.accent) ? '#ffffff' : '#0b0b10';
  return {
    '--bg': p.bg,
    '--bg2': p.bg2,
    '--text': p.text,
    '--muted': p.muted,
    '--accent': p.accent,
    '--accent2': p.accent2,
    '--accent-text': accentText,
    '--ok': p.ok,
    '--err': p.err,
    '--glass': rgba(p.glass, a),
    '--glass-2': rgba(p.glass, Math.min(1, a + 0.2)),
    '--glass-solid': mix(p.glass, p.bg, 0.85),
    '--line': rgba(p.text, dark ? 0.12 : 0.11),
    '--line-2': rgba(p.text, dark ? 0.22 : 0.2),
    '--hl': rgba('#ffffff', dark ? 0.08 : 0.75),
    '--shadow-c': dark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(30, 40, 90, 0.13)',
    '--key-bg': rgba(p.glass, Math.max(0.45, a * 0.9)),
    '--key-shadow': dark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(30, 40, 90, 0.2)',
    '--blur': `${fx.blur}px`,
    '--radius': `${fx.radius}px`,
    '--finger': `${fx.finger}%`,
    '--font-type': FONTS[fx.font].css,
    'color-scheme': dark ? 'dark' : 'light',
  };
}

/** Teilbarer Design-Code */
export function encodePalette(p) {
  return 'TENF-' + Object.keys(COLOR_KEYS).map((k) => p[k].slice(1)).join('-');
}
export function decodePalette(code) {
  const parts = String(code).trim().replace(/^TENF-/i, '').split(/[-\s,]+/).filter(Boolean);
  const keys = Object.keys(COLOR_KEYS);
  if (parts.length !== keys.length || !parts.every((h) => /^[0-9a-f]{6}$/i.test(h))) return null;
  return Object.fromEntries(keys.map((k, i) => [k, '#' + parts[i].toLowerCase()]));
}
