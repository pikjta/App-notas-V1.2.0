import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../../App';
import { atBlockStart, blockIsEmpty, blockOf, caretIn, fixBlock, firstEmptyTask, indent, makeLink, makeWiki, normalize, pasteText, render, serialize, setKind, splitBlock, toggleInline } from '../../lib/richnote';
import type { Kind } from '../../lib/richnote';
import { splitWiki } from '../../lib/markdown';
import type { NoteCard } from '../../lib/model';
import { t } from '../../i18n';

/**
 * Nota con texto enriquecido: se ve y se edita con su formato, sin sintaxis Markdown. Por dentro se guarda
 * como Markdown (enlaces [[ ]], búsqueda, grafo y copias no cambian); la conversión está en lib/richnote.ts.
 */
export function NoteBody({ card }: { card: NoteCard }) {
  const { dispatch, resolveLink, linkTargets, editRequest, requestEdit } = useApp();
  const root = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  const saved = useRef<Range | null>(null);
  const [pick, setPick] = useState<{ node: Text; start: number; q: string; i: number } | null>(null);
  const [dlg, setDlg] = useState<{ q: string; cards: boolean } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [empty, setEmpty] = useState(!card.body.trim());
  const modal = useRef(false);
  modal.current = !!dlg || url !== null;

  // El Markdown guardado se pinta en el editor; si el cambio lo hizo el propio editor, no se repinta.
  useLayoutEffect(() => {
    const r = root.current;
    if (!r || last.current === card.body) return;
    render(r, card.body); last.current = card.body; setEmpty(!card.body.trim());
  }, [card.body]);
  // Se recuerda la selección para poder aplicar formato desde la barra o desde una ventana.
  useEffect(() => {
    const h = () => { const s = window.getSelection(); const r = root.current; if (s && s.rangeCount && r && r.contains(s.anchorNode)) saved.current = s.getRangeAt(0).cloneRange(); };
    document.addEventListener('selectionchange', h);
    return () => document.removeEventListener('selectionchange', h);
  }, []);
  // Nota del día recién creada: el cursor va a la primera tarea vacía o al final.
  useEffect(() => {
    if (editRequest !== card.id) return;
    requestEdit(null);
    const r = root.current;
    if (!r) return;
    r.focus();
    const t = firstEmptyTask(r);
    caretIn(t ?? (r.lastElementChild as HTMLElement), true);
  }, [editRequest, card.id, requestEdit]);

  const sync = () => {
    const r = root.current;
    if (!r) return;
    normalize(r);
    const md = serialize(r);
    setEmpty(!md.trim());
    if (md !== last.current) { last.current = md; dispatch({ t: 'patchCard', id: card.id, patch: { body: md } }); }
  };
  const range = (): Range | null => {
    const s = window.getSelection(); const r = root.current;
    if (s && s.rangeCount && r && r.contains(s.anchorNode)) return s.getRangeAt(0);
    return saved.current && r?.contains(saved.current.startContainer) ? saved.current : null;
  };
  /** Ejecuta una acción de formato sobre la selección (o al final de la nota si no hay). */
  const act = (fn: (r: Range, el: HTMLElement) => void) => {
    const el = root.current;
    if (!el) return;
    let r = range();
    if (!r) { el.focus(); caretIn(el.lastElementChild as HTMLElement, true); r = window.getSelection()!.getRangeAt(0); }
    else if (document.activeElement !== el) { el.focus(); const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r); }
    fn(r, el); sync();
  };
  const kind = (k: Kind) => act((r, el) => setKind(el, r, k));
  const inlineFmt = (tag: 'strong' | 'em' | 's' | 'code') => act((r, el) => toggleInline(el, r, tag));

  // Selector de enlaces: se abre al escribir «[[»; `start` es donde empieza lo que se busca.
  const targets = pick ? linkTargets(pick.q) : [];
  const wikiAt = (node: Text, from: number, to: number, dest: string, label: string) => {
    node.deleteData(from, to - from);
    const r = document.createRange();
    r.setStart(node, from); r.collapse(true);
    const w = makeWiki(dest, label);
    r.insertNode(w);
    const after = document.createTextNode('\u200b');
    w.after(after);
    const c = document.createRange(); c.setStart(after, 1); c.collapse(true);
    const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(c);
  };
  const insertLink = (dest: string) => {
    if (!pick) return;
    const caret = window.getSelection()?.anchorOffset ?? pick.start + pick.q.length;
    const to = Math.max(pick.start, Math.min(caret, pick.node.length));
    setPick(null);
    wikiAt(pick.node, pick.start - 2, to, dest, splitWiki(dest).label);
    sync();
  };
  const watchLink = () => {
    const s = window.getSelection();
    const n = s?.anchorNode;
    if (!s || !s.isCollapsed || !n || n.nodeType !== 3) { setPick(null); return; }
    const node = n as Text, off = s.anchorOffset;
    if (node.data.slice(off - 2, off) === '[[') { setPick({ node, start: off, q: '', i: 0 }); return; }
    if (pick) {
      const q = pick.node === node ? node.data.slice(pick.start, off) : '\n';
      if (pick.node !== node || off < pick.start || /[\]\n]/.test(q)) setPick(null); else setPick({ ...pick, q, i: 0 });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = root.current!;
    if (pick && targets.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPick({ ...pick, i: Math.min(targets.length - 1, pick.i + 1) }); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setPick({ ...pick, i: Math.max(0, pick.i - 1) }); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertLink(targets[pick.i].dest); return; }
    }
    if (pick && e.key === 'Escape') { e.preventDefault(); setPick(null); return; }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); inlineFmt('strong'); return; }
    if (mod && !e.altKey && e.key.toLowerCase() === 'i') { e.preventDefault(); inlineFmt('em'); return; }
    if (e.key === 'Escape') { el.blur(); return; }
    const s = window.getSelection();
    if (!s || !s.rangeCount) return;
    const r = s.getRangeAt(0);
    const b = blockOf(r.startContainer, el);
    if (!b) return;
    const k = b.dataset.k as Kind;
    if (e.key === 'Enter' && !mod) {
      e.preventDefault();
      if ((k === 'li' || k === 'ol' || k === 'task') && r.collapsed && blockIsEmpty(b)) { setKind(el, r, k); fixBlock(b); caretIn(b, true); sync(); return; }
      const nb = splitBlock(b, r);
      caretIn(nb, false); sync();
      return;
    }
    if (e.key === 'Backspace' && k !== 'p' && k !== 'hr' && atBlockStart(b, r)) { e.preventDefault(); setKind(el, r, k); caretIn(b, false); sync(); return; }
    if (e.key === 'Tab' && !mod && (k === 'li' || k === 'ol' || k === 'task')) { e.preventDefault(); indent(el, r, e.shiftKey ? -1 : 1); sync(); }
  };
  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData?.getData('text/plain') ?? '';
    e.preventDefault();
    const r = range();
    if (!text || !r || !root.current) return;
    const lb = pasteText(root.current, r, text);
    if (lb) caretIn(lb, true);
    sync();
  };
  const onCopy = (e: React.ClipboardEvent<HTMLDivElement>, cut: boolean) => {
    const r = range();
    if (!r || r.collapsed) return;
    e.preventDefault();
    const tmp = document.createElement('div');
    tmp.append(r.cloneContents());
    normalize(tmp);
    e.clipboardData?.setData('text/plain', serialize(tmp));
    if (cut) { r.deleteContents(); const b = blockOf(r.startContainer, root.current!); if (b) fixBlock(b); sync(); }
  };
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const w = t.closest('.wiki') as HTMLElement | null;
    if (w) { e.stopPropagation(); const r = resolveLink(w.dataset.dest ?? ''); if (r.ok) r.go(); return; }
    const m = t.closest('.rn-mark[data-mark="task"]');
    if (m) { const b = m.parentElement as HTMLElement; if (b.dataset.done) delete b.dataset.done; else b.dataset.done = '1'; fixBlock(b); sync(); return; }
    const a = t.closest('a.ext') as HTMLElement | null;
    if (a) { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('cuaderno:open-url', { detail: a.dataset.url ?? '' })); }
  };

  const noteBar = (
    <div className="mini-bar" role="toolbar" aria-label={t('card.note.formatLabel')} onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('input')) e.preventDefault(); }}>
      <button onClick={() => kind('h2')} title={t('card.note.title')} aria-label={t('card.note.title')}>H</button>
      <button onClick={() => inlineFmt('strong')} title={t('card.note.bold')}><b>B</b></button>
      <button onClick={() => inlineFmt('em')} title={t('card.note.italic')}><i>I</i></button>
      <button onClick={() => inlineFmt('s')} title={t('card.note.strike')}><s>S</s></button>
      <button onClick={() => inlineFmt('code')} title={t('card.note.code')} aria-label={t('card.note.code')}>{'<>'}</button>
      <button onClick={() => kind('li')} title={t('card.note.list')} aria-label={t('card.note.list')}>•</button>
      <button onClick={() => kind('task')} title={t('card.note.task')} aria-label={t('card.note.task')}>☐</button>
      <button onClick={() => kind('quote')} title={t('card.note.quote')} aria-label={t('card.note.quote')}>❝</button>
      <button title={t('card.note.link')} aria-label={t('card.note.link')} onClick={() => { range(); setUrl('https://'); }}>🔗</button>
      <button title={t('card.note.wikiLink')} aria-label={t('card.note.wikiLink')} onClick={() => { range(); setDlg({ q: '', cards: true }); }}>[[ ]]</button>
    </div>
  );

  /** Selección guardada (o el final de la nota si no hay ninguna) lista para insertar algo. */
  const restore = (): Range | null => {
    const el = root.current;
    if (!el) return null;
    el.focus();
    const s = window.getSelection()!;
    if (saved.current && el.contains(saved.current.startContainer)) { s.removeAllRanges(); s.addRange(saved.current); } else caretIn(el.lastElementChild as HTMLElement, true);
    return s.getRangeAt(0);
  };
  const back = () => window.setTimeout(() => { const s = window.getSelection(); const r = saved.current; root.current?.focus(); if (r && s) { s.removeAllRanges(); s.addRange(r); } }, 0);

  return (
    <div className="note-edit">
      {noteBar}
      <div
        ref={root}
        className="note-rich"
        contentEditable
        suppressContentEditableWarning
        tabIndex={0}
        role="textbox"
        aria-multiline="true"
        aria-label={t('card.note.content')}
        data-empty={empty ? '1' : undefined}
        data-ph={t('card.note.empty')}
        spellCheck
        onInput={() => { sync(); watchLink(); }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onCopy={(e) => onCopy(e, false)}
        onCut={(e) => onCopy(e, true)}
        onClick={onClick}
        onBlur={() => { if (modal.current) return; setPick(null); const r = root.current; if (r) { const md = serialize(r); render(r, md); last.current = md; } }}
      />
      {url !== null && (
        <div className="link-dlg" role="dialog" aria-label={t('card.note.link')}>
          <h3>{t('card.note.link')}</h3>
          <input autoFocus value={url} aria-label={t('card.note.urlLabel')} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.stopPropagation(); setUrl(null); back(); }
              if (e.key === 'Enter') { e.preventDefault(); const v = url.trim(); setUrl(null); if (v) { const r = restore(); if (r) { makeLink(r, v); sync(); } } back(); }
            }} />
          <div className="row-end"><button className="tool small-btn" onClick={() => { setUrl(null); back(); }}>{t('card.cancel')}</button></div>
        </div>
      )}
      {dlg && (() => {
        const all = linkTargets(dlg.q).filter((t) => dlg.cards || t.label === t.dest || t.dest.startsWith('Diario/'));
        const dailyLabel = t('card.note.dailyLabel');
        const close = () => { setDlg(null); back(); };
        const choose = (t: { dest: string; label: string }) => {
          setDlg(null);
          const r = restore();
          if (r) {
            const s = window.getSelection()!;
            r.deleteContents();
            const w = makeWiki(t.dest, t.dest.startsWith('Diario/') ? dailyLabel : t.label);
            r.insertNode(w);
            const after = document.createTextNode('\u200b'); w.after(after);
            const c = document.createRange(); c.setStart(after, 1); c.collapse(true); s.removeAllRanges(); s.addRange(c);
            sync();
          }
        };
        return (
          <div className="link-dlg" role="dialog" aria-label={t('card.note.linkTo')}>
            <h3>{t('card.note.linkTo')}</h3>
            <input autoFocus value={dlg.q} placeholder={t('card.note.searchPh')} aria-label={t('card.note.searchLabel')} onChange={(e) => setDlg({ ...dlg, q: e.target.value })} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } if (e.key === 'Enter' && all[0]) choose(all[0]); }} />
            <label className="small"><input type="checkbox" checked={dlg.cards} onChange={(e) => setDlg({ ...dlg, cards: e.target.checked })} /> {t('card.note.includeCards')}</label>
            <div className="link-pick static" role="listbox">
              {all.length === 0 && <div className="muted small pad">{t('card.note.noMatch')}</div>}
              {all.map((t) => (
                <button key={t.dest} role="option" aria-selected="false" onClick={() => choose(t)}>
                  <span className="dot" style={{ background: t.color }} /><span className="grow">{t.label}</span><span className="small muted">{t.kind}</span>
                </button>
              ))}
            </div>
            <div className="row-end"><button className="tool small-btn" onClick={close}>{t('card.cancel')}</button></div>
          </div>
        );
      })()}
      {pick && (
        <div className="link-pick" role="listbox" aria-label={t('card.note.linkWith')} onMouseDown={(e) => e.preventDefault()}>
          {targets.length === 0 && <div className="muted small pad">{t('card.note.noMatchQ', { q: pick.q })}</div>}
          {targets.map((t, k) => (
            <button key={t.dest} role="option" aria-selected={k === pick.i} className={k === pick.i ? 'on' : ''} onClick={() => insertLink(t.dest)}>
              <span className="dot" style={{ background: t.color }} /><span className="grow">{t.label}</span><span className="small muted">{t.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
