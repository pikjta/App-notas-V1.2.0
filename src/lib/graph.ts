// Vista de grafo: todas las conexiones del cuaderno como nodos y líneas. Funciones puras.
//
// Nodos: tareas principales, tarjetas, filas de Tablas PM y notas del Diario.
// Conexiones: pertenencia (tarea → tarjeta → fila), enlaces [[ ]], relaciones de las tablas,
// flechas del tablero y dependencias entre filas.
import { t } from '../i18n';
import { JOURNAL_ID } from './model';
import { relLinks, rowTitle } from './pm';
import { dailyId } from './store';
import type { State } from './store';

export type NodeKind = 'project' | 'card' | 'row' | 'daily';
export type EdgeKind = 'contain' | 'link' | 'rel' | 'arrow' | 'dep';
export type GNode = { id: string; kind: NodeKind; label: string; color: string; r: number; project: string | null; card: string | null };
export type GEdge = { from: string; to: string; kind: EdgeKind };
export type GraphFilters = { cards: boolean; rows: boolean; daily: boolean; contain: boolean };
export const DEFAULT_FILTERS: GraphFilters = { cards: true, rows: true, daily: true, contain: true };

const fold = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const WIKI = /\[\[([^\]\n|]+)(?:\|[^\]\n]*)?\]\]/g;
export const RADIUS: Record<NodeKind, number> = { project: 20, card: 10, row: 6, daily: 8 };

/** Ids de nodo (estables entre renders). */
export const nid = { project: (id: string) => 'p:' + id, card: (id: string) => 'c:' + id, row: (card: string, row: string) => `r:${card}:${row}` };

export function buildGraph(s: State, f: GraphFilters = DEFAULT_FILTERS): { nodes: GNode[]; edges: GEdge[] } {
  const nodes = new Map<string, GNode>();
  const edges: GEdge[] = [];
  const live = s.projects.filter((p) => !p.trashed);
  const liveIds = new Set(live.map((p) => p.id));
  const cards = s.cards.filter((c) => !c.trashed && liveIds.has(c.project));

  for (const p of live) if (p.id !== JOURNAL_ID && !p.hidden) nodes.set(nid.project(p.id), { id: nid.project(p.id), kind: 'project', label: p.name, color: p.color, r: RADIUS.project, project: p.id, card: null });
  for (const c of cards) {
    const daily = c.project === JOURNAL_ID;
    if (daily ? !f.daily : !f.cards) continue;
    const proj = s.projects.find((p) => p.id === c.project);
    nodes.set(nid.card(c.id), { id: nid.card(c.id), kind: daily ? 'daily' : 'card', label: c.title || (daily ? c.id.replace(/^daily_/, '') : t('cal.untitled')), color: proj?.color ?? '#6B645A', r: daily ? RADIUS.daily : RADIUS.card, project: c.project, card: c.id });
    if (c.type === 'pm' && f.rows) for (const r of c.pm.rows) if (!r.archived) nodes.set(nid.row(c.id, r.id), { id: nid.row(c.id, r.id), kind: 'row', label: rowTitle(c.pm, r, s.tags), color: proj?.color ?? '#6B645A', r: RADIUS.row, project: c.project, card: c.id });
  }

  /**
   * Nodo visible que representa a otro: si las filas están ocultas, su tabla; si las tarjetas
   * están ocultas, su tarea principal. Así las conexiones «suben» en lugar de desaparecer.
   */
  const visible = (id: string): string | null => {
    if (nodes.has(id)) return id;
    if (id.startsWith('r:')) { const card = id.split(':')[1]; return visible(nid.card(card)); }
    if (id.startsWith('c:')) { const c = s.cards.find((x) => x.id === id.slice(2)); return c && c.project !== JOURNAL_ID ? visible(nid.project(c.project)) : null; }
    return null;
  };
  const seen = new Set<string>();
  const add = (from: string, to: string, kind: EdgeKind) => {
    const a = visible(from), b = visible(to);
    if (!a || !b || a === b) return;
    const key = kind + ':' + [a, b].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from: a, to: b, kind });
  };

  // Pertenencia.
  if (f.contain) for (const c of cards) {
    if (c.project !== JOURNAL_ID && nodes.has(nid.card(c.id))) add(nid.project(c.project), nid.card(c.id), 'contain');
    if (c.type === 'pm' && f.rows && nodes.has(nid.card(c.id))) for (const r of c.pm.rows) if (!r.archived) add(nid.card(c.id), nid.row(c.id, r.id), 'contain');
  }

  // Enlaces [[ ]]: «Tarea principal», «Tarea/Tarjeta» o «Diario/AAAA-MM-DD».
  const resolve = (dest: string): string | null => {
    const [pName, ...rest] = dest.split('/');
    const cName = rest.join('/');
    if (fold(pName) === 'diario' && /^\d{4}-\d{2}-\d{2}$/.test(cName.trim())) { const c = cards.find((x) => x.id === dailyId(cName.trim())); return c ? nid.card(c.id) : null; }
    const p = live.find((x) => fold(x.name) === fold(pName));
    if (!p) return null;
    if (!cName) return nid.project(p.id);
    const c = cards.find((x) => x.project === p.id && fold(x.title) === fold(cName));
    if (c) return nid.card(c.id);
    // «Tarea/Tabla PM/Fila»
    const [tName, ...rName] = rest;
    const t = cards.find((x) => x.project === p.id && x.type === 'pm' && fold(x.title) === fold(tName));
    const r = t && t.type === 'pm' && rName.length ? t.pm.rows.find((x) => fold(rowTitle(t.pm, x, s.tags)) === fold(rName.join('/'))) : null;
    return t && r ? nid.row(t.id, r.id) : null;
  };
  const scan = (text: string, from: string) => { for (const m of (text ?? '').matchAll(WIKI)) { const to = resolve(m[1].trim()); if (to) add(from, to, 'link'); } };
  for (const c of cards) {
    if (c.type === 'note') scan(c.body ?? '', nid.card(c.id));
    if (c.type === 'pm') for (const r of c.pm.rows) {
      if (r.archived) continue;
      const from = nid.row(c.id, r.id);
      if (r.desc) scan(r.desc, from);
      // Relaciones y dependencias.
      for (const col of c.pm.cols) if (col.type === 'relation') for (const l of relLinks(r.cells[col.id])) add(from, l.kind === 'row' ? nid.row(l.card, l.row) : l.kind === 'card' ? nid.card(l.card) : nid.project(l.project), 'rel');
      for (const d of r.deps ?? []) add(nid.row(c.id, d), from, 'dep');
    }
  }
  // Flechas del tablero.
  for (const p of live) for (const l of p.links ?? []) add(nid.card(l.from), nid.card(l.to), 'arrow');

  return { nodes: [...nodes.values()], edges };
}

/** Número pseudoaleatorio estable a partir de un texto (posiciones iniciales reproducibles). */
function hash(t: string): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

export type Pos = Record<string, { x: number; y: number; pinned?: boolean }>;

/**
 * Colocación por fuerzas: los nodos se repelen, las conexiones atraen y todo tiende al centro.
 * Determinista (mismas entradas → misma salida). Respeta los nodos fijados a mano y parte de
 * las posiciones anteriores si existen, para que el grafo no «salte» al cambiar algo.
 */
export function layout(nodes: GNode[], edges: GEdge[], prev: Pos = {}, iterations = 260): Pos {
  const P: Record<string, { x: number; y: number; vx: number; vy: number; pinned: boolean }> = {};
  nodes.forEach((n, i) => {
    const o = prev[n.id];
    const a = hash(n.id) * Math.PI * 2, d = 120 + hash(n.id + 'd') * 260 + (i % 7) * 6;
    P[n.id] = { x: o?.x ?? Math.cos(a) * d, y: o?.y ?? Math.sin(a) * d, vx: 0, vy: 0, pinned: !!o?.pinned };
  });
  const ids = nodes.map((n) => n.id);
  const rad = new Map(nodes.map((n) => [n.id, n.r]));
  const restLen: Record<EdgeKind, number> = { contain: 70, link: 120, rel: 110, arrow: 100, dep: 90 };
  const warm = Object.keys(prev).length ? Math.min(iterations, 80) : iterations;
  for (let it = 0; it < warm; it++) {
    const temp = 1 - it / warm;
    for (let i = 0; i < ids.length; i++) {
      const a = P[ids[i]];
      for (let j = i + 1; j < ids.length; j++) {
        const b = P[ids[j]];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = 0.1; dy = 0.1; d2 = 0.02; }
        const minD = (rad.get(ids[i])! + rad.get(ids[j])!) * 2.2;
        const f = 2600 / d2 + (d2 < minD * minD ? 2 : 0);
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const a = P[e.from], b = P[e.to];
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - restLen[e.kind]) * 0.04;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const id of ids) {
      const p = P[id];
      p.vx -= p.x * 0.006; p.vy -= p.y * 0.006;
      if (p.pinned) { p.vx = 0; p.vy = 0; continue; }
      const sp = Math.hypot(p.vx, p.vy), max = 30 * temp + 2;
      if (sp > max) { p.vx = (p.vx / sp) * max; p.vy = (p.vy / sp) * max; }
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.5; p.vy *= 0.5;
    }
  }
  const out: Pos = {};
  for (const id of ids) out[id] = { x: Math.round(P[id].x * 10) / 10, y: Math.round(P[id].y * 10) / 10, pinned: P[id].pinned || undefined };
  return out;
}

/** Firma de la estructura (para saber cuándo hay que recolocar). */
export const signature = (g: { nodes: GNode[]; edges: GEdge[] }) => g.nodes.map((n) => n.id).sort().join(',') + '#' + g.edges.map((e) => e.kind + e.from + e.to).sort().join(',');

/** Conexiones de un nodo, agrupadas por tipo (para el panel lateral). */
export function neighbours(g: { nodes: GNode[]; edges: GEdge[] }, id: string): { node: GNode; kind: EdgeKind; out: boolean }[] {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  return g.edges.filter((e) => e.from === id || e.to === id).map((e) => ({ node: byId.get(e.from === id ? e.to : e.from)!, kind: e.kind, out: e.from === id })).filter((x) => x.node);
}
