# Wörterbuch (Wortlisten)

Die häufigsten Wörter je Sprache, sortiert nach Häufigkeit. Jede Datei enthält `words` (Array) plus Metadaten.

| Datei | Inhalt |
|---|---|
| `de/top-100.json`, `de/top-1000.json`, `de/top-10000.json` | Deutsch |
| `en/top-100.json`, `en/top-1000.json`, `en/top-10000.json` | Englisch |
| `index.json` | Übersicht aller Sprachen und Listen |

Neue Sprache: in `tools/build-dict.py` unter `LANGS` ergänzen, Skript ausführen, in `js/wordlists.js` eintragen.

## Quelle
Häufigkeiten aus **FrequencyWords** (OpenSubtitles 2018) von Hermit Dave –
https://github.com/hermitdave/FrequencyWords – Lizenz **CC BY-SA 4.0**.
Die Listen in diesem Ordner sind eine Bearbeitung davon und stehen ebenfalls unter CC BY-SA 4.0.

Untertitel-Korpora bilden die gesprochene Alltagssprache gut ab. Laut den SUBTLEX-Studien
(Brysbaert & New 2009; für das Deutsche Brysbaert et al. 2011) sagen ihre Häufigkeiten die
Vertrautheit von Wörtern besser vorher als Buch- oder Zeitungskorpora.

## Methode (`tools/build-dict.py`)
1. Wörter in Häufigkeitsreihenfolge aus der 50.000er-Liste lesen.
2. Nur Buchstaben der jeweiligen Sprache (keine Ziffern, Bindestriche, Apostrophe).
3. Rechtschreibprüfung mit Hunspell (wooorm/dictionaries): Tippfehler, Umgangssprache und alte Rechtschreibung fallen raus.
4. Deutsch – Großschreibung:
   - Substantiv vs. Eigenname über die Wiktionary-Substantivliste (gambolputty/german-nouns).
   - Mehrdeutige Fälle (schule/Schule, frage/Frage) entscheidet die Groß-/Kleinschreibung im Satzinneren
     der Universal-Dependencies-Baumbanken German GSD + HDT (ca. 3,5 Mio. Wörter).
5. Englisch: Namen (mike, jack) über die UD-Baumbanken English EWT + GUM erkannt und entfernt;
   Wochentage, Monate, Sprachen/Länder bleiben großgeschrieben, „I“ ebenso.
6. Vulgäre Wörter und Beleidigungen werden entfernt.
7. Die ersten 100 / 1.000 / 10.000 verbleibenden Wörter bilden die Listen.

Die Prüf-Hilfsmittel (Hunspell, Wiktionary, UD) werden nur zum Filtern genutzt und nicht mitgeliefert.
