import { ICON_DATA } from './iconData';
import { t } from '../i18n';
import type { Key } from '../i18n';

/** Estilos de iconos que se pueden elegir en «Personalizar barra». «notion» es el más parecido a los iconos de Notion. */
export type IconStyle = 'notion' | 'lineal' | 'grueso' | 'relleno' | 'duotono';
export const ICON_STYLES: { id: IconStyle; name: string }[] = [
  { id: 'notion', get name() { return t('ui.iconStyle.notion'); } },
  { id: 'lineal', get name() { return t('ui.iconStyle.lineal'); } },
  { id: 'grueso', get name() { return t('ui.iconStyle.grueso'); } },
  { id: 'relleno', get name() { return t('ui.iconStyle.relleno'); } },
  { id: 'duotono', get name() { return t('ui.iconStyle.duotono'); } },
];
export const DEFAULT_ICON_STYLE: IconStyle = 'notion';

export type IconKey = string;
export const ICON_KEYS = Object.keys(ICON_DATA);
export const hasIcon = (k: unknown): k is IconKey => typeof k === 'string' && k in ICON_DATA;

/** Iconos posibles para el botón de color de las tarjetas (el primero es el predeterminado). */
export const COLOR_ICONS: { id: IconKey; name: string }[] = [
  { id: 'palette', get name() { return t('ui.icon.palette'); } },
  { id: 'drop', get name() { return t('ui.icon.drop'); } },
  { id: 'bucket', get name() { return t('ui.icon.bucket'); } },
  { id: 'swatches', get name() { return t('ui.icon.swatches'); } },
  { id: 'brush', get name() { return t('ui.icon.brush'); } },
];
export const DEFAULT_COLOR_ICON: IconKey = 'palette';

export const normalizeIconStyle = (s: unknown): IconStyle => (ICON_STYLES.some((x) => x.id === s) ? (s as IconStyle) : DEFAULT_ICON_STYLE);
export const normalizeColorIcon = (k: unknown): IconKey => (COLOR_ICONS.some((x) => x.id === k) ? (k as IconKey) : DEFAULT_COLOR_ICON);

/** Contenido SVG de un icono en un estilo (cadena de confianza: viene de iconData.ts, no del usuario). */
export function iconMarkup(key: IconKey, style: IconStyle): string {
  const d = ICON_DATA[key] ?? ICON_DATA.folder;
  return d[style] ?? d.notion;
}

/** Nombre de cada icono en el idioma actual (para elegirlo y para lectores de pantalla). Getters: se resuelve al leer. */
const ICON_LABEL_KEYS: Record<string, Key> = {
 home: 'ui.icon.home', sun: 'ui.icon.sun', bell: 'ui.icon.bell', calendar: 'ui.icon.calendar', graph: 'ui.icon.graph',
 journal: 'ui.icon.journal', trash: 'ui.icon.trash', palette: 'ui.icon.palette', drop: 'ui.icon.drop', bucket: 'ui.icon.bucket',
 swatches: 'ui.icon.swatches', brush: 'ui.icon.brush', folder: 'ui.icon.folder', star: 'ui.icon.star', heart: 'ui.icon.heart',
 briefcase: 'ui.icon.briefcase', camera: 'ui.icon.camera', music: 'ui.icon.music', book: 'ui.icon.book', image: 'ui.icon.image',
 pencil: 'ui.icon.pencil', bulb: 'ui.icon.bulb', rocket: 'ui.icon.rocket', globe: 'ui.icon.globe', flag: 'ui.icon.flag',
 target: 'ui.icon.target', cube: 'ui.icon.cube', code: 'ui.icon.code', cart: 'ui.icon.cart', plane: 'ui.icon.plane',
 car: 'ui.icon.car', coffee: 'ui.icon.coffee', leaf: 'ui.icon.leaf', flame: 'ui.icon.flame', gift: 'ui.icon.gift',
 cap: 'ui.icon.cap', chart: 'ui.icon.chart', clock: 'ui.icon.clock', pin: 'ui.icon.pin', users: 'ui.icon.users',
 chat: 'ui.icon.chat', mail: 'ui.icon.mail', wrench: 'ui.icon.wrench', sparkle: 'ui.icon.sparkle', moon: 'ui.icon.moon',
 cloud: 'ui.icon.cloud', bookmark: 'ui.icon.bookmark', check: 'ui.icon.check', film: 'ui.icon.film', scissors: 'ui.icon.scissors',
 megaphone: 'ui.icon.megaphone', wallet: 'ui.icon.wallet', house2: 'ui.icon.house2',
};
export const ICON_LABELS: Record<string, string> = Object.defineProperties({}, Object.fromEntries(Object.entries(ICON_LABEL_KEYS).map(([id, k]) => [id, { get: () => t(k), enumerable: true }])));
export const iconLabel = (k: IconKey): string => ICON_LABELS[k] ?? k;

/** Entradas de la barra lateral con icono configurable (Ajustes de «Personalizar barra»). */
export type ViewIconId = 'home' | 'today' | 'reminders' | 'calendar' | 'graph' | 'journal' | 'trash';
export const VIEW_ICONS: { id: ViewIconId; name: string; def: IconKey }[] = [
  { id: 'home', get name() { return t('ui.side.home'); }, def: 'home' },
  { id: 'today', get name() { return t('ui.side.today'); }, def: 'sun' },
  { id: 'reminders', get name() { return t('ui.side.reminders'); }, def: 'bell' },
  { id: 'calendar', get name() { return t('ui.side.calendar'); }, def: 'calendar' },
  { id: 'graph', get name() { return t('ui.side.graph'); }, def: 'graph' },
  { id: 'journal', get name() { return t('ui.side.journal'); }, def: 'journal' },
  { id: 'trash', get name() { return t('ui.side.trash'); }, def: 'trash' },
];
export type ViewIcons = Partial<Record<ViewIconId, IconKey>>;

/** Solo se guardan las entradas conocidas con un icono que exista; el resto usa el predeterminado. */
export function normalizeViewIcons(v: unknown): ViewIcons {
  const out: ViewIcons = {};
  if (v && typeof v === 'object') for (const e of VIEW_ICONS) { const k = (v as Record<string, unknown>)[e.id]; if (hasIcon(k) && k !== e.def) out[e.id] = k; }
  return out;
}
export const viewIconOf = (v: ViewIcons | undefined, id: ViewIconId): IconKey => {
  const k = v?.[id];
  return hasIcon(k) ? k : VIEW_ICONS.find((e) => e.id === id)!.def;
};
