import { useApp } from '../App';
import { iconMarkup, normalizeIconStyle } from '../lib/icons';
import type { IconKey, IconStyle } from '../lib/icons';

/** Icono con el estilo elegido en «Personalizar barra» (o el que se le pase). Toma el color del texto. */
export function Icon({ name, size = 16, style, className }: { name: IconKey; size?: number; style?: IconStyle; className?: string }) {
  const { state } = useApp();
  const st = style ?? normalizeIconStyle(state.settings.iconStyle);
  const stroke = st === 'lineal';
  return (
    <svg className={'icon' + (className ? ' ' + className : '')} width={size} height={size} viewBox={stroke ? '0 0 24 24' : '0 0 256 256'} aria-hidden="true" focusable="false"
      fill={stroke ? 'none' : 'currentColor'} stroke={stroke ? 'currentColor' : undefined} strokeWidth={stroke ? 2 : undefined} strokeLinecap={stroke ? 'round' : undefined} strokeLinejoin={stroke ? 'round' : undefined}
      dangerouslySetInnerHTML={{ __html: iconMarkup(name, st) }} />
  );
}
