// Editor visual de la tarjeta Nota. El texto se ve y se edita con su formato (negrita, listas, títulos…),
// sin sintaxis Markdown. Por dentro la nota se sigue guardando como Markdown (así los enlaces [[ ]],
// la búsqueda, el grafo y las copias de seguridad no cambian): aquí se convierte Markdown ⇄ bloques.
//
// El editor es una lista de bloques `<div data-k="…">`, uno por línea: p, h1-h3, li, ol, task, quote, hr.
// Nunca se usa innerHTML: todo se construye con createElement/createTextNode.

import { parse, splitWiki } from './markdown';

export type Kind = 'p' | 'h1' | 'h2' | 'h3' | 'li' | 'ol' | 'task' | 'quote' | 'hr';
export const LISTY = new Set<Kind>(['li', 'ol', 'task']);
export const MAX_INDENT = 5;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

// ---------------------------------------------------------------------------------------------
// Markdown → DOM

/** Texto con formato Markdown → nodos (texto, negrita, cursiva, tachado, código, enlaces y [[enlaces]]). */
export function inlineNodes(text: string): Node[] {
  const w = /\[\[([^\]\n]+)\]\]/.exec(text);
  if (w) {
    const { dest, label } = splitWiki(w[1]);
    const s = el('span', 'wiki'); s.dataset.dest = dest; s.contentEditable = 'false'; s.textContent = label;
    return [...inlineNodes(text.slice(0, w.index)), s, ...inlineNodes(text.slice(w.index + w[0].length))];
  }
  const ml = /\[([^\]\n]+)\]\(([^)\s]*)\)/.exec(text);
  if (ml) {
    const a = el('a', 'ext'); a.setAttribute('href', '#'); a.dataset.url = ml[2]; a.title = ml[2]; a.append(...inlineNodes(ml[1]));
    return [...inlineNodes(text.slice(0, ml.index)), a, ...inlineNodes(text.slice(ml.index + ml[0].length))];
  }
  const rules: { re: RegExp; tag: 'strong' | 'em' | 's' | 'code'; both?: boolean }[] = [
    { re: /`([^`]+)`/, tag: 'code' },
    { re: /\*\*\*([^*]+)\*\*\*/, tag: 'strong', both: true },
    { re: /\*\*([^*]+)\*\*/, tag: 'strong' },
    { re: /~~([^~]+)~~/, tag: 's' },
    { re: /(?:^|[^*])\*([^*]+)\*/, tag: 'em' },
  ];
  let best: { m: RegExpExecArray; r: (typeof rules)[number]; start: number } | null = null;
  for (const r of rules) {
    const m = r.re.exec(text);
    if (!m) continue;
    const start = m.index + (m[0].startsWith('*') || m[0].startsWith('`') || m[0].startsWith('~') ? 0 : m[0].length - m[0].replace(/^[^*]/, '').length);
    if (!best || start < best.start) best = { m, r, start };
  }
  if (!best) return text ? [document.createTextNode(text)] : [];
  const { m, r, start } = best;
  const node = el(r.tag);
  if (r.both) { const em = el('em'); em.append(...inlineNodes(m[1])); node.append(em); } else if (r.tag === 'code') node.textContent = m[1]; else node.append(...inlineNodes(m[1]));
  return [...inlineNodes(text.slice(0, start)), node, ...inlineNodes(text.slice(m.index + m[0].length))];
}

/** Crea un bloque. `done` solo sirve en las tareas. */
export function makeBlock(kind: Kind, nodes: Node[] = [], indent = 0, done = false): HTMLElement {
  const b = el('div'); b.dataset.k = kind;
  if (indent) b.dataset.i = String(indent);
  if (done) b.dataset.done = '1';
  if (kind === 'hr') { b.contentEditable = 'false'; b.append(el('hr')); return b; }
  b.append(...nodes);
  fixBlock(b);
  return b;
}

/** Deja un bloque en orden: la marca (viñeta, número, casilla) al principio y un `<br>` si está vacío. */
export function fixBlock(b: HTMLElement, num = 1) {
  const kind = (b.dataset.k as Kind) || 'p';
  if (kind === 'hr') return;
  const want = kind === 'li' ? '•' : kind === 'ol' ? num + '.' : kind === 'task' ? (b.dataset.done ? '☑' : '☐') : '';
  const marks = [...b.querySelectorAll(':scope > .rn-mark')] as HTMLElement[];
  const mark = marks[0];
  marks.slice(1).forEach((m) => m.remove());
  if (!want) mark?.remove();
  else if (!mark) { const m = el('span', 'rn-mark'); m.contentEditable = 'false'; m.textContent = want; m.dataset.mark = kind; b.prepend(m); }
  else { if (mark.textContent !== want) mark.textContent = want; mark.dataset.mark = kind; if (b.firstChild !== mark) b.prepend(mark); }
  b.style.paddingLeft = LISTY.has(kind) && b.dataset.i ? Number(b.dataset.i) * 18 + 'px' : '';
  const hasContent = [...b.childNodes].some((n) => !(n as HTMLElement).classList?.contains('rn-mark') && n.nodeName !== 'BR' && (n.textContent ?? '') !== '');
  const brs = [...b.querySelectorAll(':scope > br')];
  if (hasContent) brs.forEach((x) => x.remove());
  else if (!brs.length) b.append(el('br'));
}

/** Número de cada bloque `ol` según los que lo preceden con la misma sangría. */
function renumber(root: HTMLElement) {
  const count: number[] = [];
  for (const b of [...root.children] as HTMLElement[]) {
    const kind = b.dataset.k as Kind, i = Number(b.dataset.i || 0);
    if (kind === 'ol') { count.length = i + 1; count[i] = (count[i] ?? 0) + 1; fixBlock(b, count[i]); }
    else { if (!LISTY.has(kind)) count.length = 0; else count.length = i + 1; fixBlock(b); }
  }
}

/** Pinta el Markdown en el editor. */
export function render(root: HTMLElement, md: string) {
  root.replaceChildren();
  for (const b of parse(md)) {
    switch (b.k) {
      case 'h': root.append(makeBlock(('h' + b.level) as Kind, inlineNodes(b.text))); break;
      case 'task': root.append(makeBlock('task', inlineNodes(b.text), Math.min(MAX_INDENT, b.indent), b.done)); break;
      case 'li': root.append(makeBlock(b.ordered ? 'ol' : 'li', inlineNodes(b.text), Math.min(MAX_INDENT, b.indent))); break;
      case 'quote': root.append(makeBlock('quote', inlineNodes(b.text))); break;
      case 'hr': root.append(makeBlock('hr')); break;
      case 'p': root.append(makeBlock('p', inlineNodes(b.text))); break;
      default: root.append(makeBlock('p'));
    }
  }
  if (!root.children.length) root.append(makeBlock('p'));
  renumber(root);
}

// ---------------------------------------------------------------------------------------------
// DOM → Markdown

const B = new Set(['B', 'STRONG']), I = new Set(['I', 'EM']), S = new Set(['S', 'STRIKE', 'DEL']);

function inlineMd(nodes: ArrayLike<Node>): string {
  let out = '';
  for (const n of Array.from(nodes)) {
    if (n.nodeType === 3) { out += (n.textContent ?? '').replace(/[​ ]/g, (c) => (c === ' ' ? ' ' : '')); continue; }
    if (!(n instanceof HTMLElement)) continue;
    if (n.classList.contains('rn-mark') || n.nodeName === 'BR') continue;
    if (n.classList.contains('wiki')) { const d = n.dataset.dest ?? ''; const l = n.textContent ?? ''; out += `[[${d}|${l}]]`; continue; }
    const inner = inlineMd(n.childNodes);
    if (!inner.trim()) { out += inner; continue; }
    // Los espacios de los bordes quedan fuera de la marca (así «**a **» no se rompe).
    const lead = inner.match(/^\s*/)![0], trail = inner.match(/\s*$/)![0], core = inner.trim();
    const wrap = (m: string) => lead + m + core + m + trail;
    if (B.has(n.nodeName)) out += wrap('**');
    else if (I.has(n.nodeName)) out += wrap('*');
    else if (S.has(n.nodeName)) out += wrap('~~');
    else if (n.nodeName === 'CODE') out += wrap('`');
    else if (n.nodeName === 'A') out += `${lead}[${core}](${n.dataset.url ?? n.getAttribute('href') ?? ''})${trail}`;
    else if (n.nodeName === 'DIV' || n.nodeName === 'P') out += inner;
    else out += inner;
  }
  return out;
}

const PREFIX: Record<Kind, string> = { p: '', h1: '# ', h2: '## ', h3: '### ', li: '- ', ol: '', task: '- [ ] ', quote: '> ', hr: '---' };

/** Editor → Markdown. */
export function serialize(root: HTMLElement): string {
  const lines: string[] = [];
  const count: number[] = [];
  for (const b of [...root.children] as HTMLElement[]) {
    const kind = (b.dataset.k as Kind) || 'p';
    const i = Number(b.dataset.i || 0);
    const text = kind === 'hr' ? '' : inlineMd(b.childNodes).replace(/\n/g, ' ');
    if (kind === 'ol') { count.length = i + 1; count[i] = (count[i] ?? 0) + 1; } else if (!LISTY.has(kind)) count.length = 0; else count.length = i + 1;
    const pad = LISTY.has(kind) ? '  '.repeat(i) : '';
    const pre = kind === 'ol' ? `${count[i]}. ` : kind === 'task' ? (b.dataset.done ? '- [x] ' : '- [ ] ') : PREFIX[kind];
    lines.push(kind === 'hr' ? '---' : pad + pre + text);
  }
  // Una nota vacía son cero caracteres, no una línea en blanco.
  return lines.length === 1 && lines[0] === '' ? '' : lines.join('\n');
}

/** Deja el editor con la estructura correcta tras una edición (el navegador puede crear divs sueltos). */
export function normalize(root: HTMLElement) {
  for (const n of [...root.childNodes]) {
    if (n instanceof HTMLElement && n.nodeName === 'DIV') {
      if (!n.dataset.k) n.dataset.k = 'p';
      // Un div anidado (algunos navegadores lo crean) se aplana en bloques hermanos.
      const inner = [...n.children].filter((c) => c.nodeName === 'DIV' && (c as HTMLElement).dataset.k) as HTMLElement[];
      if (inner.length) { inner.forEach((c) => n.before(c)); if (!inlineMd(n.childNodes).trim() && !n.querySelector('.wiki')) n.remove(); }
    } else {
      const wrap = makeBlock('p');
      wrap.querySelector('br')?.remove();
      root.insertBefore(wrap, n);
      if (n.nodeName !== 'BR') wrap.append(n); else n.remove();
      fixBlock(wrap);
    }
  }
  if (!root.children.length) root.append(makeBlock('p'));
  renumber(root);
}

// ---------------------------------------------------------------------------------------------
// Selección y edición

export const blockOf = (node: Node | null, root: HTMLElement): HTMLElement | null => {
  for (let n = node; n && n !== root; n = n.parentNode) if (n.parentNode === root) return n as HTMLElement;
  return null;
};

export function selectedBlocks(root: HTMLElement, range: Range): HTMLElement[] {
  const a = blockOf(range.startContainer, root), b = blockOf(range.endContainer, root);
  if (!a || !b) return [];
  const all = [...root.children] as HTMLElement[];
  return all.slice(all.indexOf(a), all.indexOf(b) + 1);
}

/** Pone el cursor al principio o al final del texto de un bloque. */
export function caretIn(b: HTMLElement, atEnd: boolean) {
  const r = document.createRange();
  const mark = b.querySelector(':scope > .rn-mark');
  if (atEnd) { r.selectNodeContents(b); r.collapse(false); const br = b.querySelector(':scope > br'); if (br) { r.setStartBefore(br); r.collapse(true); } } else if (mark) r.setStartAfter(mark); else r.setStart(b, 0);
  r.collapse(true);
  const s = window.getSelection();
  s?.removeAllRanges(); s?.addRange(r);
}

/** ¿El cursor está al principio del texto del bloque (sin contar la viñeta)? */
export function atBlockStart(b: HTMLElement, range: Range): boolean {
  if (!range.collapsed) return false;
  const pre = document.createRange();
  pre.selectNodeContents(b);
  pre.setEnd(range.startContainer, range.startOffset);
  const frag = pre.cloneContents();
  frag.querySelectorAll('.rn-mark, br').forEach((x) => x.remove());
  return (frag.textContent ?? '') === '';
}

export const blockIsEmpty = (b: HTMLElement) => inlineMd(b.childNodes).trim() === '' && !b.querySelector('.wiki');

/** Parte un bloque en el cursor. Devuelve el bloque nuevo (con lo que había después del cursor). */
export function splitBlock(b: HTMLElement, range: Range): HTMLElement {
  if (!range.collapsed) range.deleteContents();
  const tail = document.createRange();
  tail.setStart(range.endContainer, range.endOffset);
  tail.setEnd(b, b.childNodes.length);
  const frag = tail.extractContents();
  frag.querySelectorAll('.rn-mark').forEach((x) => x.remove());
  const kind = (b.dataset.k as Kind) || 'p';
  const next: Kind = kind === 'h1' || kind === 'h2' || kind === 'h3' || kind === 'hr' ? 'p' : kind;
  const nb = makeBlock(next, [], Number(b.dataset.i || 0));
  nb.querySelector('br')?.remove();
  nb.append(frag);
  fixBlock(b); fixBlock(nb);
  b.after(nb);
  return nb;
}

/** Envuelve (o desenvuelve) la selección con un formato: negrita, cursiva, tachado o código. */
export function toggleInline(root: HTMLElement, range: Range, tag: 'strong' | 'em' | 's' | 'code') {
  if (range.collapsed) return;
  const names = tag === 'strong' ? B : tag === 'em' ? I : tag === 's' ? S : new Set(['CODE']);
  const blocks = selectedBlocks(root, range);
  const subs = blocks.map((b) => {
    const r = document.createRange();
    const first = b === blocks[0], last = b === blocks[blocks.length - 1];
    if (first) r.setStart(range.startContainer, range.startOffset); else { const m = b.querySelector(':scope > .rn-mark'); if (m) r.setStartAfter(m); else r.setStart(b, 0); }
    if (last) r.setEnd(range.endContainer, range.endOffset); else r.setEnd(b, b.childNodes.length);
    return r;
  });
  const has = (r: Range) => { for (let n: Node | null = r.commonAncestorContainer; n && n !== root; n = n.parentNode) if (n instanceof HTMLElement && names.has(n.nodeName)) return n; return null; };
  const allInside = subs.every((r) => has(r) || r.collapsed);
  let lastEl: HTMLElement | null = null, firstEl: HTMLElement | null = null;
  for (const r of subs) {
    if (r.collapsed) continue;
    if (allInside) {
      const a = has(r);
      if (a) { while (a.firstChild) a.before(a.firstChild); a.remove(); }
    } else {
      const frag = r.extractContents();
      (frag as DocumentFragment).querySelectorAll?.(tag).forEach((x) => { while (x.firstChild) x.before(x.firstChild); x.remove(); });
      const e = el(tag); e.append(frag); r.insertNode(e);
      firstEl = firstEl ?? e; lastEl = e;
    }
  }
  for (const b of blocks) { b.normalize(); fixBlock(b); }
  const s = window.getSelection();
  if (s && firstEl && lastEl) { const nr = document.createRange(); nr.setStartBefore(firstEl); nr.setEndAfter(lastEl); s.removeAllRanges(); s.addRange(nr); }
}

/** Cambia el tipo de los bloques seleccionados (o vuelve a párrafo si ya lo eran todos). */
export function setKind(root: HTMLElement, range: Range, kind: Kind) {
  const blocks = selectedBlocks(root, range).filter((b) => b.dataset.k !== 'hr');
  const all = blocks.length > 0 && blocks.every((b) => b.dataset.k === kind);
  for (const b of blocks) {
    b.dataset.k = all ? 'p' : kind;
    if (all || !LISTY.has(kind)) { delete b.dataset.i; delete b.dataset.done; }
    if (kind !== 'task') delete b.dataset.done;
  }
  renumber(root);
}

/** Cambia la sangría de las listas seleccionadas. */
export function indent(root: HTMLElement, range: Range, d: 1 | -1): boolean {
  const blocks = selectedBlocks(root, range).filter((b) => LISTY.has(b.dataset.k as Kind));
  if (!blocks.length) return false;
  for (const b of blocks) { const n = Math.max(0, Math.min(MAX_INDENT, Number(b.dataset.i || 0) + d)); if (n) b.dataset.i = String(n); else delete b.dataset.i; }
  renumber(root);
  return true;
}

/** Envuelve la selección en un enlace (o inserta el texto del enlace si no hay selección). */
export function makeLink(range: Range, url: string): HTMLElement {
  const a = el('a', 'ext'); a.setAttribute('href', '#'); a.dataset.url = url; a.title = url;
  if (range.collapsed) a.textContent = url; else a.append(range.extractContents());
  range.insertNode(a);
  return a;
}

export function makeWiki(dest: string, label: string): HTMLElement {
  const s = el('span', 'wiki'); s.dataset.dest = dest; s.contentEditable = 'false'; s.textContent = label;
  return s;
}

/** Inserta texto en varias líneas (pegar): cada línea se interpreta como en el Markdown de siempre. */
export function pasteText(root: HTMLElement, range: Range, text: string): HTMLElement | null {
  const lines = parse(text.replace(/\r\n?/g, '\n').replace(/\n+$/, ''));
  if (!lines.length) return null;
  if (!range.collapsed) range.deleteContents();
  const b = blockOf(range.startContainer, root);
  if (!b) return null;
  const toNodes = (l: (typeof lines)[number]) => ('text' in l ? inlineNodes(l.text) : []);
  if (!/\n/.test(text.replace(/\n+$/, ''))) {
    const nodes = inlineNodes(text.replace(/\r?\n$/, ''));
    for (const n of nodes) { range.insertNode(n); range.setStartAfter(n); range.collapse(true); }
    b.normalize(); fixBlock(b);
    return b;
  }
  const tail = splitBlock(b, range);
  const mk = (l: (typeof lines)[number]): HTMLElement => {
    switch (l.k) {
      case 'h': return makeBlock(('h' + l.level) as Kind, toNodes(l));
      case 'task': return makeBlock('task', toNodes(l), Math.min(MAX_INDENT, l.indent), l.done);
      case 'li': return makeBlock(l.ordered ? 'ol' : 'li', toNodes(l), Math.min(MAX_INDENT, l.indent));
      case 'quote': return makeBlock('quote', toNodes(l));
      case 'hr': return makeBlock('hr');
      case 'p': return makeBlock('p', toNodes(l));
      default: return makeBlock('p');
    }
  };
  // La primera línea se une al bloque actual (solo texto); si el bloque estaba vacío, toma su tipo.
  const first = lines[0];
  if (first.k !== 'gap') {
    if (blockIsEmpty(b) && first.k !== 'hr') {
      const m = mk(first);
      b.dataset.k = m.dataset.k!;
      if (m.dataset.i) b.dataset.i = m.dataset.i; else delete b.dataset.i;
      if (m.dataset.done) b.dataset.done = '1'; else delete b.dataset.done;
      b.replaceChildren(...[...m.childNodes].filter((n) => !(n as HTMLElement).classList?.contains('rn-mark')));
    } else if (first.k !== 'hr') { b.querySelector(':scope > br')?.remove(); b.append(...toNodes(first)); }
    fixBlock(b);
  }
  let at: HTMLElement = b;
  for (const l of lines.slice(1, -1)) { const m = mk(l); at.after(m); at = m; }
  if (lines.length === 1) { b.append(...[...tail.childNodes].filter((n) => !(n as HTMLElement).classList?.contains('rn-mark') && n.nodeName !== 'BR')); tail.remove(); fixBlock(b); return b; }
  const last = lines[lines.length - 1];
  const lastBlock = mk(last);
  // Lo que había después del cursor queda tras la última línea pegada.
  if (!blockIsEmpty(tail)) {
    lastBlock.querySelector(':scope > br')?.remove();
    lastBlock.append(...[...tail.childNodes].filter((n) => !(n as HTMLElement).classList?.contains('rn-mark') && n.nodeName !== 'BR'));
    fixBlock(lastBlock);
  }
  tail.replaceWith(lastBlock);
  if (at !== b) at.after(lastBlock);
  return lastBlock;
}

/** ¿Hay alguna tarea vacía? (para colocar el cursor en la nota del día recién creada). */
export const firstEmptyTask = (root: HTMLElement) => ([...root.children] as HTMLElement[]).find((b) => b.dataset.k === 'task' && blockIsEmpty(b)) ?? null;
