// Tabla PM: exportar e importar CSV, copiar para Excel y plantillas. Funciones puras.
import { allStates, cellText, COLOR_KEYS, numValue, optsOf, pmId, pmTemplate, progress } from './pm';
import { t } from '../i18n';
import type { CellVal, Col, ColType, DateVal, Opt, Phase, Pm, Row } from './pm';

const fold = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const pad = (n: number) => String(n).padStart(2, '0');
const dmy = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

// ---------------------------------------------------------------------------------------------
// Exportar

/**
 * Valor de una celda para exportar. Con separador «;» (Excel en español) los decimales llevan
 * coma; con «,» o tabulador, punto. Las fechas van como dd/mm/aaaa.
 */
export function exportValue(pm: Pm, col: Col, row: Row, tags: Opt[], decimalComma: boolean): string {
  const v = row.cells[col.id];
  const num = (n: number) => (decimalComma ? String(n).replace('.', ',') : String(n));
  if (col.type === 'number') { if (typeof v === 'string') { const n = numValue(pm, col, row, tags); return n === null ? '' : num(n); } return typeof v === 'number' ? num(v) : ''; }
  if (col.type === 'progress') return String(progress(pm, col, row));
  if (col.type === 'checkbox') return v ? t('calc.yes') : t('calc.no');
  if (col.type === 'date') { const d = v && typeof v === 'object' && !Array.isArray(v) ? (v as DateVal) : null; return d?.start ? dmy(d.start) + (d.end && d.end !== d.start ? ' - ' + dmy(d.end) : '') : ''; }
  return cellText(pm, col, row, tags);
}

const quote = (t: string, sep: string) => (t.includes(sep) || /["\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t);

export function toCsv(pm: Pm, rows: Row[], tags: Opt[], sep: ';' | ',' | '\t' = ';'): string {
  const cols = pm.cols.filter((c) => !c.hidden);
  const lines = [cols.map((c) => quote(c.name, sep)).join(sep), ...rows.map((r) => cols.map((c) => quote(exportValue(pm, c, r, tags, sep === ';'), sep)).join(sep))];
  // BOM para que Excel reconozca UTF-8 (tildes y «€»).
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

const escHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** «Copiar para Excel»: TSV (texto) + tabla HTML, para que cada dato caiga en su celda. */
export function toClipboard(pm: Pm, rows: Row[], tags: Opt[]): { text: string; html: string } {
  const cols = pm.cols.filter((c) => !c.hidden);
  const grid = [cols.map((c) => c.name), ...rows.map((r) => cols.map((c) => exportValue(pm, c, r, tags, true)))];
  const text = grid.map((l) => l.map((x) => x.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
  const html = '<table>' + grid.map((l, i) => '<tr>' + l.map((x) => (i ? `<td>${escHtml(x)}</td>` : `<th>${escHtml(x)}</th>`)).join('') + '</tr>').join('') + '</table>';
  return { text, html };
}

// ---------------------------------------------------------------------------------------------
// Importar

/** Separa un CSV respetando comillas. Detecta el separador (; , o tabulador) en la primera línea. */
export function parseCsv(text: string): { sep: string; rows: string[][] } {
  const t = text.replace(/^\uFEFF/, '');
  const first = t.split(/\r?\n/)[0] ?? '';
  const count = (c: string) => first.split(c).length - 1;
  const sep = [';', '\t', ','].sort((a, b) => count(b) - count(a))[0];
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((x) => x !== '')) rows.push(row);
  return { sep, rows };
}

/** «1.234,5» o «1,234.5» o «1234.5 €» → 1234.5 */
export function parseNumber(raw: string): number | null {
  let t = raw.trim().replace(/[€%h\s]/g, '').replace(/[^\d.,-]/g, '');
  if (!t || !/\d/.test(t)) return null;
  const lastComma = t.lastIndexOf(','), lastDot = t.lastIndexOf('.');
  if (lastComma > lastDot) t = t.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma && lastComma >= 0) t = t.replace(/,/g, '');
  else if (lastComma < 0 && (t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, '');
  // «2.400» (un punto seguido de exactamente tres cifras) es separador de miles, como en español.
  else if (lastComma < 0 && /^-?\d{1,3}\.\d{3}$/.test(t)) t = t.replace('.', '');
  const n = Number(t);
  return isNaN(n) ? null : n;
}

/** dd/mm/aaaa, dd-mm-aaaa, aaaa-mm-dd (y rangos «a - b» o «a → b») → { start, end } */
export function parseDateRange(raw: string): DateVal | null {
  const one = (x: string): string | null => {
    const s = x.trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; if (+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return `${y}-${pad(+m[2])}-${pad(+m[1])}`; }
    return null;
  };
  const parts = raw.split(/\s+(?:-|→|–|a)\s+/);
  const a = one(parts[0] ?? '');
  if (!a) return null;
  const b = parts[1] ? one(parts[1]) : null;
  return { start: a, end: b && b !== a ? b : '' };
}

const YES = /^(s[ií]|x|✓|true|verdadero|yes|1)$/i;
const NO = /^(no|false|falso|0|)$/i;

/** Adivina el tipo de una columna a partir de sus valores. */
export function guessType(values: string[]): ColType {
  const v = values.map((x) => x.trim()).filter(Boolean);
  if (!v.length) return 'text';
  if (v.every((x) => YES.test(x) || NO.test(x)) && v.some((x) => YES.test(x))) return 'checkbox';
  if (v.every((x) => parseDateRange(x))) return 'date';
  if (v.every((x) => parseNumber(x) !== null && /^[\d\s.,€%h-]+$/.test(x))) return 'number';
  const distinct = new Set(v.map(fold));
  if (v.some((x) => x.includes(',')) && v.length >= 3) {
    const parts = new Set(v.flatMap((x) => x.split(',').map(fold)).filter(Boolean));
    if (parts.size <= Math.max(6, v.length)) return 'multi';
  }
  // Pocos valores distintos y alguno repetido: parece una lista de opciones.
  if (v.length >= 3 && distinct.size <= 8 && distinct.size < v.length) return 'select';
  return 'text';
}

export type CsvPlan = { header: string[]; map: (string | null)[]; types: ColType[]; rows: string[][]; sep: string };

/** Primera vista: qué columna existente corresponde a cada cabecera y qué tipo tendrían las nuevas. */
export function planImport(pm: Pm, text: string): CsvPlan {
  const { sep, rows } = parseCsv(text);
  const header = rows[0] ?? [];
  const body = rows.slice(1);
  const map = header.map((h) => pm.cols.find((c) => fold(c.name) === fold(h) && c.type !== 'progress')?.id ?? null);
  const types = header.map((_, i) => guessType(body.map((r) => r[i] ?? '')));
  return { header, map, types, rows: body, sep };
}

/**
 * Aplica la importación: añade las filas al final, crea las columnas que falten y las opciones
 * de selección nuevas. Devuelve la tabla resultante y las etiquetas globales nuevas.
 */
export function applyImport(pm: Pm, plan: CsvPlan, tags: Opt[]): { pm: Pm; newTags: Opt[]; added: number } {
  const cols: Col[] = pm.cols.map((c) => ({ ...c, opts: c.opts ? [...c.opts] : c.opts }));
  const newTags: Opt[] = [];
  const target: Col[] = plan.header.map((h, i) => {
    const existing = plan.map[i] ? cols.find((c) => c.id === plan.map[i]) : null;
    if (existing) return existing;
    const col: Col = { id: pmId('col'), name: h || 'Columna ' + (i + 1), type: plan.types[i], w: plan.types[i] === 'text' ? 220 : 150 };
    if (col.type === 'number') col.fmt = 'num';
    if (col.type === 'select' || col.type === 'multi') col.opts = [];
    cols.push(col);
    return col;
  });
  const opt = (col: Col, name: string): string => {
    const list = col.global ? [...tags, ...newTags] : col.opts!;
    const f = list.find((o) => fold(o.name) === fold(name));
    if (f) return f.id;
    const o: Opt = { id: pmId(col.global ? 'tag' : 'o'), name: name.trim(), color: COLOR_KEYS[list.length % COLOR_KEYS.length] };
    if (col.global) newTags.push(o); else col.opts!.push(o);
    return o.id;
  };
  const value = (col: Col, raw: string): CellVal => {
    const t = raw.trim();
    switch (col.type) {
      case 'number': return parseNumber(t);
      case 'checkbox': return YES.test(t);
      case 'date': return parseDateRange(t);
      case 'select': return t ? opt(col, t) : null;
      case 'multi': return t ? t.split(',').map((x) => x.trim()).filter(Boolean).map((x) => opt(col, x)) : [];
      case 'status': return allStates(col).find((x) => fold(x.st.name) === fold(t))?.st.id ?? null;
      case 'progress': return null;
      default: return t;
    }
  };
  const newRows: Row[] = plan.rows.map((r) => {
    const cells: Record<string, CellVal> = {};
    target.forEach((col, i) => { if (col.type !== 'progress') cells[col.id] = value(col, r[i] ?? ''); });
    return { id: pmId('row'), cells };
  });
  return { pm: { ...pm, cols, rows: [...pm.rows, ...newRows] }, newTags, added: newRows.length };
}

// ---------------------------------------------------------------------------------------------
// Plantillas

export type PmTemplate = { id: string; name: string; description: string; pm: Pm; builtin?: boolean };

/** Una plantilla guarda la estructura (columnas, filtros, vista), no las filas. */
export function asTemplate(pm: Pm, name: string): PmTemplate {
  return { id: pmId('tpl'), name, description: `${pm.cols.length} columnas`, pm: { ...pm, rows: [], cols: pm.cols.map((c) => ({ ...c })) } };
}

/** Copia de una plantilla con identificadores nuevos (para que dos tablas no compartan ids). */
export function instantiate(t: PmTemplate): Pm {
  const ids = new Map<string, string>();
  const nid = (old: string, p: string) => { if (!ids.has(old)) ids.set(old, pmId(p)); return ids.get(old)!; };
  const cols = t.pm.cols.map((c) => ({
    ...c,
    id: nid(c.id, 'col'),
    opts: c.opts?.map((o) => ({ ...o, id: nid(o.id, 'o') })),
    phases: c.phases?.map((ph): Phase => ({ ...ph, id: nid(ph.id, 'ph'), states: ph.states.map((s) => ({ ...s, id: nid(s.id, 'st') })) })),
  }));
  const fixed = cols.map((c) => ({ ...c, source: c.source ? ids.get(c.source) : undefined }));
  return {
    cols: fixed,
    rows: [],
    filters: t.pm.filters.map((f) => ({ ...f, id: pmId('f'), col: ids.get(f.col) ?? f.col, val: ids.get(f.val) ?? f.val })),
    conj: t.pm.conj,
    sorts: t.pm.sorts.map((s) => ({ ...s, col: ids.get(s.col) ?? s.col })),
    ui: t.pm.ui?.kanban ? { ...t.pm.ui, kanban: { ...t.pm.ui.kanban, col: ids.get(t.pm.ui.kanban.col) ?? t.pm.ui.kanban.col } } : t.pm.ui,
  };
}

export function builtinTemplates(): PmTemplate[] {
  const phased = pmTemplate();
  const c = (name: string, type: ColType, extra: Partial<Col> = {}): Col => ({ id: pmId('col'), name, type, w: 150, ...extra });
  const st = (name: string) => ({ id: pmId('st'), name });
  const ph = (name: string, color: string, states: string[]): Phase => ({ id: pmId('ph'), name, color, states: states.map(st) });

  const artStatus = c(t('calc.pmt.col.status'), 'status', { w: 180, phases: [ph(t('calc.tpl.art.ph.proposal'), 'gray', [t('calc.tpl.art.st.consult'), t('calc.tpl.art.st.quoteSent'), t('calc.tpl.art.st.accepted')]), ph(t('calc.tpl.art.ph.creation'), 'orange', [t('calc.pmt.st.sketches'), t('calc.tpl.art.st.color'), t('calc.tpl.art.st.details')]), ph(t('calc.tpl.art.ph.review'), 'purple', [t('calc.pmt.st.clientReview'), t('calc.tpl.art.st.changes')]), ph(t('calc.tpl.art.ph.close'), 'green', [t('calc.pmt.st.delivered'), t('calc.tpl.art.st.paid')])] });
  const art: Pm = { cols: [c(t('calc.tpl.art.col.commission'), 'text', { w: 240, total: 'count' }), artStatus, c(t('calc.pmt.col.progress'), 'progress', { w: 140, source: artStatus.id, total: 'avg' }), c(t('calc.pmt.opt.client'), 'select', { opts: [] }), c(t('calc.tpl.art.col.technique'), 'multi', { w: 180, global: true }), c(t('calc.pmt.col.dates'), 'date', { w: 190 }), c(t('calc.tpl.art.col.price'), 'number', { fmt: 'eur', total: 'sum' }), c(t('calc.tpl.art.col.deposit'), 'checkbox', { total: 'pct' })], rows: [], filters: [], conj: 'and', sorts: [] };

  const socStatus = c(t('calc.pmt.col.status'), 'status', { w: 170, phases: [ph(t('calc.tpl.soc.ph.ideas'), 'gray', [t('calc.tpl.soc.st.idea')]), ph(t('calc.tpl.soc.ph.production'), 'blue', [t('calc.tpl.soc.st.script'), t('calc.tpl.soc.st.recording'), t('calc.tpl.soc.st.editing')]), ph(t('calc.tpl.soc.ph.publication'), 'green', [t('calc.tpl.soc.st.scheduled'), t('calc.tpl.soc.st.published')])] });
  const social: Pm = { cols: [c(t('calc.tpl.soc.col.piece'), 'text', { w: 240, total: 'count' }), socStatus, c(t('calc.pmt.col.progress'), 'progress', { w: 130, source: socStatus.id }), c(t('calc.tpl.soc.col.network'), 'multi', { w: 170, opts: [{ id: pmId('o'), name: 'Instagram', color: 'pink' }, { id: pmId('o'), name: 'TikTok', color: 'gray' }, { id: pmId('o'), name: 'YouTube', color: 'red' }, { id: pmId('o'), name: 'Blog', color: 'blue' }] }), c(t('calc.tpl.soc.col.format'), 'select', { opts: [{ id: pmId('o'), name: t('calc.tpl.soc.opt.reel'), color: 'purple' }, { id: pmId('o'), name: t('calc.tpl.soc.opt.carousel'), color: 'orange' }, { id: pmId('o'), name: t('calc.tpl.soc.opt.article'), color: 'blue' }] }), c(t('calc.tpl.soc.ph.publication'), 'date', { w: 160 }), c(t('calc.tpl.soc.col.views'), 'number', { total: 'sum' })], rows: [], filters: [], conj: 'and', sorts: [], ui: { view: 'kanban', kanban: { col: socStatus.id, mode: 'state' } } };

  const blank: Pm = { cols: [c(t('calc.tpl.blank.col.name'), 'text', { w: 260, total: 'count' })], rows: [], filters: [], conj: 'and', sorts: [] };
  return [
    { id: 'tpl-phases', name: t('calc.tpl.phases.name'), description: t('calc.tpl.phases.desc'), pm: phased, builtin: true },
    { id: 'tpl-art', name: t('calc.tpl.art.name'), description: t('calc.tpl.art.desc'), pm: art, builtin: true },
    { id: 'tpl-social', name: t('calc.tpl.social.name'), description: t('calc.tpl.social.desc'), pm: social, builtin: true },
    { id: 'tpl-blank', name: t('calc.tpl.blank.name'), description: t('calc.tpl.blank.desc'), pm: blank, builtin: true },
  ];
}

/** Para mostrar en la lista de opciones al importar. */
export const optNames = (col: Col, tags: Opt[]) => optsOf(col, tags).map((o) => o.name);
