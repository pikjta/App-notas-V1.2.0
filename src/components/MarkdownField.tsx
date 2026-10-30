import { useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../App';
import { t } from '../i18n';
import { Markdown, toggleTask } from '../lib/markdown';

/**
 * Campo de texto con Markdown (vista previa al salir, editor al hacer clic), con la misma
 * minibarra y atajos que la tarjeta de nota. Se usa en la página de las filas de la Tabla PM.
 */
const blocks = (): [string, string][] => [[t('ui.md.h1'), '# '], [t('ui.md.h2'), '## '], [t('ui.md.h3'), '### '], [t('ui.md.list'), '- '], [t('ui.md.numbered'), '1. '], [t('ui.label.task'), '- [ ] '], [t('ui.md.quote'), '> '], [t('ui.md.code'), '```\n\n```'], [t('ui.md.separator'), '---\n'], [t('ui.md.internalLink'), '[[]]']];

export function MarkdownField({ value, onChange, placeholder = t('ui.md.placeholder'), label, slash }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string; slash?: boolean }) {
  const { resolveLink } = useApp();
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<[number, number] | null>(null);
  useLayoutEffect(() => {
    if (ta.current && caret.current) { ta.current.setSelectionRange(caret.current[0], caret.current[1]); caret.current = null; }
  }, [value]);
  useLayoutEffect(() => { if (editing) ta.current?.focus(); }, [editing]);
  const set = (v: string, sel?: [number, number]) => { if (sel) caret.current = sel; onChange(v); };
  const wrap = (a: string, b = a) => {
    const el = ta.current; if (!el) return;
    const { selectionStart: s, selectionEnd: e, value: v } = el;
    set(v.slice(0, s) + a + v.slice(s, e) + b + v.slice(e), [s + a.length, e + a.length]);
  };
  const prefix = (p: string) => {
    const el = ta.current; if (!el) return;
    const s = el.selectionStart, ls = el.value.lastIndexOf('\n', s - 1) + 1;
    set(el.value.slice(0, ls) + p + el.value.slice(ls), [s + p.length, s + p.length]);
  };
  if (!editing) {
    return (
      <div className="note-view md-field" onClick={() => setEditing(true)} title={t('ui.md.clickEdit')} aria-label={label} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}>
        {value.trim() ? <Markdown body={value} link={resolveLink} onToggle={(line) => onChange(toggleTask(value, line))} /> : <span className="muted">{placeholder}</span>}
      </div>
    );
  }
  return (
    <div className="note-edit">
      <div className="mini-bar" onMouseDown={(e) => e.preventDefault()}>
        <button onClick={() => prefix('## ')} title={t('ui.md.heading')}>H</button>
        <button onClick={() => wrap('**')} title={t('ui.md.boldKey')}><b>B</b></button>
        <button onClick={() => wrap('*')} title={t('ui.md.italicKey')}><i>I</i></button>
        <button onClick={() => wrap('~~')} title={t('ui.fmt.strike')}><s>S</s></button>
        <button onClick={() => prefix('- ')} title={t('ui.md.list')}>•</button>
        <button onClick={() => prefix('- [ ] ')} title={t('ui.label.task')}>☐</button>
        <button onClick={() => prefix('> ')} title={t('ui.md.quote')}>❝</button>
      </div>
      <textarea ref={ta} value={value} aria-label={label} rows={Math.max(5, value.split('\n').length + 1)}
        onChange={(e) => {
          onChange(e.target.value);
          const el = e.target, pos = el.selectionStart, ls = el.value.lastIndexOf('\n', pos - 1) + 1;
          setMenu(slash && el.value.slice(ls, pos) === '/' ? ls : null);
        }} onBlur={() => { setEditing(false); setMenu(null); }}
        onKeyDown={(e) => {
          if (menu !== null && e.key === 'Escape') { e.stopPropagation(); setMenu(null); return; }
          const mod = e.metaKey || e.ctrlKey;
          if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); wrap('**'); }
          if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); wrap('*'); }
          if (e.key === 'Escape') { e.stopPropagation(); ta.current?.blur(); }
          if (e.key === 'Enter' && !e.shiftKey) {
            const el = e.currentTarget;
            const ls = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1;
            const m = el.value.slice(ls, el.selectionStart).match(/^(\s*)(- \[[ xX]\] |- |\d+\. )/);
            if (m) {
              e.preventDefault();
              const next = m[2].startsWith('- [') ? '- [ ] ' : /\d/.test(m[2]) ? `${parseInt(m[2], 10) + 1}. ` : m[2];
              const ins = '\n' + m[1] + next, pos = el.selectionStart + ins.length;
              set(el.value.slice(0, el.selectionStart) + ins + el.value.slice(el.selectionEnd), [pos, pos]);
            }
          }
        }} />
      {menu !== null && (
        <div className="menu slash-menu" role="menu" aria-label={t('ui.md.insertBlock')} onMouseDown={(e) => e.preventDefault()}>
          <div className="menu-label">{t('ui.md.insertBlock')}</div>
          {blocks().map(([name, ins]) => (
            <button key={name} role="menuitem" className="menu-item" onClick={() => {
              const at = menu + ins.indexOf('\n\n') + 1, cur = ins === '[[]]' ? menu + 2 : ins.includes('\n\n') ? at : menu + ins.length;
              set(value.slice(0, menu) + ins + value.slice(menu + 1), [cur, cur]); setMenu(null);
            }}>{name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
