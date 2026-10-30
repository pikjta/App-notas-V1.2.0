import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../App';
import { t } from '../i18n';
import { formatTimer, rowTitle, runningTimer } from '../lib/pm';
import { PROJECT_COLORS, uid } from '../lib/model';
import type { Project } from '../lib/model';
import { groupReminders, projectStats, reminders } from '../lib/agenda';
import { todayKey } from '../lib/store';
import { DEFAULT_SESSION_FONT, fontCss, normalizeFont, normalizeSide, sideVars } from '../lib/appearance';
import { FontPanel, SidePanel } from './Appearance';
import { Icon } from './Icon';
import { hasIcon, viewIconOf } from '../lib/icons';
import type { ViewIconId } from '../lib/icons';

export function Sidebar() {
  const { state, dispatch, status, lock, openSettings, openSearch } = useApp();
  const [adding, setAdding] = useState<{ folder: string | null } | null>(null);
  const [name, setName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [moveMenu, setMoveMenu] = useState<string | null>(null);
  const refocus = useRef<string | null>(null);
  const [renamingSession, setRenamingSession] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const sessionFont = normalizeFont(state.settings.sessionFont, DEFAULT_SESSION_FONT);
  const side = normalizeSide(state.settings.side);
  const vi = (id: ViewIconId, size = 16) => <Icon name={viewIconOf(state.settings.viewIcons, id)} size={size} />;

  const create = () => {
    const target = adding;
    setAdding(null);
    if (!target || !name.trim()) { setName(''); return; }
    const color = PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length];
    dispatch({ t: 'addProject', id: uid('proj'), name, color, folder: target.folder });
    setName('');
  };
  const createFolder = () => {
    setAddingFolder(false);
    if (folderName.trim()) dispatch({ t: 'addFolder', id: uid('folder'), name: folderName });
    setFolderName('');
  };
  const live = state.projects.filter((p) => !p.trashed && !p.hidden && !p.home);
  // Tras mover una tarea con el teclado, el foco vuelve a su botón (el nodo cambia de sitio).
  useLayoutEffect(() => {
    if (!refocus.current) return;
    (document.querySelector(`.proj-row[data-proj="${refocus.current}"] .side-item`) as HTMLElement | null)?.focus();
    refocus.current = null;
  });
  const folderOf = (p: Project) => (p.folder && state.folders.some((f) => f.id === p.folder) ? p.folder : null);

  /** Alt+↑ / Alt+↓: sube o baja la tarea dentro de su carpeta. */
  const nudge = (e: React.KeyboardEvent, p: Project) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const sibs = live.filter((x) => folderOf(x) === folderOf(p));
    const i = sibs.findIndex((x) => x.id === p.id);
    const before = e.key === 'ArrowUp' ? sibs[i - 1]?.id : i + 1 < sibs.length ? (sibs[i + 2]?.id ?? null) : undefined;
    if (before === undefined) return;
    refocus.current = p.id;
    dispatch({ t: 'moveProject', id: p.id, folder: folderOf(p), before });
  };

  /** Arrastrar una tarea: antes o después de otra (incluso de otra carpeta), a una carpeta, o fuera de ellas. */
  const startDrag = (e: React.PointerEvent, p: Project) => {
    if (e.button !== 0 || (e.target as Element).closest('.row-actions, input')) return;
    const sx = e.clientX, sy = e.clientY;
    let moved = false, ghost: HTMLElement | null = null, mark: Element | null = null, markCls = '';
    let to: { folder: string | null; before: string | null } | null = null;
    const unmark = () => { if (mark) mark.classList.remove(markCls); mark = null; };
    const nextRow = (row: HTMLElement) => { let n = row.nextElementSibling as HTMLElement | null; while (n && (!n.matches('.proj-row[data-proj]') || n.dataset.proj === p.id)) n = n.nextElementSibling as HTMLElement | null; return n; };
    const find = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const row = el?.closest('.proj-row[data-proj]') as HTMLElement | null;
      if (row && row.dataset.proj !== p.id) {
        const rc = row.getBoundingClientRect();
        const folder = row.dataset.folder || null;
        if (ev.clientY < rc.top + rc.height / 2) return { folder, before: row.dataset.proj!, el: row, cls: 'drop-before' };
        return { folder, before: nextRow(row)?.dataset.proj ?? null, el: row, cls: 'drop-after' };
      }
      if (row) return null;
      const fold = el?.closest('.side-folder[data-folder-id]') as HTMLElement | null;
      if (fold) return { folder: fold.dataset.folderId!, before: null, el: fold, cls: 'drop-in' };
      const list = el?.closest('.side-list') as HTMLElement | null;
      return list ? { folder: null, before: null, el: list, cls: 'drop-in' } : null;
    };
    let frame = 0, last: PointerEvent | null = null;
    const step = () => {
      frame = 0;
      if (!last) return;
      const t = find(last);
      unmark();
      to = t ? { folder: t.folder, before: t.before } : null;
      if (t) { mark = t.el; markCls = t.cls; t.el.classList.add(t.cls); }
    };
    const mv = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return;
      if (!moved) {
        moved = true;
        document.body.classList.add('pm-grabbing');
        window.getSelection()?.removeAllRanges();
        ghost = document.createElement('div'); ghost.className = 'pm-ghost'; ghost.textContent = p.name; document.body.appendChild(ghost);
        (document.querySelector(`.proj-row[data-proj="${p.id}"]`))?.classList.add('dragging');
      }
      if (ghost) { ghost.style.left = ev.clientX + 12 + 'px'; ghost.style.top = ev.clientY + 8 + 'px'; }
      last = ev;
      if (!frame) frame = requestAnimationFrame(step);
    };
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (frame) cancelAnimationFrame(frame);
      if (moved) step();
      unmark();
      document.body.classList.remove('pm-grabbing');
      ghost?.remove();
      document.querySelector(`.proj-row[data-proj="${p.id}"]`)?.classList.remove('dragging');
      if (!moved) return;
      // El clic que sigue a soltar no debe abrir la tarea.
      const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', stop, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', stop, true), 0);
      if (to) dispatch({ t: 'moveProject', id: p.id, folder: to.folder, before: to.before });
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const newProject = () => (
    <input className="side-input" autoFocus value={name} placeholder={t('ui.side.projectName')} aria-label={t('ui.side.projectName')}
      onChange={(e) => setName(e.target.value)} onBlur={create}
      onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') { setName(''); setAdding(null); } }} />
  );

  const projectRow = (p: Project) => {
    const st = projectStats(state.cards, p.id);
    return (
      <div key={p.id} data-proj={p.id} data-folder={folderOf(p) ?? ''} className={'proj-row' + (p.id === state.sel && state.view === 'board' ? ' on' : '')} onPointerDown={(e) => startDrag(e, p)}>
        <button className={'side-item proj' + (p.id === state.sel && state.view === 'board' ? ' on' : '')} onClick={() => dispatch({ t: 'select', id: p.id })} onKeyDown={(e) => nudge(e, p)} title={t('ui.side.dragHint')}>
          {p.icon && hasIcon(p.icon) ? <span className="proj-icon" style={{ color: p.color }}><Icon name={p.icon} size={16} /></span> : <span className="dot" style={{ background: p.color }} />}
          <span className="side-name">{p.name}</span>
          {st.total > 0 && <span className="side-count" title={t('ui.common.doneOf', { done: st.done, total: st.total })}>{st.done}/{st.total}</span>}
        </button>
        <span className="row-actions">
          <span className="menu-anchor">
            <button className="icon-btn small" title={t('ui.side.moveToFolder')} aria-label={t('ui.side.moveToFolder')} aria-expanded={moveMenu === p.id} onClick={() => setMoveMenu(moveMenu === p.id ? null : p.id)}><Icon name="folder" size={14} /></button>
            {moveMenu === p.id && (
              <div className="menu move-menu" role="menu" aria-label={t('ui.side.moveTo')} onMouseLeave={() => setMoveMenu(null)}>
                <span className="menu-label">{t('ui.side.moveTo')}</span>
                {state.folders.map((f) => <button key={f.id} role="menuitem" className={p.folder === f.id ? 'on' : ''} onClick={() => { dispatch({ t: 'patchProject', id: p.id, patch: { folder: f.id } }); setMoveMenu(null); }}>{f.name}</button>)}
                <button role="menuitem" className={!p.folder ? 'on' : ''} onClick={() => { dispatch({ t: 'patchProject', id: p.id, patch: { folder: null } }); setMoveMenu(null); }}>{t('ui.side.noFolder')}</button>
              </div>
            )}
          </span>
          <button className="icon-btn small" title={t('ui.side.trashProject')} aria-label={t('ui.side.trashProject')} onClick={() => dispatch({ t: 'trashProject', id: p.id })}>{vi('trash', 14)}</button>
        </span>
        {st.total > 0 && <div className="side-bar" aria-hidden="true"><span style={{ width: st.pct + '%', background: p.color }} /></div>}
      </div>
    );
  };

  const todayCount = groupReminders(reminders(state)).filter((g) => g.key === 'late' || g.key === 'today').reduce((m, g) => m + g.items.length, 0);
  const dailyCount = state.cards.filter((c) => c.type === 'note' && c.day && !c.trashed).length;
  const trashCount = state.projects.filter((p) => p.trashed).length + state.cards.filter((c) => c.trashed).length;

  return (
    <aside className={'side tex-' + side.texture} style={sideVars(side)}>
      <div className="brand-row">
        {renamingSession ? (
          <input className="brand brand-input" aria-label={t('ui.side.sessionName')} autoFocus defaultValue={state.settings.sessionName} style={fontCss(sessionFont, 'session')}
            onBlur={(e) => { dispatch({ t: 'settings', patch: { sessionName: e.target.value.trim() || 'Cuaderno' } }); setRenamingSession(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }} />
        ) : (
          <button className="brand side-name-btn" style={fontCss(sessionFont, 'session')} title={t('ui.side.sessionRename')} onClick={() => setRenamingSession(true)}>{state.settings.sessionName || 'Cuaderno'}</button>
        )}
        <button className="icon-btn small" title={t('ui.side.nameFont')} aria-label={t('ui.side.nameFont')} onClick={() => setFontOpen(true)}>Aa</button>
      </div>
      {fontOpen && <FontPanel kind="session" font={sessionFont} onChange={(f) => dispatch({ t: 'settings', patch: { sessionFont: f } })} onClose={() => setFontOpen(false)} />}
      {sideOpen && <SidePanel onClose={() => setSideOpen(false)} />}
      <div className="side-tools">
        <button className="side-search" onClick={openSearch}><span>{t('ui.side.search')}</span><kbd>⌘K</kbd></button>
      </div>

      <nav aria-label={t('ui.side.views')} className="side-views">
        <button className={'side-item' + (state.view === 'board' && state.sel === 'home' ? ' on' : '')} onClick={() => dispatch({ t: 'select', id: 'home' })}><span className="vi">{vi('home')}</span><span className="side-name">{t('ui.side.home')}</span></button>
        <button className={'side-item' + (state.view === 'today' ? ' on' : '')} onClick={() => dispatch({ t: 'view', view: 'today' })}><span className="vi">{vi('today')}</span><span className="side-name">{t('ui.side.today')}</span><span className="side-count">{todayCount || ''}</span></button>
        <button className={'side-item' + (state.view === 'reminders' ? ' on' : '')} onClick={() => dispatch({ t: 'view', view: 'reminders' })}><span className="vi">{vi('reminders')}</span><span className="side-name">{t('ui.side.reminders')}</span></button>
        <button className={'side-item' + (state.view === 'calendar' ? ' on' : '')} onClick={() => dispatch({ t: 'view', view: 'calendar' })}><span className="vi">{vi('calendar')}</span><span className="side-name">{t('ui.side.calendar')}</span></button>
        <button className={'side-item' + (state.view === 'graph' ? ' on' : '')} onClick={() => dispatch({ t: 'view', view: 'graph' })}><span className="vi">{vi('graph')}</span><span className="side-name">{t('ui.side.graph')}</span></button>
        <button className={'side-item' + (state.view === 'journal' ? ' on' : '')} onClick={() => dispatch({ t: 'day', day: todayKey() })}><span className="vi">{vi('journal')}</span><span className="side-name">{t('ui.side.journal')}</span><span className="side-count">{dailyCount || ''}</span></button>
        <button className={'side-item' + (state.view === 'trash' ? ' on' : '')} onClick={() => dispatch({ t: 'view', view: 'trash' })}><span className="vi">{vi('trash')}</span><span className="side-name">{t('ui.side.trash')}</span><span className="side-count">{trashCount || ''}</span></button>
      </nav>
      <div className="side-label">{t('ui.side.projects')}</div>
      <nav aria-label={t('ui.side.projects')} className="side-list">
        {state.folders.map((f) => {
          const inside = live.filter((p) => p.folder === f.id);
          return (
            <div key={f.id} className="side-folder" data-folder-id={f.id}>
              <div className="folder-head">
                <button className="icon-btn small" aria-expanded={!f.collapsed} aria-label={f.collapsed ? t('ui.side.expandFolder') : t('ui.side.collapseFolder')} onClick={() => dispatch({ t: 'patchFolder', id: f.id, patch: { collapsed: !f.collapsed } })}>{f.collapsed ? '▸' : '▾'}</button>
                {renamingFolder === f.id ? (
                  <input className="side-input folder-input" aria-label={t('ui.side.folderName')} autoFocus defaultValue={f.name}
                    onBlur={(e) => { dispatch({ t: 'patchFolder', id: f.id, patch: { name: e.target.value } }); setRenamingFolder(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }} />
                ) : (
                  <button className="folder-name" title={t('ui.side.folderRename')} onClick={() => setRenamingFolder(f.id)}>{f.name}</button>
                )}
                <span className="row-actions">
                  <button className="icon-btn small" title={t('ui.side.newHere')} aria-label={t('ui.side.newHere')} onClick={() => { setAdding({ folder: f.id }); if (f.collapsed) dispatch({ t: 'patchFolder', id: f.id, patch: { collapsed: false } }); }}>+</button>
                  <button className="icon-btn small" title={t('ui.side.deleteFolder')} aria-label={t('ui.side.deleteFolder')} onClick={() => dispatch({ t: 'deleteFolder', id: f.id })}>×</button>
                </span>
              </div>
              {!f.collapsed && (
                <div className="folder-body">
                  {inside.map((p) => projectRow(p))}
                  {adding && adding.folder === f.id && newProject()}
                  {!inside.length && !(adding && adding.folder === f.id) && <p className="side-empty">{t('ui.side.folderEmpty')}</p>}
                </div>
              )}
            </div>
          );
        })}
        {live.filter((p) => !p.folder || !state.folders.some((f) => f.id === p.folder)).map((p) => projectRow(p))}
      </nav>

      {adding && adding.folder === null && newProject()}
      {addingFolder && (
        <input className="side-input" autoFocus value={folderName} placeholder={t('ui.side.folderName')} aria-label={t('ui.side.folderName')}
          onChange={(e) => setFolderName(e.target.value)}
          onBlur={createFolder}
          onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setFolderName(''); setAddingFolder(false); } }} />
      )}
      <div className="side-adds">
        <button className="side-add" onClick={() => setAdding({ folder: null })}>{t('ui.side.addProject')}</button>
        <button className="side-add" onClick={() => setAddingFolder(true)}>{t('ui.side.addFolder')}</button>
      </div>

      <TimerBadge />
      <BackupBadge />
      <div className="side-foot">
        {status.encrypted && (
          <button className="icon-btn" title={t('ui.side.lockNow')} aria-label={t('ui.side.lockNow')} onClick={() => void lock()}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          </button>
        )}
        <button className="icon-btn small" title={t('ui.side.customize')} aria-label={t('ui.side.customize')} onClick={() => setSideOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.6-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A3.7 3.7 0 0 0 21 8.6C21 5.4 17 3 12 3Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7" r="1" /></svg>
        </button>
        <button className="side-settings" onClick={() => openSettings('general')}>{t('ui.side.settings')}</button>
      </div>
      <div className="side-local" title={t('ui.side.localTitle')}>{t('ui.side.local')}</div>
    </aside>
  );
}

/** Cronómetro en marcha (en cualquier Tabla PM), con el tiempo en directo. Clic: abre la tabla. */
function TimerBadge() {
  const { state, dispatch, openPm } = useApp();
  const [, tick] = useState(0);
  let found: { card: string; title: string; row: string; col: string; start: number; ms: number } | null = null;
  for (const c of state.cards) {
    if (c.type !== 'pm' || c.trashed) continue;
    const t = runningTimer(c.pm);
    if (t) { found = { card: c.id, title: rowTitle(c.pm, t.row, state.tags), row: t.row.id, col: t.col.id, start: t.start, ms: t.ms }; break; }
  }
  const running = !!found;
  useEffect(() => {
    if (!running) return;
    const h = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(h);
  }, [running]);
  if (!found) return null;
  const f = found;
  return (
    <div className="timer-badge">
      <button className="timer-go" onClick={() => openPm(f.card)} title={t('ui.side.goTask')} aria-label={t('ui.side.goTask')}>
        <span className="rec" /> <b>{formatTimer(f.ms + Date.now() - f.start)}</b> <span className="ellipsis">{f.title}</span>
      </button>
      <button className="timer-stop" onClick={() => dispatch({ t: 'pm', card: f.card, op: { op: 'timer', row: f.row, col: f.col, action: 'stop', now: Date.now() } })}>{t('ui.side.stop')}</button>
    </div>
  );
}

/** Indicador de copias: solo aparece si hay alguna activa; abre Ajustes → Backup. */
function BackupBadge() {
  const { state, openSettings } = useApp();
  const bk = state.settings.backup;
  if (!bk.auto.on && !bk.internal.on) return null;
  const auto = { h4: t('ui.side.bkAuto.h4'), h8: t('ui.side.bkAuto.h8'), h12: t('ui.side.bkAuto.h12'), day: t('ui.side.bkAuto.day'), week: t('ui.side.bkAuto.week') }[bk.auto.every];
  const im = bk.internal.everyMin;
  const parts = [bk.auto.on && auto, bk.internal.on && (im < 60 ? t('ui.side.bkInternalMin', { n: im }) : t('ui.side.bkInternalHour', { n: im / 60 }))].filter(Boolean).join(' · ');
  return (
    <button className="side-backup" onClick={() => openSettings('backup')} title={t('ui.side.bkTitle')}>
      <b>{t('ui.side.bkActive')}</b><br />{parts}
    </button>
  );
}
