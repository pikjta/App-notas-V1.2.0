// Estado de la app: un reductor puro (fácil de probar), un historial para deshacer/rehacer
// y una cola que guarda en el núcleo solo los documentos que han cambiado.
import { applyFmt } from './format';
import type { CellFmt, FmtPatch } from './format';
import type { Backend } from './backend';
import { cellText, convert, pmReduce, pmTemplate, runningTimer, strList } from './pm';
import { applyImport } from './pmio';
import type { CsvPlan, PmTemplate } from './pmio';
import type { ColType, Opt, PmOp } from './pm';
import type { FontStyle } from './appearance';
import { assetToDoc, builtinCalendars, calendarToDoc, cardToDoc, folderToDoc, CARD_KIND_LABEL, DEFAULT_SETTINGS, DEFAULT_THEME, eventToDoc, JOURNAL_ID, projectToDoc, settingsToDoc, pmTemplatesToDoc, tagsToDoc, uid } from './model';
import { normalizeLevels } from './checklist';
import { t } from '../i18n';
import type { BackupSettings, Asset, Folder, CalEvent, Calendar, CalView, Card, CardType, CheckItem, Doc, Link, NoteCard, Project, Settings, Stroke, TableRow, Theme, WidgetKind } from './model';

export type View = 'board' | 'trash' | 'today' | 'reminders' | 'journal' | 'calendar' | 'graph';
export type State = { folders: Folder[]; pmTemplates: PmTemplate[]; tags: Opt[]; projects: Project[]; cards: Card[]; settings: Settings; assets: Record<string, Asset>; calendars: Calendar[]; events: CalEvent[]; sel: string; view: View; day: string; cal: { view: CalView; anchor: string } };

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const emptyState: State = { folders: [], pmTemplates: [], tags: [], projects: [], cards: [], settings: DEFAULT_SETTINGS, assets: {}, calendars: builtinCalendars(), events: [], sel: 'home', view: 'board', day: todayKey(), cal: { view: DEFAULT_SETTINGS.calView, anchor: todayKey() } };
/** Plantilla de la nota del día, en el idioma actual. */
export const journalTemplate = (): string => t('ui.store.journalTemplate');
export const dailyId = (day: string) => 'daily_' + day;

type CardPatch = { [K in keyof Card]?: unknown } & Record<string, unknown>;

export type Action =
  | { t: 'load'; projects: Project[]; cards: Card[]; settings: Settings; assets: Record<string, Asset>; calendars?: Calendar[]; events?: CalEvent[]; tags?: Opt[]; pmTemplates?: PmTemplate[]; folders?: Folder[] }
  | { t: 'pm'; card: string; op: PmOp }
  | { t: 'pmConvert'; card: string; col: string; type: ColType }
  | { t: 'tags'; tags: Opt[] }
  | { t: 'backupDone'; level: 'auto' | 'internal' | 'manual'; patch: Record<string, unknown> }
  | { t: 'pmImport'; card: string; plan: CsvPlan }
  | { t: 'pmImage'; card: string; row: string; col: string; asset: Asset }
  | { t: 'pmImageRemove'; card: string; row: string; col: string; asset: string }
  | { t: 'pmTemplates'; list: PmTemplate[] }
  | { t: 'calView'; view: CalView }
  | { t: 'calGo'; anchor: string }
  | { t: 'addEvent'; event: CalEvent }
  | { t: 'patchEvent'; id: string; patch: Partial<Omit<CalEvent, 'id'>> }
  | { t: 'removeEvent'; id: string }
  | { t: 'addCalendar'; calendar: Calendar }
  | { t: 'patchCalendar'; id: string; patch: Partial<Omit<Calendar, 'id' | 'kind'>> }
  | { t: 'removeCalendar'; id: string }
  | { t: 'importEvents'; calendar: Calendar | null; target: string; events: CalEvent[] }
  | { t: 'addImage'; card: Card; asset: Asset }
  | { t: 'setAsset'; card: string; asset: Asset; name: string }
  | { t: 'addStroke'; card: string; stroke: Stroke }
  | { t: 'addLink'; project: string; link: Link }
  | { t: 'patchLink'; project: string; id: string; patch: Partial<Omit<Link, 'id'>> }
  | { t: 'removeLink'; project: string; id: string }
  | { t: 'setTheme'; project: string; patch: Partial<Theme> }
  | { t: 'applyThemeAll'; theme: Theme }
  | { t: 'setTitleFont'; project: string; font: FontStyle | null }
  | { t: 'select'; id: string }
  | { t: 'day'; day: string }
  | { t: 'addDaily'; day: string; body: string }
  | { t: 'completeReminder'; id: string; done: boolean }
  | { t: 'snoozeReminder'; id: string; until: string }
  | { t: 'markNotified'; ids: string[]; at: number }
  | { t: 'view'; view: State['view'] }
  | { t: 'addProject'; id: string; name: string; color: string; folder?: string | null }
  /** Mueve una tarea principal a una carpeta (o a «sin carpeta») y la deja antes de `before` (al final si es null). Un solo paso de deshacer. */
  | { t: 'moveProject'; id: string; folder: string | null; before: string | null }
  | { t: 'addFolder'; id: string; name: string }
  | { t: 'patchFolder'; id: string; patch: Partial<Omit<Folder, 'id'>> }
  | { t: 'deleteFolder'; id: string }
  | { t: 'patchProject'; id: string; patch: Partial<Omit<Project, 'id'>> }
  | { t: 'trashProject'; id: string }
  | { t: 'restoreProject'; id: string }
  | { t: 'purgeProject'; id: string }
  | { t: 'addCard'; card: Card }
  | { t: 'duplicateCard'; id: string }
  | { t: 'patchCard'; id: string; patch: CardPatch }
  | { t: 'moveCard'; id: string; x: number; y: number }
  | { t: 'resizeCard'; id: string; w: number; h: number }
  | { t: 'raiseCard'; id: string }
  | { t: 'trashCard'; id: string }
  | { t: 'restoreCard'; id: string }
  | { t: 'purgeCard'; id: string }
  | { t: 'emptyTrash' }
  | { t: 'emptyBoardTrash'; project: string }
  | { t: 'checkItem'; card: string; item: string; patch: Partial<CheckItem> }
  | { t: 'addCheckItem'; card: string; after: string | null; id: string; level?: number }
  | { t: 'removeCheckItem'; card: string; item: string }
  | { t: 'setCheckItems'; card: string; items: CheckItem[] }
  | { t: 'tableCell'; card: string; row: string; col: number; value: string }
  | { t: 'tableHead'; card: string; col: number; value: string }
  | { t: 'tableAddRow'; card: string; id: string }
  /** Formato de varias tareas de una checklist a la vez. */
  | { t: 'checkFormat'; card: string; ids: string[]; patch: FmtPatch }
  /** Formato de varias celdas de una Tabla (r = -1 son las cabeceras). */
  | { t: 'tableFormat'; card: string; cells: { r: number; c: number }[]; patch: FmtPatch }
  /** Escribe una matriz de textos desde (r0, c0); r0 = -1 es la fila de cabeceras. Crea las filas (con `ids`) y columnas que falten. Un solo paso de deshacer. */
  | { t: 'tableSetRange'; card: string; r0: number; c0: number; data: string[][]; ids: string[] }
  | { t: 'tableRemoveRow'; card: string; row: string }
  | { t: 'tableAddCol'; card: string }
  | { t: 'tableRemoveCol'; card: string; col: number }
  | { t: 'settings'; patch: Partial<Settings> };

/** Acciones que no cambian datos (no se guardan ni entran en el historial). */
// «backupDone» se guarda pero no entra en el historial (deshacer no debe tocar la hora de la última copia).
export const VIEW_ONLY = new Set<Action['t']>(['load', 'select', 'view', 'day', 'calView', 'calGo', 'backupDone']);
/** Acciones que se guardan pero no entran en el historial de deshacer. */
export const NO_HISTORY = new Set<Action['t']>(['markNotified']);

/** Resultado de aplicar una acción: estado nuevo + documentos que hay que guardar o borrar. */
export type Effect = { state: State; put: Doc[]; del: string[] };

export const MIN_W = 240;
export const MAX_W = 960;
const nextPos = (list: { pos: number }[]) => list.reduce((m, x) => Math.max(m, x.pos), 0) + 1;
const topZ = (cards: Card[], project: string) => cards.filter((c) => c.project === project).reduce((m, c) => Math.max(m, c.z), 0);
export const snapTo = (v: number, s: Settings) => (s.snap ? Math.round(v / s.grid) * s.grid : Math.round(v));

/** Busca un hueco libre para una tarjeta nueva: debajo de la más baja, alineado a la izquierda. */
function freeSpot(cards: Card[], project: string, s: Settings): { x: number; y: number } {
  const on = cards.filter((c) => c.project === project && !c.trashed);
  if (!on.length) return { x: 0, y: 0 };
  const bottom = on.reduce((m, c) => Math.max(m, c.y + (c.h || 220)), 0);
  return { x: 0, y: snapTo(bottom + 24, s) };
}

// Archivos de las tarjetas que se van: la imagen de una tarjeta de imagen y las imágenes de las celdas de una Tabla PM.
const assetsOf = (cards: Card[], ids: string[], assets: Record<string, Asset> = {}) => [
  ...cards.filter((c) => ids.includes(c.id) && c.type === 'image' && c.asset).map((c) => (c as Extract<Card, { type: 'image' }>).asset as string),
  ...Object.values(assets).filter((a) => ids.includes(a.card) && cards.some((c) => c.id === a.card && c.type === 'pm')).map((a) => a.id),
];
const dropAssets = (assets: Record<string, Asset>, ids: string[]) => { const out = { ...assets }; ids.forEach((id) => delete out[id]); return out; };

export function reduce(s: State, a: Action): Effect {
  const none = (state: State): Effect => ({ state, put: [], del: [] });
  const withCard = (id: string, f: (c: Card) => Card): Effect => {
    let changed: Card | null = null;
    const cards = s.cards.map((c) => (c.id === id ? (changed = f(c)) : c));
    return changed ? { state: { ...s, cards }, put: [cardToDoc(changed)], del: [] } : none(s);
  };
  switch (a.t) {
    case 'load': {
      const live = a.projects.filter((p) => !p.trashed && !p.hidden);
      const sel = live.some((p) => p.id === s.sel) ? s.sel : (live[0]?.id ?? 'home');
      return none({ ...s, projects: a.projects, cards: a.cards, settings: { ...a.settings, snap: a.settings.snapOnOpen }, assets: a.assets, calendars: a.calendars ?? builtinCalendars(), events: a.events ?? [], tags: a.tags ?? [], pmTemplates: a.pmTemplates ?? [], folders: a.folders ?? [], sel, cal: { ...s.cal, view: a.settings.calView ?? s.cal.view } });
    }
    case 'pm': {
      // Un solo cronómetro en marcha en toda la app: arrancar uno para los de las demás tablas.
      if (a.op.op === 'timer' && a.op.action === 'start') {
        const now = a.op.now;
        const put: Doc[] = [];
        const cards = s.cards.map((c) => {
          if (c.type !== 'pm') return c;
          let pm = c.pm;
          if (c.id === a.card) pm = pmReduce(pm, a.op);
          else { const t = runningTimer(pm); if (t) pm = pmReduce(pm, { op: 'timer', row: t.row.id, col: t.col.id, action: 'stop', now }); }
          if (pm === c.pm) return c;
          const nc = { ...c, pm } as Card;
          put.push(cardToDoc(nc));
          return nc;
        });
        return { state: { ...s, cards }, put, del: [] };
      }
      return withCard(a.card, (c) => (c.type === 'pm' ? { ...c, pm: pmReduce(c.pm, a.op) } : c));
    }
    case 'pmConvert': {
      const c = s.cards.find((x) => x.id === a.card);
      if (!c || c.type !== 'pm') return none(s);
      const { pm, newTags } = convert(c.pm, a.col, a.type, s.tags);
      const e = withCard(a.card, (x) => ({ ...x, pm }) as Card);
      if (!newTags.length) return e;
      const tags = [...s.tags, ...newTags];
      return { state: { ...e.state, tags }, put: [...e.put, tagsToDoc(tags)], del: [] };
    }
    case 'tags':
      return { state: { ...s, tags: a.tags }, put: [tagsToDoc(a.tags)], del: [] };
    case 'pmImage': {
      const c = s.cards.find((x) => x.id === a.card);
      if (!c || c.type !== 'pm') return none(s);
      const row = c.pm.rows.find((r) => r.id === a.row);
      const cur = row ? strList(row.cells[a.col]) : [];
      const e = reduce({ ...s, assets: { ...s.assets, [a.asset.id]: a.asset } }, { t: 'pm', card: a.card, op: { op: 'cell', row: a.row, col: a.col, value: [...cur, a.asset.id] } });
      return { ...e, put: [assetToDoc(a.asset), ...e.put] };
    }
    case 'pmImageRemove': {
      const c = s.cards.find((x) => x.id === a.card);
      if (!c || c.type !== 'pm') return none(s);
      const row = c.pm.rows.find((r) => r.id === a.row);
      const e = reduce(s, { t: 'pm', card: a.card, op: { op: 'cell', row: a.row, col: a.col, value: strList(row?.cells[a.col] ?? null).filter((x) => x !== a.asset) } });
      // El archivo se conserva para que «deshacer» pueda recuperarlo; se borra con la tarjeta.
      return e;
    }
    case 'pmTemplates':
      return { state: { ...s, pmTemplates: a.list }, put: [pmTemplatesToDoc(a.list)], del: [] };
    case 'pmImport': {
      const c = s.cards.find((x) => x.id === a.card);
      if (!c || c.type !== 'pm') return none(s);
      const r = applyImport(c.pm, a.plan, s.tags);
      const e = withCard(a.card, (x) => ({ ...x, pm: r.pm }) as Card);
      if (!r.newTags.length) return e;
      const tags = [...s.tags, ...r.newTags];
      return { state: { ...e.state, tags }, put: [...e.put, tagsToDoc(tags)], del: [] };
    }
    case 'calView':
      return none({ ...s, view: 'calendar', cal: { ...s.cal, view: a.view } });
    case 'calGo':
      return none({ ...s, view: 'calendar', cal: { ...s.cal, anchor: a.anchor } });
    case 'addEvent':
      return { state: { ...s, events: [...s.events, a.event] }, put: [eventToDoc(a.event)], del: [] };
    case 'patchEvent': {
      let ev: CalEvent | null = null;
      const events = s.events.map((e) => (e.id === a.id ? (ev = { ...e, ...a.patch }) : e));
      return ev ? { state: { ...s, events }, put: [eventToDoc(ev)], del: [] } : none(s);
    }
    case 'removeEvent':
      return { state: { ...s, events: s.events.filter((e) => e.id !== a.id) }, put: [], del: [a.id] };
    case 'addCalendar': {
      const c = { ...a.calendar, pos: s.calendars.reduce((m, x) => Math.max(m, x.pos), 0) + 1 };
      return { state: { ...s, calendars: [...s.calendars, c] }, put: [calendarToDoc(c)], del: [] };
    }
    case 'patchCalendar': {
      let cal: Calendar | null = null;
      const calendars = s.calendars.map((c) => (c.id === a.id ? (cal = { ...c, ...a.patch }) : c));
      return cal ? { state: { ...s, calendars }, put: [calendarToDoc(cal)], del: [] } : none(s);
    }
    case 'removeCalendar': {
      const cal = s.calendars.find((c) => c.id === a.id);
      if (!cal || cal.kind !== 'user') return none(s);
      const gone = s.events.filter((e) => e.calendar === a.id).map((e) => e.id);
      return { state: { ...s, calendars: s.calendars.filter((c) => c.id !== a.id), events: s.events.filter((e) => e.calendar !== a.id) }, put: [], del: [a.id, ...gone] };
    }
    case 'importEvents': {
      const calendars = a.calendar ? [...s.calendars, { ...a.calendar, pos: s.calendars.reduce((m, x) => Math.max(m, x.pos), 0) + 1 }] : s.calendars;
      const evs = a.events.map((e) => ({ ...e, calendar: a.target }));
      return { state: { ...s, calendars, events: [...s.events, ...evs] }, put: [...(a.calendar ? [calendarToDoc(calendars[calendars.length - 1])] : []), ...evs.map(eventToDoc)], del: [] };
    }
    case 'select':
      return none({ ...s, sel: a.id, view: 'board' });
    case 'view':
      return none({ ...s, view: a.view });
    case 'day':
      return none({ ...s, day: a.day, view: 'journal' });
    case 'addDaily': {
      if (s.cards.some((c) => c.id === dailyId(a.day))) return none({ ...s, day: a.day, view: 'journal' });
      const put: Doc[] = [];
      let projects = s.projects;
      if (!projects.some((p) => p.id === JOURNAL_ID)) {
        const j: Project = { id: JOURNAL_ID, name: t('ui.store.journalProject'), color: '#8A6A3A', hidden: true, folder: null, pos: -1, trashed: null, links: [], theme: DEFAULT_THEME };
        projects = [...projects, j];
        put.push(projectToDoc(j));
      }
      const note: NoteCard = { id: dailyId(a.day), project: JOURNAL_ID, type: 'note', day: a.day, title: t('ui.store.dayNote'), body: a.body, x: 0, y: 0, w: 640, h: 0, z: 1, color: null, pos: 0, trashed: null };
      put.push(cardToDoc(note));
      return { state: { ...s, projects, cards: [...s.cards, note], day: a.day, view: 'journal' }, put, del: [] };
    }
    case 'completeReminder':
      return withCard(a.id, (c) => (c.type === 'reminder' ? { ...c, done: a.done } : c));
    case 'snoozeReminder':
      return withCard(a.id, (c) => (c.type === 'reminder' ? { ...c, when: a.until, done: false, notified: null } : c));
    case 'markNotified': {
      const cards = s.cards.map((c) => (a.ids.includes(c.id) && c.type === 'reminder' ? { ...c, notified: a.at } : c));
      return { state: { ...s, cards }, put: cards.filter((c) => a.ids.includes(c.id)).map(cardToDoc), del: [] };
    }
    case 'addProject': {
      const p: Project = { id: a.id, name: a.name.trim() || t('ui.common.unnamed'), color: a.color, folder: a.folder && s.folders.some((f) => f.id === a.folder) ? a.folder : null, pos: nextPos(s.projects), trashed: null };
      return { state: { ...s, projects: [...s.projects, p], sel: p.id, view: 'board' }, put: [projectToDoc(p)], del: [] };
    }
    case 'addFolder': {
      const f: Folder = { id: a.id, name: a.name.trim() || t('ui.store.newFolder'), collapsed: false, pos: nextPos(s.folders) };
      return { state: { ...s, folders: [...s.folders, f] }, put: [folderToDoc(f)], del: [] };
    }
    case 'patchFolder': {
      const f = s.folders.find((x) => x.id === a.id);
      if (!f) return none(s);
      const n = { ...f, ...a.patch, name: a.patch.name !== undefined ? (a.patch.name.trim() || f.name) : f.name };
      return { state: { ...s, folders: s.folders.map((x) => (x.id === a.id ? n : x)) }, put: [folderToDoc(n)], del: [] };
    }
    case 'deleteFolder': {
      // Las tareas principales se conservan: salen de la carpeta.
      if (!s.folders.some((f) => f.id === a.id)) return none(s);
      const moved = s.projects.filter((p) => p.folder === a.id).map((p) => ({ ...p, folder: null }));
      const projects = s.projects.map((p) => moved.find((m) => m.id === p.id) ?? p);
      return { state: { ...s, folders: s.folders.filter((f) => f.id !== a.id), projects }, put: moved.map(projectToDoc), del: [a.id] };
    }
    case 'moveProject': {
      const p = s.projects.find((x) => x.id === a.id);
      if (!p || p.home || p.hidden || p.id === a.before) return none(s);
      const folder = a.folder && s.folders.some((f) => f.id === a.folder) ? a.folder : null;
      const group = (x: Project) => !x.trashed && !x.hidden && !x.home && (x.folder && s.folders.some((f) => f.id === x.folder) ? x.folder : null) === folder;
      const rest = s.projects.filter((x) => x.id !== p.id);
      const moved: Project = { ...p, folder };
      // Antes de `before`; sin él, tras la última tarea de ese grupo (o al final de todo).
      let at = a.before ? rest.findIndex((x) => x.id === a.before) : -1;
      if (at < 0) { let last = -1; rest.forEach((x, i) => { if (group(x)) last = i; }); at = last < 0 ? rest.length : last + 1; }
      const next = [...rest.slice(0, at), moved, ...rest.slice(at)];
      // Se renumeran las posiciones (menos las del Inicio y las internas) para que el orden quede fijo.
      let n = 0;
      const projects = next.map((x) => (x.home || x.hidden ? x : { ...x, pos: ++n }));
      const old = new Map(s.projects.map((x) => [x.id, x]));
      const put = projects.filter((x) => { const o = old.get(x.id)!; return o.pos !== x.pos || o.folder !== x.folder; }).map(projectToDoc);
      if (!put.length && projects.every((x, i) => x.id === s.projects[i].id)) return none(s);
      return { state: { ...s, projects }, put, del: [] };
    }
    case 'patchProject':
    case 'trashProject':
    case 'restoreProject': {
      const target = s.projects.find((p) => p.id === a.id);
      if (!target || (a.t === 'trashProject' && target.home)) return none(s);
      const patch: Partial<Project> = a.t === 'patchProject' ? a.patch : { trashed: a.t === 'trashProject' ? Date.now() : null };
      if (a.t === 'restoreProject' && target.folder && !s.folders.some((f) => f.id === target.folder)) patch.folder = null;
      const p = { ...target, ...patch };
      const projects = s.projects.map((x) => (x.id === a.id ? p : x));
      const live = projects.filter((x) => !x.trashed);
      const sel = a.t === 'trashProject' && s.sel === a.id ? (live[0]?.id ?? 'home') : a.t === 'restoreProject' ? a.id : s.sel;
      return { state: { ...s, projects, sel }, put: [projectToDoc(p)], del: [] };
    }
    case 'purgeProject': {
      const p = s.projects.find((x) => x.id === a.id);
      if (!p || p.home) return none(s);
      const gone = s.cards.filter((c) => c.project === a.id).map((c) => c.id);
      const files = assetsOf(s.cards, gone, s.assets);
      return { state: { ...s, projects: s.projects.filter((x) => x.id !== a.id), cards: s.cards.filter((c) => c.project !== a.id), assets: dropAssets(s.assets, files) }, put: [], del: [a.id, ...gone, ...files] };
    }
    case 'addImage': {
      const e = reduce({ ...s, assets: { ...s.assets, [a.asset.id]: a.asset } }, { t: 'addCard', card: a.card });
      return { ...e, put: [assetToDoc(a.asset), ...e.put] };
    }
    case 'setAsset': {
      const e = reduce({ ...s, assets: { ...s.assets, [a.asset.id]: a.asset } }, { t: 'patchCard', id: a.card, patch: { asset: a.asset.id, name: a.name } });
      return { ...e, put: [assetToDoc(a.asset), ...e.put] };
    }
    case 'addStroke':
      return withCard(a.card, (c) => (c.type === 'sketch' ? { ...c, strokes: [...c.strokes, a.stroke] } : c));
    case 'addLink':
    case 'patchLink':
    case 'removeLink':
    case 'setTheme': {
      const target = s.projects.find((p) => p.id === a.project);
      if (!target) return none(s);
      let links = target.links ?? [];
      let theme = target.theme ?? DEFAULT_THEME;
      if (a.t === 'addLink') {
        const dup = links.some((l) => (l.from === a.link.from && l.to === a.link.to) || (l.from === a.link.to && l.to === a.link.from));
        if (dup || a.link.from === a.link.to) return none(s);
        links = [...links, a.link];
      }
      if (a.t === 'patchLink') links = links.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l));
      if (a.t === 'removeLink') links = links.filter((l) => l.id !== a.id);
      if (a.t === 'setTheme') theme = { ...theme, ...a.patch };
      const p = { ...target, links, theme };
      return { state: { ...s, projects: s.projects.map((x) => (x.id === p.id ? p : x)) }, put: [projectToDoc(p)], del: [] };
    }
    case 'applyThemeAll': {
      const projects = s.projects.map((p) => ({ ...p, theme: a.theme }));
      return { state: { ...s, projects }, put: projects.map(projectToDoc), del: [] };
    }
    case 'setTitleFont': {
      const target = s.projects.find((p) => p.id === a.project);
      if (!target) return none(s);
      const p = { ...target, titleFont: a.font };
      return { state: { ...s, projects: s.projects.map((x) => (x.id === p.id ? p : x)) }, put: [projectToDoc(p)], del: [] };
    }
    case 'addCard': {
      const spot = a.card.x || a.card.y ? { x: a.card.x, y: a.card.y } : freeSpot(s.cards, a.card.project, s.settings);
      const card = { ...a.card, ...spot, z: topZ(s.cards, a.card.project) + 1, pos: nextPos(s.cards.filter((c) => c.project === a.card.project)) } as Card;
      return { state: { ...s, cards: [...s.cards, card] }, put: [cardToDoc(card)], del: [] };
    }
    case 'duplicateCard': {
      const src = s.cards.find((c) => c.id === a.id);
      if (!src) return none(s);
      const card = { ...JSON.parse(JSON.stringify(src)), id: uid('card'), title: t('ui.store.copyOf', { title: src.title || t('ui.common.untitled') }), x: src.x + 28, y: src.y + 28, trashed: null, z: topZ(s.cards, src.project) + 1, pos: nextPos(s.cards.filter((c) => c.project === src.project)) } as Card;
      return { state: { ...s, cards: [...s.cards, card] }, put: [cardToDoc(card)], del: [] };
    }
    case 'patchCard':
      return withCard(a.id, (c) => ({ ...c, ...a.patch, ...(c.type === 'reminder' && 'when' in a.patch ? { notified: null } : {}) }) as Card);
    case 'moveCard':
      return withCard(a.id, (c) => ({ ...c, x: Math.max(0, snapTo(a.x, s.settings)), y: Math.max(0, snapTo(a.y, s.settings)) }));
    case 'resizeCard':
      return withCard(a.id, (c) => ({ ...c, w: Math.min(MAX_W, Math.max(MIN_W, snapTo(a.w, s.settings))), h: a.h <= 0 ? 0 : Math.max(120, snapTo(a.h, s.settings)) }));
    case 'raiseCard': {
      const c = s.cards.find((x) => x.id === a.id);
      if (!c) return none(s);
      const top = topZ(s.cards, c.project);
      return c.z === top ? none(s) : withCard(a.id, (x) => ({ ...x, z: top + 1 }));
    }
    case 'trashCard':
    case 'restoreCard':
      return withCard(a.id, (c) => ({ ...c, trashed: a.t === 'trashCard' ? Date.now() : null, z: a.t === 'restoreCard' ? topZ(s.cards, c.project) + 1 : c.z }));
    case 'purgeCard': {
      const files = assetsOf(s.cards, [a.id], s.assets);
      return { state: { ...s, cards: s.cards.filter((c) => c.id !== a.id), assets: dropAssets(s.assets, files) }, put: [], del: [a.id, ...files] };
    }
    case 'emptyBoardTrash': {
      const gone = s.cards.filter((c) => c.project === a.project && c.trashed).map((c) => c.id);
      if (!gone.length) return none(s);
      const files = assetsOf(s.cards, gone, s.assets);
      return { state: { ...s, cards: s.cards.filter((c) => !gone.includes(c.id)), assets: dropAssets(s.assets, files) }, put: [], del: [...gone, ...files] };
    }
    case 'emptyTrash': {
      const trashedProjects = s.projects.filter((p) => p.trashed && !p.home).map((p) => p.id);
      const goneCards = s.cards.filter((c) => c.trashed || trashedProjects.includes(c.project)).map((c) => c.id);
      const files = assetsOf(s.cards, goneCards, s.assets);
      return {
        state: { ...s, projects: s.projects.filter((p) => !trashedProjects.includes(p.id)), cards: s.cards.filter((c) => !goneCards.includes(c.id)), assets: dropAssets(s.assets, files) },
        put: [],
        del: [...trashedProjects, ...goneCards, ...files],
      };
    }
    case 'checkItem':
    case 'addCheckItem':
    case 'removeCheckItem':
    case 'setCheckItems':
      return withCard(a.card, (c) => {
        if (c.type !== 'check') return c;
        let items = c.items;
        if (a.t === 'setCheckItems') items = a.items;
        if (a.t === 'checkItem') items = items.map((it) => (it.id === a.item ? { ...it, ...a.patch } : it));
        if (a.t === 'removeCheckItem') items = items.filter((it) => it.id !== a.item);
        if (a.t === 'addCheckItem') {
          const at = a.after ? items.findIndex((it) => it.id === a.after) + 1 : items.length;
          const level = a.level ?? (a.after ? (items.find((it) => it.id === a.after)?.level ?? 0) : 0);
          items = [...items.slice(0, at), { id: a.id, text: '', done: false, level }, ...items.slice(at)];
        }
        return { ...c, items: normalizeLevels(items) };
      });
    case 'checkFormat':
      return withCard(a.card, (c) => {
        if (c.type !== 'check') return c;
        const ids = new Set(a.ids);
        return { ...c, items: c.items.map((it) => { if (!ids.has(it.id)) return it; const { fmt: _f, ...rest } = it; void _f; const n = applyFmt(it.fmt, a.patch); return n ? { ...rest, fmt: n } : rest; }) };
      });
    case 'tableFormat':
      return withCard(a.card, (c) => {
        if (c.type !== 'table') return c;
        const headFmt: (CellFmt | null)[] = [...(c.headFmt ?? [])];
        const rows = c.rows.map((r) => ({ ...r, fmt: [...(r.fmt ?? [])] }));
        for (const { r, c: col } of a.cells) {
          const arr = r < 0 ? headFmt : rows[r]?.fmt;
          if (!arr) continue;
          while (arr.length <= col) arr.push(null);
          arr[col] = applyFmt(arr[col], a.patch) ?? null;
        }
        const trim = (x: (CellFmt | null)[]) => (x.some(Boolean) ? x : undefined);
        const out = { ...c, rows: rows.map((r) => { const { fmt, ...rest } = r; const t = trim(fmt ?? []); return t ? { ...rest, fmt: t } : rest; }) } as typeof c;
        const hf = trim(headFmt);
        if (hf) out.headFmt = hf; else delete out.headFmt;
        return out;
      });
    case 'tableSetRange':
      return withCard(a.card, (c) => {
        if (c.type !== 'table') return c;
        let heads = [...c.heads];
        let rows = c.rows.map((r) => ({ ...r, cells: [...r.cells] }));
        const w = a.data.reduce((n, r) => Math.max(n, r.length), 0);
        while (heads.length < a.c0 + w) { heads.push(t('ui.store.tableColumn', { n: heads.length + 1 })); rows.forEach((r) => r.cells.push('')); }
        let used = 0;
        while (rows.length < a.r0 + a.data.length) { rows.push({ id: a.ids[used++] ?? uid('row'), cells: heads.map(() => '') }); }
        a.data.forEach((line, i) => line.forEach((v, j) => {
          const r = a.r0 + i, k = a.c0 + j;
          if (r < 0) heads[k] = v; else rows[r].cells[k] = v;
        }));
        return { ...c, heads, rows };
      });
    case 'tableCell':
    case 'tableHead':
    case 'tableAddRow':
    case 'tableRemoveRow':
    case 'tableAddCol':
    case 'tableRemoveCol':
      return withCard(a.card, (c) => {
        if (c.type !== 'table') return c;
        let { heads, rows } = c;
        if (a.t === 'tableCell') rows = rows.map((r) => (r.id === a.row ? { ...r, cells: r.cells.map((v, i) => (i === a.col ? a.value : v)) } : r));
        if (a.t === 'tableHead') heads = heads.map((h, i) => (i === a.col ? a.value : h));
        if (a.t === 'tableAddRow') rows = [...rows, { id: a.id, cells: heads.map(() => '') }];
        if (a.t === 'tableRemoveRow') rows = rows.length > 1 ? rows.filter((r) => r.id !== a.row) : rows;
        if (a.t === 'tableAddCol') { heads = [...heads, t('ui.store.tableColumn', { n: heads.length + 1 })]; rows = rows.map((r) => ({ ...r, cells: [...r.cells, ''] })); }
        let headFmt = c.headFmt;
        if (a.t === 'tableRemoveCol' && heads.length > 1) { heads = heads.filter((_, i) => i !== a.col); rows = rows.map((r) => ({ ...r, cells: r.cells.filter((_, i) => i !== a.col), ...(r.fmt ? { fmt: r.fmt.filter((_, i) => i !== a.col) } : {}) })); if (headFmt) headFmt = headFmt.filter((_, i) => i !== a.col); }
        return { ...c, heads, rows, ...(headFmt ? { headFmt } : {}) };
      });
    case 'backupDone': {
      const settings = { ...s.settings, backup: { ...s.settings.backup, [a.level]: { ...s.settings.backup[a.level], ...a.patch } } as BackupSettings };
      return { state: { ...s, settings }, put: [settingsToDoc(settings)], del: [] };
    }
    case 'settings': {
      const settings = { ...s.settings, ...a.patch };
      return { state: { ...s, settings }, put: [settingsToDoc(settings)], del: [] };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Deshacer / rehacer

export type Snap = { projects: Project[]; cards: Card[]; settings: Settings; calendars: Calendar[]; events: CalEvent[]; tags?: Opt[]; folders?: Folder[] };
export const snapOf = (s: State): Snap => ({ folders: s.folders, projects: s.projects, cards: s.cards, settings: s.settings, calendars: s.calendars, events: s.events, tags: s.tags });

/** Qué documentos hay que guardar o borrar para pasar de `from` a `to`. */
export function diff(from: Snap, to: Snap): { put: Doc[]; del: string[] } {
  const put: Doc[] = [];
  const del: string[] = [];
  const side = <T extends { id: string }>(a: T[], b: T[], toDoc: (x: T) => Doc) => {
    const before = new Map(a.map((x) => [x.id, x]));
    const after = new Map(b.map((x) => [x.id, x]));
    for (const [id, x] of after) if (before.get(id) !== x && JSON.stringify(before.get(id)) !== JSON.stringify(x)) put.push(toDoc(x));
    for (const id of before.keys()) if (!after.has(id)) del.push(id);
  };
  side(from.folders ?? [], to.folders ?? [], folderToDoc);
  side(from.projects, to.projects, projectToDoc);
  side(from.cards, to.cards, cardToDoc);
  side(from.calendars ?? [], to.calendars ?? [], calendarToDoc);
  side(from.events ?? [], to.events ?? [], eventToDoc);
  if (JSON.stringify(from.settings) !== JSON.stringify(to.settings)) put.push(settingsToDoc(to.settings));
  if (JSON.stringify(from.tags ?? []) !== JSON.stringify(to.tags ?? [])) put.push(tagsToDoc(to.tags ?? []));
  return { put, del };
}

/**
 * Historial de 100 pasos. Las acciones seguidas con la misma `key` (por ejemplo, escribir en
 * la misma nota) se agrupan en un solo paso si llegan con menos de 1,2 s de diferencia.
 */
export class History {
  private past: Snap[] = [];
  private future: Snap[] = [];
  private lastKey: string | null = null;
  private lastAt = 0;
  constructor(private limit = 100, private window = 1200) {}
  record(before: Snap, key: string | null, now = Date.now()) {
    const merge = key !== null && key === this.lastKey && now - this.lastAt < this.window;
    this.lastKey = key;
    this.lastAt = now;
    if (merge) return;
    this.past.push(before);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current: Snap): Snap | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(current);
    this.lastKey = null;
    return prev;
  }
  redo(current: Snap): Snap | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(current);
    this.lastKey = null;
    return next;
  }
  clear() { this.past = []; this.future = []; this.lastKey = null; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}

/** Clave de agrupación para el historial: escribir en un mismo campo cuenta como un paso. */
export function coalesceKey(a: Action): string | null {
  switch (a.t) {
    case 'patchCard': return 'card:' + a.id + ':' + Object.keys(a.patch).sort().join(',');
    case 'patchProject': return 'proj:' + a.id + ':' + Object.keys(a.patch).sort().join(',');
    case 'patchLink': return a.patch.label !== undefined ? 'link:' + a.id : null;
    case 'checkItem': return a.patch.text !== undefined ? 'item:' + a.item : null;
    case 'tableCell': return 'cell:' + a.card + ':' + a.row + ':' + a.col;
    case 'tableHead': return 'head:' + a.card + ':' + a.col;
    case 'pm': return a.op.op === 'cell' && (typeof a.op.value === 'string' || typeof a.op.value === 'number') ? 'pmcell:' + a.card + ':' + a.op.row + ':' + a.op.col : a.op.op === 'patchCol' && a.op.patch.name !== undefined ? 'pmcol:' + a.op.id : a.op.op === 'patchCol' && a.op.patch.w !== undefined ? null : null;
    case 'tags': return 'tags';
    default: return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Búsqueda (⌘K)

export type Hit = { project: string; card: string | null; event?: string; kind: string; text: string; where: string };

const fold = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function searchIndex(s: State): Hit[] {
  const out: Hit[] = [];
  const names = new Map(s.projects.map((p) => [p.id, p.name]));
  for (const p of s.projects) if (!p.trashed && !p.hidden) out.push({ project: p.id, card: null, kind: t('ui.label.project'), text: p.name, where: '' });
  for (const e of s.events) { const cal = s.calendars.find((c) => c.id === e.calendar); if (e.title.trim()) out.push({ project: '', card: null, event: e.id, kind: t('ui.label.event'), text: e.title, where: (cal?.name ?? '') + ' · ' + (e.allDay ? e.start : e.start.slice(0, 10)) }); }
  for (const c of s.cards) {
    const proj = s.projects.find((p) => p.id === c.project);
    if (c.trashed || !proj || proj.trashed) continue;
    const isDaily = c.type === 'note' && !!c.day;
    const where = isDaily ? t('ui.label.journalWhere', { date: (c as NoteCard).day!.split('-').reverse().join('/') }) : (names.get(c.project) ?? '');
    const kind = isDaily ? t('ui.label.dailyNote') : CARD_KIND_LABEL[c.type];
    const push = (text: string, k: string = kind) => { if (text.trim()) out.push({ project: c.project, card: c.id, kind: k, text: text.trim(), where: where + (c.title && !isDaily ? ' › ' + c.title : '') }); };
    push(c.title);
    if (c.type === 'note') c.body.split('\n').forEach((l) => push(l.replace(/^#+\s*|^[-*]\s*(\[[ xX]\]\s*)?|^>\s*/g, ''), isDaily ? t('ui.label.dailyNote') : t('ui.kind.note')));
    if (c.type === 'check') c.items.forEach((it) => push(it.text, (it.level ?? 0) > 0 ? t('ui.label.subtask') : t('ui.label.task')));
    if (c.type === 'reminder') push(c.note);
    if (c.type === 'table') { c.heads.forEach((h) => push(h, t('ui.label.column'))); c.rows.forEach((r) => r.cells.forEach((x) => push(x, t('ui.label.cell')))); }
    if (c.type === 'image') push(c.name);
    if (c.type === 'palette') c.colors.forEach((x) => push(x));
    if (c.type === 'pm') c.pm.rows.forEach((r) => c.pm.cols.forEach((col) => { if (col.type !== 'progress' && col.type !== 'checkbox') push(cellText(c.pm, col, r, s.tags), t('ui.kind.pm')); }));
  }
  return out;
}

export function search(index: Hit[], q: string, limit = 30): Hit[] {
  const f = fold(q.trim());
  if (!f) return [];
  return index.filter((h) => fold(h.text).includes(f)).slice(0, limit);
}

// ---------------------------------------------------------------------------------------------
// Guardado

/**
 * Cola de guardado: junta los cambios de los últimos `delay` ms y los envía en una sola
 * transacción. Si un documento cambia varias veces, solo se guarda su última versión.
 */
export function createSaver(backend: Backend, onError: (msg: string) => void, delay = 250) {
  let puts = new Map<string, Doc>();
  let dels = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  const flush = (): Promise<void> => {
    if (timer) { clearTimeout(timer); timer = null; }
    const p = [...puts.values()];
    const d = [...dels];
    puts = new Map(); dels = new Set();
    if (!p.length && !d.length) return chain;
    chain = chain.then(async () => {
      try {
        if (p.length) await backend.put(p);
        if (d.length) await backend.remove(d);
      } catch (e) {
        onError(typeof e === 'string' ? e : t('ui.store.saveFail'));
      }
    });
    return chain;
  };
  return {
    queue(put: Doc[], del: string[]) {
      put.forEach((doc) => { dels.delete(doc.id); puts.set(doc.id, doc); });
      del.forEach((id) => { puts.delete(id); dels.add(id); });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
    flush,
  };
}

// ---------------------------------------------------------------------------------------------
// Tarjetas nuevas

const base = (project: string) => ({ id: uid('card'), project, title: '', x: 0, y: 0, w: 380, h: 0, z: 0, color: null, pos: 0, trashed: null });

export function newCard(type: CardType, project: string): Card {
  switch (type) {
    case 'note': return { ...base(project), type, body: '' };
    case 'check': return { ...base(project), type, items: [{ id: uid('it'), text: '', done: false, level: 0 }] };
    case 'reminder': return { ...base(project), type, when: null, bell: true, note: '' };
    case 'table': {
      const rows: TableRow[] = [0, 1].map(() => ({ id: uid('row'), cells: ['', ''] }));
      return { ...base(project), type, w: 480, heads: [t('ui.store.tableColumn', { n: 1 }), t('ui.store.tableColumn', { n: 2 })], rows };
    }
    case 'image': return { ...base(project), type, w: 320, asset: null, name: '' };
    case 'pm': return { ...base(project), type, w: 640, title: t('ui.store.pmTitle'), pm: pmTemplate() };
    case 'sketch': return { ...base(project), type, w: 420, strokes: [], tool: 'pen', ink: '#1F1D1A', size: 4 };
    case 'palette': return { ...base(project), type, w: 320, colors: ['#F6D7B0', '#E2B65B', '#B4532A', '#2F6690'], fmt: 'hex', source: null };
    case 'widget': return { ...base(project), type, w: 340, widget: 'today' };
  }
}

// Compatibilidad con la Fase 0.
export const newWidget = (project: string, widget: WidgetKind) => ({ ...newCard('widget', project), widget, title: '' }) as Card;
export const newNote = (project: string) => newCard('note', project);
export const newChecklist = (project: string) => newCard('check', project);
