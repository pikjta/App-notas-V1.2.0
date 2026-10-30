// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { caretIn, indent, makeLink, normalize, pasteText, render, serialize, setKind, splitBlock, toggleInline } from '../richnote';

const mk = (md: string) => { const r = document.createElement('div'); document.body.append(r); render(r, md); return r; };
const sel = (a: Node, ao: number, b: Node = a, bo: number = ao) => { const r = document.createRange(); r.setStart(a, ao); r.setEnd(b, bo); const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r); return r; };
const text = (root: HTMLElement, i: number) => root.children[i].lastChild as Text;

describe('Nota: Markdown ⇄ editor visual', () => {
  it('ida y vuelta sin perder nada', () => {
    const md = ['## Título', 'Texto con **negrita**, *cursiva*, ~~tachado~~ y `código`.', '- uno', '  - dentro', '1. primero', '2. segundo', '- [ ] pendiente', '- [x] hecha', '> cita', '---', '', 'Ver [[Inicio|Inicio]] y [web](https://a.b)'].join('\n');
    expect(serialize(mk(md))).toBe(md);
  });
  it('lo que se ve no tiene sintaxis: sin asteriscos, almohadillas ni corchetes', () => {
    const r = mk('# Hola\n**negrita** y [[Inicio]]\n- [ ] tarea');
    expect(r.textContent).not.toMatch(/[*#\[\]]/);
    expect(r.querySelector('strong')!.textContent).toBe('negrita');
    expect(r.querySelector('.wiki')!.getAttribute('data-dest')).toBe('Inicio');
    expect(r.querySelector('[data-k="task"] .rn-mark')!.textContent).toBe('☐');
  });
  it('una nota vacía son cero caracteres', () => {
    expect(serialize(mk(''))).toBe('');
  });
  it('negrita: envolver y desenvolver la selección', () => {
    const r = mk('Hola mundo');
    toggleInline(r, sel(text(r, 0), 5, text(r, 0), 10), 'strong');
    expect(serialize(r)).toBe('Hola **mundo**');
    toggleInline(r, sel(r.querySelector('strong')!.firstChild!, 0, r.querySelector('strong')!.firstChild!, 5), 'strong');
    expect(serialize(r)).toBe('Hola mundo');
  });
  it('tipo de bloque: título, lista, tarea y vuelta a párrafo; sangría', () => {
    const r = mk('uno\ndos');
    setKind(r, sel(text(r, 0), 1), 'h2'); expect(serialize(r)).toBe('## uno\ndos');
    setKind(r, sel(text(r, 0), 1), 'h2'); expect(serialize(r)).toBe('uno\ndos');
    setKind(r, sel(text(r, 0), 0, text(r, 1), 1), 'task'); expect(serialize(r)).toBe('- [ ] uno\n- [ ] dos');
    indent(r, sel(text(r, 1), 1), 1); expect(serialize(r)).toBe('- [ ] uno\n  - [ ] dos');
    indent(r, sel(text(r, 1), 1), -1); expect(serialize(r)).toBe('- [ ] uno\n- [ ] dos');
  });
  it('Enter parte el bloque y la lista continúa; los números se recalculan', () => {
    const r = mk('1. ab');
    const nb = splitBlock(r.children[0] as HTMLElement, sel(text(r, 0), 1));
    caretIn(nb, false);
    normalize(r);
    expect(serialize(r)).toBe('1. a\n2. b');
  });
  it('pegar texto en varias líneas crea bloques; una sola línea se une al texto', () => {
    const r = mk('Inicio fin');
    pasteText(r, sel(text(r, 0), 7), '- a\n- b');
    expect(serialize(r)).toBe('Inicio a\n- bfin'); // lo que había tras el cursor sigue a la última línea pegada
    const r2 = mk('Hola mundo');
    pasteText(r2, sel(text(r2, 0), 4), ' **bello**');
    expect(serialize(r2)).toBe('Hola **bello** mundo');
  });
  it('enlace con dirección', () => {
    const r = mk('mira esto');
    makeLink(sel(text(r, 0), 5, text(r, 0), 9), 'https://a.b');
    expect(serialize(r)).toBe('mira [esto](https://a.b)');
  });
});
