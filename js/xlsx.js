// Minimaler XLSX-Writer/-Reader (Office Open XML) auf Basis von fflate.
// Genug für einfache Tabellen: Text, Zahl, Datum, fixierte Kopfzeile, Filter, Spaltenbreiten.
import { zipSync, unzipSync, strToU8, strFromU8 } from './vendor/fflate.min.js';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Stil-Indizes für Zellen (siehe styles.xml unten). */
export const STYLE = { text: 0, header: 1, date: 2, dec1: 3, int: 4, pct: 5, wrap: 6, title: 7 };

const esc = (s) => String(s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function colName(i) {
  let s = '';
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

function colIndex(ref) {
  let n = 0;
  for (const ch of ref.replace(/[^A-Z]/gi, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

/** Date → Excel-Seriennummer (lokale Zeit, Excel kennt keine Zeitzonen). */
export function toSerial(date) {
  return (date.getTime() - date.getTimezoneOffset() * 60000) / 864e5 + 25569;
}

/** Excel-Seriennummer → Date (lokale Zeit). */
export function fromSerial(n) {
  const utc = Math.round((n - 25569) * 864e5);
  const d = new Date(utc);
  return new Date(utc + d.getTimezoneOffset() * 60000);
}

// ----- Schreiben -----
function cellXml(ref, cell) {
  if (cell == null || cell === '') return '';
  const c = typeof cell === 'object' && !(cell instanceof Date) ? cell : { v: cell };
  let { v } = c;
  const s = c.s ?? (v instanceof Date ? STYLE.date : STYLE.text);
  const sa = s ? ` s="${s}"` : '';
  if (v instanceof Date) v = toSerial(v);
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${sa}><v>${v}</v></c>`;
  return `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function sheetXml({ rows, widths = [], freeze = false, filter = false }) {
  const nCols = Math.max(1, ...rows.map((r) => r.length));
  const view = freeze
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const cols = widths.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const data = rows.map((r, ri) =>
    `<row r="${ri + 1}">${r.map((c, ci) => cellXml(colName(ci) + (ri + 1), c)).join('')}</row>`).join('');
  const af = filter && rows.length ? `<autoFilter ref="A1:${colName(nCols - 1)}${rows.length}"/>` : '';
  return `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}">${view}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${data}</sheetData>${af}</worksheet>`;
}

const STYLES_XML = `${XML}<styleSheet xmlns="${NS}">
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd.mm.yyyy hh:mm"/><numFmt numFmtId="165" formatCode="0.0"/><numFmt numFmtId="166" formatCode="0.0&quot; %&quot;"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F7"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF7F8FA6"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/**
 * Erzeugt eine .xlsx-Datei.
 * @param {{name:string, rows:any[][], widths?:number[], freeze?:boolean, filter?:boolean}[]} sheets
 * @returns {Uint8Array}
 */
export function writeXlsx(sheets) {
  const files = {};
  const ov = sheets.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  files['[Content_Types].xml'] = strToU8(`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + `${ov}</Types>`);
  files['_rels/.rels'] = strToU8(`${XML}<Relationships xmlns="${NS_PR}">`
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>');

  const names = sheets.map((s, i) => {
    const n = esc(s.name.replace(/[\\/?*[\]:]/g, '').slice(0, 31));
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s));
    return n;
  });
  const defined = sheets.map((s, i) => {
    if (!s.filter || !s.rows.length) return '';
    const nCols = Math.max(...s.rows.map((r) => r.length));
    return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${names[i]}'!$A$1:$${colName(nCols - 1)}$${s.rows.length}</definedName>`;
  }).join('');
  files['xl/workbook.xml'] = strToU8(`${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>`
    + names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
    + `</sheets>${defined ? `<definedNames>${defined}</definedNames>` : ''}</workbook>`);
  files['xl/_rels/workbook.xml.rels'] = strToU8(`${XML}<Relationships xmlns="${NS_PR}">`
    + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + '</Relationships>');
  files['xl/styles.xml'] = strToU8(STYLES_XML);
  return zipSync(files, { level: 6 });
}

// ----- Lesen -----
const parse = (s) => new DOMParser().parseFromString(s, 'application/xml');
const tags = (node, name) => [...node.getElementsByTagNameNS('*', name)];
const text = (node) => tags(node, 't').map((t) => t.textContent).join('');

function resolve(base, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const p of target.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  }
  return parts.join('/');
}

/**
 * Liest ein Tabellenblatt einer .xlsx-Datei als Zeilen-Array.
 * Zahlen bleiben Zahlen (Datumswerte als Seriennummer), Text als String.
 * @param {ArrayBuffer|Uint8Array} buf
 * @param {string} [prefer] bevorzugter Blattname, sonst erstes Blatt
 * @returns {{name:string, rows:(string|number|boolean|null)[][]}}
 */
export function readXlsx(buf, prefer) {
  let zip;
  try {
    zip = unzipSync(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  } catch {
    throw new Error('Datei ist keine gültige Excel-Datei (.xlsx).');
  }
  const get = (p) => (zip[p] ? strFromU8(zip[p]) : null);
  const wbXml = get('xl/workbook.xml');
  if (!wbXml) throw new Error('Datei ist keine gültige Excel-Datei (.xlsx).');

  const wb = parse(wbXml);
  const rels = parse(get('xl/_rels/workbook.xml.rels') ?? '<Relationships/>');
  const relMap = new Map(tags(rels, 'Relationship').map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]));
  const sheets = tags(wb, 'sheet').map((s) => ({
    name: s.getAttribute('name'),
    path: resolve('xl/workbook.xml', relMap.get(s.getAttributeNS(NS_R, 'id') || s.getAttribute('r:id')) ?? ''),
  }));
  const sheet = sheets.find((s) => s.name === prefer) ?? sheets[0];
  const sheetXmlStr = sheet && get(sheet.path);
  if (!sheetXmlStr) throw new Error('Kein Tabellenblatt gefunden.');

  const sstXml = get('xl/sharedStrings.xml');
  const shared = sstXml ? tags(parse(sstXml), 'si').map(text) : [];

  const rows = [];
  for (const row of tags(parse(sheetXmlStr), 'row')) {
    const ri = Number(row.getAttribute('r')) - 1;
    const out = [];
    let ci = 0;
    for (const c of tags(row, 'c')) {
      const ref = c.getAttribute('r');
      if (ref) ci = colIndex(ref);
      const t = c.getAttribute('t');
      const v = tags(c, 'v')[0]?.textContent ?? null;
      let val = null;
      if (t === 's') val = shared[Number(v)] ?? '';
      else if (t === 'inlineStr') val = text(c);
      else if (t === 'str') val = v ?? '';
      else if (t === 'b') val = v === '1';
      else if (t === 'e') val = null;
      else if (v != null && v !== '') val = Number(v);
      out[ci++] = val;
    }
    rows[Number.isFinite(ri) && ri >= 0 ? ri : rows.length] = out;
  }
  return { name: sheet.name, rows: Array.from(rows, (r) => r ?? []) };
}
