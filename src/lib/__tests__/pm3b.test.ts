import { describe, expect, it } from 'vitest';
import { fromDocs, starterDocs } from '../model';
import { allStates, blockers, blocking, cellText, formatDuration, kanbanColumns, kanbanDropValue, phaseDurations, pmReduce, pmTemplate, tableProgress, visibleRows, wouldCycle } from '../pm';
import type { Pm } from '../pm';
import { applyImport, asTemplate, builtinTemplates, guessType, instantiate, parseCsv, parseDateRange, parseNumber, planImport, toClipboard, toCsv } from '../pmio';
import { emptyState, reduce } from '../store';

const by = (pm: Pm, n: string) => pm.cols.find((c) => c.name === n)!;
const TODAY = '2026-10-11';

function sample(): Pm {
  let pm = pmTemplate();
  const st = allStates(by(pm, 'Estado'));
  const set = (row: string, col: string, value: Parameters<typeof pmReduce>[1] extends infer _ ? unknown : never, at?: number) => { pm = pmReduce(pm, { op: 'cell', row, col: by(pm, col).id, value: value as never, at }); };
  for (const [i, t] of ['Contrato', 'Bocetos', 'Pintado'].entries()) { pm = pmReduce(pm, { op: 'addRow', id: 'r' + i }); set('r' + i, 'Tarea', t); }
  set('r0', 'Estado', st[1].st.id, Date.UTC(2026, 8, 1));
  set('r1', 'Estado', st[2].st.id, Date.UTC(2026, 8, 2));
  set('r1', 'Estado', st[7].st.id, Date.UTC(2026, 8, 6));
  set('r1', 'Estado', st[11].st.id, Date.UTC(2026, 8, 8));
  set('r1', 'Presupuesto', 1234.5); set('r1', 'Facturado', true); set('r1', 'Fechas', { start: '2026-09-07', end: '2026-09-18' });
  set('r2', 'Tarea', 'Pintado; con "comillas"');
  return pm;
}

describe('Tabla PM · Fase 3b', () => {
  it('1 · página de la fila: descripción y subtareas', () => {
    let pm = pmReduce(sample(), { op: 'row', id: 'r0', patch: { desc: '## Notas\n- [ ] Firmar', subs: [{ id: 's1', text: 'Escanear', done: true }, { id: 's2', text: 'Archivar', done: false }] } });
    expect(pm.rows[0]).toMatchObject({ desc: '## Notas\n- [ ] Firmar', subs: [{ done: true }, { done: false }] });
    pm = pmReduce(pm, { op: 'cell', row: 'r0', col: by(pm, 'Tarea').id, value: 'Contrato firmado' });
    expect(pm.rows[0].subs).toHaveLength(2);
  });

  it('2 · historial de estados con tiempo por fase', () => {
    const pm = sample();
    expect(pm.rows[1].hist!.map((h) => cellText(pm, by(pm, 'Estado'), { id: 'x', cells: { [by(pm, 'Estado').id]: h.state } }, []))).toEqual(['Bocetos', 'Revisión del cliente', 'Entregado']);
    const d = phaseDurations(by(pm, 'Estado'), pm.rows[1], Date.UTC(2026, 8, 10));
    expect(d.map((x) => [x.phase.name, formatDuration(x.ms)])).toEqual([['Desarrollo', '4 días'], ['Verificación', '2 días'], ['Entrega', '2 días']]);
    // Volver a poner el mismo estado no añade una entrada.
    const again = pmReduce(pm, { op: 'cell', row: 'r1', col: by(pm, 'Estado').id, value: pm.rows[1].cells[by(pm, 'Estado').id] });
    expect(again.rows[1].hist).toHaveLength(3);
  });

  it('3 · dependencias: bloqueos, ciclos y limpieza al borrar', () => {
    let pm = pmReduce(sample(), { op: 'row', id: 'r2', patch: { deps: ['r0', 'r1'] } });
    expect(blockers(pm, pm.rows[2]).map((r) => r.id)).toEqual(['r0']); // r1 está entregada
    expect(blocking(pm, pm.rows[0]).map((r) => r.id)).toEqual(['r2']);
    expect(wouldCycle(pm, 'r0', 'r2')).toBe(true);
    expect(wouldCycle(pm, 'r2', 'r0')).toBe(false);
    pm = pmReduce(pm, { op: 'removeRow', id: 'r0' });
    expect(pm.rows.find((r) => r.id === 'r2')!.deps).toEqual(['r1']);
  });

  it('4 · archivadas: no cuentan en el progreso ni se ven, salvo al mostrarlas', () => {
    let pm = sample();
    const before = tableProgress(pm);
    pm = pmReduce(pm, { op: 'row', id: 'r1', patch: { archived: true } });
    expect(tableProgress(pm)).not.toBe(before);
    expect(visibleRows(pm, [], TODAY).map((r) => r.id)).toEqual(['r0', 'r2']);
    pm = pmReduce(pm, { op: 'ui', patch: { showArchived: true } });
    expect(visibleRows(pm, [], TODAY)).toHaveLength(3);
  });

  it('5 · Kanban por fase, por estado, por selección y por casilla, y el valor al soltar', () => {
    const pm = sample();
    const st = by(pm, 'Estado');
    const phase = kanbanColumns(pm, pm.rows, { col: st.id, mode: 'phase' }, []);
    expect(phase.map((k) => k.label + ':' + k.rows.length)).toEqual(['Sin valor:1', 'Inicio:1', 'Desarrollo:0', 'Verificación:0', 'Entrega:1']);
    const toDev = phase.find((k) => k.label === 'Desarrollo')!;
    expect(kanbanDropValue(pm, { col: st.id, mode: 'phase' }, pm.rows[0], phase[1], toDev)).toBe(allStates(st)[2].st.id);
    const states = kanbanColumns(pm, pm.rows, { col: st.id, mode: 'state' }, []);
    expect(states.filter((k) => k.rows.length).map((k) => k.label)).toEqual(['Sin valor', 'Contratado', 'Entregado']);
    const chk = kanbanColumns(pm, pm.rows, { col: by(pm, 'Facturado').id, mode: 'value' }, []);
    expect(chk.map((k) => k.rows.length)).toEqual([2, 1]);
  });

  it('6 · búsqueda en la tabla: celdas, descripción y subtareas, sin tildes', () => {
    const pm = pmReduce(sample(), { op: 'row', id: 'r0', patch: { desc: 'Reunión en el café', subs: [{ id: 's', text: 'Llamar a Lucía', done: false }] } });
    expect(visibleRows(pm, [], TODAY, 'bocetos').map((r) => r.id)).toEqual(['r1']);
    expect(visibleRows(pm, [], TODAY, 'cafe').map((r) => r.id)).toEqual(['r0']);
    expect(visibleRows(pm, [], TODAY, 'lucia').map((r) => r.id)).toEqual(['r0']);
    expect(visibleRows(pm, [], TODAY, 'entregado').map((r) => r.id)).toEqual(['r1']);
  });

  it('7 · exportar CSV para Excel en español y copiar para Excel', () => {
    const pm = sample();
    const csv = toCsv(pm, pm.rows, [], ';');
    const lines = csv.replace('\uFEFF', '').trim().split('\r\n');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(lines[0]).toBe('Tarea;Estado;Progreso;Responsable;Etiquetas;Fechas;Horas;Presupuesto;Facturado');
    expect(lines[2]).toBe('Bocetos;Entregado;100;;;07/09/2026 - 18/09/2026;;1234,5;Sí');
    expect(lines[3].startsWith('"Pintado; con ""comillas"""')).toBe(true);
    expect(toCsv(pm, pm.rows, [], ',').split('\r\n')[2]).toContain('1234.5');
    const clip = toClipboard(pm, pm.rows, []);
    expect(clip.text.split('\n')[2].split('\t')[7]).toBe('1234,5');
    expect(clip.html).toContain('<th>Presupuesto</th>');
    expect(clip.html).toContain('&quot;'.length ? 'comillas' : '');
  });

  it('8 · importar CSV: separador, BOM, comillas, números, fechas y sí/no; columnas nuevas con tipo adivinado', () => {
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('2.400 €')).toBe(2400);
    expect(parseDateRange('07/09/2026 - 18/09/2026')).toEqual({ start: '2026-09-07', end: '2026-09-18' });
    expect(parseDateRange('2026-10-01')).toEqual({ start: '2026-10-01', end: '' });
    expect(guessType(['sí', 'no', 'x'])).toBe('checkbox');
    expect(guessType(['Alta', 'Baja', 'Alta', 'Media'])).toBe('select');
    const text = '\uFEFFTarea;Estado;Presupuesto;Fechas;Facturado;Prioridad;Notas\r\n"Muro norte; fase 1";Bocetos;1.234,5;07/09/2026 - 18/09/2026;sí;Alta;"línea 1\nlínea 2"\r\nMuro sur;Aprobado;800;01/10/2026;no;Baja;\r\nTechos;;2.000;;x;Alta;\r\n';
    expect(parseCsv(text).sep).toBe(';');
    const pm0 = pmTemplate();
    const plan = planImport(pm0, text);
    expect(plan.map.slice(0, 5).every(Boolean)).toBe(true);
    expect(plan.map[5]).toBeNull();
    expect(plan.types[5]).toBe('select');
    const { pm, added } = applyImport(pm0, plan, []);
    expect(added).toBe(3);
    const prio = by(pm, 'Prioridad');
    expect(prio.opts!.map((o) => o.name)).toEqual(['Alta', 'Baja']);
    const r = pm.rows[0];
    expect([cellText(pm, by(pm, 'Tarea'), r, []), cellText(pm, by(pm, 'Estado'), r, []), r.cells[by(pm, 'Presupuesto').id], r.cells[by(pm, 'Fechas').id], r.cells[by(pm, 'Facturado').id], r.cells[by(pm, 'Notas').id]])
      .toEqual(['Muro norte; fase 1', 'Bocetos', 1234.5, { start: '2026-09-07', end: '2026-09-18' }, true, 'línea 1\nlínea 2']);
    expect(pm.rows[2].cells[by(pm, 'Facturado').id]).toBe(true);
    const comma = planImport(pm0, 'Tarea,Horas\nA,"1,5"\n');
    expect([comma.sep, applyImport(pm0, comma, []).pm.rows[0].cells[by(pm0, 'Horas').id]]).toEqual([',', 1.5]);
  });

  it('9 · plantillas: 4 incluidas; guardar sin filas; usar con ids nuevos; persisten', () => {
    const b = builtinTemplates();
    expect(b.map((t) => t.name)).toEqual(['Proyecto con fases', 'Encargo artístico', 'Contenidos y redes', 'Tabla vacía']);
    const t = asTemplate(sample(), 'Mural');
    expect(t.pm.rows).toHaveLength(0);
    const a = instantiate(t), c = instantiate(t);
    expect(a.cols[0].id).not.toBe(c.cols[0].id);
    expect(a.cols.find((x) => x.type === 'progress')!.source).toBe(a.cols.find((x) => x.type === 'status')!.id);
    const social = instantiate(b[2]);
    expect(social.ui?.view).toBe('kanban');
    expect(social.cols.some((x) => x.id === social.ui!.kanban!.col)).toBe(true);
    const e = reduce(emptyState, { t: 'pmTemplates', list: [t] });
    expect(fromDocs([...starterDocs(), ...e.put]).pmTemplates.map((x) => x.name)).toEqual(['Mural']);
  });
});
