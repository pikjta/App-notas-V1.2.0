import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';

/** Lista de sugerencias de autocompletado colgada bajo un campo (fuera de la tarjeta, para que no se recorte). */
export function SuggestList({ anchor, items, hint, onPick, watch }: { anchor: HTMLElement | null; items: string[]; hint: number; onPick: (s: string) => void; watch?: unknown }) {
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!anchor) { setBox(null); return; }
    const rc = anchor.getBoundingClientRect();
    setBox({ left: rc.left, top: rc.bottom, width: Math.max(rc.width, 140) });
  }, [anchor, watch, items.length]);
  if (!box || !items.length) return null;
  return createPortal(
    <ul className="tbl-suggest" role="listbox" aria-label={t('ui.suggest.label')} style={{ left: box.left, top: box.top, minWidth: box.width }}>
      {items.map((s, i) => <li key={s} role="option" aria-selected={i === hint} className={i === hint ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); onPick(s); }}>{s}</li>)}
    </ul>, document.body);
}
