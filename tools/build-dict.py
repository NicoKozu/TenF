#!/usr/bin/env python3
"""Baut die Wortlisten in data/dict/ aus wissenschaftlichen Korpusdaten.

Häufigkeiten: FrequencyWords (OpenSubtitles 2018), Hermit Dave, CC BY-SA 4.0
  https://github.com/hermitdave/FrequencyWords
  Untertitel-Häufigkeiten bilden die Alltagssprache am besten ab (vgl. SUBTLEX-Studien,
  Brysbaert & New 2009; Brysbaert et al. 2011 für das Deutsche).
Hilfsmittel zum Prüfen (werden nicht mitgeliefert):
  - Hunspell-Wörterbücher (wooorm/dictionaries): nur korrekt geschriebene Wörter
  - german-nouns (gambolputty, aus Wiktionary): Substantive vs. Eigennamen
  - Universal Dependencies English EWT + GUM: erkennt englische Namen (mike, jack)
  - Universal Dependencies German GSD + HDT (ca. 3,5 Mio. Wörter): Groß-/Kleinschreibung
    im Satzinneren, entscheidet mehrdeutige Fälle wie schule/Schule

Aufruf (braucht Zugriff auf GitHub und `pip install spylls`):
    python3 tools/build-dict.py
Ergebnis: data/dict/<sprache>/top-100.json, top-1000.json, top-10000.json und data/dict/index.json
"""
import csv, json, pathlib, sys, tempfile, urllib.request

from spylls.hunspell import Dictionary

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'dict'
SIZES = [100, 1000, 10000]
RAW = 'https://raw.githubusercontent.com/'
SRC = {
    'freq': RAW + 'hermitdave/FrequencyWords/master/content/2018/{l}/{l}_50k.txt',
    'aff': RAW + 'wooorm/dictionaries/main/dictionaries/{l}/index.aff',
    'dic': RAW + 'wooorm/dictionaries/main/dictionaries/{l}/index.dic',
    'nouns': RAW + 'gambolputty/german-nouns/main/german_nouns/nouns.csv',
    'ud_en': [RAW + 'UniversalDependencies/' + f for f in (
        'UD_English-EWT/master/en_ewt-ud-train.conllu', 'UD_English-EWT/master/en_ewt-ud-dev.conllu',
        'UD_English-EWT/master/en_ewt-ud-test.conllu', 'UD_English-GUM/master/en_gum-ud-train.conllu')],
    'ud': [RAW + 'UniversalDependencies/' + f for f in (
        'UD_German-GSD/master/de_gsd-ud-train.conllu',
        'UD_German-HDT/master/de_hdt-ud-train-a-1.conllu', 'UD_German-HDT/master/de_hdt-ud-train-a-2.conllu',
        'UD_German-HDT/master/de_hdt-ud-train-b-1.conllu', 'UD_German-HDT/master/de_hdt-ud-train-b-2.conllu',
        'UD_German-HDT/master/de_hdt-ud-dev.conllu', 'UD_German-HDT/master/de_hdt-ud-test.conllu')],
}
LANGS = {'de': 'Deutsch', 'en': 'Englisch'}
CHARS = {'de': set('abcdefghijklmnopqrstuvwxyzäöüß'), 'en': set('abcdefghijklmnopqrstuvwxyz')}

# Vulgäres und Beleidigungen (Wortanfänge) – gehört nicht in ein Lernprogramm
BLOCK = {
    'de': ['scheiß', 'scheiss', 'arsch', 'fick', 'gefickt', 'verfickt', 'fotze', 'hure', 'nutte', 'wichs', 'schwuchtel',
           'schlampe', 'miststück', 'bastard', 'pisser', 'kacke', 'titten', 'neger', 'spast', 'missgeburt', 'penner',
           'bumsen', 'muschi', 'sex', 'porno', 'hitler', 'brüste', 'schwänze'],
    'en': ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'cock',
           'motherf', 'nigg', 'fag', 'retard', 'piss', 'bullshit', 'dumbass', 'jackass', 'goddam', 'twat', 'wank',
           'bollocks', 'tits', 'boob', 'porn', 'horny', 'sex', 'hooker', 'damn', 'crap'],
}
BLOCK_EXACT = {'de': set(), 'en': {'ass'}}

# Deutsch: feste Schreibung, wo Statistik nicht nötig ist (Pronomen, feste Wendungen)
DE_LOWER = set('''sie ihr ihre ihren ihrem ihrer ihres ihnen mal los leid recht unrecht nein ja hallo ach weg links rechts
schau null plus real rot blau grün gelb schwarz weiß matt reich irre übel heil fett prost weise deutsche deutschen weiße
arm arme armen wert tat stand ehe pass miss morgen abends morgens heute gestern spiel fürs fragen lügen wetten waschen
nachsehen benehmen opfern filmen rollen duschen verhungern befehlen morden büßen hupen frühstücken knien rennen beten
gründen grenzen aussagen gefahren gebissen schlief trank'''.split())

# Englisch: Bruchstücke von Kurzformen (don't → "don") und erlaubte Großschreibungen (keine Personennamen)
EN_FRAGMENTS = {'don', 'didn', 'doesn', 'isn', 'wasn', 'wouldn', 'couldn', 'aren', 'shouldn', 'weren', 'hasn',
                'hadn', 'mustn', 'needn', 'ain', 'll', 've', 're', 'em'}
EN_CAPS = set('''I Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July
August September October November December English American America British Britain England French France German
Germany Spanish Spain Italian Italy Chinese China Japanese Japan Russian Russia Mexican Mexico Canadian Canada Indian
India European Europe African Africa Asian Asia Australia Christmas Easter Internet'''.split())


def fetch(url, dest):
    if not dest.exists():
        print('lade', url)
        urllib.request.urlretrieve(url, dest)
    return dest


def blocked(lang, w):
    lw = w.lower()
    return lw in BLOCK_EXACT[lang] or any(lw.startswith(p) for p in BLOCK[lang])


def german_nouns(tmp):
    """Alle Formen gewöhnlicher Substantive + Lemmata von Eigennamen (Wiktionary)."""
    path = fetch(SRC['nouns'], tmp / 'nouns.csv')
    forms, names = set(), set()
    with open(path, encoding='utf-8') as f:
        r = csv.reader(f)
        head = next(r)
        cols = [i for i, h in enumerate(head) if h.startswith(('nominativ', 'genitiv', 'dativ', 'akkusativ'))]
        for row in r:
            pos = set(row[1].split(','))
            if pos & {'Vorname', 'Nachname', 'Toponym', 'Eigenname'}:
                names.add(row[0])
            elif pos == {'Substantiv'}:
                forms.update(row[i] for i in cols if row[i])
    return forms, names - forms  # z. B. „Zeit“ ist auch Nachname, aber vor allem Substantiv


def ud_case_counts(tmp, key='ud'):
    """Wie oft steht ein Wort in den UD-Baumbanken im Satzinneren klein bzw. groß?"""
    lower, upper = {}, {}
    for url in SRC[key]:
        path = fetch(url, tmp / url.rsplit('/', 1)[1])
        first = True
        for line in open(path, encoding='utf-8'):
            if not line.strip():
                first = True
                continue
            if line[0] == '#':
                continue
            cols = line.split('\t')
            if '-' in cols[0] or '.' in cols[0]:
                continue
            form = cols[1]
            if not first and form[:1].isalpha():
                bucket = upper if form[0].isupper() else lower
                key = form.lower()
                bucket[key] = bucket.get(key, 0) + 1
            first = form in ('.', '!', '?', ':', '"', '„')
    return lower, upper


def related_forms(w):
    """Verb- und Adjektivformen, die zur Kleinschreibung von w passen würden."""
    stems = {w[:-2] if w.endswith('en') else w[:-1] if w.endswith('e') else w}
    for end in ('es', 'er', 'em', 'en', 'e'):
        if w.endswith(end) and len(w) > len(end) + 2:
            stems.add(w[:-len(end)])
    forms = set()
    for s in stems:
        forms |= {s + 'st', s + 'est', s + 't', s + 'et', s + 'te', s + 'ten', 'ge' + s + 't', s + 'end',
                  s, s + 'e', s + 'er', s + 'es', s + 'em', s + 'en'}
    forms.discard(w)
    return forms


def prefer_noun(w, freqs, nouns, d, ud):
    """Ist die großgeschriebene (Substantiv-)Lesart häufiger?"""
    lo, up = ud[0].get(w, 0), ud[1].get(w, 0)
    if lo + up >= 3:
        # Klare Mehrheit nötig – bei -en (Verb-Infinitiv vs. Plural) besonders deutlich
        return up > (4 if w.endswith(('en', 'ern', 'eln')) else 2) * lo
    # Ohne Belege: -en meist Verb; sonst Verb-/Adjektivformen desselben Stamms im Untertitel-Korpus zählen
    if w.endswith('en'):
        return False
    other = sum(freqs[f] for f in related_forms(w)
                if f in freqs and (f[0].upper() + f[1:]) not in nouns and d.lookup(f))
    return other < 0.5 * freqs.get(w, 1)


def build(lang, tmp):
    fetch(SRC['aff'].format(l=lang), tmp / f'{lang}.aff')
    fetch(SRC['dic'].format(l=lang), tmp / f'{lang}.dic')
    d = Dictionary.from_files(str(tmp / lang))
    freq = fetch(SRC['freq'].format(l=lang), tmp / f'{lang}_50k.txt')
    nouns, names = german_nouns(tmp) if lang == 'de' else (set(), set())
    ud = ud_case_counts(tmp, 'ud' if lang == 'de' else 'ud_en')
    freqs = {}
    for line in open(freq, encoding='utf-8'):
        a, n = line.split()
        freqs.setdefault(a, int(n))

    words, seen = [], set()
    for w in freqs:
        if not set(w) <= CHARS[lang]:
            continue  # Ziffern, Bindestriche, Apostrophe, fremde Zeichen
        if len(w) == 1 and not (lang == 'en' and w in 'ai'):
            continue
        if lang == 'en' and w in EN_FRAGMENTS:
            continue
        cap = w[0].upper() + w[1:]
        if lang == 'en' and w == 'i':
            word = 'I'
        elif lang == 'de' and w in DE_LOWER:
            word = w
        elif d.lookup(w):
            word = w
            if lang == 'en' and cap not in EN_CAPS and ud[1].get(w, 0) > 2 * ud[0].get(w, 0) + 1:
                continue  # meist großgeschrieben = Name (mike, jack, frank)
            if lang == 'de' and cap in nouns and cap not in names and prefer_noun(w, freqs, nouns, d, ud):
                word = cap  # z. B. schule → Schule
        elif d.lookup(cap):
            if lang == 'de' and (cap not in nouns or cap in names):
                continue  # Eigenname oder unbekannt
            if lang == 'en' and cap not in EN_CAPS:
                continue  # Personen- und Ortsnamen
            word = cap
        else:
            continue  # kein gültiges Wort (Tippfehler, Umgangssprache, Lautmalerei)
        if word in seen or blocked(lang, word):
            continue
        seen.add(word)
        words.append(word)
        if len(words) >= SIZES[-1]:
            break
    return words


def main():
    tmp = pathlib.Path(tempfile.gettempdir()) / 'tenf-dict'
    tmp.mkdir(exist_ok=True)
    index = {'source': 'FrequencyWords (OpenSubtitles 2018) von Hermit Dave',
             'sourceUrl': 'https://github.com/hermitdave/FrequencyWords',
             'license': 'CC BY-SA 4.0', 'languages': {}}
    for lang, name in LANGS.items():
        words = build(lang, tmp)
        if len(words) < SIZES[-1]:
            sys.exit(f'{lang}: nur {len(words)} Wörter')
        (OUT / lang).mkdir(parents=True, exist_ok=True)
        lists = {}
        for n in SIZES:
            file = f'{lang}/top-{n}.json'
            data = {'language': lang, 'name': f'{name} – Top {n:,}'.replace(',', '.'), 'size': n,
                    'source': index['source'], 'license': index['license'], 'words': words[:n]}
            (OUT / file).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
            lists[str(n)] = file
        index['languages'][lang] = {'name': name, 'lists': lists}
        print(lang, 'ok –', ' '.join(words[:30]))
    (OUT / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
