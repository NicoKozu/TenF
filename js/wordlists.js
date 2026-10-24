// Wortlisten aus data/dict/ (häufigste Wörter je Sprache). Werden erst bei Bedarf geladen.

const LANGS = { de: 'Deutsch', en: 'Englisch' };
const SIZES = [100, 1000, 10000];
const fmt = (n) => n.toLocaleString('de-DE');

/** { 'de-1000': { lang, size, name, file } } */
export const LISTS = Object.fromEntries(
  Object.entries(LANGS).flatMap(([lang, name]) => SIZES.map((size) => [`${lang}-${size}`, {
    lang, size, name: `${name} – Top ${fmt(size)}`, file: `data/dict/${lang}/top-${size}.json`,
  }])),
);
export const DEFAULT_LIST = 'de-1000';
export const LANG_NAMES = LANGS;

const cache = new Map();

/** Lädt eine Liste (gecacht). Liefert ein Array von Wörtern. */
export function loadList(id) {
  const list = LISTS[id] ?? LISTS[DEFAULT_LIST];
  if (!cache.has(list.file)) {
    cache.set(list.file, fetch(list.file)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((d) => d.words ?? [])
      .catch((e) => { cache.delete(list.file); throw e; }));
  }
  return cache.get(list.file);
}

export const listName = (id) => LISTS[id]?.name ?? '';

/** Länge als Text: t90 → „1:30 Min“, t45 → „45 s“, w50 → „50 Wörter“ */
export function lengthLabel(l = '') {
  if (l === 'full') return 'Ganzer Text';
  const n = Number(String(l).slice(1));
  if (!Number.isFinite(n)) return '';
  if (l[0] === 'w') return `${n} Wörter`;
  if (l[0] !== 't') return '';
  if (n < 60) return `${n} s`;
  return n % 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')} Min` : `${n / 60} Min`;
}
