import { describe, expect, it } from 'vitest';
import { hexToHsb, hsbToHex, hexToRgb, normalizeHex, rgbToHex } from '../color';
import { ICON_KEYS, ICON_STYLES, iconMarkup, COLOR_ICONS } from '../icons';

describe('color libre', () => {
  it('normaliza códigos HEX', () => {
    expect(normalizeHex('d45a46')).toBe('#D45A46');
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('#12')).toBeNull();
    expect(normalizeHex('zzzzzz')).toBeNull();
  });
  it('el color de la captura (D45A46) da H 8, S 67, B 83, R 212, G 90, B 70', () => {
    expect(hexToHsb('#D45A46')).toEqual([8, 67, 83]);
    expect(hexToRgb('#D45A46')).toEqual([212, 90, 70]);
    expect(rgbToHex([212, 90, 70])).toBe('#D45A46');
  });
  it('HSB → HEX ida y vuelta (±1 por redondeo)', () => {
    for (const hex of ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#000000', '#2F6690', '#F2B6A0']) {
      const back = hexToRgb(hsbToHex(hexToHsb(hex)));
      const orig = hexToRgb(hex);
      back.forEach((v, i) => expect(Math.abs(v - orig[i])).toBeLessThanOrEqual(3));
    }
  });
});

describe('iconos incluidos', () => {
  it('hay 5 estilos y todos los iconos existen en todos', () => {
    expect(ICON_STYLES.map((s) => s.id)).toEqual(['notion', 'lineal', 'grueso', 'relleno', 'duotono']);
    for (const k of ICON_KEYS) for (const s of ICON_STYLES) expect(iconMarkup(k, s.id), k + '/' + s.id).toMatch(/<(path|circle|rect|line|polyline|g)/);
  });
  it('los iconos del botón de color existen y la paleta es el primero', () => {
    expect(COLOR_ICONS[0].id).toBe('palette');
    for (const c of COLOR_ICONS) expect(ICON_KEYS).toContain(c.id);
  });
  it('los iconos son datos fijos: sin scripts ni recursos externos', () => {
    for (const k of ICON_KEYS) for (const s of ICON_STYLES) expect(iconMarkup(k, s.id)).not.toMatch(/<script|href=|onload|http/i);
  });
});
