import type { CheckItem } from './model';

/** Profundidad máxima: tarea (0), subtarea (1), sub-subtarea (2)… hasta el nivel 4. */
export const MAX_LEVEL = 4;

/** Ajusta los niveles: el primero es 0 y cada uno como mucho un nivel más que el anterior. */
export function normalizeLevels(items: CheckItem[]): CheckItem[] {
  let prev = -1;
  let changed = false;
  const out = items.map((it) => {
    const level = Math.max(0, Math.min(Math.round(Number(it.level) || 0), MAX_LEVEL, prev + 1));
    prev = level;
    if (level === it.level) return it;
    changed = true;
    return { ...it, level };
  });
  return changed ? out : items;
}

/** Índice siguiente al último descendiente de la tarea `i` (= i + 1 si no tiene subtareas). */
export function descEnd(items: CheckItem[], i: number): number {
  let j = i + 1;
  while (j < items.length && items[j].level > items[i].level) j++;
  return j;
}

/** Ids de lo que se ve (las subtareas de una tarea plegada no cuentan). */
export function visibleIds(items: CheckItem[], collapsed: Set<string>): string[] {
  const out: string[] = [];
  let hideBelow = -1;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (hideBelow >= 0 && it.level > hideBelow) continue;
    hideBelow = -1;
    out.push(it.id);
    if (collapsed.has(it.id) && descEnd(items, i) > i + 1) hideBelow = it.level;
  }
  return out;
}

/**
 * Estado de cada tarea: «hecha» (una tarea con subtareas está hecha si lo están todas las suyas),
 * y cuántas hojas (tareas sin subtareas) tiene debajo y cuántas están hechas.
 */
export function effective(items: CheckItem[]): { done: boolean[]; leaves: number[]; leavesDone: number[]; hasKids: boolean[] } {
  const n = items.length;
  const done = new Array<boolean>(n).fill(false);
  const leaves = new Array<number>(n).fill(0);
  const leavesDone = new Array<number>(n).fill(0);
  const hasKids = new Array<boolean>(n).fill(false);
  for (let i = n - 1; i >= 0; i--) {
    const end = descEnd(items, i);
    if (end === i + 1) { done[i] = items[i].done; continue; }
    hasKids[i] = true;
    let all = true;
    for (let j = i + 1; j < end; j++) {
      if (items[j].level === items[i].level + 1) all = all && done[j];
      if (!hasKids[j]) { leaves[i]++; if (done[j]) leavesDone[i]++; }
    }
    done[i] = all;
  }
  return { done, leaves, leavesDone, hasKids };
}

/** Mueve la tarea (y todo lo que cuelga de ella) `delta` niveles; null si no es posible. */
export function shiftSubtree(items: CheckItem[], id: string, delta: 1 | -1): CheckItem[] | null {
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const end = descEnd(items, i);
  const it = items[i];
  if (delta === 1) {
    if (i === 0 || it.level > items[i - 1].level) return null; // solo puede colgar de la tarea anterior
    let deepest = it.level;
    for (let j = i; j < end; j++) deepest = Math.max(deepest, items[j].level);
    if (deepest + 1 > MAX_LEVEL) return null;
  } else if (it.level === 0) return null;
  return items.map((x, k) => (k >= i && k < end ? { ...x, level: x.level + delta } : x));
}

/** Índices (lo, hi) en `items` del bloque entre dos tareas; si la última está plegada incluye sus subtareas. */
export function blockRange(items: CheckItem[], collapsed: Set<string>, a: string, b: string): [number, number] | null {
  const ia = items.findIndex((x) => x.id === a), ib = items.findIndex((x) => x.id === b);
  if (ia < 0 || ib < 0) return null;
  const lo = Math.min(ia, ib);
  let hi = Math.max(ia, ib);
  if (collapsed.has(items[hi].id)) hi = descEnd(items, hi) - 1;
  return [lo, hi];
}

/** Lista como Markdown: «- [ ] tarea», con dos espacios de sangría por nivel (el primero queda sin sangría). */
export function checklistToMarkdown(items: CheckItem[]): string {
  const base = items.reduce((m, it) => Math.min(m, it.level), Infinity);
  return items.map((it) => `${'  '.repeat(Math.max(0, it.level - (Number.isFinite(base) ? base : 0)))}- [${it.done ? 'x' : ' '}] ${it.text}`).join('\n');
}

/** ¿El texto pegado son varias líneas (o una línea con formato de lista)? */
export function looksLikeList(text: string): boolean {
  const t = text.replace(/\r/g, '').replace(/\n+$/, '');
  return t.includes('\n') || /^\s*(?:[-*+]\s+\[[ xX]\]\s|[-*+]\s)/.test(t);
}

/**
 * Convierte texto pegado en tareas. Acepta Markdown («- [x] tarea», «- tarea», «1. tarea») y
 * líneas sueltas; cada 2 espacios (o un tabulador) de sangría es un nivel más de subtarea.
 */
export function parseChecklist(text: string, newId: () => string): CheckItem[] {
  const out: CheckItem[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    if (!raw.trim()) continue;
    const m = raw.match(/^(\s*)(?:[-*+]\s+\[([ xX])\]\s+|[-*+]\s+|\d+[.)]\s+)?(.*)$/);
    const indent = m ? m[1].replace(/\t/g, '  ').length : 0;
    const done = !!m && (m[2] === 'x' || m[2] === 'X');
    const body = (m ? m[3] : raw).trim();
    if (!body) continue;
    // Una sangría solo vale si cuelga de una tarea anterior: como mucho un nivel más que ella.
    const prev = out.length ? out[out.length - 1].level : -1;
    out.push({ id: newId(), text: body, done, level: Math.min(Math.floor(indent / 2), prev + 1, MAX_LEVEL) });
  }
  return out;
}

/** Nº de líneas visuales que ocupa `text` en un cuadro de texto, midiendo una copia invisible (0 si no se puede medir). */
export function measureLines(el: HTMLTextAreaElement, text: string): number {
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  if (!lh || !el.clientWidth) return 0;
  const mirror = document.createElement('div');
  for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'] as const) mirror.style[k] = cs[k];
  mirror.style.cssText += ';position:absolute;visibility:hidden;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all;top:0;left:-9999px;box-sizing:border-box;width:' + el.clientWidth + 'px';
  mirror.textContent = text + '​';
  document.body.appendChild(mirror);
  const lines = Math.max(1, Math.round(mirror.scrollHeight / lh));
  document.body.removeChild(mirror);
  return lines;
}

/**
 * ¿Está el cursor en la primera línea visual (`up`) o en la última (`down`)? Se mide con la misma
 * copia para el cursor y para el texto entero, así no depende del relleno ni del tipo de letra.
 * Sin poder medir (p. ej. en pruebas sin diseño) vale siempre.
 */
export function caretAtEdge(el: HTMLTextAreaElement, edge: 'up' | 'down'): boolean {
  const total = measureLines(el, el.value);
  if (!total) return true;
  if (edge === 'up') return measureLines(el, el.value.slice(0, el.selectionStart)) <= 1;
  return measureLines(el, el.value.slice(0, el.selectionEnd)) >= total;
}
