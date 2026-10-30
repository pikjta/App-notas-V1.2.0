// Operaciones en la tarjeta Tabla: una celda que empieza por «=» es una fórmula, como en Excel.
// A1 es la primera columna y la primera fila (la de las cabeceras); los datos empiezan en la fila 2.
// Se usa el mismo lenguaje que las fórmulas de la Tabla PM (lib/formula.ts).

import { decimalSep, t as tr } from '../i18n';
import { runFormula } from './formula';
import type { FVal, Ref } from './formula';
import type { TableCard } from './model';

export type Calc = { value: FVal; error: string | null };
type Grid = Pick<TableCard, 'heads' | 'rows'>;

export const isFormula = (v: string | undefined) => !!v && v.trimStart().startsWith('=');
/** Nombre de una celda: columna 0, fila -1 (cabecera) → A1. */
export function cellName(r: number, c: number): string {
  let n = c + 1, s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s + (r + 2);
}
const colIndex = (l: string) => l.toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

function raw(t: Grid, r: number, c: number): string {
  return (r < 0 ? t.heads[c] : t.rows[r]?.cells[c]) ?? '';
}
const asValue = (s: string): FVal => {
  const x = s.trim();
  if (x === '') return null;
  const n = Number(x.replace(',', '.'));
  return /^-?\d+([.,]\d+)?$/.test(x) && !isNaN(n) ? n : s;
};

function evalAt(t: Grid, r: number, c: number, depth: number, stack: Set<string>): FVal {
  const key = r + ':' + c;
  const s = raw(t, r, c);
  if (!isFormula(s)) return asValue(s);
  if (depth > 20 || stack.has(key)) throw new Error(tr('calc.err.circular'));
  stack.add(key);
  try { return run(t, s, depth + 1, stack); } finally { stack.delete(key); }
}

function resolve(t: Grid, ref: Ref): { c: number; r: number } {
  if (ref.k !== 'ref') throw new Error(tr('calc.tc.badRef'));
  const c = colIndex(ref.col);
  if (c < 0 || c >= t.heads.length) throw new Error(tr('calc.tc.noColumn', { col: ref.col, last: cellName(0, t.heads.length - 1).replace(/\d+/, '') }));
  if (ref.row === 0) return { c, r: -2 };
  const r = ref.row - 2;
  return { c, r }; // más allá de la última fila vale vacío, como en Excel
}

function run(t: Grid, text: string, depth: number, stack: Set<string>): FVal {
  const src = text.trim().replace(/^=/, '');
  if (!src.trim()) return null;
  const today = new Date().toISOString().slice(0, 10);
  return runFormula(src, (name) => { throw new Error(tr('calc.tc.cite', { name })); }, today, {
    cell: (ref) => { const p = resolve(t, ref); if (p.r === -2) throw new Error(tr('calc.err.wholeCol')); if (p.r >= t.rows.length) return null; return evalAt(t, p.r, p.c, depth, stack); },
    range: (a, b) => {
      const A = resolve(t, a), B = resolve(t, b);
      const c0 = Math.min(A.c, B.c), c1 = Math.max(A.c, B.c);
      const whole = A.r === -2 || B.r === -2;
      const r0 = whole ? -1 : Math.min(A.r, B.r), r1 = whole ? t.rows.length - 1 : Math.min(t.rows.length - 1, Math.max(A.r, B.r));
      const out: FVal[] = [];
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(evalAt(t, r, c, depth, stack));
      return out;
    },
  });
}

/** Resultado de una celda (si no es fórmula, su propio texto). `at` marca la celda que se calcula, para detectar círculos. */
export function calcCell(t: Grid, r: number, c: number): Calc {
  const s = raw(t, r, c);
  if (!isFormula(s)) return { value: s, error: null };
  try { return { value: run(t, s, 1, new Set([r + ':' + c])), error: null }; } catch (e) { return { value: null, error: (e as Error).message }; }
}

/** El valor como se muestra en la celda. */
export function showValue(v: FVal): string {
  if (v === null) return '';
  if (typeof v === 'number') return isFinite(v) ? String(Math.round(v * 1e6) / 1e6).replace('.', decimalSep()) : '';
  if (typeof v === 'boolean') return v ? tr('calc.yes') : tr('calc.no');
  return v;
}
