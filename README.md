# TenF – Zehnfinger-Trainer

10-Finger-Schreiben von Null lernen und trainieren – im Browser, ohne Anmeldung, ohne Tracking.
Deutsches QWERTZ-Layout, Daten bleiben lokal (localStorage).

## Lokal starten
```bash
python -m http.server 8000
```
Dann http://localhost:8000 öffnen (ES-Module funktionieren nicht über `file://`).

## Stand
- ✅ Grundgerüst, Tabs, virtuelle Tastatur mit Fingerfarben, Dark Mode
- ✅ Training mit Live-Auswertung, Verlauf/Statistik mit Diagramm und Export
- ✅ 21 aufbauende Lektionen (Grundreihe → Satzzeichen) mit Fortschritt
- ⏳ Deployment über GitHub Pages
