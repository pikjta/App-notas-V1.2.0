// Apariencia: ambientes, colores y texturas del tablero y de las tarjetas, colores de la barra
// lateral, tipografías y colores de tarjeta. Funciones y datos puros (sin React).
//
// Los nombres visibles (`name`) son getters: se traducen al leerlos, así el idioma puede cambiar en caliente.
import { t } from '../i18n';
import type { Key } from '../i18n';

/** Objeto con un `name` que se traduce al leerlo (conserva la forma `{ name, … }` de siempre). */
const named = <T extends object>(key: Key, o: T): T & { name: string } => Object.defineProperties({ ...o }, { name: { get: () => t(key), enumerable: true } }) as T & { name: string };
/** Record id → nombre traducido al leerlo. */
const names = <K extends string>(m: Record<K, Key>): Record<K, string> => {
  const out = {} as Record<K, string>;
  (Object.keys(m) as K[]).forEach((k) => Object.defineProperty(out, k, { get: () => t(m[k]), enumerable: true }));
  return out;
};

// ---------------------------------------------------------------------------------------------
// Color

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(f.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminosidad relativa (0 = negro, 1 = blanco). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const isDark = (hex: string): boolean => luminance(hex) < 0.18; // 0,18: por debajo, el texto claro contrasta más que el oscuro

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a); const [r2, g2, b2] = hexToRgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return '#' + m(r1, r2) + m(g1, g2) + m(b1, b2);
}

// ---------------------------------------------------------------------------------------------
// Texturas (iguales para tablero y tarjetas)

export type Texture = 'liso' | 'puntos' | 'cuadricula' | 'cuaderno' | 'lienzo' | 'diagonal' | 'acuarela';
export const TEXTURES: Record<Texture, string> = names<Texture>({
  liso: 'set.tex.liso', puntos: 'set.tex.puntos', cuadricula: 'set.tex.cuadricula', cuaderno: 'set.tex.cuaderno', lienzo: 'set.tex.lienzo', diagonal: 'set.tex.diagonal', acuarela: 'set.tex.acuarela',
});
export const TEXTURE_IDS = Object.keys(TEXTURES) as Texture[];
/** Textura guardada por versiones anteriores → la equivalente de ahora. */
const OLD_TEXTURE: Record<string, Texture> = { rayas: 'cuaderno' };
export const normalizeTexture = (t: unknown): Texture => (typeof t === 'string' && t in TEXTURES ? (t as Texture) : OLD_TEXTURE[String(t)] ?? 'liso');

// ---------------------------------------------------------------------------------------------
// Tablero y tarjetas

export type BoardColor = 'papel' | 'hueso' | 'arena' | 'niebla' | 'lavanda' | 'noche' | 'abismo';
type Palette = { name: string; bg: string; ink: string; muted: string; line: string; dark: boolean };
const pal = (name: Key, bg: string, ink: string): Palette => {
  const dark = isDark(bg);
  return named(name, { bg, ink, muted: mix(bg, ink, 0.62), line: mix(bg, ink, dark ? 0.2 : 0.12), dark });
};
export const BOARD_COLORS: Record<BoardColor, Palette> = {
  papel: pal('set.c.papel', '#ECE6DA', '#24211E'),
  hueso: pal('set.boardColor.hueso', '#F6F3EC', '#24211E'),
  arena: pal('set.c.arena', '#F1E3CC', '#2B2219'),
  niebla: pal('set.boardColor.niebla', '#DDE3E6', '#1F272B'),
  lavanda: pal('set.boardColor.lavanda', '#E4DEEE', '#262033'),
  noche: pal('set.c.noche', '#1E1B26', '#F1EEF6'),
  abismo: pal('set.boardColor.abismo', '#0F1B2A', '#E8EEF5'),
};
export const BOARD_COLOR_IDS = Object.keys(BOARD_COLORS) as BoardColor[];
const OLD_BOARD: Record<string, BoardColor> = { lino: 'hueso', salvia: 'niebla', pizarra: 'abismo' };
export const normalizeBoardColor = (c: unknown): BoardColor => (typeof c === 'string' && c in BOARD_COLORS ? (c as BoardColor) : OLD_BOARD[String(c)] ?? 'papel');

export type CardTheme = 'papel' | 'blanco' | 'crema' | 'menta' | 'cielo' | 'grafito' | 'marino';
export const CARD_THEMES: Record<CardTheme, { name: string; bg: string; ink: string; dark: boolean }> = {
  papel: named('set.c.papel', { bg: '#FFFDF8', ink: '#1F1D1A', dark: false }),
  blanco: named('set.cardTheme.blanco', { bg: '#FFFFFF', ink: '#1F1D1A', dark: false }),
  crema: named('set.c.crema', { bg: '#FBF1DC', ink: '#2B2219', dark: false }),
  menta: named('set.c.menta', { bg: '#E1F1E8', ink: '#16291F', dark: false }),
  cielo: named('set.c.cielo', { bg: '#E1EEF8', ink: '#142536', dark: false }),
  grafito: named('set.cardTheme.grafito', { bg: '#2A2D31', ink: '#EEF0F2', dark: true }),
  marino: named('set.cardTheme.marino', { bg: '#1B2A44', ink: '#E8EEF8', dark: true }),
};
export const CARD_THEME_IDS = Object.keys(CARD_THEMES) as CardTheme[];
export const normalizeCardTheme = (c: unknown): CardTheme => (typeof c === 'string' && c in CARD_THEMES ? (c as CardTheme) : 'papel');

/** Apariencia del tablero de una tarea principal. */
export type Theme = { board: BoardColor; texture: Texture; card: CardTheme; cardTexture: Texture };
export const DEFAULT_THEME: Theme = { board: 'papel', texture: 'puntos', card: 'papel', cardTexture: 'liso' };
export const normalizeTheme = (t: Partial<Record<keyof Theme, unknown>> | undefined | null): Theme => ({
  board: normalizeBoardColor(t?.board), texture: t?.texture === undefined ? DEFAULT_THEME.texture : normalizeTexture(t.texture),
  card: normalizeCardTheme(t?.card), cardTexture: normalizeTexture(t?.cardTexture),
});

/** Ambientes: combinaciones listas de color y textura de tablero y tarjetas. */
export type Ambient = 'estudio' | 'cuaderno' | 'acuarela' | 'risografia' | 'noche' | 'taller';
export const AMBIENTS: Record<Ambient, { name: string; theme: Theme }> = {
  estudio: named('set.ambient.estudio', { theme: { board: 'papel', texture: 'puntos', card: 'papel', cardTexture: 'liso' } }),
  cuaderno: named('set.tex.cuaderno', { theme: { board: 'hueso', texture: 'cuaderno', card: 'blanco', cardTexture: 'cuaderno' } }),
  acuarela: named('set.tex.acuarela', { theme: { board: 'niebla', texture: 'acuarela', card: 'cielo', cardTexture: 'acuarela' } }),
  risografia: named('set.ambient.risografia', { theme: { board: 'lavanda', texture: 'diagonal', card: 'crema', cardTexture: 'puntos' } }),
  noche: named('set.c.noche', { theme: { board: 'noche', texture: 'puntos', card: 'grafito', cardTexture: 'liso' } }),
  taller: named('set.ambient.taller', { theme: { board: 'arena', texture: 'lienzo', card: 'crema', cardTexture: 'lienzo' } }),
};
export const AMBIENT_IDS = Object.keys(AMBIENTS) as Ambient[];

// ---------------------------------------------------------------------------------------------
// Color propio de cada tarjeta

export type CardColor = { id: string | null; name: string; bg: string; tag?: boolean };
export const CARD_COLORS: CardColor[] = [
  named('set.cardColor.auto', { id: null, bg: '#FFFDF8' }),
  named('set.cardColor.butter', { id: '#FFF3C4', bg: '#FFF3C4' }),
  named('set.cardColor.peach', { id: '#FDE2CF', bg: '#FDE2CF' }),
  named('set.cardColor.rose', { id: '#F8D9E2', bg: '#F8D9E2' }),
  named('set.cardColor.lilac', { id: '#E6DDF6', bg: '#E6DDF6' }),
  named('set.c.cielo', { id: '#D9E8F6', bg: '#D9E8F6' }),
  named('set.c.menta', { id: '#D6EEE2', bg: '#D6EEE2' }),
  named('set.c.papel', { id: '#F4EFE4', bg: '#F4EFE4' }),
  named('set.c.tinta', { id: '#2B2926', bg: '#2B2926' }),
  named('set.c.bosque', { id: '#1F3A2E', bg: '#1F3A2E' }),
  named('set.cardColor.illustration', { id: '#C9B6E4', bg: '#C9B6E4', tag: true }),
  named('set.cardColor.painting', { id: '#F2B6A0', bg: '#F2B6A0', tag: true }),
  named('set.cardColor.client', { id: '#A9D3C2', bg: '#A9D3C2', tag: true }),
  named('set.cardColor.urgent', { id: '#F08A7C', bg: '#F08A7C', tag: true }),
  named('set.cardColor.digital', { id: '#9CC3EA', bg: '#9CC3EA', tag: true }),
];

/** Contraste WCAG entre dos colores (1–21). */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Texto legible sobre un fondo cualquiera (también los elegidos con el selector libre): el claro o el oscuro del tema si llegan a 4,5 : 1 y, si no, negro o blanco. */
export function inkFor(bg: string): string {
  const light = '#F2EEE6', dark = '#1F1D1A';
  const best = contrast(bg, light) >= contrast(bg, dark) ? light : dark;
  if (contrast(bg, best) >= 4.5) return best;
  return contrast(bg, '#FFFFFF') >= contrast(bg, '#000000') ? '#FFFFFF' : '#000000';
}

/** Variables de color de una tarjeta: su color propio (o el del tablero) y un texto legible encima. */
export function cardVars(color: string | null, theme: Theme): Record<string, string> {
  const base = CARD_THEMES[theme.card];
  const bg = color ?? base.bg;
  const ink = color ? inkFor(bg) : base.ink;
  const dark = isDark(bg);
  return {
    ['--card-bg']: bg, ['--card-ink']: ink, ['--card-muted']: mix(bg, ink, 0.62),
    ['--card-line']: mix(bg, ink, dark ? 0.22 : 0.12), ['--card-soft']: mix(bg, ink, dark ? 0.12 : 0.05),
  };
}

// ---------------------------------------------------------------------------------------------
// Barra lateral

export type SideColor = 'papel' | 'salvia' | 'arcilla' | 'ocre' | 'tinta' | 'cobalto' | 'bosque';
export const SIDE_COLORS: Record<SideColor, { name: string; bg: string }> = {
  papel: named('set.c.papel', { bg: '#E8E1D3' }),
  salvia: named('set.sideColor.salvia', { bg: '#C9D4C3' }),
  arcilla: named('set.sideColor.arcilla', { bg: '#DDB9AB' }),
  ocre: named('set.c.ocre', { bg: '#D9B25F' }),
  tinta: named('set.c.tinta', { bg: '#24211E' }),
  cobalto: named('set.c.cobalto', { bg: '#1F3F7A' }),
  bosque: named('set.c.bosque', { bg: '#1F3A2E' }),
};
export const SIDE_COLOR_IDS = Object.keys(SIDE_COLORS) as SideColor[];
export type SideStyle = { color: SideColor; texture: Texture };
export const DEFAULT_SIDE: SideStyle = { color: 'tinta', texture: 'liso' };
export const normalizeSide = (s: Partial<SideStyle> | undefined): SideStyle => ({
  color: s?.color && s.color in SIDE_COLORS ? s.color : DEFAULT_SIDE.color, texture: normalizeTexture(s?.texture ?? 'liso'),
});
export function sideVars(s: SideStyle): Record<string, string> {
  const bg = SIDE_COLORS[s.color].bg;
  const ink = isDark(bg) ? '#F3EEE6' : '#24211E';
  return { ['--side-bg']: bg, ['--side-ink']: ink, ['--side-muted']: mix(bg, ink, 0.6), ['--side-line']: mix(bg, ink, 0.18), ['--side-soft']: mix(bg, ink, 0.1) };
}

// ---------------------------------------------------------------------------------------------
// Tipografías (nombre de la sesión y título de cada tablero)

export type FontFamily = 'clasica' | 'elegante' | 'moderna' | 'geometrica' | 'manuscrita' | 'maquina' | 'editorial' | 'libro' | 'artistica' | 'titular' | 'cartel' | 'rotulador';
// Pilas de fuentes del sistema: la app no carga nada de internet.
export const FONTS: Record<FontFamily, { name: string; stack: string }> = {
  clasica: named('set.font.clasica', { stack: "'Fraunces Variable', Georgia, 'Times New Roman', serif" }),
  elegante: named('set.font.elegante', { stack: "'Didot', 'Bodoni MT', 'Playfair Display', 'Palatino Linotype', serif" }),
  moderna: named('set.font.moderna', { stack: "'Manrope Variable', 'Segoe UI', system-ui, sans-serif" }),
  geometrica: named('set.font.geometrica', { stack: "'Century Gothic', 'Avenir Next', Futura, 'Trebuchet MS', sans-serif" }),
  manuscrita: named('set.font.manuscrita', { stack: "'Segoe Script', 'Bradley Hand', 'Brush Script MT', 'Comic Sans MS', cursive" }),
  maquina: named('set.font.maquina', { stack: "'Courier New', 'American Typewriter', Courier, monospace" }),
  editorial: named('set.font.editorial', { stack: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif" }),
  libro: named('set.font.libro', { stack: "Charter, 'Bitstream Charter', Cambria, 'Iowan Old Style', serif" }),
  artistica: named('set.font.artistica', { stack: "'Gabriola', 'Papyrus', 'Apple Chancery', 'Lucida Calligraphy', fantasy" }),
  titular: named('set.font.titular', { stack: "'Arial Black', 'Helvetica Neue', Impact, sans-serif" }),
  cartel: named('set.font.cartel', { stack: "Impact, 'Haettenschweiler', 'Arial Narrow Bold', sans-serif" }),
  rotulador: named('set.font.rotulador', { stack: "'Marker Felt', 'Segoe Print', 'Comic Sans MS', cursive" }),
};
export const FONT_IDS = Object.keys(FONTS) as FontFamily[];

export type FontSize = 'S' | 'M' | 'L' | 'XL';
export type FontWeight = 'normal' | 'semi' | 'bold';
/** `color`: null = tinta automática (según la barra o el fondo); «task» = color de la tarea principal; si no, un hex. */
export type FontStyle = { family: FontFamily; size: FontSize; weight: FontWeight; italic: boolean; color: string | null };
export const DEFAULT_SESSION_FONT: FontStyle = { family: 'clasica', size: 'M', weight: 'semi', italic: false, color: null };
export const DEFAULT_TITLE_FONT: FontStyle = { family: 'clasica', size: 'L', weight: 'semi', italic: false, color: null };
const WEIGHT: Record<FontWeight, number> = { normal: 400, semi: 600, bold: 800 };
export const SIZE_PX: Record<'session' | 'title', Record<FontSize, number>> = {
  session: { S: 20, M: 26, L: 32, XL: 38 },
  title: { S: 30, M: 38, L: 44, XL: 58 },
};
export const WEIGHT_LABEL: Record<FontWeight, string> = names<FontWeight>({ normal: 'set.weight.normal', semi: 'set.weight.semi', bold: 'set.weight.bold' });
export const FONT_COLORS: { id: string | null; name: string }[] = [
  named('set.c.tinta', { id: null }), named('set.fontColor.task', { id: 'task' }),
  named('set.fontColor.carbon', { id: '#2A2724' }), named('set.fontColor.bone', { id: '#F4EFE4' }), named('set.fontColor.terracotta', { id: '#C2603E' }), named('set.fontColor.vermilion', { id: '#D8412F' }),
  named('set.fontColor.magenta', { id: '#C2287A' }), named('set.fontColor.plum', { id: '#6E2F5F' }), named('set.fontColor.indigo', { id: '#3B3F9E' }), named('set.c.cobalto', { id: '#2458B8' }),
  named('set.fontColor.turquoise', { id: '#17908A' }), named('set.fontColor.olive', { id: '#6B7A2A' }), named('set.c.ocre', { id: '#C99A2E' }), named('set.fontColor.stone', { id: '#8C857A' }),
];
export const normalizeFont = (f: Partial<FontStyle> | undefined, base: FontStyle): FontStyle => ({
  family: f?.family && f.family in FONTS ? f.family : base.family,
  size: f?.size && ['S', 'M', 'L', 'XL'].includes(f.size) ? f.size : base.size,
  weight: f?.weight && f.weight in WEIGHT ? f.weight : base.weight,
  italic: typeof f?.italic === 'boolean' ? f.italic : base.italic,
  color: f?.color === undefined ? base.color : f.color,
});

/** Estilos CSS de una tipografía. `taskColor` es el color de la tarea principal. */
export function fontCss(f: FontStyle, kind: 'session' | 'title', taskColor?: string): Record<string, string | number> {
  const color = f.color === 'task' ? taskColor : f.color ?? undefined;
  const css: Record<string, string | number> = { fontFamily: FONTS[f.family].stack, fontSize: SIZE_PX[kind][f.size], fontWeight: WEIGHT[f.weight], fontStyle: f.italic ? 'italic' : 'normal' };
  if (color) css.color = color;
  return css;
}

// ---------------------------------------------------------------------------------------------
// Cuadrícula del imán

export const GRID_SIZES: { value: 16 | 24 | 32; name: string }[] = [named('set.grid.fine', { value: 16 as const }), named('set.grid.medium', { value: 24 as const }), named('set.grid.wide', { value: 32 as const })];
