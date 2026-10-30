import type { CellVal, Col, Opt, Pm, Row } from './pm';
import { allStates, optsOf, toCellFormula } from './pm';
import { exportValue, parseDateRange, parseNumber } from './pmio';

const fold = (t: string) => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const YES = /^(s[ií]|x|✓|true|verdadero|yes|1)$/i;
const NO = /^(no|false|falso|0|)$/i;

/** Tipos cuyo valor se puede escribir desde fuera (pegar, vaciar): el resto se calcula o tiene su propio control. */
export const PASTABLE = new Set(['text', 'number', 'select', 'multi', 'status', 'checkbox', 'date']);

/** Texto de una celda para el portapapeles: el mismo que se exporta (decimales con coma, fechas dd/mm/aaaa). */
export const copyValue = (pm: Pm, col: Col, row: Row, tags: Opt[]) => exportValue(pm, col, row, tags, true);

/**
 * Valor que corresponde a un texto pegado en una columna, o `null` si no se puede aplicar
 * (columna calculada, opción que no existe, número o fecha ilegible): esa celda se deja como estaba.
 */
export function pasteValue(col: Col, raw: string, tags: Opt[], pm?: Pm): { value: CellVal } | null {
  const t = raw.trim();
  // Un texto que empieza por «=» es una fórmula (solo en columnas de texto y número).
  if (pm && col.type === 'number' && t.startsWith('=')) return { value: toCellFormula(pm, t) };
  switch (col.type) {
    case 'text': return { value: raw };
    case 'number': { if (!t) return { value: null }; const n = parseNumber(t); return n === null ? null : { value: n }; }
    case 'checkbox': return YES.test(t) ? { value: true } : NO.test(t) ? { value: false } : null;
    case 'date': { if (!t) return { value: null }; const d = parseDateRange(t); return d ? { value: d } : null; }
    case 'select': {
      if (!t) return { value: null };
      const o = optsOf(col, tags).find((x) => fold(x.name) === fold(t));
      return o ? { value: o.id } : null;
    }
    case 'multi': {
      if (!t) return { value: [] };
      const opts = optsOf(col, tags);
      const ids = t.split(',').map((x) => opts.find((o) => fold(o.name) === fold(x))?.id).filter((x): x is string => !!x);
      return ids.length ? { value: ids } : null;
    }
    case 'status': {
      if (!t) return { value: null };
      const s = allStates(col).find((x) => fold(x.st.name) === fold(t));
      return s ? { value: s.st.id } : null;
    }
    default: return null;
  }
}
