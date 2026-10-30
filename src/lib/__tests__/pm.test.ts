import { describe, expect, it } from 'vitest';
import { fromDocs, starterDocs } from '../model';
import type { PmCard } from '../model';
import { allStates, cellText, convert, matches, newCol, pmReduce, pmTemplate, progress, tableProgress, total, visibleRows } from '../pm';
import type { Pm, Row } from '../pm';
import { diff, emptyState, newCard, reduce, search, searchIndex, snapOf } from '../store';
import type { Action, State } from '../store';

const TODAY = '2026-10-11';
const loaded = (): State => reduce(emptyState, { t: 'load', ...fromDocs(starterDocs()) }).state;
const run = (s: State, ...as: Action[]) => as.reduce((acc, a) => reduce(acc, a).state, s);
const byName = (pm: Pm, n: string) => pm.cols.find((c) => c.name === n)!;

/** Tabla de ejemplo con 4 filas. */
function sample(): Pm {
  let pm = pmTemplate();
  const st = allStates(byName(pm, 'Estado'));
  const resp = byName(pm, 'Responsable').opts!;
  const rows: [string, number, number | null, number, string, boolean, string, string][] = [
    ['Reunión inicial', 1, 1, 0, resp[0].id, true, '2026-09-01', '2026-09-03'],
    ['Bocetos', 4, 14, 600, resp[0].id, true, '2026-09-07', '2026-09-18'],
    ['Pintado del mural', 9, 80, 2400, resp[2].id, false, '2026-10-05', '2026-10-25'],
    ['Entrega', -1, null, 0, resp[1].id, false, '', ''],
  ];
  for (const [i, r] of rows.entries()) {
    const id = 'r' + i;
    pm = pmReduce(pm, { op: 'addRow', id });
    const set = (n: string, v: Row['cells'][string]) => { pm = pmReduce(pm, { op: 'cell', row: id, col: byName(pm, n).id, value: v }); };
    set('Tarea', r[0]); if (r[1] >= 0) set('Estado', st[r[1]].st.id); set('Horas', r[2]); set('Presupuesto', r[3]); set('Responsable', r[4]); set('Facturado', r[5]); set('Fechas', { start: r[6], end: r[7] });
  }
  return pm;
}

describe('Tabla PM · núcleo', () => {
  it('1 · crear una tabla en el tablero y guardarla como un solo documento', () => {
    const c = newCard('pm', 'home') as PmCard;
    const e = reduce(loaded(), { t: 'addCard', card: c });
    expect(e.put[0].kind).toBe('card');
    expect((e.state.cards.find((x) => x.id === c.id) as PmCard).pm.cols.map((x) => x.name)).toEqual(['Tarea', 'Estado', 'Progreso', 'Responsable', 'Etiquetas', 'Fechas', 'Horas', 'Presupuesto', 'Facturado']);
  });

  it('2 · añadir, editar, mover y borrar filas (y deshacer)', () => {
    const c = newCard('pm', 'home') as PmCard;
    const s0 = run(loaded(), { t: 'addCard', card: c });
    const tarea = c.pm.cols[0].id;
    const s1 = run(s0, { t: 'pm', card: c.id, op: { op: 'addRow', id: 'a' } }, { t: 'pm', card: c.id, op: { op: 'addRow', id: 'b' } }, { t: 'pm', card: c.id, op: { op: 'cell', row: 'b', col: tarea, value: 'Segunda' } }, { t: 'pm', card: c.id, op: { op: 'moveRow', id: 'b', before: 'a' } });
    const pm1 = (s1.cards.find((x) => x.id === c.id) as PmCard).pm;
    expect(pm1.rows.map((r) => r.id)).toEqual(['b', 'a']);
    const s2 = run(s1, { t: 'pm', card: c.id, op: { op: 'removeRow', id: 'a' } });
    expect((s2.cards.find((x) => x.id === c.id) as PmCard).pm.rows).toHaveLength(1);
    expect(diff(snapOf(s2), snapOf(s1)).put[0].id).toBe(c.id);
  });

  it('3 · cambiar el tipo de columna conserva los datos (ida y vuelta)', () => {
    const pm = sample();
    const txt = (p: Pm, n: string) => p.rows.map((r) => cellText(p, byName(p, n), r, []));
    const back = (p: Pm, n: string, a: Parameters<typeof convert>[2], b: Parameters<typeof convert>[2]) => convert(convert(p, byName(p, n).id, a, []).pm, byName(p, n).id, b, []).pm;
    expect(txt(back(pm, 'Responsable', 'text', 'select'), 'Responsable')).toEqual(txt(pm, 'Responsable'));
    expect(txt(back(pm, 'Horas', 'text', 'number'), 'Horas')).toEqual(txt(pm, 'Horas'));
    expect(txt(back(pm, 'Estado', 'text', 'status'), 'Estado')).toEqual(txt(pm, 'Estado'));
    expect(txt(back(pm, 'Facturado', 'text', 'checkbox'), 'Facturado')).toEqual(txt(pm, 'Facturado'));
    expect(txt(back(pm, 'Fechas', 'text', 'date'), 'Fechas')).toEqual(txt(pm, 'Fechas'));
    const multi = convert(pm, byName(pm, 'Responsable').id, 'multi', []).pm;
    expect(txt(multi, 'Responsable')).toEqual(txt(pm, 'Responsable'));
  });

  it('4 · opciones: renombrar y borrar se refleja en las celdas', () => {
    let pm = sample();
    const col = byName(pm, 'Responsable');
    pm = pmReduce(pm, { op: 'patchCol', id: col.id, patch: { opts: col.opts!.map((o, i) => (i === 0 ? { ...o, name: 'Yo mismo' } : o)) } });
    expect(cellText(pm, byName(pm, 'Responsable'), pm.rows[0], [])).toBe('Yo mismo');
    pm = pmReduce(pm, { op: 'patchCol', id: col.id, patch: { opts: byName(pm, 'Responsable').opts!.slice(1) } });
    expect(cellText(pm, byName(pm, 'Responsable'), pm.rows[0], [])).toBe('');
  });

  it('5 · estado con fases y 6 · progreso calculado (fila y tabla)', () => {
    const pm = sample();
    const st = byName(pm, 'Estado');
    expect(st.phases!.map((p) => p.name + ':' + p.states.length)).toEqual(['Inicio:2', 'Desarrollo:5', 'Verificación:3', 'Entrega:2']);
    const prog = byName(pm, 'Progreso');
    expect(pm.rows.map((r) => progress(pm, prog, r))).toEqual([9, 36, 82, 0]);
    expect(tableProgress(pm)).toBe(32);
  });

  it('7 · mover, ocultar, ensanchar y borrar columnas', () => {
    let pm = sample();
    const fechas = byName(pm, 'Fechas');
    pm = pmReduce(pm, { op: 'moveCol', id: fechas.id, before: pm.cols[1].id });
    expect(pm.cols[1].name).toBe('Fechas');
    pm = pmReduce(pm, { op: 'patchCol', id: fechas.id, patch: { w: 240, hidden: true } });
    expect(byName(pm, 'Fechas')).toMatchObject({ w: 240, hidden: true });
    const st = byName(pm, 'Estado');
    pm = pmReduce(pm, { op: 'removeCol', id: st.id });
    expect(byName(pm, 'Progreso').source).toBeUndefined();
    expect(pm.rows[0].cells[st.id]).toBeUndefined();
  });

  it('8 · filtros Y / O y 9 · orden por varias columnas', () => {
    const pm = sample();
    const resp = byName(pm, 'Responsable'), fact = byName(pm, 'Facturado'), fechas = byName(pm, 'Fechas');
    const f1 = { id: 'f1', col: resp.id, op: 'is' as const, val: resp.opts![0].id };
    const f2 = { id: 'f2', col: fact.id, op: 'unchecked' as const, val: '' };
    expect(visibleRows({ ...pm, filters: [f1, f2], conj: 'and' }, [], TODAY)).toHaveLength(0);
    expect(visibleRows({ ...pm, filters: [f1, f2], conj: 'or' }, [], TODAY)).toHaveLength(4);
    expect(matches(pm, pm.rows[1], { id: 'x', col: fechas.id, op: 'overdue', val: '' }, [], TODAY)).toBe(true);
    expect(matches(pm, pm.rows[2], { id: 'x', col: fechas.id, op: 'overdue', val: '' }, [], TODAY)).toBe(false);
    const sorted = visibleRows({ ...pm, sorts: [{ col: resp.id, dir: 'asc' }, { col: byName(pm, 'Presupuesto').id, dir: 'desc' }] }, [], TODAY);
    expect(sorted.map((r) => r.id)).toEqual(['r1', 'r0', 'r3', 'r2']);
  });

  it('10 · fila de totales', () => {
    const pm = sample();
    const t = (n: string, fn: Parameters<typeof total>[1]['total']) => total(pm, { ...byName(pm, n), total: fn }, pm.rows, [], TODAY);
    expect([t('Presupuesto', 'sum'), t('Presupuesto', 'max'), t('Horas', 'avg'), t('Facturado', 'pct'), t('Progreso', 'avg'), t('Tarea', 'count'), t('Fechas', 'overdue')])
      .toEqual(['3000 €', '2400 €', '31,67 h', '50%', '32%', '4 filas', '2']);
  });

  it('12 · etiquetas globales: una nueva sirve en todas las tablas; renombrar se propaga', () => {
    const a = newCard('pm', 'home') as PmCard, b = newCard('pm', 'home') as PmCard;
    let s = run(loaded(), { t: 'addCard', card: a }, { t: 'addCard', card: b }, { t: 'tags', tags: [{ id: 't1', name: 'Exterior', color: 'green' }] });
    const tagCol = (c: PmCard) => c.pm.cols.find((x) => x.name === 'Etiquetas')!.id;
    s = run(s, { t: 'pm', card: a.id, op: { op: 'addRow', id: 'x' } }, { t: 'pm', card: a.id, op: { op: 'cell', row: 'x', col: tagCol(a), value: ['t1'] } });
    s = run(s, { t: 'pm', card: b.id, op: { op: 'addRow', id: 'y' } }, { t: 'pm', card: b.id, op: { op: 'cell', row: 'y', col: tagCol(b), value: ['t1'] } });
    s = run(s, { t: 'tags', tags: [{ id: 't1', name: 'Fachada', color: 'green' }] });
    const txt = (id: string, row: string) => { const c = s.cards.find((x) => x.id === id) as PmCard; return cellText(c.pm, c.pm.cols.find((x) => x.name === 'Etiquetas')!, c.pm.rows.find((r) => r.id === row)!, s.tags); };
    expect([txt(a.id, 'x'), txt(b.id, 'y')]).toEqual(['Fachada', 'Fachada']);
    expect(search(searchIndex(s), 'fachada')).toHaveLength(2);
    expect(fromDocs([...starterDocs(), ...reduce(s, { t: 'tags', tags: s.tags }).put]).tags).toEqual(s.tags);
  });

  it('columnas nuevas de cada tipo', () => {
    const pm = sample();
    for (const t of ['text', 'number', 'select', 'multi', 'status', 'progress', 'checkbox', 'date'] as const) {
      const c = newCol(t, pm);
      expect(c.type).toBe(t);
      if (t === 'progress') expect(c.source).toBe(byName(pm, 'Estado').id);
    }
  });
});
