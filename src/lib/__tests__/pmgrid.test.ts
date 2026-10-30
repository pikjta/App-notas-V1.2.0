import { describe, expect, it } from 'vitest';
import { pasteValue, PASTABLE } from '../pmgrid';
import type { Col } from '../pm';

const col = (type: Col['type'], extra: Partial<Col> = {}): Col => ({ id: 'c', name: 'C', type, w: 100, ...extra });

describe('pasteValue', () => {
  it('texto, número (coma o punto), casilla y fecha', () => {
    expect(pasteValue(col('text'), ' hola ', [])).toEqual({ value: ' hola ' });
    expect(pasteValue(col('number'), '1.234,5', [])).toEqual({ value: 1234.5 });
    expect(pasteValue(col('number'), '', [])).toEqual({ value: null });
    expect(pasteValue(col('number'), 'abc', [])).toBeNull();
    expect(pasteValue(col('checkbox'), 'Sí', [])).toEqual({ value: true });
    expect(pasteValue(col('checkbox'), 'no', [])).toEqual({ value: false });
    expect(pasteValue(col('date'), '05/03/2026', [])).toEqual({ value: { start: '2026-03-05', end: '' } });
    expect(pasteValue(col('date'), 'mañana-ish', [])).toBeNull();
  });
  it('opciones por nombre (sin tildes ni mayúsculas); las que no existen se ignoran', () => {
    const c = col('select', { opts: [{ id: 'o1', name: 'Ilustración', color: 'rose' }] });
    expect(pasteValue(c, 'ilustracion', [])).toEqual({ value: 'o1' });
    expect(pasteValue(c, 'Otra', [])).toBeNull();
    const m = col('multi', { opts: [{ id: 'a', name: 'A', color: 'rose' }, { id: 'b', name: 'B', color: 'rose' }] });
    expect(pasteValue(m, 'A, b, z', [])).toEqual({ value: ['a', 'b'] });
    expect(pasteValue(m, '', [])).toEqual({ value: [] });
  });
  it('las columnas calculadas no se pegan', () => {
    for (const t of ['formula', 'rollup', 'progress', 'timer', 'relation', 'image'] as const) { expect(pasteValue(col(t), 'x', [])).toBeNull(); expect(PASTABLE.has(t)).toBe(false); }
  });
});
