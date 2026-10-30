import { describe, expect, it, afterEach } from 'vitest';
import { es } from './es/index';
import { en } from './en/index';
import { fr } from './fr/index';
import { pt } from './pt/index';
import { it as itDict } from './it/index';
import { de } from './de/index';
import { detectLang, getLang, locale, setLang, SUPPORTED, t, tn } from './index';

const ALL = { es, en, fr, pt, it: itDict, de } as Record<string, Record<string, string>>;
const vars = (s: string, k = '') => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((v) => !(k.endsWith('.one') && v === 'n')).sort().join(','); // en el singular se puede escribir «1» en vez de {n}

const EXAMPLE_NAMES = ['pm.formula.placeholder'];
afterEach(() => setLang('es'));

describe('idiomas: coherencia de los diccionarios', () => {
  // Idiomas con la traducción terminada: tienen que tener TODAS las claves del español.
  // Se van añadiendo a esta lista según se completan (fases 3 y 4 de la mejora de idiomas).
  const COMPLETE: string[] = ['es', 'en', 'fr', 'pt', 'it', 'de'];
  it('hay seis idiomas', () => {
    expect([...SUPPORTED].sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'pt']);
  });
  it('ningún idioma tiene claves que no existan en el español', () => {
    for (const [lang, d] of Object.entries(ALL)) {
      for (const k of Object.keys(d)) expect(k in es, `${lang}:${k}`).toBe(true);
    }
  });
  it('los idiomas terminados tienen todas las claves', () => {
    for (const lang of COMPLETE) {
      const missing = Object.keys(es).filter((k) => !(k in ALL[lang]));
      expect(missing, `${lang}: faltan ${missing.length} claves`).toEqual([]);
    }
  });
  it('cada traducción conserva las mismas {variables} que el español y no está vacía', () => {
    for (const [lang, d] of Object.entries(ALL)) {
      for (const k of Object.keys(d)) {
        expect(d[k].trim(), `${lang}:${k}`).not.toBe('');
        if (EXAMPLE_NAMES.includes(k)) continue; // ejemplos con nombre de columna traducido ({Presupuesto} → {Budget})
        expect(vars(d[k], k), `${lang}:${k}`).toBe(vars((es as Record<string, string>)[k], k));
      }
    }
  });
});

describe('t() y tn()', () => {
  it('traduce según el idioma actual y rellena variables', () => {
    setLang('fr');
    expect(t('boot.opening')).toBe('Ouverture…');
    expect(t('boot.error', { error: 'x' })).toBe('Impossible d’ouvrir le carnet\u00a0: x');
    setLang('de');
    expect(t('settings.language.title')).toBe('Sprache');
  });
  it('si falta la clave usa el español y, si no existe, la propia clave', () => {
    setLang('en');
    expect(t('no.existe' as never)).toBe('no.existe');
  });
  it('plurales con Intl.PluralRules (un idioma con 3 formas, como el ruso, también funcionaría)', () => {
    setLang('en');
    // Diccionario de prueba: se inyecta en en.ts temporalmente
    (en as Record<string, string>)['t.dias.one'] = '{n} day';
    (en as Record<string, string>)['t.dias.other'] = '{n} days';
    expect(tn('t.dias', 1)).toBe('1 day');
    expect(tn('t.dias', 3)).toBe('3 days');
    expect(tn('t.dias', 0)).toBe('0 days');
    delete (en as Record<string, string>)['t.dias.one'];
    delete (en as Record<string, string>)['t.dias.other'];
  });
  it('locale() sigue al idioma', () => {
    setLang('pt'); expect(locale()).toBe('pt-PT');
    setLang('es'); expect(locale()).toBe('es-ES');
    expect(getLang()).toBe('es');
  });
});

describe('detectLang', () => {
  it('elige el primer idioma del sistema que tengamos', () => {
    expect(detectLang(['fr-CA', 'en'])).toBe('fr');
    expect(detectLang(['ru-RU', 'de-AT'])).toBe('de');
    expect(detectLang(['pt-BR'])).toBe('pt');
    expect(detectLang(['IT'])).toBe('it');
  });
  it('si ninguno coincide, inglés', () => {
    expect(detectLang(['ru-RU', 'zh'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });
});

describe('decimales y plurales reales', () => {
  it('separador decimal por idioma', async () => {
    const { decimalSep } = await import('./index');
    const r: Record<string, string> = {};
    for (const l of SUPPORTED) { setLang(l); r[l] = decimalSep(); }
    expect(r).toEqual({ es: ',', en: '.', fr: ',', pt: ',', it: ',', de: ',' });
  });
  it('los plurales del español ya distinguen singular (1 fila / 2 filas)', () => {
    setLang('es');
    expect(tn('pm.csv.exported', 1)).toBe('Exportada 1 fila a CSV');
    expect(tn('pm.csv.exported', 3)).toBe('Exportadas 3 filas a CSV');
    expect(tn('cal.export.done', 1)).toBe('Exportado 1 evento');
    setLang('fr');
    expect(tn('pm.csv.exported', 0)).toBe('0 ligne exportée en CSV');
    setLang('en');
    expect(tn('set.backup.items', 1)).toBe('1 item');
    expect(tn('set.backup.items', 2)).toBe('2 items');
    setLang('pt');
    expect(tn('pm.csv.exported', 0)).toBe('Exportadas 0 linhas para CSV');
  });
  it('todo plural tiene .one y .other en todos los idiomas', () => {
    for (const [lang, d] of Object.entries(ALL)) {
      for (const k of Object.keys(d)) if (k.endsWith('.one')) expect(`${k.slice(0, -4)}.other` in d, `${lang}:${k}`).toBe(true);
    }
  });
});
