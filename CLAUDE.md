# TenF – Zehnfinger-Trainer

Web-App zum Lernen und Trainieren des 10-Finger-Schreibens. Gehostet über GitHub Pages (Repo: NicoKozu/TenF, Branch `main`).

## Arbeitsweise
- Auf Deutsch antworten, knapp und tokeneffizient.
- Vor größeren Änderungen kurz den Plan nennen.
- Immer vom aktuellen Repo-Stand ausgehen, keine Annahmen über nicht vorhandene Dateien.
- Nach Änderungen committen und auf `main` pushen (sofern nicht anders gewünscht).
- Bei Code-Änderungen im Chat nur betroffene Dateien/Abschnitte zeigen.
- Warnen, wenn ein Chat lang/teuer wird, und einen neuen Chat empfehlen.

## Tech
- Reines HTML/CSS/JS (ES-Module), kein Build, keine Frameworks. Chart.js liegt lokal in `js/vendor/` (keine Anfrage an Dritte), wird erst im Verlauf-Tab geladen.
- Speicherung nur über `js/storage.js` (localStorage, Präfix `tenf:`) – später durch Backend austauschbar.
- Layout: deutsches QWERTZ (ISO). Tasten werden über `event.code` (physische Position) zugeordnet.
- Barrierearm (Kontraste, Tastaturbedienung, ARIA), Dark Mode (System + Umschalter).
- Kein Tracking, keine externen Datenübertragungen ohne Rückfrage.

## Struktur
```
index.html            Tabs: Lernen / Training / Verlauf
css/style.css         Theme-Variablen, Fingerfarben, Layout
js/main.js            Einstieg: Tabs, Theme, Initialisierung
js/keyboard.js        Virtuelle Tastatur, Fingerzuordnung, Hervorhebung
js/training.js        Trainingsmodus: Wortgenerator, Tipp-Engine, Live-Werte, Session speichern
js/history.js         Verlauf: Kennzahlen, Diagramm, Schwachstellen/Heatmap, Tabelle, Export/Import
js/storage.js         Einstellungen, Sessions, Export/Import
js/excel.js           Sessions ⇄ Excel (Spalten, Parsing), lazy geladen
js/xlsx.js            Minimaler XLSX-Writer/-Reader
js/vendor/            Chart.js 4 (UMD), fflate (ZIP) – beide MIT
data/wordlist-de.json Deutsche Wortliste
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
4. Lern-Lektionen
5. Deployment GitHub Pages
6. Optional: Accounts/Sync via Supabase (dann Impressum + Datenschutz)
