// Sistema de traducción propio (sin dependencias).
//
//   t('clave', { variable })        → texto en el idioma actual
//   tn('clave', n, { variable })    → texto con plural: busca «clave.one», «clave.other»… según Intl.PluralRules
//   locale()                        → etiqueta BCP-47 para fechas y números (p. ej. 'fr-FR')
//
// El idioma actual es global: App lo fija con setLang() antes de pintar, y al cambiarlo se vuelve a montar la interfaz.
// Si falta una clave en un idioma, se usa el español; si tampoco existe, se muestra la propia clave.
// Para añadir un idioma: crear su archivo (con todas las claves), registrarlo en DICTS y en LANGUAGES (lib/model.ts) y LOCALES.
import type { Language } from '../lib/model';
import { es } from './es/index';
import type { Dict, Key } from './es/index';
import { en } from './en/index';
import { fr } from './fr/index';
import { pt } from './pt/index';
import { it } from './it/index';
import { de } from './de/index';

export type { Key } from './es/index';
export type Vars = Record<string, string | number>;

const DICTS: Record<Language, Dict> = { es, en, fr, pt, it, de };
/** Etiqueta regional para fechas, horas y números. */
export const LOCALES: Record<Language, string> = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR', pt: 'pt-PT', it: 'it-IT', de: 'de-DE' };
export const SUPPORTED = Object.keys(DICTS) as Language[];

const HINT_KEY = 'cuaderno.lang';
let current: Language = 'es';
const rules: Partial<Record<Language, Intl.PluralRules>> = {};

export const getLang = (): Language => current;
export const setLang = (l: Language) => { if (DICTS[l]) current = l; };
export const locale = (): string => LOCALES[current];
/** Separador decimal del idioma actual (',' en es/fr/pt/it/de, '.' en en). */
export const decimalSep = (): string => new Intl.NumberFormat(LOCALES[current]).formatToParts(1.1).find((p) => p.type === 'decimal')?.value ?? ',';

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);
const raw = (key: string): string | undefined => (DICTS[current] as Record<string, string | undefined>)[key] ?? (es as Record<string, string>)[key];

const rawIn = (lang: Language, key: string): string | undefined => (DICTS[lang] as Record<string, string | undefined>)[key] ?? (es as Record<string, string>)[key];

export function t(key: Key, vars?: Vars): string {
  return fill(raw(key) ?? key, vars);
}

/** Como t(), pero en un idioma concreto (para crear contenido inicial en el idioma elegido antes de fijarlo como actual). */
export function tIn(lang: Language, key: Key, vars?: Vars): string {
  return fill(rawIn(lang, key) ?? key, vars);
}

/** Plural: tn('days', 3) busca «days.few»/«days.other»… y usa «n» como variable por defecto. */
export function tn(key: string, n: number, vars?: Vars): string {
  const r = (rules[current] ??= new Intl.PluralRules(LOCALES[current]));
  const s = raw(`${key}.${r.select(n)}`) ?? raw(`${key}.other`) ?? key;
  return fill(s, { n, ...vars });
}

/** Idioma que mejor encaja con la lista de idiomas del sistema (['fr-CA', 'en']); inglés si ninguno coincide. */
export function detectLang(list?: readonly string[]): Language {
  const langs = list ?? (typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : []);
  for (const l of langs) {
    const base = String(l ?? '').toLowerCase().split(/[-_]/)[0] as Language;
    if (DICTS[base]) return base;
  }
  return 'en';
}

/** Último idioma usado: sirve para pantallas anteriores a cargar los ajustes (p. ej. el bloqueo). */
export function rememberLang(l: Language) {
  try { localStorage.setItem(HINT_KEY, l); } catch { /* sin almacenamiento: no pasa nada */ }
}
export function startupLang(): Language {
  try { const h = localStorage.getItem(HINT_KEY) as Language | null; if (h && DICTS[h]) return h; } catch { /* idem */ }
  return detectLang();
}
