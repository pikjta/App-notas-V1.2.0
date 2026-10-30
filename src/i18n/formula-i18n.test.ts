import { afterEach, describe, expect, it } from 'vitest';
import { explainError, runFormula, checkFormula } from '../lib/formula';
import { calcCell } from '../lib/tablecalc';
import { setLang, t, tIn } from './index';

afterEach(() => setLang('es'));

const get = () => null;
const errOf = (f: () => unknown): string => { try { f(); } catch (e) { return (e as Error).message; } throw new Error('no falló'); };
const run = (src: string) => errOf(() => runFormula(src, get, '2026-10-29'));
const grid = (src: string) => ({ heads: ['A', 'B'], rows: [{ cells: [src, ''] }] }) as never;

// Cada caso: mensaje real provocado → categoría esperada (clave `calc.fx.<cat>`).
function cases(): [string, string, string][] {
  const tbl = (src: string) => calcCell(grid(src), 0, 0).error ?? '';
  return [
    ['división entre cero', run('1 / 0'), 'divZero'],
    ['función desconocida', run('nada(1)'), 'unknownFn'],
    ['paréntesis sin cerrar', run('(1 + 2'), 'syntax'],
    ['comillas sin cerrar', run('"abc'), 'syntax'],
    ['llave sin cerrar', run('{Horas'), 'syntax'],
    ['carácter no válido', run('1 @ 2'), 'syntax'],
    ['fórmula vacía', run('   '), 'syntax'],
    ['fórmula incompleta', run('1 +'), 'syntax'],
    ['sobra algo', run('1 2'), 'syntax'],
    ['nombre sin reconocer', run('abc + 1'), 'syntax'],
    ['rango fuera de función', run('B2:B9'), 'syntax'],
    ['texto no numérico', run('"abc" * 2'), 'notNumber'],
    ['fecha no válida', run('dateBetween("xx", "2026-01-01")'), 'notDate'],
    ['referencia borrada', run('#REF + 1'), 'gone'],
    ['propiedad inexistente', errOf(() => runFormula('{Nada}', (n) => { throw new Error(t('calc.err.noProp', { name: n })); }, '2026-10-29')), 'noProp'],
    ['referencia circular', tbl('=A2'), 'circular'],
    ['columna inexistente', tbl('=Z1'), 'gone'],
  ];
}

describe.each(['en', 'fr', 'pt', 'it', 'de'] as const)('explainError en %s', (lang) => {
  it('reconoce cada categoría de error con sus propios mensajes', () => {
    setLang(lang);
    for (const [name, msg, cat] of cases()) {
      const got = explainError(msg);
      expect(got.title, `${lang} · ${name} · «${msg}»`).toBe(t(`calc.fx.${cat}.title` as never));
      expect(got.title).not.toBe(t('calc.fx.other.title'));
    }
  });

  it('los textos de ayuda no son los del español', () => {
    setLang(lang);
    expect(t('calc.fx.divZero.title')).not.toBe(tIn('es', 'calc.fx.divZero.title'));
  });

  it('un mensaje desconocido cae en el genérico', () => {
    setLang(lang);
    expect(explainError('xyz').title).toBe(t('calc.fx.other.title'));
  });

  it('las expresiones regulares son válidas', () => {
    for (const k of ['circular', 'gone', 'noProp', 'divZero', 'notNumber', 'notDate', 'unknownFn', 'syntax']) {
      expect(() => new RegExp(tIn(lang, `calc.fx.m.${k}` as never), 'i')).not.toThrow();
    }
  });
});

describe('alias franceses de funciones', () => {
  it.each([
    ['somme(1;2)', 3], ['somme(1, 2, 3)', 6], ['moyenne(2;4)', 3], ['compter(1;2;"a")', 2], ['nbval(1;"";"a")', 2],
    ['si(1 > 0; "oui"; "non")', 'oui'], ['et(1;1)', true], ['ou(0;1)', true], ['non(0)', true],
    ['arrondi(1.26; 1)', 1.3], ['entier(2.7)', 2], ['plafond(2.1)', 3], ['racine(9)', 3], ['puissance(2;3)', 8], ['reste(7;3)', 1],
    ['majusc("ab")', 'AB'], ['minusc("AB")', 'ab'], ['longueur("abc")', 3], ['estvide("")', true],
    ['concatener("a";"b")', 'ab'], ['concaténer("a";"b")', 'ab'], ['aujourdhui()', '2026-10-29'], ['maximum(1;5)', 5], ['minimum(1;5)', 1], ['max(1;5)', 5], ['min(1;5)', 1],
  ])('%s', (src, want) => {
    expect(checkFormula(src)).toBeNull();
    expect(runFormula(src, get, '2026-10-29')).toBe(want);
  });
});

describe('alias de funciones en pt, it y de', () => {
  it.each([
    // pt
    ['soma(1;2)', 3], ['média(2;4)', 3], ['media(2;4)', 3], ['contar(1;2;"a")', 2], ['contarvalores(1;"";"a")', 2],
    ['se(1 > 0; "sim"; "não")', 'sim'], ['e(1;1)', true], ['ou(0;1)', true], ['nao(0)', true], ['não(0)', true],
    ['arredondar(1.26; 1)', 1.3], ['inteiro(2.7)', 2], ['int(2.7)', 2], ['teto(2.1)', 3], ['raiz(9)', 3], ['potência(2;3)', 8], ['potencia(2;3)', 8], ['resto(7;3)', 1],
    ['maiúscula("ab")', 'AB'], ['maiuscula("ab")', 'AB'], ['minúscula("AB")', 'ab'], ['minuscula("AB")', 'ab'], ['comprimento("abc")', 3], ['évazio("")', true], ['evazio("")', true],
    ['concatenar("a";"b")', 'ab'], ['hoje()', '2026-10-29'], ['máximo(1;5)', 5], ['mínimo(1;5)', 1],
    // it
    ['somma(1;2)', 3], ['somma(1, 2, 3)', 6], ['conta(1;2;"a")', 2], ['contavalori(1;"";"a")', 2],
    ['se(1 > 0; "sì"; "no")', 'sì'], ['non(0)', true], ['arrotonda(1.26; 1)', 1.3], ['intero(2.7)', 2], ['soffitto(2.1)', 3],
    ['radq(9)', 3], ['potenza(2;3)', 8], ['maiusc("ab")', 'AB'], ['minusc("AB")', 'ab'], ['lunghezza("abc")', 3], ['vuoto("")', true],
    ['concatena("a";"b")', 'ab'], ['oggi()', '2026-10-29'], ['massimo(1;5)', 5], ['minimo(1;5)', 1],
    // de
    ['summe(1;2)', 3], ['mittelwert(2;4)', 3], ['anzahl(1;2;"a")', 2], ['anzahl2(1;"";"a")', 2],
    ['wenn(1 > 0; "ja"; "nein")', 'ja'], ['und(1;1)', true], ['oder(0;1)', true], ['nicht(0)', true],
    ['runden(1.26; 1)', 1.3], ['ganzzahl(2.7)', 2], ['obergrenze(2.1)', 3], ['wurzel(9)', 3], ['potenz(2;3)', 8], ['rest(7;3)', 1],
    ['groß("ab")', 'AB'], ['gross("ab")', 'AB'], ['klein("AB")', 'ab'], ['länge("abc")', 3], ['laenge("abc")', 3], ['istleer("")', true],
    ['verketten("a";"b")', 'ab'], ['heute()', '2026-10-29'], ['maximum(1;5)', 5], ['minimum(1;5)', 1],
  ])('%s', (src, want) => {
    expect(checkFormula(src)).toBeNull();
    expect(runFormula(src, get, '2026-10-29')).toBe(want);
  });

  it('las columnas y referencias siguen funcionando con alias cortos como e, o o rest', () => {
    const val = (name: string) => ({ e: 5, o: 6, rest: 7, Horas: 8 } as Record<string, number>)[name] ?? null;
    expect(runFormula('{e} + {o} + {rest} + {Horas}', val, '2026-10-29')).toBe(26);
    expect(runFormula('e(1;1) && {e} > 0', val, '2026-10-29')).toBe(true);
    expect(calcCell({ heads: ['A', 'B'], rows: [{ cells: ['3', '=A2 + 1'] }] } as never, 0, 1).value).toBe(4);
  });
});
