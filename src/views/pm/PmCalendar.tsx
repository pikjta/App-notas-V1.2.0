import { t, type Key } from '../../i18n';
import { useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { useApp } from '../../App';
import { weekdayShort } from '../../lib/agenda';
import { monthGrid } from '../../lib/calendar';
import { COLORS, dateColOf, dateOf, daysBetweenIso, endOf, rowTitle, ruleFor, shiftIsoDay, stateInfo } from '../../lib/pm';
import type { Opt, Pm, PmOp, Row } from '../../lib/pm';

const monthName = (i: number) => t(`pm.cal.month.${i}` as Key);

/** Calendario de la tabla: cada fila en sus días; se arrastra a otro día; las filas sin fecha, al lado. */
export function PmCalendar({ pm, rows, tags, op, onOpen, today }: { pm: Pm; rows: Row[]; tags: Opt[]; op: (o: PmOp) => void; onOpen: (id: string) => void; today: string }) {
  const { state } = useApp();
  const col = dateColOf(pm);
  const month = pm.ui?.month ?? today.slice(0, 8) + '01';
  const grid = monthGrid(month, state.settings.weekStart);
  const [drag, setDrag] = useState<{ id: string; over: string | null } | null>(null);
  const status = pm.cols.find((c) => c.type === 'status');
  if (!col) return <div className="empty">{t('pm.cal.needDate')}</div>;
  const undated = rows.filter((r) => !dateOf(r, col));
  const [y, m] = month.split('-').map(Number);
  const go = (n: number) => { const d = new Date(y, m - 1 + n, 1); op({ op: 'ui', patch: { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` } }); };

  const start = (e: RPointerEvent, r: Row, fromDay: string | null) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const find = (ev: PointerEvent) => (document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-pmday]') as HTMLElement | null)?.dataset.pmday ?? null;
    const mv = (ev: PointerEvent) => { if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return; moved = true; setDrag({ id: r.id, over: find(ev) }); };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      setDrag(null);
      if (!moved) { onOpen(r.id); return; }
      const day = find(ev);
      if (!day) return;
      const d = dateOf(r, col);
      if (!d || !fromDay) { op({ op: 'cell', row: r.id, col: col.id, value: { start: day, end: '' } }); return; }
      const n = daysBetweenIso(fromDay, day);
      if (n) op({ op: 'cell', row: r.id, col: col.id, value: { start: shiftIsoDay(d.start, n), end: d.end ? shiftIsoDay(d.end, n) : '' } });
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };

  const chip = (r: Row, day: string | null) => {
    const rule = ruleFor(pm, r, tags, today);
    const si = status ? stateInfo(status, r.cells[status.id]) : null;
    const c = rule ? COLORS[rule.color][1] : si ? COLORS[si.ph.color]?.[1] : 'var(--accent)';
    return (
      <div key={r.id + (day ?? '')} className={'chip-ev pm-chip' + (drag?.id === r.id ? ' ghost' : '') + (rule?.bold ? ' bold' : '')} style={{ ['--c' as string]: c }} onPointerDown={(e) => start(e, r, day)} title={rowTitle(pm, r, tags)}>
        {r.milestone ? '◆ ' : ''}{rowTitle(pm, r, tags)}
      </div>
    );
  };

  return (
    <div className="pm-cal">
      <div className="pm-cal-main">
        <div className="row tl-bar">
          <button className="tool small-btn" aria-label={t('pm.monthPrev')} onClick={() => go(-1)}>‹</button>
          <b className="pm-cal-title">{t('pm.cal.title', { month: monthName(m - 1)[0].toUpperCase() + monthName(m - 1).slice(1), year: y })}</b>
          <button className="tool small-btn" aria-label={t('pm.monthNext')} onClick={() => go(1)}>›</button>
          <button className="tool small-btn" onClick={() => op({ op: 'ui', patch: { month: today.slice(0, 8) + '01' } })}>{t('pm.today')}</button>
        </div>
        <div className="month pm-month">
          {Array.from({ length: 7 }, (_, i) => <div key={i} className="month-wd">{weekdayShort((i + state.settings.weekStart) % 7)}</div>)}
          {grid.map((d) => {
            const list = rows.filter((r) => { const x = dateOf(r, col); return x && x.start <= d.key && endOf(x) >= d.key; });
            return (
              <div key={d.key} data-pmday={d.key} className={'month-cell' + (d.inMonth ? '' : ' out') + (d.key === today ? ' today' : '') + (drag?.over === d.key ? ' drop' : '')}>
                <span className="month-num">{Number(d.key.slice(8))}</span>
                {list.slice(0, 4).map((r) => chip(r, d.key))}
                {list.length > 4 && <span className="small muted more">{t('pm.more', { n: list.length - 4 })}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <aside className="pm-cal-side">
        <span className="menu-label">{t('pm.cal.undated', { n: undated.length })}</span>
        <span className="small muted">{t('pm.cal.dragHint')}</span>
        {undated.map((r) => chip(r, null))}
      </aside>
    </div>
  );
}
