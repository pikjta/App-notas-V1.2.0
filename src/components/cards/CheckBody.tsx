import { FormatBar } from '../FormatBar';
import { fmtStyle } from '../../lib/format';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../../App';
import type { CheckCard, CheckItem } from '../../lib/model';
import { uid } from '../../lib/model';
import { MAX_LEVEL, blockRange, caretAtEdge, checklistToMarkdown, descEnd, effective, looksLikeList, parseChecklist, shiftSubtree, visibleIds } from '../../lib/checklist';
import { t } from '../../i18n';

/** Ajusta la altura del cuadro al texto (el texto largo se parte en varias líneas). */
function fit(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/** Selección de varias tareas (con Ctrl+A, arrastrando con el ratón o con Mayús): de la tarea `a` a la `b`. */
type Sel = { a: string; b: string };

export function CheckBody({ card }: { card: CheckCard }) {
  const { dispatch } = useApp();
  const items = card.items;
  const done = items.filter((i) => i.done && i.text).length;
  const total = items.filter((i) => i.text).length;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Sel | null>(null);
  const selRef = useRef<Sel | null>(null);
  selRef.current = sel;
  const root = useRef<HTMLDivElement>(null);
  const proxy = useRef<HTMLTextAreaElement>(null);
  const lastFocus = useRef<string | null>(null);
  const [cur, setCur] = useState<string | null>(null);
  const anchor = useRef<string | null>(null); // fila donde se pulsó el ratón
  const down = useRef(false);                 // ratón pulsado dentro de la lista
  const [ranging, setRanging] = useState(false);
  // El foco pasa al elemento nuevo en cuanto existe (antes de que llegue la siguiente tecla).
  const pending = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (pending.current) { document.getElementById('it-' + pending.current)?.focus(); pending.current = null; }
    root.current?.querySelectorAll<HTMLTextAreaElement>('textarea.check-text').forEach(fit);
  }, [card.items]);
  const focus = (id: string) => { pending.current = id; if (document.getElementById('it-' + id)) { document.getElementById('it-' + id)?.focus(); pending.current = null; } };
  const focusEnd = (id: string) => { const el = document.getElementById('it-' + id) as HTMLTextAreaElement | null; if (el) { el.focus(); const n = el.value.length; el.setSelectionRange(n, n); } };

  const eff = effective(items);
  const visible = visibleIds(items, collapsed);
  const shown = new Set(visible);
  const range = sel ? blockRange(items, collapsed, sel.a, sel.b) : null;
  const selected = new Set(range ? items.slice(range[0], range[1] + 1).map((i) => i.id) : []);
  const block = range ? items.slice(range[0], range[1] + 1) : [];

  // Con tareas seleccionadas, un cuadro de texto oculto guarda la lista en Markdown y tiene el foco:
  // así copiar, cortar y pegar funcionan igual en todos los sistemas (aunque no haya texto seleccionado a la vista).
  useLayoutEffect(() => {
    const p = proxy.current;
    if (!p || !sel) return;
    p.value = checklistToMarkdown(block);
    p.focus({ preventScroll: true });
    p.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, card.items]);
  // Si el ratón se suelta fuera de la lista, termina el arrastre igualmente.
  useEffect(() => {
    const up = (ev: MouseEvent) => { down.current = false; setRanging(false); if ((ev.target as Element | null)?.closest?.('.modal-back')) return; if (selRef.current) window.setTimeout(() => { const p = proxy.current; if (p && selRef.current) { p.focus({ preventScroll: true }); p.select(); } }, 0); };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const set = (next: CheckItem[]) => dispatch({ t: 'setCheckItems', card: card.id, items: next.length ? next : [{ id: uid('it'), text: '', done: false, level: 0 }] });
  const addTask = () => { const id = uid('it'); dispatch({ t: 'addCheckItem', card: card.id, after: null, id, level: 0 }); focus(id); };
  const addSub = (parentId: string) => {
    const idx = items.findIndex((i) => i.id === parentId);
    if (idx < 0 || items[idx].level >= MAX_LEVEL) return;
    const id = uid('it');
    dispatch({ t: 'addCheckItem', card: card.id, after: items[descEnd(items, idx) - 1].id, id, level: items[idx].level + 1 });
    setCollapsed((c) => { const n = new Set(c); n.delete(parentId); return n; });
    focus(id);
  };
  const move = (from: string, dir: -1 | 1) => {
    const i = visible.indexOf(from) + dir;
    if (i >= 0 && i < visible.length) { focusEnd(visible[i]); return true; }
    return false;
  };

  // --- Selección ---------------------------------------------------------------------------
  // Al salir de la selección con el teclado, el foco vuelve enseguida a la última tarea usada: así la tecla
  // pulsada (una letra, por ejemplo) se escribe allí y no en el cuadro oculto.
  const clearSel = (refocus = false) => {
    setSel(null);
    if (refocus && lastFocus.current) focusEnd(lastFocus.current);
  };
  const selectAll = () => { if (items.length) setSel({ a: items[0].id, b: items[items.length - 1].id }); };
  const removeBlock = () => {
    if (!range) return;
    const after = items[range[1] + 1] ?? items[range[0] - 1];
    set([...items.slice(0, range[0]), ...items.slice(range[1] + 1)]);
    setSel(null);
    if (after) window.setTimeout(() => focusEnd(after.id), 0);
  };
  /** Pega varias líneas: sustituyen a la selección o a la tarea (vacía) donde está el cursor. */
  const pasteList = (text: string, current: CheckItem | null): boolean => {
    const fresh = parseChecklist(text, () => uid('it'));
    if (!fresh.length) return false;
    if (range) {
      const off = items[range[0]].level;
      set([...items.slice(0, range[0]), ...fresh.map((f) => ({ ...f, level: f.level + off })), ...items.slice(range[1] + 1)]);
    } else if (current) {
      const at = items.findIndex((i) => i.id === current.id);
      const grown = fresh.map((f) => ({ ...f, level: f.level + current.level }));
      if (current.text === '') set([...items.slice(0, at), ...grown, ...items.slice(at + 1)]); // la tarea vacía se sustituye
      else { const end = descEnd(items, at); set([...items.slice(0, end), ...grown, ...items.slice(end)]); } // si no, va debajo de ella y sus subtareas
    } else return false;
    setSel(null);
    window.setTimeout(() => focusEnd(fresh[fresh.length - 1].id), 0);
    return true;
  };

  const rowId = (t: EventTarget | null) => (t instanceof Element ? (t.closest('[data-item]') as HTMLElement | null)?.dataset.item ?? null : null);
  const enterRow = (id: string) => {
    if (!down.current) return;
    if (!anchor.current) anchor.current = id;
    if (!ranging && id === anchor.current) return; // todavía dentro de la primera fila: es una selección de texto normal
    if (!ranging) {
      setRanging(true);
      window.getSelection()?.removeAllRanges();
      const act = document.activeElement;
      if (act instanceof HTMLTextAreaElement) act.setSelectionRange(act.selectionEnd, act.selectionEnd);
    }
    setSel({ a: anchor.current, b: id });
  };

  // Los eventos del selector de color (que cuelga de la tarjeta por React, aunque está fuera en la página) no son de la lista.
  const outside = (e: React.SyntheticEvent) => !(e.currentTarget as Element).contains(e.target as Node);
  const onKeyDownCapture = (e: React.KeyboardEvent) => {
    if (outside(e)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); e.stopPropagation(); selectAll(); return; }
    if (!sel) return;
    if (e.target === proxy.current) {
      if (mod && ['c', 'x', 'v'].includes(e.key.toLowerCase())) return; // lo hace el portapapeles
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); removeBlock(); return; }
      if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault(); e.stopPropagation();
        const i = visible.indexOf(sel.b) + (e.key === 'ArrowDown' ? 1 : -1);
        if (i >= 0 && i < visible.length) setSel({ a: sel.a, b: visible[i] });
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); const id = e.key === 'ArrowUp' ? items[range![0]].id : items[range![1]].id; setSel(null); window.setTimeout(() => focusEnd(id), 0); return; }
      if (['Shift', 'Control', 'Meta', 'Alt'].includes(e.key)) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); clearSel(true); return; }
      // Cualquier otra tecla vuelve a la tarea donde se estaba escribiendo, y esa tecla se escribe allí.
      clearSel(true);
    }
  };

  return (
    <div className={'check' + (selected.size ? ' has-sel' : '') + (ranging ? ' ranging' : '')} ref={root} tabIndex={-1} data-testid="check"
      onKeyDownCapture={onKeyDownCapture}
      onMouseDown={(e) => {
        if (e.target === proxy.current || outside(e) || (e.target as Element).closest('.fmt-bar')) return;
        // Pulsar en otra parte termina la selección de tareas; con Mayús se amplía desde la última tarea usada.
        if (e.shiftKey && lastFocus.current) {
          const id = rowId(e.target);
          if (id) { e.preventDefault(); setSel({ a: sel?.a ?? lastFocus.current, b: id }); return; }
        }
        const t = e.target as Element;
        anchor.current = rowId(t);
        down.current = !t.closest('button, input[type="checkbox"]');
        if (sel) setSel(null);
      }}
      onMouseUp={(e) => {
        if (outside(e)) return;
        down.current = false; setRanging(false);
        // Al soltar el ratón con tareas seleccionadas, el foco vuelve al cuadro oculto para que Ctrl+C copie.
        if (sel) window.setTimeout(() => { const p = proxy.current; if (p) { p.focus({ preventScroll: true }); p.select(); } }, 0);
      }}
      onCopy={(e) => { if (!outside(e) && sel && block.length) { e.preventDefault(); e.clipboardData?.setData('text/plain', checklistToMarkdown(block)); } }}
      onCut={(e) => { if (!outside(e) && sel && block.length) { e.preventDefault(); e.clipboardData?.setData('text/plain', checklistToMarkdown(block)); window.setTimeout(removeBlock, 0); } }}>
      {(() => {
        // El formato va a las tareas seleccionadas o, si no hay, a la última donde se escribió.
        const ids = sel ? block.map((x) => x.id) : cur && items.some((x) => x.id === cur) ? [cur] : [];
        const fmts = ids.map((id) => items.find((x) => x.id === id)?.fmt);
        return <FormatBar fmts={fmts} disabled={!ids.length} label={t('card.check.formatLabel')}
          onPatch={(patch) => dispatch({ t: 'checkFormat', card: card.id, ids, patch })}
          onAfter={() => { if (sel) { proxy.current?.focus({ preventScroll: true }); proxy.current?.select(); } else if (cur) document.getElementById('it-' + cur)?.focus(); }} />;
      })()}
      {total > 0 && (
        <div className="progress-row">
          <div className="progress" aria-label={t('card.check.progress', { done, total })}><span style={{ width: `${Math.round((done / total) * 100)}%` }} /></div>
          <span className="small muted">{done}/{total}</span>
        </div>
      )}
      {items.map((it, i) => {
        if (!shown.has(it.id)) return null;
        const kids = eff.hasKids[i];
        const checked = eff.done[i];
        const partial = kids && eff.leavesDone[i] > 0 && eff.leavesDone[i] < eff.leaves[i];
        const end = descEnd(items, i);
        const toggle = () => {
          const v = !checked;
          set(items.map((x, k) => (k >= i && k < end ? { ...x, done: v } : x)));
        };
        return (
          <div key={it.id} data-item={it.id} className={'check-row' + (selected.has(it.id) ? ' selected' : '')} style={{ paddingLeft: it.level * 24 }}
            onMouseEnter={() => enterRow(it.id)}>
            {kids
              ? <button className="fold" aria-label={collapsed.has(it.id) ? t('card.check.expand') : t('card.check.collapse')} aria-expanded={!collapsed.has(it.id)}
                  onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; })}>{collapsed.has(it.id) ? '▸' : '▾'}</button>
              : <span className="fold" />}
            {it.level < MAX_LEVEL
              ? <button className="fold add-sub" title={t('card.check.addSub')} aria-label={t('card.check.addSub')} onClick={() => addSub(it.id)}>+</button>
              : <span className="fold" />}
            <input type="checkbox" checked={checked} ref={(el) => { if (el) el.indeterminate = partial; }} aria-label={t('card.check.done')} onChange={toggle} />
            <textarea
              id={'it-' + it.id}
              rows={1}
              className={'check-text' + (checked ? ' done' : '')}
              style={fmtStyle(it.fmt)}
              value={it.text}
              placeholder={t('card.check.placeholder')}
              onFocus={() => { lastFocus.current = it.id; setCur(it.id); }}
              onChange={(e) => dispatch({ t: 'checkItem', card: card.id, item: it.id, patch: { text: e.target.value.replace(/\n/g, ' ') } })}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text/plain');
                if (!text || !looksLikeList(text)) return; // texto normal: lo inserta el campo
                if (pasteList(text, it)) { e.preventDefault(); e.stopPropagation(); }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  // La tarea nueva va después de las subtareas de esta y al mismo nivel.
                  const id = uid('it');
                  dispatch({ t: 'addCheckItem', card: card.id, after: items[end - 1].id, id, level: it.level });
                  focus(id);
                }
                // Tab: sube un nivel (subtarea de la anterior, con todo lo suyo); Mayús+Tab baja un nivel.
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const next = shiftSubtree(items, it.id, e.shiftKey ? -1 : 1);
                  if (next) set(next);
                }
                if (e.key === 'Backspace' && !it.text && items.length > 1) { e.preventDefault(); dispatch({ t: 'removeCheckItem', card: card.id, item: it.id }); const prev = items[i - 1]; if (prev) focus(prev.id); }
                // ↑ ↓ pasan a la tarea anterior o siguiente; en un texto de varias líneas, solo desde la primera o la última.
                if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
                  if (caretAtEdge(e.currentTarget, e.key === 'ArrowUp' ? 'up' : 'down') && move(it.id, e.key === 'ArrowUp' ? -1 : 1)) e.preventDefault();
                }
              }}
            />
            {kids && <span className="small muted">{eff.leavesDone[i]}/{eff.leaves[i]}</span>}
          </div>
        );
      })}
      <div className="row wrap">
        <button className="link small" onClick={addTask}>{t('card.check.addTask')}</button>
      </div>
      <textarea ref={proxy} className="check-proxy" tabIndex={-1} aria-label={t('card.check.proxy')} readOnly={false}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text/plain');
          if (!text) return;
          e.preventDefault();
          if (!pasteList(text, null)) clearSel(true);
        }}
        onChange={() => { if (proxy.current) proxy.current.value = checklistToMarkdown(block); }}
      />
    </div>
  );
}
