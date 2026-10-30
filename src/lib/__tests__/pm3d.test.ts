import { beforeEach, describe, expect, it } from 'vitest';
import { checkFormula, runFormula } from '../formula';
import { fromDocs, starterDocs } from '../model';
import type { PmCard } from '../model';
import { allStates, cellText, formulaValue, linkInfo, matches, newCol, numValue, pmReduce, pmTemplate, setWorld, total, visibleRows } from '../pm';
import type { Col, Pm, WorldCard } from '../pm';
import { emptyState, newCard, reduce } from '../store';
import type { State } from '../store';

const TODAY = '2026-10-11';
const by = (pm: Pm, n: string) => pm.cols.find((c) => c.name === n)!;
const f = (src: string, props: Record<string, unknown> = {}) => runFormula(src, (n) => { if (!(n in props)) throw new Error('No hay ' + n); return props[n] as never; }, TODAY);

describe('fórmulas: lenguaje', () => {
  it('aritmética con precedencia, texto, comparaciones y lógica', () => {
    expect(f('2 + 3 * 4')).toBe(14);
    expect(f('(2 + 3) * 4')).toBe(20);
    expect(f('-2 + 10 / 4')).toBe(0.5);
    expect(f('"Hola " + {Nombre}', { Nombre: 'Lucía' })).toBe('Hola Lucía');
    expect(f('{A} > 3 && !{B}', { A: 5, B: false })).toBe(true);
    expect(f('{A} = 5 o {A} = 6', { A: 6 })).toBe(true);
  });
  it('funciones, if perezoso y fechas', () => {
    expect(f('if({Pagado}, "Cobrado", "Pendiente")', { Pagado: true })).toBe('Cobrado');
    expect(f('if(true, 1, 1 / 0)')).toBe(1);
    expect(f('round({X} * 1.21, 2)', { X: 1234.5 })).toBe(1493.75);
    expect(f('max(1, 7, 3) + min(4, 2) + sum(1, 2, 3)')).toBe(15);
    expect(f('concat(upper("a"), length("hola"), contains("Mural", "ura"))')).toBe('A4Sí');
    expect(f('dateBetween("2026-10-30", today(), "days")')).toBe(19);
    expect(f('dateAdd("2026-01-31", 1, "months")')).toBe('2026-03-03');
    expect(f('prop("Horas") * 2', { Horas: 3 })).toBe(6);
  });
  it('errores claros en español', () => {
    expect(checkFormula('{Precio} *')).toBe('La fórmula está incompleta.');
    expect(checkFormula('foo(1)')).toBe('Función desconocida: foo().');
    expect(checkFormula('Precio * 2')).toContain('Para una propiedad escribe {Precio}');
    expect(checkFormula('"abc')).toBe('Falta cerrar unas comillas.');
    expect(() => f('1 / 0')).toThrow('División entre cero.');
    expect(checkFormula('round({A}, 2)')).toBeNull();
  });
});

function withFormula(expr: string, name = 'Calc', fmt: Col['fmt'] = 'num') {
  let pm = pmTemplate();
  pm = pmReduce(pm, { op: 'addCol', col: { ...newCol('formula', pm), name, expr, fmt } });
  pm = pmReduce(pm, { op: 'addRow', id: 'r' });
  pm = pmReduce(pm, { op: 'cell', row: 'r', col: by(pm, 'Presupuesto').id, value: 1000 });
  pm = pmReduce(pm, { op: 'cell', row: 'r', col: by(pm, 'Horas').id, value: 20 });
  pm = pmReduce(pm, { op: 'cell', row: 'r', col: by(pm, 'Fechas').id, value: { start: '2026-10-01', end: '2026-10-30' } });
  pm = pmReduce(pm, { op: 'cell', row: 'r', col: by(pm, 'Estado').id, value: allStates(by(pm, 'Estado'))[11].st.id });
  return pm;
}

describe('fórmulas en la tabla', () => {
  it('usa propiedades de cualquier tipo y respeta el formato de la columna', () => {
    const pm = withFormula('{Presupuesto} / {Horas}', 'Precio/hora', 'eur');
    expect(cellText(pm, by(pm, 'Precio/hora'), pm.rows[0], [])).toBe('50 €');
    const p2 = withFormula('if({Progreso} = 100, "Terminada", "En curso") + " · " + {Estado}');
    expect(cellText(p2, by(p2, 'Calc'), p2.rows[0], [])).toBe('Terminada · Entregado');
    const p3 = withFormula('dateBetween({Fechas}, today(), "days")');
    const now = new Date().toISOString().slice(0, 10);
    expect(numValue(p3, by(p3, 'Calc'), p3.rows[0], [])).toBe(Math.round((Date.parse('2026-10-01') - Date.parse(now)) / 86_400_000));
  });
  it('referencias a fórmulas, ciclos, propiedades que no existen; totales, filtros y orden', () => {
    let pm = withFormula('{Presupuesto} * 2', 'Doble');
    pm = pmReduce(pm, { op: 'addCol', col: { ...newCol('formula', pm), name: 'Cuádruple', expr: '{Doble} * 2' } });
    expect(numValue(pm, by(pm, 'Cuádruple'), pm.rows[0], [])).toBe(4000);
    pm = pmReduce(pm, { op: 'patchCol', id: by(pm, 'Doble').id, patch: { expr: '{Cuádruple} + 1' } });
    expect(formulaValue(pm, by(pm, 'Doble'), pm.rows[0], []).error).toBeTruthy();
    const bad = withFormula('{Precio} * 2');
    expect(formulaValue(bad, by(bad, 'Calc'), bad.rows[0], []).error).toBe('No hay ninguna propiedad «Precio».');
    let t = withFormula('{Presupuesto} * 2');
    t = pmReduce(t, { op: 'addRow', id: 'r2' });
    t = pmReduce(t, { op: 'cell', row: 'r2', col: by(t, 'Presupuesto').id, value: 300 });
    expect(total(t, { ...by(t, 'Calc'), total: 'sum' }, t.rows, [], TODAY)).toBe('2600');
    expect(matches(t, t.rows[1], { id: 'x', col: by(t, 'Calc').id, op: 'lt', val: '1000' }, [], TODAY)).toBe(true);
    expect(visibleRows({ ...t, sorts: [{ col: by(t, 'Calc').id, dir: 'asc' }] }, [], TODAY).map((r) => r.id)).toEqual(['r2', 'r']);
  });
});

describe('relaciones y resúmenes', () => {
  let s: State;
  let tasks: PmCard, mats: PmCard;
  beforeEach(() => {
    s = reduce(emptyState, { t: 'load', ...fromDocs(starterDocs()) }).state;
    tasks = { ...(newCard('pm', 'home') as PmCard), title: 'Seguimiento' };
    mats = { ...(newCard('pm', 'home') as PmCard), title: 'Materiales' };
    let m = mats.pm;
    const st = allStates(by(m, 'Estado'));
    for (const [i, [name, price, done]] of ([['Pintura', 180, true], ['Barniz', 45.5, false], ['Pinceles', 30, true]] as const).entries()) {
      m = pmReduce(m, { op: 'addRow', id: 'm' + i });
      m = pmReduce(m, { op: 'cell', row: 'm' + i, col: by(m, 'Tarea').id, value: name });
      m = pmReduce(m, { op: 'cell', row: 'm' + i, col: by(m, 'Presupuesto').id, value: price });
      if (done) m = pmReduce(m, { op: 'cell', row: 'm' + i, col: by(m, 'Estado').id, value: st[11].st.id });
    }
    mats = { ...mats, pm: m };
    let t = tasks.pm;
    const rel: Col = { ...newCol('relation', t), name: 'Materiales', target: mats.id };
    t = pmReduce(t, { op: 'addCol', col: rel });
    t = pmReduce(t, { op: 'addCol', col: { ...newCol('rollup', t), name: 'Coste', rel: rel.id, prop: by(m, 'Presupuesto').id, fn: 'sum', fmt: 'num' } });
    t = pmReduce(t, { op: 'addCol', col: { ...newCol('rollup', t), name: 'Listos', rel: rel.id, fn: 'pctDone' } });
    t = pmReduce(t, { op: 'addCol', col: { ...newCol('rollup', t), name: 'Cuáles', rel: rel.id, prop: by(m, 'Tarea').id, fn: 'list' } });
    t = pmReduce(t, { op: 'addRow', id: 't' });
    t = pmReduce(t, { op: 'cell', row: 't', col: rel.id, value: [{ kind: 'row', card: mats.id, row: 'm0' }, { kind: 'row', card: mats.id, row: 'm1', alias: 'Barniz UV' }, { kind: 'card', card: s.cards[0].id }, { kind: 'project', project: 'home' }] });
    tasks = { ...tasks, pm: t };
    s = reduce(reduce(s, { t: 'addCard', card: mats }).state, { t: 'addCard', card: tasks }).state;
    setWorld({ cards: s.cards as unknown as WorldCard[], projects: s.projects, tags: s.tags });
  });

  it('interna y externa en la misma celda, con alias; los enlaces rotos se detectan', () => {
    const t = (s.cards.find((c) => c.id === tasks.id) as PmCard).pm;
    expect(cellText(t, by(t, 'Materiales'), t.rows[0], [])).toBe('Pintura, Barniz UV, Bienvenida, Inicio');
    expect(linkInfo({ kind: 'row', card: mats.id, row: 'm0' })).toMatchObject({ title: 'Pintura', kind: 'Fila', where: 'Materiales · Inicio', missing: false });
    expect(linkInfo({ kind: 'row', card: mats.id, row: 'nope' }).missing).toBe(true);
  });

  it('resúmenes: suma con su propio formato (no hereda «€»), % completadas, lista y contar', () => {
    const t = (s.cards.find((c) => c.id === tasks.id) as PmCard).pm;
    expect(cellText(t, by(t, 'Coste'), t.rows[0], [])).toBe('225,5');
    expect(cellText(t, by(t, 'Listos'), t.rows[0], [])).toBe('50%');
    expect(cellText(t, by(t, 'Cuáles'), t.rows[0], [])).toBe('Pintura, Barniz');
    const t2 = pmReduce(t, { op: 'patchCol', id: by(t, 'Coste').id, patch: { fn: 'count' } });
    expect(cellText(t2, by(t2, 'Coste'), t2.rows[0], [])).toBe('4');
    const t3 = pmReduce(t, { op: 'patchCol', id: by(t, 'Coste').id, patch: { fmt: 'eur' } });
    expect(cellText(t3, by(t3, 'Coste'), t3.rows[0], [])).toBe('225,5 €');
  });

  it('una fórmula puede usar un resumen; el resumen se actualiza al cambiar la otra tabla', () => {
    let t = (s.cards.find((c) => c.id === tasks.id) as PmCard).pm;
    t = pmReduce(t, { op: 'addCol', col: { ...newCol('formula', t), name: 'Con IVA', expr: 'round({Coste} * 1.21, 2)', fmt: 'eur' } });
    expect(cellText(t, by(t, 'Con IVA'), t.rows[0], [])).toBe('272,86 €');
    const m = (s.cards.find((c) => c.id === mats.id) as PmCard).pm;
    s = reduce(s, { t: 'pm', card: mats.id, op: { op: 'cell', row: 'm1', col: by(m, 'Presupuesto').id, value: 100 } }).state;
    setWorld({ cards: s.cards as unknown as WorldCard[], projects: s.projects, tags: s.tags });
    expect(cellText(t, by(t, 'Coste'), t.rows[0], [])).toBe('280');
  });

  it('imágenes en celdas: se guardan aparte y se borran con la tarjeta', () => {
    let t = (s.cards.find((c) => c.id === tasks.id) as PmCard).pm;
    const img: Col = { ...newCol('image', t), name: 'Fotos' };
    s = reduce(s, { t: 'pm', card: tasks.id, op: { op: 'addCol', col: img } }).state;
    const e = reduce(s, { t: 'pmImage', card: tasks.id, row: 't', col: img.id, asset: { id: 'a1', card: tasks.id, mime: 'image/png', data: 'data:x' } });
    expect(e.put.map((d) => d.kind)).toEqual(['asset', 'card']);
    s = e.state;
    t = (s.cards.find((c) => c.id === tasks.id) as PmCard).pm;
    expect(cellText(t, img, t.rows[0], [])).toBe('1 imagen');
    s = reduce(s, { t: 'trashCard', id: tasks.id }).state;
    expect(reduce(s, { t: 'purgeCard', id: tasks.id }).del).toEqual([tasks.id, 'a1']);
  });
});
