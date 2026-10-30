// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { CheckItem } from '../model';
import { MAX_LEVEL, blockRange, caretAtEdge, checklistToMarkdown, descEnd, effective, looksLikeList, normalizeLevels, parseChecklist, shiftSubtree, visibleIds } from '../checklist';

let n = 0;
const id = () => 'i' + n++;
const mk = (text: string, level: number, done = false): CheckItem => ({ id: text, text, done, level });

describe('checklist: copiar y pegar', () => {
  it('exporta Markdown con sangría para las subtareas', () => {
    const md = checklistToMarkdown([mk('Bocetos', 0), mk('Logo', 1, true)]);
    expect(md).toBe('- [ ] Bocetos\n  - [x] Logo');
  });
  it('exporta sub-subtareas y quita la sangría común de una selección', () => {
    expect(checklistToMarkdown([mk('A', 0), mk('B', 1), mk('C', 2)])).toBe('- [ ] A\n  - [ ] B\n    - [ ] C');
    expect(checklistToMarkdown([mk('B', 1), mk('C', 2)])).toBe('- [ ] B\n  - [ ] C');
  });
  it('lee Markdown, viñetas, números y líneas sueltas', () => {
    const l = parseChecklist('- [x] Uno\n  - [ ] Dos\n3. Tres\n\nCuatro\n\t- Cinco', id);
    expect(l.map((i) => [i.text, i.done, i.level])).toEqual([['Uno', true, 0], ['Dos', false, 1], ['Tres', false, 0], ['Cuatro', false, 0], ['Cinco', false, 1]]);
  });
  it('lee varios niveles de sangría, pero nunca salta un nivel', () => {
    const l = parseChecklist('- A\n    - B\n      - C\n- D\n        - E', id);
    expect(l.map((i) => i.level)).toEqual([0, 1, 2, 0, 1]);
  });
  it('una sangría sin tarea principal antes no crea una subtarea', () => {
    expect(parseChecklist('  - Solo', id)[0].level).toBe(0);
  });
  it('detecta listas pegadas', () => {
    expect(looksLikeList('hola')).toBe(false);
    expect(looksLikeList('a\nb')).toBe(true);
    expect(looksLikeList('- [ ] a')).toBe(true);
  });
});

describe('checklist: niveles', () => {
  const list = [mk('A', 0), mk('A1', 1), mk('A1a', 2), mk('A2', 1), mk('B', 0), mk('B1', 1)];
  it('normaliza: el primero es 0, nadie salta un nivel y hay un máximo', () => {
    expect(normalizeLevels([mk('x', 2), mk('y', 5), mk('z', 0)]).map((i) => i.level)).toEqual([0, 1, 0]);
    expect(normalizeLevels([mk('a', 0), mk('b', 1), mk('c', 2), mk('d', 3), mk('e', 4), mk('f', 4), mk('g', 4)]).map((i) => i.level)).toEqual([0, 1, 2, 3, 4, 4, 4]);
    expect(MAX_LEVEL).toBe(4);
    expect(normalizeLevels(list)).toBe(list); // sin cambios: misma lista
  });
  it('descendientes y tareas visibles', () => {
    expect(descEnd(list, 0)).toBe(4);
    expect(descEnd(list, 1)).toBe(3);
    expect(descEnd(list, 5)).toBe(6);
    expect(visibleIds(list, new Set()).length).toBe(6);
    expect(visibleIds(list, new Set(['A'])).join()).toBe('A,B,B1');
    expect(visibleIds(list, new Set(['A1'])).join()).toBe('A,A1,A2,B,B1');
  });
  it('una tarea con subtareas está hecha si lo están todas; cuenta las hojas', () => {
    const l = [mk('A', 0), mk('A1', 1), mk('A1a', 2, true), mk('A1b', 2), mk('A2', 1, true)];
    const e = effective(l);
    expect(e.done).toEqual([false, false, true, false, true]);
    expect(e.leaves[0]).toBe(3);
    expect(e.leavesDone[0]).toBe(2);
    expect(e.leaves[1]).toBe(2);
    l[3].done = true;
    expect(effective(l).done[0]).toBe(true);
  });
  it('Tab/Mayús+Tab mueven la tarea con todo lo suyo, y solo cuando se puede', () => {
    expect(shiftSubtree(list, 'A', 1)).toBeNull(); // la primera no puede ser subtarea
    expect(shiftSubtree(list, 'B', 1)!.map((i) => i.level)).toEqual([0, 1, 2, 1, 1, 2]); // B cuelga de A (nivel 1) y su B1 baja con ella (nivel 2)
    expect(shiftSubtree(list, 'A2', 1)!.map((i) => i.level)).toEqual([0, 1, 2, 2, 0, 1]);
    expect(shiftSubtree(list, 'A1a', 1)).toBeNull(); // ya cuelga de A1: no puede bajar otro nivel respecto a A1
    expect(shiftSubtree(list, 'A1', -1)!.map((i) => i.level)).toEqual([0, 0, 1, 1, 0, 1]);
    expect(shiftSubtree(list, 'A', -1)).toBeNull();
    const deep = [mk('a', 0), mk('b', 1), mk('c', 2), mk('d', 3), mk('e', 4), mk('f', 0), mk('g', 1)];
    expect(shiftSubtree(deep, 'b', 1)).toBeNull(); // su subárbol ya llega al nivel máximo
  });
  it('bloque seleccionado entre dos tareas (con subtareas ocultas si la última está plegada)', () => {
    expect(blockRange(list, new Set(), 'A1', 'A2')).toEqual([1, 3]);
    expect(blockRange(list, new Set(), 'A2', 'A1')).toEqual([1, 3]);
    expect(blockRange(list, new Set(['A']), 'B', 'A')).toEqual([0, 4]);
    expect(blockRange(list, new Set(['A']), 'A', 'A')).toEqual([0, 3]);
    expect(blockRange(list, new Set(), 'A', 'nada')).toBeNull();
  });
});

describe('checklist: flechas con texto de varias líneas', () => {
  it('detecta la primera y la última línea visual midiendo con una copia', () => {
    const proto = HTMLElement.prototype;
    const sh = Object.getOwnPropertyDescriptor(proto, 'scrollHeight');
    const cw = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
    // 10 caracteres por línea, 20 px por línea; con relleno distinto no debe cambiar nada.
    Object.defineProperty(proto, 'scrollHeight', { configurable: true, get() { return Math.ceil((this.textContent ?? '').length / 10) * 20; } });
    Object.defineProperty(proto, 'clientWidth', { configurable: true, get() { return 100; } });
    try {
      for (const pad of ['0px', '5px', '12px']) {
        const el = document.createElement('textarea');
        el.style.lineHeight = '20px';
        el.style.paddingTop = pad; el.style.paddingBottom = pad;
        document.body.appendChild(el);
        el.value = 'abcdefghij'.repeat(2) + 'xyz'; // 23 caracteres → 3 líneas
        el.setSelectionRange(3, 3);
        expect(caretAtEdge(el, 'up'), 'arriba, primera línea ' + pad).toBe(true);
        expect(caretAtEdge(el, 'down'), 'abajo desde la primera línea ' + pad).toBe(false);
        el.setSelectionRange(15, 15);
        expect(caretAtEdge(el, 'up')).toBe(false);
        expect(caretAtEdge(el, 'down')).toBe(false);
        el.setSelectionRange(23, 23);
        expect(caretAtEdge(el, 'down'), 'abajo, última línea ' + pad).toBe(true);
        el.value = 'corto';
        el.setSelectionRange(2, 2);
        expect(caretAtEdge(el, 'up') && caretAtEdge(el, 'down')).toBe(true); // una sola línea: las dos
        el.remove();
      }
    } finally {
      if (sh) Object.defineProperty(proto, 'scrollHeight', sh); else delete (proto as unknown as Record<string, unknown>).scrollHeight;
      if (cw) Object.defineProperty(proto, 'clientWidth', cw); else delete (proto as unknown as Record<string, unknown>).clientWidth;
    }
  });
});
