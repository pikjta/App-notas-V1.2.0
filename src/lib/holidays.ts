// Festivos nacionales (sin los regionales) de 12 países. Funciones puras: año → lista.
// Incluye las fiestas móviles que dependen de la Pascua y las que se trasladan a lunes.

import { getLang, t } from '../i18n';

export type Holiday = { date: string; name: string };
export type Country = 'ES' | 'MX' | 'AR' | 'CO' | 'CL' | 'PE' | 'US' | 'GB' | 'FR' | 'DE' | 'IT' | 'PT';

export const COUNTRIES: Record<Country, { name: string; flag: string }> = {
  ES: { get name() { return t('cal.country.ES'); }, flag: '🇪🇸' },
  MX: { get name() { return t('cal.country.MX'); }, flag: '🇲🇽' },
  AR: { get name() { return t('cal.country.AR'); }, flag: '🇦🇷' },
  CO: { get name() { return t('cal.country.CO'); }, flag: '🇨🇴' },
  CL: { get name() { return t('cal.country.CL'); }, flag: '🇨🇱' },
  PE: { get name() { return t('cal.country.PE'); }, flag: '🇵🇪' },
  US: { get name() { return t('cal.country.US'); }, flag: '🇺🇸' },
  GB: { get name() { return t('cal.country.GB'); }, flag: '🇬🇧' },
  FR: { get name() { return t('cal.country.FR'); }, flag: '🇫🇷' },
  DE: { get name() { return t('cal.country.DE'); }, flag: '🇩🇪' },
  IT: { get name() { return t('cal.country.IT'); }, flag: '🇮🇹' },
  PT: { get name() { return t('cal.country.PT'); }, flag: '🇵🇹' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const plus = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Domingo de Pascua (algoritmo gregoriano anónimo, «Meeus/Jones/Butcher»). */
export function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), dd = ((h + l - 7 * m + 114) % 31) + 1;
  return day(y, month, dd);
}

/** n-ésimo día de la semana `wd` (0 = domingo) del mes; n = -1 → el último. */
function nth(y: number, m: number, wd: number, n: number): Date {
  if (n > 0) {
    const first = day(y, m, 1);
    return plus(first, ((wd - first.getDay() + 7) % 7) + (n - 1) * 7);
  }
  const last = day(y, m + 1, 0);
  return plus(last, -((last.getDay() - wd + 7) % 7));
}

/** Traslada al lunes siguiente si no cae en lunes (Ley Emiliani de Colombia). */
const toMonday = (d: Date) => (d.getDay() === 1 ? d : plus(d, (8 - d.getDay()) % 7));

export function holidays(country: Country, y: number): Holiday[] {
  const E = easter(y);
  const L: [Date, string][] = [];
  const add = (d: Date, name: string) => L.push([d, name]);
  const f = (m: number, d: number, name: string) => add(day(y, m, d), name);
  switch (country) {
    case 'ES':
      f(1, 1, t('cal.holiday.newYear')); f(1, 6, t('cal.holiday.epiphanyLord')); add(plus(E, -2), t('cal.holiday.goodFriday')); f(5, 1, t('cal.holiday.labourFeast'));
      f(8, 15, t('cal.holiday.assumptionVirgin')); f(10, 12, t('cal.holiday.spainNational')); f(11, 1, t('cal.holiday.allSaints'));
      f(12, 6, t('cal.holiday.constitution')); f(12, 8, t('cal.holiday.immaculate')); f(12, 25, t('cal.holiday.christmas'));
      break;
    case 'MX':
      f(1, 1, t('cal.holiday.newYear')); add(nth(y, 2, 1, 1), t('cal.holiday.constitution')); add(nth(y, 3, 1, 3), t('cal.holiday.juarez'));
      f(5, 1, t('cal.holiday.labourDay')); f(9, 16, t('cal.holiday.independence')); add(nth(y, 11, 1, 3), t('cal.holiday.revolution')); f(12, 25, t('cal.holiday.christmas'));
      break;
    case 'AR':
      f(1, 1, t('cal.holiday.newYear')); add(plus(E, -48), t('cal.holiday.carnival')); add(plus(E, -47), t('cal.holiday.carnival')); f(3, 24, t('cal.holiday.memoryDay'));
      f(4, 2, t('cal.holiday.malvinas')); add(plus(E, -2), t('cal.holiday.goodFriday')); f(5, 1, t('cal.holiday.workerDay'));
      f(5, 25, t('cal.holiday.mayRevolution')); f(6, 20, t('cal.holiday.belgrano')); f(7, 9, t('cal.holiday.independence'));
      f(12, 8, t('cal.holiday.immaculate')); f(12, 25, t('cal.holiday.christmas'));
      break;
    case 'CO':
      f(1, 1, t('cal.holiday.newYear')); add(toMonday(day(y, 1, 6)), t('cal.holiday.threeKings')); add(toMonday(day(y, 3, 19)), t('cal.holiday.stJoseph'));
      add(plus(E, -3), t('cal.holiday.holyThursday')); add(plus(E, -2), t('cal.holiday.goodFriday')); f(5, 1, t('cal.holiday.labourDay'));
      add(toMonday(plus(E, 39)), t('cal.holiday.ascensionLord')); add(toMonday(plus(E, 60)), t('cal.holiday.corpusChristi')); add(toMonday(plus(E, 68)), t('cal.holiday.sacredHeart'));
      add(toMonday(day(y, 6, 29)), t('cal.holiday.peterPaul')); f(7, 20, t('cal.holiday.independence')); f(8, 7, t('cal.holiday.boyaca'));
      add(toMonday(day(y, 8, 15)), t('cal.holiday.assumptionVirgin')); add(toMonday(day(y, 10, 12)), t('cal.holiday.raceDay')); add(toMonday(day(y, 11, 1)), t('cal.holiday.allSaints'));
      add(toMonday(day(y, 11, 11)), t('cal.holiday.cartagena')); f(12, 8, t('cal.holiday.immaculate')); f(12, 25, t('cal.holiday.christmas'));
      break;
    case 'CL':
      f(1, 1, t('cal.holiday.newYear')); add(plus(E, -2), t('cal.holiday.goodFriday')); add(plus(E, -1), t('cal.holiday.holySaturday')); f(5, 1, t('cal.holiday.labourDay'));
      f(5, 21, t('cal.holiday.navalGlories')); f(6, 29, t('cal.holiday.peterPaul')); f(7, 16, t('cal.holiday.virgenCarmen')); f(8, 15, t('cal.holiday.assumptionVirgin'));
      f(9, 18, t('cal.holiday.nationalIndependence')); f(9, 19, t('cal.holiday.armyGlories')); f(10, 12, t('cal.holiday.twoWorlds'));
      f(10, 31, t('cal.holiday.evangelical')); f(11, 1, t('cal.holiday.allSaints')); f(12, 8, t('cal.holiday.immaculate')); f(12, 25, t('cal.holiday.christmas'));
      break;
    case 'PE':
      f(1, 1, t('cal.holiday.newYear')); add(plus(E, -3), t('cal.holiday.holyThursday')); add(plus(E, -2), t('cal.holiday.goodFriday')); f(5, 1, t('cal.holiday.labourDay'));
      f(6, 7, t('cal.holiday.arica')); f(6, 29, t('cal.holiday.peterPaul')); f(7, 23, t('cal.holiday.airForce')); f(7, 28, t('cal.holiday.patrioticHolidays'));
      f(7, 29, t('cal.holiday.patrioticHolidays')); f(8, 6, t('cal.holiday.junin')); f(8, 30, t('cal.holiday.santaRosa')); f(10, 8, t('cal.holiday.angamos'));
      f(11, 1, t('cal.holiday.allSaints')); f(12, 8, t('cal.holiday.immaculate')); f(12, 9, t('cal.holiday.ayacucho')); f(12, 25, t('cal.holiday.christmas'));
      break;
    case 'US':
      f(1, 1, t('cal.holiday.newYear')); add(nth(y, 1, 1, 3), t('cal.holiday.mlk')); add(nth(y, 2, 1, 3), t('cal.holiday.presidents'));
      add(nth(y, 5, 1, -1), t('cal.holiday.memorialDay')); f(6, 19, t('cal.holiday.juneteenth')); f(7, 4, t('cal.holiday.independence')); add(nth(y, 9, 1, 1), t('cal.holiday.labourDay'));
      add(nth(y, 10, 1, 2), t('cal.holiday.columbus')); f(11, 11, t('cal.holiday.veterans')); add(nth(y, 11, 4, 4), t('cal.holiday.thanksgiving')); f(12, 25, t('cal.holiday.christmas'));
      break;
    case 'GB':
      f(1, 1, t('cal.holiday.newYear')); add(plus(E, -2), t('cal.holiday.goodFriday')); add(plus(E, 1), t('cal.holiday.easterMonday')); add(nth(y, 5, 1, 1), t('cal.holiday.earlyMay'));
      add(nth(y, 5, 1, -1), t('cal.holiday.springBank')); add(nth(y, 8, 1, -1), t('cal.holiday.summerBank')); f(12, 25, t('cal.holiday.christmas')); f(12, 26, t('cal.holiday.stStephen'));
      break;
    case 'FR':
      f(1, 1, t('cal.holiday.newYear')); add(plus(E, 1), t('cal.holiday.easterMonday')); f(5, 1, t('cal.holiday.labourFeast')); f(5, 8, t('cal.holiday.victory1945'));
      add(plus(E, 39), t('cal.holiday.ascension')); add(plus(E, 50), t('cal.holiday.whitMonday')); f(7, 14, t('cal.holiday.nationalDay')); f(8, 15, t('cal.holiday.assumption'));
      f(11, 1, t('cal.holiday.allSaints')); f(11, 11, t('cal.holiday.armistice')); f(12, 25, t('cal.holiday.christmas'));
      break;
    case 'DE':
      f(1, 1, t('cal.holiday.newYear')); add(plus(E, -2), t('cal.holiday.goodFriday')); add(plus(E, 1), t('cal.holiday.easterMonday')); f(5, 1, t('cal.holiday.labourDay'));
      add(plus(E, 39), t('cal.holiday.ascension')); add(plus(E, 50), t('cal.holiday.whitMonday')); f(10, 3, t('cal.holiday.germanUnity')); f(12, 25, t('cal.holiday.christmas')); f(12, 26, t('cal.holiday.stStephen'));
      break;
    case 'IT':
      f(1, 1, t('cal.holiday.newYear')); f(1, 6, t('cal.holiday.epiphany')); add(plus(E, 1), t('cal.holiday.easterMonday')); f(4, 25, t('cal.holiday.liberationDay')); f(5, 1, t('cal.holiday.labourDay'));
      f(6, 2, t('cal.holiday.republicFeast')); f(8, 15, t('cal.holiday.ferragosto')); f(11, 1, t('cal.holiday.allSaints')); f(12, 8, t('cal.holiday.immaculate')); f(12, 25, t('cal.holiday.christmas')); f(12, 26, t('cal.holiday.stStephen'));
      break;
    case 'PT':
      f(1, 1, t('cal.holiday.newYear')); add(plus(E, -2), t('cal.holiday.goodFriday')); add(E, t('cal.holiday.easter')); f(4, 25, t('cal.holiday.freedomDay')); f(5, 1, t('cal.holiday.workerDay'));
      add(plus(E, 60), t('cal.holiday.corpusChristi')); f(6, 10, t('cal.holiday.portugalDay')); f(8, 15, t('cal.holiday.assumption')); f(10, 5, t('cal.holiday.republicImpl'));
      f(11, 1, t('cal.holiday.allSaints')); f(12, 1, t('cal.holiday.restoration')); f(12, 8, t('cal.holiday.immaculate')); f(12, 25, t('cal.holiday.christmas'));
      break;
  }
  return L.map(([d, name]) => ({ date: key(d), name })).sort((a, b) => a.date.localeCompare(b.date));
}

/** Festivos por fecha para un rango de años (con caché sencilla). */
const cache = new Map<string, Map<string, string>>();
export function holidayMap(country: Country, years: number[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const y of years) {
    const k = getLang() + country + y;
    if (!cache.has(k)) cache.set(k, new Map(holidays(country, y).map((h) => [h.date, h.name])));
    for (const [d, n] of cache.get(k)!) out.set(d, out.has(d) ? out.get(d) + ' · ' + n : n);
  }
  return out;
}
