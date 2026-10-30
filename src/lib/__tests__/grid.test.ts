import { describe, expect, it } from 'vitest';
import { allOf, inRect, isAll, parseTsv, pastePlan, rectOf, step, suggest, toTsv } from '../grid';

const d = { minRow: -1, rows: 3, cols: 4 };

describe('grid', () => {
  it('rectángulo y selección total', () => {
    const rc = rectOf({ a: { r: 2, c: 3 }, b: { r: 0, c: 1 } });
    expect(rc).toEqual({ r0: 0, c0: 1, r1: 2, c1: 3 });
    expect(inRect(rc, 1, 2)).toBe(true);
    expect(inRect(rc, 3, 2)).toBe(false);
    expect(isAll(allOf(d), d)).toBe(true);
    expect(isAll({ a: { r: 0, c: 0 }, b: { r: 2, c: 3 } }, d)).toBe(false);
  });
  it('flechas: se quedan dentro y Ctrl salta al borde', () => {
    expect(step({ r: 0, c: 0 }, 'ArrowUp', d)).toEqual({ r: -1, c: 0 });
    expect(step({ r: -1, c: 0 }, 'ArrowUp', d)).toEqual({ r: -1, c: 0 });
    expect(step({ r: 1, c: 2 }, 'ArrowRight', d, true)).toEqual({ r: 1, c: 3 });
    expect(step({ r: 1, c: 2 }, 'ArrowDown', d, true)).toEqual({ r: 2, c: 2 });
    expect(step({ r: 1, c: 0 }, 'ArrowLeft', d)).toEqual({ r: 1, c: 0 });
  });
  it('TSV: ida y vuelta con comillas, tabuladores y saltos de línea', () => {
    const m = [['a', 'b\tc'], ['d "x"', 'línea 1\nlínea 2'], ['', 'z']];
    expect(parseTsv(toTsv(m))).toEqual(m);
    expect(toTsv([['a', 'b'], ['c', 'd']])).toBe('a\tb\nc\td');
  });
  it('TSV: formato de Excel (\\r\\n y salto final)', () => {
    expect(parseTsv('1\t2\r\n3\t4\r\n')).toEqual([['1', '2'], ['3', '4']]);
    expect(parseTsv('solo')).toEqual([['solo']]);
    expect(parseTsv('a\t\tc')).toEqual([['a', '', 'c']]);
    expect(parseTsv('')).toEqual([['']]);
  });
  it('pegar una celda en un rango lo rellena; varias celdas van desde la esquina', () => {
    const one = pastePlan({ a: { r: 0, c: 0 }, b: { r: 1, c: 2 } }, [['x']]);
    expect(one.data).toEqual([['x', 'x', 'x'], ['x', 'x', 'x']]);
    const many = pastePlan({ a: { r: 2, c: 1 }, b: { r: 2, c: 1 } }, [['1', '2'], ['3']]);
    expect(many).toEqual({ at: { r: 2, c: 1 }, data: [['1', '2'], ['3', '']] });
  });
  it('sugerencias: valores de la columna, sin tildes ni mayúsculas, sin repetir', () => {
    const words = ['Andamio', 'Andamio', 'andén', 'Pintura roja', 'Bocetos'];
    expect(suggest('and', words)).toEqual(['Andamio', 'andén']);
    expect(suggest('ROJ', words)).toEqual(['roja']); // palabra suelta de otra celda
    expect(suggest('', words)).toEqual([]);
    expect(suggest('andamio', words)).toEqual([]); // ya está escrito completo
    expect(suggest('Pintura r', words)).toEqual(['Pintura roja']);
  });
});
