import { applyFmt } from './format';
import type { CellFmt, FmtPatch } from './format';
import { mapRefs, runFormula } from './formula';
import type { FVal, Ref } from './formula';
import { locale, t, tn } from '../i18n';
import type { Key } from '../i18n';
// Tabla PM (seguimiento de proyecto, estilo Notion): lógica pura, sin interfaz.
// Una tabla vive dentro de una tarjeta de tipo «pm»; las etiquetas globales se comparten
// entre todas las tablas de la app.

export type ColType = 'text' | 'number' | 'select' | 'multi' | 'status' | 'progress' | 'checkbox' | 'date' | 'timer' | 'formula' | 'relation' | 'rollup' | 'image';
export type RollFn = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'pctDone' | 'list';
/** Enlace de una celda de relación: una fila de otra (o la misma) tabla, una tarjeta o una tarea principal. */
export type RelLink = { kind: 'row'; card: string; row: string; alias?: string } | { kind: 'card'; card: string; alias?: string } | { kind: 'project'; project: string; alias?: string };
/** Cronómetro: tiempo acumulado (ms) y, si está en marcha, desde cuándo. */
export type TimerVal = { ms: number; start: number | null };
export type NumFmt = 'num' | 'eur' | 'pct' | 'h';
export type Opt = { id: string; name: string; color: string };
export type PmState = { id: string; name: string };
export type Phase = { id: string; name: string; color: string; states: PmState[] };
export type TotalFn = '' | 'count' | 'sum' | 'avg' | 'min' | 'max' | 'pct' | 'checked' | 'done' | 'overdue' | 'filled' | 'empty';

export type Col = {
  id: string;
  name: string;
  type: ColType;
  w: number;
  hidden?: boolean;
  fmt?: NumFmt;
  /** select / multi: opciones propias. Si `global`, las opciones son las etiquetas globales. */
  opts?: Opt[];
  global?: boolean;
  /** status: fases con sus estados. */
  phases?: Phase[];
  /** progress: columna de estado de la que se calcula. */
  source?: string;
  total?: TotalFn;
  /** formula: la expresión. */
  expr?: string;
  /** relation: tabla «interna» (id de la tarjeta Tabla PM) cuyas filas se enlazan. */
  target?: string | null;
  /** rollup: columna de relación, propiedad de la tabla enlazada y función. */
  rel?: string;
  prop?: string;
  fn?: RollFn;
};

export type DateVal = { start: string; end: string };
export type CellVal = string | number | boolean | string[] | DateVal | TimerVal | RelLink[] | null;
export type Sub = { id: string; text: string; done: boolean };
/** Cambio de estado registrado: estado nuevo (id) y cuándo (ms). */
export type HistEntry = { state: string | null; at: number };
export type Row = {
  id: string;
  cells: Record<string, CellVal>;
  /** Formato de cada celda (por id de columna). */
  fmt?: Record<string, CellFmt>;
  /** Página de la fila: descripción en Markdown, subtareas, dependencias e historial. */
  desc?: string;
  subs?: Sub[];
  /** Filas que bloquean a esta (tienen que terminar antes). */
  deps?: string[];
  hist?: HistEntry[];
  /** Las filas archivadas no cuentan en totales ni en el progreso. */
  archived?: boolean;
  /** Al llegar al último estado se crea la siguiente repetición. */
  recur?: Recur | null;
  /** Hito: se dibuja como ◆ en la cronología. */
  milestone?: boolean;
};

export type KanbanBy = { col: string; mode: 'phase' | 'state' } | { col: string; mode: 'value' };
export type PmView = 'table' | 'kanban' | 'timeline' | 'calendar' | 'gallery';
export type Zoom = 'day' | 'week' | 'month';
export type PmViewState = {
  view: PmView;
  kanban?: KanbanBy | null;
  showArchived?: boolean;
  /** Cronología: escala, columna de fechas y orden propio de las filas (independiente de la tabla). */
  zoom?: Zoom;
  dateCol?: string;
  order?: string[];
  /** Calendario: mes visible («AAAA-MM-01»). */
  month?: string;
  /** Galería: tamaño de las tarjetas. */
  gallerySize?: 'S' | 'M' | 'L';
  /** Cronología: al mover una tarea, mover también las que dependen de ella. */
  showDeps?: boolean;
  /** Pestaña activa. */
  active?: string;
};
export type Recur = 'week' | 'month' | 'year';
/** Formato condicional: si la fila cumple la condición, se colorea (y opcionalmente en negrita). */
export type Rule = { id: string; filter: Filter; color: string; bold: boolean };

export type FilterOp = 'contains' | 'ncontains' | 'is' | 'isnot' | 'empty' | 'nempty' | 'phase' | 'eq' | 'gt' | 'lt' | 'checked' | 'unchecked' | 'overdue' | 'before' | 'after';
export type Filter = { id: string; col: string; op: FilterOp; val: string };
export type Sort = { col: string; dir: 'asc' | 'desc' };
/** Una vista (pestaña): cada una guarda su tipo, filtros, orden, agrupación y ajustes propios. */
export type ViewSpec = { id: string; name: string; type: PmView; filters: Filter[]; conj: 'and' | 'or'; sorts: Sort[]; group?: string | null; ui?: Partial<PmViewState> };
/** `filters`, `conj`, `sorts`, `group` y `ui` reflejan la vista activa; `views` guarda las pestañas. */
export type Pm = { cols: Col[]; rows: Row[]; filters: Filter[]; conj: 'and' | 'or'; sorts: Sort[]; group?: string | null; ui?: PmViewState; rules?: Rule[]; views?: ViewSpec[] };

export const VIEW_LABEL: Record<PmView, string> = { get table() { return t('calc.view.table'); }, get kanban() { return t('calc.view.kanban'); }, get timeline() { return t('calc.view.timeline'); }, get calendar() { return t('calc.view.calendar'); }, get gallery() { return t('calc.view.gallery'); } };
const VIEW_UI: (keyof PmViewState)[] = ['kanban', 'zoom', 'dateCol', 'order', 'month', 'gallerySize', 'showDeps'];
const pickUi = (ui?: PmViewState): Partial<PmViewState> => { const o: Record<string, unknown> = {}; for (const k of VIEW_UI) if (ui && ui[k] !== undefined) o[k] = ui[k]; return o as Partial<PmViewState>; };
const blankView = (id: string, name: string, type: PmView): ViewSpec => ({ id, name, type, filters: [], conj: 'and', sorts: [], group: null, ui: {} });

/** Pestañas de la tabla: las guardadas o, si es una tabla anterior, Tabla, Cronología y Kanban. */
export function pmViews(pm: Pm): ViewSpec[] {
  const active = activeViewId(pm);
  const base = pm.views ?? [blankView('v-table', t('calc.view.table'), 'table'), blankView('v-timeline', t('calc.view.timeline'), 'timeline'), blankView('v-kanban', t('calc.view.kanban'), 'kanban')];
  return base.map((v) => (v.id === active ? { ...v, type: pm.ui?.view ?? v.type, filters: pm.filters, conj: pm.conj, sorts: pm.sorts, group: pm.group ?? null, ui: pickUi(pm.ui) } : v));
}
export function activeViewId(pm: Pm): string {
  const base = pm.views ?? [blankView('v-table', t('calc.view.table'), 'table'), blankView('v-timeline', t('calc.view.timeline'), 'timeline'), blankView('v-kanban', t('calc.view.kanban'), 'kanban')];
  const want = pm.ui?.active;
  if (want && base.some((v) => v.id === want)) return want;
  return (base.find((v) => v.type === (pm.ui?.view ?? 'table')) ?? base[0]).id;
}
const loadView = (pm: Pm, views: ViewSpec[], v: ViewSpec): Pm => {
  const ui: PmViewState = { ...pm.ui, view: v.type, active: v.id };
  for (const k of VIEW_UI) delete (ui as Record<string, unknown>)[k];
  Object.assign(ui, v.ui ?? {});
  return { ...pm, views, filters: v.filters, conj: v.conj, sorts: v.sorts, group: v.group ?? null, ui };
};

export const COLORS: Record<string, [string, string]> = {
  gray: ['#ECE9E3', '#5F584E'], brown: ['#EFE3D6', '#7A4E2D'], orange: ['#FBE4CF', '#A0521B'], yellow: ['#FAF0C8', '#8A6A0F'],
  green: ['#DCEEDC', '#2F6B3B'], blue: ['#DCE8F5', '#2F5E8A'], purple: ['#EAE0F5', '#6A3E91'], pink: ['#F7DDE8', '#9C3463'], red: ['#F8DCDA', '#A3302A'],
};
export const COLOR_KEYS = Object.keys(COLORS);
export const TYPE_LABEL: Record<ColType, string> = { get text() { return t('calc.type.text'); }, get number() { return t('calc.type.number'); }, get select() { return t('calc.type.select'); }, get multi() { return t('calc.type.multi'); }, get status() { return t('calc.type.status'); }, get progress() { return t('calc.type.progress'); }, get checkbox() { return t('calc.type.checkbox'); }, get date() { return t('calc.type.date'); }, get timer() { return t('calc.type.timer'); }, get formula() { return t('calc.type.formula'); }, get relation() { return t('calc.type.relation'); }, get rollup() { return t('calc.type.rollup'); }, get image() { return t('calc.type.image'); } };
export const TYPE_ICON: Record<ColType, string> = { text: 'Aa', number: '#', select: '◉', multi: '☰', status: '◐', progress: '▰', checkbox: '☑', date: '▦', timer: '⏱', formula: 'ƒ', relation: '↗', rollup: 'Σ', image: '▣' };

let seq = 0;
export const pmId = (p: string) => p + '_' + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);

// ---------------------------------------------------------------------------------------------
// Plantilla inicial

export function pmTemplate(): Pm {
  const id = (x: string) => pmId(x);
  const st = (name: string) => ({ id: id('st'), name });
  const phases: Phase[] = [
    { id: id('ph'), name: t('calc.pmt.ph.start'), color: 'gray', states: [st(t('calc.pmt.st.negotiation')), st(t('calc.pmt.st.hired'))] },
    { id: id('ph'), name: t('calc.pmt.ph.dev'), color: 'blue', states: [st(t('calc.pmt.st.sketches')), st(t('calc.pmt.st.firstVersion')), st(t('calc.pmt.st.internalReview')), st(t('calc.pmt.st.adjustments')), st(t('calc.pmt.st.finalVersion'))] },
    { id: id('ph'), name: t('calc.pmt.ph.verify'), color: 'purple', states: [st(t('calc.pmt.st.clientReview')), st(t('calc.pmt.st.corrections')), st(t('calc.pmt.st.approved'))] },
    { id: id('ph'), name: t('calc.pmt.ph.delivery'), color: 'green', states: [st(t('calc.pmt.st.prep')), st(t('calc.pmt.st.delivered'))] },
  ];
  const c = (name: string, type: ColType, extra: Partial<Col> = {}): Col => ({ id: id('col'), name, type, w: 150, ...extra });
  const status = c(t('calc.pmt.col.status'), 'status', { w: 180, phases });
  const cols: Col[] = [
    c(t('calc.pmt.col.task'), 'text', { w: 260, total: 'count' }),
    status,
    c(t('calc.pmt.col.progress'), 'progress', { w: 140, source: status.id, total: 'avg' }),
    c(t('calc.pmt.col.owner'), 'select', { opts: [{ id: id('o'), name: t('calc.pmt.opt.me'), color: 'blue' }, { id: id('o'), name: t('calc.pmt.opt.client'), color: 'orange' }, { id: id('o'), name: t('calc.pmt.opt.collab'), color: 'green' }] }),
    c(t('calc.pmt.col.tags'), 'multi', { w: 190, global: true }),
    c(t('calc.pmt.col.dates'), 'date', { w: 190 }),
    c(t('calc.pmt.col.hours'), 'number', { fmt: 'h', w: 110, total: 'sum' }),
    c(t('calc.pmt.col.budget'), 'number', { fmt: 'eur', w: 130, total: 'sum' }),
    c(t('calc.pmt.col.invoiced'), 'checkbox', { w: 110, total: 'pct' }),
  ];
  return { cols, rows: [], filters: [], conj: 'and', sorts: [] };
}

// ---------------------------------------------------------------------------------------------
// Lectura de valores

export const allStates = (col: Col) => (col.phases ?? []).flatMap((ph) => ph.states.map((st) => ({ st, ph })));
export const stateInfo = (col: Col, v: CellVal) => (typeof v === 'string' ? allStates(col).find((x) => x.st.id === v) ?? null : null);

/** Opciones de una columna de selección (las propias o las etiquetas globales). */
export const optsOf = (col: Col, tags: Opt[]) => (col.global ? tags : col.opts ?? []);

/** Progreso de una fila (0–100): posición de su estado entre todos (el primero 0, el último 100). */
export function progress(pm: Pm, col: Col, row: Row): number {
  const src = pm.cols.find((c) => c.id === col.source && c.type === 'status');
  if (!src) return 0;
  const list = allStates(src);
  const i = list.findIndex((x) => x.st.id === row.cells[src.id]);
  if (i < 0 || list.length < 2) return i === 0 ? 100 : 0;
  return Math.round((i / (list.length - 1)) * 100);
}

/** Progreso de toda la tabla: media de las filas (si hay una columna de progreso). */
export function tableProgress(pm: Pm): number | null {
  const col = pm.cols.find((c) => c.type === 'progress');
  const rows = pm.rows.filter((r) => !r.archived);
  if (!col || !rows.length) return col ? 0 : null;
  return Math.round(rows.reduce((m, r) => m + progress(pm, col, r), 0) / rows.length);
}

const fmtNumber = (n: number) => (Math.round(n * 100) / 100).toLocaleString(locale(), { maximumFractionDigits: 2 });
export function formatNum(col: Col, n: number): string {
  const t = fmtNumber(n);
  return col.fmt === 'eur' ? t + ' €' : col.fmt === 'pct' ? t + ' %' : col.fmt === 'h' ? t + ' h' : t;
}

const fmtDay = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }); };
export const formatDate = (v: DateVal) => (v.start ? fmtDay(v.start) + (v.end && v.end !== v.start ? ' → ' + fmtDay(v.end) : '') : '');

/** Texto de una celda (para buscar, filtrar, convertir de tipo o exportar). */
export function cellText(pm: Pm, col: Col, row: Row, tags: Opt[]): string {
  const v = row.cells[col.id];
  const cf = cellFormula(pm, col, row, tags);
  if (cf) return cf.error ? '' : formatFVal(col, cf.value);
  switch (col.type) {
    case 'progress': return progress(pm, col, row) + '%';
    case 'checkbox': return v ? t('calc.yes') : '';
    case 'number': return typeof v === 'number' ? formatNum(col, v) : '';
    case 'select': return optsOf(col, tags).find((o) => o.id === v)?.name ?? '';
    case 'multi': return Array.isArray(v) ? v.map((id) => optsOf(col, tags).find((o) => o.id === id)?.name).filter(Boolean).join(', ') : '';
    case 'status': return stateInfo(col, v)?.st.name ?? '';
    case 'date': return v && typeof v === 'object' && !Array.isArray(v) ? formatDate(v as DateVal) : '';
    case 'timer': { const ms = timerMs(v); return ms ? formatTimer(ms) : ''; }
    case 'formula': { const r = formulaValue(pm, col, row, tags); return r.error ? '' : formatFVal(col, r.value); }
    case 'relation': return relLinks(v).map((l) => l.alias || linkInfo(l).title).join(', ');
    case 'rollup': return rollupText(pm, col, row, tags);
    case 'image': return Array.isArray(v) && v.length ? tn('calc.imgCount', v.length) : '';
    default: return typeof v === 'string' ? v : '';
  }
}

// ---------------------------------------------------------------------------------------------
// Filtros, orden y totales

/** Par [valor, etiqueta] cuya etiqueta se traduce al leerla (así el idioma puede cambiar en caliente sin cambiar la forma del export). */
const lbl = <K extends string>(k: K, key: Key): [K, string] => {
  const a: [K, string] = [k, ''];
  Object.defineProperty(a, 1, { get: () => t(key), enumerable: true });
  return a;
};

export const FILTER_OPS: Record<ColType, [FilterOp, string][]> = {
  text: [lbl('contains', 'calc.op.contains'), lbl('ncontains', 'calc.op.ncontains'), lbl('empty', 'calc.op.emptyM'), lbl('nempty', 'calc.op.nemptyM')],
  number: [['eq', '='], ['gt', '>'], ['lt', '<'], lbl('empty', 'calc.op.emptyM'), lbl('nempty', 'calc.op.nemptyM')],
  progress: [['eq', '='], ['gt', '>'], ['lt', '<']],
  select: [lbl('is', 'calc.op.is'), lbl('isnot', 'calc.op.isnot'), lbl('empty', 'calc.op.emptyM'), lbl('nempty', 'calc.op.nemptyM')],
  multi: [lbl('contains', 'calc.op.contains'), lbl('ncontains', 'calc.op.ncontains'), lbl('empty', 'calc.op.emptyM'), lbl('nempty', 'calc.op.nemptyM')],
  status: [lbl('is', 'calc.op.is'), lbl('isnot', 'calc.op.isnot'), lbl('phase', 'calc.op.phase'), lbl('empty', 'calc.op.emptyM'), lbl('nempty', 'calc.op.nemptyM')],
  checkbox: [lbl('checked', 'calc.op.checked'), lbl('unchecked', 'calc.op.unchecked')],
  date: [lbl('overdue', 'calc.op.overdue'), lbl('before', 'calc.op.before'), lbl('after', 'calc.op.after'), lbl('empty', 'calc.op.emptyF'), lbl('nempty', 'calc.op.nemptyF')],
  timer: [lbl('gt', 'calc.op.gtH'), lbl('lt', 'calc.op.ltH'), lbl('empty', 'calc.op.noTime'), lbl('nempty', 'calc.op.withTime')],
  formula: [lbl('contains', 'calc.op.contains'), ['eq', '='], ['gt', '>'], ['lt', '<'], lbl('empty', 'calc.op.emptyF'), lbl('nempty', 'calc.op.nemptyF')],
  relation: [lbl('contains', 'calc.op.contains'), lbl('empty', 'calc.op.emptyF'), lbl('nempty', 'calc.op.nemptyF')],
  rollup: [['eq', '='], ['gt', '>'], ['lt', '<'], lbl('contains', 'calc.op.contains'), lbl('empty', 'calc.op.emptyM'), lbl('nempty', 'calc.op.nemptyM')],
  image: [lbl('empty', 'calc.op.noImages'), lbl('nempty', 'calc.op.withImages')],
};

const fold = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function matches(pm: Pm, row: Row, f: Filter, tags: Opt[], today: string): boolean {
  const col = pm.cols.find((c) => c.id === f.col);
  if (!col) return true;
  const v = row.cells[col.id];
  const isEmpty = col.type === 'formula' || col.type === 'rollup' || isCellFormula(col, v) ? cellText(pm, col, row, tags) === '' : col.type === 'timer' ? !timerMs(v) : v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !(v as DateVal).start);
  const num = col.type === 'formula' || col.type === 'rollup' || isCellFormula(col, v) ? numValue(pm, col, row, tags) ?? NaN : col.type === 'progress' ? progress(pm, col, row) : col.type === 'timer' ? timerMs(v) / 3_600_000 : typeof v === 'number' ? v : NaN;
  const d = col.type === 'date' && v && typeof v === 'object' && !Array.isArray(v) ? (v as DateVal) : null;
  switch (f.op) {
    case 'empty': return isEmpty;
    case 'nempty': return !isEmpty;
    case 'contains': return col.type === 'multi' ? Array.isArray(v) && (v as string[]).includes(f.val) : fold(cellText(pm, col, row, tags)).includes(fold(f.val));
    case 'ncontains': return col.type === 'multi' ? !(Array.isArray(v) && (v as string[]).includes(f.val)) : !fold(cellText(pm, col, row, tags)).includes(fold(f.val));
    case 'is': return v === f.val;
    case 'isnot': return v !== f.val;
    case 'phase': return stateInfo(col, v)?.ph.id === f.val;
    case 'eq': return num === Number(f.val);
    case 'gt': return num > Number(f.val);
    case 'lt': return num < Number(f.val);
    case 'checked': return !!v;
    case 'unchecked': return !v;
    case 'overdue': {
      if (!d?.start) return false;
      const prog = pm.cols.find((c) => c.type === 'progress');
      return (d.end || d.start) < today && (!prog || progress(pm, prog, row) < 100);
    }
    case 'before': return !!d?.start && d.start < f.val;
    case 'after': return !!d?.start && d.start > f.val;
  }
}

/** Filas visibles: filtradas (Y / O) y ordenadas por varias columnas. */
export function visibleRows(pm: Pm, tags: Opt[], today: string, query = ''): Row[] {
  const fl = pm.filters.filter((f) => pm.cols.some((c) => c.id === f.col));
  const q = fold(query.trim());
  let rows = pm.rows.filter((r) => (pm.ui?.showArchived || !r.archived) && (!q || rowMatches(pm, r, q, tags)) && (!fl.length || (pm.conj === 'or' ? fl.some((f) => matches(pm, r, f, tags, today)) : fl.every((f) => matches(pm, r, f, tags, today)))));
  const sorts = pm.sorts.filter((s) => pm.cols.some((c) => c.id === s.col));
  if (sorts.length) {
    const keyOf = (col: Col, r: Row): number | string => {
      const v = r.cells[col.id];
      if (col.type === 'number') { const n = numValue(pm, col, r, tags); return n ?? -Infinity; }
      if (col.type === 'formula' || col.type === 'rollup') { const n = numValue(pm, col, r, tags); if (n !== null) return n; }
      if (col.type === 'progress') return progress(pm, col, r);
      if (col.type === 'checkbox') return v ? 1 : 0;
      if (col.type === 'status') { const i = allStates(col).findIndex((x) => x.st.id === v); return i < 0 ? -1 : i; }
      if (col.type === 'select') { const i = optsOf(col, tags).findIndex((o) => o.id === v); return i < 0 ? -1 : i; }
      if (col.type === 'date') return v && typeof v === 'object' && !Array.isArray(v) ? (v as DateVal).start || '' : '';
      return fold(cellText(pm, col, r, tags));
    };
    rows = rows.slice().sort((a, b) => {
      for (const s of sorts) {
        const col = pm.cols.find((c) => c.id === s.col)!;
        const x = keyOf(col, a), y = keyOf(col, b);
        if (x !== y) return (x < y ? -1 : 1) * (s.dir === 'asc' ? 1 : -1);
      }
      return 0;
    });
  }
  return rows;
}

/** Búsqueda dentro de la tabla: todas las celdas, la descripción y las subtareas, sin tildes. */
export function rowMatches(pm: Pm, r: Row, foldedQuery: string, tags: Opt[]): boolean {
  if (pm.cols.some((c) => fold(cellText(pm, c, r, tags)).includes(foldedQuery))) return true;
  if (r.desc && fold(r.desc).includes(foldedQuery)) return true;
  return (r.subs ?? []).some((x) => fold(x.text).includes(foldedQuery));
}

export const TOTALS: Record<ColType, [TotalFn, string][]> = {
  text: [lbl('', 'calc.tot.none'), lbl('count', 'calc.tot.count'), lbl('filled', 'calc.tot.filled'), lbl('empty', 'calc.tot.empty')],
  number: [lbl('', 'calc.tot.none'), lbl('sum', 'calc.tot.sum'), lbl('avg', 'calc.tot.avg'), lbl('min', 'calc.tot.min'), lbl('max', 'calc.tot.max'), lbl('filled', 'calc.tot.filled')],
  progress: [lbl('', 'calc.tot.none'), lbl('avg', 'calc.tot.avg'), lbl('min', 'calc.tot.min'), lbl('max', 'calc.tot.max')],
  select: [lbl('', 'calc.tot.none'), lbl('filled', 'calc.tot.filled')],
  multi: [lbl('', 'calc.tot.none'), lbl('filled', 'calc.tot.filled')],
  status: [lbl('', 'calc.tot.none'), lbl('done', 'calc.tot.done'), lbl('filled', 'calc.tot.withState')],
  checkbox: [lbl('', 'calc.tot.none'), lbl('checked', 'calc.tot.checked'), lbl('pct', 'calc.tot.pctChecked')],
  date: [lbl('', 'calc.tot.none'), lbl('filled', 'calc.tot.withDate'), lbl('overdue', 'calc.tot.overdue')],
  timer: [lbl('', 'calc.tot.none'), lbl('sum', 'calc.tot.sum'), lbl('avg', 'calc.tot.avg'), lbl('max', 'calc.tot.max')],
  formula: [lbl('', 'calc.tot.none'), lbl('sum', 'calc.tot.sum'), lbl('avg', 'calc.tot.avg'), lbl('min', 'calc.tot.min'), lbl('max', 'calc.tot.max'), lbl('filled', 'calc.tot.filled')],
  relation: [lbl('', 'calc.tot.none'), lbl('filled', 'calc.tot.withLinks')],
  rollup: [lbl('', 'calc.tot.none'), lbl('sum', 'calc.tot.sum'), lbl('avg', 'calc.tot.avg'), lbl('min', 'calc.tot.min'), lbl('max', 'calc.tot.max')],
  image: [lbl('', 'calc.tot.none'), lbl('filled', 'calc.tot.withImages')],
};

export function total(pm: Pm, col: Col, rows: Row[], tags: Opt[], today: string): string {
  const fn = col.total ?? '';
  if (!fn) return '';
  if (fn === 'count') return tn('calc.rowsCount', rows.length);
  if (fn === 'filled') return String(rows.filter((r) => cellText(pm, col, r, tags) !== '').length);
  if (fn === 'empty') return String(rows.filter((r) => cellText(pm, col, r, tags) === '').length);
  if (fn === 'checked') return String(rows.filter((r) => r.cells[col.id]).length);
  if (fn === 'pct') return rows.length ? Math.round((rows.filter((r) => r.cells[col.id]).length / rows.length) * 100) + '%' : '0%';
  if (fn === 'done') { const last = allStates(col).slice(-1)[0]?.st.id; return String(rows.filter((r) => last && r.cells[col.id] === last).length); }
  if (fn === 'overdue') return String(rows.filter((r) => matches(pm, r, { id: '', col: col.id, op: 'overdue', val: '' }, tags, today)).length);
  if (col.type === 'timer') {
    const ms = rows.map((r) => timerMs(r.cells[col.id]));
    if (!ms.some(Boolean)) return '—';
    const x = fn === 'sum' ? ms.reduce((a, b) => a + b, 0) : fn === 'avg' ? ms.reduce((a, b) => a + b, 0) / ms.length : Math.max(...ms);
    return formatTimer(x);
  }
  const nums = rows.map((r) => (col.type === 'progress' ? progress(pm, col, r) : col.type === 'formula' || col.type === 'rollup' || col.type === 'number' ? numValue(pm, col, r, tags) : r.cells[col.id])).filter((x): x is number => typeof x === 'number');
  if (!nums.length) return '—';
  const x = fn === 'sum' ? nums.reduce((a, b) => a + b, 0) : fn === 'avg' ? nums.reduce((a, b) => a + b, 0) / nums.length : fn === 'min' ? Math.min(...nums) : Math.max(...nums);
  return col.type === 'progress' || (col.type === 'rollup' && col.fn === 'pctDone') ? Math.round(x) + '%' : formatNum(col, x);
}

// ---------------------------------------------------------------------------------------------
// Conversión entre tipos de columna (conserva lo que tenga sentido)

export function convert(pm: Pm, colId: string, type: ColType, tags: Opt[]): { pm: Pm; newTags: Opt[] } {
  const col = pm.cols.find((c) => c.id === colId);
  if (!col || col.type === type) return { pm, newTags: [] };
  // Las fechas se convierten en texto ISO («2026-10-12 → 2026-10-15») para poder volver a fecha sin perder nada.
  const texts = pm.rows.map((r) => { const v = r.cells[col.id]; if (col.type === 'date' && v && typeof v === 'object' && !Array.isArray(v)) { const d = v as DateVal; return d.start ? d.start + (d.end ? ' → ' + d.end : '') : ''; } return cellText(pm, col, r, tags); });
  const next: Col = { ...col, type };
  const newTags: Opt[] = [];
  const optFor = (list: Opt[], name: string, global: boolean): string => {
    const found = list.find((o) => fold(o.name) === fold(name)) ?? newTags.find((o) => fold(o.name) === fold(name));
    if (found) return found.id;
    const o = { id: pmId(global ? 'tag' : 'o'), name, color: COLOR_KEYS[(list.length + newTags.length) % COLOR_KEYS.length] };
    if (global) newTags.push(o); else list.push(o);
    return o.id;
  };
  if (type === 'select' || type === 'multi') {
    next.global = col.type === 'multi' ? col.global : false;
    next.opts = next.global ? undefined : [...(col.type === 'select' || col.type === 'multi' ? col.opts ?? [] : [])];
  }
  if (type === 'number' && !next.fmt) next.fmt = 'num';
  if (type === 'status' && !next.phases?.length) next.phases = [{ id: pmId('ph'), name: t('calc.def.pending'), color: 'gray', states: [{ id: pmId('st'), name: t('calc.def.todo') }] }, { id: pmId('ph'), name: t('calc.def.done'), color: 'green', states: [{ id: pmId('st'), name: t('calc.def.done') }] }];
  if (type === 'progress') next.source = pm.cols.find((c) => c.type === 'status')?.id;
  if (type === 'formula' && next.expr === undefined) { next.expr = ''; next.fmt = next.fmt ?? 'num'; }
  if (type === 'rollup') { next.rel = next.rel ?? pm.cols.find((c) => c.type === 'relation')?.id; next.fn = next.fn ?? 'count'; next.fmt = 'num'; }
  if (type === 'relation') next.target = next.target ?? null;
  const rows = pm.rows.map((r, i) => {
    const t = texts[i].trim();
    let v: CellVal = null;
    if (type === 'formula' || type === 'rollup') v = null;
    else if (type === 'relation' || type === 'image') v = col.type === type ? r.cells[col.id] : [];
    else if (type === 'text') v = t;
    else if (type === 'number' && col.type === 'timer') v = Math.round((timerMs(r.cells[col.id]) / 3_600_000) * 100) / 100;
    else if (type === 'timer') { const n = col.type === 'number' && typeof r.cells[col.id] === 'number' ? (r.cells[col.id] as number) : NaN; v = { ms: isNaN(n) ? 0 : Math.round(n * 3_600_000), start: null }; }
    else if (type === 'number') { const n = parseFloat(t.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')); v = isNaN(n) ? null : n; }
    else if (type === 'checkbox') v = !!t && !/^(no|0|false)$/i.test(t);
    else if (type === 'select') v = t ? optFor(next.opts!, t.split(',')[0].trim(), false) : null;
    else if (type === 'multi') v = t ? t.split(',').map((x) => x.trim()).filter(Boolean).map((x) => optFor(next.global ? tags : next.opts!, x, !!next.global)) : [];
    else if (type === 'status') v = allStates(next).find((x) => fold(x.st.name) === fold(t))?.st.id ?? null;
    else if (type === 'date') { const m = t.match(/(\d{4}-\d{2}-\d{2})(?:\s*→\s*(\d{4}-\d{2}-\d{2}))?/); v = m ? { start: m[1], end: m[2] ?? '' } : null; }
    return { ...r, cells: { ...r.cells, [colId]: type === 'progress' ? null : v } };
  });
  return { pm: { ...pm, cols: pm.cols.map((c) => (c.id === colId ? next : c)), rows }, newTags };
}

// ---------------------------------------------------------------------------------------------
// Operaciones (reductor de la tabla)

export type PmOp =
  | { op: 'addRow'; id: string; after?: string | null; cells?: Record<string, CellVal> }
  | { op: 'removeRow'; id: string }
  | { op: 'moveRow'; id: string; before: string | null }
  | { op: 'cell'; row: string; col: string; value: CellVal; at?: number; nextId?: string }
  | { op: 'timer'; row: string; col: string; action: 'start' | 'stop' | 'reset'; now: number }
  | { op: 'rules'; rules: Rule[] }
  | { op: 'row'; id: string; patch: Partial<Omit<Row, 'id' | 'cells'>> }
  | { op: 'ui'; patch: Partial<PmViewState> }
  | { op: 'addCol'; col: Col; at?: number }
  | { op: 'patchCol'; id: string; patch: Partial<Col> }
  | { op: 'removeCol'; id: string }
  | { op: 'moveCol'; id: string; before: string | null }
  | { op: 'filters'; filters: Filter[]; conj?: 'and' | 'or' }
  | { op: 'sorts'; sorts: Sort[] }
  | { op: 'viewSelect'; id: string }
  | { op: 'viewAdd'; id: string; type: PmView }
  | { op: 'viewPatch'; id: string; name: string }
  | { op: 'viewMove'; id: string; before: string | null }
  | { op: 'viewDuplicate'; id: string; newId: string }
  | { op: 'viewRemove'; id: string }
  | { op: 'group'; col: string | null }
  /** Varios cambios como un solo paso (pegar un rango, vaciar una selección). */
  | { op: 'batch'; ops: PmOp[] }
  /** Formato (negrita, color…) de varias celdas a la vez. */
  | { op: 'format'; cells: { row: string; col: string }[]; patch: FmtPatch }
  | { op: 'replace'; pm: Pm };

export function pmReduce(pm: Pm, o: PmOp): Pm {
  switch (o.op) {
    case 'batch': return o.ops.reduce(pmReduce, pm);
    case 'format': {
      const by = new Map<string, string[]>();
      for (const c of o.cells) by.set(c.row, [...(by.get(c.row) ?? []), c.col]);
      return {
        ...pm,
        rows: pm.rows.map((r) => {
          const cols = by.get(r.id);
          if (!cols) return r;
          const fmt: Record<string, CellFmt> = { ...(r.fmt ?? {}) };
          for (const c of cols) { const n = applyFmt(fmt[c], o.patch); if (n) fmt[c] = n; else delete fmt[c]; }
          const { fmt: _old, ...rest } = r; void _old;
          return Object.keys(fmt).length ? { ...rest, fmt } : rest;
        }),
      };
    }
    case 'addRow': {
      const row: Row = { id: o.id, cells: o.cells ? { ...o.cells } : {} };
      const at = o.after ? pm.rows.findIndex((r) => r.id === o.after) + 1 : pm.rows.length;
      return { ...pm, rows: [...pm.rows.slice(0, at), row, ...pm.rows.slice(at)] };
    }
    case 'removeRow': return { ...pm, rows: pm.rows.filter((r) => r.id !== o.id).map((r) => (r.deps?.includes(o.id) ? { ...r, deps: r.deps.filter((d) => d !== o.id) } : r)) };
    case 'moveRow': {
      const row = pm.rows.find((r) => r.id === o.id);
      if (!row || o.before === o.id) return pm;
      const rest = pm.rows.filter((r) => r.id !== o.id);
      const at = o.before ? rest.findIndex((r) => r.id === o.before) : rest.length;
      return { ...pm, rows: [...rest.slice(0, at < 0 ? rest.length : at), row, ...rest.slice(at < 0 ? rest.length : at)] };
    }
    case 'cell': {
      const col = pm.cols.find((c) => c.id === o.col);
      const before = pm.rows.find((r) => r.id === o.row);
      const last = col?.type === 'status' ? allStates(col).slice(-1)[0]?.st.id : undefined;
      const next = {
        ...pm,
        rows: pm.rows.map((r) => {
          if (r.id !== o.row) return r;
          const changed = r.cells[o.col] !== o.value;
          // Cada cambio de estado queda en el historial de la fila (para medir cuánto dura cada fase).
          const hist = col?.type === 'status' && changed ? [...(r.hist ?? []), { state: typeof o.value === 'string' ? o.value : null, at: o.at ?? Date.now() }] : r.hist;
          return { ...r, cells: { ...r.cells, [o.col]: o.value }, ...(hist ? { hist } : {}) };
        }),
      };
      // Tarea recurrente: al pasar al último estado se crea la siguiente repetición justo debajo.
      if (col && before?.recur && last && o.value === last && before.cells[o.col] !== last) {
        const done = next.rows.find((r) => r.id === o.row)!;
        const rep = nextOccurrence(next, done, o.nextId ?? pmId('row'));
        const at = next.rows.findIndex((r) => r.id === o.row) + 1;
        return { ...next, rows: [...next.rows.slice(0, at), rep, ...next.rows.slice(at)] };
      }
      return next;
    }
    case 'timer': {
      // Un solo cronómetro en marcha por tabla: al arrancar uno se paran los demás.
      const t = o.now;
      const stop = (v: CellVal): TimerVal => { const x = asTimer(v); return x.start !== null ? { ms: x.ms + (t - x.start), start: null } : x; };
      return {
        ...pm,
        rows: pm.rows.map((r) => {
          const cells = { ...r.cells };
          let touched = false;
          for (const c of pm.cols) {
            if (c.type !== 'timer') continue;
            const x = asTimer(cells[c.id]);
            if (r.id === o.row && c.id === o.col) {
              cells[c.id] = o.action === 'start' ? { ms: x.start !== null ? x.ms + (t - x.start) : x.ms, start: t } : o.action === 'stop' ? stop(x) : { ms: 0, start: null };
              touched = true;
            } else if (o.action === 'start' && x.start !== null) { cells[c.id] = stop(x); touched = true; }
          }
          return touched ? { ...r, cells } : r;
        }),
      };
    }
    case 'rules': return { ...pm, rules: o.rules };
    case 'row': return { ...pm, rows: pm.rows.map((r) => (r.id === o.id ? { ...r, ...o.patch } : r)) };
    case 'ui': return { ...pm, ui: { view: 'table', ...pm.ui, ...o.patch } };
    case 'addCol': {
      const at = o.at ?? pm.cols.length;
      return { ...pm, cols: [...pm.cols.slice(0, at), o.col, ...pm.cols.slice(at)] };
    }
    case 'patchCol': return { ...pm, cols: pm.cols.map((c) => (c.id === o.id ? { ...c, ...o.patch } : c)) };
    case 'removeCol': {
      if (pm.cols.length <= 1) return pm;
      return {
        ...pm,
        cols: pm.cols.filter((c) => c.id !== o.id).map((c) => (c.source === o.id ? { ...c, source: undefined } : c)),
        rows: pm.rows.map((r) => { const cells = { ...r.cells }; delete cells[o.id]; return { ...r, cells }; }),
        filters: pm.filters.filter((f) => f.col !== o.id),
        sorts: pm.sorts.filter((s) => s.col !== o.id),
      };
    }
    case 'moveCol': {
      const col = pm.cols.find((c) => c.id === o.id);
      if (!col || o.before === o.id) return pm;
      const rest = pm.cols.filter((c) => c.id !== o.id);
      const at = o.before ? rest.findIndex((c) => c.id === o.before) : rest.length;
      return { ...pm, cols: [...rest.slice(0, at < 0 ? rest.length : at), col, ...rest.slice(at < 0 ? rest.length : at)] };
    }
    case 'filters': return { ...pm, filters: o.filters, conj: o.conj ?? pm.conj };
    case 'sorts': return { ...pm, sorts: o.sorts };
    case 'group': return { ...pm, group: o.col };
    case 'viewSelect': {
      const views = pmViews(pm);
      const t = views.find((v) => v.id === o.id);
      return t ? loadView(pm, views, t) : pm;
    }
    case 'viewAdd': {
      const views = pmViews(pm);
      const v = blankView(o.id, VIEW_LABEL[o.type], o.type);
      return loadView(pm, [...views, v], v);
    }
    case 'viewPatch': return { ...pm, views: pmViews(pm).map((v) => (v.id === o.id ? { ...v, name: o.name } : v)) };
    case 'viewMove': {
      const views = pmViews(pm);
      const v = views.find((x) => x.id === o.id);
      if (!v || o.before === o.id) return pm;
      const rest = views.filter((x) => x.id !== o.id);
      const at = o.before ? rest.findIndex((x) => x.id === o.before) : rest.length;
      return { ...pm, views: [...rest.slice(0, at < 0 ? rest.length : at), v, ...rest.slice(at < 0 ? rest.length : at)] };
    }
    case 'viewDuplicate': {
      const views = pmViews(pm);
      const i = views.findIndex((x) => x.id === o.id);
      if (i < 0) return pm;
      const copy: ViewSpec = { ...views[i], id: o.newId, name: views[i].name + ' (copia)' };
      return loadView(pm, [...views.slice(0, i + 1), copy, ...views.slice(i + 1)], copy);
    }
    case 'viewRemove': {
      const views = pmViews(pm);
      if (views.length <= 1) return pm;
      const wasActive = activeViewId(pm) === o.id;
      const next = views.filter((x) => x.id !== o.id);
      return wasActive ? loadView(pm, next, next[0]) : { ...pm, views: next };
    }
    case 'replace': return o.pm;
  }
}

/** Columna nueva de un tipo, con valores por defecto sensatos. */
export function newCol(type: ColType, pm: Pm): Col {
  const base: Col = { id: pmId('col'), name: TYPE_LABEL[type], type, w: type === 'text' ? 220 : 150 };
  if (type === 'number') base.fmt = 'num';
  if (type === 'select' || type === 'multi') base.opts = [];
  if (type === 'status') base.phases = [{ id: pmId('ph'), name: t('calc.def.pending'), color: 'gray', states: [{ id: pmId('st'), name: t('calc.def.todo') }] }, { id: pmId('ph'), name: t('calc.def.inProgress'), color: 'blue', states: [{ id: pmId('st'), name: t('calc.def.inProgress') }] }, { id: pmId('ph'), name: t('calc.def.done'), color: 'green', states: [{ id: pmId('st'), name: t('calc.def.done') }] }];
  if (type === 'progress') base.source = pm.cols.find((c) => c.type === 'status')?.id;
  if (type === 'formula') { base.expr = ''; base.fmt = 'num'; base.w = 180; }
  if (type === 'relation') { base.target = null; base.w = 220; }
  if (type === 'rollup') { base.rel = pm.cols.find((c) => c.type === 'relation')?.id; base.fn = 'count'; base.fmt = 'num'; }
  if (type === 'image') base.w = 170;
  return base;
}

// ---------------------------------------------------------------------------------------------
// Página de la fila: historial, dependencias y subtareas

/** Tiempo pasado en cada fase según el historial (la última sigue contando hasta `now`). */
export function phaseDurations(col: Col, row: Row, now = Date.now()): { phase: Phase; ms: number }[] {
  const hist = row.hist ?? [];
  const out = new Map<string, number>();
  hist.forEach((h, i) => {
    const ph = stateInfo(col, h.state)?.ph;
    if (!ph) return;
    const end = i + 1 < hist.length ? hist[i + 1].at : now;
    out.set(ph.id, (out.get(ph.id) ?? 0) + Math.max(0, end - h.at));
  });
  return (col.phases ?? []).filter((ph) => out.has(ph.id)).map((ph) => ({ phase: ph, ms: out.get(ph.id)! }));
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return tn('calc.days', d);
}

/** ¿Está terminada? (progreso al 100 % o, si no hay columna de progreso, último estado). */
export function isDone(pm: Pm, row: Row): boolean {
  const prog = pm.cols.find((c) => c.type === 'progress');
  if (prog) return progress(pm, prog, row) >= 100;
  const st = pm.cols.find((c) => c.type === 'status');
  return !!st && allStates(st).slice(-1)[0]?.st.id === row.cells[st.id];
}

/** Filas que bloquean a esta y aún no han terminado. */
export const blockers = (pm: Pm, row: Row) => (row.deps ?? []).map((id) => pm.rows.find((r) => r.id === id)).filter((r): r is Row => !!r && !isDone(pm, r));
/** Filas que esperan a esta. */
export const blocking = (pm: Pm, row: Row) => pm.rows.filter((r) => r.deps?.includes(row.id));

/** ¿Crearía un ciclo añadir `dep` como bloqueo de `row`? */
export function wouldCycle(pm: Pm, row: string, dep: string): boolean {
  const seen = new Set<string>();
  const walk = (id: string): boolean => {
    if (id === row) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return (pm.rows.find((r) => r.id === id)?.deps ?? []).some(walk);
  };
  return walk(dep);
}

export const rowTitle = (pm: Pm, row: Row, tags: Opt[]) => { const c = pm.cols.find((x) => x.type === 'text'); return (c && cellText(pm, c, row, tags)) || t('calc.untitled'); };

// ---------------------------------------------------------------------------------------------
// Kanban

export type KanbanColumn = { key: string; label: string; color: string; value: CellVal; rows: Row[] };

/** Columnas que puede usar el Kanban para agrupar. */
export const kanbanCandidates = (pm: Pm) => pm.cols.filter((c) => c.type === 'status' || c.type === 'select' || c.type === 'checkbox' || c.type === 'multi');

export function defaultKanban(pm: Pm): KanbanBy | null {
  const st = pm.cols.find((c) => c.type === 'status');
  if (st) return { col: st.id, mode: 'phase' };
  const c = kanbanCandidates(pm)[0];
  return c ? { col: c.id, mode: 'value' } : null;
}

export function kanbanColumns(pm: Pm, rows: Row[], by: KanbanBy, tags: Opt[]): KanbanColumn[] {
  const col = pm.cols.find((c) => c.id === by.col);
  if (!col) return [];
  const none: KanbanColumn = { key: '__none', label: t('calc.kan.none'), color: 'gray', value: col.type === 'multi' ? [] : col.type === 'checkbox' ? false : null, rows: [] };
  let cols: KanbanColumn[] = [];
  if (col.type === 'status' && by.mode === 'phase') {
    cols = (col.phases ?? []).map((ph) => ({ key: ph.id, label: ph.name, color: ph.color, value: ph.states[0]?.id ?? null, rows: [] }));
    for (const r of rows) { const ph = stateInfo(col, r.cells[col.id])?.ph; (cols.find((c) => c.key === ph?.id) ?? none).rows.push(r); }
  } else if (col.type === 'status') {
    cols = allStates(col).map(({ st, ph }) => ({ key: st.id, label: st.name, color: ph.color, value: st.id, rows: [] }));
    for (const r of rows) (cols.find((c) => c.key === r.cells[col.id]) ?? none).rows.push(r);
  } else if (col.type === 'checkbox') {
    cols = [{ key: 'no', label: t('calc.kan.unchecked'), color: 'gray', value: false, rows: [] }, { key: 'yes', label: t('calc.tot.checked'), color: 'green', value: true, rows: [] }];
    for (const r of rows) cols[r.cells[col.id] ? 1 : 0].rows.push(r);
    return cols;
  } else {
    cols = optsOf(col, tags).map((o) => ({ key: o.id, label: o.name, color: o.color, value: col.type === 'multi' ? [o.id] : o.id, rows: [] }));
    for (const r of rows) {
      const v = r.cells[col.id];
      const ids = col.type === 'multi' ? strList(v) : typeof v === 'string' ? [v] : [];
      const hit = cols.filter((c) => ids.includes(c.key));
      if (hit.length) hit.forEach((c) => c.rows.push(r)); else none.rows.push(r);
    }
  }
  return none.rows.length ? [none, ...cols] : cols;
}

/** Valor que hay que poner al soltar una tarjeta en otra columna del Kanban. */
export function kanbanDropValue(pm: Pm, by: KanbanBy, row: Row, from: KanbanColumn | undefined, to: KanbanColumn): CellVal {
  const col = pm.cols.find((c) => c.id === by.col)!;
  if (col.type === 'multi') {
    const cur = strList(row.cells[col.id]);
    const without = from && from.key !== '__none' ? cur.filter((x) => x !== from.key) : cur;
    return to.key === '__none' ? [] : Array.from(new Set([...without, to.key]));
  }
  // Al mover a otra fase se conserva el estado si ya estaba en ella; si no, el primero de la fase.
  if (col.type === 'status' && by.mode === 'phase') {
    const cur = stateInfo(col, row.cells[col.id]);
    return cur?.ph.id === to.key ? (row.cells[col.id] as string) : to.value;
  }
  return to.value;
}

// ---------------------------------------------------------------------------------------------
// Cronómetro

export const asTimer = (v: CellVal): TimerVal => (v && typeof v === 'object' && !Array.isArray(v) && 'ms' in v ? (v as TimerVal) : { ms: 0, start: null });
/** Tiempo total de un cronómetro (si está en marcha, cuenta hasta `now`). */
export const timerMs = (v: CellVal, now = Date.now()) => { const t = asTimer(v); return t.ms + (t.start !== null ? Math.max(0, now - t.start) : 0); };
export function formatTimer(ms: number): string {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}
/** Cronómetro en marcha en una tabla (como mucho uno). */
export function runningTimer(pm: Pm): { row: Row; col: Col; start: number; ms: number } | null {
  for (const c of pm.cols) if (c.type === 'timer') for (const r of pm.rows) { const t = asTimer(r.cells[c.id]); if (t.start !== null) return { row: r, col: c, start: t.start, ms: t.ms }; }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Recurrentes

const addInterval = (iso: string, recur: Recur, n = 1): string => {
  if (!iso) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = recur === 'week' ? new Date(y, m - 1, d + 7 * n) : recur === 'month' ? new Date(y, m - 1 + n, Math.min(d, new Date(y, m + n, 0).getDate())) : new Date(y + n, m - 1, Math.min(d, new Date(y + n, m, 0).getDate()));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

/**
 * Siguiente repetición: mismas celdas, fechas desplazadas, casillas desmarcadas, primer estado,
 * cronómetros a cero, subtareas sin hacer y sin historial.
 */
export function nextOccurrence(pm: Pm, row: Row, id: string): Row {
  const recur = row.recur!;
  const cells: Record<string, CellVal> = { ...row.cells };
  for (const c of pm.cols) {
    const v = cells[c.id];
    if (c.type === 'date' && v && typeof v === 'object' && !Array.isArray(v) && (v as DateVal).start) { const d = v as DateVal; cells[c.id] = { start: addInterval(d.start, recur), end: d.end ? addInterval(d.end, recur) : '' }; }
    if (c.type === 'checkbox') cells[c.id] = false;
    if (c.type === 'status') cells[c.id] = allStates(c)[0]?.st.id ?? null;
    if (c.type === 'timer') cells[c.id] = { ms: 0, start: null };
  }
  return { id, cells, desc: row.desc, subs: (row.subs ?? []).map((x) => ({ ...x, id: pmId('sub'), done: false })), deps: [], recur, milestone: row.milestone };
}

// ---------------------------------------------------------------------------------------------
// Formato condicional

/** Primera regla que cumple la fila (el orden de la lista es la prioridad). */
export function ruleFor(pm: Pm, row: Row, tags: Opt[], today: string): Rule | null {
  for (const r of pm.rules ?? []) if (pm.cols.some((c) => c.id === r.filter.col) && matches(pm, row, r.filter, tags, today)) return r;
  return null;
}

// ---------------------------------------------------------------------------------------------
// Cronología (Gantt)

export const DAY_MS = 86_400_000;
const dayIndex = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY_MS); };
const isoOf = (idx: number) => { const d = new Date(idx * DAY_MS); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
export const shiftIsoDay = (iso: string, n: number) => (iso ? isoOf(dayIndex(iso) + n) : iso);
export const daysBetweenIso = (a: string, b: string) => dayIndex(b) - dayIndex(a);
export const PX_PER_DAY: Record<Zoom, number> = { day: 36, week: 14, month: 4 };

export const dateColOf = (pm: Pm) => pm.cols.find((c) => c.id === pm.ui?.dateCol && c.type === 'date') ?? pm.cols.find((c) => c.type === 'date') ?? null;
export const dateOf = (row: Row, col: Col | null): DateVal | null => { const v = col ? row.cells[col.id] : null; return v && typeof v === 'object' && !Array.isArray(v) && (v as DateVal).start ? (v as DateVal) : null; };
export const endOf = (d: DateVal) => d.end || d.start;

/** Orden de las filas en la cronología: el propio de la vista y, después, las nuevas. */
export function timelineOrder(pm: Pm, rows: Row[]): Row[] {
  const order = pm.ui?.order ?? [];
  const pos = new Map(order.map((id, i) => [id, i]));
  return rows.slice().sort((a, b) => (pos.get(a.id) ?? 1e9 + rows.indexOf(a)) - (pos.get(b.id) ?? 1e9 + rows.indexOf(b)));
}

/** Rango visible: desde unos días antes de la primera fecha hasta unos días después de la última (y siempre hoy). */
export function timelineRange(rows: Row[], col: Col | null, today: string, zoom: Zoom): { start: string; days: number } {
  const ds = rows.map((r) => dateOf(r, col)).filter((d): d is DateVal => !!d);
  const pad = zoom === 'day' ? 7 : zoom === 'week' ? 21 : 60;
  const lo = Math.min(dayIndex(today), ...ds.map((d) => dayIndex(d.start))) - pad;
  const hi = Math.max(dayIndex(today), ...ds.map((d) => dayIndex(endOf(d)))) + pad;
  const startIdx = zoom === 'week' ? lo - ((new Date(lo * DAY_MS).getUTCDay() + 6) % 7) : zoom === 'month' ? dayIndex(isoOf(lo).slice(0, 8) + '01') : lo;
  return { start: isoOf(startIdx), days: hi - startIdx + 1 };
}

/** Una dependencia está en conflicto si la fila bloqueada empieza antes de que termine la que la bloquea. */
export function depConflict(pm: Pm, from: Row, to: Row): boolean {
  const col = dateColOf(pm);
  const a = dateOf(from, col), b = dateOf(to, col);
  return !!a && !!b && b.start <= endOf(a);
}

// ---------------------------------------------------------------------------------------------
// El resto de la app («mundo»): para relaciones y resúmenes hace falta ver otras tarjetas y
// tablas. La interfaz lo actualiza con setWorld() cada vez que cambia el estado.

export type WorldCard = { id: string; type: string; title: string; project: string; trashed?: number | null; pm?: Pm; body?: string };
export type WorldProject = { id: string; name: string; trashed?: number | null; hidden?: boolean };
export type World = { cards: WorldCard[]; projects: WorldProject[]; tags: Opt[] };
let WORLD: World = { cards: [], projects: [], tags: [] };
export function setWorld(w: World) { WORLD = w; }
export const getWorld = () => WORLD;

/** Lista de ids (selección múltiple, imágenes): ignora cualquier otra cosa. */
export const strList = (v: CellVal): string[] => (Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : []);
export const relLinks = (v: CellVal): RelLink[] => (Array.isArray(v) ? (v as unknown[]).filter((x): x is RelLink => !!x && typeof x === 'object' && 'kind' in (x as object)) : []);
export const linkKey = (l: RelLink) => (l.kind === 'row' ? `row:${l.card}:${l.row}` : l.kind === 'card' ? `card:${l.card}` : `project:${l.project}`);

/** Datos para mostrar un enlace: título, qué es y dónde está. `missing` si ya no existe. */
export function linkInfo(l: RelLink): { title: string; kind: string; where: string; missing: boolean; row?: Row; table?: WorldCard } {
  if (l.kind === 'project') {
    const p = WORLD.projects.find((x) => x.id === l.project);
    return { title: p?.name ?? t('calc.link.projDel'), kind: t('calc.link.project'), where: '', missing: !p || !!p.trashed };
  }
  const card = WORLD.cards.find((x) => x.id === l.card);
  const proj = card ? WORLD.projects.find((x) => x.id === card.project)?.name ?? '' : '';
  if (l.kind === 'card') return { title: card ? card.title || t('calc.untitled') : t('calc.link.cardDel'), kind: t('calc.link.card'), where: proj, missing: !card || !!card.trashed };
  const row = card?.pm?.rows.find((r) => r.id === l.row);
  return { title: row && card?.pm ? rowTitle(card.pm, row, WORLD.tags) : t('calc.link.rowDel'), kind: t('calc.link.row'), where: (card?.title || t('calc.view.table')) + (proj ? ' · ' + proj : ''), missing: !row, row, table: card };
}

/** Filas enlazadas de la tabla interna de una columna de relación. */
export function linkedRows(col: Col, row: Row): { table: Pm; rows: Row[] } | null {
  const table = WORLD.cards.find((c) => c.id === col.target)?.pm;
  if (!table) return null;
  const ids = relLinks(row.cells[col.id]).filter((l) => l.kind === 'row' && l.card === col.target).map((l) => (l as { row: string }).row);
  return { table, rows: table.rows.filter((r) => ids.includes(r.id)) };
}

// ---------------------------------------------------------------------------------------------
// Resúmenes (rollup) y fórmulas

export const ROLL_FNS: [RollFn, string][] = [lbl('count', 'calc.roll.count'), lbl('sum', 'calc.tot.sum'), lbl('avg', 'calc.tot.avg'), lbl('min', 'calc.tot.min'), lbl('max', 'calc.tot.max'), lbl('pctDone', 'calc.roll.pctDone'), lbl('list', 'calc.roll.list')];

function rollupRaw(pm: Pm, col: Col, row: Row, depth: number): { n: number | null; list: string[] } {
  const rel = pm.cols.find((c) => c.id === col.rel && c.type === 'relation');
  if (!rel) return { n: null, list: [] };
  const links = relLinks(row.cells[rel.id]);
  const lr = linkedRows(rel, row);
  if (col.fn === 'count' || !col.fn) return { n: links.length, list: [] };
  if (!lr) return { n: null, list: [] };
  if (col.fn === 'pctDone') return { n: lr.rows.length ? Math.round((lr.rows.filter((r) => isDone(lr.table, r)).length / lr.rows.length) * 100) : 0, list: [] };
  const target = lr.table.cols.find((c) => c.id === col.prop);
  if (!target) return { n: null, list: [] };
  if (col.fn === 'list') return { n: null, list: lr.rows.map((r) => cellText(lr.table, target, r, WORLD.tags)).filter(Boolean) };
  const nums = lr.rows.map((r) => numValue(lr.table, target, r, WORLD.tags, depth + 1)).filter((x): x is number => x !== null);
  if (!nums.length) return { n: null, list: [] };
  const n = col.fn === 'sum' ? nums.reduce((a, b) => a + b, 0) : col.fn === 'avg' ? nums.reduce((a, b) => a + b, 0) / nums.length : col.fn === 'min' ? Math.min(...nums) : Math.max(...nums);
  return { n, list: [] };
}

/** El resumen tiene su propio formato (no hereda el de la columna resumida). */
function rollupText(pm: Pm, col: Col, row: Row, _tags: Opt[]): string {
  const r = rollupRaw(pm, col, row, 0);
  if (col.fn === 'list') return r.list.join(', ');
  if (r.n === null) return '';
  return col.fn === 'pctDone' ? r.n + '%' : col.fn === 'count' ? String(r.n) : formatNum(col, r.n);
}

/** Valor numérico de una celda (para fórmulas, resúmenes, totales, filtros y orden). */
export function numValue(pm: Pm, col: Col, row: Row, tags: Opt[], depth = 0): number | null {
  if (depth > 8) return null;
  const v = row.cells[col.id];
  const cf = cellFormula(pm, col, row, tags, depth);
  if (cf) return typeof cf.value === 'number' ? cf.value : typeof cf.value === 'boolean' ? Number(cf.value) : null;
  switch (col.type) {
    case 'number': return typeof v === 'number' ? v : null;
    case 'progress': return progress(pm, col, row);
    case 'timer': return timerMs(v) / 3_600_000;
    case 'checkbox': return v ? 1 : 0;
    case 'rollup': return rollupRaw(pm, col, row, depth).n;
    case 'formula': { const r = formulaValue(pm, col, row, tags, depth); return typeof r.value === 'number' ? r.value : typeof r.value === 'boolean' ? Number(r.value) : null; }
    case 'relation': return relLinks(v).length;
    default: return null;
  }
}

/** Valor de una propiedad tal como lo ve una fórmula. */
function propValue(pm: Pm, col: Col, row: Row, tags: Opt[], depth: number): FVal {
  const v = row.cells[col.id];
  const cf = cellFormula(pm, col, row, tags, depth);
  if (cf) { if (cf.error) throw new Error(cf.error); return cf.value; }
  switch (col.type) {
    case 'number': case 'progress': case 'timer': case 'rollup': case 'relation': return col.type === 'rollup' && col.fn === 'list' ? rollupText(pm, col, row, tags) : numValue(pm, col, row, tags, depth);
    case 'checkbox': return !!v;
    case 'date': return v && typeof v === 'object' && !Array.isArray(v) && 'start' in v ? (v as DateVal).start || null : null;
    case 'formula': { const r = formulaValue(pm, col, row, tags, depth + 1); if (r.error) throw new Error(r.error); return r.value; }
    default: return cellText(pm, col, row, tags);
  }
}

const fold2 = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/** Letra de la columna (A, B… Z, AA…) según su posición en la tabla. */
export function colLetter(i: number): string { let n = i + 1, s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
const letterIndex = (l: string) => l.toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
/**
 * Número de fila como en una hoja de cálculo: la fila 1 son las cabeceras y los datos empiezan en la 2.
 * Es la posición en la tabla, sin contar filtros ni el orden de la vista.
 */
export const rowNumber = (pm: Pm, id: string) => { const i = pm.rows.findIndex((r) => r.id === id); return i < 0 ? 0 : i + 2; };

/** `beyond`: fila escrita con número que está más allá de la última (como en Excel, vale vacío). */
type Target = { col: Col; row: Row | null; head: boolean; beyond?: number };
/** Columna y fila a las que apunta una referencia (`row: null` y `head: false` = columna entera). */
function resolveRef(pm: Pm, r: Ref): Target {
  const col = r.k === 'id' ? pm.cols.find((c) => c.id === r.c) : pm.cols[letterIndex(r.col)];
  if (!col) throw new Error(r.k === 'id' ? t('calc.err.noCell') : t('calc.err.noColumn', { col: r.col }));
  if (r.k === 'id' ? r.r === '*' : r.row === 0) return { col, row: null, head: false };
  if (r.k === 'id' ? r.r === '^' : r.row === 1) return { col, row: null, head: true };
  const row = r.k === 'id' ? pm.rows.find((x) => x.id === r.r) : pm.rows[r.row - 2];
  if (!row) { if (r.k === 'id') throw new Error(t('calc.err.noCell')); return { col, row: null, head: false, beyond: r.row - 2 }; }
  return { col, row, head: false };
}

/** Texto de la fórmula tal como se escribe (B2, B2:B9, B:B) → como se guarda (por id de columna y de fila). */
export function storeExpr(pm: Pm, text: string): string {
  return mapRefs(text, (r) => {
    if (r.k !== 'ref') return null;
    const col = pm.cols[letterIndex(r.col)];
    if (!col) return null;
    if (r.row === 0) return `{#${col.id}:*}`;
    if (r.row === 1) return `{#${col.id}:^}`;
    const row = pm.rows[r.row - 2];
    return row ? `{#${col.id}:${row.id}}` : null;
  });
}
/** Al revés: la fórmula guardada se muestra con las letras y números de hoy. Lo que ya no existe se marca como #REF. */
export function displayExpr(pm: Pm, stored: string): string {
  return mapRefs(stored, (r) => {
    if (r.k !== 'id') return null;
    const ci = pm.cols.findIndex((c) => c.id === r.c);
    if (ci < 0) return '#REF';
    if (r.r === '*') return colLetter(ci);
    if (r.r === '^') return colLetter(ci) + '1';
    const ri = pm.rows.findIndex((x) => x.id === r.r);
    return ri < 0 ? '#REF' : colLetter(ci) + (ri + 2);
  });
}

/** ¿La celda contiene una fórmula escrita al estilo Excel («=SUMA(A2:A9)»)? Solo en columnas de número. */
export const isCellFormula = (col: Col, v: CellVal | undefined): boolean => col.type === 'number' && typeof v === 'string' && v.startsWith('=');
/** La fórmula de una celda como la escribe el usuario (con letras y números). */
export const formulaText = (pm: Pm, v: string) => '=' + displayExpr(pm, v.slice(1));
/** Texto escrito por el usuario → lo que se guarda en la celda (la fórmula, por identidad). */
export const toCellFormula = (pm: Pm, typed: string) => '=' + storeExpr(pm, typed.replace(/^=/, ''));

/** Evalúa la fórmula de una celda (null si la celda no tiene fórmula). */
export function cellFormula(pm: Pm, col: Col, row: Row, tags: Opt[], depth = 0): { value: FVal; error: string | null } | null {
  const v = row.cells[col.id];
  return isCellFormula(col, v) ? evalExpr(pm, (v as string).slice(1), col, row, tags, depth) : null;
}

export function formulaValue(pm: Pm, col: Col, row: Row, tags: Opt[], depth = 0): { value: FVal; error: string | null } {
  return evalExpr(pm, col.expr ?? '', col, row, tags, depth);
}

function evalExpr(pm: Pm, expr: string, col: Col, row: Row, tags: Opt[], depth: number): { value: FVal; error: string | null } {
  if (!expr.trim()) return { value: null, error: null };
  if (depth > 8) return { value: null, error: t('calc.err.circular') };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const read = (c: Col, r: Row) => {
      if (c.id === col.id && r.id === row.id) throw new Error(t('calc.err.circular'));
      return propValue(pm, c, r, tags, depth + 1);
    };
    const value = runFormula(expr, (name) => {
      const c = pm.cols.find((x) => fold2(x.name) === fold2(name)) ?? (/^[A-Za-z]{1,3}$/.test(name.trim()) ? pm.cols[letterIndex(name.trim())] : undefined);
      if (!c) throw new Error(t('calc.err.noProp', { name }));
      return read(c, row);
    }, today, {
      cell: (ref) => {
        const tg = resolveRef(pm, ref);
        if (tg.head) return tg.col.name;
        if (tg.beyond !== undefined) return null;
        if (!tg.row) throw new Error(t('calc.err.wholeCol'));
        return read(tg.col, tg.row);
      },
      range: (a, b) => {
        const A = resolveRef(pm, a), B = resolveRef(pm, b);
        const c0 = Math.min(pm.cols.indexOf(A.col), pm.cols.indexOf(B.col)), c1 = Math.max(pm.cols.indexOf(A.col), pm.cols.indexOf(B.col));
        // Índice de fila: -1 = cabecera; una columna entera abarca todas las filas.
        const whole = (t: Target) => !t.row && !t.head && t.beyond === undefined;
        const ix = (t: Target) => (t.head ? -1 : t.beyond !== undefined ? t.beyond : pm.rows.indexOf(t.row!));
        const all = whole(A) || whole(B);
        const r0 = all ? -1 : Math.min(ix(A), ix(B)), r1 = all ? pm.rows.length - 1 : Math.min(pm.rows.length - 1, Math.max(ix(A), ix(B)));
        const out: FVal[] = [];
        for (let ri = r0; ri <= r1; ri++) {
          for (let ci = c0; ci <= c1; ci++) {
            const c = pm.cols[ci];
            if (ri < 0) { out.push(c.name); continue; }
            const r = pm.rows[ri];
            if (r.archived) continue;
            out.push(read(c, r));
          }
        }
        return out;
      },
    });
    return { value: typeof value === 'number' && !isFinite(value) ? null : value, error: null };
  } catch (e) { return { value: null, error: (e as Error).message }; }
}

export function formatFVal(col: Col, v: FVal): string {
  if (v === null) return '';
  if (typeof v === 'number') return formatNum(col, v);
  if (typeof v === 'boolean') return v ? t('calc.yes') : t('calc.no');
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate({ start: v, end: '' });
  return v;
}
