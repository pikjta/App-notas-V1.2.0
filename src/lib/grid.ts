/**
 * Motor de celdas tipo Excel (sin interfaz): posiciones, rangos, movimiento con el teclado,
 * copiar y pegar como texto con tabuladores (TSV, el formato de Excel) y sugerencias de autocompletado.
 * Lo usan la Tabla y la Tabla PM.
 */

export type Pos = { r: number; c: number };
export type Sel = { a: Pos; b: Pos };
export type Rect = { r0: number; c0: number; r1: number; c1: number };
export type Dims = { minRow: number; rows: number; cols: number };

export const rectOf = (s: Sel): Rect => ({ r0: Math.min(s.a.r, s.b.r), c0: Math.min(s.a.c, s.b.c), r1: Math.max(s.a.r, s.b.r), c1: Math.max(s.a.c, s.b.c) });
export const inRect = (rc: Rect, r: number, c: number) => r >= rc.r0 && r <= rc.r1 && c >= rc.c0 && c <= rc.c1;
export const isSingle = (s: Sel) => s.a.r === s.b.r && s.a.c === s.b.c;
/** Todas las celdas (desde la fila `minRow`, que puede ser -1 si las cabeceras cuentan como una fila). */
export const allOf = (d: Dims): Sel => ({ a: { r: d.minRow, c: 0 }, b: { r: d.rows - 1, c: d.cols - 1 } });
export const isAll = (s: Sel, d: Dims) => { const rc = rectOf(s); return rc.r0 <= d.minRow && rc.c0 <= 0 && rc.r1 >= d.rows - 1 && rc.c1 >= d.cols - 1; };

/** Marca que acompaña al texto copiado cuando incluye las cabeceras (la primera línea son nombres de columna). */
export const GRID_MIME = 'application/x-cuaderno-grid';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Nueva posición tras pulsar una flecha (Ctrl/⌘ salta al borde); se queda dentro de la tabla. */
export function step(p: Pos, key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight', d: Dims, jump = false): Pos {
  const big = 1e9;
  const dr = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
  const dc = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
  return { r: clamp(p.r + dr * (jump ? big : 1), d.minRow, d.rows - 1), c: clamp(p.c + dc * (jump ? big : 1), 0, d.cols - 1) };
}

/** Texto de una celda para el portapapeles: entre comillas si tiene tabulador, salto de línea o comillas. */
const quote = (s: string) => (/[\t\n\r"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
export const toTsv = (m: string[][]) => m.map((row) => row.map(quote).join('\t')).join('\n');

/** Lee texto con tabuladores (de Excel, Calc, Google Sheets…). Entiende comillas, «\r\n» y celdas con saltos de línea. */
export function parseTsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cell = '', q = false, i = 0;
  const t = text;
  while (i < t.length) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
      cell += ch; i++; continue;
    }
    if (ch === '"' && cell === '') { q = true; i++; continue; }
    if (ch === '\t') { row.push(cell); cell = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); out.push(row); row = []; cell = ''; i++; continue;
    }
    cell += ch; i++;
  }
  // Una última línea sin salto de línea cuenta; el salto final de Excel no añade una fila vacía.
  if (cell !== '' || row.length || q) { row.push(cell); out.push(row); }
  return out.length ? out : [['']];
}

/** Matriz rectangular (rellena con '' las filas más cortas). */
export function rectangular(m: string[][]): string[][] {
  const w = m.reduce((n, r) => Math.max(n, r.length), 0);
  return m.map((r) => [...r, ...new Array<string>(w - r.length).fill('')]);
}

/** Qué escribir al pegar: con una sola celda copiada y un rango elegido, se rellena el rango entero (como Excel). */
export function pastePlan(sel: Sel, m: string[][]): { at: Pos; data: string[][] } {
  const rc = rectOf(sel);
  const data = rectangular(m);
  if (data.length === 1 && data[0].length === 1 && !isSingle(sel)) {
    return { at: { r: rc.r0, c: rc.c0 }, data: Array.from({ length: rc.r1 - rc.r0 + 1 }, () => new Array<string>(rc.c1 - rc.c0 + 1).fill(data[0][0])) };
  }
  return { at: { r: rc.r0, c: rc.c0 }, data };
}

/**
 * Sugerencias de autocompletado para lo que se está escribiendo: valores o palabras de la misma
 * columna que empiezan igual (sin mayúsculas ni tildes), sin repetir y sin lo que ya está escrito.
 */
export function suggest(typed: string, words: string[], max = 6): string[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(typed.trimStart());
  if (!t.trim()) return [];
  const lastWord = norm(typed.split(/\s+/).pop() ?? '');
  const seen = new Set<string>();
  const hits: string[] = [];
  const add = (shown: string) => { const k = norm(shown); if (!seen.has(k) && k !== t.trim()) { seen.add(k); hits.push(shown); } };
  const whole: string[] = [], part: string[] = [];
  for (const w of words) {
    const v = w.trim();
    if (!v) continue;
    if (norm(v).startsWith(t)) whole.push(v);
    else for (const p of v.split(/\s+/)) if (p.length > 1 && lastWord.length > 0 && norm(p).startsWith(lastWord)) part.push(typed.slice(0, typed.length - (typed.split(/\s+/).pop() ?? '').length) + p);
  }
  // Primero los valores enteros de la columna; luego, palabras sueltas.
  for (const v of whole) add(v);
  for (const v of part) add(v);
  return hits.slice(0, max);
}
