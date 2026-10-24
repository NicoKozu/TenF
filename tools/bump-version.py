#!/usr/bin/env python3
"""Cache-Busting: setzt eine neue Version für CSS und alle JS-Module in index.html.

Aufruf im Repo-Ordner vor jedem Commit mit CSS/JS-Änderungen:
    python3 tools/bump-version.py
Schreibt eine Import-Map (alle Module in js/, ohne vendor/) und ?v=… an style.css und main.js,
damit Browser nach einem Update nicht alte Dateien aus dem Cache mischen.
"""
import pathlib, re, time

root = pathlib.Path(__file__).resolve().parent.parent
html = root / 'index.html'
v = time.strftime('%Y%m%d%H%M%S')
mods = sorted(p.name for p in (root / 'js').glob('*.js'))
entries = ',\n'.join(f'      "./js/{m}": "./js/{m}?v={v}"' for m in mods)
imap = ('  <script type="importmap">\n  {\n    "imports": {\n' + entries + '\n    }\n  }\n  </script>\n')

t = html.read_text(encoding='utf-8')
t = re.sub(r'  <script type="importmap">.*?</script>\n', '', t, flags=re.S)
t = re.sub(r'href="css/style\.css(\?v=\w+)?"', f'href="css/style.css?v={v}"', t)
t = re.sub(r'  <script type="module" src="js/main\.js(\?v=\w+)?"></script>',
           imap + f'  <script type="module" src="js/main.js?v={v}"></script>', t)
html.write_text(t, encoding='utf-8')
print('Version', v, '–', len(mods), 'Module')
