import { formatClock } from '../lib/notify';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { useApp } from '../App';
import { locale, t, tn } from '../i18n';
import { dayKey, fromDayKey, monthName, shiftDay, weekdayShort } from '../lib/agenda';
import { daysBetween, hm, itemsBetween, layoutDay, monthGrid, moveAnchor, onDay, shiftIso, titleFor, weekDays } from '../lib/calendar';
import type { CalItem } from '../lib/calendar';
import { COUNTRIES, holidays } from '../lib/holidays';
import { parseIcs, toIcs } from '../lib/ics';
import type { IcsEvent } from '../lib/ics';
import { CAL_COLORS, uid } from '../lib/model';
import type { CalEvent, CalView, Calendar as Cal, Repeat } from '../lib/model';
import { CalendarPanel } from '../components/Appearance';
import { BOARD_COLORS, CARD_THEMES, SIDE_COLORS } from '../lib/appearance';
import { Icon } from '../components/Icon';
import { normalizeColorIcon } from '../lib/icons';

const PX = 0.8; // píxeles por minuto en las vistas de día y semana (48 px por hora)
const views = (): [CalView, string][] => [['day', t('cal.view.day')], ['week', t('cal.view.week')], ['month', t('cal.view.month')]];
/** Franjas de horario: el valor del desplegable es «6-24» (no se traduce); la etiqueta, sí. */
const HOURS: [string, number, number][] = [['6-24', 6, 24], ['7-22', 7, 22], ['0-24', 0, 24]];
const hoursLabel = (a: number, b: number) => t('cal.hours', { a, b });

/** Semana ISO de un día «AAAA-MM-DD». */
export function isoWeek(k: string): number {
  const d = fromDayKey(k);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86_400_000 + 1) / 7);
}

type Draft = { id: string | null; calendar: string; title: string; allDay: boolean; day: string; span: number; time: string; dur: number; repeat: Repeat; note: string };

export function CalendarView() {
  const { state, dispatch, goTo, toast, backend, editEvent, setEditEvent } = useApp();
  const { view, anchor } = state.cal;
  const ws = state.settings.weekStart;
  const today = dayKey(new Date());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newCal, setNewCal] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!listOpen) return;
    const d = (e: MouseEvent) => { if (!popRef.current?.contains(e.target as Node)) setListOpen(false); };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setListOpen(false);
    window.addEventListener('mousedown', d); window.addEventListener('keydown', k);
    return () => { window.removeEventListener('mousedown', d); window.removeEventListener('keydown', k); };
  }, [listOpen]);

  // Rango visible para calcular los elementos una sola vez.
  const range = useMemo(() => {
    if (view === 'month') { const g = monthGrid(anchor, ws); return [g[0].key, g[41].key] as const; }
    if (view === 'week') { const w = weekDays(anchor, ws); return [w[0], w[6]] as const; }
    if (view === 'day') return [anchor, anchor] as const;
    return [anchor, shiftDay(anchor, 59)] as const;
  }, [view, anchor, ws]);
  const items = useMemo(() => itemsBetween(state, range[0], range[1]), [state, range]);

  const userCals = state.calendars.filter((c) => c.kind !== 'holidays');
  const defaultCal = state.calendars.find((c) => c.kind === 'main')!.id;

  const openNew = (day: string, minutes: number | null) => {
    const f = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    setDraft({ id: null, calendar: defaultCal, title: '', allDay: minutes === null, day, span: 0, time: f(minutes ?? 9 * 60), dur: 30, repeat: 'none', note: '' });
  };
  const openEvent = (e: CalEvent) => {
    const st = new Date(e.start), en = new Date(e.end);
    setDraft({
      id: e.id, calendar: e.calendar, title: e.title, allDay: e.allDay, note: e.note, repeat: e.repeat ?? 'none',
      day: e.allDay ? e.start : dayKey(st), span: e.allDay ? daysBetween(e.start, e.end) : 0,
      time: e.allDay ? '09:00' : hm(st), dur: e.allDay ? 30 : Math.max(5, Math.round((en.getTime() - st.getTime()) / 60_000)),
    });
  };
  const openItem = (it: CalItem) => {
    if (it.kind === 'event') { const e = state.events.find((x) => x.id === it.id); if (e) openEvent(e); }
    else if (it.kind === 'reminder' && it.project) goTo(it.project, it.id);
  };

  // Abrir un evento pedido desde fuera (por ejemplo, desde la búsqueda).
  useEffect(() => {
    if (!editEvent) return;
    const e = state.events.find((x) => x.id === editEvent);
    if (e) openEvent(e);
    setEditEvent(null);
  }, [editEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Mover un elemento: `days` días y `minutes` minutos (los festivos no se mueven). */
  const move = (it: CalItem, days: number, minutes = 0) => {
    if (!days && !minutes) return;
    if (it.kind !== 'holiday') { const date = fromDayKey(shiftDay(it.startDay, days)).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }); toast(minutes ? t('cal.movedAt', { date, time: hm(new Date((it.start?.getTime() ?? 0) + minutes * 60_000)) }) : t('cal.moved', { date })); }
    if (it.kind === 'reminder') {
      const c = state.cards.find((x) => x.id === it.id);
      if (c?.type === 'reminder' && c.when) dispatch({ t: 'patchCard', id: c.id, patch: { when: shiftIso(c.when, days, minutes) } });
    } else if (it.kind === 'event') {
      const e = state.events.find((x) => x.id === it.id);
      if (!e) return;
      if (e.allDay) dispatch({ t: 'patchEvent', id: e.id, patch: { start: shiftDay(e.start, days), end: shiftDay(e.end, days) } });
      else dispatch({ t: 'patchEvent', id: e.id, patch: { start: shiftIso(e.start, days, minutes), end: shiftIso(e.end, days, minutes) } });
    }
  };

  const exportCal = async () => {
    const evs: IcsEvent[] = [];
    for (const c of state.calendars.filter((x) => x.visible)) {
      if (c.kind === 'holidays') {
        const y = fromDayKey(anchor).getFullYear();
        evs.push(...[y - 1, y, y + 1].flatMap((yy) => holidays(state.settings.country, yy)).map((h) => ({ uid: 'hol-' + h.date + '@cuaderno', title: h.name, start: h.date, end: h.date, allDay: true, note: '' })));
        continue;
      }
      evs.push(...state.events.filter((e) => e.calendar === c.id).map((e) => ({ uid: e.id + '@cuaderno', title: e.title, start: e.start, end: e.end, allDay: e.allDay, note: e.note })));
      if (c.kind === 'main') {
        for (const r of state.cards) {
          if (r.type !== 'reminder' || r.trashed || !r.when) continue;
          evs.push({ uid: r.id + '@cuaderno', title: r.title || t('cal.reminder'), start: r.when, end: new Date(new Date(r.when).getTime() + 30 * 60_000).toISOString(), allDay: false, note: r.note });
        }
      }
    }
    try {
      const ok = await backend.saveIcs(t('cal.export.file'), toIcs('Cuaderno', evs));
      if (ok) toast(tn('cal.export.done', evs.length));
    } catch (e) { toast(typeof e === 'string' ? e : t('cal.export.error')); }
  };

  const importIcs = async () => {
    try {
      const f = await backend.openIcs();
      if (!f) return;
      const r = parseIcs(f.text);
      if (!r.events.length) { toast(t('cal.import.noEvents')); return; }
      const cal: Cal = { id: uid('cal'), name: r.name || f.name.replace(/\.ics$/i, ''), color: CAL_COLORS[(state.calendars.length + 2) % CAL_COLORS.length], kind: 'user', visible: true, pos: 0 };
      const evs: CalEvent[] = r.events.map((e) => ({ id: uid('ev'), calendar: cal.id, title: e.title, start: e.start, end: e.end, allDay: e.allDay, note: e.note }));
      dispatch({ t: 'importEvents', calendar: cal, target: cal.id, events: evs });
      const extra = [r.repeating ? tn('cal.import.repeating', r.repeating) : '', r.skipped ? tn('cal.import.skipped', r.skipped) : ''].filter(Boolean).join(' · ');
      toast(tn('cal.import.done', evs.length, { name: cal.name }) + (extra ? ' · ' + extra : ''));
      if (evs[0]) dispatch({ t: 'calGo', anchor: evs[0].allDay ? evs[0].start : dayKey(new Date(evs[0].start)) });
    } catch (e) { toast(typeof e === 'string' ? e : t('cal.import.error')); }
  };

  const look = state.settings.calLook;
  const lookVars = {
    ['--cal-side' as string]: SIDE_COLORS[look.side.color].bg,
    ['--cal-bg' as string]: BOARD_COLORS[look.bg.color].bg,
    ['--cal-cell' as string]: CARD_THEMES[look.cell.color].bg,
    ['--cal-cell-ink' as string]: CARD_THEMES[look.cell.color].ink,
  };
  const [lookOpen, setLookOpen] = useState(false);
  return (
    <main className={'board view cal-view tex-' + look.bg.texture} style={lookVars}>
      <header className="cal-head">
        <div className="cal-titles">
          <span className="cal-crumb">{t('cal.crumb')}</span>
          <h1 className="board-title cap">{titleFor(anchor, view, ws)}</h1>
          <span className="cal-sub">{view === 'agenda' ? t('cal.sub.agenda') : t('cal.sub.other')}</span>
        </div>
        <div className="row cal-nav">
          <div className="seg">{views().map(([v, l]) => <button key={v} className={view === v ? 'on' : ''} onClick={() => dispatch({ t: 'calView', view: v })}>{l}</button>)}</div>
          <button className="tool" onClick={() => dispatch({ t: 'calGo', anchor: today })}>{t('cal.today')}</button>
          <button className={'tool' + (view === 'agenda' ? ' on' : '')} aria-pressed={view === 'agenda'} onClick={() => dispatch({ t: 'calView', view: view === 'agenda' ? state.settings.calView === 'agenda' ? 'month' : state.settings.calView : 'agenda' })}>{t('cal.agenda')}</button>
          <button className="tool cal-arrow" aria-label={t('cal.prev')} onClick={() => dispatch({ t: 'calGo', anchor: moveAnchor(anchor, view, -1) })}>‹</button>
          <button className="tool cal-arrow" aria-label={t('cal.next')} onClick={() => dispatch({ t: 'calGo', anchor: moveAnchor(anchor, view, 1) })}>›</button>
        </div>
      </header>
      <div className="cal-body">
        <aside className="cal-side">
          <button className="cal-add" onClick={() => openNew(view === 'day' ? anchor : today, 9 * 60)}>{t('cal.addReminder')}</button>
          <MiniMonth anchor={anchor} today={today} weekStart={ws} view={view} onPick={(k) => dispatch({ t: 'calGo', anchor: k })} />
          <div className="cal-legend">
            <span className="cal-legend-title">{t('cal.onScreen')}</span>
            {state.calendars.filter((c) => c.visible).map((c) => <span key={c.id} className="cal-legend-row"><i className="dot" style={{ background: c.color }} /> {c.name}</span>)}
            <p className="cal-help">{t('cal.help')}</p>
          </div>
        </aside>
        <section className={'cal-main' + (view === 'month' ? ' plain' : '')}>
          {view === 'month' && <MonthGrid items={items} today={today} onNew={(k) => openNew(k, null)} onOpen={openItem} onMove={move} />}
          {(view === 'week' || view === 'day') && <TimeGrid days={view === 'week' ? weekDays(anchor, ws) : [anchor]} items={items} today={today} onNew={openNew} onOpen={openItem} onMove={move} />}
          {view === 'agenda' && <Agenda from={anchor} items={items} today={today} onOpen={openItem} />}
        </section>
      </div>
      <footer className="cal-foot">
        <span className="cal-showing">{state.calendars.some((c) => c.visible) ? t('cal.showing', { names: state.calendars.filter((c) => c.visible).map((c) => c.name).join(' + ') }) : t('cal.noneVisible')}</span>
        <div className="cal-pop-anchor" ref={popRef}>
          <button className="tool" aria-expanded={listOpen} title={t('cal.pickCalendars')} onClick={() => setListOpen(!listOpen)}>
            <span className="cal-dots">{state.calendars.filter((c) => c.visible).map((c) => <i key={c.id} style={{ background: c.color }} />)}</span> {t('cal.calendars')} <span aria-hidden>⌃</span>
          </button>
          {listOpen && <div className="cal-pop"><CalList /></div>}
        </div>
        <button className="tool" onClick={() => setNewCal(true)}>{t('cal.addCalendar')}</button>
        <button className="tool cal-icon" title={t('cal.settingsTitle')} aria-label={t('cal.settingsTitle')} onClick={() => setSetOpen(true)}>⚙</button>
        <button className="tool cal-icon" title={t('cal.lookTitle')} aria-label={t('cal.lookTitle')} onClick={() => setLookOpen(true)}><Icon name={normalizeColorIcon(state.settings.colorIcon)} size={17} /></button>
      </footer>
      {draft && <EventDialog draft={draft} calendars={userCals} onClose={() => setDraft(null)} />}
      {newCal && <NewCalendar onClose={() => setNewCal(false)} />}
      {setOpen && <CalSettingsDialog onClose={() => setSetOpen(false)} onExport={exportCal} onImport={importIcs} />}
      {lookOpen && <CalendarPanel onClose={() => setLookOpen(false)} />}
    </main>
  );
}

function MiniMonth({ anchor, today, weekStart, view, onPick }: { anchor: string; today: string; weekStart: 0 | 1; view: CalView; onPick: (k: string) => void }) {
  const { state } = useApp();
  const [month, setMonth] = useState(anchor);
  useEffect(() => setMonth(anchor), [anchor]);
  const wn = state.settings.weekNumbers;
  const all = monthGrid(month, weekStart);
  const g = all.filter((_, i) => all.slice(Math.floor(i / 7) * 7, Math.floor(i / 7) * 7 + 7).some((d) => d.inMonth));
  const m = fromDayKey(month);
  const go = (n: number) => setMonth(dayKey(new Date(m.getFullYear(), m.getMonth() + n, 1)));
  const items = useMemo(() => itemsBetween(state, all[0].key, all[41].key), [state, month, weekStart]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = fromDayKey(anchor);
  const week = weekDays(anchor, weekStart);
  const inRange = (k: string) => view === 'month' ? (fromDayKey(k).getMonth() === a.getMonth() && fromDayKey(k).getFullYear() === a.getFullYear()) : view === 'week' ? week.includes(k) : view === 'agenda' ? (k >= anchor && k <= shiftDay(anchor, 29)) : k === anchor;
  return (
    <div className="mini">
      <div className="mini-nav"><button className="icon-btn small" aria-label={t('cal.prevMonth')} onClick={() => go(-1)}>‹</button><b className="grow cap">{t('cal.monthYear', { month: monthName(m.getMonth()), year: m.getFullYear() })}</b><button className="icon-btn small" aria-label={t('cal.nextMonth')} onClick={() => go(1)}>›</button></div>
      <div className={'mini-grid' + (wn ? ' wn' : '')}>
        {wn && <span className="mini-wd" />}
        {Array.from({ length: 7 }, (_, i) => <span key={i} className="mini-wd">{weekdayShort((i + weekStart) % 7)[0]}</span>)}
        {g.flatMap((d, gi) => {
          const sel = view !== 'month' && d.key === anchor;
          const has = onDay(items, d.key).length > 0;
          const cell = (
            <button key={d.key} className={'mini-d' + (d.inMonth ? '' : ' out') + (d.key === today ? ' today' : '') + (sel ? ' sel' : '') + (!sel && inRange(d.key) ? ' rng' : '')} aria-label={fromDayKey(d.key).toLocaleDateString(locale(), { day: 'numeric', month: 'long' })} onClick={() => onPick(d.key)}>
              <span>{fromDayKey(d.key).getDate()}</span><i className={has ? 'has' : ''} />
            </button>
          );
          return gi % 7 === 0 && wn ? [<span key={'wk' + d.key} className="mini-wk">{isoWeek(g[Math.min(g.length - 1, gi + 3)].key)}</span>, cell] : [cell];
        })}
      </div>
    </div>
  );
}

function CalList() {
  const { state, dispatch } = useApp();
  const [menu, setMenu] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const all = state.calendars.every((c) => c.visible);
  return (
    <div className="cal-list" aria-label={t('cal.calendars')}>
      <div className="menu-label">{t('cal.list.title')}</div>
      <div className="row wrap">
        <button className="link small" onClick={() => state.calendars.forEach((c) => !c.visible && dispatch({ t: 'patchCalendar', id: c.id, patch: { visible: true } }))} disabled={all}>{t('cal.list.selectAll')}</button>
        <button className="link small" onClick={() => state.calendars.forEach((c) => c.visible && dispatch({ t: 'patchCalendar', id: c.id, patch: { visible: false } }))} disabled={!state.calendars.some((c) => c.visible)}>{t('cal.list.deselectAll')}</button>
      </div>
      {state.calendars.map((c) => (
        <div key={c.id} className="cal-row">
          <input type="checkbox" checked={c.visible} aria-label={t('cal.list.show', { name: c.name })} style={{ accentColor: c.color }} onChange={() => dispatch({ t: 'patchCalendar', id: c.id, patch: { visible: !c.visible } })} />
          <span className="grow cal-label">{c.name}</span>
          <div className="menu-anchor">
            <button className="icon-btn small" aria-label={t('cal.list.options', { name: c.name })} onClick={() => setMenu(menu === c.id ? null : c.id)}>⋯</button>
            {menu === c.id && (
              <div className="menu" onMouseLeave={() => { setMenu(null); setConfirmDel(null); }}>
                <div className="row wrap pad">{CAL_COLORS.map((col) => <button key={col} className={'swatch' + (c.color === col ? ' on' : '')} style={{ background: col }} aria-label={t('cal.list.color')} onClick={() => dispatch({ t: 'patchCalendar', id: c.id, patch: { color: col } })} />)}</div>
                {c.kind === 'user' && (confirmDel === c.id
                  ? <button className="danger-text" onClick={() => { dispatch({ t: 'removeCalendar', id: c.id }); setMenu(null); }}>{t('cal.list.confirmDelete')}</button>
                  : <button className="danger-text" onClick={() => setConfirmDel(c.id)}>{t('cal.list.delete')}</button>)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function NewCalendar({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useApp();
  const [name, setName] = useState('');
  const [color, setColor] = useState(CAL_COLORS[(state.calendars.length + 2) % CAL_COLORS.length]);
  const save = () => { dispatch({ t: 'addCalendar', calendar: { id: uid('cal'), name: name.trim() || t('cal.new.title'), color, kind: 'user', visible: true, pos: 0 } }); onClose(); };
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal ev-dialog" role="dialog" aria-label={t('cal.new.title')} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <header className="modal-head"><h2>{t('cal.new.title')}</h2><span className="grow" /><button className="icon-btn" aria-label={t('cal.close')} onClick={onClose}>✕</button></header>
        <div className="modal-body stack">
          <input autoFocus value={name} placeholder={t('cal.new.placeholder')} aria-label={t('cal.new.name')} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <div className="row wrap">{CAL_COLORS.map((col) => <button key={col} className={'swatch' + (color === col ? ' on' : '')} style={{ background: col }} aria-label={t('cal.new.color', { color: col })} onClick={() => setColor(col)} />)}</div>
          <p className="small muted">{t('cal.new.hint')}</p>
          <div className="row"><span className="grow" /><button className="tool" onClick={onClose}>{t('cal.cancel')}</button><button className="primary" onClick={save}>{t('cal.new.create')}</button></div>
        </div>
      </section>
    </div>
  );
}

/** Ajustes del calendario: semanas, vista inicial, horario, festivos e .ics. */
function CalSettings({ onExport, onImport }: { onExport: () => void; onImport: () => void }) {
  const { state, dispatch } = useApp();
  const st = state.settings;
  const set = (patch: Partial<typeof st>) => dispatch({ t: 'settings', patch });
  const hours = HOURS.find(([, a, b]) => a === st.dayStart && b === st.dayEnd)?.[0] ?? '7-22';
  const noHolidays = holidays(st.country, new Date().getFullYear()).length === 0;
  return (
    <div className="cal-settings stack small-gap">
      <label className="check-line small"><input type="checkbox" checked={st.weekNumbers} onChange={(e) => set({ weekNumbers: e.target.checked })} /> {t('cal.set.weekNumbers')}</label>
      <label className="small">{t('cal.set.weekStart')}
        <select value={st.weekStart} onChange={(e) => set({ weekStart: Number(e.target.value) as 0 | 1 })}><option value={1}>{t('cal.set.monday')}</option><option value={0}>{t('cal.set.sunday')}</option></select>
      </label>
      <label className="small">{t('cal.set.openView')}
        <select value={st.calView} onChange={(e) => set({ calView: e.target.value as CalView })}><option value="day">{t('cal.view.day')}</option><option value="week">{t('cal.view.week')}</option><option value="month">{t('cal.view.month')}</option><option value="agenda">{t('cal.agenda')}</option></select>
      </label>
      <label className="small">{t('cal.set.hours')}
        <select value={hours} onChange={(e) => { const h = HOURS.find(([l]) => l === e.target.value)!; set({ dayStart: h[1], dayEnd: h[2] }); }}>{HOURS.map(([l, a, b]) => <option key={l} value={l}>{hoursLabel(a, b)}</option>)}</select>
      </label>
      <div className="small">
        <b>{t('cal.set.holidays')}</b>
        <p className="muted">{noHolidays ? t('cal.set.noHolidays', { country: COUNTRIES[st.country].name }) : t('cal.set.holidaysInfo', { country: COUNTRIES[st.country].name })}</p>
      </div>
      <div className="small">
        <b>{t('cal.set.ics')}</b>
        <div className="row wrap">
          <button className="tool small-btn" onClick={onExport}>{t('cal.set.export')}</button>
          <button className="tool small-btn" onClick={onImport}>{t('cal.set.import')}</button>
        </div>
        <p className="muted">{t('cal.set.newCal')}</p>
        <p className="muted">{t('cal.set.icsInfo')}</p>
      </div>
    </div>
  );
}

function CalSettingsDialog({ onClose, onExport, onImport }: { onClose: () => void; onExport: () => void; onImport: () => void }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal ev-dialog" role="dialog" aria-label={t('cal.settingsTitle')} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <header className="modal-head"><h2>{t('cal.settingsTitle')}</h2><span className="grow" /><button className="icon-btn" aria-label={t('cal.close')} onClick={onClose}>✕</button></header>
        <div className="modal-body"><CalSettings onExport={onExport} onImport={onImport} /></div>
      </section>
    </div>
  );
}

/** Arrastre de un elemento a otro día (y, en las vistas con horas, a otra hora). */
function useDragMove(onMove: (it: CalItem, days: number, minutes: number) => void, withTime: boolean) {
  const [ghost, setGhost] = useState<{ id: string; day: string | null; min: number | null } | null>(null);
  const start = (e: RPointerEvent, it: CalItem, onClick: () => void) => {
    if (e.button !== 0 || it.kind === 'holiday') return;
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const startMin = it.start ? it.start.getHours() * 60 + it.start.getMinutes() : 0;
    const target = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-day]') as HTMLElement | null;
      return el?.dataset.day ?? null;
    };
    const minutesFor = (ev: PointerEvent) => (withTime && it.start ? Math.round((startMin + (ev.clientY - sy) / PX) / 15) * 15 - startMin : 0);
    const mv = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return;
      moved = true;
      setGhost({ id: it.id, day: target(ev), min: minutesFor(ev) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      setGhost(null);
      if (!moved) { onClick(); return; }
      const day = target(ev);
      onMove(it, day ? daysBetween(it.startDay, day) : 0, minutesFor(ev));
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };
  return { ghost, start };
}

function Chip({ it, onDown, dragging }: { it: CalItem; onDown: (e: RPointerEvent) => void; dragging: boolean }) {
  return (
    <div className={'chip-ev ' + it.kind + (it.done ? ' done' : '') + (dragging ? ' ghost' : '')} style={{ ['--c' as string]: it.color }} title={it.kind === 'holiday' ? t('cal.chip.holiday', { title: it.title }) : it.kind === 'reminder' ? t('cal.chip.reminder', { title: it.title }) : it.title} onPointerDown={onDown}>
      {!it.allDay && it.start && <b>{hm(it.start)}</b>} {it.title}
    </div>
  );
}

function MonthGrid({ items, today, onNew, onOpen, onMove }: { items: CalItem[]; today: string; onNew: (k: string) => void; onOpen: (it: CalItem) => void; onMove: (it: CalItem, d: number, m: number) => void }) {
  const { state, dispatch } = useApp();
  const ws = state.settings.weekStart;
  const wn = state.settings.weekNumbers;
  const all = monthGrid(state.cal.anchor, ws);
  const g = all.filter((_, i) => all.slice(Math.floor(i / 7) * 7, Math.floor(i / 7) * 7 + 7).some((d) => d.inMonth)); // solo las semanas del mes
  const { ghost, start } = useDragMove(onMove, false);
  const noteDays = new Set(state.cards.filter((c) => c.type === 'note' && c.day && !c.trashed).map((c) => (c as { day: string }).day));
  const goDay = (k: string) => { dispatch({ t: 'calGo', anchor: k }); dispatch({ t: 'calView', view: 'day' }); };
  return (
    <div className={'cg' + (wn ? ' wn' : '')}>
      {wn && <span />}
      {Array.from({ length: 7 }, (_, i) => <span key={i} className="cg-wd">{weekdayShort((i + ws) % 7)}</span>)}
      {g.flatMap((d, gi) => {
        const list = onDay(items, d.key);
        const hol = list.some((x) => x.kind === 'holiday');
        const shown = list.slice(0, 3);
        const cell = (
          <div key={d.key} data-day={d.key} className={'cg-cell' + (d.inMonth ? '' : ' out') + (d.key === today ? ' today' : '') + (hol ? ' holiday' : '') + (ghost?.day === d.key ? ' drop' : '')} onClick={(e) => { if (e.target === e.currentTarget) onNew(d.key); }}>
            <div className="cg-top">
              <button className="cg-num" title={t('cal.viewDay')} aria-label={t('cal.viewDayKey', { day: d.key })} onClick={(e) => { e.stopPropagation(); goDay(d.key); }}>{fromDayKey(d.key).getDate()}</button>
              <span className="grow" />
              {noteDays.has(d.key) && <button className="cg-ico" title={t('cal.openDayNote')} aria-label={t('cal.openDayNote')} onClick={(e) => { e.stopPropagation(); dispatch({ t: 'day', day: d.key }); }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M9 8h6M9 12h6" /></svg></button>}
              <button className="cg-ico cg-add" title={t('cal.addNote')} aria-label={t('cal.addNote')} onClick={(e) => { e.stopPropagation(); onNew(d.key); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
            </div>
            {shown.map((it) => <Chip key={it.id + d.key} it={it} dragging={ghost?.id === it.id} onDown={(e) => start(e, it, () => onOpen(it))} />)}
            {list.length > 3 && <button className="cg-more" onClick={(e) => { e.stopPropagation(); goDay(d.key); }}>{t('cal.more', { n: list.length - 3 })}</button>}
          </div>
        );
        return gi % 7 === 0 && wn ? [<span key={'wn' + d.key} className="cg-wn">{t('cal.week.short', { n: isoWeek(g[Math.min(g.length - 1, gi + 3)].key) })}</span>, cell] : [cell];
      })}
    </div>
  );
}

function TimeGrid({ days, items, today, onNew, onOpen, onMove }: { days: string[]; items: CalItem[]; today: string; onNew: (k: string, minutes: number) => void; onOpen: (it: CalItem) => void; onMove: (it: CalItem, d: number, m: number) => void }) {
  const { state, dispatch } = useApp();
  const { dayStart, dayEnd } = state.settings;
  const hours = Array.from({ length: dayEnd - dayStart }, (_, i) => dayStart + i);
  const H = (dayEnd - dayStart) * 60 * PX;
  const { ghost, start } = useDragMove(onMove, true);
  const scroller = useRef<HTMLDivElement>(null);
  const now = new Date();
  const nowTop = (now.getHours() * 60 + now.getMinutes() - dayStart * 60) * PX;
  return (
    <div className="tgrid" style={{ ['--cols' as string]: days.length }}>
      <div className="tg-head">
        <span />
        {days.map((k) => {
          const d = fromDayKey(k);
          const hol = onDay(items, k).find((x) => x.kind === 'holiday');
          return <div key={k} className={'tg-day' + (k === today ? ' today' : '') + (hol ? ' holiday' : '')}><button className="tg-day-btn" title={t('cal.viewDay')} onClick={() => { dispatch({ t: 'calGo', anchor: k }); dispatch({ t: 'calView', view: 'day' }); }}><span>{weekdayShort(d.getDay())}</span><b>{d.getDate()}</b></button><button className="icon-btn tiny add" title={t('cal.addNote')} aria-label={t('cal.addNoteKey', { day: k })} onClick={() => onNew(k, 9 * 60)}>+</button></div>;
        })}
      </div>
      <div className="tg-allday">
        <span className="small muted">{t('cal.allDay')}</span>
        {days.map((k) => (
          <div key={k} data-day={k} className={'tg-ad' + (ghost?.day === k ? ' drop' : '')}>
            {onDay(items, k).filter((x) => x.allDay).map((it) => <Chip key={it.id + k} it={it} dragging={ghost?.id === it.id} onDown={(e) => start(e, it, () => onOpen(it))} />)}
          </div>
        ))}
      </div>
      <div className="tg-scroll" ref={scroller}>
        <div className="tg-body" style={{ height: H }}>
          <div className="tg-hours">{hours.map((h) => <span key={h} style={{ top: (h - dayStart) * 60 * PX }}>{formatClock(new Date(2000, 0, 1, h, 0))}</span>)}</div>
          {days.map((k) => (
            <div key={k} data-day={k} className={'tg-col' + (k === today ? ' today' : '') + (ghost?.day === k ? ' drop' : '')}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const r = e.currentTarget.getBoundingClientRect();
                onNew(k, Math.floor(((e.clientY - r.top) / PX + dayStart * 60) / 30) * 30);
              }}>
              {hours.map((h) => <div key={h} className="tg-line" style={{ top: (h - dayStart) * 60 * PX }} />)}
              {k === today && nowTop >= 0 && nowTop <= H && <div className="tg-now" style={{ top: nowTop }} />}
              {layoutDay(items, k, dayStart, dayEnd).map((p) => {
                const g = ghost?.id === p.item.id ? ghost : null;
                return (
                  <div key={p.item.id} className={'tg-ev ' + p.item.kind + (p.item.done ? ' done' : '') + (g ? ' ghost' : '')}
                    style={{ top: (p.top + (g?.min ?? 0)) * PX, height: Math.max(18, p.height * PX - 2), left: `calc(${(p.col / p.cols) * 100}% + 2px)`, width: `calc(${100 / p.cols}% - 4px)`, ['--c' as string]: p.item.color }}
                    onPointerDown={(e) => start(e, p.item, () => onOpen(p.item))}>
                    <b>{p.item.kind === 'reminder' ? '🔔 ' : ''}{p.item.title || t('cal.untitled')}</b>
                    <span>{p.item.start ? hm(p.item.start) : ''}{p.item.kind === 'event' && p.item.end ? ' – ' + hm(p.item.end) : ''}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Agenda({ from, items, today, onOpen }: { from: string; items: CalItem[]; today: string; onOpen: (it: CalItem) => void }) {
  const days = Array.from({ length: 30 }, (_, i) => shiftDay(from, i)).map((k) => ({ k, list: onDay(items, k) })).filter((d) => d.list.length);
  if (!days.length) return <div className="empty">{t('cal.agendaEmpty')}</div>;
  return (
    <div className="agenda">
      {days.map(({ k, list }) => (
        <section key={k} className={'agenda-day' + (k === today ? ' today' : '')}>
          <h3 className="cap">{fromDayKey(k).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          {list.map((it) => (
            <button key={it.id + k} className={'agenda-row ' + it.kind} onClick={() => onOpen(it)} disabled={it.kind === 'holiday'}>
              <span className="dot" style={{ background: it.color }} />
              <span className="agenda-time">{it.allDay ? (it.kind === 'holiday' ? t('cal.holiday') : t('cal.allDay')) : it.start ? hm(it.start) : ''}</span>
              <span className="grow">{it.kind === 'reminder' ? '🔔 ' : ''}{it.title || t('cal.untitled')}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

function EventDialog({ draft, calendars, onClose }: { draft: Draft; calendars: Cal[]; onClose: () => void }) {
  const { dispatch } = useApp();
  const [d, setD] = useState(draft);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const save = () => {
    let start: string, end: string;
    if (d.allDay) {
      start = d.day; end = shiftDay(d.day, d.span);
    } else {
      const s = new Date(`${d.day}T${d.time}`);
      if (isNaN(s.getTime())) { setErr(t('cal.ev.badDate')); return; }
      start = s.toISOString(); end = new Date(s.getTime() + d.dur * 60_000).toISOString();
    }
    const ev: CalEvent = { id: d.id ?? uid('ev'), calendar: d.calendar, title: d.title.trim() || t('cal.untitled'), start, end, allDay: d.allDay, note: d.note, repeat: d.repeat };
    dispatch(d.id ? { t: 'patchEvent', id: d.id, patch: ev } : { t: 'addEvent', event: ev });
    onClose();
  };
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal ev-dialog" role="dialog" aria-label={d.id ? t('cal.ev.edit') : t('cal.ev.new')}>
        <header className="modal-head"><h2>{d.id ? t('cal.ev.edit') : t('cal.ev.new')}</h2><span className="grow" /><button className="icon-btn" aria-label={t('cal.close')} onClick={onClose}>✕</button></header>
        <div className="modal-body stack">
          <label className="small">{t('cal.ev.calendar')}
            <select value={d.calendar} aria-label={t('cal.ev.calendar')} onChange={(e) => { const c = calendars.find((x) => x.id === e.target.value); setD({ ...d, calendar: e.target.value, repeat: c?.kind === 'birthdays' && d.repeat === 'none' ? 'year' : d.repeat, allDay: c?.kind === 'birthdays' ? true : d.allDay }); }}>{calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
          <input autoFocus value={d.title} placeholder={t('cal.ev.titlePlaceholder')} aria-label={t('cal.ev.title')} onChange={(e) => setD({ ...d, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <select value={d.allDay ? 'note' : 'reminder'} aria-label={t('cal.ev.type')} onChange={(e) => setD({ ...d, allDay: e.target.value === 'note' })}>
            <option value="reminder">{t('cal.ev.typeReminder')}</option>
            <option value="note">{t('cal.ev.typeNote')}</option>
          </select>
          <div className="row wrap">
            <label className="small">{t('cal.ev.date')}
              <span className="row">
                <button className="icon-btn small" aria-label={t('cal.prevDay')} onClick={() => setD({ ...d, day: shiftDay(d.day, -1) })}>‹</button>
                <input type="date" value={d.day} aria-label={t('cal.ev.date')} onChange={(e) => e.target.value && setD({ ...d, day: e.target.value })} />
                <button className="icon-btn small" aria-label={t('cal.nextDay')} onClick={() => setD({ ...d, day: shiftDay(d.day, 1) })}>›</button>
              </span>
            </label>
            {!d.allDay && <label className="small">{t('cal.ev.time')}<input type="time" value={d.time} step={900} aria-label={t('cal.ev.time')} onChange={(e) => setD({ ...d, time: e.target.value })} /></label>}
            <label className="small">{t('cal.ev.repeat')}
              <select value={d.repeat} aria-label={t('cal.ev.repeat')} onChange={(e) => setD({ ...d, repeat: e.target.value as Repeat })}>
                <option value="none">{t('cal.ev.never')}</option><option value="week">{t('cal.ev.weekly')}</option><option value="month">{t('cal.ev.monthly')}</option><option value="year">{t('cal.ev.yearly')}</option>
              </select>
            </label>
          </div>
          <textarea rows={3} value={d.note} placeholder={t('cal.ev.notePlaceholder')} aria-label={t('cal.ev.note')} onChange={(e) => setD({ ...d, note: e.target.value })} />
          {err && <p className="err">{err}</p>}
          <div className="row">
            {d.id && (confirm
              ? <span className="confirm small">{t('cal.ev.confirmDelete')}<button className="tool small-btn" onClick={() => setConfirm(false)}>{t('cal.ev.no')}</button><button className="danger small-btn" onClick={() => { dispatch({ t: 'removeEvent', id: d.id! }); onClose(); }}>{t('cal.delete')}</button></span>
              : <button className="tool subtle" onClick={() => setConfirm(true)}>{t('cal.delete')}</button>)}
            <span className="grow" />
            <button className="tool" onClick={onClose}>{t('cal.cancel')}</button>
            <button className="primary" onClick={save}>{t('cal.ev.save')}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
