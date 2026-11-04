import { describe, expect, it } from 'vitest';
import { calendarToDoc, DEFAULT_SETTINGS, DEFAULT_THEME, fromDocs, projectName, projectToDoc, settingsToDoc } from '../lib/model';
import type { Project } from '../lib/model';
import { setLang } from '../i18n';

const home = (name: string): Project => ({ id: 'home', name, color: '#2F6690', home: true, folder: null, pos: 0, trashed: null, links: [], theme: DEFAULT_THEME });

describe('1.2.1: nombre OMNIA en datos existentes', () => {
  it('migra «Cuaderno» a «OMNIA» (sesión y calendario principal) una sola vez', () => {
    const old = { ...DEFAULT_SETTINGS, sessionName: 'Cuaderno' } as Record<string, unknown>;
    delete old.nameV;
    const docs = [settingsToDoc(old as never), calendarToDoc({ id: 'cal-main', name: 'Cuaderno', color: '#2F6690', kind: 'main', visible: true, pos: 0 })];
    const s = fromDocs(docs);
    expect(s.settings.sessionName).toBe('OMNIA');
    expect(s.calendars.find((c) => c.id === 'cal-main')?.name).toBe('OMNIA');
    expect(s.settings.nameV).toBe(1);
  });
  it('no toca un nombre que el usuario puso a propósito, ni vuelve a migrar', () => {
    const custom = fromDocs([settingsToDoc({ ...DEFAULT_SETTINGS, sessionName: 'Mi estudio' }), calendarToDoc({ id: 'cal-main', name: 'Trabajo', color: '#2F6690', kind: 'main', visible: true, pos: 0 })]);
    expect(custom.settings.sessionName).toBe('Mi estudio');
    expect(custom.calendars.find((c) => c.id === 'cal-main')?.name).toBe('Trabajo');
    const again = fromDocs([settingsToDoc({ ...DEFAULT_SETTINGS, sessionName: 'Cuaderno', nameV: 1 })]);
    expect(again.settings.sessionName).toBe('Cuaderno');
  });
});

describe('1.2.1: nombre del tablero de Inicio en el idioma actual', () => {
  it('traduce el nombre de ejemplo de cualquier idioma y respeta uno propio', () => {
    setLang('fr');
    expect(projectName(home('Inicio'))).toBe('Accueil');
    expect(projectName(home('Mi espacio'))).toBe('Accueil');
    expect(projectName(home('Mi estudio'))).toBe('Mi estudio');
    expect(projectName({ name: 'Inicio' })).toBe('Inicio');
    setLang('es');
    expect(projectName(home('Home'))).toBe('Inicio');
  });
  it('no cambia los datos guardados', () => {
    const d = projectToDoc(home('Inicio'));
    expect((d.data as { name: string }).name).toBe('Inicio');
  });
});
