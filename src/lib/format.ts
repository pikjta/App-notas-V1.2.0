import type { CSSProperties } from 'react';

/**
 * Formato de una tarea de checklist, una celda de tabla o una celda de Tabla PM: se guarda como estilo
 * de esa celda (no como marcas dentro del texto). La Nota sigue usando Markdown.
 */
export type CellFmt = { b?: true; i?: true; u?: true; s?: true; color?: string; bg?: string; align?: 'left' | 'center' | 'right' };
/** Cambio de formato: un valor lo pone y `null` lo quita. */
export type FmtPatch = { [K in keyof CellFmt]?: CellFmt[K] | null };
export type FmtFlag = 'b' | 'i' | 'u' | 's';

const HEX = /^#[0-9a-fA-F]{6}$/;
const ALIGN = new Set(['left', 'center', 'right']);

/** Aplica un cambio; devuelve `undefined` si ya no queda ningún formato. */
export function applyFmt(f: CellFmt | null | undefined, patch: FmtPatch): CellFmt | undefined {
  const out: Record<string, unknown> = { ...(f ?? {}) };
  for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined) delete out[k]; else out[k] = v; }
  return Object.keys(out).length ? (out as CellFmt) : undefined;
}

/** Estilo CSS de un formato. Solo admite valores válidos: lo que venga mal guardado se ignora. */
export function fmtStyle(f: CellFmt | null | undefined): CSSProperties | undefined {
  if (!f) return undefined;
  const st: CSSProperties = {};
  if (f.b) st.fontWeight = 700;
  if (f.i) st.fontStyle = 'italic';
  const deco = [f.u ? 'underline' : '', f.s ? 'line-through' : ''].filter(Boolean).join(' ');
  if (deco) st.textDecoration = deco;
  if (f.color && HEX.test(f.color)) st.color = f.color;
  if (f.bg && HEX.test(f.bg)) st.backgroundColor = f.bg;
  if (f.align && ALIGN.has(f.align)) st.textAlign = f.align;
  return Object.keys(st).length ? st : undefined;
}

/** ¿Todos tienen ese formato? */
export const allHave = (list: (CellFmt | null | undefined)[], key: FmtFlag) => list.length > 0 && list.every((f) => !!f?.[key]);
/** Cambio para el botón B, I, U o S: si todos ya lo tienen se quita; si no, se pone a todos. */
export const toggleFlag = (list: (CellFmt | null | undefined)[], key: FmtFlag): FmtPatch => ({ [key]: allHave(list, key) ? null : true });
/** Valor común de color, fondo o alineación (o null si difieren o no hay). */
export function commonValue<K extends 'color' | 'bg' | 'align'>(list: (CellFmt | null | undefined)[], key: K): CellFmt[K] | null {
  if (!list.length) return null;
  const first = list[0]?.[key] ?? null;
  return list.every((f) => (f?.[key] ?? null) === first) ? first : null;
}
