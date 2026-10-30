import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { t } from '../i18n';
import { builtinTemplates } from '../lib/pmio';
import type { PmTemplate } from '../lib/pmio';

/** Elegir plantilla al crear una Tabla PM: las incluidas y las guardadas por el usuario. */
export function TemplatePicker({ onPick, onClose }: { onPick: (t: PmTemplate) => void; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const [builtin] = useState(builtinTemplates);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal tpl-modal" role="dialog" aria-label={t('ui.tpl.title')}>
        <header className="modal-head"><h2>{t('ui.tpl.title')}</h2><span className="grow" /><button className="icon-btn" aria-label={t('ui.common.close')} onClick={onClose}>✕</button></header>
        <div className="modal-body">
          <p className="small muted">{t('ui.tpl.intro')}</p>
          <div className="tpl-grid">
            {builtin.map((x) => (
              <button key={x.id} className="tpl" onClick={() => onPick(x)}>
                <b>{x.name}</b><span className="small muted">{x.description}</span>
              </button>
            ))}
          </div>
          {state.pmTemplates.length > 0 && (
            <>
              <div className="tpl-grid">
                {state.pmTemplates.map((x) => (
                  <div key={x.id} className="tpl mine">
                    <button className="tpl-main" onClick={() => onPick(x)}><b>{x.name}</b> <span className="badge-mine">{t('ui.tpl.mine')}</span><span className="small muted">{x.description}</span></button>
                    {confirm === x.id
                      ? <button className="danger small-btn" onClick={() => { dispatch({ t: 'pmTemplates', list: state.pmTemplates.filter((o) => o.id !== x.id) }); setConfirm(null); }}>{t('ui.tpl.delete')}</button>
                      : <button className="icon-btn small" aria-label={t('ui.tpl.deleteAria', { name: x.name })} onClick={() => setConfirm(x.id)}>×</button>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
