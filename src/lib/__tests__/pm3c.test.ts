import { describe, expect, it } from 'vitest';
import { allStates, asTimer, convert, depConflict, formatTimer, pmReduce, pmTemplate, ruleFor, runningTimer, shiftIsoDay, timelineOrder, timelineRange, timerMs, total } from '../pm';
import type { Pm } from '../pm';

const by = (pm: Pm, n: string) => pm.cols.find((c) => c.name === n)!;
const TODAY = '2026-10-11';

function sample(): Pm {
  let pm = pmTemplate();
  pm = pmReduce(pm, { op: 'addCol', col: { id: 'tm', name: 'Tiempo', type: 'timer', w: 120, total: 'sum' } });
  for (const [i, t] of ['Contrato', 'Bocetos', 'Pintado'].entries()) { pm = pmReduce(pm, { op: 'addRow', id: 'r' + i }); pm = pmReduce(pm, { op: 'cell', row: 'r' + i, col: by(pm, 'Tarea').id, value: t }); }
  const f = by(pm, 'Fechas').id;
  pm = pmReduce(pm, { op: 'cell', row: 'r0', col: f, value: { start: '2026-09-01', end: '2026-09-03' } });
  pm = pmReduce(pm, { op: 'cell', row: 'r1', col: f, value: { start: '2026-09-07', end: '2026-09-18' } });
  pm = pmReduce(pm, { op: 'cell', row: 'r2', col: f, value: { start: '2026-09-15', end: '2026-10-20' } });
  return pm;
}

describe('Tabla PM · Fase 3c', () => {
  it('1 · cronología: rango, orden propio de la vista y desplazar fechas', () => {
    const pm = sample();
    const col = by(pm, 'Fechas');
    const r = timelineRange(pm.rows, col, TODAY, 'day');
    expect(r.start).toBe('2026-08-25');
    expect(shiftIsoDay(r.start, r.days - 1)).toBe('2026-10-27');
    const week = timelineRange(pm.rows, col, TODAY, 'week');
    expect(new Date(week.start + 'T00:00:00').getDay()).toBe(1); // empieza en lunes
    const reordered = pmReduce(pm, { op: 'ui', patch: { order: ['r2', 'r0'] } });
    expect(timelineOrder(reordered, reordered.rows).map((x) => x.id)).toEqual(['r2', 'r0', 'r1']);
    expect(pm.rows.map((x) => x.id)).toEqual(['r0', 'r1', 'r2']); // la tabla no cambia
    expect(shiftIsoDay('2026-02-27', 3)).toBe('2026-03-02');
  });

  it('2 · dependencias en la cronología: conflicto si la bloqueada empieza antes de que termine la otra', () => {
    const pm = sample();
    expect(depConflict(pm, pm.rows[0], pm.rows[1])).toBe(false);
    expect(depConflict(pm, pm.rows[1], pm.rows[2])).toBe(true);
  });

  it('3 · cronómetro: uno solo en marcha, acumula, se para y se reinicia', () => {
    let pm = sample();
    pm = pmReduce(pm, { op: 'timer', row: 'r0', col: 'tm', action: 'start', now: 1_000 });
    expect(runningTimer(pm)?.row.id).toBe('r0');
    pm = pmReduce(pm, { op: 'timer', row: 'r1', col: 'tm', action: 'start', now: 61_000 });
    expect(asTimer(pm.rows[0].cells.tm)).toEqual({ ms: 60_000, start: null });
    expect(runningTimer(pm)?.row.id).toBe('r1');
    expect(timerMs(pm.rows[1].cells.tm, 3_661_000)).toBe(3_600_000);
    pm = pmReduce(pm, { op: 'timer', row: 'r1', col: 'tm', action: 'stop', now: 3_661_000 });
    expect(runningTimer(pm)).toBeNull();
    expect(total(pm, by(pm, 'Tiempo'), pm.rows, [], TODAY)).toBe(formatTimer(3_660_000));
    expect(formatTimer(3_660_000)).toBe('1:01:00');
    pm = pmReduce(pm, { op: 'timer', row: 'r0', col: 'tm', action: 'reset', now: 0 });
    expect(asTimer(pm.rows[0].cells.tm).ms).toBe(0);
    const asNum = convert(pm, 'tm', 'number', []).pm;
    expect(asNum.rows[1].cells.tm).toBe(1); // 1 h
    expect(asTimer(convert(asNum, 'tm', 'timer', []).pm.rows[1].cells.tm).ms).toBe(3_600_000);
  });

  it('4 · recurrentes: al llegar al último estado se crea la siguiente con fechas desplazadas y todo a cero', () => {
    let pm = sample();
    const st = by(pm, 'Estado'), states = allStates(st);
    pm = pmReduce(pm, { op: 'row', id: 'r0', patch: { recur: 'month', subs: [{ id: 's', text: 'Enviar factura', done: true }] } });
    pm = pmReduce(pm, { op: 'cell', row: 'r0', col: by(pm, 'Facturado').id, value: true });
    pm = pmReduce(pm, { op: 'timer', row: 'r0', col: 'tm', action: 'start', now: 0 });
    pm = pmReduce(pm, { op: 'cell', row: 'r0', col: st.id, value: states[3].st.id });
    expect(pm.rows).toHaveLength(3);
    pm = pmReduce(pm, { op: 'cell', row: 'r0', col: st.id, value: states[states.length - 1].st.id, nextId: 'r0b' });
    expect(pm.rows.map((r) => r.id)).toEqual(['r0', 'r0b', 'r1', 'r2']);
    const n = pm.rows[1];
    expect(n.cells[by(pm, 'Fechas').id]).toEqual({ start: '2026-10-01', end: '2026-10-03' });
    expect([n.cells[st.id], n.cells[by(pm, 'Facturado').id], asTimer(n.cells.tm).ms, n.subs![0].done, n.recur, n.hist]).toEqual([states[0].st.id, false, 0, false, 'month', undefined]);
    expect(n.cells[by(pm, 'Tarea').id]).toBe('Contrato');
    // Volver a guardar el mismo estado final no crea otra.
    expect(pmReduce(pm, { op: 'cell', row: 'r0', col: st.id, value: states[states.length - 1].st.id }).rows).toHaveLength(4);
    // Fin de mes: 31 de enero + 1 mes → 28 de febrero.
    let m = pmReduce(sample(), { op: 'row', id: 'r0', patch: { recur: 'month' } });
    m = pmReduce(m, { op: 'cell', row: 'r0', col: by(m, 'Fechas').id, value: { start: '2027-01-31', end: '' } });
    const ms = allStates(by(m, 'Estado'));
    m = pmReduce(m, { op: 'cell', row: 'r0', col: by(m, 'Estado').id, value: ms[ms.length - 1].st.id, nextId: 'x' });
    expect(m.rows[1].cells[by(m, 'Fechas').id]).toEqual({ start: '2027-02-28', end: '' });
  });

  it('5 · formato condicional: la primera regla que se cumple gana', () => {
    let pm = sample();
    const f = by(pm, 'Fechas').id, fact = by(pm, 'Facturado').id;
    pm = pmReduce(pm, { op: 'cell', row: 'r1', col: fact, value: true });
    pm = pmReduce(pm, { op: 'rules', rules: [
      { id: 'a', filter: { id: 'x', col: f, op: 'overdue', val: '' }, color: 'red', bold: true },
      { id: 'b', filter: { id: 'y', col: fact, op: 'checked', val: '' }, color: 'green', bold: false },
    ] });
    expect(ruleFor(pm, pm.rows[0], [], TODAY)?.id).toBe('a');
    expect(ruleFor(pm, pm.rows[1], [], TODAY)?.id).toBe('a'); // vencida y facturada: gana la primera
    expect(ruleFor(pm, pm.rows[2], [], TODAY)).toBeNull();
    pm = pmReduce(pm, { op: 'rules', rules: [...pm.rules!].reverse() });
    expect(ruleFor(pm, pm.rows[1], [], TODAY)?.id).toBe('b');
  });
});

describe('cronómetro en toda la app', () => {
  it('arrancar uno en una tabla para el que iba en otra', async () => {
    const { emptyState, newCard, reduce } = await import('../store');
    const { fromDocs, starterDocs } = await import('../model');
    type C = { id: string; type: string; pm: Pm };
    let s = reduce(emptyState, { t: 'load', ...fromDocs(starterDocs()) }).state;
    const mk = () => { const c = newCard('pm', 'home') as unknown as C; c.pm = pmReduce(pmReduce(c.pm, { op: 'addCol', col: { id: 'tm', name: 'T', type: 'timer', w: 100 } }), { op: 'addRow', id: 'r' }); return c; };
    const a = mk(), b = mk();
    s = reduce(s, { t: 'addCard', card: a as never }).state;
    s = reduce(s, { t: 'addCard', card: b as never }).state;
    s = reduce(s, { t: 'pm', card: a.id, op: { op: 'timer', row: 'r', col: 'tm', action: 'start', now: 0 } }).state;
    const e = reduce(s, { t: 'pm', card: b.id, op: { op: 'timer', row: 'r', col: 'tm', action: 'start', now: 5000 } });
    const get = (id: string) => (e.state.cards.find((c) => c.id === id) as unknown as C).pm;
    expect(runningTimer(get(a.id))).toBeNull();
    expect(asTimer(get(a.id).rows[0].cells.tm).ms).toBe(5000);
    expect(runningTimer(get(b.id))?.row.id).toBe('r');
    expect(e.put).toHaveLength(2);
  });
});
