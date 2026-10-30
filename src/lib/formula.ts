// Fórmulas de la Tabla PM. Lenguaje pequeño y seguro (no usa eval): se analiza el texto y se
// evalúa el árbol resultante. Las propiedades se citan como {Nombre} o prop("Nombre").
//
//   {Presupuesto} * 1.21
//   if({Facturado}, "Cobrar", "Pendiente")
//   round({Horas} * 35, 2)
//   dateBetween({Fin}, today(), "days")
//   concat({Cliente}, " · ", {Tarea})

import { decimalSep, getLang, t as tr, tIn } from '../i18n';

export type FVal = number | string | boolean | null;
export class FormulaError extends Error {}

type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'prop'; name: string }
  | Ref
  | { k: 'range'; a: Ref; b: Ref }
  | { k: 'call'; fn: string; args: Node[] }
  | { k: 'un'; op: '-' | '!'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node };

/**
 * Referencia a una celda. Escrita a mano es «B2» (columna B, fila 2: `ref`); la Tabla PM la guarda por
 * identidad (`id`: id de columna e id de fila), así sigue apuntando a la misma celda aunque se reordenen
 * filas o columnas. `row: 0` / `r: '*'` es la columna entera («B:B»).
 */
export type Ref = { k: 'ref'; col: string; row: number } | { k: 'id'; c: string; r: string };

type Tok = { t: 'num' | 'str' | 'id' | 'prop' | 'op' | '(' | ')' | ',' | ':'; v: string; at: number; end: number };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c) && /[0-9]/.test(src[i] === '.' ? src[i + 1] ?? '' : c)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'num', v: src.slice(i, j), at: i, end: j }); i = j; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) { if (src[j] === '\\' && j + 1 < src.length) { s += src[j + 1]; j += 2; } else s += src[j++]; }
      if (j >= src.length) throw new FormulaError(tr('calc.f.unclosedQuote'));
      out.push({ t: 'str', v: s, at: i, end: j + 1 }); i = j + 1; continue;
    }
    if (c === '{') {
      const j = src.indexOf('}', i);
      if (j < 0) throw new FormulaError(tr('calc.f.unclosedBrace'));
      out.push({ t: 'prop', v: src.slice(i + 1, j).trim(), at: i, end: j + 1 }); i = j + 1; continue;
    }
    if (/[A-Za-zÀ-ÖØ-öø-ÿ_#]/.test(c)) {
      let j = i + 1; while (j < src.length && /[A-Za-z0-9À-ÖØ-öø-ÿ_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j), at: i, end: j }); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '>=', '<=', '&&', '||', '<>'].includes(two)) { out.push({ t: 'op', v: two === '<>' ? '!=' : two, at: i, end: i + 2 }); i += 2; continue; }
    if ('+-*/%<>=!'.includes(c)) { out.push({ t: 'op', v: c === '=' ? '==' : c, at: i, end: i + 1 }); i++; continue; }
    if (c === '(' || c === ')' || c === ',' || c === ':') { out.push({ t: c, v: c, at: i, end: i + 1 }); i++; continue; }
    if (c === ';') { out.push({ t: ',', v: ',', at: i, end: i + 1 }); i++; continue; }
    throw new FormulaError(tr('calc.f.badChar', { c }));
  }
  return out;
}

export const isCellRef = (v: string) => /^[A-Za-z]{1,3}[1-9][0-9]{0,5}$/.test(v);
const typedRef = (v: string): Ref => { const m = v.match(/^([A-Za-z]+)([0-9]+)$/)!; return { k: 'ref', col: m[1].toUpperCase(), row: Number(m[2]) }; };
/** `#colId:rowId` (o `#colId:*`) → referencia por identidad. */
const idRef = (v: string): Ref | null => { const m = v.match(/^#([^:]+):(.+)$/); return m ? { k: 'id', c: m[1], r: m[2] } : null; };

/** Nombres en español de las funciones (se aceptan igual que los ingleses). */
const ALIAS: Record<string, string> = { y: 'and', o: 'or', no: 'not', raiz: 'sqrt', potencia: 'pow', residuo: 'mod', entero: 'floor', techo: 'ceil', mayusc: 'upper', minusc: 'lower', contara: 'counta', esblanco: 'empty', si: 'if', suma: 'sum', promedio: 'avg', contar: 'count', redondear: 'round', concatenar: 'concat', hoy: 'today', maximo: 'max', minimo: 'min', máximo: 'max', mínimo: 'min', largo: 'length', mayus: 'upper', minus: 'lower', et: 'and', ou: 'or', non: 'not', racine: 'sqrt', puissance: 'pow', reste: 'mod', entier: 'floor', plafond: 'ceil', majusc: 'upper', nbval: 'counta', estvide: 'empty', somme: 'sum', moyenne: 'avg', compter: 'count', arrondi: 'round', concatener: 'concat', concaténer: 'concat', aujourdhui: 'today', longueur: 'length', maximum: 'max', minimum: 'min',
  // pt
  e: 'and', nao: 'not', não: 'not', 'potência': 'pow', resto: 'mod', int: 'floor', inteiro: 'floor', teto: 'ceil', maiuscula: 'upper', 'maiúscula': 'upper', minuscula: 'lower', 'minúscula': 'lower', contarvalores: 'counta', 'évazio': 'empty', evazio: 'empty', se: 'if', soma: 'sum', media: 'avg', 'média': 'avg', arredondar: 'round', hoje: 'today', comprimento: 'length',
  // it
  radq: 'sqrt', potenza: 'pow', intero: 'floor', soffitto: 'ceil', maiusc: 'upper', contavalori: 'counta', vuoto: 'empty', somma: 'sum', conta: 'count', arrotonda: 'round', concatena: 'concat', oggi: 'today', massimo: 'max', lunghezza: 'length',
  // de
  und: 'and', oder: 'or', nicht: 'not', wurzel: 'sqrt', potenz: 'pow', rest: 'mod', ganzzahl: 'floor', obergrenze: 'ceil', gross: 'upper', 'groß': 'upper', klein: 'lower', anzahl2: 'counta', istleer: 'empty', wenn: 'if', summe: 'sum', mittelwert: 'avg', anzahl: 'count', runden: 'round', verketten: 'concat', heute: 'today', laenge: 'length', 'länge': 'length' };

function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (...ops: string[]) => peek()?.t === 'op' && ops.includes(peek().v) || (peek()?.t === 'id' && ops.includes(peek().v.toLowerCase()));
  const take = () => toks[p++];
  const expect = (t: Tok['t']) => { const x = take(); if (!x || x.t !== t) throw new FormulaError(x ? tr('calc.f.expected', { t, v: x.v }) : tr('calc.f.expectedEnd', { t })); return x; };
  const or = (): Node => { let a = and(); while (isOp('||', 'or', 'o')) { take(); a = { k: 'bin', op: '||', a, b: and() }; } return a; };
  const and = (): Node => { let a = not(); while (isOp('&&', 'and', 'y')) { take(); a = { k: 'bin', op: '&&', a, b: not() }; } return a; };
  const not = (): Node => (isOp('!', 'not', 'no') ? (take(), { k: 'un', op: '!', a: not() }) : cmp());
  const cmp = (): Node => { const a = add(); if (isOp('==', '!=', '>', '<', '>=', '<=')) { const op = take().v; return { k: 'bin', op, a, b: add() }; } return a; };
  const add = (): Node => { let a = mul(); while (isOp('+', '-')) { const op = take().v; a = { k: 'bin', op, a, b: mul() }; } return a; };
  const mul = (): Node => { let a = unary(); while (isOp('*', '/', '%')) { const op = take().v; a = { k: 'bin', op, a, b: unary() }; } return a; };
  const unary = (): Node => (isOp('-') ? (take(), { k: 'un', op: '-', a: unary() }) : primary());
  /** Una referencia suelta es una celda; seguida de «:» y otra, un rango. */
  const rangeFrom = (a: Ref): Node => {
    if (peek()?.t === ':') {
      const n = toks[p + 1];
      if (!n) throw new FormulaError(tr('calc.f.rangeNoSecond'));
      const b = n.t === 'prop' && idRef(n.v) ? idRef(n.v)! : n.t === 'id' && isCellRef(n.v) ? typedRef(n.v) : null;
      if (!b) throw new FormulaError(tr('calc.f.rangeNeedsCell', { v: n.v }));
      take(); take();
      return { k: 'range', a, b };
    }
    return a.k === 'id' && a.r === '*' ? { k: 'range', a, b: a } : a;
  };
  const primary = (): Node => {
    const x = take();
    if (!x) throw new FormulaError(tr('calc.f.incomplete'));
    if (x.t === 'num') { const v = Number(x.v); if (isNaN(v)) throw new FormulaError(tr('calc.f.badNumber', { v: x.v })); return { k: 'num', v }; }
    if (x.t === 'str') return { k: 'str', v: x.v };
    if (x.t === 'prop') {
      const id = idRef(x.v);
      if (id) return rangeFrom(id);
      return { k: 'prop', name: x.v };
    }
    if (x.t === '(') { const e = or(); expect(')'); return e; }
    if (x.t === 'id') {
      const low = x.v.toLowerCase();
      if (x.v.startsWith('#')) throw new FormulaError(tr('calc.f.refGone'));
      if (peek()?.t !== '(') {
        if (/^[A-Za-z]{1,3}$/.test(x.v) && peek()?.t === ':' && toks[p + 1]?.t === 'id' && /^[A-Za-z]{1,3}$/.test(toks[p + 1].v)) { take(); const y = take(); return { k: 'range', a: { k: 'ref', col: x.v.toUpperCase(), row: 0 }, b: { k: 'ref', col: y.v.toUpperCase(), row: 0 } }; }
        if (isCellRef(x.v)) return rangeFrom(typedRef(x.v));
      }
      if (low === 'true' || low === 'verdadero') return { k: 'bool', v: true };
      if (low === 'false' || low === 'falso') return { k: 'bool', v: false };
      if (peek()?.t !== '(') throw new FormulaError(tr('calc.f.unknownName', { v: x.v }));
      take();
      const args: Node[] = [];
      if (peek()?.t !== ')') { args.push(or()); while (peek()?.t === ',') { take(); args.push(or()); } }
      expect(')');
      if (low === 'prop') { if (args[0]?.k !== 'str') throw new FormulaError(tr('calc.f.propNeedsName')); return { k: 'prop', name: args[0].v }; }
      const fn = ALIAS[low] ?? low;
      if (!(fn in FNS)) throw new FormulaError(tr('calc.f.unknownFn', { v: x.v }));
      return { k: 'call', fn, args };
    }
    throw new FormulaError(tr('calc.f.extra', { v: x.v }));
  };
  if (!toks.length) throw new FormulaError(tr('calc.f.empty'));
  const tree = or();
  if (p < toks.length) throw new FormulaError(tr('calc.f.extra', { v: toks[p].v }));
  return tree;
}

const num = (v: FVal, fn: string): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null || v === '') return 0;
  const n = Number(String(v).replace(',', '.'));
  if (isNaN(n)) throw new FormulaError(tr('calc.f.notNumber', { fn, v }));
  return n;
};
const str = (v: FVal): string => (v === null ? '' : typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6).replace('.', decimalSep()) : typeof v === 'boolean' ? (v ? tr('calc.yes') : tr('calc.no')) : v);
const truthy = (v: FVal) => !(v === null || v === false || v === 0 || v === '');
const DAY = 86_400_000;
const dateMs = (v: FVal, fn: string) => { const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) throw new FormulaError(tr('calc.f.notDate', { fn, v: String(v ?? '') })); return Date.UTC(+m[1], +m[2] - 1, +m[3]); };
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const FNS: Record<string, (a: FVal[], today: string) => FVal> = {
  if: (a) => (truthy(a[0]) ? a[1] ?? null : a[2] ?? null),
  round: (a) => { const k = 10 ** num(a[1] ?? 0, 'round'); return Math.round(num(a[0], 'round') * k) / k; },
  floor: (a) => Math.floor(num(a[0], 'floor')),
  ceil: (a) => Math.ceil(num(a[0], 'ceil')),
  abs: (a) => Math.abs(num(a[0], 'abs')),
  min: (a) => Math.min(...a.map((x) => num(x, 'min'))),
  max: (a) => Math.max(...a.map((x) => num(x, 'max'))),
  sum: (a) => a.reduce<number>((m, x) => m + num(x, 'sum'), 0),
  avg: (a) => (a.length ? a.reduce<number>((m, x) => m + num(x, 'avg'), 0) / a.length : 0),
  count: (a) => a.filter((x) => typeof x === 'number' || (typeof x === 'string' && x.trim() !== '' && !isNaN(Number(x.replace(',', '.'))))).length,
  counta: (a) => a.filter((x) => x !== null && x !== '').length,
  and: (a) => a.every(truthy),
  or: (a) => a.some(truthy),
  not: (a) => !truthy(a[0]),
  sqrt: (a) => { const n = num(a[0], tr('calc.fn.sqrt')); if (n < 0) throw new FormulaError(tr('calc.f.sqrtNeg')); return Math.sqrt(n); },
  pow: (a) => num(a[0], tr('calc.fn.pow')) ** num(a[1], tr('calc.fn.pow')),
  mod: (a) => { const d = num(a[1], tr('calc.fn.mod')); if (d === 0) throw new FormulaError(tr('calc.f.divZero')); return num(a[0], tr('calc.fn.mod')) % d; },
  concat: (a) => a.map(str).join(''),
  length: (a) => str(a[0]).length,
  upper: (a) => str(a[0]).toUpperCase(),
  lower: (a) => str(a[0]).toLowerCase(),
  contains: (a) => str(a[0]).toLowerCase().includes(str(a[1]).toLowerCase()),
  empty: (a) => !truthy(a[0]),
  tonumber: (a) => num(a[0], 'toNumber'),
  format: (a) => str(a[0]),
  today: (_a, today) => today,
  datebetween: (a) => {
    const d = (dateMs(a[0], 'dateBetween') - dateMs(a[1], 'dateBetween')) / DAY;
    const u = str(a[2] ?? 'days').toLowerCase();
    return u.startsWith('week') || u.startsWith('sem') ? Math.trunc(d / 7) : u.startsWith('month') || u.startsWith('mes') ? Math.trunc(d / 30.44) : u.startsWith('year') || u.startsWith('año') ? Math.trunc(d / 365.25) : d;
  },
  dateadd: (a) => {
    const n = num(a[1], 'dateAdd'), u = str(a[2] ?? 'days').toLowerCase(), base = new Date(dateMs(a[0], 'dateAdd'));
    if (u.startsWith('month') || u.startsWith('mes')) base.setUTCMonth(base.getUTCMonth() + n);
    else if (u.startsWith('year') || u.startsWith('año')) base.setUTCFullYear(base.getUTCFullYear() + n);
    else base.setUTCDate(base.getUTCDate() + n * (u.startsWith('week') || u.startsWith('sem') ? 7 : 1));
    return iso(base.getTime());
  },
};

/** Ayuda breve de funciones (se calcula al pedirla para respetar el idioma actual). */
export const functionHelp = (): string => tr('calc.f.help');

/** Cómo se leen las propiedades por nombre y las celdas por referencia. */
export type Env = { get: (name: string) => FVal; cell?: (r: Ref) => FVal; range?: (a: Ref, b: Ref) => FVal[] };
const NUMERIC = new Set(['sum', 'avg', 'min', 'max', 'count']);
const refName = (r: Ref) => (r.k === 'ref' ? (r.row ? r.col + r.row : r.col + ':' + r.col) : 'una celda');
const asNum = (x: FVal): number | null => (typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' && !isNaN(Number(x.replace(',', '.'))) ? Number(x.replace(',', '.')) : null);

function evaluate(n: Node, env: Env, today: string): FVal {
  const get = env.get;
  const ev = (x: Node) => evaluate(x, env, today);
  switch (n.k) {
    case 'num': case 'str': case 'bool': return n.v;
    case 'prop': return get(n.name);
    case 'ref': case 'id': if (!env.cell) throw new FormulaError(tr('calc.f.refHere', { v: refName(n) })); return env.cell(n);
    case 'range': throw new FormulaError(tr('calc.f.rangeInFn'));
    case 'un': { const a = ev(n.a); return n.op === '-' ? -num(a, '-') : !truthy(a); }
    case 'call':
      // if() solo evalúa la rama que toca (así una rama con error no afecta a la otra).
      if (n.fn === 'if') return truthy(ev(n.args[0])) ? (n.args[1] ? ev(n.args[1]) : null) : (n.args[2] ? ev(n.args[2]) : null);
      {
        const vals: FVal[] = [];
        for (const x of n.args) {
          if (x.k !== 'range') { vals.push(ev(x)); continue; }
          if (!env.range) throw new FormulaError(tr('calc.f.rangeHere', { a: refName(x.a), b: refName(x.b) }));
          const cells = env.range(x.a, x.b);
          if (NUMERIC.has(n.fn)) { for (const c of cells) { const k = asNum(c); if (k !== null) vals.push(k); } } else vals.push(...cells);
        }
        return FNS[n.fn](vals, today);
      }
    case 'bin': {
      if (n.op === '&&') return truthy(ev(n.a)) && truthy(ev(n.b));
      if (n.op === '||') return truthy(ev(n.a)) || truthy(ev(n.b));
      const a = ev(n.a), b = ev(n.b);
      switch (n.op) {
        case '+': return typeof a === 'string' || typeof b === 'string' ? str(a) + str(b) : num(a, '+') + num(b, '+');
        case '-': return num(a, '-') - num(b, '-');
        case '*': return num(a, '*') * num(b, '*');
        case '/': { const d = num(b, '/'); if (d === 0) throw new FormulaError(tr('calc.f.divZero')); return num(a, '/') / d; }
        case '%': return num(a, '%') % num(b, '%');
        case '==': return a === b || str(a) === str(b);
        case '!=': return !(a === b || str(a) === str(b));
        case '>': return typeof a === 'string' && typeof b === 'string' ? a > b : num(a, '>') > num(b, '>');
        case '<': return typeof a === 'string' && typeof b === 'string' ? a < b : num(a, '<') < num(b, '<');
        case '>=': return typeof a === 'string' && typeof b === 'string' ? a >= b : num(a, '>=') >= num(b, '>=');
        case '<=': return typeof a === 'string' && typeof b === 'string' ? a <= b : num(a, '<=') <= num(b, '<=');
      }
    }
  }
  return null;
}

const cache = new Map<string, Node | FormulaError>();
/** Comprueba la sintaxis (para avisar al escribir la fórmula). Devuelve el error o null. */
export function checkFormula(src: string): string | null {
  try { compile(src); return null; } catch (e) { return (e as Error).message; }
}
function compile(src: string): Node {
  const ck = getLang() + '\u0000' + src;
  let c = cache.get(ck);
  if (!c) { try { c = parse(src); } catch (e) { c = e instanceof FormulaError ? e : new FormulaError(tr('calc.f.invalid')); } if (cache.size > 500) cache.clear(); cache.set(ck, c); }
  if (c instanceof FormulaError) throw c;
  return c;
}

/** Evalúa una fórmula. `get` devuelve el valor de una propiedad por su nombre. */
export function runFormula(src: string, get: (name: string) => FVal, today: string, refs?: Pick<Env, 'cell' | 'range'>): FVal {
  return evaluate(compile(src), { get, ...refs }, today);
}

/** Nombres de propiedades usados en una fórmula (para detectar referencias a columnas que no existen). */
export function propsIn(src: string): string[] {
  try { const out: string[] = []; const walk = (n: Node) => { if (n.k === 'prop' && !n.name.startsWith('#')) out.push(n.name); if (n.k === 'call') n.args.forEach(walk); if (n.k === 'un') walk(n.a); if (n.k === 'bin') { walk(n.a); walk(n.b); } }; walk(compile(src)); return out; } catch { return []; }
}

/**
 * Recorre las referencias de celda de una fórmula y sustituye cada una por lo que devuelva `fn`
 * (o la deja igual si devuelve null). El resto del texto (comillas, espacios…) no cambia.
 * En «B:D» cada letra es una columna entera (`{#col:*}` al guardarla).
 */
export function mapRefs(src: string, fn: (r: Ref) => string | null): string {
  let toks: Tok[];
  try { toks = tokenize(src); } catch { return src; }
  let out = '', at = 0;
  const put = (from: number, to: number, text: string | null) => { if (text === null) return; out += src.slice(at, from) + text; at = to; };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], nx = toks[i + 1];
    if (t.t === 'prop') { const id = idRef(t.v); if (id) put(t.at, t.end, fn(id)); continue; }
    if (t.t !== 'id' || nx?.t === '(') continue;
    const letters = (k: Tok | undefined) => k?.t === 'id' && /^[A-Za-z]{1,3}$/.test(k.v);
    if (letters(t) && ((nx?.t === ':' && letters(toks[i + 2])) || (toks[i - 1]?.t === ':' && letters(toks[i - 2])))) { put(t.at, t.end, fn({ k: 'ref', col: t.v.toUpperCase(), row: 0 })); continue; }
    if (isCellRef(t.v)) put(t.at, t.end, fn(typedRef(t.v)));
  }
  return out + src.slice(at);
}

/** Explica un error de fórmula con palabras sencillas: qué pasó, por qué y cómo arreglarlo. */
export function explainError(msg: string): { title: string; why: string; fix: string } {
  const m = msg || tr('calc.f.invalid');
  const t = (title: string, why: string, fix: string) => ({ title, why, fix });
  // Los patrones son texto traducible: cada idioma escribe los fragmentos de sus propios mensajes (se prueba también el español).
  const hit = (key: Parameters<typeof tr>[0]) => new RegExp(tr(key), 'i').test(m) || new RegExp(tIn('es', key), 'i').test(m);
  if (hit('calc.fx.m.circular')) return t(tr('calc.fx.circular.title'), tr('calc.fx.circular.why'), tr('calc.fx.circular.fix'));
  if (hit('calc.fx.m.gone')) return t(tr('calc.fx.gone.title'), tr('calc.fx.gone.why'), tr('calc.fx.gone.fix'));
  if (hit('calc.fx.m.noProp')) return t(tr('calc.fx.noProp.title'), m, tr('calc.fx.noProp.fix'));
  if (hit('calc.fx.m.divZero')) return t(tr('calc.fx.divZero.title'), tr('calc.fx.divZero.why'), tr('calc.fx.divZero.fix'));
  if (hit('calc.fx.m.notNumber')) return t(tr('calc.fx.notNumber.title'), m, tr('calc.fx.notNumber.fix'));
  if (hit('calc.fx.m.notDate')) return t(tr('calc.fx.notDate.title'), m, tr('calc.fx.notDate.fix'));
  if (hit('calc.fx.m.unknownFn')) return t(tr('calc.fx.unknownFn.title'), m, tr('calc.fx.unknownFn.fix'));
  if (hit('calc.fx.m.syntax')) return t(tr('calc.fx.syntax.title'), m, tr('calc.fx.syntax.fix'));
  return t(tr('calc.fx.other.title'), m, tr('calc.fx.other.fix'));
}
