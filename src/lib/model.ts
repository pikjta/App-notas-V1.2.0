import type { CellFmt } from './format';
import type { Opt, Pm } from './pm';
import type { PmTemplate } from './pmio';
import type { Country } from './holidays';
import type { IconStyle, ViewIcons } from './icons';
import { t, tIn } from '../i18n';
import { DEFAULT_COLOR_ICON, DEFAULT_ICON_STYLE, normalizeColorIcon, normalizeIconStyle, normalizeViewIcons } from './icons';
// Modelo de datos de Cuaderno. Todo se guarda como documentos { id, kind, parent, pos, data }
// en el núcleo de Rust; estos tipos son la forma que tienen esos datos en la interfaz.

export type Doc = { id: string; kind: string; parent: string | null; pos: number; updated: number; data: unknown };

/** Flecha entre dos tarjetas del mismo tablero. */
export type Link = { id: string; from: string; to: string; label: string; color: string | null; both: boolean };

import type { BoardColor, CardTheme, SideColor, Texture } from './appearance';
import { DEFAULT_SESSION_FONT, DEFAULT_SIDE, DEFAULT_THEME, normalizeFont, normalizeSide, normalizeTheme } from './appearance';
import type { FontStyle, SideStyle, Theme } from './appearance';
export type { Theme } from './appearance';
export { DEFAULT_THEME, CARD_COLORS } from './appearance';

export type Project = {
  id: string;
  name: string;
  color: string;
  home?: boolean;
  /** Icono propio de la barra lateral (clave de lib/icons); sin él se ve el punto de color. */
  icon?: string | null;
  folder: string | null;
  pos: number;
  links?: Link[];
  theme?: Theme;
  /** Tipografía del título del tablero (null = la de por defecto). */
  titleFont?: FontStyle | null;
  /** Tareas principales internas que no aparecen en la barra lateral (p. ej. el Diario). */
  hidden?: boolean;
  /** Fecha en que se envió a la papelera (ms). Si existe, la tarea principal está en la papelera. */
  trashed?: number | null;
};

/** Carpeta de la barra lateral: agrupa tareas principales (no contiene datos propios). */
export type Folder = { id: string; name: string; collapsed: boolean; pos: number };
export const folderToDoc = (f: Folder): Doc => { const { id, pos, ...data } = f; return { id, kind: 'folder', parent: null, pos, updated: Date.now(), data }; };

/** `level`: 0 = tarea, 1 = subtarea, 2 = sub-subtarea… (hasta MAX_LEVEL en lib/checklist.ts). */
export type CheckItem = { id: string; text: string; done: boolean; level: number; fmt?: CellFmt };
/** `fmt` es el formato de cada celda de la fila (mismo orden que `cells`). */
export type TableRow = { id: string; cells: string[]; fmt?: (CellFmt | null)[] };

type CardBase = {
  id: string;
  project: string;
  title: string;
  /** Posición y tamaño en el tablero (px). `h = 0` significa altura automática. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Orden de capas: la más alta se dibuja encima. */
  z: number;
  /** Color de fondo propio, o null para el automático. */
  color: string | null;
  pos: number;
  trashed?: number | null;
};
/** `day` (AAAA-MM-DD) solo existe en las notas del Diario. */
export type NoteCard = CardBase & { type: 'note'; body: string; day?: string };
export type CheckCard = CardBase & { type: 'check'; items: CheckItem[] };
export type ReminderCard = CardBase & { type: 'reminder'; when: string | null; bell: boolean; note: string; done?: boolean; notified?: number | null };
export type PmCard = CardBase & { type: 'pm'; pm: Pm };
export type WidgetKind = 'today' | 'upcoming' | 'projects';
export type WidgetCard = CardBase & { type: 'widget'; widget: WidgetKind };
export type TableCard = CardBase & { type: 'table'; heads: string[]; rows: TableRow[]; headFmt?: (CellFmt | null)[] };
/** La imagen en sí se guarda aparte (documento «asset») para no reescribirla al mover la tarjeta. */
export type ImageCard = CardBase & { type: 'image'; asset: string | null; name: string };
export type Stroke = { c: string; s: number; o: number; p: [number, number][] };
export type SketchCard = CardBase & { type: 'sketch'; strokes: Stroke[]; tool: 'pen' | 'marker' | 'eraser'; ink: string; size: number };
export type PaletteCard = CardBase & { type: 'palette'; colors: string[]; fmt: 'hex' | 'rgb' | 'hsl'; source: string | null };
export type Card = NoteCard | CheckCard | ReminderCard | TableCard | ImageCard | SketchCard | PaletteCard | WidgetCard | PmCard;

/** Archivo binario (imagen) guardado como data URL. */
export type Asset = { id: string; card: string; mime: string; data: string };
export type CardType = Card['type'];

export type Language = 'es' | 'en' | 'fr' | 'pt' | 'it' | 'de';
export const LANGUAGES: { id: Language; name: string }[] = [{ id: 'es', name: 'Español' }, { id: 'en', name: 'English' }, { id: 'fr', name: 'Français' }, { id: 'pt', name: 'Português' }, { id: 'it', name: 'Italiano' }, { id: 'de', name: 'Deutsch' }];
export type Settings = {
  /** Nombre de la sesión (arriba de la barra lateral) y su tipografía. */
  sessionName: string;
  sessionFont: FontStyle;
  /** Color y textura de la barra lateral (iguales en todos los tableros). */
  side: SideStyle;
  /** Estilo de los iconos de la app y icono del botón de color de las tarjetas. */
  iconStyle: IconStyle;
  colorIcon: string;
  /** Icono de cada entrada de la barra lateral (las que no aparecen usan el predeterminado). */
  viewIcons: ViewIcons;
  lang: Language;
  /** Formato de hora: 24 h o 12 h. */
  hour12: boolean;
  /** Un sonido suave junto al aviso de un recordatorio. */
  sound: boolean;
  /** Al abrir la app, mostrar los recordatorios que pasaron mientras estaba cerrada. */
  showMissed: boolean;
  /** Efecto foco: al pasar el cursor por una tarjeta, las demás se atenúan. */
  focus: 'off' | 'soft' | 'strong';
  /** El imán empieza activado al abrir la app. */
  snapOnOpen: boolean;
  reduceMotion: boolean;
  autoLockMinutes: number | null;
  /** Imán: las tarjetas se ajustan a una cuadrícula al moverlas o redimensionarlas. */
  snap: boolean;
  grid: 16 | 24 | 32;
  /** Avisos del sistema para los recordatorios con campana. */
  notify: boolean;
  /** Minutos de antelación del aviso. */
  leadMin: 0 | 5 | 15 | 60;
  /** Copias automáticas a una carpeta (null = desactivadas). */
  backup: BackupSettings;
  /** Buscar actualizaciones al abrir la app. */
  updateCheck: boolean;
  /** Calendario: país de los festivos, primer día de la semana (1 = lunes) y horas visibles. */
  country: Country;
  weekStart: 0 | 1;
  dayStart: number;
  dayEnd: number;
  calView: CalView;
  weekNumbers: boolean;
  calLook: CalLook;
};

export type CalView = 'day' | 'week' | 'month' | 'agenda';
export type CalendarKind = 'main' | 'birthdays' | 'holidays' | 'user';
/** «main» (Cuaderno) reúne los recordatorios de los tableros y los eventos sueltos; «holidays» se calcula. */
export type Calendar = { id: string; name: string; color: string; kind: CalendarKind; visible: boolean; pos: number };
/** Evento de calendario. Si `allDay`, `start` y `end` son «AAAA-MM-DD» (fin incluido); si no, fechas ISO. */
export type Repeat = 'none' | 'week' | 'month' | 'year';
export type CalEvent = { id: string; calendar: string; title: string; start: string; end: string; allDay: boolean; note: string; repeat?: Repeat };
/** Apariencia del calendario (solo afecta a esa pantalla). */
export type CalLook = { side: { color: SideColor; texture: Texture }; bg: { color: BoardColor; texture: Texture }; cell: { color: CardTheme; texture: Texture } };
export const DEFAULT_CALLOOK: CalLook = { side: { color: 'papel', texture: 'liso' }, bg: { color: 'papel', texture: 'liso' }, cell: { color: 'blanco', texture: 'liso' } };

export const CAL_COLORS = ['#2F6690', '#0E7C7B', '#5E7A2E', '#C08A1E', '#B4532A', '#C8372D', '#D9468F', '#7A3E6B', '#6B645A'];
/** Calendarios integrados; los nombres salen en `lang` (por defecto, el idioma actual). */
export const builtinCalendars = (lang?: Language): Calendar[] => {
  const n = (k: 'ui.cal.main' | 'ui.cal.birthdays' | 'ui.cal.holidays') => (lang ? tIn(lang, k) : t(k));
  return [
    { id: 'cal-main', name: n('ui.cal.main'), color: '#2F6690', kind: 'main', visible: true, pos: 0 },
    { id: 'cal-birthdays', name: n('ui.cal.birthdays'), color: '#D9468F', kind: 'birthdays', visible: true, pos: 1 },
    { id: 'cal-holidays', name: n('ui.cal.holidays'), color: '#C8372D', kind: 'holidays', visible: true, pos: 2 },
  ];
};
export const calendarToDoc = (c: Calendar): Doc => { const { id, pos, ...data } = c; return { id, kind: 'calendar', parent: null, pos, updated: Date.now(), data }; };
export const eventToDoc = (e: CalEvent): Doc => { const { id, calendar, ...data } = e; return { id, kind: 'event', parent: calendar, pos: 0, updated: Date.now(), data }; };

export const PROJECT_COLORS = ['#0E7C7B', '#D9468F', '#C08A1E', '#2F6690', '#7A3E6B', '#5E7A2E', '#B4532A', '#6B645A'];

// Getters: el texto se resuelve al leerlo, así que sigue al idioma actual aunque el objeto se cree una sola vez.
export const CARD_KIND_LABEL: Record<CardType, string> = {
  get note() { return t('ui.kind.note'); }, get check() { return t('ui.kind.check'); }, get reminder() { return t('ui.kind.reminder'); },
  get table() { return t('ui.kind.table'); }, get image() { return t('ui.kind.image'); }, get sketch() { return t('ui.kind.sketch'); },
  get palette() { return t('ui.kind.palette'); }, get widget() { return t('ui.kind.widget'); }, get pm() { return t('ui.kind.pm'); },
};
export const WIDGET_LABEL: Record<WidgetKind, string> = {
  get today() { return t('ui.widget.today'); }, get upcoming() { return t('ui.widget.upcoming'); }, get projects() { return t('ui.widget.projects'); },
};
export const JOURNAL_ID = 'journal';

export type AutoEvery = 'h4' | 'h8' | 'h12' | 'day' | 'week';
export type BackupSettings = {
  /** Carpeta de las copias; null = Descargas. */
  dir: string | null;
  auto: { on: boolean; every: AutoEvery; keep: number; last: number | null; lastName: string | null; error: string | null };
  internal: { on: boolean; everyMin: number; keep: number; last: number | null };
  manual: { last: number | null; lastName: string | null };
};
export const DEFAULT_BACKUP: BackupSettings = {
  dir: null,
  auto: { on: false, every: 'day', keep: 30, last: null, lastName: null, error: null },
  internal: { on: false, everyMin: 60, keep: 30, last: null },
  manual: { last: null, lastName: null },
};
export const AUTO_EVERY: { id: AutoEvery; label: string; ms: number }[] = [
  { id: 'h4', get label() { return t('ui.every.h4'); }, ms: 4 * 3_600_000 }, { id: 'h8', get label() { return t('ui.every.h8'); }, ms: 8 * 3_600_000 },
  { id: 'h12', get label() { return t('ui.every.h12'); }, ms: 12 * 3_600_000 }, { id: 'day', get label() { return t('ui.every.day'); }, ms: 86_400_000 }, { id: 'week', get label() { return t('ui.every.week'); }, ms: 7 * 86_400_000 },
];
export const INTERNAL_EVERY = [15, 30, 60, 120, 360, 720];
export function everyMs(e: AutoEvery): number { return AUTO_EVERY.find((x) => x.id === e)?.ms ?? 86_400_000; }
/** Ajustes antiguos (`autoBackup`) → modelo de tres niveles. */
export function normalizeBackup(raw: Partial<Settings> & { autoBackup?: { dir?: string | null; every?: string; keep?: number; last?: number | null; lastName?: string | null; error?: string | null } }): BackupSettings {
  const b = raw.backup as Partial<BackupSettings> | undefined;
  const base: BackupSettings = { ...DEFAULT_BACKUP, ...(b ?? {}), auto: { ...DEFAULT_BACKUP.auto, ...(b?.auto ?? {}) }, internal: { ...DEFAULT_BACKUP.internal, ...(b?.internal ?? {}) }, manual: { ...DEFAULT_BACKUP.manual, ...(b?.manual ?? {}) } };
  const old = raw.autoBackup;
  if (!b && old) {
    base.dir = old.dir ?? null;
    base.auto = { ...base.auto, on: !!old.dir, every: old.every === 'week' ? 'week' : old.every === 'day' ? 'day' : 'h4', keep: Math.min(100, Math.max(20, old.keep ?? 30)), last: old.last ?? null, lastName: old.lastName ?? null, error: old.error ?? null };
  }
  return base;
}

export const DEFAULT_SETTINGS: Settings = { sessionName: 'Cuaderno', sessionFont: DEFAULT_SESSION_FONT, side: DEFAULT_SIDE, iconStyle: DEFAULT_ICON_STYLE, colorIcon: DEFAULT_COLOR_ICON, viewIcons: {}, lang: 'es', hour12: false, sound: false, showMissed: true, focus: 'soft', snapOnOpen: true, reduceMotion: false, autoLockMinutes: 15, snap: true, grid: 24, notify: true, leadMin: 0, country: 'ES', weekStart: 1, dayStart: 7, dayEnd: 22, calView: 'month', weekNumbers: false, calLook: DEFAULT_CALLOOK, backup: DEFAULT_BACKUP, updateCheck: true };

export function uid(prefix: string): string {
  const r = new Uint8Array(8);
  crypto.getRandomValues(r);
  return prefix + '_' + Array.from(r, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function projectToDoc(p: Project): Doc {
  const { id, pos, ...data } = p;
  return { id, kind: 'project', parent: null, pos, updated: Date.now(), data };
}

export function cardToDoc(c: Card): Doc {
  const { id, project, pos, ...data } = c;
  return { id, kind: 'card', parent: project, pos, updated: Date.now(), data };
}

export function settingsToDoc(s: Settings): Doc {
  return { id: 'settings', kind: 'settings', parent: null, pos: 0, updated: Date.now(), data: s };
}

const CARD_TYPES: CardType[] = ['note', 'check', 'reminder', 'table', 'image', 'sketch', 'palette', 'widget', 'pm'];

/** Etiquetas globales (compartidas por todas las Tablas PM). */
export const pmTemplatesToDoc = (list: PmTemplate[]): Doc => ({ id: 'pmtpls', kind: 'pmtpls', parent: null, pos: 0, updated: Date.now(), data: { list } });
export const tagsToDoc = (tags: Opt[]): Doc => ({ id: 'tags', kind: 'tags', parent: null, pos: 0, updated: Date.now(), data: { tags } });

export function assetToDoc(a: Asset): Doc {
  return { id: a.id, kind: 'asset', parent: a.card, pos: 0, updated: Date.now(), data: { mime: a.mime, data: a.data } };
}

/** Completa campos que pueden faltar en datos guardados por versiones anteriores. */
function normalizeCard(raw: Record<string, unknown>, id: string, project: string, pos: number, i: number): Card {
  const base = { x: (i % 3) * 408, y: Math.floor(i / 3) * 320, w: 380, h: 0, z: i + 1, color: null, title: '', trashed: null };
  return { ...base, ...(raw as object), id, project, pos } as Card;
}

/** Convierte los documentos guardados en el estado de la app. Ignora lo que no entiende. */
export function fromDocs(docs: Doc[]): { projects: Project[]; cards: Card[]; settings: Settings; assets: Record<string, Asset>; calendars: Calendar[]; events: CalEvent[]; tags: Opt[]; pmTemplates: PmTemplate[]; folders: Folder[] } {
  let tags: Opt[] = [];
  let pmTemplates: PmTemplate[] = [];
  const projects: Project[] = [];
  const cards: Card[] = [];
  const assets: Record<string, Asset> = {};
  const calendars: Calendar[] = [];
  const events: CalEvent[] = [];
  const folders: Folder[] = [];
  let settings = DEFAULT_SETTINGS;
  let i = 0;
  for (const d of docs) {
    const data = (d.data ?? {}) as Record<string, unknown>;
    if (d.kind === 'project') { const p = { trashed: null, links: [], ...(data as Omit<Project, 'id' | 'pos'>), id: d.id, pos: d.pos } as Project; p.theme = normalizeTheme(p.theme); projects.push(p); }
    else if (d.kind === 'asset' && d.parent) assets[d.id] = { id: d.id, card: d.parent, mime: String(data.mime ?? ''), data: String(data.data ?? '') };
    else if (d.kind === 'card' && d.parent && CARD_TYPES.includes(data.type as CardType)) cards.push(normalizeCard(data, d.id, d.parent, d.pos, i++));
    else if (d.kind === 'settings') { const st = { ...DEFAULT_SETTINGS, ...(data as Partial<Settings>) }; st.sessionFont = normalizeFont(st.sessionFont, DEFAULT_SESSION_FONT); st.side = normalizeSide(st.side); st.iconStyle = normalizeIconStyle(st.iconStyle); st.colorIcon = normalizeColorIcon(st.colorIcon); st.viewIcons = normalizeViewIcons(st.viewIcons); st.backup = normalizeBackup(data as never); delete (st as { autoBackup?: unknown }).autoBackup; settings = st; }
    else if (d.kind === 'pmtpls') pmTemplates = Array.isArray((data as { list?: PmTemplate[] }).list) ? (data as { list: PmTemplate[] }).list : [];
    else if (d.kind === 'tags') tags = Array.isArray((data as { tags?: Opt[] }).tags) ? (data as { tags: Opt[] }).tags : [];
    else if (d.kind === 'folder') folders.push({ name: String(data.name ?? ''), collapsed: !!data.collapsed, id: d.id, pos: d.pos });
    else if (d.kind === 'calendar') calendars.push({ ...(data as Omit<Calendar, 'id' | 'pos'>), id: d.id, pos: d.pos });
    else if (d.kind === 'event' && d.parent) { const e = data as Partial<CalEvent>; events.push({ title: e.title ?? '', start: e.start ?? '', end: e.end ?? e.start ?? '', allDay: !!e.allDay, note: e.note ?? '', repeat: e.repeat ?? 'none', id: d.id, calendar: d.parent }); }
  }
  // Los calendarios integrados existen siempre (y conservan lo que el usuario cambió de ellos).
  for (const b of builtinCalendars(settings.lang)) if (!calendars.some((c) => c.id === b.id)) calendars.push(b);
  calendars.sort((a, b) => a.pos - b.pos);
  folders.sort((a, b) => a.pos - b.pos);
  projects.sort((a, b) => Number(!!b.home) - Number(!!a.home) || a.pos - b.pos);
  cards.sort((a, b) => a.pos - b.pos);
  return { projects, cards, settings, assets, calendars, events, tags, pmTemplates, folders };
}

/** Contenido inicial de un cuaderno vacío. */
export function starterDocs(lang: Language = 'es'): Doc[] {
  const home: Project = { id: 'home', name: tIn(lang, 'ui.starter.home'), color: '#2F6690', home: true, folder: null, pos: 0, trashed: null, links: [], theme: DEFAULT_THEME };
  const welcome: NoteCard = {
    id: uid('card'), project: 'home', type: 'note', title: tIn(lang, 'ui.starter.welcomeTitle'), x: 0, y: 0, w: 420, h: 0, z: 1, color: null, pos: 0, trashed: null,
    body: tIn(lang, 'ui.starter.welcomeBody'),
  };
  return [projectToDoc(home), cardToDoc(welcome), settingsToDoc({ ...DEFAULT_SETTINGS, lang })];
}
