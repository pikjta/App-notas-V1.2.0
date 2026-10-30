import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { hexToHsb, hexToRgb, hsbToHex, normalizeHex, rgbToHex } from '../lib/color';
import type { Hsb } from '../lib/color';
import { t } from '../i18n';

/**
 * Selector de color libre: cuadro de saturación y brillo, barra de tono y campos HSB, RGB y HEX,
 * con el color nuevo junto al actual. «Automático» devuelve null (el color del tablero).
 */
export function ColorPicker({ title, current, fallback, onPick, onClose }: { title: string; current: string | null; fallback: string; onPick: (hex: string | null) => void; onClose: () => void }) {
  const start = current ?? fallback;
  // El HEX se guarda tal cual: pasar siempre por HSB (con enteros) cambiaría algún dígito.
  const [col, setCol] = useState<{ hsb: Hsb; hex: string }>(() => ({ hsb: hexToHsb(start), hex: (normalizeHex(start) ?? '#000000') }));
  const [hexText, setHexText] = useState<string | null>(null);
  const { hsb, hex } = col;
  const setHsb = (h: Hsb) => setCol({ hsb: h, hex: hsbToHex(h) });
  const setHex = (h: string) => setCol({ hsb: hexToHsb(h), hex: h });
  const [r, g, b] = hexToRgb(hex);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onClose]);

  // Arrastrar dentro de un elemento: calcula la posición relativa 0–1. Se usa el elemento del propio
  // evento (currentTarget): una referencia (ref) todavía está vacía en el primer dibujo y obligaba a
  // tocar antes un número para que el cuadro respondiera.
  const drag = (apply: (x: number, y: number) => void) => (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    e.preventDefault();
    try { el.setPointerCapture?.(e.pointerId); } catch { /* sin captura el arrastre sigue por la ventana */ }
    const move = (ev: { clientX: number; clientY: number }) => {
      const rc = el.getBoundingClientRect();
      apply(Math.min(1, Math.max(0, (ev.clientX - rc.left) / (rc.width || 1))), Math.min(1, Math.max(0, (ev.clientY - rc.top) / (rc.height || 1))));
    };
    move(e);
    const mv = (ev: PointerEvent) => move(ev);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // Iconos de cada parámetro: tono (rueda de color), saturación (gota a medias), brillo (sol) y un punto del color de R, G y B.
  const GLYPH: Record<string, React.ReactNode> = {
    H: <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><defs><linearGradient id="cp-g-h" x1="0" x2="1"><stop offset="0" stopColor="#f33" /><stop offset=".2" stopColor="#fc3" /><stop offset=".4" stopColor="#3c3" /><stop offset=".6" stopColor="#3cf" /><stop offset=".8" stopColor="#33f" /><stop offset="1" stopColor="#f3c" /></linearGradient></defs><circle cx="8" cy="8" r="6.5" fill="url(#cp-g-h)" stroke="currentColor" strokeWidth="1" /></svg>,
    S: <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.5C8 1.5 3 7 3 10a5 5 0 0 0 10 0c0-3-5-8.5-5-8.5Z" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M8 1.5C8 1.5 3 7 3 10a5 5 0 0 0 5 5V1.5Z" fill="currentColor" opacity=".45" /></svg>,
    Br: <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor" /><g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" /></g></svg>,
    R: <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="#e5383b" /></svg>,
    G: <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="#2fb344" /></svg>,
    Bl: <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="#2f6fed" /></svg>,
  };
  const NAME: Record<string, string> = { H: t('set.cp.hue'), S: t('set.cp.saturation'), Br: t('set.cp.brightness'), R: t('set.cp.red'), G: t('set.cp.green'), Bl: t('set.cp.blue') };
  const num = (key: string, label: string, value: number, max: number, unit: string, onChange: (v: number) => void) => (
    <label className="cp-num">
      <i className="cp-glyph" title={NAME[key]}>{GLYPH[key]}</i><span>{label}</span>
      <input type="number" min={0} max={max} value={value} aria-label={NAME[key]}
        onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) onChange(Math.min(max, Math.max(0, v))); }} />
      <em>{unit}</em>
    </label>
  );
  const setRgb = (i: 0 | 1 | 2, v: number) => { const c: [number, number, number] = [r, g, b]; c[i] = v; setHex(rgbToHex(c)); };

  return createPortal(
    <div className="modal-back" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <section className="modal color-picker" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2 className="cp-title">{title}</h2>
        <div className="cp-body">
          <div className="cp-area" data-testid="cp-area" style={{ ['--hue' as string]: hsbToHex([hsb[0], 100, 100]) }} role="presentation"
            onPointerDown={drag((x, y) => setHsb([hsb[0], Math.round(x * 100), Math.round((1 - y) * 100)]))}>
            <span className="cp-dot" style={{ left: hsb[1] + '%', top: 100 - hsb[2] + '%' }} />
          </div>
          <div className="cp-hue" data-testid="cp-hue" role="presentation" onPointerDown={drag((_x, y) => setHsb([Math.round(y * 359), hsb[1], hsb[2]]))}>
            <span className="cp-hue-dot" style={{ top: (hsb[0] / 359) * 100 + '%' }} />
          </div>
          <div className="cp-side">
            <div className="cp-preview" aria-label={t('set.cp.newAndCurrent')}>
              <span>{t('set.cp.new')}</span>
              <div className="cp-swatch" style={{ background: hex }} data-testid="cp-new" />
              <div className="cp-swatch" style={{ background: start }} />
              <span>{t('set.cp.current')}</span>
            </div>
            <div className="cp-fields">
              <div className="cp-col" role="group" aria-label="HSB">
                <span className="cp-group">HSB</span>
                {num('H', 'H', hsb[0], 360, '°', (v) => setHsb([v, hsb[1], hsb[2]]))}
                {num('S', 'S', hsb[1], 100, '%', (v) => setHsb([hsb[0], v, hsb[2]]))}
                {num('Br', 'B', hsb[2], 100, '%', (v) => setHsb([hsb[0], hsb[1], v]))}
              </div>
              <div className="cp-col" role="group" aria-label="RGB">
                <span className="cp-group">RGB</span>
                {num('R', 'R', r, 255, '', (v) => setRgb(0, v))}
                {num('G', 'G', g, 255, '', (v) => setRgb(1, v))}
                {num('Bl', 'B', b, 255, '', (v) => setRgb(2, v))}
              </div>
              <label className="cp-hex"><span>#</span>
                <input value={hexText ?? hex.slice(1)} maxLength={7} aria-label={t('set.cp.hex')} spellCheck={false}
                  onChange={(e) => { setHexText(e.target.value); const h = normalizeHex(e.target.value); if (h) setHex(h); }}
                  onBlur={() => setHexText(null)} />
              </label>
            </div>
          </div>
        </div>
        <div className="cp-foot">
          <button className="tool" onClick={() => onPick(null)}>{t('set.cp.auto')}</button>
          <span className="grow" />
          <button className="tool" onClick={onClose}>{t('set.cancel')}</button>
          <button className="tool primary" onClick={() => onPick(hex)}>{t('set.cp.accept')}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
