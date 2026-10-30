import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../App';
import { t } from '../i18n';
import { search, searchIndex } from '../lib/store';

const fold1 = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Texto con la coincidencia resaltada (sin distinguir tildes ni mayúsculas). */
function Mark({ text, q }: { text: string; q: string }) {
  const f = fold1(q.trim());
  // Se busca sobre el texto sin marcas combinadas para que las posiciones coincidan con las del original.
  const plain = text.split('').map((ch) => fold1(ch)[0] ?? ch).join('');
  const at = f ? plain.indexOf(f) : -1;
  if (at < 0 || plain.length !== text.length) return <>{text}</>;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + f.length)}</mark>{text.slice(at + f.length)}</>;
}

export function Search({ onClose }: { onClose: () => void }) {
  const { state, goTo, openEvent } = useApp();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const index = useMemo(() => searchIndex(state), [state]);
  const hits = useMemo(() => search(index, q), [index, q]);
  useEffect(() => setI(0), [q]);
  const pick = (k: number) => { const h = hits[k]; if (!h) return; if (h.event) openEvent(h.event); else goTo(h.project, h.card); onClose(); };
  const color = (pid: string) => state.projects.find((p) => p.id === pid)?.color ?? state.calendars.find((c) => c.kind === 'main')?.color;

  return (
    <div className="modal-back top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="search" role="dialog" aria-label={t('ui.search.label')}>
        <input autoFocus value={q} placeholder={t('ui.search.placeholder')} aria-label={t('ui.search.label')}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(hits.length - 1, x + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            if (e.key === 'Enter') pick(i);
            if (e.key === 'Escape') onClose();
          }} />
        {q && (
          <ul role="listbox" aria-label={t('ui.search.results')}>
            {hits.length === 0 && <li className="muted no-hit">{t('ui.search.none', { q })}</li>}
            {hits.map((h, k) => (
              <li key={k} role="option" aria-selected={k === i} className={k === i ? 'on' : ''} onMouseEnter={() => setI(k)} onMouseDown={() => pick(k)}>
                <span className="dot" style={{ background: color(h.project) }} />
                <div className="grow"><div className="hit"><Mark text={h.text} q={q} /></div><div className="small muted">{h.kind}{h.where ? ' · ' + h.where : ''}</div></div>
              </li>
            ))}
          </ul>
        )}
        <div className="search-foot small muted">{t('ui.search.foot')}</div>
      </section>
    </div>
  );
}
