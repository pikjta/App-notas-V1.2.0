// Lógica pura del calendario: cuadrículas, qué cae en cada día, colocación de eventos con hora
// y navegación. Reúne tres fuentes: eventos, recordatorios de los tableros y festivos.
import { locale, t } from '../i18n';
import { dayKey, fromDayKey, monthName, monthShort, shiftDay } from './agenda';
import { holidayMap } from './holidays';
import type { CalView } from './model';
import type { State } from './store';

export type CalItem = {
  id: string;
  kind: 'event' | 'reminder' | 'holiday';
  title: string;
  color: string;
  allDay: boolean;
  /** Para eventos de día completo y festivos: primer y último día «AAAA-MM-DD». */
  startDay: string;
  endDay: string;
  /** Para elementos con hora. */
  start: Date | null;
  end: Date | null;
  calendar: string;
  /** Recordatorios: tarea principal a la que pertenecen. */
  project?: string;
  done?: boolean;
};

export function monthGrid(anchor: string, weekStart: 0 | 1): { key: string; inMonth: boolean }[] {
  const a = fromDayKey(anchor);
  const first = new Date(a.getFullYear(), a.getMonth(), 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { key: dayKey(d), inMonth: d.getMonth() === a.getMonth() };
  });
}

export function weekDays(anchor: string, weekStart: 0 | 1): string[] {
  const a = fromDayKey(anchor);
  const offset = (a.getDay() - weekStart + 7) % 7;
  return Array.from({ length: 7 }, (_, i) => shiftDay(anchor, i - offset));
}


/** Avanza o retrocede una unidad de la vista (un día, una semana o un mes). */
export function moveAnchor(anchor: string, view: CalView, dir: 1 | -1): string {
  if (view === 'day') return shiftDay(anchor, dir);
  if (view === 'week') return shiftDay(anchor, 7 * dir);
  if (view === 'agenda') return shiftDay(anchor, 30 * dir);
  const d = fromDayKey(anchor);
  return dayKey(new Date(d.getFullYear(), d.getMonth() + dir, 1));
}

export function titleFor(anchor: string, view: CalView, weekStart: 0 | 1): string {
  const d = fromDayKey(anchor);
  if (view === 'month') return t('cal.monthYear', { month: monthName(d.getMonth()), year: d.getFullYear() });
  if (view === 'day') return d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (view === 'agenda') return t('cal.agenda');
  const w = weekDays(anchor, weekStart);
  const a = fromDayKey(w[0]), b = fromDayKey(w[6]);
  const sameMonth = a.getMonth() === b.getMonth();
  return t('cal.weekRange', { from: `${a.getDate()}${sameMonth ? '' : ' ' + monthShort(a.getMonth())}`, to: `${b.getDate()} ${monthShort(b.getMonth())} ${b.getFullYear()}` });
}

/** Todo lo visible entre dos días (incluidos), según los calendarios marcados. */
export function itemsBetween(s: State, from: string, to: string): CalItem[] {
  const visible = new Map(s.calendars.filter((c) => c.visible).map((c) => [c.id, c]));
  const out: CalItem[] = [];
  const inRange = (a: string, b: string) => a <= to && b >= from;

  const addMonths = (d: Date, n: number) => { const r = new Date(d); const day = r.getDate(); r.setDate(1); r.setMonth(r.getMonth() + n); const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate(); r.setDate(Math.min(day, last)); return r; };
  for (const e of s.events) {
    const cal = visible.get(e.calendar);
    if (!cal) continue;
    const rep = e.repeat ?? 'none';
    // Desplazamientos (en repeticiones) que pueden caer dentro del rango.
    const shifts: ((d: Date) => Date)[] = [(d) => d];
    if (rep !== 'none') {
      const from0 = e.allDay ? fromDayKey(e.start) : new Date(e.start);
      if (isNaN(from0.getTime())) continue;
      const lim = fromDayKey(to).getTime() + 86_400_000;
      for (let n = 1; n < 800; n++) {
        const at = rep === 'week' ? new Date(from0.getTime() + n * 7 * 86_400_000) : rep === 'month' ? addMonths(from0, n) : addMonths(from0, 12 * n);
        if (at.getTime() > lim) break;
        shifts.push(rep === 'week' ? (d) => new Date(d.getTime() + n * 7 * 86_400_000) : rep === 'month' ? (d) => addMonths(d, n) : (d) => addMonths(d, 12 * n));
      }
    }
    for (const sh of shifts) {
      if (e.allDay) {
        const a = dayKey(sh(fromDayKey(e.start))), b = dayKey(sh(fromDayKey(e.end)));
        if (inRange(a, b)) out.push({ id: e.id, kind: 'event', title: e.title, color: cal.color, allDay: true, startDay: a, endDay: b, start: null, end: null, calendar: cal.id });
      } else {
        const st = sh(new Date(e.start)), en0 = new Date(e.end);
        if (isNaN(st.getTime())) continue;
        const en = isNaN(en0.getTime()) ? new Date(st.getTime() + 3_600_000) : sh(en0);
        const sd = dayKey(st), ed = dayKey(en);
        if (inRange(sd, ed)) out.push({ id: e.id, kind: 'event', title: e.title, color: cal.color, allDay: false, startDay: sd, endDay: ed, start: st, end: en, calendar: cal.id });
      }
    }
  }

  // Recordatorios de los tableros, en el calendario «Cuaderno».
  const main = s.calendars.find((c) => c.kind === 'main');
  if (main?.visible) {
    const live = new Map(s.projects.filter((p) => !p.trashed).map((p) => [p.id, p]));
    for (const c of s.cards) {
      if (c.type !== 'reminder' || c.trashed || !c.when) continue;
      const p = live.get(c.project);
      if (!p) continue;
      const st = new Date(c.when);
      if (isNaN(st.getTime())) continue;
      const k = dayKey(st);
      if (k >= from && k <= to) out.push({ id: c.id, kind: 'reminder', title: c.title || t('cal.reminder'), color: p.color, allDay: false, startDay: k, endDay: k, start: st, end: new Date(st.getTime() + 30 * 60_000), calendar: main.id, project: p.id, done: !!c.done });
    }
  }

  const hol = s.calendars.find((c) => c.kind === 'holidays');
  if (hol?.visible) {
    const years = Array.from(new Set([fromDayKey(from).getFullYear(), fromDayKey(to).getFullYear()]));
    for (const [k, name] of holidayMap(s.settings.country, years)) {
      if (k >= from && k <= to) out.push({ id: 'hol-' + k, kind: 'holiday', title: name, color: hol.color, allDay: true, startDay: k, endDay: k, start: null, end: null, calendar: hol.id });
    }
  }

  // Primero los de día completo (festivos antes), después por hora.
  return out.sort((a, b) => Number(b.allDay) - Number(a.allDay) || Number(b.kind === 'holiday') - Number(a.kind === 'holiday') || (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0) || a.title.localeCompare(b.title));
}

export const onDay = (items: CalItem[], k: string) => items.filter((i) => i.startDay <= k && i.endDay >= k);

export type Placed = { item: CalItem; top: number; height: number; col: number; cols: number };

/**
 * Coloca los elementos con hora de un día en columnas para que no se tapen: los que se solapan
 * comparten el ancho. `top` y `height` están en minutos desde el inicio visible (`dayStart` h).
 */
export function layoutDay(items: CalItem[], k: string, dayStart: number, dayEnd: number): Placed[] {
  const lo = dayStart * 60, hi = dayEnd * 60;
  const timed = items
    .filter((i) => !i.allDay && i.start && i.startDay <= k && i.endDay >= k)
    .map((i) => {
      const dayBegin = fromDayKey(k).getTime();
      const s = Math.max(0, (i.start!.getTime() - dayBegin) / 60_000);
      const e = Math.min(24 * 60, (i.end!.getTime() - dayBegin) / 60_000);
      const top = Math.max(lo, Math.min(hi - 15, s));
      return { item: i, s: top, e: Math.max(top + 20, Math.min(hi, Math.max(e, s + 20))) };
    })
    .sort((a, b) => a.s - b.s || b.e - a.e);
  const out: Placed[] = [];
  let group: typeof timed = [];
  let groupEnd = -1;
  const flush = () => {
    const colsEnd: number[] = [];
    const placed = group.map((g) => {
      let col = colsEnd.findIndex((end) => end <= g.s);
      if (col < 0) { col = colsEnd.length; colsEnd.push(g.e); } else colsEnd[col] = g.e;
      return { g, col };
    });
    for (const { g, col } of placed) out.push({ item: g.item, top: g.s - lo, height: g.e - g.s, col, cols: colsEnd.length });
    group = []; groupEnd = -1;
  };
  for (const t of timed) {
    if (group.length && t.s >= groupEnd) flush();
    group.push(t);
    groupEnd = Math.max(groupEnd, t.e);
  }
  if (group.length) flush();
  return out;
}

/** Desplaza un evento (o recordatorio) a otro día conservando la hora y la duración. */
export function shiftIso(iso: string, days: number, minutes = 0): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

export const daysBetween = (a: string, b: string) => Math.round((fromDayKey(b).getTime() - fromDayKey(a).getTime()) / 86_400_000);

/** «09:30» */
export const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
