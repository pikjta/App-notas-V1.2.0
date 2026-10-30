import { describe, expect, it } from 'vitest';
import { AMBIENTS, AMBIENT_IDS, BOARD_COLORS, CARD_COLORS, FONT_IDS, TEXTURE_IDS, cardVars, fontCss, isDark, normalizeTheme, DEFAULT_TITLE_FONT, DEFAULT_THEME } from '../appearance';
import { DEFAULT_SETTINGS, fromDocs, projectToDoc } from '../model';
import type { Project } from '../model';

describe('apariencia (etapa 6)', () => {
  it('la maqueta define 6 ambientes, 7 colores de tablero, 7 texturas y 12 fuentes', () => {
    expect(AMBIENT_IDS.map((k) => AMBIENTS[k].name)).toEqual(['Estudio', 'Cuaderno', 'Acuarela', 'Risografía', 'Noche', 'Taller']);
    expect(Object.values(BOARD_COLORS).map((c) => c.name)).toEqual(['Papel', 'Blanco roto', 'Arena', 'Niebla', 'Lavanda', 'Noche', 'Abismo']);
    expect(TEXTURE_IDS).toHaveLength(7);
    expect(FONT_IDS).toHaveLength(12);
  });
  it('los colores de tarjeta incluyen las etiquetas de la maqueta', () => {
    expect(CARD_COLORS.map((c) => c.name.split(' ')[0])).toEqual(['Automático', 'Mantequilla', 'Melocotón', 'Rosa', 'Lila', 'Cielo', 'Menta', 'Papel', 'Tinta', 'Bosque', 'Ilustración', 'Pintura', 'Cliente', 'Urgente', 'Digital']);
  });
  it('los temas guardados por versiones anteriores se migran', () => {
    expect(normalizeTheme({ board: 'pizarra' as never, texture: 'rayas' as never })).toMatchObject({ board: 'abismo', texture: 'cuaderno' });
    expect(normalizeTheme(undefined)).toEqual(DEFAULT_THEME);
    const p: Project = { id: 'p', name: 'x', color: '#000', folder: null, pos: 1, theme: { board: 'salvia', texture: 'puntos' } as never };
    expect(fromDocs([projectToDoc(p)]).projects[0].theme!.board).toBe('niebla');
  });
  it('legibilidad: las tarjetas oscuras llevan texto claro y las claras, oscuro', () => {
    const t = DEFAULT_THEME;
    expect(isDark('#2B2926')).toBe(true);
    expect(cardVars('#2B2926', t)['--card-ink']).toBe('#F2EEE6');
    expect(cardVars('#FFF3C4', t)['--card-ink']).toBe('#1F1D1A');
    expect(cardVars(null, { ...t, card: 'grafito' })['--card-ink']).toBe('#EEF0F2');
  });
  it('tipografía: familia, tamaño, grosor y estilo; color de la tarea', () => {
    const css = fontCss({ ...DEFAULT_TITLE_FONT, family: 'maquina', size: 'XL', weight: 'bold', italic: true, color: 'task' }, 'title', '#0E7C7B');
    expect(css).toMatchObject({ fontSize: 58, fontWeight: 800, fontStyle: 'italic', color: '#0E7C7B' });
    expect(String(css.fontFamily)).toContain('Courier');
  });
  it('los ajustes nuevos tienen valores por defecto', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ sessionName: 'Cuaderno', hour12: false, focus: 'soft', snapOnOpen: true, reduceMotion: false, showMissed: true });
  });
});
