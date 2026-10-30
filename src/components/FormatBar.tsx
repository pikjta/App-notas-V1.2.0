import { useState } from 'react';
import { t } from '../i18n';
import { ColorPicker } from './ColorPicker';
import { allHave, commonValue, toggleFlag } from '../lib/format';
import type { CellFmt, FmtFlag, FmtPatch } from '../lib/format';

/**
 * Barra de formato (negrita, cursiva, subrayado, tachado, color del texto, resaltado, alineación y quitar formato)
 * para lo que esté seleccionado. `fmts` es el formato actual de cada elemento seleccionado; no cambia el foco al pulsar.
 */
export function FormatBar({ fmts, onPatch, onAfter, align = false, disabled = false, label = t('ui.fmt.label') }: { fmts: (CellFmt | undefined)[]; onPatch: (p: FmtPatch) => void; onAfter?: () => void; align?: boolean; disabled?: boolean; label?: string }) {
  const [picker, setPicker] = useState<'color' | 'bg' | null>(null);
  const flag = (k: FmtFlag, title: string, face: React.ReactNode) => (
    <button type="button" className={'fmt-btn' + (allHave(fmts, k) ? ' on' : '')} aria-pressed={allHave(fmts, k)} aria-label={title} title={title} disabled={disabled}
      onClick={() => { onPatch(toggleFlag(fmts, k)); onAfter?.(); }}>{face}</button>
  );
  const color = commonValue(fmts, 'color') ?? null, bg = commonValue(fmts, 'bg') ?? null, al = commonValue(fmts, 'align') ?? null;
  const alignBtn = (v: 'left' | 'center' | 'right', title: string, d: string) => (
    <button type="button" className={'fmt-btn' + (al === v ? ' on' : '')} aria-pressed={al === v} aria-label={title} title={title} disabled={disabled}
      onClick={() => { onPatch({ align: al === v ? null : v }); onAfter?.(); }}>
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" /></svg>
    </button>
  );
  const none = fmts.every((f) => !f || !Object.keys(f).length);
  return (
    <div className="fmt-bar" role="toolbar" aria-label={label} onMouseDown={(e) => e.preventDefault()}>
      {flag('b', t('ui.fmt.bold'), <b>B</b>)}
      {flag('i', t('ui.fmt.italic'), <i>I</i>)}
      {flag('u', t('ui.fmt.underline'), <u>U</u>)}
      {flag('s', t('ui.fmt.strike'), <s>S</s>)}
      <span className="fmt-sep" />
      <button type="button" className="fmt-btn" aria-label={t('ui.fmt.textColor')} title={t('ui.fmt.textColor')} disabled={disabled} onClick={() => setPicker('color')}>
        <span className="fmt-a">A</span><span className="fmt-under" style={{ background: color ?? 'currentColor' }} />
      </button>
      <button type="button" className="fmt-btn" aria-label={t('ui.fmt.highlight')} title={t('ui.fmt.highlightTitle')} disabled={disabled} onClick={() => setPicker('bg')}>
        <span className="fmt-a fmt-mark" style={{ background: bg ?? 'transparent' }}>A</span>
      </button>
      {align && <>
        <span className="fmt-sep" />
        {alignBtn('left', t('ui.fmt.alignLeft'), 'M2 3h12M2 7h8M2 11h12')}
        {alignBtn('center', t('ui.fmt.alignCenter'), 'M2 3h12M4 7h8M2 11h12')}
        {alignBtn('right', t('ui.fmt.alignRight'), 'M2 3h12M6 7h8M2 11h12')}
      </>}
      <span className="fmt-sep" />
      <button type="button" className="fmt-btn" aria-label={t('ui.fmt.clear')} title={t('ui.fmt.clear')} disabled={disabled || none}
        onClick={() => { onPatch({ b: null, i: null, u: null, s: null, color: null, bg: null, align: null }); onAfter?.(); }}>✕</button>
      {picker && (
        <ColorPicker title={picker === 'color' ? t('ui.fmt.textColor') : t('ui.fmt.bgColor')} current={picker === 'color' ? color : bg} fallback={picker === 'color' ? '#1F1D1A' : '#FFE08A'}
          onPick={(hex) => { onPatch(picker === 'color' ? { color: hex } : { bg: hex }); setPicker(null); onAfter?.(); }}
          onClose={() => { setPicker(null); onAfter?.(); }} />
      )}
    </div>
  );
}
