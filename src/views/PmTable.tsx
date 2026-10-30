import { t, tn, locale, decimalSep, type Key } from '../i18n';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent, ReactNode } from 'react';
import { useApp } from '../App';
import { dayKey } from '../lib/agenda';
import type { PmCard } from '../lib/model';
import { activeViewId, allStates, COLOR_KEYS, COLORS, FILTER_OPS, formatDate, formatNum, newCol, optsOf, pmId, progress, stateInfo, tableProgress, total, TOTALS, TYPE_ICON, TYPE_LABEL, VIEW_LABEL, pmViews, visibleRows } from '../lib/pm';
import type { CellVal, Col, ColType, DateVal, Filter, NumFmt, Opt, Phase, Pm, PmOp, PmView, Row, Sort } from '../lib/pm';
import { cellFormula, cellText, colLetter, displayExpr, formatFVal, formulaText, formulaValue, rowNumber, storeExpr, toCellFormula, ROLL_FNS, rowTitle, asTimer, blockers, strList, dateColOf, defaultKanban, formatTimer, ruleFor, timerMs } from '../lib/pm';
import type { Rule } from '../lib/pm';
import { PmCalendar } from './pm/PmCalendar';
import { Timeline } from './pm/Timeline';
import { asTemplate, parseNumber, planImport, toClipboard, toCsv } from '../lib/pmio';
import type { CsvPlan } from '../lib/pmio';
import { Kanban, KanbanPicker } from './pm/Kanban';
import { ImageMenu, ImageThumbs, RelationMenu, RelPills } from './pm/Linked';
import { checkFormula, functionHelp, propsIn } from '../lib/formula';
import { FormulaErrorDialog } from '../components/FormulaErrorDialog';
import { RowPage } from './pm/RowPage';
import { allOf, GRID_MIME, inRect, isAll, parseTsv, pastePlan, rectOf, step, suggest, toTsv } from '../lib/grid';
import type { Dims, Pos, Sel } from '../lib/grid';
import { copyValue, PASTABLE, pasteValue } from '../lib/pmgrid';
import { SuggestList } from '../components/SuggestList';
import { FormatBar } from '../components/FormatBar';
import { fmtStyle } from '../lib/format';
import type { CellFmt } from '../lib/format';

type Pop =
  | { kind: 'col'; col: string; x: number; y: number }
  | { kind: 'cell'; col: string; row: string; x: number; y: number }
  | { kind: 'filter' | 'sort' | 'props' | 'addcol'; x: number; y: number }
  | { kind: 'row'; row: string; x: number; y: number }
  | { kind: 'more' | 'csv' | 'addview'; x: number; y: number }
  | { kind: 'view'; id: string; x: number; y: number }
  | { kind: 'rules'; x: number; y: number }
  | { kind: 'import'; plan: CsvPlan; name: string; x: number; y: number };

const GRIP = 44;

export function PmTable({ cardId, rowId, onClose }: { cardId: string; rowId?: string | null; onClose: () => void }) {
  const { state, dispatch, undo, redo } = useApp();
  const card = state.cards.find((c) => c.id === cardId && c.type === 'pm') as PmCard | undefined;
  const [pop, setPop] = useState<Pop | null>(null);
  const [page, setPage] = useState<string | null>(rowId ?? null);
  const [query, setQuery] = useState('');
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [pageN, setPageN] = useState(0);
  const modal = useRef<HTMLDivElement>(null);
  // Cuadrícula tipo hoja de cálculo: celda o rango elegido (por posición en lo que se ve) y celda en edición.
  const [sel, setSel] = useState<Sel | null>(null);
  const [editing, setEditing] = useState<Pos | null>(null);
  const [hint, setHint] = useState(-1);
  const pending = useRef<{ row: string; col: string; edit: boolean } | null>(null);
  const api = useRef<{ rows: Row[]; cols: Col[] }>({ rows: [], cols: [] });
  const proxy = useRef<HTMLTextAreaElement>(null);
  const down = useRef(false);
  const orig = useRef<CellVal>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (pop) setPop(null); else if (page) setPage(null); else onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [pop, page, onClose]);
  // Tras añadir una fila: seleccionar (y editar) su celda en cuanto se dibuja.
  useLayoutEffect(() => {
    const p = pending.current;
    if (!p) return;
    const r = api.current.rows.findIndex((x) => x.id === p.row), c = api.current.cols.findIndex((x) => x.id === p.col);
    if (r < 0 || c < 0) return;
    pending.current = null;
    setSel({ a: { r, c }, b: { r, c } });
    setEditing(p.edit ? { r, c } : null);
  });
  // Sin editar ni menús abiertos, el foco está en un cuadro oculto: así el teclado y copiar/cortar/pegar funcionan igual en todos los sistemas.
  useLayoutEffect(() => { if (sel && !editing && !pop) proxy.current?.focus({ preventScroll: true }); }, [sel, editing, pop]);
  useEffect(() => {
    if (!sel) return;
    (document.querySelector(`.pm-grid td[data-r="${sel.b.r}"][data-c="${sel.b.c}"]`) as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [sel]);
  useEffect(() => {
    const up = () => { down.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);
  if (!card) return null;

  const pm = card.pm;
  const tags = state.tags;
  const today = dayKey(new Date());
  const rows = visibleRows(pm, tags, today, query);
  const counted = rows.filter((r) => !r.archived);
  const view = pm.ui?.view ?? 'table';
  const kanbanBy = pm.ui?.kanban && pm.cols.some((c) => c.id === pm.ui!.kanban!.col) ? pm.ui.kanban : defaultKanban(pm);
  const archivedCount = pm.rows.filter((r) => r.archived).length;
  const pageRow = page ? pm.rows.find((r) => r.id === page) ?? null : null;
  const ruleStyle = (r: Row) => { const rule = ruleFor(pm, r, tags, today); return rule ? ({ ['--rule' as string]: COLORS[rule.color][0], ['--rule-ink' as string]: COLORS[rule.color][1] } as React.CSSProperties) : undefined; };
  void dateColOf;
  const cols = pm.cols.filter((c) => !c.hidden);
  const op = (o: PmOp) => dispatch({ t: 'pm', card: card.id, op: o });
  const pct = tableProgress(pm);
  const views = pmViews(pm);
  const activeId = activeViewId(pm);
  const taskColor = state.projects.find((p) => p.id === card.project)?.color ?? '#2F6690';
  const at = (e: { currentTarget: Element }) => {
    const r = e.currentTarget.getBoundingClientRect(), m = modal.current!.getBoundingClientRect();
    // Los menús no se salen por la derecha de la ventana (el más ancho mide unos 450 px).
    return { x: Math.max(8, Math.min(r.left - m.left, m.width - 460)), y: Math.min(r.bottom - m.top + 4, m.height - 120) };
  };
  const cellId = (row: string, col: string) => `pm-${row}-${col}`;

  const addRow = (after: string | null = null, focusCol?: string) => {
    const id = pmId('row');
    op({ op: 'addRow', id, after });
    const target = focusCol ?? cols.find((c) => c.type === 'text')?.id;
    const t = cols.find((c) => c.id === target);
    if (target) pending.current = { row: id, col: target, edit: t?.type === 'text' || t?.type === 'number' };
  };

  /** Arrastrar filas (por el asa) o columnas (por la cabecera). */
  const startDrag = (e: RPointerEvent, kind: 'row' | 'col', id: string, onClick?: (e: RPointerEvent) => void) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('input, .col-resize')) return;
    const sx = e.clientX, sy = e.clientY;
    const target = e.currentTarget;
    let moved = false;
    const find = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(kind === 'row' ? '[data-row]' : '[data-col]') as HTMLElement | null;
      return el ? (kind === 'row' ? el.dataset.row! : el.dataset.col!) : null;
    };
    // El resaltado se pone y quita directamente en el DOM, sin pasar por el estado de React: así, al arrastrar,
    // no se vuelve a dibujar la tabla entera en cada movimiento del ratón (era lo que la hacía ir a tirones).
    // Mientras se arrastra no se selecciona texto, y una etiqueta con el nombre acompaña al ratón.
    const srcRow = kind === 'row' ? rows.find((r) => r.id === id) : undefined;
    const label = kind === 'col' ? (pm.cols.find((c) => c.id === id)?.name || t('pm.column')) : (srcRow ? rowTitle(pm, srcRow, tags) || t('pm.kind.row') : t('pm.kind.row'));
    let ghost: HTMLElement | null = null;
    const grab = () => {
      document.body.classList.add('pm-grabbing');
      window.getSelection()?.removeAllRanges();
      ghost = document.createElement('div');
      ghost.className = 'pm-ghost';
      ghost.textContent = label;
      document.body.appendChild(ghost);
    };
    const release = () => { document.body.classList.remove('pm-grabbing'); ghost?.remove(); ghost = null; };
    const mark = (cls: string, el: Element | null, on: boolean) => { if (el) el.classList.toggle(cls, on); };
    const elOf = (cid: string) => document.querySelector(kind === 'row' ? `tr[data-row="${cid}"]` : `th[data-col="${cid}"]`);
    let over: string | null = null, last: PointerEvent | null = null, frame = 0;
    const step = () => {
      frame = 0;
      if (!last) return;
      const now = find(last);
      if (now === over) return;
      mark('drop', over ? elOf(over) : null, false);
      over = now;
      mark('drop', over && over !== id ? elOf(over) : null, true);
    };
    const mv = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return;
      if (!moved) { moved = true; grab(); mark('dragging', elOf(id), true); }
      if (ghost) { ghost.style.left = ev.clientX + 12 + 'px'; ghost.style.top = ev.clientY + 8 + 'px'; }
      last = ev;
      if (!frame) frame = requestAnimationFrame(step);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      if (frame) cancelAnimationFrame(frame);
      release();
      mark('drop', over ? elOf(over) : null, false);
      mark('dragging', elOf(id), false);
      if (!moved) { onClick?.({ ...e, currentTarget: target } as RPointerEvent); return; }
      const target2 = find(ev);
      if (!target2 || target2 === id) return;
      if (kind === 'row') {
        if (pm.sorts.length) return;
        const list = pm.rows.map((r) => r.id);
        const before = list.indexOf(id) < list.indexOf(target2) ? list[list.indexOf(target2) + 1] ?? null : over;
        op({ op: 'moveRow', id, before });
      } else {
        const list = pm.cols.map((c) => c.id);
        const before = list.indexOf(id) < list.indexOf(target2) ? list[list.indexOf(target2) + 1] ?? null : over;
        op({ op: 'moveCol', id, before });
      }
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };
  const startResize = (e: RPointerEvent, col: Col) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, w0 = col.w;
    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement;
    let w = w0;
    const mv = (ev: PointerEvent) => { w = Math.max(80, Math.min(600, w0 + ev.clientX - sx)); th.style.width = w + 'px'; th.style.minWidth = w + 'px'; };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (w !== w0) op({ op: 'patchCol', id: col.id, patch: { w } }); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };

  const PAGE = 100;
  const groupCol = pm.group ? pm.cols.find((c) => c.id === pm.group) ?? null : null;
  const groupOf = (r: Row) => (groupCol ? cellText(pm, groupCol, r, tags) || t('pm.group.none') : '');
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows = rows.slice(Math.min(pageN, pages - 1) * PAGE, Math.min(pageN, pages - 1) * PAGE + PAGE);
  // ---- Cuadrícula tipo Excel (mejora 1.1.0, fase 3b) ----
  const gridRows = pageRows.filter((r) => !groupCol || !folded.has(groupOf(r)));
  api.current = { rows: gridRows, cols };
  const dims: Dims = { minRow: 0, rows: gridRows.length, cols: cols.length };
  const POPUP = new Set<ColType>(['select', 'multi', 'status', 'date', 'relation', 'image']);
  const tdAt = (r: number, c: number) => document.querySelector(`.pm-grid td[data-r="${r}"][data-c="${c}"]`) as HTMLElement | null;
  const matrix = (s: Sel) => { const rc = rectOf(s); const m: string[][] = []; for (let r = rc.r0; r <= rc.r1; r++) { const line: string[] = []; for (let c = rc.c0; c <= rc.c1; c++) line.push(gridRows[r] && cols[c] ? copyValue(pm, cols[c], gridRows[r], tags) : ''); m.push(line); } return m; };
  /** Copiar: si se eligió toda la tabla, la primera línea son los nombres de las columnas (se pegan en otra tabla como cabeceras). */
  const putClip = (dt: DataTransfer | null, s: Sel) => {
    if (!dt) return;
    const full = isAll(s, dims);
    const m = matrix(s);
    if (full) m.unshift(cols.map((c) => c.name));
    dt.setData('text/plain', toTsv(m));
    if (full) dt.setData(GRID_MIME, 'header');
  };
  const setCell = (row: string, col: string, value: CellVal) => op({ op: 'cell', row, col, value });
  const select = (a: Pos, b: Pos = a) => setSel({ a, b });
  const openCell = (pos: Pos) => { const c = cols[pos.c], r = gridRows[pos.r], td = tdAt(pos.r, pos.c); if (c && r && td) setPop({ kind: 'cell', col: c.id, row: r.id, ...at({ currentTarget: td }) }); };
  /** Editar la celda: texto y números en la propia celda; selección, fecha, relación… abren su menú; la casilla se marca. */
  const startEdit = (pos: Pos, seed?: string) => {
    const c = cols[pos.c], r = gridRows[pos.r];
    if (!c || !r) return;
    select(pos); setHint(-1);
    if (c.type === 'text' || c.type === 'number') {
      orig.current = r.cells[c.id] ?? null;
      if (seed !== undefined) {
        if (c.type === 'text') setCell(r.id, c.id, seed);
        else if (seed === '=') setCell(r.id, c.id, '=');
        else if (/^\d$/.test(seed)) setCell(r.id, c.id, Number(seed));
        else return; // un número no admite esa letra
      }
      setEditing(pos);
    } else if (POPUP.has(c.type)) { if (seed === undefined) openCell(pos); }
    else if (c.type === 'checkbox' && (seed === undefined || seed === ' ')) setCell(r.id, c.id, !r.cells[c.id]);
  };
  const stopEdit = (cancel = false) => {
    if (cancel && editing) { const c = cols[editing.c], r = gridRows[editing.r]; if (c && r) setCell(r.id, c.id, orig.current); }
    setEditing(null); setHint(-1);
  };
  const EMPTY: Partial<Record<ColType, CellVal>> = { text: '', number: null, select: null, multi: [], status: null, checkbox: false, date: null };
  const clearSel = (s: Sel) => {
    const rc = rectOf(s);
    const ops: PmOp[] = [];
    for (let r = rc.r0; r <= rc.r1; r++) for (let c = rc.c0; c <= rc.c1; c++) { const col = cols[c], row = gridRows[r]; if (col && row && PASTABLE.has(col.type)) ops.push({ op: 'cell', row: row.id, col: col.id, value: EMPTY[col.type] ?? null }); }
    if (ops.length) op({ op: 'batch', ops });
  };
  const pasteText = (s: Sel, text: string, header = false) => {
    let data = parseTsv(text);
    // Una tabla copiada entera trae sus cabeceras en la primera línea: dan nombre a las columnas nuevas y no se pegan como datos.
    const heads = header && data.length ? data[0] : null;
    if (heads) data = data.slice(1);
    if (!data.length) return;
    const plan = pastePlan(s, data);
    const width = Math.max(...plan.data.map((l) => l.length));
    const ops: PmOp[] = [];
    // Más columnas copiadas que columnas en la tabla: se crean las que faltan (de número si todo lo pegado son números).
    const made: Col[] = [];
    for (let j = cols.length - plan.at.c; j < width; j++) {
      const vals = plan.data.map((l) => (l[j] ?? '').trim()).filter(Boolean);
      const col = newCol(vals.length && vals.every((v) => parseNumber(v) !== null) ? 'number' : 'text', pm);
      col.name = (heads?.[j]?.trim() || t('pm.col.new', { n: pm.cols.length + made.length + 1 }));
      made.push(col);
      ops.push({ op: 'addCol', col });
    }
    const allCols = [...cols, ...made];
    let added = 0;
    plan.data.forEach((line, i) => {
      const ri = plan.at.r + i;
      const row = gridRows[ri];
      const fresh: Record<string, CellVal> = {};
      line.forEach((raw, j) => {
        const col = allCols[plan.at.c + j];
        if (!col) return;
        const pv = pasteValue(col, raw, tags, pm);
        if (!pv) return;
        if (row) ops.push({ op: 'cell', row: row.id, col: col.id, value: pv.value });
        else if (raw.trim() !== '') fresh[col.id] = pv.value;
      });
      // Más filas copiadas que filas en la tabla: se añaden al final, como en Excel.
      if (!row && Object.keys(fresh).length) { ops.push({ op: 'addRow', id: pmId('row'), cells: fresh }); added++; }
    });
    if (!ops.length) return;
    op({ op: 'batch', ops });
    select({ r: plan.at.r, c: plan.at.c }, { r: Math.min(plan.at.r + plan.data.length - 1, gridRows.length - 1 + added), c: plan.at.c + width - 1 });
  };
  /** Enter (abajo) o Tab (derecha): confirma y pasa a la celda vecina; al pasar de la última fila crea otra. */
  const moveFrom = (p: Pos, dr: number, dc: number, grow: boolean) => {
    if (grow && dr > 0 && p.r === gridRows.length - 1 && gridRows[p.r] && cols[p.c]) { addRow(gridRows[p.r].id, cols[p.c].id); return; }
    select({ r: Math.max(0, Math.min(gridRows.length - 1, p.r + dr)), c: Math.max(0, Math.min(cols.length - 1, p.c + dc)) });
  };
  const onProxyKey = (e: React.KeyboardEvent) => {
    if (!sel) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key;
    if (mod && !e.altKey && k.toLowerCase() === 'a') { e.preventDefault(); setSel(allOf(dims)); return; }
    if (mod && !e.altKey && k.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && !e.altKey && k.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && !e.altKey && 'cxv'.includes(k.toLowerCase())) return; // lo hace el portapapeles
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      const to = step(e.shiftKey ? sel.b : sel.a, k, dims, mod);
      setSel(e.shiftKey ? { a: sel.a, b: to } : { a: to, b: to });
      return;
    }
    if (k === 'Tab') { e.preventDefault(); moveFrom(sel.a, 0, e.shiftKey ? -1 : 1, false); return; }
    if (k === 'Enter') { e.preventDefault(); moveFrom(sel.a, e.shiftKey ? -1 : 1, 0, true); return; }
    if (k === 'F2') { e.preventDefault(); startEdit(sel.a); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); clearSel(sel); return; }
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); setSel(null); return; }
    if (k.length === 1 && ((!e.ctrlKey && !e.metaKey) || (e.ctrlKey && e.altKey))) { e.preventDefault(); startEdit(sel.a, k); }
  };
  // Autocompletado de las columnas de texto: palabras de esa misma columna.
  const editCol = editing ? cols[editing.c] : undefined;
  const editRow = editing ? gridRows[editing.r] : undefined;
  const typed = editCol && editRow && editCol.type === 'text' && typeof editRow.cells[editCol.id] === 'string' ? (editRow.cells[editCol.id] as string) : '';
  const sugg = editCol?.type === 'text' && editRow ? suggest(typed, pm.rows.filter((x) => x.id !== editRow.id).map((x) => (typeof x.cells[editCol.id] === 'string' ? (x.cells[editCol.id] as string) : ''))) : [];
  const editKey = (e: React.KeyboardEvent, pos: Pos) => {
    e.stopPropagation();
    const k = e.key;
    const chosen = hint >= 0 ? sugg[hint] : undefined;
    const done = () => { if (chosen !== undefined && editCol && editRow) setCell(editRow.id, editCol.id, chosen); setEditing(null); setHint(-1); };
    if (k === 'Escape') { e.preventDefault(); stopEdit(true); return; }
    if (k === 'Enter') { e.preventDefault(); done(); moveFrom(pos, e.shiftKey ? -1 : 1, 0, true); return; }
    if (k === 'Tab') { e.preventDefault(); done(); moveFrom(pos, 0, e.shiftKey ? -1 : 1, false); return; }
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      if (sugg.length && (k === 'ArrowDown' || hint >= 0)) { setHint(Math.max(-1, Math.min(sugg.length - 1, hint + (k === 'ArrowDown' ? 1 : -1)))); return; }
      stopEdit(); moveFrom(pos, k === 'ArrowDown' ? 1 : -1, 0, false);
    }
  };
  const cellDown = (e: React.MouseEvent, pos: Pos) => {
    if (e.button !== 0) return;
    const t = e.target as Element;
    if (t.closest('button:not(.pm-btn), select, .pm-check')) return;
    if (editing && editing.r === pos.r && editing.c === pos.c && t.closest('input')) return; // el cursor dentro de la celda que se edita
    if (editing) stopEdit();
    e.preventDefault();
    down.current = true;
    if (e.shiftKey && sel) setSel({ a: sel.a, b: pos }); else select(pos);
    proxy.current?.focus({ preventScroll: true });
  };
  const selRect = sel ? rectOf(sel) : null;

  const rowEl = (r: Row, ri: number, gi: number) => (
                <tr key={r.id} data-row={r.id} style={ruleStyle(r)} className={(ruleFor(pm, r, tags, today) ? 'ruled ' : '') + (ruleFor(pm, r, tags, today)?.bold ? 'rule-bold ' : '') + (r.archived ? ' archived' : '') + (page === r.id ? ' paged' : '')}>
                  <td className="pm-grip" title={t('pm.table.gripTip')} onPointerDown={(e) => startDrag(e, 'row', r.id, (ev) => setPop({ kind: 'row', row: r.id, ...at(ev) }))}>
                    <span className="small muted" title={t('pm.table.rowNumTip')}>{rowNumber(pm, r.id) || ri + 1}</span><span className="grip-dots">⠿</span>
                  </td>
                  {cols.map((c, k) => (
                    <td key={c.id} data-r={gi} data-c={k} role="gridcell" aria-selected={!!(selRect && inRect(selRect, gi, k))}
                      className={(k === 0 ? 'sticky' : '') + (selRect && inRect(selRect, gi, k) ? ' sel' : '') + (sel && sel.a.r === gi && sel.a.c === k ? ' cur' : '')} style={{ left: k === 0 ? GRIP : undefined }}
                      onMouseDown={(e) => cellDown(e, { r: gi, c: k })} onMouseEnter={() => { if (down.current && sel) setSel({ a: sel.a, b: { r: gi, c: k } }); }}
                      onDoubleClick={(e) => { if (!(e.target as Element).closest('button:not(.pm-btn), select, .pm-check')) startEdit({ r: gi, c: k }); }}>
                      {k === 0 && (() => { const bl = blockers(pm, r).length > 0; return <button className={'open-page' + (bl ? ' blocked' : '')} title={bl ? t('pm.table.blockedOpen') : t('pm.table.openRowPage')} aria-label={t('pm.table.openPage')} onClick={() => setPage(r.id)}>{bl ? '⛔' : '↗'}</button>; })()}
                      <Cell pm={pm} col={c} row={r} tags={tags} id={cellId(r.id, c.id)} set={(v) => op({ op: 'cell', row: r.id, col: c.id, value: v })} grid fmt={r.fmt?.[c.id]} editing={editing?.r === gi && editing.c === k} onKey={(e) => editKey(e, { r: gi, c: k })} timer={(a) => op({ op: 'timer', row: r.id, col: c.id, action: a, now: Date.now() })}
                        open={() => undefined} />
                    </td>
                  ))}
                </tr>
  );

  const nFilters = pm.filters.length, nSorts = pm.sorts.length;

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section ref={modal} className="pm-modal" style={{ ['--task' as string]: taskColor }} role="dialog" aria-label={t('pm.table.dialog', { title: card.title || t('pm.untitled') })} onMouseDown={(e) => { if (pop && !(e.target as HTMLElement).closest('.pm-pop, [data-pop]')) setPop(null); }}>
        <header className="pm-head">
          <input className="pm-title" value={card.title} placeholder={t('pm.untitled')} aria-label={t('pm.table.titleLabel')} onChange={(e) => dispatch({ t: 'patchCard', id: card.id, patch: { title: e.target.value } })} />
          {pct !== null && <div className="pm-pct"><div className="progress"><span style={{ width: pct + '%' }} /></div><b>{pct}%</b></div>}
          <input className="pm-search" type="search" value={query} placeholder={t('pm.table.searchPlaceholder')} aria-label={t('pm.table.search')} onChange={(e) => { setQuery(e.target.value); setPageN(0); }} />
          <button data-pop className="tool" aria-label={t('pm.table.options')} title={t('pm.table.options')} onClick={(e) => setPop({ kind: 'more', ...at(e) })}>{t('pm.table.optionsBtn')}</button>
          <button className="icon-btn" aria-label={t('pm.table.close')} title={t('pm.table.closeTip')} onClick={onClose}>✕</button>
        </header>
        <div className="pm-tabs" role="tablist">
          {views.map((v) => (
            <div key={v.id} className={'pm-tab' + (v.id === activeId ? ' on' : '')} draggable
              onDragStart={(e) => e.dataTransfer.setData('text/pm-view', v.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData('text/pm-view'); if (id && id !== v.id) { const i = views.findIndex((x) => x.id === id), j = views.findIndex((x) => x.id === v.id); op({ op: 'viewMove', id, before: i < j ? views[j + 1]?.id ?? null : v.id }); } }}>
              <button role="tab" aria-selected={v.id === activeId} onClick={() => op({ op: 'viewSelect', id: v.id })} onDoubleClick={(e) => setPop({ kind: 'view', id: v.id, ...at(e) })}>{v.name}</button>
              <button data-pop className="tab-more" aria-label={t('pm.view.menuOf', { name: v.name })} onClick={(e) => setPop({ kind: 'view', id: v.id, ...at(e) })}>▾</button>
            </div>
          ))}
          <button data-pop className="pm-tab-add" aria-label={t('pm.view.add')} title={t('pm.view.add')} onClick={(e) => setPop({ kind: 'addview', ...at(e) })}>+</button>
        </div>
        <div className="pm-toolbar">
          {view === 'kanban' && <KanbanPicker pm={pm} by={kanbanBy} onChange={(b) => op({ op: 'ui', patch: { kanban: b } })} />}
          <button data-pop className={'tool' + (nFilters ? ' on' : '')} onClick={(e) => setPop({ kind: 'filter', ...at(e) })}>{nFilters ? t('pm.toolbar.filtersN', { n: nFilters }) : t('pm.toolbar.filters')}</button>
          <button data-pop className={'tool' + (nSorts || pm.group ? ' on' : '')} onClick={(e) => setPop({ kind: 'sort', ...at(e) })}>{nSorts + (pm.group ? 1 : 0) ? t('pm.toolbar.sortN', { n: nSorts + (pm.group ? 1 : 0) }) : t('pm.toolbar.sort')}</button>
          <span className="grow small muted">{(() => { const base = pm.ui?.showArchived ? pm.rows.length : pm.rows.length - archivedCount; const n = (x: number) => tn('pm.rows', x); return rows.length === base ? n(base) : t('pm.rowsOf', { n: rows.length, total: n(base) }); })()}</span>
          {view === 'table' && (() => {
            // El formato se aplica a las celdas elegidas que muestran texto (texto, número, fórmula y resumen).
            const FMT_TYPES = new Set<ColType>(['text', 'number', 'formula', 'rollup']);
            const cells: { row: string; col: string }[] = [];
            if (selRect) for (let r = selRect.r0; r <= selRect.r1; r++) for (let c = selRect.c0; c <= selRect.c1; c++) { const row = gridRows[r], col = cols[c]; if (row && col && FMT_TYPES.has(col.type)) cells.push({ row: row.id, col: col.id }); }
            const fmts = cells.map((x) => pm.rows.find((r) => r.id === x.row)?.fmt?.[x.col]);
            return <FormatBar fmts={fmts} align disabled={!cells.length} label={t('pm.toolbar.cellFormat')} onPatch={(patch) => op({ op: 'format', cells, patch })} onAfter={() => proxy.current?.focus({ preventScroll: true })} />;
          })()}
          <button className={'tool' + (pm.ui?.showArchived ? ' on' : '')} aria-pressed={!!pm.ui?.showArchived} onClick={() => op({ op: 'ui', patch: { showArchived: !pm.ui?.showArchived } })}>{t('pm.toolbar.archived', { n: archivedCount })}</button>
          <button data-pop className="tool" onClick={(e) => setPop({ kind: 'addcol', ...at(e) })}>{t('pm.toolbar.newCol')}</button>
          <button className="primary" onClick={() => addRow(null)}>{t('pm.toolbar.newRow')}</button>
        </div>
        <div className="pm-body">
        {view === 'gallery' ? (
          <div className="pm-scroll"><Gallery pm={pm} rows={rows} tags={tags} op={op} onOpen={setPage} today={today} /></div>
        ) : view === 'timeline' ? (
          <Timeline pm={pm} rows={rows} tags={tags} op={op} onOpen={setPage} today={today} />
        ) : view === 'calendar' ? (
          <div className="pm-scroll"><PmCalendar pm={pm} rows={rows} tags={tags} op={op} onOpen={setPage} today={today} /></div>
        ) : view === 'kanban' && kanbanBy ? (
          <div className="pm-scroll"><Kanban pm={pm} rows={rows} by={kanbanBy} tags={tags} op={op} onOpen={setPage}
            onAdd={(value, colId) => { const id = pmId('row'); op({ op: 'addRow', id, cells: { [colId]: value as CellVal } }); setPage(id); }} /></div>
        ) : (
        <div className="pm-scroll">
          <table className="pm-grid">
            <thead>
              <tr>
                <th className="pm-grip-h" style={{ width: GRIP, minWidth: GRIP }} title={t('pm.table.firstRow')}><span className="small muted">1</span></th>
                {cols.map((c, k) => {
                  const sort = pm.sorts.find((s) => s.col === c.id);
                  return (
                    <th key={c.id} data-col={c.id} data-letter={colLetter(pm.cols.indexOf(c))} className={(k === 0 ? 'sticky ' : '')} style={{ width: c.w, minWidth: c.w, left: k === 0 ? GRIP : undefined }}
                      onPointerDown={(e) => startDrag(e, 'col', c.id, (ev) => setPop({ kind: 'col', col: c.id, ...at(ev) }))}>
                      <span className="th-in" data-pop><span className="th-icon">{TYPE_ICON[c.type]}</span><span className="grow ellipsis">{c.name || t('pm.unnamed')}</span>{sort && <span className="small">{sort.dir === 'asc' ? '↑' : '↓'}</span>}<span className="small muted">▾</span></span>
                      <span className="col-resize" onPointerDown={(e) => startResize(e, c)} aria-hidden="true" />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const out: ReactNode[] = [];
                let last: string | null = null;
                const start = pageN * PAGE;
                pageRows.forEach((r, k) => {
                  if (groupCol) {
                    const g = groupOf(r);
                    if (g !== last) {
                      last = g;
                      const n = rows.filter((x) => groupOf(x) === g).length;
                      out.push(<tr key={'g-' + g} className="pm-group"><td colSpan={cols.length + 1}><button className="link" aria-expanded={!folded.has(g)} onClick={() => setFolded((f) => { const nx = new Set(f); if (nx.has(g)) nx.delete(g); else nx.add(g); return nx; })}>{folded.has(g) ? '▸' : '▾'} {g} <span className="muted">· {n}</span></button></td></tr>);
                    }
                    if (folded.has(g)) return;
                  }
                  out.push(rowEl(r, start + k, gridRows.indexOf(r)));
                });
                return out;
              })()}
              {!rows.length && <tr><td colSpan={cols.length + 1} className="pm-empty">{pm.rows.length ? t('pm.table.noMatch') : t('pm.table.empty')}</td></tr>}
            </tbody>
            <tfoot>
              <tr>
                <td className="pm-grip-h small muted">{t('pm.table.total')}</td>
                {cols.map((c, k) => (
                  <td key={c.id} className={k === 0 ? 'sticky' : ''} style={{ left: k === 0 ? GRIP : undefined }}>
                    <div className="pm-total-cell">
                      {c.total ? <><span className="pm-total-fn">{TOTALS[c.type].find(([v]) => v === c.total)?.[1]}</span><b>{total(pm, c, counted, tags, today)}</b></> : <span className="pm-total-fn hint">{t('pm.table.compute')}</span>}
                      <select className="pm-total" value={c.total ?? ''} aria-label={t('pm.table.totalOf', { name: c.name })} onChange={(e) => op({ op: 'patchCol', id: c.id, patch: { total: e.target.value as Col['total'] } })}>
                        {TOTALS[c.type].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          <textarea ref={proxy} className="grid-proxy" tabIndex={-1} aria-label={t('pm.table.proxy')} onKeyDown={onProxyKey}
            onChange={(e) => { e.currentTarget.value = ''; }}
            onCopy={(e) => { if (!sel) return; e.preventDefault(); putClip(e.clipboardData, sel); }}
            onCut={(e) => { if (!sel) return; e.preventDefault(); putClip(e.clipboardData, sel); clearSel(sel); }}
            onPaste={(e) => { if (!sel) return; const text = e.clipboardData?.getData('text/plain') ?? ''; if (!text) return; e.preventDefault(); pasteText(sel, text, e.clipboardData?.getData(GRID_MIME) === 'header'); }} />
          {editing && editCol && editRow && <SuggestList anchor={document.getElementById(cellId(editRow.id, editCol.id))} items={sugg} hint={hint} watch={typed}
            onPick={(v) => { setCell(editRow.id, editCol.id, v); setHint(-1); document.getElementById(cellId(editRow.id, editCol.id))?.focus(); }} />}
          {pages > 1 && <div className="row pm-pages"><button className="tool small-btn" disabled={pageN === 0} onClick={() => setPageN(pageN - 1)}>{t('pm.table.prev')}</button><span className="small muted">{t('pm.table.rowRange', { from: pageN * PAGE + 1, to: Math.min(rows.length, pageN * PAGE + PAGE), total: rows.length })}</span><button className="tool small-btn" disabled={pageN >= pages - 1} onClick={() => setPageN(pageN + 1)}>{t('pm.table.next')}</button></div>}
        </div>
        )}
        {pageRow && (
          <RowPage cardId={card.id} pm={pm} row={pageRow} tags={tags} op={op} onClose={() => setPage(null)} onOpenRow={setPage}
            cell={(c) => <Cell pm={pm} col={c} row={pageRow} tags={tags} id={'page-' + c.id} set={(v) => op({ op: 'cell', row: pageRow.id, col: c.id, value: v })} onKey={() => undefined} timer={(a) => op({ op: 'timer', row: pageRow.id, col: c.id, action: a, now: Date.now() })}
              open={(e) => setPop({ kind: 'cell', col: c.id, row: pageRow.id, ...at(e) })} />} />
        )}
        </div>
        {pop && <Popover closeTable={onClose} pop={pop} pm={pm} card={card} close={() => setPop(null)} op={op} rows={rows} archived={archivedCount} openImport={(plan, name) => setPop({ kind: 'import', plan, name, x: 0, y: 0 })} openPage={(id) => { setPage(id); setPop(null); }} openPop={(k, id) => { const x = pop.kind === 'more' ? Math.max(8, (modal.current?.getBoundingClientRect().width ?? 800) - 460) : (pop as { x: number }).x; const y = (pop as { y: number }).y; setPop(k === 'col' ? { kind: 'col', col: id!, x, y } : { kind: k, x, y }); }} />}
      </section>
    </div>
  );
}

function Pills({ list }: { list: { name: string; color: string }[] }) {
  return <>{list.map((o, i) => { const [bg, fg] = COLORS[o.color] ?? COLORS.gray; return <span key={i} className="pill" style={{ background: bg, color: fg }}>{o.name}</span>; })}</>;
}

/** Tipos de columna que ya no se ofrecen: las fórmulas se escriben en la celda («=SUMA(A2:A9)»). Las columnas que ya existían siguen funcionando. */
const RETIRED = new Set<ColType>(['formula', 'rollup']);
const caretEnd = (e: React.FocusEvent<HTMLInputElement>) => { const n = e.currentTarget.value.length; e.currentTarget.setSelectionRange(n, n); };

/**
 * Una celda. En la cuadrícula (`grid`) se ve como texto y solo se convierte en cuadro de texto al editarla;
 * los menús (selección, fecha, relación…) se abren con doble clic o F2. Fuera de la cuadrícula (página de fila) se edita directamente.
 */
function Cell({ pm, col, row, tags, id, set, onKey, open, timer = () => undefined, grid = false, editing = false, fmt }: { pm: Pm; col: Col; row: Row; tags: Opt[]; id: string; set: (v: CellVal) => void; onKey: (e: React.KeyboardEvent) => void; open: (e: React.MouseEvent) => void; timer?: (a: 'start' | 'stop' | 'reset') => void; grid?: boolean; editing?: boolean; fmt?: CellFmt }) {
  const v = row.cells[col.id];
  const fs = fmtStyle(fmt);
  // Botones de menú: en la cuadrícula solo se seleccionan (el menú se abre con doble clic).
  const btn = grid ? { tabIndex: -1 } : { 'data-pop': true, onClick: open, onKeyDown: onKey };
  switch (col.type) {
    case 'text': {
      const cf = cellFormula(pm, col, row, tags);
      if (grid && !editing) {
        if (cf?.error) return <FormulaErr pm={pm} col={col} row={row} error={cf.error} formula={formulaText(pm, v as string)} />;
        return <div id={id} className="pm-in pm-view" style={fs} aria-label={col.name} title={cf ? formulaText(pm, v as string) : undefined}>{cf ? formatFVal(col, cf.value) : typeof v === 'string' ? v : ''}</div>;
      }
      return <TextInput id={id} pm={pm} col={col} v={v} set={set} onKey={onKey} auto={grid} style={fs} />;
    }
    case 'number': {
      const cf = cellFormula(pm, col, row, tags);
      if (grid && !editing) {
        if (cf?.error) return <FormulaErr pm={pm} col={col} row={row} error={cf.error} formula={formulaText(pm, v as string)} num />;
        const shown = cf ? formatFVal(col, cf.value) : typeof v === 'number' ? formatNum(col, v) : '';
        return <div id={id} className="pm-in num pm-view" style={fs} aria-label={col.name} title={cf ? formulaText(pm, v as string) : shown}>{shown}</div>;
      }
      return <NumberCell id={id} pm={pm} col={col} v={typeof v === 'number' || typeof v === 'string' ? v : null} display={cf ? (cf.error ? t('pm.cell.error') : formatFVal(col, cf.value)) : undefined} set={set} onKey={onKey} auto={grid} style={fs} />;
    }
    case 'formula': {
      return <FormulaCell pm={pm} col={col} row={row} tags={tags} style={fs} />;
    }
    case 'rollup':
      return <span className="pm-formula num" style={fs}>{cellText(pm, col, row, tags)}</span>;
    case 'relation':
      return <button id={id} className="pm-btn" {...btn} aria-label={col.name}><RelPills v={v} /></button>;
    case 'image':
      return <button id={id} className="pm-btn" {...btn} aria-label={col.name}><ImageThumbs v={v} /></button>;
    case 'timer':
      return <TimerCell id={id} col={col} v={v} onAction={(a) => timer(a)} />;
    case 'checkbox':
      return <label className="pm-check"><input id={id} type="checkbox" checked={!!v} onChange={() => set(!v)} onKeyDown={onKey} aria-label={col.name} /></label>;
    case 'progress': {
      const p = progress(pm, col, row);
      return <div className="pm-prog"><div className="progress"><span style={{ width: p + '%', background: p >= 100 ? '#2F7D4F' : undefined }} /></div><span className="small">{p}%</span></div>;
    }
    case 'date': {
      const d = v && typeof v === 'object' && !Array.isArray(v) ? (v as DateVal) : null;
      return <button id={id} className="pm-btn" {...btn} aria-label={col.name}>{d?.start ? formatDate(d) : <span className="muted">—</span>}</button>;
    }
    default: {
      let list: { name: string; color: string }[] = [];
      if (col.type === 'status') { const si = stateInfo(col, v); if (si) list = [{ name: si.st.name, color: si.ph.color }]; }
      else { const opts = optsOf(col, tags); const ids = col.type === 'multi' ? (Array.isArray(v) ? v : []) : typeof v === 'string' ? [v] : []; list = ids.map((x) => opts.find((o) => o.id === x)).filter((o): o is Opt => !!o); }
      return <button id={id} className="pm-btn" {...btn} aria-label={col.name}>{list.length ? <Pills list={list} /> : <span className="muted">—</span>}</button>;
    }
  }
}

function NumberCell({ id, pm, col, v, display, set, onKey, auto = false, style }: { style?: React.CSSProperties; id: string; pm: Pm; col: Col; v: number | string | null; display?: string; set: (v: CellVal) => void; onKey: (e: React.KeyboardEvent) => void; auto?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const isF = typeof v === 'string' && v.startsWith('=');
  const plain = typeof v === 'number' ? v : null;
  return (
    <input id={id} className="pm-in num" style={style} inputMode={isF || text?.startsWith('=') ? 'text' : 'decimal'} aria-label={col.name}
      value={text ?? (isF ? display ?? '' : plain === null ? '' : formatNum(col, plain))}
      placeholder={col.fmt === 'eur' ? '€' : col.fmt === 'h' ? 'h' : ''}
      title={isF ? formulaText(pm, v as string) : plain === null ? '' : formatNum(col, plain)}
      autoFocus={auto}
      onFocus={(e) => { setText(isF ? formulaText(pm, v as string) : plain === null ? '' : String(plain).replace('.', decimalSep())); if (auto) { const el = e.currentTarget; window.setTimeout(() => el.setSelectionRange(el.value.length, el.value.length), 0); } }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        // Un texto que empieza por «=» es una fórmula: se guarda por identidad de filas y columnas.
        if (t.startsWith('=')) { set(toCellFormula(pm, t)); return; }
        const n = parseFloat(t.replace(/\s/g, '').replace(',', '.'));
        set(t.trim() === '' || isNaN(n) ? null : n);
      }}
      onBlur={() => setText(null)}
      onKeyDown={onKey} />
  );
}

/** Texto de una celda de texto (las fórmulas «=» solo existen en las columnas de número). */
function TextInput({ id, col, v, set, onKey, auto, style }: { id: string; pm?: Pm; col: Col; v: CellVal | undefined; set: (v: CellVal) => void; onKey: (e: React.KeyboardEvent) => void; auto: boolean; style?: React.CSSProperties }) {
  return (
    <input id={id} className="pm-in" value={typeof v === 'string' ? v : ''}
      onChange={(e) => set(e.target.value)}
      onKeyDown={onKey} aria-label={col.name} autoFocus={auto} onFocus={auto ? caretEnd : undefined} style={style} />
  );
}

/** «⚠ Error» de una celda con fórmula: un clic abre la ventana que lo explica. */
function FormulaErr({ pm, col, row, error, formula, num }: { pm: Pm; col: Col; row: Row; error: string; formula: string; num?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={'pm-formula err' + (num ? ' num' : '')} title={t('pm.cell.errorClick', { error })} data-nogrid onClick={() => setOpen(true)}>{t('pm.cell.error')}</button>
      {open && <FormulaErrorDialog error={error} formula={formula} where={t('pm.cell.where', { letter: colLetter(pm.cols.indexOf(col)), name: col.name, row: rowNumber(pm, row.id) })} onClose={() => setOpen(false)} />}
    </>
  );
}

function Popover({ pop, pm, card, close, closeTable, op, rows, openImport, openPage, openPop }: { closeTable: () => void; openPop: (k: 'props' | 'rules' | 'csv' | 'col', id?: string) => void; pop: Pop; pm: Pm; card: PmCard; close: () => void; op: (o: PmOp) => void; rows: Row[]; archived: number; openImport: (plan: CsvPlan, name: string) => void; openPage: (id: string) => void }) {
  const style = pop.kind === 'more' || pop.kind === 'rules' ? { right: 16, top: pop.y } : { left: Math.max(8, pop.x), top: pop.y };
  if (pop.kind === 'import') return <div className="pm-pop menu import" role="dialog" aria-label={t('pm.import.dialog')}><ImportMenu pm={pm} card={card} plan={pop.plan} name={pop.name} close={close} /></div>;
  let body: ReactNode = null;
  if (pop.kind === 'more') body = <OptionsMenu card={card} close={close} closeTable={closeTable} openPop={openPop} />;
  if (pop.kind === 'csv') body = <CsvMenu pm={pm} card={card} rows={rows} op={op} close={close} openImport={openImport} />;
  if (pop.kind === 'view') body = <ViewMenu pm={pm} id={pop.id} op={op} close={close} />;
  if (pop.kind === 'addview') body = <AddViewMenu op={op} close={close} />;
  if (pop.kind === 'col') body = <ColMenu col={pm.cols.find((c) => c.id === pop.col)!} pm={pm} card={card} close={close} op={op} />;
  if (pop.kind === 'cell') body = <CellMenu pm={pm} col={pm.cols.find((c) => c.id === pop.col)!} row={pm.rows.find((r) => r.id === pop.row)!} card={card} close={close} op={op} openPage={openPage} openCol={(id) => openPop('col', id)} />;
  if (pop.kind === 'filter') body = <FilterMenu pm={pm} op={op} />;
  if (pop.kind === 'sort') body = <SortMenu pm={pm} op={op} />;
  if (pop.kind === 'rules') body = <RulesMenu pm={pm} op={op} />;
  if (pop.kind === 'props') body = <PropsMenu pm={pm} op={op} />;
  if (pop.kind === 'addcol') body = <AddColMenu pm={pm} op={op} close={close} />;
  if (pop.kind === 'row') body = <RowMenu pm={pm} row={pop.row} op={op} close={close} openPage={openPage} />;
  if (!body || (pop.kind === 'col' && !pm.cols.some((c) => c.id === pop.col)) || (pop.kind === 'cell' && !pm.rows.some((r) => r.id === pop.row))) return null;
  return <div className={'pm-pop menu ' + pop.kind} style={style}>{body}</div>;
}

function ColMenu({ col, pm, card, close, op }: { col: Col; pm: Pm; card: PmCard; close: () => void; op: (o: PmOp) => void }) {
  const { state, dispatch } = useApp();
  const [confirm, setConfirm] = useState(false);
  const patch = (p: Partial<Col>) => op({ op: 'patchCol', id: col.id, patch: p });
  const i = pm.cols.findIndex((c) => c.id === col.id);
  const sort = (dir: Sort['dir']) => op({ op: 'sorts', sorts: [{ col: col.id, dir }, ...pm.sorts.filter((s) => s.col !== col.id)] });
  return (
    <>
      <input autoFocus value={col.name} aria-label={t('pm.colmenu.name')} onChange={(e) => patch({ name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && close()} />
      <label className="menu-label">{t('pm.colmenu.type')}
        <select value={col.type} onChange={(e) => dispatch({ t: 'pmConvert', card: card.id, col: col.id, type: e.target.value as ColType })}>
          {(Object.keys(TYPE_LABEL) as ColType[]).filter((t) => !RETIRED.has(t) || col.type === t).map((t) => <option key={t} value={t}>{TYPE_ICON[t]} {TYPE_LABEL[t]}</option>)}
        </select>
      </label>
      {col.type === 'number' && (
        <div className="seg">{([['num', '123'], ['eur', '€'], ['pct', '%'], ['h', 'h']] as [NumFmt, string][]).map(([f, l]) => <button key={f} className={col.fmt === f ? 'on' : ''} onClick={() => patch({ fmt: f })}>{l}</button>)}</div>
      )}
      {(col.type === 'select' || col.type === 'multi') && (
        <OptionsEditor opts={optsOf(col, state.tags)} global={!!col.global} onChange={(opts) => (col.global ? dispatch({ t: 'tags', tags: opts }) : patch({ opts }))} />
      )}
      {col.type === 'multi' && (
        <label className="check-line small"><input type="checkbox" checked={!!col.global} onChange={() => patch(col.global ? { global: false, opts: [] } : { global: true })} /> {t('pm.colmenu.globalTags')}</label>
      )}
      {col.type === 'status' && <PhasesEditor phases={col.phases ?? []} onChange={(phases) => patch({ phases })} />}
      {col.type === 'formula' && <FormulaEditor pm={pm} col={col} patch={patch} />}
      {(col.type === 'formula' || col.type === 'rollup') && (
        <div className="seg">{([['num', '123'], ['eur', '€'], ['pct', '%'], ['h', 'h']] as [NumFmt, string][]).map(([f, l]) => <button key={f} className={col.fmt === f ? 'on' : ''} onClick={() => patch({ fmt: f })}>{l}</button>)}</div>
      )}
      {col.type === 'relation' && (
        <label className="menu-label">{t('pm.colmenu.linkedTable')}
          <select value={col.target ?? ''} onChange={(e) => patch({ target: e.target.value || null })}>
            <option value="">{t('pm.colmenu.noTable')}</option>
            {state.cards.filter((c) => c.type === 'pm' && !c.trashed).map((c) => <option key={c.id} value={c.id}>{c.id === card.id ? t('pm.colmenu.thisTable', { title: c.title || t('pm.colmenu.untitledTable') }) : c.title || t('pm.colmenu.untitledTable')}</option>)}
          </select>
          <span className="small muted">{t('pm.colmenu.externalHint')}</span>
        </label>
      )}
      {col.type === 'rollup' && <RollupEditor pm={pm} col={col} patch={patch} />}
      {col.type === 'progress' && (
        <label className="menu-label">{t('pm.colmenu.calcFrom')}
          <select value={col.source ?? ''} onChange={(e) => patch({ source: e.target.value || undefined })}>
            <option value="">—</option>
            {pm.cols.filter((c) => c.type === 'status').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      <div className="menu-sep" />
      <button onClick={() => { sort('asc'); close(); }}>{t('pm.colmenu.sortAsc')}</button>
      <button onClick={() => { sort('desc'); close(); }}>{t('pm.colmenu.sortDesc')}</button>
      <button onClick={() => { op({ op: 'addCol', col: newCol('text', pm), at: i }); close(); }}>{t('pm.colmenu.insertLeft')}</button>
      <button onClick={() => { op({ op: 'addCol', col: newCol('text', pm), at: i + 1 }); close(); }}>{t('pm.colmenu.insertRight')}</button>
      <button onClick={() => { patch({ hidden: true }); close(); }}>{t('pm.colmenu.hide')}</button>
      {pm.cols.length > 1 && (confirm
        ? <div className="stack small-gap"><span className="small">{t('pm.colmenu.confirmDelete', { name: col.name })}</span><div className="row"><button className="tool small-btn" onClick={() => setConfirm(false)}>{t('pm.cancel')}</button><button className="danger small-btn" onClick={() => { op({ op: 'removeCol', id: col.id }); close(); }}>{t('pm.colmenu.delete')}</button></div></div>
        : <button className="danger-text" onClick={() => setConfirm(true)}>{t('pm.colmenu.deleteCol')}</button>)}
    </>
  );
}

function OptionsEditor({ opts, global, onChange }: { opts: Opt[]; global: boolean; onChange: (o: Opt[]) => void }) {
  const set = (i: number, p: Partial<Opt>) => onChange(opts.map((o, k) => (k === i ? { ...o, ...p } : o)));
  return (
    <div className="opt-editor">
      <span className="menu-label">{global ? t('pm.opt.globalTags') : t('pm.opt.options')}</span>
      {opts.map((o, i) => (
        <div key={o.id} className="row">
          <button className="swatch" style={{ background: COLORS[o.color]?.[1] }} aria-label={t('pm.opt.color')} title={t('pm.opt.color')} onClick={() => set(i, { color: COLOR_KEYS[(COLOR_KEYS.indexOf(o.color) + 1) % COLOR_KEYS.length] })} />
          <input value={o.name} aria-label={t('pm.opt.name')} onChange={(e) => set(i, { name: e.target.value })} />
          <button className="icon-btn small" aria-label={t('pm.opt.delete')} onClick={() => onChange(opts.filter((_, k) => k !== i))}>×</button>
        </div>
      ))}
      <button className="link small" onClick={() => onChange([...opts, { id: pmId(global ? 'tag' : 'o'), name: t('pm.opt.new', { n: opts.length + 1 }), color: COLOR_KEYS[opts.length % COLOR_KEYS.length] }])}>{t('pm.opt.add')}</button>
    </div>
  );
}

function PhasesEditor({ phases, onChange }: { phases: Phase[]; onChange: (p: Phase[]) => void }) {
  const setPh = (i: number, p: Partial<Phase>) => onChange(phases.map((ph, k) => (k === i ? { ...ph, ...p } : ph)));
  return (
    <div className="opt-editor">
      <span className="menu-label">{t('pm.phase.title')}</span>
      {phases.map((ph, i) => (
        <div key={ph.id} className="phase">
          <div className="row">
            <button className="swatch" style={{ background: COLORS[ph.color]?.[1] }} aria-label={t('pm.phase.color')} onClick={() => setPh(i, { color: COLOR_KEYS[(COLOR_KEYS.indexOf(ph.color) + 1) % COLOR_KEYS.length] })} />
            <input className="phase-name" value={ph.name} aria-label={t('pm.phase.name')} onChange={(e) => setPh(i, { name: e.target.value })} />
            {phases.length > 1 && <button className="icon-btn small" aria-label={t('pm.phase.delete')} onClick={() => onChange(phases.filter((_, k) => k !== i))}>×</button>}
          </div>
          {ph.states.map((st, j) => (
            <div key={st.id} className="row state">
              <input value={st.name} aria-label={t('pm.phase.stateName')} onChange={(e) => setPh(i, { states: ph.states.map((x, k) => (k === j ? { ...x, name: e.target.value } : x)) })} />
              {ph.states.length > 1 && <button className="icon-btn small" aria-label={t('pm.phase.stateDelete')} onClick={() => setPh(i, { states: ph.states.filter((_, k) => k !== j) })}>×</button>}
            </div>
          ))}
          <button className="link small state" onClick={() => setPh(i, { states: [...ph.states, { id: pmId('st'), name: t('pm.phase.newState') }] })}>{t('pm.phase.addState')}</button>
        </div>
      ))}
      <button className="link small" onClick={() => onChange([...phases, { id: pmId('ph'), name: t('pm.phase.newPhase'), color: COLOR_KEYS[phases.length % COLOR_KEYS.length], states: [{ id: pmId('st'), name: t('pm.phase.newState') }] }])}>{t('pm.phase.addPhase')}</button>
    </div>
  );
}

function CellMenu({ pm, col, row, card, close, op, openPage, openCol }: { pm: Pm; col: Col; row: Row; card: PmCard; close: () => void; op: (o: PmOp) => void; openPage: (id: string) => void; openCol: (id: string) => void }) {
  const { state, dispatch } = useApp();
  const [q, setQ] = useState('');
  const v = row.cells[col.id];
  const set = (val: CellVal) => op({ op: 'cell', row: row.id, col: col.id, value: val });
  if (col.type === 'relation') return <RelationMenu pm={pm} card={card.id} col={col} row={row} set={set} close={close} onOpenRow={openPage} />;
  if (col.type === 'image') return <ImageMenu card={card.id} col={col} row={row} />;
  if (col.type === 'date') {
    const d = v && typeof v === 'object' && !Array.isArray(v) ? (v as DateVal) : { start: '', end: '' };
    return <DatePick value={d} onChange={set} onClose={close} />;
  }
  if (col.type === 'status') {
    return (
      <>
        {(col.phases ?? []).map((ph) => (
          <div key={ph.id} className="status-group">
            <span className="menu-label">{ph.name}</span>
            {ph.states.map((st) => { const [bg, fg] = COLORS[ph.color] ?? COLORS.gray; return <button key={st.id} className={v === st.id ? 'on' : ''} onClick={() => { set(st.id); close(); }}><span className="pill" style={{ background: bg, color: fg }}>{st.name}</span>{v === st.id && ' ✓'}</button>; })}
          </div>
        ))}
        {v && <button className="link small" onClick={() => { set(null); close(); }}>{t('pm.cellmenu.clearState')}</button>}
      </>
    );
  }
  const opts = optsOf(col, state.tags);
  const multi = col.type === 'multi';
  const chosen = multi ? strList(v) : typeof v === 'string' ? [v] : [];
  const fq = q.trim().toLowerCase();
  const shown = opts.filter((o) => !fq || o.name.toLowerCase().includes(fq));
  const pick = (id: string) => {
    if (multi) set(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
    else { set(chosen[0] === id ? null : id); close(); }
  };
  const create = () => {
    const o: Opt = { id: pmId(col.global ? 'tag' : 'o'), name: q.trim(), color: COLOR_KEYS[opts.length % COLOR_KEYS.length] };
    if (col.global) dispatch({ t: 'tags', tags: [...state.tags, o] });
    else op({ op: 'patchCol', id: col.id, patch: { opts: [...opts, o] } });
    setQ('');
    pick(o.id);
  };
  return (
    <>
      <input autoFocus value={q} placeholder={t('pm.cellmenu.searchPlaceholder')} aria-label={t('pm.cellmenu.search')}
        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { if (shown[0] && shown[0].name.toLowerCase() === fq) pick(shown[0].id); else if (q.trim()) create(); } }} />
      {shown.map((o) => { const [bg, fg] = COLORS[o.color] ?? COLORS.gray; return <button key={o.id} className={chosen.includes(o.id) ? 'on' : ''} onClick={() => pick(o.id)}><span className="pill" style={{ background: bg, color: fg }}>{o.name}</span>{chosen.includes(o.id) && ' ✓'}</button>; })}
      {q.trim() && !opts.some((o) => o.name.toLowerCase() === fq) && <button onClick={create}>{t('pm.cellmenu.create', { name: q.trim() })}</button>}
      <div className="menu-sep" />
      {chosen.length > 0 && <button onClick={() => { set(multi ? [] : null); close(); }}>{t('pm.remove')}</button>}
      <button onClick={() => openCol(col.id)}>{t('pm.cellmenu.editOpts')}</button>
    </>
  );
}

function FilterMenu({ pm, op }: { pm: Pm; op: (o: PmOp) => void }) {
  const set = (filters: Filter[], conj = pm.conj) => op({ op: 'filters', filters, conj });
  const add = () => { const c = pm.cols[0]; set([...pm.filters, { id: pmId('f'), col: c.id, op: FILTER_OPS[c.type][0][0], val: '' }]); };
  return (
    <div className="stack small-gap filter-menu">
      {pm.filters.length > 1 && <div className="seg">{(['and', 'or'] as const).map((c) => <button key={c} className={pm.conj === c ? 'on' : ''} onClick={() => set(pm.filters, c)}>{c === 'and' ? t('pm.filter.all') : t('pm.filter.any')}</button>)}</div>}
      {pm.filters.map((f, i) => (
        <div key={f.id} className="row">
          <Condition pm={pm} f={f} onChange={(p) => set(pm.filters.map((x, k) => (k === i ? { ...x, ...p } : x)))} />
          <button className="icon-btn small" aria-label={t('pm.filter.remove')} onClick={() => set(pm.filters.filter((_, k) => k !== i))}>×</button>
        </div>
      ))}
      <div className="row"><button className="link small" onClick={add}>{t('pm.filter.add')}</button><span className="grow" />{pm.filters.length > 0 && <button className="link small" onClick={() => set([])}>{t('pm.removeAll')}</button>}</div>
    </div>
  );
}

/** Columna · condición · valor (se usa en los filtros y en las reglas de formato). */
function Condition({ pm, f, onChange }: { pm: Pm; f: Filter; onChange: (p: Partial<Filter>) => void }) {
  const { state } = useApp();
  const col = pm.cols.find((c) => c.id === f.col) ?? pm.cols[0];
  const needs = !['empty', 'nempty', 'checked', 'unchecked', 'overdue'].includes(f.op);
  let valCtl: ReactNode = <input value={f.val} aria-label={t('pm.value')} onChange={(e) => onChange({ val: e.target.value })} />;
  if (col.type === 'select' || col.type === 'multi') valCtl = <select value={f.val} aria-label={t('pm.value')} onChange={(e) => onChange({ val: e.target.value })}><option value="">{t('pm.choose')}</option>{optsOf(col, state.tags).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>;
  if (col.type === 'status') valCtl = <select value={f.val} aria-label={t('pm.value')} onChange={(e) => onChange({ val: e.target.value })}><option value="">{t('pm.choose')}</option>{f.op === 'phase' ? (col.phases ?? []).map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>) : allStates(col).map((x) => <option key={x.st.id} value={x.st.id}>{x.ph.name} · {x.st.name}</option>)}</select>;
  if (col.type === 'date') valCtl = <input type="date" value={f.val} aria-label={t('pm.value')} onChange={(e) => onChange({ val: e.target.value })} />;
  return (
    <>
      <select value={col.id} aria-label={t('pm.column')} onChange={(e) => { const c = pm.cols.find((x) => x.id === e.target.value)!; onChange({ col: c.id, op: FILTER_OPS[c.type][0][0], val: '' }); }}>{pm.cols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select value={f.op} aria-label={t('pm.filter.condition')} onChange={(e) => onChange({ op: e.target.value as Filter['op'], val: '' })}>{FILTER_OPS[col.type].map(([o, l]) => <option key={o} value={o}>{l}</option>)}</select>
      {needs ? valCtl : <span className="grow" />}
    </>
  );
}

function RulesMenu({ pm, op }: { pm: Pm; op: (o: PmOp) => void }) {
  const rules = pm.rules ?? [];
  const set = (r: Rule[]) => op({ op: 'rules', rules: r });
  const move = (i: number, d: -1 | 1) => { const r = rules.slice(); const [x] = r.splice(i, 1); r.splice(i + d, 0, x); set(r); };
  return (
    <div className="stack small-gap filter-menu">
      <span className="small muted">{t('pm.rules.hint')}</span>
      {rules.map((r, i) => (
        <div key={r.id} className="rule">
          <div className="row">
            <Condition pm={pm} f={r.filter} onChange={(p) => set(rules.map((x, k) => (k === i ? { ...x, filter: { ...x.filter, ...p } } : x)))} />
            <button className="icon-btn small" aria-label={t('pm.rules.remove')} onClick={() => set(rules.filter((_, k) => k !== i))}>×</button>
          </div>
          <div className="row">
            {COLOR_KEYS.map((c) => <button key={c} className={'swatch' + (r.color === c ? ' on' : '')} style={{ background: COLORS[c][1] }} aria-label={t('pm.rules.color', { color: c })} onClick={() => set(rules.map((x, k) => (k === i ? { ...x, color: c } : x)))} />)}
            <label className="check-line small"><input type="checkbox" checked={r.bold} onChange={() => set(rules.map((x, k) => (k === i ? { ...x, bold: !x.bold } : x)))} /> {t('pm.rules.bold')}</label>
            <span className="grow" />
            <button className="icon-btn small" aria-label={t('pm.rules.up')} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="icon-btn small" aria-label={t('pm.rules.down')} disabled={i === rules.length - 1} onClick={() => move(i, 1)}>↓</button>
          </div>
        </div>
      ))}
      {!rules.length && <span className="small muted">{t('pm.rules.suggestions')}</span>}
      {!rules.length && (() => {
        const date = pm.cols.find((x) => x.type === 'date'), st = pm.cols.find((x) => x.type === 'status');
        const mk = (col: Col, o: Rule['filter']['op'], color: Rule['color']): Rule => ({ id: pmId('rule'), filter: { id: pmId('f'), col: col.id, op: o, val: '' }, color, bold: false });
        return (
          <div className="row wrap">
            {date && <button className="tool small-btn" onClick={() => set([...rules, mk(date, 'overdue', 'red')])}>{t('pm.rules.overdueRed')}</button>}
            {st && <button className="tool small-btn" onClick={() => set([...rules, { ...mk(st, 'phase', 'green'), filter: { id: pmId('f'), col: st.id, op: 'phase', val: st.phases?.[st.phases.length - 1]?.id ?? '' } }])}>{t('pm.rules.doneGreen')}</button>}
            {st && <button className="tool small-btn" onClick={() => set([...rules, mk(st, 'empty', 'gray')])}>{t('pm.rules.noStateGray')}</button>}
          </div>
        );
      })()}
      <button className="link small" onClick={() => { const c = pm.cols.find((x) => x.type === 'date') ?? pm.cols[0]; set([...rules, { id: pmId('rule'), filter: { id: pmId('f'), col: c.id, op: FILTER_OPS[c.type][0][0], val: '' }, color: 'red', bold: false }]); }}>{t('pm.rules.add')}</button>
    </div>
  );
}

function TimerCell({ id, col, v, onAction }: { id: string; col: Col; v: CellVal; onAction: (a: 'start' | 'stop' | 'reset') => void }) {
  const tm = asTimer(v);
  const on = tm.start !== null;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const h = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(h);
  }, [on]);
  const ms = timerMs(v);
  return (
    <div className={'pm-timer' + (on ? ' on' : '')}>
      <button id={id} className="timer-btn" aria-label={on ? t('pm.timer.stop', { name: col.name }) : t('pm.timer.start', { name: col.name })} title={on ? t('pm.timer.stopTip') : t('pm.timer.startTip')} onClick={() => onAction(on ? 'stop' : 'start')}>{on ? '■' : '▶'}</button>
      <span className="timer-val">{ms ? formatTimer(ms) : <span className="muted">0:00:00</span>}</span>
      {!on && ms > 0 && <button className="icon-btn small" aria-label={t('pm.timer.resetOf', { name: col.name })} title={t('pm.timer.reset')} onClick={() => onAction('reset')}>↺</button>}
    </div>
  );
}

function SortMenu({ pm, op }: { pm: Pm; op: (o: PmOp) => void }) {
  const set = (sorts: Sort[]) => op({ op: 'sorts', sorts });
  return (
    <div className="stack small-gap">
      {pm.sorts.map((s, i) => (
        <div key={s.col + i} className="row">
          <span className="small muted">{i === 0 ? t('pm.sort.by') : t('pm.sort.then')}</span>
          <select value={s.col} aria-label={t('pm.column')} onChange={(e) => set(pm.sorts.map((x, k) => (k === i ? { ...x, col: e.target.value } : x)))}>{pm.cols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={s.dir} aria-label={t('pm.sort.dir')} onChange={(e) => set(pm.sorts.map((x, k) => (k === i ? { ...x, dir: e.target.value as Sort['dir'] } : x)))}><option value="asc">{t('pm.sort.asc')}</option><option value="desc">{t('pm.sort.desc')}</option></select>
          <button className="icon-btn small" aria-label={t('pm.sort.remove')} onClick={() => set(pm.sorts.filter((_, k) => k !== i))}>×</button>
        </div>
      ))}
      <div className="row"><button className="link small" onClick={() => { const free = pm.cols.find((c) => !pm.sorts.some((s) => s.col === c.id)); if (free) set([...pm.sorts, { col: free.id, dir: 'asc' }]); }}>{t('pm.sort.add')}</button><span className="grow" />{pm.sorts.length > 0 && <button className="link small" onClick={() => set([])}>{t('pm.removeAll')}</button>}</div>
      {pm.sorts.length > 0 && <span className="small muted">{t('pm.sort.locked')}</span>}
      <label className="menu-label">{t('pm.sort.groupBy')}
        <select value={pm.group ?? ''} aria-label={t('pm.sort.groupBy')} onChange={(e) => op({ op: 'group', col: e.target.value || null })}>
          <option value="">{t('pm.sort.noGroup')}</option>{pm.cols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
    </div>
  );
}

function PropsMenu({ pm, op }: { pm: Pm; op: (o: PmOp) => void }) {
  return (
    <div className="stack small-gap">
      <span className="menu-label">{t('pm.props.visible')}</span>
      {pm.cols.map((c, i) => (
        <label key={c.id} className="check-line small">
          <input type="checkbox" checked={!c.hidden} disabled={i === 0} onChange={() => op({ op: 'patchCol', id: c.id, patch: { hidden: !c.hidden } })} />
          <span className="th-icon">{TYPE_ICON[c.type]}</span>{c.name}
        </label>
      ))}
    </div>
  );
}

function AddColMenu({ pm, op, close }: { pm: Pm; op: (o: PmOp) => void; close: () => void }) {
  return (
    <>
      <span className="menu-label">{t('pm.addcol.type')}</span>
      {(Object.keys(TYPE_LABEL) as ColType[]).filter((t) => !RETIRED.has(t)).map((t) => <button key={t} onClick={() => { op({ op: 'addCol', col: newCol(t, pm) }); close(); }}><span className="th-icon">{TYPE_ICON[t]}</span> {TYPE_LABEL[t]}</button>)}
    </>
  );
}

function RowMenu({ pm, row, op, close, openPage }: { pm: Pm; row: string; op: (o: PmOp) => void; close: () => void; openPage: (id: string) => void }) {
  const { toast } = useApp();
  const r = pm.rows.find((x) => x.id === row);
  return (
    <>
      <button onClick={() => openPage(row)}>{t('pm.rowmenu.openPage')}</button>
      <button onClick={() => { op({ op: 'addRow', id: pmId('row'), after: row }); close(); }}>{t('pm.rowmenu.insertBelow')}</button>
      <button onClick={() => {
        const src = pm.rows.find((r) => r.id === row);
        if (src) { op({ op: 'addRow', id: pmId('row'), after: row, cells: src.cells }); toast(t('pm.rowmenu.duplicated')); }
        close();
      }}>{t('pm.rowmenu.duplicate')}</button>
      <button onClick={() => { op({ op: 'row', id: row, patch: { archived: !r?.archived } }); close(); }}>{r?.archived ? t('pm.unarchive') : t('pm.archive')}</button>
      <div className="menu-sep" />
      <button className="danger-text" onClick={() => { op({ op: 'removeRow', id: row }); close(); }}>{t('pm.rowmenu.delete')}</button>
    </>
  );
}


/** «Opciones de la tabla». */
function OptionsMenu({ card, close, closeTable, openPop }: { card: PmCard; close: () => void; closeTable: () => void; openPop: (k: 'props' | 'rules' | 'csv' | 'col', id?: string) => void }) {
  const { state, dispatch, toast, copy } = useApp();
  const [tplName, setTplName] = useState<string | null>(null);
  const pm = card.pm;
  const rows = visibleRows(pm, state.tags, dayKey(new Date()), '');
  return (
    <>
      <button onClick={() => openPop('props')}>{t('pm.opts.props')}</button>
      <button onClick={() => openPop('rules')}>{t('pm.opts.rules')}</button>
      <button onClick={async () => {
        const { text, html } = toClipboard(pm, rows, state.tags);
        try {
          if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
            await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
            toast(tn('pm.opts.copiedPaste', rows.length));
          } else copy(text, tn('pm.opts.copied', rows.length));
        } catch { copy(text, tn('pm.opts.copied', rows.length)); }
        close();
      }}>{t('pm.opts.copyExcel')}</button>
      <button onClick={() => openPop('csv')}>{t('pm.opts.csv')}</button>
      {tplName === null ? (
        <button onClick={() => setTplName(card.title || t('pm.opts.tplDefault'))}>{t('pm.opts.saveTpl')}</button>
      ) : (
        <div className="row pad">
          <input autoFocus value={tplName} aria-label={t('pm.opts.tplName')} onChange={(e) => setTplName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.nextElementSibling as HTMLButtonElement)?.click()} />
          <button className="primary small-btn" onClick={() => { dispatch({ t: 'pmTemplates', list: [...state.pmTemplates, asTemplate(pm, tplName.trim() || t('pm.opts.tplDefault'))] }); toast(t('pm.opts.tplSaved')); close(); }}>{t('pm.opts.save')}</button>
        </div>
      )}
      <button onClick={() => { dispatch({ t: 'duplicateCard', id: card.id }); toast(t('pm.opts.duplicated')); close(); closeTable(); }}>{t('pm.opts.duplicate')}</button>
      <div className="menu-sep" />
      <button className="danger-text" onClick={() => { dispatch({ t: 'trashCard', id: card.id }); toast(t('pm.opts.trashed')); close(); }}>{t('pm.opts.trash')}</button>
    </>
  );
}

/** Importar y exportar CSV (separador configurable; punto y coma por defecto, para Excel en español). */
function CsvMenu({ pm, card, rows, close, openImport }: { pm: Pm; card: PmCard; rows: Row[]; op: (o: PmOp) => void; close: () => void; openImport: (plan: CsvPlan, name: string) => void }) {
  const { state, backend, toast, copy } = useApp();
  const [sep, setSep] = useState<';' | ',' | '\t'>(';');
  const name = (card.title || t('pm.csv.fileName')).replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'tabla';
  return (
    <>
      <span className="menu-label">{t('pm.csv.exportView')}</span>
      <div className="row pad"><span className="small">{t('pm.csv.sep')}</span><div className="seg" title={t('pm.csv.sep')}>{([[';', ';'], [',', ','], ['\t', t('pm.csv.tab')]] as const).map(([v, l]) => <button key={l} className={sep === v ? 'on' : ''} onClick={() => setSep(v)}>{l}</button>)}</div></div>
      <span className="small muted pad">{t('pm.csv.sepHint')}</span>
      <button onClick={async () => { const ok = await backend.saveCsv(name + '.csv', toCsv(pm, rows, state.tags, sep)); if (ok) toast(tn('pm.csv.exported', rows.length)); close(); }}>{t('pm.csv.download')}</button>
      <button onClick={() => { copy(toCsv(pm, rows, state.tags, sep), tn('pm.csv.copied', rows.length)); close(); }}>{t('pm.csv.copy')}</button>
      <div className="menu-sep" />
      <span className="menu-label">{t('pm.csv.import')}</span>
      <button onClick={async () => {
        const f = await backend.openCsv();
        if (!f) return;
        const plan = planImport(pm, f.text);
        if (!plan.header.length) { toast(t('pm.csv.empty')); return; }
        openImport(plan, f.name);
      }}>{t('pm.csv.pickFile')}</button>
      <span className="small muted pad">{t('pm.csv.importHint')}</span>
    </>
  );
}

function ViewMenu({ pm, id, op, close }: { pm: Pm; id: string; op: (o: PmOp) => void; close: () => void }) {
  const views = pmViews(pm);
  const i = views.findIndex((v) => v.id === id);
  const v = views[i];
  if (!v) return null;
  return (
    <>
      <input autoFocus value={v.name} aria-label={t('pm.viewmenu.name')} onChange={(e) => op({ op: 'viewPatch', id, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && close()} />
      <div className="row pad">
        <button className="grow" disabled={i === 0} onClick={() => op({ op: 'viewMove', id, before: views[i - 1].id })}>{t('pm.viewmenu.moveLeft')}</button>
        <button className="grow" disabled={i === views.length - 1} onClick={() => op({ op: 'viewMove', id, before: views[i + 2]?.id ?? null })}>{t('pm.viewmenu.moveRight')}</button>
      </div>
      <button onClick={() => { op({ op: 'viewDuplicate', id, newId: pmId('view') }); close(); }}>{t('pm.viewmenu.duplicate')}</button>
      {views.length > 1 && <button className="danger-text" onClick={() => { op({ op: 'viewRemove', id }); close(); }}>{t('pm.viewmenu.delete')}</button>}
    </>
  );
}

function AddViewMenu({ op, close }: { op: (o: PmOp) => void; close: () => void }) {
  return (
    <>
      {(['table', 'kanban', 'timeline', 'calendar', 'gallery'] as PmView[]).map((t) => <button key={t} onClick={() => { op({ op: 'viewAdd', id: pmId('view'), type: t }); close(); }}>{VIEW_LABEL[t]}</button>)}
    </>
  );
}

function ImportMenu({ pm, card, plan, name, close }: { pm: Pm; card: PmCard; plan: CsvPlan; name: string; close: () => void }) {
  const { dispatch, toast } = useApp();
  const [p, setP] = useState(plan);
  const sepName = p.sep === ';' ? t('pm.import.sep.semicolon') : p.sep === ',' ? t('pm.import.sep.comma') : t('pm.import.sep.tab');
  return (
    <div className="stack small-gap">
      <h3>{t('pm.import.title', { name })}</h3>
      <p className="small muted">{tn('pm.import.summary', p.rows.length, { sep: sepName })}</p>
      <div className="import-map">
        {p.header.map((h, i) => (
          <div key={i} className="row">
            <span className="grow ellipsis"><b>{h || t('pm.import.noName')}</b> <span className="small muted">{p.rows.slice(0, 2).map((r) => r[i]).filter(Boolean).join(' · ')}</span></span>
            <select aria-label={t('pm.import.target', { name: h })} value={p.map[i] ?? 'new:' + p.types[i]} onChange={(e) => {
              const v = e.target.value;
              const map = p.map.slice(), types = p.types.slice();
              if (v.startsWith('new:')) { map[i] = null; types[i] = v.slice(4) as ColType; } else map[i] = v;
              setP({ ...p, map, types });
            }}>
              {pm.cols.filter((c) => c.type !== 'progress').map((c) => <option key={c.id} value={c.id}>→ {c.name}</option>)}
              {(['text', 'number', 'select', 'multi', 'checkbox', 'date'] as ColType[]).map((ty) => <option key={ty} value={'new:' + ty}>{t('pm.import.newCol', { type: TYPE_LABEL[ty] })}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="row-end">
        <button className="tool" onClick={close}>{t('pm.cancel')}</button>
        <button className="primary" onClick={() => { dispatch({ t: 'pmImport', card: card.id, plan: p }); toast(tn('pm.import.done', p.rows.length)); close(); }}>{tn('pm.import.go', p.rows.length)}</button>
      </div>
    </div>
  );
}

function FormulaCell({ pm, col, row, tags, style }: { pm: Pm; col: Col; row: Row; tags: Opt[]; style?: React.CSSProperties }) {
  const r = formulaValue(pm, col, row, tags);
  if (!r.error) return <span className={'pm-formula' + (typeof r.value === 'number' ? ' num' : '')} style={style}>{formatFVal(col, r.value)}</span>;
  return <FormulaErr pm={pm} col={col} row={row} error={r.error} formula={displayExpr(pm, col.expr ?? '')} />;
}

function FormulaEditor({ pm, col, patch }: { pm: Pm; col: Col; patch: (p: Partial<Col>) => void }) {
  const [text, setText] = useState(displayExpr(pm, col.expr ?? ''));
  const ta = useRef<HTMLTextAreaElement>(null);
  const syntax = text.trim() ? checkFormula(text) : null;
  const missing = syntax ? [] : propsIn(text).filter((n) => !pm.cols.some((c) => c.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === n.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  const err = syntax ?? (missing.length ? t('pm.formula.noProp', { name: missing[0] }) : null);
  const insert = (t: string) => { const el = ta.current; const a = el?.selectionStart ?? text.length; const next = text.slice(0, a) + t + text.slice(el?.selectionEnd ?? a); setText(next); if (!checkFormula(next)) patch({ expr: storeExpr(pm, next) }); requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + t.length, a + t.length); }); };
  return (
    <div className="formula-ed">
      <span className="menu-label">{t('pm.formula.label')}</span>
      <textarea ref={ta} value={text} rows={3} spellCheck={false} aria-label={t('pm.formula.label')} placeholder={t('pm.formula.placeholder')}
        onChange={(e) => { setText(e.target.value); if (!checkFormula(e.target.value) || !e.target.value.trim()) patch({ expr: storeExpr(pm, e.target.value) }); }} />
      {err ? <span className="err small">{err}</span> : text.trim() ? <span className="small ok">{t('pm.formula.ok')}</span> : null}
      <div className="formula-props">{pm.cols.filter((c) => c.id !== col.id).map((c) => <button key={c.id} className="chip" onClick={() => insert(`{${c.name}}`)}>{c.name}</button>)}</div>
      <span className="small muted">{functionHelp()}</span>
    </div>
  );
}

function RollupEditor({ pm, col, patch }: { pm: Pm; col: Col; patch: (p: Partial<Col>) => void }) {
  const { state } = useApp();
  const rels = pm.cols.filter((c) => c.type === 'relation');
  const rel = rels.find((c) => c.id === col.rel);
  const target = rel?.target ? state.cards.find((c) => c.id === rel.target && c.type === 'pm') : null;
  const tcols = target && target.type === 'pm' ? target.pm.cols : [];
  return (
    <div className="stack small-gap">
      {!rels.length && <span className="small err">{t('pm.roll.needRel')}</span>}
      <label className="menu-label">{t('pm.roll.relation')}
        <select value={col.rel ?? ''} onChange={(e) => patch({ rel: e.target.value || undefined, prop: undefined })}>
          <option value="">—</option>{rels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="menu-label">{t('pm.roll.fn')}
        <select value={col.fn ?? 'count'} onChange={(e) => patch({ fn: e.target.value as Col['fn'] })}>{ROLL_FNS.map(([f, l]) => <option key={f} value={f}>{l}</option>)}</select>
      </label>
      {col.fn && !['count', 'pctDone'].includes(col.fn) && (
        <label className="menu-label">{t('pm.roll.propOf', { name: target?.title || t('pm.roll.linked') })}
          <select value={col.prop ?? ''} onChange={(e) => patch({ prop: e.target.value || undefined })} disabled={!target}>
            <option value="">—</option>{tcols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      {rel && !rel.target && col.fn !== 'count' && <span className="small muted">{t('pm.roll.noTarget', { name: rel.name })}</span>}
      <span className="small muted">{t('pm.roll.ownFormat')}</span>
    </div>
  );
}

function Gallery({ pm, rows, tags, op, onOpen, today }: { pm: Pm; rows: Row[]; tags: Opt[]; op: (o: PmOp) => void; onOpen: (id: string) => void; today: string }) {
  const { state } = useApp();
  const size = pm.ui?.gallerySize ?? 'M';
  const imgCol = pm.cols.find((c) => c.type === 'image');
  const status = pm.cols.find((c) => c.type === 'status');
  const prog = pm.cols.find((c) => c.type === 'progress');
  const extra = pm.cols.filter((c) => !c.hidden && ['select', 'multi', 'date', 'number', 'formula', 'rollup'].includes(c.type)).slice(0, size === 'S' ? 1 : size === 'M' ? 2 : 4);
  return (
    <div className="gallery-wrap">
      <div className="row tl-bar">
        <div className="seg">{(['S', 'M', 'L'] as const).map((z) => <button key={z} className={size === z ? 'on' : ''} onClick={() => op({ op: 'ui', patch: { gallerySize: z } })}>{z}</button>)}</div>
        {!imgCol && <span className="small muted">{t('pm.gallery.noImages')}</span>}
      </div>
      <div className={'gallery size-' + size}>
        {rows.map((r) => {
          const cover = imgCol ? strList(r.cells[imgCol.id]).find((id) => state.assets[id]) : null;
          const si = status ? stateInfo(status, r.cells[status.id]) : null;
          const rule = ruleFor(pm, r, tags, today);
          return (
            <button key={r.id} className={'gcard' + (r.archived ? ' archived' : '')} style={rule ? { borderColor: COLORS[rule.color][1] } : undefined} onClick={() => onOpen(r.id)}>
              <div className="gcover">{cover ? <img src={state.assets[cover].data} alt="" /> : <span>{rowTitle(pm, r, tags).slice(0, 1).toUpperCase()}</span>}</div>
              <div className="gbody">
                <b className={rule?.bold ? 'bold' : ''}>{rowTitle(pm, r, tags)}</b>
                {si && <span className="pill" style={{ background: COLORS[si.ph.color][0], color: COLORS[si.ph.color][1] }}>{si.st.name}</span>}
                {extra.map((c) => { const t = cellText(pm, c, r, tags); return t ? <span key={c.id} className="small muted ellipsis">{c.name}: {t}</span> : null; })}
                {prog && <div className="progress"><span style={{ width: progress(pm, prog, r) + '%' }} /></div>}
              </div>
            </button>
          );
        })}
        {!rows.length && <div className="empty">{t('pm.gallery.empty')}</div>}
      </div>
    </div>
  );
}

/** Selector de fecha: calendario mensual, interruptor «Rango», «Hoy» y «Quitar fecha». */
function DatePick({ value, onChange, onClose }: { value: DateVal; onChange: (v: CellVal) => void; onClose: () => void }) {
  const [range, setRange] = useState(!!value.end);
  const [waiting, setWaiting] = useState(false);
  const todayK = dayKey(new Date());
  const [month, setMonth] = useState(() => { const d = value.start ? new Date(value.start + 'T00:00') : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = (month.getDay() + 6) % 7;
  const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(0), ...Array.from({ length: n }, (_, i) => i + 1)];
  const key = (d: number) => dayKey(new Date(month.getFullYear(), month.getMonth(), d));
  const pick = (k: string) => {
    if (!range) { onChange({ start: k, end: '' }); onClose(); return; }
    if (!waiting) { onChange({ start: k, end: '' }); setWaiting(true); return; }
    const s0 = value.start || k;
    onChange(k < s0 ? { start: k, end: s0 } : { start: s0, end: k });
    setWaiting(false); onClose();
  };
  const inRange = (k: string) => !!value.start && !!value.end && k >= value.start && k <= value.end;
  return (
    <div className="stack small-gap date-pop">
      <div className="row">
        <button className="icon-btn small" aria-label={t('pm.monthPrev')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
        <b className="grow center cap">{month.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</b>
        <button className="icon-btn small" aria-label={t('pm.monthNext')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="dp-grid">
        {[0, 1, 2, 3, 4, 5, 6].map((w) => <span key={w} className="small muted">{t(`pm.dp.wd.${w}` as Key)}</span>)}
        {cells.map((d, i) => d === 0 ? <span key={i} /> : <button key={i} className={'dp-day' + (key(d) === value.start || key(d) === value.end ? ' on' : inRange(key(d)) ? ' mid' : '') + (key(d) === todayK ? ' today' : '')} onClick={() => pick(key(d))}>{d}</button>)}
      </div>
      <label className="check-line small"><input type="checkbox" role="switch" checked={range} onChange={() => { setRange(!range); setWaiting(false); if (range) onChange({ start: value.start, end: '' }); }} /> {t('pm.dp.range')}</label>
      {range && <span className="small muted">{waiting ? t('pm.dp.rangeHintNow') : t('pm.dp.rangeHint')}</span>}
      <div className="row"><button className="link small" onClick={() => { onChange({ start: todayK, end: '' }); onClose(); }}>{t('pm.today')}</button><span className="grow" /><button className="link small" onClick={() => { onChange(null); onClose(); }}>{t('pm.dp.clear')}</button></div>
    </div>
  );
}
