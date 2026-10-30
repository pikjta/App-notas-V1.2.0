import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SuggestList } from '../SuggestList';
import { FormatBar } from '../FormatBar';
import { fmtStyle } from '../../lib/format';
import type { CellFmt } from '../../lib/format';
import { useApp } from '../../App';
import type { TableCard } from '../../lib/model';
import { uid } from '../../lib/model';
import { FormulaErrorDialog } from '../FormulaErrorDialog';
import { functionHelp } from '../../lib/formula';
import { t } from '../../i18n';
import { calcCell, cellName, isFormula, showValue } from '../../lib/tablecalc';
import { allOf, GRID_MIME, inRect, isAll, isSingle, parseTsv, pastePlan, rectOf, step, suggest, toTsv } from '../../lib/grid';
import type { Pos, Sel } from '../../lib/grid';

type Edit = { pos: Pos; text: string; orig: string };

/**
 * Tabla como una hoja de cálculo: un clic selecciona la celda, doble clic (o F2, o escribir) la edita,
 * las flechas se mueven, Mayús o arrastrar amplían el rango, Ctrl+A elige toda la tabla (con las cabeceras),
 * Ctrl+C / X / V copian, cortan y pegan rangos como en Excel, y al escribir se sugieren palabras de la columna.
 * La fila -1 son las cabeceras.
 */
export function TableBody({ card }: { card: TableCard }) {
  const { dispatch, undo, redo } = useApp();
  const [sel, setSel] = useState<Sel | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [hint, setHint] = useState(-1);
  const proxy = useRef<HTMLTextAreaElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLInputElement>(null);
  const down = useRef(false);
  const [errDlg, setErrDlg] = useState<{ r: number; c: number } | null>(null);

  const dims = { minRow: -1, rows: card.rows.length, cols: card.heads.length };
  const valueAt = (r: number, c: number) => (r < 0 ? card.heads[c] : card.rows[r]?.cells[c]) ?? '';
  const fmtAt = (r: number, c: number): CellFmt | undefined => (r < 0 ? card.headFmt?.[c] : card.rows[r]?.fmt?.[c]) ?? undefined;
  // Al copiar se lleva el resultado de las fórmulas (no la fórmula), así se puede pegar en cualquier otra tabla.
  const copyAt = (r: number, c: number) => { const v = valueAt(r, c); return isFormula(v) ? showValue(calcCell(card, r, c).value) : v; };
  const matrix = (s: Sel, forCopy = false) => { const rc = rectOf(s); const m: string[][] = []; for (let r = rc.r0; r <= rc.r1; r++) { const line: string[] = []; for (let c = rc.c0; c <= rc.c1; c++) line.push(forCopy ? copyAt(r, c) : valueAt(r, c)); m.push(line); } return m; };
  const putClip = (dt: DataTransfer | null, s: Sel) => { if (!dt) return; dt.setData('text/plain', toTsv(matrix(s, true))); if (rectOf(s).r0 < 0) dt.setData(GRID_MIME, 'header'); };

  // Sin editar, el foco está en un cuadro oculto: así copiar, cortar, pegar y el teclado funcionan igual en todos los sistemas.
  useLayoutEffect(() => { if (sel && !edit) proxy.current?.focus({ preventScroll: true }); }, [sel, edit]);
  // La celda activa siempre se ve.
  useEffect(() => {
    if (!sel || !wrap.current) return;
    (wrap.current.querySelector(`[data-r="${sel.b.r}"][data-c="${sel.b.c}"]`) as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [sel]);
  useEffect(() => {
    const up = () => { down.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const words = useMemo(() => (edit && edit.pos.r >= 0 ? card.rows.filter((_, i) => i !== edit.pos.r).map((r) => r.cells[edit.pos.c] ?? '').filter((w) => !isFormula(w)) : []), [card.rows, edit?.pos.r, edit?.pos.c]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = edit ? suggest(edit.text, words) : [];
  const select = (a: Pos, b: Pos = a) => setSel({ a, b });
  const startEdit = (pos: Pos, text?: string) => { select(pos); setHint(-1); setEdit({ pos, text: text ?? valueAt(pos.r, pos.c), orig: valueAt(pos.r, pos.c) }); };
  const commit = (e: Edit | null = edit, to?: string) => {
    if (!e) return;
    const text = to ?? e.text;
    if (text !== e.orig) {
      if (e.pos.r < 0) dispatch({ t: 'tableHead', card: card.id, col: e.pos.c, value: text });
      else { const row = card.rows[e.pos.r]; if (row) dispatch({ t: 'tableCell', card: card.id, row: row.id, col: e.pos.c, value: text }); }
    }
    setEdit(null);
  };
  const write = (r0: number, c0: number, data: string[][]) => {
    const need = Math.max(0, r0 + data.length - card.rows.length);
    dispatch({ t: 'tableSetRange', card: card.id, r0, c0, data, ids: Array.from({ length: need }, () => uid('row')) });
    select({ r: r0, c: c0 }, { r: r0 + data.length - 1, c: c0 + Math.max(...data.map((l) => l.length)) - 1 });
  };
  const clear = (s: Sel) => { const m = matrix(s).map((l) => l.map(() => '')); const rc = rectOf(s); write(rc.r0, rc.c0, m); };
  /** Mueve la celda activa una fila (Enter) o una columna (Tab); al pasar de la última fila, crea una. */
  const moveFrom = (p: Pos, dr: number, dc: number, grow: boolean) => {
    if (grow && dr > 0 && p.r === card.rows.length - 1) { const id = uid('row'); dispatch({ t: 'tableAddRow', card: card.id, id }); select({ r: p.r + 1, c: p.c }); return; }
    select({ r: Math.max(-1, Math.min(card.rows.length - 1, p.r + dr)), c: Math.max(0, Math.min(card.heads.length - 1, p.c + dc)) });
  };

  const onProxyKey = (e: React.KeyboardEvent) => {
    if (!sel) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
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
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); clear(sel); return; }
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); setSel(null); return; }
    // Escribir sobre una celda la edita, empezando de cero.
    if (k.length === 1 && ((!e.ctrlKey && !e.metaKey) || (e.ctrlKey && e.altKey))) { e.preventDefault(); startEdit(sel.a, k); }
  };

  const accept = (s: string) => { if (edit) setEdit({ ...edit, text: s }); setHint(-1); };
  const onEditKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!edit) return;
    e.stopPropagation();
    const k = e.key;
    const pos = edit.pos;
    const chosen = hint >= 0 ? list[hint] : undefined;
    if (k === 'Escape') { e.preventDefault(); setEdit(null); return; }
    if (k === 'Enter') { e.preventDefault(); commit(edit, chosen ?? edit.text); moveFrom(pos, e.shiftKey ? -1 : 1, 0, true); return; }
    if (k === 'Tab') { e.preventDefault(); commit(edit, chosen ?? edit.text); moveFrom(pos, 0, e.shiftKey ? -1 : 1, false); return; }
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      if (list.length && (k === 'ArrowDown' || hint >= 0)) { setHint(Math.max(-1, Math.min(list.length - 1, hint + (k === 'ArrowDown' ? 1 : -1)))); return; }
      commit(); moveFrom(pos, k === 'ArrowDown' ? 1 : -1, 0, false);
    }
  };

  const cellDown = (e: React.MouseEvent, pos: Pos) => {
    if (e.button !== 0 || (e.target as Element).closest('button')) return;
    if (edit && edit.pos.r === pos.r && edit.pos.c === pos.c) return; // dentro de la celda que se edita: el cursor del cuadro de texto
    commit();
    e.preventDefault();
    down.current = true;
    if (e.shiftKey && sel) setSel({ a: sel.a, b: pos }); else select(pos);
    proxy.current?.focus({ preventScroll: true });
  };
  const cellEnter = (pos: Pos) => { if (down.current && sel) setSel({ a: sel.a, b: pos }); };

  const rc = sel ? rectOf(sel) : null;
  const cls = (r: number, c: number) => (rc && inRect(rc, r, c) ? 'sel' : '') + (sel && sel.a.r === r && sel.a.c === c ? ' cur' : '');
  const cellProps = (r: number, c: number) => ({
    'data-r': r, 'data-c': c, 'data-ref': cellName(r, c), className: cls(r, c) + (edit && edit.pos.r === r && edit.pos.c === c ? ' editing' : ''), role: 'gridcell' as const, 'aria-selected': !!(rc && inRect(rc, r, c)),
    onMouseDown: (e: React.MouseEvent) => cellDown(e, { r, c }), onMouseEnter: () => cellEnter({ r, c }), onDoubleClick: (e: React.MouseEvent) => { if (!(e.target as Element).closest('button')) startEdit({ r, c }); },
  });
  /** Contenido de una celda: su texto o, si empieza por «=», el resultado de la fórmula. */
  const body = (r: number, c: number) => {
    const raw = valueAt(r, c);
    const st = fmtStyle(fmtAt(r, c));
    if (!isFormula(raw)) return <div className="tbl-text" style={st}>{raw}</div>;
    const res = calcCell(card, r, c);
    if (res.error) return <div className="tbl-text formula err"><button className="tbl-err" title={t('calc.tb.errTitle', { error: res.error })} onClick={() => setErrDlg({ r, c })}>{t('calc.tb.errBtn')}</button></div>;
    return <div className="tbl-text formula" style={st} title={raw}>{showValue(res.value)}</div>;
  };
  const editing = (r: number, c: number) => !!edit && edit.pos.r === r && edit.pos.c === c;
  const editorEl = (label: string, f?: CellFmt) => edit && (
    <input ref={editor} className="tbl-edit" style={fmtStyle(f)} value={edit.text} aria-label={label} autoFocus spellCheck={false}
      onFocus={(e) => { const n = e.currentTarget.value.length; e.currentTarget.setSelectionRange(n, n); }}
      onChange={(e) => { setEdit({ ...edit, text: e.target.value }); setHint(-1); }}
      onKeyDown={onEditKey} onBlur={() => commit()} />
  );

  return (
    <div className="tbl-wrap" ref={wrap} role="grid" aria-label={t('calc.view.table')} aria-multiselectable="true"
      onBlur={(e) => { const to = e.relatedTarget as Element | null; if (!e.currentTarget.contains(to) && !to?.closest?.('.modal-back, .tbl-suggest')) { commit(); setSel(null); } }}>
      {(() => {
        const cells: { r: number; c: number }[] = [];
        if (rc) for (let r = Math.max(rc.r0, -1); r <= Math.min(rc.r1, card.rows.length - 1); r++) for (let c = rc.c0; c <= Math.min(rc.c1, card.heads.length - 1); c++) cells.push({ r, c });
        return <FormatBar align fmts={cells.map((x) => fmtAt(x.r, x.c))} disabled={!cells.length} label={t('calc.tb.fmtLabel')}
          onPatch={(patch) => dispatch({ t: 'tableFormat', card: card.id, cells, patch })} onAfter={() => proxy.current?.focus({ preventScroll: true })} />;
      })()}
      {sel && <div className="tbl-fbar" aria-label={t('calc.tb.activeCell')}><b>{cellName(sel.b.r, sel.b.c)}</b><span className="fx">ƒx</span><code title={functionHelp()}>{valueAt(sel.b.r, sel.b.c)}</code></div>}
      <table className="tbl">
        <thead>
          <tr>
            {card.heads.map((_h, i) => (
              <th key={i} {...cellProps(-1, i)} aria-label={editing(-1, i) ? undefined : t('calc.tb.colName', { n: i + 1 })}>
                <div className="th">
                  {editing(-1, i) ? editorEl(t('calc.tb.colName', { n: i + 1 }), fmtAt(-1, i)) : body(-1, i)}
                  {card.heads.length > 1 && <button className="x" aria-label={t('calc.tb.delCol')} title={t('calc.tb.delCol')} onClick={() => dispatch({ t: 'tableRemoveCol', card: card.id, col: i })}>×</button>}
                </div>
              </th>
            ))}
            <th className="tbl-add"><button aria-label={t('calc.tb.addCol')} title={t('calc.tb.addCol')} onClick={() => dispatch({ t: 'tableAddCol', card: card.id })}>+</button></th>
          </tr>
        </thead>
        <tbody>
          {card.rows.map((r, ri) => (
            <tr key={r.id}>
              {r.cells.map((_v, ci) => (
                <td key={ci} {...cellProps(ri, ci)} aria-label={editing(ri, ci) ? undefined : t('calc.tb.cellLabel', { n: ri + 1, head: card.heads[ci] })}>
                  {editing(ri, ci) ? editorEl(t('calc.tb.cellLabel', { n: ri + 1, head: card.heads[ci] }), fmtAt(ri, ci)) : body(ri, ci)}
                </td>
              ))}
              <td className="tbl-add">{card.rows.length > 1 && <button className="x" aria-label={t('calc.tb.delRow')} title={t('calc.tb.delRow')} onClick={() => dispatch({ t: 'tableRemoveRow', card: card.id, row: r.id })}>×</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="link small" onClick={() => { const id = uid('row'); dispatch({ t: 'tableAddRow', card: card.id, id }); select({ r: card.rows.length, c: 0 }); }}>{t('calc.tb.addRow')}</button>
      <textarea ref={proxy} className="grid-proxy" tabIndex={-1} aria-label={t('calc.tb.proxyLabel')} onKeyDown={onProxyKey}
        onChange={(e) => { e.currentTarget.value = ''; }}
        onCopy={(e) => { if (!sel) return; e.preventDefault(); putClip(e.clipboardData, sel); }}
        onCut={(e) => { if (!sel) return; e.preventDefault(); putClip(e.clipboardData, sel); clear(sel); }}
        onPaste={(e) => {
          if (!sel) return;
          const text = e.clipboardData?.getData('text/plain') ?? '';
          if (!text) return;
          e.preventDefault();
          const plan = pastePlan(sel, parseTsv(text));
          write(plan.at.r, plan.at.c, plan.data);
        }} />
      {edit && <SuggestList anchor={editor.current} items={list} hint={hint} watch={edit.text} onPick={(s) => { accept(s); editor.current?.focus(); }} />}
      {errDlg && (() => { const res = calcCell(card, errDlg.r, errDlg.c); return res.error ? <FormulaErrorDialog error={res.error} formula={valueAt(errDlg.r, errDlg.c)} where={t('calc.tb.cellWhere', { name: cellName(errDlg.r, errDlg.c) })} onClose={() => { setErrDlg(null); proxy.current?.focus({ preventScroll: true }); }} onEdit={() => startEdit({ r: errDlg.r, c: errDlg.c })} /> : null; })()}
      {sel && !edit && isAll(sel, dims) && !isSingle(sel) && <span className="sr-only" aria-live="polite">{t('calc.tb.allSelected')}</span>}
    </div>
  );
}
