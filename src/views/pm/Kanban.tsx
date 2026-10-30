import { t } from '../../i18n';
import { useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { blockers, cellText, COLORS, kanbanCandidates, kanbanColumns, kanbanDropValue, progress, rowTitle, ruleFor, stateInfo } from '../../lib/pm';
import type { KanbanBy, Opt, Pm, PmOp, Row } from '../../lib/pm';

/** Kanban: agrupa las filas por una columna (estado por fase o por estado, selección, casilla…). */
export function Kanban({ pm, rows, by, tags, op, onOpen, onAdd }: { pm: Pm; rows: Row[]; by: KanbanBy; tags: Opt[]; op: (o: PmOp) => void; onOpen: (id: string) => void; onAdd: (value: unknown, colId: string) => void }) {
  const [drag, setDrag] = useState<{ id: string; over: string | null } | null>(null);
  const columns = kanbanColumns(pm, rows, by, tags);
  const col = pm.cols.find((c) => c.id === by.col);
  const status = pm.cols.find((c) => c.type === 'status');
  const prog = pm.cols.find((c) => c.type === 'progress');
  const extra = pm.cols.filter((c) => !c.hidden && c.id !== by.col && (c.type === 'select' || c.type === 'multi' || c.type === 'date')).slice(0, 2);

  const start = (e: RPointerEvent, row: Row, fromKey: string) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button.link')) return;
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const find = (ev: PointerEvent) => (document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-kcol]') as HTMLElement | null)?.dataset.kcol ?? null;
    const mv = (ev: PointerEvent) => { if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return; moved = true; setDrag({ id: row.id, over: find(ev) }); };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      setDrag(null);
      if (!moved) { onOpen(row.id); return; }
      const to = columns.find((c) => c.key === find(ev));
      if (!to || to.key === fromKey || !col) return;
      op({ op: 'cell', row: row.id, col: col.id, value: kanbanDropValue(pm, by, row, columns.find((c) => c.key === fromKey), to) });
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };

  if (!col) return <div className="empty">{t('pm.kanban.pick')}</div>;
  return (
    <div className="kanban">
      {columns.map((k) => {
        const [bg, fg] = COLORS[k.color] ?? COLORS.gray;
        return (
          <section key={k.key} data-kcol={k.key} className={'kcol' + (drag?.over === k.key ? ' drop' : '')} style={{ background: `color-mix(in srgb, ${bg} 55%, var(--card-bg))`, borderTopColor: fg }}>
            <header className="kcol-head"><span className="pill" style={{ background: bg, color: fg }}>{k.label}</span><span className="small muted">{k.rows.length}</span></header>
            {k.rows.map((r) => {
              const si = status && status.id !== col.id ? stateInfo(status, r.cells[status.id]) : null;
              const p = prog ? progress(pm, prog, r) : null;
              const blocked = blockers(pm, r).length > 0;
              const rule = ruleFor(pm, r, tags, new Date().toISOString().slice(0, 10));
              return (
                <article key={r.id + k.key} className={'kcard' + (drag?.id === r.id ? ' ghost' : '') + (r.archived ? ' archived' : '')} style={rule ? { borderLeft: `4px solid ${COLORS[rule.color][1]}`, background: COLORS[rule.color][0] } : undefined} onPointerDown={(e) => start(e, r, k.key)}>
                  <b style={rule?.bold ? { fontWeight: 800 } : { fontWeight: 600 }}>{rowTitle(pm, r, tags)}</b>
                  {blocked && <span className="small blocked-tag">{t('pm.kanban.blocked')}</span>}
                  {si && <span className="pill" style={{ background: COLORS[si.ph.color]?.[0], color: COLORS[si.ph.color]?.[1] }}>{si.st.name}</span>}
                  {extra.map((c) => { const t = cellText(pm, c, r, tags); return t ? <span key={c.id} className="small muted">{t}</span> : null; })}
                  {p !== null && <div className="progress"><span style={{ width: p + '%', background: p >= 100 ? '#2F7D4F' : undefined }} /></div>}
                  {(r.subs ?? []).length > 0 && <span className="small muted">☑ {(r.subs ?? []).filter((s) => s.done).length}/{(r.subs ?? []).length}</span>}
                </article>
              );
            })}
            {k.key !== '__none' && <button className="link small" onClick={() => onAdd(k.value, col.id)}>{t('pm.kanban.addHere')}</button>}
          </section>
        );
      })}
    </div>
  );
}

export function KanbanPicker({ pm, by, onChange }: { pm: Pm; by: KanbanBy | null; onChange: (b: KanbanBy) => void }) {
  const cand = kanbanCandidates(pm);
  const value = by ? by.col + ':' + by.mode : '';
  return (
    <label className="small kanban-by-l">{t('pm.kanban.by')} <select className="kanban-by" aria-label={t('pm.kanban.by')} value={value} onChange={(e) => { const [col, mode] = e.target.value.split(':'); onChange({ col, mode } as KanbanBy); }}>
      {cand.flatMap((c) => (c.type === 'status' ? [[c.id + ':phase', t('pm.kanban.byPhase', { name: c.name })], [c.id + ':state', t('pm.kanban.byState', { name: c.name })]] : [[c.id + ':value', c.name]])).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select></label>
  );
}
