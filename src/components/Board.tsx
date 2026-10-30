import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../App';
import { errorText } from '../lib/backend';
import { t } from '../i18n';
import { arrowBetween } from '../lib/graphics';
import { readImage } from '../lib/images';
import { CARD_KIND_LABEL, DEFAULT_THEME, uid } from '../lib/model';
import type { Card, CardType, ImageCard, Link, Project } from '../lib/model';
import { BOARD_COLORS, DEFAULT_TITLE_FONT, cardVars, fontCss, normalizeFont, normalizeTheme } from '../lib/appearance';
import { BoardPanel, FontPanel } from './Appearance';
import { BoardTrash } from './Trash';
import { ColorPicker } from './ColorPicker';
import { Icon } from './Icon';
import { normalizeColorIcon } from '../lib/icons';
import { projectStats } from '../lib/agenda';
import { MAX_W, MIN_W, newCard, newWidget, snapTo } from '../lib/store';
import { CheckBody } from './cards/CheckBody';
import { ImageBody } from './cards/ImageBody';
import { PaletteBody } from './cards/PaletteBody';
import { PmBody } from './cards/PmBody';
import { TemplatePicker } from './TemplatePicker';
import { instantiate } from '../lib/pmio';
import { SketchBody } from './cards/SketchBody';
import { WidgetBody } from './cards/WidgetBody';
import { NoteBody } from './cards/NoteBody';
import { ReminderBody } from './cards/ReminderBody';
import { TableBody } from './cards/TableBody';

// Funciones (no constantes): los textos se resuelven al pintar, con el idioma actual.
const addItems = (): { type: CardType; label: string; desc: string }[] => [
  { type: 'check', label: t('ui.kind.check'), desc: t('ui.add.check.desc') },
  { type: 'reminder', label: t('ui.kind.reminder'), desc: t('ui.add.reminder.desc') },
  { type: 'note', label: t('ui.kind.note'), desc: t('ui.add.note.desc') },
  { type: 'table', label: t('ui.kind.table'), desc: t('ui.add.table.desc') },
  { type: 'pm', label: t('ui.kind.pm'), desc: t('ui.add.pm.desc') },
  { type: 'image', label: t('ui.kind.image'), desc: t('ui.add.image.desc') },
  { type: 'sketch', label: t('ui.kind.sketch'), desc: t('ui.add.sketch.desc') },
  { type: 'palette', label: t('ui.add.palette.label'), desc: t('ui.add.palette.desc') },
];
const widgetItems = (): { w: 'today' | 'upcoming' | 'projects'; label: string; desc: string }[] => [
  { w: 'today', label: t('ui.add.widget.today'), desc: t('ui.add.widget.todayDesc') },
  { w: 'upcoming', label: t('ui.add.widget.upcoming'), desc: t('ui.add.widget.upcomingDesc') },
  { w: 'projects', label: t('ui.add.widget.projects'), desc: t('ui.add.widget.projectsDesc') },
];

const LINK_COLORS: (string | null)[] = [null, '#C8372D', '#E2B65B', '#5E7A2E', '#2F6690', '#7A3E6B'];

export function Board() {
  const { state, dispatch, flashId, toast, openPm, undo, redo, canUndo, canRedo } = useApp();
  const [tplOpen, setTplOpen] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  // Alturas reales de las tarjetas (para dibujar las flechas cuando la altura es automática).
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [linking, setLinking] = useState<{ from: string; x: number; y: number; over: string | null } | null>(null);
  const [linkSel, setLinkSel] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const project = state.projects.find((p) => p.id === state.sel && !p.trashed);
  const cards = state.cards.filter((c) => c.project === state.sel && !c.trashed);
  const [renaming, setRenaming] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  if (!project) return <main className="board"><div className="empty">{t('ui.board.pickProject')}</div></main>;

  const theme = normalizeTheme(project.theme ?? DEFAULT_THEME);
  const T = BOARD_COLORS[theme.board];
  const titleFont = normalizeFont(project.titleFont ?? undefined, DEFAULT_TITLE_FONT);
  const titleCss = fontCss(titleFont, 'title', project.color);
  const rectOf = (c: Card) => ({ x: c.x, y: c.y, w: c.w, h: c.h || heights[c.id] || 200 });
  const height = cards.reduce((m, c) => Math.max(m, c.y + (c.h || heights[c.id] || 360)), 0) + 400;
  // Hueco para una tarjeta nueva: debajo de la más baja, con las alturas reales medidas.
  const spot = () => {
    if (!cards.length) return { x: 0, y: 0 };
    const bottom = cards.reduce((m, c) => Math.max(m, c.y + (c.h || heights[c.id] || 220)), 0);
    const g = state.settings.snap ? state.settings.grid : 1;
    return { x: 0, y: Math.ceil((bottom + 24) / g) * g };
  };
  const trashedHere = state.cards.filter((c) => c.project === state.sel && c.trashed);
  const stats = projectStats(state.cards, project.id);
  const width = cards.reduce((m, c) => Math.max(m, c.x + c.w), 0) + 40;

  return (
    <main
      className={'board tex-' + theme.texture + (T.dark ? ' dark' : '') + ' focus-' + state.settings.focus}
      style={{ ...cardVars(null, theme), ['--accent' as string]: project.color, ['--board-bg' as string]: T.bg, ['--board-ink' as string]: T.ink, ['--board-muted' as string]: T.muted, ['--board-line' as string]: T.line }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDrop={async (e) => {
        const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
        if (!files.length) return;
        e.preventDefault();
        const r = canvas.current?.getBoundingClientRect();
        for (const [i, f] of files.entries()) {
          try {
            const img = await readImage(f);
            const card = newCard('image', project.id) as ImageCard;
            const x = r ? Math.max(0, e.clientX - r.left - 160 + i * 30) : 0;
            const y = r ? Math.max(0, e.clientY - r.top - 40 + i * 30) : 0;
            const asset = { id: uid('asset'), card: card.id, ...img };
            dispatch({ t: 'addImage', card: { ...card, x: x || 1, y, asset: asset.id, name: f.name, title: f.name.replace(/\.[a-z0-9]+$/i, '') }, asset });
          } catch (err) { toast(errorText(err)); }
        }
      }}
      onClick={(e) => { if (linkSel && !(e.target as HTMLElement).closest('.link-menu, .link-hit, .link-mid')) setLinkSel(null); }}
    >
      <header className="board-head">
        {renaming && !project.home ? (
          <input
            className="board-title-input"
            style={titleCss}
            autoFocus
            defaultValue={project.name}
            onBlur={(e) => { dispatch({ t: 'patchProject', id: project.id, patch: { name: e.target.value.trim() || project.name } }); setRenaming(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
          />
        ) : (
          <h1 className="board-title" style={titleCss} onDoubleClick={() => setRenaming(true)} title={project.home ? undefined : t('ui.board.renameHint')}>{project.name || t('ui.common.unnamed')}</h1>
        )}
        <div className="board-progress" title={stats.total ? t('ui.common.doneOf', { done: stats.done, total: stats.total }) : t('ui.board.noTasksYet')}>
          <b>{stats.pct}%</b><div className="progress"><span style={{ width: stats.pct + '%' }} /></div>
          <span className="small muted">{stats.total ? t('ui.common.doneOf', { done: stats.done, total: stats.total }) : t('ui.board.noTasks')}</span>
        </div>
        <div className="board-actions">
          <button className="tool" aria-label={t('ui.board.titleFont')} title={t('ui.board.titleFont')} onClick={() => setFontOpen(true)}>Aa</button>
          <button className="tool" onClick={() => setThemeOpen(true)}>{t('ui.board.customize')}</button>
          {fontOpen && <FontPanel kind="title" font={titleFont} taskColor={project.color} onChange={(font) => dispatch({ t: 'setTitleFont', project: project.id, font })} onClose={() => setFontOpen(false)} />}
          {themeOpen && <BoardPanel project={project} onClose={() => setThemeOpen(false)} />}
          <button className={'tool' + (state.settings.snap ? ' on' : '')} aria-pressed={state.settings.snap} title={t('ui.board.snapTitle', { grid: state.settings.grid })}
            onClick={() => dispatch({ t: 'settings', patch: { snap: !state.settings.snap } })}>{t('ui.board.snap')}</button>
          <button className="tool" title={t('ui.board.undoTitle')} aria-label={t('ui.board.undo')} disabled={!canUndo} onClick={undo}>↶</button>
          <button className="tool" title={t('ui.board.redoTitle')} aria-label={t('ui.board.redo')} disabled={!canRedo} onClick={redo}>↷</button>
          <button className="tool" title={t('ui.board.trashTitle')} aria-label={t('ui.board.trashAria')} onClick={() => setTrashOpen(true)}>🗑{trashedHere.length > 0 && <span className="count-badge">{trashedHere.length}</span>}</button>
          <div className="menu-anchor">
            <button className="primary" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>{t('ui.board.addCard')}</button>
            {menu && (
              <div className="menu" role="menu" onMouseLeave={() => setMenu(false)}>
                {addItems().map((a) => (
                  <button key={a.type} role="menuitem" aria-label={a.label} className="menu-desc" onClick={() => { if (a.type === 'pm') setTplOpen(true); else dispatch({ t: 'addCard', card: { ...newCard(a.type, project.id), ...spot() } }); setMenu(false); }}><b>{a.label}</b><span>{a.desc}</span></button>
                ))}
                {project.home && widgetItems().map((w) => (
                  <button key={w.w} role="menuitem" aria-label={w.label} className="menu-desc" onClick={() => { dispatch({ t: 'addCard', card: { ...newWidget(project.id, w.w), ...spot() } }); setMenu(false); }}><b>{w.label}</b><span>{w.desc}</span></button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <p className="board-help small muted">{t('ui.board.help')}</p>

      {trashOpen && <BoardTrash project={project} onClose={() => setTrashOpen(false)} />}
      {cards.length === 0 ? (
        <div className="empty"><h2>{t('ui.board.emptyTitle')}</h2><p>{t('ui.board.emptyText')}</p><button className="primary" onClick={() => { dispatch({ t: 'addCard', card: { ...newCard('note', project.id), ...spot() } }); }}>{t('ui.board.addFirst')}</button></div>
      ) : (
        <div ref={canvas} className="canvas" style={{ height, width: `max(100%, ${width}px)`, ['--grid' as string]: state.settings.grid + 'px' }}>
          <Arrows project={project} cards={cards} rectOf={rectOf} sel={linkSel} setSel={setLinkSel} />
          {linking && (() => {
            const from = cards.find((c) => c.id === linking.from);
            if (!from) return null;
            const R = rectOf(from);
            const a = arrowBetween(R, { x: linking.x - 1, y: linking.y - 1, w: 2, h: 2 });
            return <svg className="arrows preview" width="100%" height={height}><path d={a.d} fill="none" stroke="var(--board-ink)" strokeWidth={2} strokeDasharray="6 5" /></svg>;
          })()}
          {cards.map((c) => (
            <CardFrame key={c.id} card={c} flash={flashId === c.id} linkTarget={!!linking && linking.over === c.id && linking.from !== c.id}
              onHeight={(h) => setHeights((m) => (m[c.id] === h ? m : { ...m, [c.id]: h }))}
              onLinkStart={(e) => {
                e.preventDefault(); e.stopPropagation();
                const r = canvas.current!.getBoundingClientRect();
                const find = (ev: PointerEvent) => (document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-card]') as HTMLElement | null)?.dataset.card ?? null;
                const move = (ev: PointerEvent) => setLinking({ from: c.id, x: ev.clientX - r.left, y: ev.clientY - r.top, over: find(ev) });
                const up = (ev: PointerEvent) => {
                  window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
                  setLinking(null);
                  const to = find(ev);
                  if (!to || to === c.id) return;
                  const exists = (project.links ?? []).some((l) => (l.from === c.id && l.to === to) || (l.from === to && l.to === c.id));
                  if (exists) { toast(t('ui.board.alreadyLinked')); return; }
                  const id = uid('link');
                  dispatch({ t: 'addLink', project: project.id, link: { id, from: c.id, to, label: '', color: null, both: false } });
                  setLinkSel(id);
                  toast(t('ui.board.arrowCreated'));
                };
                window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
              }} />
          ))}
        </div>
      )}
      {tplOpen && (
        <TemplatePicker onClose={() => setTplOpen(false)} onPick={(tpl) => {
          const base = newCard('pm', project.id);
          const card = { ...base, ...spot(), title: tpl.id === 'tpl-phases' ? t('ui.store.pmTitle') : tpl.name, pm: instantiate(tpl) } as Card;
          dispatch({ t: 'addCard', card });
          setTplOpen(false);
          openPm(card.id);
        }} />
      )}
    </main>
  );
}

type Drag = { mode: 'move' | 'resize'; dx: number; dy: number; dw: number; dh: number };

function Arrows({ project, cards, rectOf, sel, setSel }: { project: Project; cards: Card[]; rectOf: (c: Card) => { x: number; y: number; w: number; h: number }; sel: string | null; setSel: (id: string | null) => void }) {
  const { dispatch } = useApp();
  const links = (project.links ?? []).map((l) => {
    const a = cards.find((c) => c.id === l.from), b = cards.find((c) => c.id === l.to);
    return a && b ? { l, g: arrowBetween(rectOf(a), rectOf(b)) } : null;
  }).filter(Boolean) as { l: Link; g: ReturnType<typeof arrowBetween> }[];
  const cur = links.find((x) => x.l.id === sel);
  const patch = (p: Partial<Link>) => cur && dispatch({ t: 'patchLink', project: project.id, id: cur.l.id, patch: p });
  return (
    <>
      <svg className="arrows" width="100%" height="100%">
        {links.map(({ l, g }) => {
          const col = l.color ?? 'var(--arrow)';
          return (
            <g key={l.id} className={'arrow' + (sel === l.id ? ' on' : '')}>
              <path className="link-hit" d={g.d} onClick={(e) => { e.stopPropagation(); setSel(sel === l.id ? null : l.id); }} />
              <path d={g.d} fill="none" stroke={col} strokeWidth={sel === l.id ? 3 : 2} strokeLinecap="round" />
              <path d={g.headTo} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {l.both && <path d={g.headFrom} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
            </g>
          );
        })}
      </svg>
      {links.map(({ l, g }) => (l.label || sel === l.id) && (
        <button key={l.id} className="link-mid" style={{ left: g.mid.x, top: g.mid.y, borderColor: l.color ?? 'var(--arrow)' }} onClick={(e) => { e.stopPropagation(); setSel(sel === l.id ? null : l.id); }}>{l.label || '·'}</button>
      ))}
      {cur && (
        <div className="menu link-menu" style={{ left: cur.g.mid.x + 18, top: cur.g.mid.y - 16, right: 'auto' }} onClick={(e) => e.stopPropagation()}>
          <input autoFocus value={cur.l.label} placeholder={t('ui.board.arrowLabelPh')} aria-label={t('ui.board.arrowLabel')} onChange={(e) => patch({ label: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setSel(null)} />
          <div className="row">{LINK_COLORS.map((c) => <button key={String(c)} className={'swatch' + (cur.l.color === c ? ' on' : '')} style={{ background: c ?? 'var(--arrow)' }} aria-label={t('ui.board.color')} onClick={() => patch({ color: c })} />)}</div>
          <button onClick={() => patch({ both: !cur.l.both })}>{t('ui.board.arrowBoth')}{cur.l.both ? ' ✓' : ''}</button>
          <button onClick={() => patch({ from: cur.l.to, to: cur.l.from })}>{t('ui.board.arrowReverse')}</button>
          <button className="danger-text" onClick={() => { dispatch({ t: 'removeLink', project: project.id, id: cur.l.id }); setSel(null); }}>{t('ui.board.arrowDelete')}</button>
        </div>
      )}
    </>
  );
}

/** Marco de tarjeta. `fixed`: sin arrastrar ni flechas (p. ej. la nota del Diario). */
export function CardFrame({ card, flash, linkTarget = false, onHeight, onLinkStart, fixed = false }: { card: Card; flash: boolean; linkTarget?: boolean; onHeight?: (h: number) => void; onLinkStart?: (e: RPointerEvent) => void; fixed?: boolean }) {
  const { dispatch, state, toast } = useApp();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [picker, setPicker] = useState(false);
  const [big, setBig] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const theme = normalizeTheme(state.projects.find((p) => p.id === card.project)?.theme);
  const vars = cardVars(card.color, theme);
  const s = state.settings;

  useEffect(() => {
    if (flash) ref.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [flash]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onHeight || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);

  // Arrastrar y redimensionar: durante el gesto solo cambia el estado local (fluido);
  // al soltar se guarda una sola vez (un único paso en el historial).
  const start = (e: RPointerEvent, mode: Drag['mode']) => {
    if (e.button !== 0 || fixed) return;
    const t = e.target as HTMLElement;
    if (mode === 'move' && t.closest('button, input, textarea, select, label, a, .note-view, .note-rich, .tbl-wrap, .sketch-area, .image-body img, .link-dot')) return;
    e.preventDefault();
    dispatch({ t: 'raiseCard', id: card.id });
    const sx = e.clientX, sy = e.clientY;
    const h0 = card.h || ref.current?.offsetHeight || 200;
    let last: Drag = { mode, dx: 0, dy: 0, dw: 0, dh: 0 };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      last = mode === 'move' ? { mode, dx, dy, dw: 0, dh: 0 } : { mode, dx: 0, dy: 0, dw: dx, dh: dy };
      setDrag(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      if (mode === 'move' && (last.dx || last.dy)) dispatch({ t: 'moveCard', id: card.id, x: card.x + last.dx, y: card.y + last.dy });
      if (mode === 'resize' && (last.dw || last.dh)) dispatch({ t: 'resizeCard', id: card.id, w: card.w + last.dw, h: h0 + last.dh });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const live = drag
    ? drag.mode === 'move'
      ? { left: Math.max(0, snapTo(card.x + drag.dx, s)), top: Math.max(0, snapTo(card.y + drag.dy, s)), width: card.w, height: card.h || undefined }
      : { left: card.x, top: card.y, width: Math.min(MAX_W, Math.max(MIN_W, snapTo(card.w + drag.dw, s))), height: Math.max(120, snapTo((card.h || ref.current?.offsetHeight || 200) + drag.dh, s)) }
    : { left: card.x, top: card.y, width: card.w, height: card.h || undefined };

  return (
    <article
      ref={ref}
      data-card={card.id}
      className={'card ctex-' + theme.cardTexture + (fixed ? ' fixed' : ' free') + (drag ? ' dragging' : '') + (flash ? ' flash' : '') + (linkTarget ? ' link-target' : '')}
      style={fixed ? vars : { ...vars, ...live, zIndex: drag ? 9999 : card.z }}
      onPointerDown={(e) => start(e, 'move')}
    >
      <div className="card-head" onDoubleClick={() => setBig(true)}>
        <span className="grip" aria-hidden="true">⠿</span>
        <span className="card-kind">{card.type === 'note' && card.day ? t('ui.board.dayNote') : CARD_KIND_LABEL[card.type]}</span>
        <span className="grow" />
        <button className="icon-btn small color-btn" aria-label={t('ui.board.cardColor')} title={t('ui.board.cardColor')} onClick={() => setPicker(true)}>
          <Icon name={normalizeColorIcon(state.settings.colorIcon)} size={15} />
          <span className="color-dot" style={{ background: card.color ?? 'transparent' }} />
        </button>
        {picker && <ColorPicker title={t('ui.board.cardColor')} current={card.color} fallback={vars['--card-bg']} onClose={() => setPicker(false)} onPick={(hex) => { dispatch({ t: 'patchCard', id: card.id, patch: { color: hex } }); setPicker(false); }} />}
        <button className="icon-btn small" aria-label={t('ui.board.openBig')} title={t('ui.board.openBig')} onClick={() => setBig(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        </button>
        {card.h > 0 && !fixed && <button className="icon-btn small" title={t('ui.board.autoHeight')} aria-label={t('ui.board.autoHeight')} onClick={() => dispatch({ t: 'resizeCard', id: card.id, w: card.w, h: 0 })}>↕</button>}
        <button className="icon-btn small" aria-label={t('ui.board.deleteCard')} title={t('ui.board.deleteCard')} onClick={() => { dispatch({ t: 'trashCard', id: card.id }); toast(card.type === 'note' && card.day ? t('ui.board.dayNoteDeleted') : t('ui.board.cardTrashed')); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
        </button>
      </div>
      {card.type !== 'widget' && <input className="card-title" value={card.title} placeholder={t('ui.common.untitled')} onChange={(e) => dispatch({ t: 'patchCard', id: card.id, patch: { title: e.target.value } })} />}
      <div className="card-body"><CardContent card={card} /></div>
      {!fixed && <span className="link-dot right" title={t('ui.board.linkDot')} onPointerDown={onLinkStart} />}
      {!fixed && <span className="link-dot bottom" title={t('ui.board.linkDot')} onPointerDown={onLinkStart} />}
      {!fixed && <span className="resize" aria-label={t('ui.board.resize')} onPointerDown={(e) => { e.stopPropagation(); start(e, 'resize'); }} />}
      {big && <BigCard id={card.id} onClose={() => setBig(false)} />}
    </article>
  );
}

/** Contenido de una tarjeta según su tipo (el mismo en el tablero y en «Tarjeta en grande»). */
export function CardContent({ card }: { card: Card }) {
  return (
    <>
      {card.type === 'note' && <NoteBody card={card} />}
      {card.type === 'check' && <CheckBody card={card} />}
      {card.type === 'reminder' && <ReminderBody card={card} />}
      {card.type === 'table' && <TableBody card={card} />}
      {card.type === 'image' && <ImageBody card={card} />}
      {card.type === 'sketch' && <SketchBody card={card} />}
      {card.type === 'palette' && <PaletteBody card={card} />}
      {card.type === 'pm' && <PmBody card={card} />}
      {card.type === 'widget' && <WidgetBody card={card} />}
    </>
  );
}

/** Ventana «Tarjeta en grande»: la misma tarjeta, con su color y su título. */
function BigCard({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const card = state.cards.find((c) => c.id === id);
  const theme = normalizeTheme(state.projects.find((p) => p.id === card?.project)?.theme);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!card) return null;
  return createPortal(
    <div className="modal-back" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <section className="modal big-card" role="dialog" aria-label={t('ui.board.bigCard')} style={cardVars(card.color, theme)} onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <span className="card-kind">{card.type === 'note' && card.day ? t('ui.board.dayNote') : CARD_KIND_LABEL[card.type]}</span>
          <span className="grow" />
          <button className="tool small-btn" onClick={onClose}>{t('ui.board.closeEsc')}</button>
        </div>
        {card.type !== 'widget' && <input className="card-title" value={card.title} placeholder={t('ui.common.untitled')} onChange={(e) => dispatch({ t: 'patchCard', id: card.id, patch: { title: e.target.value } })} />}
        <div className="card-body"><CardContent card={card} /></div>
      </section>
    </div>,
    document.body,
  );
}
