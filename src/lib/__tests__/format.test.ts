import { describe, expect, it } from 'vitest';
import { allHave, applyFmt, commonValue, fmtStyle, toggleFlag } from '../format';

describe('formato de celdas', () => {
  it('aplicar y quitar; sin formato queda undefined', () => {
    const a = applyFmt(undefined, { b: true, color: '#d45a46' });
    expect(a).toEqual({ b: true, color: '#d45a46' });
    expect(applyFmt(a, { b: null })).toEqual({ color: '#d45a46' });
    expect(applyFmt({ b: true }, { b: null })).toBeUndefined();
  });
  it('estilo CSS: negrita, cursiva, subrayado+tachado, colores y alineación; ignora lo inválido', () => {
    expect(fmtStyle({ b: true, i: true, u: true, s: true, color: '#112233', bg: '#ffeedd', align: 'center' })).toEqual({ fontWeight: 700, fontStyle: 'italic', textDecoration: 'underline line-through', color: '#112233', backgroundColor: '#ffeedd', textAlign: 'center' });
    expect(fmtStyle({ color: 'red; background: url(x)', align: 'justify' as never })).toBeUndefined();
    expect(fmtStyle(undefined)).toBeUndefined();
  });
  it('el botón alterna: si todos lo tienen se quita, si no se pone a todos', () => {
    expect(toggleFlag([{ b: true }, undefined], 'b')).toEqual({ b: true });
    expect(toggleFlag([{ b: true }, { b: true }], 'b')).toEqual({ b: null });
    expect(allHave([], 'b')).toBe(false);
  });
  it('valor común', () => {
    expect(commonValue([{ color: '#111111' }, { color: '#111111' }], 'color')).toBe('#111111');
    expect(commonValue([{ color: '#111111' }, undefined], 'color')).toBeNull();
  });
});
