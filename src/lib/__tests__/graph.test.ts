import { describe, expect, it } from 'vitest';
import { buildGraph, DEFAULT_FILTERS, layout, neighbours, nid, signature } from '../graph';
import { fromDocs, starterDocs } from '../model';
import type { NoteCard, PmCard } from '../model';
import { newCol, pmReduce } from '../pm';
import { emptyState, newCard, reduce } from '../store';
import type { Action, State } from '../store';

const run = (s: State, ...as: Action[]) => as.reduce((acc, a) => reduce(acc, a).state, s);

function world() {
  let s = reduce(emptyState, { t: 'load', ...fromDocs(starterDocs()) }).state;
  s = run(s, { t: 'addProject', id: 'p1', name: 'Mural Café Aurora', color: '#0E7C7B' });
  const brief = { ...(newCard('note', 'p1') as NoteCard), title: 'Brief', body: 'Ver [[Mural Café Aurora/Materiales]] y [[Inicio]] y [[Diario/2026-10-11|hoy]]' };
  const mats = { ...(newCard('pm', 'p1') as PmCard), title: 'Materiales' };
  let m = pmReduce(mats.pm, { op: 'addRow', id: 'a' });
  m = pmReduce(m, { op: 'addRow', id: 'b' });
  m = pmReduce(m, { op: 'row', id: 'b', patch: { deps: ['a'], desc: 'Según el [[Mural Café Aurora/Brief]]' } });
  const rel = { ...newCol('relation', m), name: 'Rel' };
  m = pmReduce(m, { op: 'addCol', col: rel });
  m = pmReduce(m, { op: 'cell', row: 'a', col: rel.id, value: [{ kind: 'project', project: 'home' }] });
  const pm = { ...mats, pm: m };
  s = run(s, { t: 'addCard', card: brief }, { t: 'addCard', card: pm }, { t: 'addLink', project: 'p1', link: { id: 'l', from: brief.id, to: pm.id, label: '', color: null, both: false } });
  s = run(s, { t: 'addDaily', day: '2026-10-11', body: 'Nota del día' });
  return { s, brief, pm };
}

describe('grafo', () => {
  it('nodos de cada tipo y conexiones de los cinco tipos', () => {
    const { s, brief, pm } = world();
    const g = buildGraph(s);
    const kinds = (k: string) => g.nodes.filter((n) => n.kind === k).length;
    expect([kinds('project'), kinds('card'), kinds('row'), kinds('daily')]).toEqual([2, 3, 2, 1]);
    const has = (from: string, to: string, kind: string) => g.edges.some((e) => e.kind === kind && ((e.from === from && e.to === to) || (e.from === to && e.to === from)));
    expect(has(nid.project('p1'), nid.card(brief.id), 'contain')).toBe(true);
    expect(has(nid.card(pm.id), nid.row(pm.id, 'a'), 'contain')).toBe(true);
    expect(has(nid.card(brief.id), nid.card(pm.id), 'link')).toBe(true);
    expect(has(nid.card(brief.id), nid.project('home'), 'link')).toBe(true);
    expect(has(nid.card(brief.id), nid.card('daily_2026-10-11'), 'link')).toBe(true);
    expect(has(nid.row(pm.id, 'b'), nid.card(brief.id), 'link')).toBe(true);
    expect(has(nid.row(pm.id, 'a'), nid.project('home'), 'rel')).toBe(true);
    expect(has(nid.row(pm.id, 'a'), nid.row(pm.id, 'b'), 'dep')).toBe(true);
    expect(has(nid.card(brief.id), nid.card(pm.id), 'arrow')).toBe(true);
  });

  it('al ocultar filas o tarjetas, sus conexiones suben a la tabla o a la tarea principal', () => {
    const { s, pm } = world();
    const noRows = buildGraph(s, { ...DEFAULT_FILTERS, rows: false });
    expect(noRows.nodes.some((n) => n.kind === 'row')).toBe(false);
    expect(noRows.edges.some((e) => e.kind === 'rel' && [e.from, e.to].includes(nid.card(pm.id)))).toBe(true);
    const noCards = buildGraph(s, { ...DEFAULT_FILTERS, cards: false, rows: false });
    expect(noCards.edges.some((e) => e.kind === 'rel' && [e.from, e.to].sort().join() === [nid.project('p1'), nid.project('home')].sort().join())).toBe(true);
    expect(buildGraph(s, { ...DEFAULT_FILTERS, contain: false }).edges.some((e) => e.kind === 'contain')).toBe(false);
    expect(buildGraph(s, { ...DEFAULT_FILTERS, daily: false }).nodes.some((n) => n.kind === 'daily')).toBe(false);
  });

  it('colocación determinista, que respeta los nodos fijados y parte de lo anterior', () => {
    const { s, brief } = world();
    const g = buildGraph(s);
    const a = layout(g.nodes, g.edges), b = layout(g.nodes, g.edges);
    expect(a).toEqual(b);
    const pinned = layout(g.nodes, g.edges, { ...a, [nid.card(brief.id)]: { x: 500, y: -300, pinned: true } });
    expect(pinned[nid.card(brief.id)]).toMatchObject({ x: 500, y: -300, pinned: true });
    const xs = Object.values(a).map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(50);
    expect(neighbours(g, nid.card(brief.id)).map((x) => x.kind).sort()).toEqual(['arrow', 'contain', 'link', 'link', 'link', 'link']);
    expect(signature(g)).toBe(signature(buildGraph(s)));
  });
});
