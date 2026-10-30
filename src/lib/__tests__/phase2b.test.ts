import { describe, expect, it } from 'vitest';
import { itemsBetween, layoutDay, monthGrid, moveAnchor, onDay, titleFor, weekDays } from '../calendar';
import type { CalItem } from '../calendar';
import { easter, holidayMap, holidays } from '../holidays';
import { parseIcs, toIcs } from '../ics';
import { fromDocs, starterDocs } from '../model';
import type { CalEvent, ReminderCard } from '../model';
import { diff, emptyState, newCard, reduce, search, searchIndex, snapOf } from '../store';
import type { Action, State } from '../store';

const loaded = (): State => reduce(emptyState, { t: 'load', ...fromDocs(starterDocs()) }).state;
const run = (s: State, ...as: Action[]) => as.reduce((acc, a) => reduce(acc, a).state, s);
const names = (c: Parameters<typeof holidays>[0], y: number) => Object.fromEntries(holidays(c, y).map((h) => [h.date, h.name]));

describe('festivos', () => {
  it('Pascua', () => {
    expect([2024, 2025, 2026, 2027].map((y) => easter(y).toDateString())).toEqual([new Date(2024, 2, 31), new Date(2025, 3, 20), new Date(2026, 3, 5), new Date(2027, 2, 28)].map((d) => d.toDateString()));
  });
  it('fiestas fijas, móviles y trasladadas a lunes', () => {
    expect(names('ES', 2026)['2026-04-03']).toBe('Viernes Santo');
    expect(names('ES', 2026)['2026-10-12']).toBe('Fiesta Nacional de España');
    expect(names('US', 2026)['2026-11-26']).toBe('Acción de Gracias');
    expect(names('US', 2026)['2026-05-25']).toBe('Día de los Caídos');
    expect(names('MX', 2026)['2026-02-02']).toBe('Día de la Constitución');
    expect(names('CO', 2026)['2026-01-12']).toBe('Reyes Magos'); // 6 de enero de 2026 es martes → lunes 12
    expect(names('CO', 2026)['2026-05-18']).toBe('Ascensión del Señor'); // Pascua + 43
    expect(names('GB', 2026)['2026-04-06']).toBe('Lunes de Pascua');
    expect(names('DE', 2026)['2026-05-14']).toBe('Ascensión');
    expect(holidays('PT', 2026)).toHaveLength(13);
  });
  it('mapa por fecha para varios años', () => {
    const m = holidayMap('ES', [2026, 2027]);
    expect(m.get('2026-12-25')).toBe('Navidad');
    expect(m.get('2027-01-06')).toBe('Epifanía del Señor');
  });
});

describe('.ics', () => {
  const evs = [
    { uid: 'a@c', title: 'Reunión, café; y más', start: '2026-10-12T08:30:00.000Z', end: '2026-10-12T09:30:00.000Z', allDay: false, note: 'Línea 1\nLínea 2' },
    { uid: 'b@c', title: 'Feria de arte', start: '2026-10-20', end: '2026-10-22', allDay: true, note: '' },
  ];
  it('ida y vuelta exacta, con escapes y fin exclusivo en los de día completo', () => {
    const text = toIcs('Encargos', evs, new Date('2026-10-01T00:00:00Z'));
    expect(text).toContain('DTSTART;VALUE=DATE:20261020');
    expect(text).toContain('DTEND;VALUE=DATE:20261023');
    expect(text).toContain('SUMMARY:Reunión\\, café\\; y más');
    expect(text.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    const back = parseIcs(text);
    expect(back.name).toBe('Encargos');
    expect(back.events).toEqual(evs);
  });
  it('lee archivos de Google/Apple: TZID, DURATION, líneas partidas y repeticiones', () => {
    const g = ['BEGIN:VCALENDAR', 'X-WR-CALNAME:Trabajo', 'BEGIN:VEVENT', 'UID:x1', 'DTSTART;TZID=Europe/Madrid:20261013T100000', 'DURATION:PT1H30M', 'SUMMARY:Llamada con un título muy largo que Google parte en varias líneas para que', '  no pase de 75', 'RRULE:FREQ=WEEKLY', 'END:VEVENT', 'BEGIN:VEVENT', 'SUMMARY:Sin fecha', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const r = parseIcs(g);
    expect(r).toMatchObject({ name: 'Trabajo', skipped: 1, repeating: 1 });
    expect(r.events[0].title).toBe('Llamada con un título muy largo que Google parte en varias líneas para que no pase de 75');
    expect(new Date(r.events[0].start).getHours()).toBe(10);
    expect((new Date(r.events[0].end).getTime() - new Date(r.events[0].start).getTime()) / 60000).toBe(90);
  });
});

describe('cuadrícula y colocación', () => {
  it('el mes empieza en lunes (o domingo) y tiene 6 semanas', () => {
    const g = monthGrid('2026-10-11', 1);
    expect(g).toHaveLength(42);
    expect(g[0].key).toBe('2026-09-28');
    expect(g.filter((d) => d.inMonth)).toHaveLength(31);
    expect(monthGrid('2026-10-11', 0)[0].key).toBe('2026-09-27');
    expect(weekDays('2026-10-11', 1)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(moveAnchor('2026-01-31', 'month', 1)).toBe('2026-02-01');
    expect(titleFor('2026-10-11', 'week', 1)).toBe('5 – 11 oct 2026');
  });
  it('los eventos que se solapan comparten el ancho', () => {
    const at = (h: number, m = 0) => new Date(2026, 9, 12, h, m);
    const it = (id: string, a: Date, b: Date): CalItem => ({ id, kind: 'event', title: id, color: '#000', allDay: false, startDay: '2026-10-12', endDay: '2026-10-12', start: a, end: b, calendar: 'c' });
    const p = layoutDay([it('a', at(9), at(11)), it('b', at(10), at(12)), it('c', at(11), at(12)), it('d', at(14), at(15))], '2026-10-12', 7, 22);
    const by = Object.fromEntries(p.map((x) => [x.item.id, x]));
    expect([by.a.col, by.a.cols, by.b.col, by.c.col]).toEqual([0, 2, 1, 0]);
    expect([by.d.cols, by.a.top, by.a.height]).toEqual([1, 120, 120]);
  });
  it('reúne eventos, recordatorios y festivos, y respeta los calendarios ocultos', () => {
    const r = newCard('reminder', 'home') as ReminderCard;
    const ev: CalEvent = { id: 'e1', calendar: 'cal-main', title: 'Visita', start: '2026-10-13', end: '2026-10-14', allDay: true, note: '' };
    let s = run(loaded(), { t: 'addCard', card: { ...r, title: 'Bocetos', when: new Date(2026, 9, 12, 9).toISOString() } }, { t: 'addEvent', event: ev });
    const items = itemsBetween(s, '2026-10-12', '2026-10-14');
    expect(onDay(items, '2026-10-12').map((i) => i.kind).sort()).toEqual(['holiday', 'reminder']);
    expect(onDay(items, '2026-10-14').map((i) => i.title)).toEqual(['Visita']);
    s = run(s, { t: 'patchCalendar', id: 'cal-holidays', patch: { visible: false } });
    expect(onDay(itemsBetween(s, '2026-10-12', '2026-10-12'), '2026-10-12').map((i) => i.kind)).toEqual(['reminder']);
  });
});

describe('eventos y calendarios en el estado', () => {
  it('crear, editar, borrar, deshacer; borrar un calendario se lleva sus eventos; los integrados no se borran', () => {
    const ev: CalEvent = { id: 'e1', calendar: 'cal-main', title: 'Presentación', start: '2026-10-15T09:00:00.000Z', end: '2026-10-15T10:00:00.000Z', allDay: false, note: '' };
    const s0 = loaded();
    let s = run(s0, { t: 'addEvent', event: ev }, { t: 'patchEvent', id: 'e1', patch: { title: 'Presentación al cliente' } });
    expect(s.events[0].title).toBe('Presentación al cliente');
    expect(search(searchIndex(s), 'presentacion')[0]).toMatchObject({ kind: 'Evento', event: 'e1' });
    expect(diff(snapOf(s), snapOf(s0)).del).toEqual(['e1']);
    s = run(s, { t: 'addCalendar', calendar: { id: 'c2', name: 'Ferias', color: '#000', kind: 'user', visible: true, pos: 0 } }, { t: 'addEvent', event: { ...ev, id: 'e2', calendar: 'c2' } });
    const e = reduce(s, { t: 'removeCalendar', id: 'c2' });
    expect(e.del).toEqual(['c2', 'e2']);
    expect(run(s, { t: 'removeCalendar', id: 'cal-main' }).calendars).toHaveLength(4);
  });
  it('importar crea el calendario y sus eventos; al recargar siguen ahí junto a los integrados', () => {
    const cal = { id: 'c9', name: 'Trabajo', color: '#000', kind: 'user' as const, visible: true, pos: 0 };
    const e = reduce(loaded(), { t: 'importEvents', calendar: cal, target: 'c9', events: [{ id: 'x', calendar: '', title: 'A', start: '2026-10-01', end: '2026-10-01', allDay: true, note: '' }] });
    expect(e.put.map((d) => d.kind)).toEqual(['calendar', 'event']);
    const reloaded = fromDocs([...starterDocs(), ...e.put]);
    expect(reloaded.calendars.map((c) => c.name)).toEqual(['Cuaderno', 'Cumpleaños', 'Festivos', 'Trabajo']);
    expect(reloaded.events[0]).toMatchObject({ calendar: 'c9', title: 'A', allDay: true });
  });
});
