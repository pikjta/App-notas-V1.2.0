import { describe, expect, it } from 'vitest';
import { explainError, mapRefs } from '../formula';
import { newCol, pmReduce, pmTemplate, colLetter, displayExpr, storeExpr, formulaValue, rowNumber, toCellFormula, numValue, cellText, total, formulaText, cellFormula, visibleRows } from '../pm';
import { pasteValue } from '../pmgrid';
import type { Pm } from '../pm';
import { calcCell, cellName, isFormula, showValue } from '../tablecalc';

/** Tabla PM sencilla: A = Nombre (texto), B = Precio (número), C = Cantidad (número), D = fórmula. */
function sample(expr: string): Pm {
  let pm: Pm = { ...pmTemplate(), cols: [], rows: [], views: pmTemplate().views };
  const mk = (type: 'text' | 'number' | 'formula', name: string, extra: object = {}) => { pm = pmReduce(pm, { op: 'addCol', col: { ...newCol(type, pm), id: 'c' + name, name, ...extra } }); };
  mk('text', 'Nombre'); mk('number', 'Precio'); mk('number', 'Cantidad');
  for (const [id, n, p, q] of [['r1', 'a', 10, 2], ['r2', 'b', 20, 3], ['r3', 'c', 30, 4]] as const) {
    pm = pmReduce(pm, { op: 'addRow', id });
    pm = pmReduce(pm, { op: 'cell', row: id, col: 'cNombre', value: n });
    pm = pmReduce(pm, { op: 'cell', row: id, col: 'cPrecio', value: p });
    pm = pmReduce(pm, { op: 'cell', row: id, col: 'cCantidad', value: q });
  }
  mk('formula', 'Calc', { expr: '', fmt: 'num' });
  pm = pmReduce(pm, { op: 'patchCol', id: pm.cols[3].id, patch: { expr: storeExpr(pm, expr) } });
  return pm;
}
const val = (pm: Pm, row = 0) => formulaValue(pm, pm.cols.find((c) => c.name === 'Calc')!, pm.rows[row], []);

describe('referencias tipo Excel en la Tabla PM (la fila 1 son las cabeceras)', () => {
  it('letras de columna y números de fila', () => {
    expect([0, 1, 25, 26, 27].map(colLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AB']);
    const pm = sample('1');
    expect([...pm.rows.map((r) => rowNumber(pm, r.id))]).toEqual([2, 3, 4]);
  });
  it('B3 apunta a una celda fija; B3:C4 y B:B son rangos dentro de funciones; B1 es la cabecera', () => {
    expect(val(sample('B3 * 2')).value).toBe(40);
    expect(val(sample('suma(B3:C4)')).value).toBe(20 + 3 + 30 + 4);
    expect(val(sample('suma(B:B)')).value).toBe(60); // el texto de la cabecera se ignora
    expect(val(sample('promedio(B2:B4)')).value).toBe(20);
    expect(val(sample('contar(B:B)')).value).toBe(3);
    expect(val(sample('max(B:C)')).value).toBe(30);
    expect(val(sample('B1')).value).toBe('Precio');
    expect(val(sample('{B} * {C}'), 2).value).toBe(120); // {B} = la columna B de la misma fila
  });
  it('se guarda por identidad: reordenar filas o columnas no cambia la celda a la que apunta', () => {
    let pm = sample('B3 + C4');
    expect(pm.cols.find((c) => c.name === 'Calc')!.expr).toBe('{#cPrecio:r2} + {#cCantidad:r3}');
    expect(val(pm).value).toBe(24);
    pm = pmReduce(pm, { op: 'moveRow', id: 'r2', before: null } as never);
    expect(rowNumber(pm, 'r2')).toBe(4);
    expect(val(pm).value).toBe(24); // sigue siendo el Precio de «b»
    expect(displayExpr(pm, pm.cols.find((c) => c.name === 'Calc')!.expr!)).toBe('B4 + C3');
  });
  it('si se borra la fila, el error lo explica y se muestra #REF', () => {
    let pm = sample('B3 * 2');
    pm = pmReduce(pm, { op: 'removeRow', id: 'r2' });
    const r = val(pm);
    expect(r.error).toContain('ya no existe');
    expect(displayExpr(pm, pm.cols.find((c) => c.name === 'Calc')!.expr!)).toBe('#REF * 2');
    expect(explainError(r.error!).title).toContain('no existe');
  });
  it('detecta círculos y celdas fuera de la tabla', () => {
    expect(val(sample('suma(B:D)')).error).toContain('circular');
    expect(val(sample('B9')).error).toBeNull(); // más allá de la última fila vale vacío, como en Excel
    expect(val(sample('Z1')).error).toContain('No existe la columna Z');
    expect(val(sample('B3:B4')).error).toContain('dentro de una función');
  });
  it('mapRefs no toca el texto entre comillas ni los nombres de funciones', () => {
    expect(mapRefs('concat("B2", B2) + round(1)', (r) => (r.k === 'ref' ? '<' + r.col + r.row + '>' : null))).toBe('concat("B2", <B2>) + round(1)');
  });
});

describe('fórmulas escritas en la celda (columnas de número y de texto)', () => {
  const put = (pm: Pm, row: string, col: string, typed: string) => pmReduce(pm, { op: 'cell', row, col, value: toCellFormula(pm, typed) });
  it('una celda «=…» se calcula, cuenta en totales, filtros y orden, y se muestra con letras', () => {
    let pm = sample('1');
    pm = put(pm, 'r1', 'cPrecio', '=B3+B4'); // 20 + 30
    const c = pm.cols.find((x) => x.name === 'Precio')!;
    expect(pm.rows[0].cells.cPrecio).toBe('={#cPrecio:r2}+{#cPrecio:r3}');
    expect(numValue(pm, c, pm.rows[0], [])).toBe(50);
    expect(cellText(pm, c, pm.rows[0], [])).toBe('50');
    expect(total(pm, { ...c, total: 'sum' }, pm.rows, [], '2026-10-01')).toBe('100');
    expect(formulaText(pm, pm.rows[0].cells.cPrecio as string)).toBe('=B3+B4');
    expect(visibleRows({ ...pm, sorts: [{ col: 'cPrecio', dir: 'desc' }] }, [], '2026-10-01').map((r) => r.id)).toEqual(['r1', 'r3', 'r2']);
  });
  it('funciones en español, comparaciones estilo Excel y errores', () => {
    let pm = sample('1');
    pm = put(pm, 'r1', 'cPrecio', '=SI(B3<>20;"otro";REDONDEAR(PROMEDIO(B3:B4);0))');
    expect(cellText(pm, pm.cols[1], pm.rows[0], [])).toBe('25');
    pm = put(pm, 'r1', 'cPrecio', '=Y(B3=20;C3=3)');
    expect(cellFormula(pm, pm.cols[1], pm.rows[0], [])!.value).toBe(true);
    pm = put(pm, 'r1', 'cPrecio', '=CONCATENAR(A3;"-";MAYUSC(A4))');
    expect(cellFormula(pm, pm.cols[1], pm.rows[0], [])!.value).toBe('b-C');
    pm = put(pm, 'r1', 'cPrecio', '=B2');
    expect(cellFormula(pm, pm.cols[1], pm.rows[0], [])!.error).toContain('circular');
  });
  it('pegar un texto «=…» en una celda de número o de texto crea la fórmula', () => {
    const pm = sample('1');
    expect(pasteValue(pm.cols[1], '=SUMA(B3:B4)', [], pm)!.value).toBe('=SUMA({#cPrecio:r2}:{#cPrecio:r3})');
    expect(pasteValue(pm.cols[1], '12,5', [], pm)!.value).toBe(12.5);
  });
});

describe('operaciones en la tarjeta Tabla', () => {
  const t = { heads: ['Producto', 'Precio', 'Cant.', 'Total'], rows: [
    { id: 'a', cells: ['Lápiz', '2,5', '4', '=B2*C2'] },
    { id: 'b', cells: ['Cuaderno', '10', '3', '=B3*C3'] },
    { id: 'c', cells: ['', '', '', '=suma(D2:D3)'] },
  ] };
  it('las celdas con «=» se calculan; A1 es la cabecera', () => {
    expect(isFormula('=1')).toBe(true);
    expect(cellName(-1, 0)).toBe('A1');
    expect(cellName(0, 3)).toBe('D2');
    expect(calcCell(t, 0, 3).value).toBe(10);
    expect(showValue(calcCell(t, 2, 3).value)).toBe('40');
    expect(showValue(calcCell({ ...t, rows: [{ id: 'x', cells: ['', '', '', '=B1+0,5'] }] }, 0, 3).value)).toBe('');
  });
  it('rangos, columna entera y funciones en español', () => {
    const g = { heads: ['A', 'B'], rows: [{ id: '1', cells: ['x', '1'] }, { id: '2', cells: ['y', '2,5'] }, { id: '3', cells: ['=promedio(B:B)', ''] }] };
    expect(calcCell(g, 2, 0).value).toBe(1.75);
    expect(calcCell({ ...g, rows: [{ id: '1', cells: ['', '=si(1>0;"sí";"no")'] }] }, 0, 1).value).toBe('sí');
  });
  it('errores: círculo, fuera de la tabla, texto en una cuenta', () => {
    const e = (cells: string[]) => calcCell({ heads: ['A', 'B'], rows: [{ id: '1', cells }] }, 0, 1).error;
    expect(e(['', '=B2'])).toContain('circular');
    expect(e(['', '=A9'])).toBeNull();
    expect(e(['hola', '=A2*2'])).toContain('no es un número');
    expect(e(['1', '=A2/0'])).toContain('cero');
  });
});
