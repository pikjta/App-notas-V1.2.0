import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { explainError } from '../lib/formula';
import { t } from '../i18n';

/** Ventana que explica un error de fórmula: qué pasó, por qué y cómo arreglarlo. */
export function FormulaErrorDialog({ error, formula, where, onClose, onEdit }: { error: string; formula?: string; where?: string; onClose: () => void; onEdit?: () => void }) {
  const e = explainError(error);
  useEffect(() => {
    const h = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);
  return createPortal(
    <div className="modal-back" onClick={onClose} onMouseDown={(ev) => ev.stopPropagation()} onPointerDown={(ev) => ev.stopPropagation()} onDoubleClick={(ev) => ev.stopPropagation()}>
      <section className="modal formula-err-dlg" role="dialog" aria-label={t('calc.dlg.label')} onClick={(ev) => ev.stopPropagation()}>
        <h2><span aria-hidden="true">⚠</span> {e.title}</h2>
        <div className="modal-body stack">
          {where && <p className="small muted">{where}</p>}
          {formula && <code className="fx-code">{formula}</code>}
          <p><b>{t('calc.dlg.what')}</b> {e.why}</p>
          <p><b>{t('calc.dlg.how')}</b> {e.fix}</p>
          {error !== e.why && <p className="small muted">{t('calc.dlg.detail', { error })}</p>}
          <div className="row end">
            {onEdit && <button className="tool" onClick={() => { onClose(); onEdit(); }}>{t('calc.dlg.edit')}</button>}
            <button className="primary" autoFocus onClick={onClose}>{t('calc.dlg.ok')}</button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
