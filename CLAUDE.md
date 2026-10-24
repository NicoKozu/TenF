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
- Barrierearm (Kontraste ≥ 4,5:1, Tastaturbedienung, ARIA). Designs über `data-theme` auf `<html>`, Größen über CSS-Variablen; ein Inline-Skript im `<head>` setzt beides vor dem ersten Zeichnen.
- Kein Tracking, keine externen Datenübertragungen ohne Rückfrage.

## Struktur
```
index.html            Tabs: Lernen / Training / Verlauf / Einstellungen
css/style.css         Theme-Variablen, Fingerfarben, Layout
js/main.js            Einstieg: Tabs, Initialisierung
js/settings.js        Designs (System/Hell/Dunkel/Schwarz/Beige/Lila), Größen (--ui/--type/--kb-scale), Tastatur ausblenden
js/keyboard.js        Virtuelle Tastatur, Fingerzuordnung, Hervorhebung
js/lessons.js         Lektionen: Übersicht, Ansicht, Textgenerator, Tipp-Engine (stoppt bei Fehler)
js/lessons-data.js    Lektionsdefinitionen (id stabil, kind, keys, intro, words)
js/training.js        Trainingsmodus: Zufallswörter oder eigener Text, Tipp-Engine, Live-Werte, Session speichern
js/history.js         Verlauf: Kennzahlen, Diagramm, Schwachstellen/Heatmap, Tabelle, Export/Import
js/storage.js         Einstellungen, Sessions, Lektionsfortschritt, Export/Import
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
4. ✅ Lern-Lektionen (bestanden ab 90 % Genauigkeit; Fortschritt getrennt vom Verlauf)
5. ✅ Deployment GitHub Pages (automatisch bei jedem Push)
   - ✅ Einstellungen: 5 Designs + System, Größenregler, Training: Modus „Eigener Text“
6. Optional: Accounts/Sync via Supabase (dann Impressum + Datenschutz)
