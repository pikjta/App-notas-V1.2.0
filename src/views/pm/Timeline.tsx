import { t, type Key } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { COLORS, dateColOf, dateOf, daysBetweenIso, depConflict, endOf, isDone, PX_PER_DAY, rowTitle, ruleFor, shiftIsoDay, stateInfo, timelineOrder, timelineRange, wouldCycle } from '../../lib/pm';
import type { Opt, Pm, PmOp, Row, Zoom } from '../../lib/pm';

const ROW_H = 40;
const LEFT = 260;
const monthName = (i: number) => t(`pm.tl.month.${i}` as Key);
const wdName = (i: number) => t(`pm.tl.wd.${i}` as Key);

type Drag = { row: string; mode: 'move' | 'start' | 'end'; days: number } | null;

/**
 * Cronología: barras por fechas. Arrastrar la barra cambia las fechas; los extremos cambian el
 * inicio o el fin; arrastrar el nombre reordena (orden propio de esta vista). Los puntos de los
 * extremos crean dependencias; las flechas en rojo indican que la bloqueada empieza demasiado pronto.
 */
export function Timeline({ pm, rows, tags, op, onOpen, today }: { pm: Pm; rows: Row[]; tags: Opt[]; op: (o: PmOp) => void; onOpen: (id: string) => void; today: string }) {
  const zoom: Zoom = pm.ui?.zoom ?? 'week';
  const col = dateColOf(pm);
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [link, setLink] = useState<{ from: string; x: number; y: number } | null>(null);
  const [reorder, setReorder] = useState<{ id: string; over: number } | null>(null);
  const [hoverDep, setHoverDep] = useState<string | null>(null);
  const ordered = timelineOrder(pm, rows);
  const range = timelineRange(ordered, col, today, zoom);
  const px = PX_PER_DAY[zoom];
  const width = range.days * px;
  const xOf = (iso: string) => daysBetweenIso(range.start, iso) * px;
  const status = pm.cols.find((c) => c.type === 'status');

  // Al abrir, centrar en hoy.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, xOf(today) - (el.clientWidth - LEFT) / 2);
  }, [zoom, col?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!col) return <div className="empty">{t('pm.tl.needDate')}</div>;

  const live = (r: Row) => {
    const d = dateOf(r, col);
    if (!d) return null;
    if (drag?.row !== r.id || !drag.days) return d;
    if (drag.mode === 'move') return { start: shiftIsoDay(d.start, drag.days), end: d.end ? shiftIsoDay(d.end, drag.days) : '' };
    if (drag.mode === 'start') { const s = shiftIsoDay(d.start, drag.days); return s <= endOf(d) ? { start: s, end: d.end || d.start } : d; }
    const e = shiftIsoDay(endOf(d), drag.days);
    return e >= d.start ? { start: d.start, end: e === d.start ? '' : e } : d;
  };

  const startBar = (e: RPointerEvent, r: Row, mode: 'move' | 'start' | 'end') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const sx = e.clientX;
    let days = 0, moved = false;
    const mv = (ev: PointerEvent) => { const d = Math.round((ev.clientX - sx) / px); if (Math.abs(ev.clientX - sx) > 3) moved = true; if (d !== days) { days = d; setDrag({ row: r.id, mode, days }); } };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      const d = dateOf(r, col);
      setDrag(null);
      if (!moved) { onOpen(r.id); return; }
      if (!d || !days) return;
      let next = d;
      if (mode === 'move') next = { start: shiftIsoDay(d.start, days), end: d.end ? shiftIsoDay(d.end, days) : '' };
      else if (mode === 'start') { const s = shiftIsoDay(d.start, days); if (s <= endOf(d)) next = { start: s, end: d.end || d.start }; }
      else { const en = shiftIsoDay(endOf(d), days); if (en >= d.start) next = { start: d.start, end: en === d.start ? '' : en }; }
      op({ op: 'cell', row: r.id, col: col.id, value: next });
      if (mode === 'move' && pm.ui?.showDeps) {
        // «Desplazar dependientes»: las tareas que esperan a esta se mueven los mismos días.
        const seen = new Set<string>([r.id]);
        const queue = [r.id];
        while (queue.length) {
          const cur = queue.shift()!;
          for (const x of pm.rows) {
            if (seen.has(x.id) || !(x.deps ?? []).includes(cur)) continue;
            seen.add(x.id); queue.push(x.id);
            const xd = dateOf(x, col);
            if (xd) op({ op: 'cell', row: x.id, col: col.id, value: { start: shiftIsoDay(xd.start, days), end: xd.end ? shiftIsoDay(xd.end, days) : '' } });
          }
        }
      }
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };

  const startLink = (e: RPointerEvent, r: Row) => {
    e.preventDefault(); e.stopPropagation();
    const box = scroller.current!.querySelector('.tl-rows')!.getBoundingClientRect();
    const find = (ev: PointerEvent) => (document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-tlrow]') as HTMLElement | null)?.dataset.tlrow ?? null;
    const mv = (ev: PointerEvent) => setLink({ from: r.id, x: ev.clientX - box.left, y: ev.clientY - box.top });
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      setLink(null);
      const to = find(ev);
      const target = pm.rows.find((x) => x.id === to);
      if (!target || target.id === r.id || (target.deps ?? []).includes(r.id) || wouldCycle(pm, target.id, r.id)) return;
      op({ op: 'row', id: target.id, patch: { deps: [...(target.deps ?? []), r.id] } });
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };

  const startReorder = (e: RPointerEvent, r: Row) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const sy = e.clientY;
    const from = ordered.findIndex((x) => x.id === r.id);
    let over = from, moved = false;
    const mv = (ev: PointerEvent) => { if (Math.abs(ev.clientY - sy) > 4) moved = true; over = Math.max(0, Math.min(ordered.length - 1, from + Math.round((ev.clientY - sy) / ROW_H))); setReorder({ id: r.id, over }); };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      setReorder(null);
      if (!moved) { onOpen(r.id); return; }
      if (over === from) return;
      const ids = ordered.map((x) => x.id);
      ids.splice(from, 1);
      ids.splice(over, 0, r.id);
      op({ op: 'ui', patch: { order: ids } });
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };

  // Cabecera: meses arriba; días, semanas o meses abajo.
  const ticks: { x: number; label: string; strong?: boolean; weekend?: boolean }[] = [];
  const months: { x: number; w: number; label: string }[] = [];
  for (let i = 0; i < range.days; i++) {
    const iso = shiftIsoDay(range.start, i);
    const [y, m, d] = iso.split('-').map(Number);
    const wd = new Date(y, m - 1, d).getDay();
    if (d === 1 || i === 0) months.push({ x: i * px, w: 0, label: `${monthName(m - 1)} ${y}` });
    if (zoom === 'day') ticks.push({ x: i * px, label: `${wdName(wd)} ${d}`, weekend: wd === 0 || wd === 6 });
    else if (zoom === 'week' && wd === 1) ticks.push({ x: i * px, label: String(d) });
    else if (zoom === 'month' && d === 1) ticks.push({ x: i * px, label: monthName(m - 1), strong: true });
  }
  months.forEach((mm, i) => { mm.w = (months[i + 1]?.x ?? width) - mm.x; });

  const rowIndex = new Map(ordered.map((r, i) => [r.id, i]));
  const deps = ordered.flatMap((r) => (r.deps ?? []).filter((d) => rowIndex.has(d)).map((d) => ({ from: pm.rows.find((x) => x.id === d)!, to: r })));

  return (
    <div className="timeline">
      <div className="tl-bar">
        <div className="seg">{(['day', 'week', 'month'] as Zoom[]).map((z) => <button key={z} className={zoom === z ? 'on' : ''} onClick={() => op({ op: 'ui', patch: { zoom: z } })}>{z === 'day' ? t('pm.tl.days') : z === 'week' ? t('pm.tl.weeks') : t('pm.tl.months')}</button>)}</div>
        {pm.cols.filter((c) => c.type === 'date').length > 1 && (
          <select aria-label={t('pm.tl.dateCol')} value={col.id} onChange={(e) => op({ op: 'ui', patch: { dateCol: e.target.value } })}>{pm.cols.filter((c) => c.type === 'date').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        )}
        <button className="tool small-btn" onClick={() => { const el = scroller.current; if (el) el.scrollLeft = Math.max(0, xOf(today) - (el.clientWidth - LEFT) / 2); }}>{t('pm.today')}</button>
        <button className="tool small-btn" disabled={!pm.ui?.order?.length} onClick={() => op({ op: 'ui', patch: { order: undefined } })}>{t('pm.tl.resetOrder')}</button>
        <label className="check-line small"><input type="checkbox" role="switch" checked={!!pm.ui?.showDeps} onChange={() => op({ op: 'ui', patch: { showDeps: !pm.ui?.showDeps } })} /> {t('pm.tl.shiftDeps')}</label>
        <span className="small muted">{t('pm.tl.hint')}</span>
      </div>
      <div className="tl-scroll" ref={scroller}>
        <div className="tl-inner" style={{ width: LEFT + width }}>
          <div className="tl-head" style={{ height: 50 }}>
            <div className="tl-corner" style={{ width: LEFT }}>{col.name}</div>
            <div className="tl-scale" style={{ width }}>
              {months.map((m, i) => <span key={i} className="tl-month" style={{ left: m.x, width: m.w }}>{m.label}</span>)}
              {ticks.map((t, i) => <span key={i} className={'tl-tick' + (t.weekend ? ' we' : '') + (t.strong ? ' strong' : '')} style={{ left: t.x, width: zoom === 'day' ? px : undefined }}>{t.label}</span>)}
            </div>
          </div>
          <div className="tl-rows" style={{ height: ordered.length * ROW_H }}>
            {zoom === 'day' && ticks.filter((t) => t.weekend).map((t, i) => <div key={i} className="tl-weekend" style={{ left: LEFT + t.x, width: px }} />)}
            <div className="tl-today" style={{ left: LEFT + xOf(today) + px / 2 }} title={t('pm.today')} />
            <svg className="tl-deps" width={LEFT + width} height={ordered.length * ROW_H}>
              {deps.map(({ from, to }) => {
                const a = live(from), b = live(to);
                if (!a || !b) return null;
                const x1 = LEFT + xOf(endOf(a)) + px, y1 = rowIndex.get(from.id)! * ROW_H + ROW_H / 2;
                const x2 = LEFT + xOf(b.start), y2 = rowIndex.get(to.id)! * ROW_H + ROW_H / 2;
                const k = Math.max(30, Math.abs(x2 - x1) / 2);
                const bad = depConflict(pm, { ...from, cells: { ...from.cells, [col.id]: a } }, { ...to, cells: { ...to.cells, [col.id]: b } });
                const key = from.id + '>' + to.id;
                return (
                  <g key={key} className={'tl-dep' + (bad ? ' bad' : '')} onMouseEnter={() => setHoverDep(key)} onMouseLeave={() => setHoverDep((h) => (h === key ? null : h))}>
                    <path className="hit" d={`M ${x1} ${y1} C ${x1 + k} ${y1}, ${x2 - k} ${y2}, ${x2} ${y2}`} />
                    <path d={`M ${x1} ${y1} C ${x1 + k} ${y1}, ${x2 - k} ${y2}, ${x2} ${y2}`} fill="none" />
                    <path d={`M ${x2 - 7} ${y2 - 5} L ${x2} ${y2} L ${x2 - 7} ${y2 + 5}`} fill="none" />
                    {hoverDep === key && (
                      <foreignObject x={(x1 + x2) / 2 - 11} y={(y1 + y2) / 2 - 11} width={22} height={22}>
                        <button className="tl-dep-x" aria-label={t('pm.removeDep')} title={bad ? t('pm.tl.depBad') : t('pm.removeDep')} onClick={() => op({ op: 'row', id: to.id, patch: { deps: (to.deps ?? []).filter((d) => d !== from.id) } })}>×</button>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
              {link && (() => {
                const from = ordered.find((r) => r.id === link.from); const a = from && live(from);
                if (!a) return null;
                const x1 = LEFT + xOf(endOf(a)) + px, y1 = rowIndex.get(link.from)! * ROW_H + ROW_H / 2;
                return <path className="tl-link-preview" d={`M ${x1} ${y1} L ${link.x} ${link.y}`} />;
              })()}
            </svg>
            {ordered.map((r, i) => {
              const d = live(r);
              const rule = ruleFor(pm, r, tags, today);
              const si = status ? stateInfo(status, r.cells[status.id]) : null;
              const color = rule ? COLORS[rule.color][1] : isDone(pm, r) ? '#2F7D4F' : si ? COLORS[si.ph.color]?.[1] : 'var(--accent)';
              const top = reorder?.id === r.id ? reorder.over * ROW_H : i * ROW_H;
              const milestone = !!d && (r.milestone || false);
              return (
                <div key={r.id} data-tlrow={r.id} className={'tl-row' + (reorder?.id === r.id ? ' lifting' : '') + (r.archived ? ' archived' : '')} style={{ top, height: ROW_H }}>
                  <div className="tl-name" style={{ width: LEFT }} onPointerDown={(e) => startReorder(e, r)} title={t('pm.tl.reorderTip')}>
                    <span className="grip-dots">⠿</span><span className={'ellipsis' + (rule?.bold ? ' bold' : '')}>{rowTitle(pm, r, tags)}</span>
                  </div>
                  <div className="tl-lane" style={{ width }} onClick={(e) => {
                    if (d || e.target !== e.currentTarget) return;
                    const box = e.currentTarget.getBoundingClientRect();
                    const iso = shiftIsoDay(range.start, Math.floor((e.clientX - box.left) / px));
                    op({ op: 'cell', row: r.id, col: col.id, value: { start: iso, end: '' } });
                  }}>
                    {!d && <span className="tl-nodate">{t('pm.tl.noDate')}</span>}
                    {d && milestone && (
                      <div className="tl-milestone" style={{ left: xOf(d.start) + px / 2 - 9, background: color }} title={t('pm.tl.milestoneAt', { date: d.start })} onPointerDown={(e) => startBar(e, r, 'move')} />
                    )}
                    {d && milestone && <span className="tl-mlabel" style={{ left: xOf(d.start) + px / 2 + 14 }}>{rowTitle(pm, r, tags)}</span>}
                    {d && !milestone && (
                      <div className={'tl-bar-item' + (rule?.bold ? ' bold' : '')} style={{ left: xOf(d.start), width: (daysBetweenIso(d.start, endOf(d)) + 1) * px, background: `color-mix(in srgb, ${color} 22%, var(--card-bg))`, borderColor: color }}
                        onPointerDown={(e) => startBar(e, r, 'move')} title={`${rowTitle(pm, r, tags)} · ${d.start}${d.end ? ' → ' + d.end : ''}`}>
                        <span className="tl-h start" onPointerDown={(e) => startBar(e, r, 'start')} />
                        <span className="tl-label ellipsis">{rowTitle(pm, r, tags)}</span>
                        <span className="tl-h end" onPointerDown={(e) => startBar(e, r, 'end')} />
                        <span className="tl-dot" title={t('pm.tl.linkTip')} onPointerDown={(e) => startLink(e, r)} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
