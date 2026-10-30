// Markdown → elementos de React. Nunca usa innerHTML: el texto del usuario siempre se trata
// como texto, así que una nota no puede inyectar código en la app.
import type { ReactNode } from 'react';
import { t } from '../i18n';

/** Resuelve un enlace [[destino]]: si existe y qué hacer al pulsarlo. */
export type LinkResolver = (dest: string) => { ok: boolean; go: () => void };

type Inline = { re: RegExp; wrap: (inner: ReactNode, key: string) => ReactNode };

/** Divide «destino|alias». Se muestra el alias o, si no hay, el último tramo del destino. */
export function splitWiki(raw: string): { dest: string; label: string } {
  const i = raw.indexOf('|');
  const last = (d: string) => d.split('/').pop()!.trim() || d.trim();
  return i < 0 ? { dest: raw.trim(), label: last(raw) } : { dest: raw.slice(0, i).trim(), label: raw.slice(i + 1).trim() || last(raw.slice(0, i)) };
}

const INLINE: Inline[] = [
  { re: /`([^`]+)`/, wrap: (x, k) => <code key={k}>{x}</code> },
  { re: /\*\*([^*]+)\*\*/, wrap: (x, k) => <strong key={k}>{x}</strong> },
  { re: /~~([^~]+)~~/, wrap: (x, k) => <s key={k}>{x}</s> },
  { re: /(?:^|[^*])\*([^*]+)\*/, wrap: (x, k) => <em key={k}>{x}</em> },
];

export function inline(text: string, key = 'i', link?: LinkResolver): ReactNode[] {
  // Primero los enlaces [[ ]]: su texto no se interpreta como Markdown.
  const w = /\[\[([^\]\n]+)\]\]/.exec(text);
  if (w) {
    const { dest, label } = splitWiki(w[1]);
    const r = link?.(dest) ?? { ok: false, go: () => undefined };
    return [
      ...inline(text.slice(0, w.index), key + 'w', link),
      <button key={key + 'L' + w.index} type="button" className={'wiki' + (r.ok ? '' : ' broken')} title={r.ok ? t('card.md.goTo', { dest }) : t('card.md.missing', { dest })} onClick={(e) => { e.stopPropagation(); if (r.ok) r.go(); }}>{label}</button>,
      ...inline(text.slice(w.index + w[0].length), key + 'v', link),
    ];
  }
  // Enlaces normales [texto](url): se ven subrayados en azul, pero no se abren (como en la maqueta).
  const ml = /\[([^\]\n]+)\]\(([^)\s]*)\)/.exec(text);
  if (ml) {
    return [
      ...inline(text.slice(0, ml.index), key + 'm', link),
      <a key={key + 'U' + ml.index} className="ext" href="#" title={ml[2]} onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('cuaderno:open-url', { detail: ml[2] })); }}>{ml[1]}</a>,
      ...inline(text.slice(ml.index + ml[0].length), key + 'n', link),
    ];
  }
  let best: { i: number; m: RegExpExecArray; rule: Inline } | null = null;
  for (const rule of INLINE) {
    const m = rule.re.exec(text);
    if (m && (best === null || m.index < best.i)) best = { i: m.index, m, rule };
  }
  if (!best) {
    if (!text) return [];
    // #etiqueta
    const out: ReactNode[] = [];
    const re = /(^|\s)#([\p{L}\d_-]+)/gu;
    let last = 0, t: RegExpExecArray | null;
    while ((t = re.exec(text))) {
      const at = t.index + t[1].length;
      if (at > last) out.push(text.slice(last, at));
      out.push(<span key={key + 'T' + at} className="hashtag">#{t[2]}</span>);
      last = at + 1 + t[2].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out.length ? out : [text];
  }
  const { m, rule } = best;
  // La regla de cursiva puede capturar el carácter previo: lo devolvemos al texto.
  const lead = m[0].startsWith('*') || m[0].startsWith('`') || m[0].startsWith('~') ? '' : m[0][0];
  const start = m.index + lead.length;
  const end = m.index + m[0].length;
  return [
    ...(start > 0 ? [text.slice(0, start)] : []),
    rule.wrap(inline(m[1], key + 'a', link), key + start),
    ...inline(text.slice(end), key + 'b', link),
  ];
}

export type Block =
  | { k: 'h'; level: 1 | 2 | 3; text: string; line: number }
  | { k: 'task'; done: boolean; text: string; line: number; indent: number }
  | { k: 'li'; text: string; line: number; indent: number; ordered: string | null }
  | { k: 'quote'; text: string; line: number }
  | { k: 'hr'; line: number }
  | { k: 'p'; text: string; line: number }
  | { k: 'gap'; line: number };

export function parse(body: string): Block[] {
  return body.split('\n').map((raw, line): Block => {
    const indent = Math.floor((raw.match(/^\s*/)?.[0].length ?? 0) / 2);
    const t = raw.trim();
    let m: RegExpMatchArray | null;
    if (!t) return { k: 'gap', line };
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) return { k: 'h', level: m[1].length as 1 | 2 | 3, text: m[2], line };
    if ((m = t.match(/^[-*]\s+\[([ xX])\]\s?(.*)$/))) return { k: 'task', done: m[1] !== ' ', text: m[2], line, indent };
    if ((m = t.match(/^[-*]\s+(.*)$/))) return { k: 'li', text: m[1], line, indent, ordered: null };
    if ((m = t.match(/^(\d+)\.\s+(.*)$/))) return { k: 'li', text: m[2], line, indent, ordered: m[1] };
    if ((m = t.match(/^>\s?(.*)$/))) return { k: 'quote', text: m[1], line };
    if (/^(-{3,}|\*{3,})$/.test(t)) return { k: 'hr', line };
    return { k: 'p', text: t, line };
  });
}

/** Marca o desmarca la tarea de la línea `line`. */
export function toggleTask(body: string, line: number): string {
  const lines = body.split('\n');
  const l = lines[line] ?? '';
  lines[line] = /\[[xX]\]/.test(l) ? l.replace(/\[[xX]\]/, '[ ]') : l.replace(/\[ \]/, '[x]');
  return lines.join('\n');
}

export function Markdown({ body, onToggle, link }: { body: string; onToggle?: (line: number) => void; link?: LinkResolver }) {
  return (
    <div className="md">
      {parse(body).map((b) => {
        const k = String(b.line);
        switch (b.k) {
          case 'h': {
            const Tag = (['h3', 'h4', 'h5'] as const)[b.level - 1];
            return <Tag key={k}>{inline(b.text, k, link)}</Tag>;
          }
          case 'task':
            return (
              <label key={k} className="md-task" style={{ paddingLeft: b.indent * 18 }} onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={b.done} onChange={() => onToggle?.(b.line)} />
                <span className={b.done ? 'done' : ''}>{inline(b.text, k, link)}</span>
              </label>
            );
          case 'li':
            return <div key={k} className="md-li" style={{ paddingLeft: 14 + b.indent * 18 }}><span className="md-bullet">{b.ordered ? b.ordered + '.' : '•'}</span>{inline(b.text, k, link)}</div>;
          case 'quote':
            return <blockquote key={k}>{inline(b.text, k, link)}</blockquote>;
          case 'hr':
            return <hr key={k} />;
          case 'p':
            return <p key={k}>{inline(b.text, k, link)}</p>;
          default:
            return <div key={k} className="md-gap" />;
        }
      })}
    </div>
  );
}
