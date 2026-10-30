// Español: idioma de referencia. Cada área tiene su archivo. Todas las claves nuevas se escriben aquí primero;
// el resto de idiomas deben traducir las mismas claves (lo comprueba i18n.test.ts).
// Plurales: «clave.one» y «clave.other» (y «.few», «.many», «.zero», «.two» si el idioma lo necesita). Variables: {nombre}.
import { app } from './app';
import { settings } from './settings';
import { agenda } from './agenda';
import { pm } from './pm';
import { calc } from './calc';
import { cards } from './cards';
import { sample } from './sample';

export const es = { ...app, ...settings, ...agenda, ...pm, ...calc, ...cards, ...sample } as const;
export type Key = keyof typeof es;
/** Los idiomas pueden ir incompletos mientras se traducen (se usa el español); i18n.test.ts exige los completos. */
export type Dict = Partial<Record<Key, string>>;
/** Un área de un idioma: puede ir incompleta mientras se traduce; i18n.test.ts exige los idiomas terminados completos. */
export type Part<T> = Partial<Record<keyof T, string>>;
