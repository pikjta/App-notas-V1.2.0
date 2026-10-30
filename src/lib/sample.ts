// Datos de ejemplo de la maqueta («Cuaderno · Funciones de la maqueta», apartados 17 y 18).
// Se cargan solo en un cuaderno nuevo. Los textos viven en i18n/es/sample.ts (claves «sam.…») y se crean en el idioma elegido.
import { getLang, setLang, t } from '../i18n';
import type { Key, Vars } from '../i18n';
import { builtinCalendars, calendarToDoc, cardToDoc, DEFAULT_SETTINGS, DEFAULT_THEME, eventToDoc, folderToDoc, JOURNAL_ID, projectToDoc, settingsToDoc, tagsToDoc, assetToDoc } from './model';
import type { Asset, Language, Card, CalEvent, CheckItem, Doc, Folder, Project, Settings, Stroke, Theme } from './model';
import { allStates, pmTemplate } from './pm';
import type { Col, Pm, Row } from './pm';
import { dailyId } from './store';

/** Texto de una clave «sam.…» construida al vuelo (los ids de tarjeta, fila, etc. forman parte de la clave). */
const s = (key: string, vars?: Vars): string => t(key as Key, vars);

const STROKES: Stroke[] = [{"c":"#1F1D1A","s":3,"p":[[20.0,200.0],[29.0,194.9],[38.0,190.0],[47.0,185.4],[56.0,181.2],[65.0,177.5],[74.0,174.4],[83.0,172.1],[92.0,170.5],[101.0,169.8],[110.0,169.8],[119.0,170.8],[128.0,172.5],[137.0,174.9],[146.0,178.0],[155.0,181.6],[164.0,185.7],[173.0,190.1],[182.0,194.6],[191.0,199.2],[200.0,203.7],[209.0,207.9],[218.0,211.7],[227.0,215.0],[236.0,217.6],[245.0,219.6],[254.0,220.8],[263.0,221.2],[272.0,220.8],[281.0,219.5],[290.0,217.4],[299.0,214.6],[308.0,211.2],[317.0,207.1],[326.0,202.6],[335.0,197.8],[344.0,192.8],[353.0,187.7],[362.0,182.7],[371.0,177.9],[380.0,173.5]],"o":1},{"c":"#1F1D1A","s":2,"p":[[20.0,213.2],[29.0,211.8],[38.0,211.1],[47.0,211.1],[56.0,212.0],[65.0,213.5],[74.0,215.7],[83.0,218.4],[92.0,221.4],[101.0,224.7],[110.0,228.0],[119.0,231.1],[128.0,233.9],[137.0,236.2],[146.0,237.8],[155.0,238.8],[164.0,239.0],[173.0,238.4],[182.0,237.1],[191.0,235.1],[200.0,232.6],[209.0,229.6],[218.0,226.4],[227.0,223.1],[236.0,219.9],[245.0,217.0],[254.0,214.5],[263.0,212.7],[272.0,211.5],[281.0,211.0],[290.0,211.3],[299.0,212.4],[308.0,214.2],[317.0,216.5],[326.0,219.4],[335.0,222.5],[344.0,225.8],[353.0,229.0],[362.0,232.1],[371.0,234.7],[380.0,236.8]],"o":1},{"c":"#F28C38","s":4,"p":[[334.0,80.0],[333.5,85.9],[331.9,91.6],[329.4,97.0],[326.0,101.9],[321.9,106.0],[317.0,109.4],[311.6,111.9],[305.9,113.5],[300.0,114.0],[294.1,113.5],[288.4,111.9],[283.0,109.4],[278.1,106.0],[274.0,101.9],[270.6,97.0],[268.1,91.6],[266.5,85.9],[266.0,80.0],[266.5,74.1],[268.1,68.4],[270.6,63.0],[274.0,58.1],[278.1,54.0],[283.0,50.6],[288.4,48.1],[294.1,46.5],[300.0,46.0],[305.9,46.5],[311.6,48.1],[317.0,50.6],[321.9,54.0],[326.0,58.1],[329.4,63.0],[331.9,68.4],[333.5,74.1],[334.0,80.0]],"o":1},{"c":"#5E7A2E","s":3,"p":[[95,205.0],[95,198.0],[95,191.0],[95,184.0],[95,177.0],[95,170.0],[95,163.0],[95,156.0],[95,149.0],[95,142.0],[95,135.0]],"o":1},{"c":"#5E7A2E","s":5,"p":[[125.0,125.0],[124.3,130.0],[122.4,134.8],[119.3,139.1],[115.1,142.8],[110.0,145.8],[104.3,147.8],[98.1,148.9],[91.9,148.9],[85.7,147.8],[80.0,145.8],[74.9,142.8],[70.7,139.1],[67.6,134.8],[65.7,130.0],[65.0,125.0],[65.7,120.0],[67.6,115.2],[70.7,110.9],[74.9,107.2],[80.0,104.2],[85.7,102.2],[91.9,101.1],[98.1,101.1],[104.3,102.2],[110.0,104.2],[115.1,107.2],[119.3,110.9],[122.4,115.2],[124.3,120.0],[125.0,125.0]],"o":1}];
/** Ids y nivel del plan de pruebas (tarjeta k14); el texto de cada elemento es «sam.plan.<id>». */
const PLAN_IDS: [string, number][] = [["tg1",0],["tt2",1],["tt3",1],["tt4",1],["tt5",1],["tt6",1],["tt7",1],["tt8",1],["tt9",1],["tt10",1],["tt11",1],["tt12",1],["tt13",1],["tg14",0],["tt15",1],["tt16",1],["tt17",1],["tt18",1],["tt19",1],["tt20",1],["tt21",1],["tt22",1],["tt23",1],["tg24",0],["tt25",1],["tt26",1],["tt27",1],["tt28",1],["tt29",1],["tt30",1],["tt31",1],["tt32",1],["tg33",0],["tt34",1],["tt35",1],["tt36",1],["tt37",1],["tt38",1],["tt39",1],["tt40",1],["tt41",1],["tg42",0],["tt43",1],["tt44",1],["tt45",1],["tt46",1],["tt47",1],["tt48",1],["tt49",1],["tt50",1]];
const PLAN_DONE = new Set(['tt43', 'tt44', 'tt45', 'tt46', 'tt47', 'tt48', 'tt49', 'tt34', 'tt35', 'tt36', 'tt37', 'tt38', 'tt39', 'tt40', 'tt41', 'tt25', 'tt26', 'tt27', 'tt28', 'tt29', 'tt30', 'tt32', 'tt15', 'tt16', 'tt17', 'tt18', 'tt19', 'tt20', 'tt21', 'tt22', 'tt23', 'tt2', 'tt3', 'tt4', 'tt5', 'tt6', 'tt7', 'tt8', 'tt9', 'tt10', 'tt11', 'tt12', 'tt13']);

const theme = (board: Theme['board'], texture: Theme['texture'], card: Theme['card'], cardTexture: Theme['cardTexture']): Theme => ({ board, texture, card, cardTexture });
const svgImg = (bg: string, hill: string, sun: string, hill2: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><rect width='600' height='400' fill='${bg}'/><circle cx='420' cy='150' r='70' fill='${sun}'/><path d='M0 290 L140 170 L250 250 L370 150 L600 300 L600 400 L0 400Z' fill='${hill2}'/><path d='M0 330 L180 250 L330 320 L470 240 L600 330 L600 400 L0 400Z' fill='${hill}'/></svg>`);

type Base = { id: string; project: string; x: number; y: number; w: number; h?: number; z: number; title: string; color?: string | null };
let order = 0;
const base = (b: Base) => ({ id: b.id, project: b.project, x: b.x, y: b.y, w: b.w, h: b.h ?? 0, z: b.z, title: b.title, color: b.color ?? null, pos: order++, trashed: null });

const check = (b: Base, items: [string, string, number?][]): Card => ({ ...base(b), type: 'check', items: items.map(([id, text, lvl]): CheckItem => ({ id, text, done: PLAN_DONE.has(id) || ['a1', 'a2', 'a3', 'b1', 'c2', 'd1'].includes(id), level: lvl ?? 0 })) });
const reminder = (b: Base, when: string, bell: boolean): Card => ({ ...base(b), type: 'reminder', when, bell, note: '' });
const note = (b: Base, body: string): Card => ({ ...base(b), type: 'note', body });

/** Cuaderno de ejemplo: «Mi espacio» y cinco tareas principales, notas del Diario, calendarios y etiquetas. Todo en el idioma pedido. */
export function sampleDocs(lang: Language = 'es'): Doc[] {
  const prev = getLang();
  setLang(lang);
  try { return build(lang); } finally { setLang(prev); }
}

function build(lang: Language): Doc[] {
  order = 0;
  const docs: Doc[] = [];
  // Nombres traducidos de cada elemento: se inyectan como {p1}, {k20}, {px5}… en los enlaces [[…]] de los Markdown.
  const N: Vars = {};
  for (const id of ['p1', 'p2', 'p3', 'p4', 'p5']) N[id] = s('sam.proj.' + id);
  for (const id of ['h1', 'h2', 'h3', 'h4', 'h5', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9', 'k10', 'k11', 'k12', 'k13', 'k14', 'k20', 'k21', 'k22', 'k23', 'k24', 'k25']) N[id] = s(`sam.card.${id}.title`);
  for (const id of ['px0', 'px1', 'px2', 'px3', 'px4', 'px5', 'px6', 'px7']) N[id] = s('sam.row.' + id);
  const body = (key: string) => s(key, N);
  const ttl = (id: string) => N[id] as string;
  /** Elementos de una checklist: [id, texto, nivel]. */
  const items = (card: string, list: [string, number?][]): [string, string, number?][] => list.map(([id, lvl]) => [id, s(`sam.card.${card}.i.${id}`), lvl]);

  const folders: Folder[] = [{ id: 'f1', name: s('sam.folder.f1'), collapsed: false, pos: 0 }, { id: 'f2', name: s('sam.folder.f2'), collapsed: false, pos: 1 }];
  const projects: Project[] = [
    { id: 'home', name: s('sam.proj.home'), color: '#3A4F7A', home: true, folder: null, pos: 0, trashed: null, links: [], theme: theme('papel', 'puntos', 'papel', 'liso'), titleFont: { family: 'elegante', size: 'XL', weight: 'bold', italic: false, color: null } },
    { id: 'p1', name: ttl('p1'), color: '#B4532A', folder: 'f1', pos: 1, trashed: null, links: [], theme: theme('papel', 'liso', 'papel', 'liso') },
    { id: 'p2', name: ttl('p2'), color: '#2F6690', folder: 'f2', pos: 2, trashed: null, links: [], theme: theme('noche', 'puntos', 'grafito', 'liso') },
    { id: 'p3', name: ttl('p3'), color: '#5E7A2E', folder: 'f1', pos: 3, trashed: null, links: [], theme: theme('papel', 'cuaderno', 'crema', 'liso') },
    { id: 'p4', name: ttl('p4'), color: '#7A3E6B', folder: null, pos: 4, trashed: null, links: [], theme: theme('papel', 'acuarela', 'blanco', 'liso') },
    { id: 'p5', name: ttl('p5'), color: '#0E7C7B', folder: null, pos: 5, trashed: null, theme: theme('papel', 'liso', 'papel', 'liso'),
      links: [{ id: 'ln1', from: 'k21', to: 'k20', label: s('sam.link.ln1'), color: null, both: false }, { id: 'ln2', from: 'k23', to: 'k24', label: s('sam.link.ln2'), color: null, both: false }, { id: 'ln3', from: 'k25', to: 'k23', label: s('sam.link.ln3'), color: '#E2B65B', both: false }] },
  ];

  const cards: Card[] = [];
  // Mi espacio
  const h = (id: string, x: number, y: number, w: number, z: number) => ({ id, project: 'home', x, y, w, z, title: ttl(id) });
  cards.push(note(h('h1', 0, 0, 432, 1), body('sam.card.h1.body')));
  cards.push({ ...base(h('h2', 456, 0, 312, 2)), type: 'widget', widget: 'today' });
  cards.push({ ...base(h('h3', 792, 0, 276, 3)), type: 'widget', widget: 'projects' });
  cards.push({ ...base(h('h4', 456, 216, 312, 4)), type: 'widget', widget: 'upcoming' });
  cards.push(check(h('h5', 0, 384, 432, 5), items('h5', [['hw1'], ['hw2'], ['hw3']])));
  // Mudanza de octubre
  cards.push(check({ id: 'k1', project: 'p1', x: 0, y: 0, w: 330, z: 1, title: ttl('k1') }, items('k1', [['g1'], ['a1', 1], ['a2', 1], ['g2'], ['a3', 1], ['a4', 1], ['a6', 1], ['a5']])));
  cards.push(reminder({ id: 'k2', project: 'p1', x: 354, y: 0, w: 390, z: 2, title: ttl('k2') }, '2026-10-02T10:00', true));
  cards.push({ ...base({ id: 'k3', project: 'p1', x: 768, y: 0, w: 300, z: 3, title: ttl('k3') }), type: 'table', heads: [s('sam.card.k3.head1'), s('sam.card.k3.head2'), s('sam.card.k3.head3')], rows: [{ id: 't1', cells: [s('sam.card.k3.t1.c1'), '180 €', s('sam.card.k3.t1.c3')] }, { id: 't2', cells: [s('sam.card.k3.t2.c1'), '45 €', s('sam.card.k3.t2.c3')] }, { id: 't3', cells: [s('sam.card.k3.t3.c1'), '90 €', s('sam.card.k3.t3.c3')] }] });
  cards.push(check({ id: 'k4', project: 'p1', x: 354, y: 176, w: 300, z: 4, title: ttl('k4') }, items('k4', [['b1'], ['b2'], ['b3']])));
  cards.push(note({ id: 'k5', project: 'p1', x: 0, y: 500, w: 330, h: 190, z: 5, title: ttl('k5') }, body('sam.card.k5.body')));
  // Curso de fotografía
  cards.push(check({ id: 'k6', project: 'p2', x: 0, y: 0, w: 380, z: 1, title: ttl('k6') }, items('k6', [['c1'], ['c2'], ['c3']])));
  cards.push(reminder({ id: 'k7', project: 'p2', x: 410, y: 48, w: 360, z: 2, title: ttl('k7') }, '2026-10-09T23:59', false));
  // Casa · semana
  cards.push(check({ id: 'k8', project: 'p3', x: 0, y: 0, w: 290, z: 1, title: ttl('k8') }, items('k8', [['d1'], ['d2'], ['d3'], ['d4']])));
  cards.push(reminder({ id: 'k9', project: 'p3', x: 314, y: 0, w: 360, z: 2, title: ttl('k9') }, '2026-09-30T19:00', true));
  cards.push(reminder({ id: 'k12', project: 'p3', x: 314, y: 168, w: 360, z: 3, title: ttl('k12') }, '2026-09-26T12:00', true));
  // Diseño de mi app
  cards.push(reminder({ id: 'k10', project: 'p4', x: 0, y: 0, w: 460, z: 2, title: ttl('k10') }, '2026-09-28T18:00', true));
  cards.push(note({ id: 'k11', project: 'p4', x: 490, y: 0, w: 420, h: 240, z: 1, title: ttl('k11') }, body('sam.card.k11.body')));
  cards.push(note({ id: 'k13', project: 'p4', x: 0, y: 192, w: 460, h: 280, z: 3, title: ttl('k13'), color: '#FFF3C4' }, body('sam.card.k13.body')));
  cards.push(check({ id: 'k14', project: 'p4', x: 490, y: 264, w: 460, z: 4, title: ttl('k14') }, PLAN_IDS.map(([id, lvl]) => [id, s('sam.plan.' + id), lvl] as [string, string, number])));

  // Encargo · Mural Café Aurora
  const tags = [{ id: 'tg1', name: s('sam.tag.tg1'), color: 'blue' }, { id: 'tg2', name: s('sam.tag.tg2'), color: 'green' }, { id: 'tg3', name: s('sam.tag.tg3'), color: 'orange' }, { id: 'tg4', name: s('sam.tag.tg4'), color: 'red' }, { id: 'tg5', name: s('sam.tag.tg5'), color: 'purple' }];
  const T: Pm = pmTemplate();
  // La plantilla se localiza por posición (no por nombre), así no depende del idioma.
  const [cTask, cStatus, cProgress, cOwner, cTags, cDates, cHours, cBudget, cInvoiced] = T.cols;
  const ST = allStates(cStatus).map(({ st }) => st.id);   // 0 negociación · 1 contratado · 2 bocetos · 3 primera versión · 4 revisión interna…
  const OW = (cOwner.opts ?? []).map((o) => o.id);        // 0 yo · 1 cliente · 2 colaborador
  const ME = 0, CLIENT = 1, COLLAB = 2, HIRED = 1, SKETCHES = 2, FIRST = 3, REVIEW = 4;
  const now = Date.now(), day = 86_400_000, hr = 3_600_000;
  const TIME: Col = { id: 'pxc10', name: s('sam.col.time'), type: 'timer', w: 130 };
  T.cols = [...T.cols, TIME];
  const row = (id: string, st: number, resp: number, tg: string[], a: string, b: string, hours: number, eur: number, fact: boolean, extra: Partial<Row> = {}): Row => ({
    id, hist: st >= 0 ? [{ state: ST[st], at: now }] : [],
    cells: { [cTask.id]: N[id] as string, [cStatus.id]: st >= 0 ? ST[st] : null, [cOwner.id]: OW[resp], [cTags.id]: tg, [cDates.id]: a ? { start: a, end: b } : null, [cHours.id]: hours, [cBudget.id]: eur, [cInvoiced.id]: fact },
    ...extra,
  });
  const px2hist = [[SKETCHES, 20], [FIRST, 12], [REVIEW, 4]].map(([n, d]) => ({ state: ST[n], at: now - d * day }));
  T.rows = [
    row('px1', HIRED, CLIENT, ['tg3'], '2026-09-01', '2026-09-03', 3, 0, true),
    row('px2', REVIEW, ME, ['tg1'], '2026-09-07', '2026-09-18', 14, 600, true, { desc: body('sam.row.px2.body'), hist: px2hist, subs: [{ id: 'sbx1', text: s('sam.row.px2.sub1'), done: true }, { id: 'sbx2', text: s('sam.row.px2.sub2'), done: true }, { id: 'sbx3', text: s('sam.row.px2.sub3'), done: false }] }),
    row('px3', FIRST, ME, ['tg2'], '2026-09-21', '2026-09-30', 10, 300, false),
    row('px4', SKETCHES, CLIENT, ['tg3', 'tg4'], '2026-09-25', '', 2, 0, false, { milestone: true }),
    row('px5', -1, ME, ['tg2'], '2026-10-05', '2026-10-23', 48, 2400, false),
    row('px6', -1, COLLAB, ['tg2', 'tg4'], '2026-10-24', '2026-10-27', 6, 250, false),
    row('px7', -1, ME, ['tg3'], '2026-10-02', '', 1, 0, false, { recur: 'week' }),
    row('px0', HIRED, ME, ['tg3'], '2026-08-28', '', 1, 0, true, { archived: true }),
  ];
  const R: Record<string, Row> = {}; T.rows.forEach((r) => { R[r.id] = r; });
  const assets: Asset[] = [
    { id: 'imgs1', card: 'k20', mime: 'image/svg+xml', data: svgImg('#F6D7B0', '#7A4E2D', '#F28C38', '#B9774A') },
    { id: 'imgs2', card: 'k20', mime: 'image/svg+xml', data: svgImg('#DCE7EF', '#3D5A6C', '#F6C744', '#7FA0B5') },
    { id: 'imgs3', card: 'k20', mime: 'image/svg+xml', data: svgImg('#FBEBD6', '#C0532B', '#E8A33B', '#E37B40') },
    { id: 'imgref', card: 'k23', mime: 'image/svg+xml', data: svgImg('#F6D7B0', '#7A4E2D', '#F28C38', '#B9774A') },
  ];
  const col = (id: string, name: string, type: Col['type'], w: number, extra: Partial<Col> = {}): Col => ({ id, name, type, w, ...extra });
  const IMG = col('pxc11', s('sam.col.refs'), 'image', 170);
  const MAT = col('pxc12', s('sam.col.materials'), 'relation', 230, { target: 'k22' });
  const ROLL = col('pxc13', s('sam.col.matCost'), 'rollup', 150, { rel: 'pxc12', prop: 'mtc2', fn: 'sum', fmt: 'eur', total: 'sum' });
  // Las fórmulas citan las columnas por su nombre real en este idioma.
  const hoursRef = `prop("${cHours.name}")`, budgetRef = `prop("${cBudget.name}")`;
  const FX1 = col('pxc14', s('sam.col.eurHour'), 'formula', 120, { fmt: 'eur', expr: `if(${hoursRef} > 0, round(${budgetRef} / ${hoursRef}, 1), 0)`, total: 'avg' });
  const FX2 = col('pxc15', s('sam.col.margin'), 'formula', 120, { fmt: 'eur', expr: `${budgetRef} - prop("${ROLL.name}")`, total: 'sum' });
  T.cols = [...T.cols, IMG, MAT, ROLL, FX1, FX2];
  R.px2.cells.pxc11 = ['imgs1', 'imgs2']; R.px3.cells.pxc11 = ['imgs3'];
  const rel = (...ids: string[]) => ids.map((r) => ({ kind: 'row' as const, card: 'k22', row: r }));
  R.px3.cells.pxc12 = rel('mt1'); R.px5.cells.pxc12 = rel('mt1', 'mt3', 'mt4', 'mt5'); R.px6.cells.pxc12 = rel('mt2');
  R.px2.cells.pxc10 = { ms: 5.5 * hr, start: null }; R.px3.cells.pxc10 = { ms: 1.75 * hr, start: null };
  T.rules = [{ id: 'ru1', filter: { id: 'rf1', col: cDates.id, op: 'overdue', val: '' }, color: 'red', bold: false }, { id: 'ru2', filter: { id: 'rf2', col: cProgress.id, op: 'eq', val: '100' }, color: 'green', bold: false }];

  const mat: Pm = {
    cols: [col('mtc1', s('sam.mat.col.name'), 'text', 240, { total: 'count' }), col('mtc2', s('sam.mat.col.cost'), 'number', 120, { fmt: 'eur', total: 'sum' }), col('mtc3', s('sam.mat.col.supplier'), 'select', 150, { opts: [{ id: 'mo1', name: s('sam.mat.sup.mo1'), color: 'yellow' }, { id: 'mo2', name: s('sam.mat.sup.mo2'), color: 'brown' }] }), col('mtc4', s('sam.mat.col.bought'), 'checkbox', 110, { total: 'pct' })],
    rows: [
      { id: 'mt1', cells: { mtc1: s('sam.mat.mt1'), mtc2: 180, mtc3: 'mo1', mtc4: true }, hist: [] },
      { id: 'mt2', cells: { mtc1: s('sam.mat.mt2'), mtc2: 65, mtc3: 'mo1', mtc4: false }, hist: [] },
      { id: 'mt3', cells: { mtc1: s('sam.mat.mt3'), mtc2: 40, mtc3: 'mo1', mtc4: true }, hist: [] },
      { id: 'mt4', cells: { mtc1: s('sam.mat.mt4'), mtc2: 220, mtc3: 'mo2', mtc4: false }, hist: [] },
      { id: 'mt5', cells: { mtc1: s('sam.mat.mt5'), mtc2: 12, mtc3: 'mo2', mtc4: false }, hist: [] },
    ],
    filters: [], conj: 'and', sorts: [],
  };
  cards.push({ ...base({ id: 'k20', project: 'p5', x: 0, y: 0, w: 620, z: 1, title: ttl('k20') }), type: 'pm', pm: T });
  cards.push({ ...base({ id: 'k21', project: 'p5', x: 644, y: 0, w: 380, h: 200, z: 2, title: ttl('k21') }), type: 'note', body: body('sam.card.k21.body') });
  cards.push({ ...base({ id: 'k22', project: 'p5', x: 644, y: 224, w: 380, z: 3, title: ttl('k22') }), type: 'pm', pm: mat });
  cards.push({ ...base({ id: 'k23', project: 'p5', x: 0, y: 600, w: 300, z: 4, title: ttl('k23') }), type: 'image', asset: 'imgref', name: s('sam.card.k23.file') });
  cards.push({ ...base({ id: 'k24', project: 'p5', x: 328, y: 600, w: 290, z: 5, title: ttl('k24') }), type: 'palette', colors: ['#F6D7B0', '#F28C38', '#B9774A', '#7A4E2D'], fmt: 'hex', source: 'k23' });
  cards.push({ ...base({ id: 'k25', project: 'p5', x: 644, y: 600, w: 380, z: 6, title: ttl('k25') }), type: 'sketch', strokes: STROKES, tool: 'pen', ink: '#1F1D1A', size: 4 });

  // Notas diarias
  const journal: Project = { id: JOURNAL_ID, name: s('sam.proj.journal'), color: '#8A6A3A', hidden: true, folder: null, pos: -1, trashed: null, links: [], theme: DEFAULT_THEME };
  const daily: Card[] = ['2026-09-25', '2026-09-27', '2026-09-28'].map((d, i) => ({ ...base({ id: dailyId(d), project: JOURNAL_ID, x: 0, y: 0, w: 640, z: 1, title: s('sam.daily.title') }), pos: i, type: 'note' as const, day: d, body: body(`sam.daily.${d}.body`) }));

  // Calendarios
  const ev = (id: string) => s(`sam.event.${id}.title`), evNote = (id: string) => s(`sam.event.${id}.note`);
  const events: CalEvent[] = [
    { id: 'm1', calendar: 'cal-main', title: ev('m1'), start: '2026-10-01T08:30', end: '2026-10-01T09:30', allDay: false, note: '', repeat: 'none' },
    { id: 'e1', calendar: 'cal-birthdays', title: ev('e1'), start: '2026-09-12', end: '2026-09-12', allDay: true, note: evNote('e1'), repeat: 'year' },
    { id: 'e2', calendar: 'cal-birthdays', title: ev('e2'), start: '2026-09-30', end: '2026-09-30', allDay: true, note: evNote('e2'), repeat: 'year' },
    { id: 'e3', calendar: 'cal-birthdays', title: ev('e3'), start: '2026-10-03', end: '2026-10-03', allDay: true, note: evNote('e3'), repeat: 'year' },
    { id: 'e4', calendar: 'cal-birthdays', title: ev('e4'), start: '2026-10-14T19:30', end: '2026-10-14T20:00', allDay: false, note: '', repeat: 'year' },
  ];
  const settings: Settings = { ...DEFAULT_SETTINGS, lang, weekNumbers: true, dayStart: 6, dayEnd: 24, notify: true, sound: true, showMissed: true };

  docs.push(...folders.map(folderToDoc), ...[...projects, journal].map(projectToDoc), ...[...cards, ...daily].map(cardToDoc), ...assets.map(assetToDoc), tagsToDoc(tags), settingsToDoc(settings));
  docs.push(...builtinCalendars().map(calendarToDoc), ...events.map(eventToDoc));
  return docs;
}
