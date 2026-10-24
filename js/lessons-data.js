// Lektionsdefinitionen. Reihenfolge = Lernreihenfolge; `id` bleibt stabil (Fortschritt hängt daran).
// kind: 'letters' (neue Tasten, kumulativ) | 'shift' | 'umlaut' | 'numbers' | 'punct'
// keys: neu eingeführte Zeichen; words: zusätzliche Wörter (falls die Wortliste wenig passendes hat).

export const GROUPS = {
  home: 'Grundreihe',
  top: 'Obere Reihe',
  bottom: 'Untere Reihe',
  shift: 'Großschreibung',
  umlaut: 'Umlaute & ß',
  numbers: 'Zahlen',
  punct: 'Satzzeichen',
};

export const LESSONS = [
  {
    id: 'fj', group: 'home', kind: 'letters', keys: 'fj',
    title: 'F und J – die Zeigefinger',
    intro: 'Leg die Zeigefinger auf F und J – du spürst die kleinen Erhebungen. Die übrigen Finger liegen daneben auf A S D und K L Ö, die Daumen auf der Leertaste. Tippe locker, ohne auf die Tastatur zu schauen.',
  },
  {
    id: 'dk', group: 'home', kind: 'letters', keys: 'dk',
    title: 'D und K – die Mittelfinger',
    intro: 'Die Mittelfinger liegen auf D und K, direkt neben den Zeigefingern. Nach jedem Anschlag kehrt der Finger in die Grundstellung zurück.',
  },
  {
    id: 'sl', group: 'home', kind: 'letters', keys: 'sl',
    title: 'S und L – die Ringfinger',
    intro: 'Die Ringfinger liegen auf S und L. Bewege nur den Finger, der gerade dran ist – die Hand bleibt ruhig.',
  },
  {
    id: 'aoe', group: 'home', kind: 'letters', keys: 'aö',
    title: 'A und Ö – die kleinen Finger',
    intro: 'Die kleinen Finger liegen auf A und Ö. Damit ist die Grundstellung komplett: asdf – jklö.',
    words: ['ja', 'da', 'das', 'dass', 'als', 'all', 'fall', 'falls', 'lass', 'fass', 'saal', 'skala', 'kalk', 'öl'],
  },
  {
    id: 'gh', group: 'home', kind: 'letters', keys: 'gh',
    title: 'G und H – Zeigefinger zur Mitte',
    intro: 'G und H liegen zwischen den Händen. Der Zeigefinger streckt sich kurz zur Seite und springt sofort zurück auf F bzw. J.',
    words: ['ja', 'da', 'ah', 'das', 'als', 'lag', 'sag', 'gas', 'glas', 'hals', 'kahl', 'hass', 'hall', 'jagd', 'fall', 'lass'],
  },
  {
    id: 'ae', group: 'home', kind: 'letters', keys: 'ä', drillWith: 'öl',
    title: 'Ä – rechter kleiner Finger',
    intro: 'Für Ä streckt sich der rechte kleine Finger von Ö eine Taste nach rechts. Danach zurück auf Ö.',
    words: ['jäh', 'fäll', 'das', 'glas', 'hals', 'lag', 'kahl', 'gas', 'dass', 'lass', 'fall', 'sag'],
  },
  {
    id: 'ei', group: 'top', kind: 'letters', keys: 'ei',
    title: 'E und I – Mittelfinger nach oben',
    intro: 'Jetzt geht es in die obere Reihe. Der linke Mittelfinger tippt E, der rechte Mittelfinger I – jeweils schräg nach oben links und zurück.',
    words: ['die', 'sie', 'eis', 'ei', 'lied', 'leise', 'feige', 'geige', 'seele', 'idee', 'kiel', 'seide', 'eile', 'elf', 'alle', 'halle', 'esel', 'ideal', 'heil', 'seil', 'keil'],
  },
  {
    id: 'ru', group: 'top', kind: 'letters', keys: 'ru',
    title: 'R und U – Zeigefinger nach oben',
    intro: 'R tippt der linke Zeigefinger, U der rechte – beide eine Reihe über F und J.',
    words: ['rad', 'ruhe', 'uhr', 'haus', 'ruf', 'grau', 'frau', 'dir', 'der', 'ihr', 'hier', 'kurs', 'lauf', 'kauf', 'drei', 'frei', 'ruder', 'erde', 'feuer', 'eure'],
  },
  {
    id: 'tz', group: 'top', kind: 'letters', keys: 'tz',
    title: 'T und Z – Zeigefinger schräg zur Mitte',
    intro: 'T und Z liegen oben in der Mitte. Achtung: Auf der deutschen Tastatur ist Z oben (rechter Zeigefinger), nicht unten.',
  },
  {
    id: 'wo', group: 'top', kind: 'letters', keys: 'wo',
    title: 'W und O – Ringfinger nach oben',
    intro: 'W tippt der linke Ringfinger, O der rechte. Die Zeigefinger bleiben dabei auf F und J liegen.',
  },
  {
    id: 'qpue', group: 'top', kind: 'letters', keys: 'qpü',
    title: 'Q, P und Ü – kleine Finger nach oben',
    intro: 'Die kleinen Finger übernehmen Q (links) sowie P und Ü (rechts). Ü liegt rechts neben P.',
  },
  {
    id: 'vn', group: 'bottom', kind: 'letters', keys: 'vn',
    title: 'V und N – Zeigefinger nach unten',
    intro: 'Weiter in die untere Reihe: V tippt der linke Zeigefinger, N der rechte – jeweils schräg nach unten.',
  },
  {
    id: 'bm', group: 'bottom', kind: 'letters', keys: 'bm',
    title: 'B und M – Zeigefinger nach unten',
    intro: 'B liegt neben V (linker Zeigefinger), M neben N (rechter Zeigefinger).',
  },
  {
    id: 'ccomma', group: 'bottom', kind: 'letters', keys: 'c,',
    title: 'C und Komma – Mittelfinger nach unten',
    intro: 'C tippt der linke Mittelfinger, das Komma der rechte – beide eine Reihe unter D und K.',
  },
  {
    id: 'xdot', group: 'bottom', kind: 'letters', keys: 'x.',
    title: 'X und Punkt – Ringfinger nach unten',
    intro: 'X tippt der linke Ringfinger, den Punkt der rechte.',
  },
  {
    id: 'ydash', group: 'bottom', kind: 'letters', keys: 'y-',
    title: 'Y und Bindestrich – kleine Finger nach unten',
    intro: 'Y liegt auf der deutschen Tastatur unten links (linker kleiner Finger). Den Bindestrich tippt der rechte kleine Finger.',
  },
  {
    id: 'shift', group: 'shift', kind: 'shift', keys: '',
    title: 'Großbuchstaben mit Umschalt',
    intro: 'Für Großbuchstaben hält der kleine Finger der anderen Hand die Umschalttaste: Buchstaben der linken Hand mit Umschalt rechts, Buchstaben der rechten Hand mit Umschalt links. Erst Umschalt drücken, dann die Taste.',
  },
  {
    id: 'umlaut', group: 'umlaut', kind: 'umlaut', keys: 'ßÄÖÜ',
    title: 'ß und große Umlaute',
    intro: 'ß liegt oben rechts neben der 0 (rechter kleiner Finger). Ä, Ö und Ü groß: Umschalt links halten, rechter kleiner Finger tippt.',
    words: ['Straße', 'Fuß', 'groß', 'weiß', 'Spaß', 'heiß', 'süß', 'Größe', 'Füße', 'Ärger', 'Öl', 'Übung', 'Ähre', 'Bär', 'Tür', 'schön', 'müde', 'Mädchen', 'hören', 'Brücke', 'Schlüssel', 'Äpfel', 'Österreich', 'Übermut'],
  },
  {
    id: 'num1', group: 'numbers', kind: 'numbers', keys: '12345',
    title: 'Zahlen 1 bis 5 – linke Hand',
    intro: 'Die Zahlenreihe erreichst du mit einem weiten Griff nach oben. 1 tippt der kleine Finger, 2 der Ringfinger, 3 der Mittelfinger, 4 und 5 der Zeigefinger – danach zurück zur Grundstellung.',
  },
  {
    id: 'num2', group: 'numbers', kind: 'numbers', keys: '67890',
    title: 'Zahlen 6 bis 0 – rechte Hand',
    intro: '6 und 7 tippt der rechte Zeigefinger, 8 der Mittelfinger, 9 der Ringfinger und 0 der kleine Finger.',
  },
  {
    id: 'punct', group: 'punct', kind: 'punct', keys: '?!:;"()',
    title: 'Satzzeichen mit Umschalt',
    intro: 'Viele Satzzeichen liegen mit Umschalt auf anderen Tasten: ? auf ß, ! auf 1, " auf 2, ( und ) auf 8 und 9, : auf dem Punkt, ; auf dem Komma.',
    sentences: [
      'Wie geht es dir? Mir geht es gut!',
      'Komm bitte schnell, wir warten.',
      'Er sagt: "Heute regnet es."',
      'Das ist (fast) fertig!',
      'Ja, nein, vielleicht?',
      'Wo ist der Schlüssel? Hier!',
      'Wir lernen; du übst.',
      'Achtung: Glatteis!',
      'Hast du Zeit? Ja, gern.',
      'Sie fragt: "Kommst du mit?"',
      'Der Kuchen (mit Sahne) ist lecker.',
      'Los geht es: drei, zwei, eins!',
    ],
  },
];
