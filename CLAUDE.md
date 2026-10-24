# TenF – Zehnfinger-Trainer

Web-App zum Lernen und Trainieren des 10-Finger-Schreibens. Gehostet über GitHub Pages (Repo: NicoKozu/TenF, Branch `main`).

## Arbeitsweise
- Auf Deutsch antworten, knapp und tokeneffizient.
- Vor größeren Änderungen kurz den Plan nennen.
- Immer vom aktuellen Repo-Stand ausgehen, keine Annahmen über nicht vorhandene Dateien.
- Nach Änderungen committen und auf `main` pushen (sofern nicht anders gewünscht).
- **Vor jedem Commit mit CSS/JS-Änderungen `python3 tools/bump-version.py` ausführen** (Cache-Busting: Import-Map + `?v=` in index.html, sonst mischen Browser alte und neue Dateien). Neue Module in `js/` werden automatisch aufgenommen.
- Bei Code-Änderungen im Chat nur betroffene Dateien/Abschnitte zeigen.
- Warnen, wenn ein Chat lang/teuer wird, und einen neuen Chat empfehlen.

## Tech
- Reines HTML/CSS/JS (ES-Module), kein Build, keine Frameworks. Chart.js liegt lokal in `js/vendor/` (keine Anfrage an Dritte), wird erst im Verlauf-Tab geladen.
- Speicherung nur über `js/storage.js` (localStorage, Präfix `tenf:`) – später durch Backend austauschbar.
- Layout: deutsches QWERTZ (ISO). Tasten werden über `event.code` (physische Position) zugeordnet.
- Barrierearm (Kontraste ≥ 4,5:1, Tastaturbedienung, ARIA). Design = Palette (9 Farben) + Effekte → `deriveVars()` in `js/themes.js` erzeugt alle CSS-Variablen, die inline auf `<html>` gesetzt und als `settings.cache` (hell/dunkel) gespeichert werden; das Inline-Skript im `<head>` wendet den Cache vor dem ersten Zeichnen an. Glas-Look über `--glass`/`--blur`, Hintergrund-Stil über `data-bg`, Cursor über `data-caret`/`data-smooth`.
- Kein Tracking, keine externen Datenübertragungen ohne Rückfrage.

## Struktur
```
index.html            Tabs: Lernen / Training / Verlauf / Einstellungen
css/style.css         Glas-Design: Startwerte der Variablen, Aurora-Hintergrund, Fingerfarben (color-mix mit --finger), Layout
js/main.js            Einstieg: Tabs, Initialisierung
js/themes.js          12 Vorlagen, Effekt-Defaults, Farbhelfer/Kontrast, deriveVars, Design-Code (TENF-…)
js/settings.js        Design-Auswahl, Farbeditor (Eigenes), Zufallsfarben, Effekte, Größen (--ui/--type/--kb-scale, Inhaltsbreite --page-w → --page-max gilt für Kopfzeile + main), Tastatur ausblenden
js/caret.js           Weich gleitender Cursor (beobachtet .ch.cur)
js/keyboard.js        Virtuelle Tastatur, Fingerzuordnung, Hervorhebung
js/lessons.js         Lektionen: Übersicht, Ansicht, Textgenerator, Tipp-Engine (stoppt bei Fehler)
js/lessons-data.js    Lektionsdefinitionen (id stabil, kind, keys, intro, words)
js/training.js        Trainingsmodus: Wortliste oder eigener Text, Länge (Zeit/Wörter/eigene), Tipp-Engine, Live-Werte, Session speichern
js/wordlists.js       Wortlisten-Katalog (de/en × 100/1k/10k), Laden mit Cache, Längen-Beschriftung
js/history.js         Verlauf: Kennzahlen, Diagramm, Schwachstellen/Heatmap, Tabelle, Export/Import
js/storage.js         Einstellungen, Sessions, Lektionsfortschritt, Export/Import
js/excel.js           Sessions ⇄ Excel (Spalten, Parsing), lazy geladen
js/xlsx.js            Minimaler XLSX-Writer/-Reader
js/vendor/            Chart.js 4 (UMD), fflate (ZIP) – beide MIT
data/wordlist-de.json Kuratierte Startliste (nur noch für Lektionen)
data/dict/            Wörterbuch: <sprache>/top-100|1000|10000.json + index.json + README (Quelle, Methode, Lizenz)
tools/bump-version.py Version für Cache-Busting setzen (vor jedem Commit)
tools/build-dict.py   Baut data/dict/ neu (OpenSubtitles-Häufigkeiten + Hunspell + Wiktionary + UD-Baumbanken; braucht `pip install spylls`)
```

## Kennzahlen
- WPM = (korrekte Zeichen / 5) / Minuten
- Genauigkeit = korrekte Anschläge / alle Anschläge

## Lokal testen
ES-Module laufen nicht über `file://`. Im Repo-Ordner: `python -m http.server 8000` → http://localhost:8000

## Roadmap
1. ✅ Grundgerüst + Tabs + virtuelle Tastatur
2. ✅ Trainingsmodus mit Wortliste und Live-Auswertung
3. ✅ Verlauf mit localStorage + Diagramm
4. ✅ Lern-Lektionen (bestanden ab 90 % Genauigkeit; Fortschritt getrennt vom Verlauf)
5. ✅ Deployment GitHub Pages (automatisch bei jedem Push)
   - ✅ Einstellungen: 5 Designs + System, Größenregler, Training: Modus „Eigener Text“
   - ✅ Wörterbuch DE/EN (Top 100/1k/10k), Fokus/Finger entfernt, eigene Länge
   - ✅ Redesign: Glas-Look, 12 Vorlagen + eigene Farben, Effekte, gleitender Cursor, Fokus-Modus
6. Optional: Accounts/Sync via Supabase (dann Impressum + Datenschutz)
