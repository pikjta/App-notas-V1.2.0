import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent, WheelEvent as RWheelEvent } from 'react';
import { useApp } from '../App';
import { t } from '../i18n';
import { buildGraph, DEFAULT_FILTERS, layout, neighbours, signature } from '../lib/graph';
import type { EdgeKind, GNode, GraphFilters, Pos } from '../lib/graph';

// Las etiquetas son getters para seguir el idioma actual.
const EDGE: Record<EdgeKind, { label: string; color: string; dash?: string; w: number }> = {
  contain: { get label() { return t('cal.graph.edge.contain'); }, color: 'var(--g-contain)', w: 1 },
  link: { get label() { return t('cal.graph.edge.link'); }, color: '#2F6690', w: 1.6 },
  rel: { get label() { return t('cal.graph.edge.rel'); }, color: '#7A3E6B', w: 1.6 },
  arrow: { get label() { return t('cal.graph.edge.arrow'); }, color: '#C77A1E', w: 1.8 },
  dep: { get label() { return t('cal.graph.edge.dep'); }, color: '#C8372D', dash: '5 4', w: 1.6 },
};
const KIND: Record<GNode['kind'], string> = {
  get project() { return t('cal.graph.kind.project'); },
  get card() { return t('cal.graph.kind.card'); },
  get row() { return t('cal.graph.kind.row'); },
  get daily() { return t('cal.graph.kind.daily'); },
};
const fold = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Posiciones que se conservan al cambiar de vista y volver (durante la sesión).
let saved: Pos = {};
let savedView = { x: 0, y: 0, k: 1 };

export function Graph() {
  const { state, dispatch, goTo, openPm } = useApp();
  const [filters, setFilters] = useState<GraphFilters>(DEFAULT_FILTERS);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState(savedView);
  const g = useMemo(() => buildGraph(state, filters), [state, filters]);
  const sig = signature(g);
  const [pos, setPos] = useState<Pos>(() => layout(g.nodes, g.edges, saved));
  // Solo se recoloca cuando cambia la estructura (nodos o conexiones), no al editar un texto.
  const lastSig = useRef(sig);
  useEffect(() => {
    if (lastSig.current === sig) return;
    lastSig.current = sig;
    setPos((p) => layout(g.nodes, g.edges, p));
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { saved = pos; }, [pos]);
  useEffect(() => { savedView = view; }, [view]);
  const box = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 800, h: el.clientHeight || 600 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const match = q.trim() ? new Set(g.nodes.filter((n) => fold(n.label).includes(fold(q.trim()))).map((n) => n.id)) : null;
  const selNb = sel ? new Set(neighbours(g, sel).map((x) => x.node.id).concat(sel)) : null;
  const dim = (id: string) => (match ? !match.has(id) : selNb ? !selNb.has(id) : false);
  const toWorld = (cx: number, cy: number) => { const r = box.current!.getBoundingClientRect(); return { x: (cx - r.left - r.width / 2 - view.x) / view.k, y: (cy - r.top - r.height / 2 - view.y) / view.k }; };

  const dragNode = (e: RPointerEvent, id: string) => {
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const mv = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      moved = true;
      const w = toWorld(ev.clientX, ev.clientY);
      setPos((p) => ({ ...p, [id]: { x: w.x, y: w.y, pinned: true } }));
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (!moved) setSel((s) => (s === id ? null : id)); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  const pan = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY, v0 = view;
    let moved = false;
    const mv = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 3) moved = true; setView({ ...v0, x: v0.x + ev.clientX - sx, y: v0.y + ev.clientY - sy }); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (!moved) setSel(null); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  const zoomBy = (f: number) => setView((v) => { const k = Math.min(2.5, Math.max(0.3, v.k * f)); return { k, x: (v.x / v.k) * k, y: (v.y / v.k) * k }; });
  const wheel = (e: RWheelEvent) => {
    const r = box.current!.getBoundingClientRect();
    const k = Math.min(2.5, Math.max(0.3, view.k * Math.exp(-e.deltaY * 0.0015)));
    const cx = e.clientX - r.left - r.width / 2, cy = e.clientY - r.top - r.height / 2;
    // El zoom se centra en el cursor.
    setView({ k, x: cx - ((cx - view.x) / view.k) * k, y: cy - ((cy - view.y) / view.k) * k });
  };

  const node = sel ? g.nodes.find((n) => n.id === sel) : null;
  const open = (n: GNode) => {
    if (n.kind === 'project' && n.project) dispatch({ t: 'select', id: n.project });
    else if (n.kind === 'daily' && n.card) dispatch({ t: 'day', day: n.card.replace(/^daily_/, '') });
    else if (n.kind === 'row' && n.card) openPm(n.card);
    else if (n.card && n.project) goTo(n.project, n.card);
  };
  const counts = { nodes: g.nodes.length, edges: g.edges.filter((e) => e.kind !== 'contain').length };

  return (
    <main className="board view graph-view">
      <header className="board-head">
        <h1 className="board-title">{t('cal.graph.title')}</h1>
        <input className="pm-search" type="search" value={q} placeholder={t('cal.graph.highlight')} aria-label={t('cal.graph.highlightLabel')} onChange={(e) => setQ(e.target.value)} />
        <div className="row wrap graph-filters">
          {([['cards', t('cal.graph.cards')], ['rows', t('cal.graph.rows')], ['daily', t('cal.graph.daily')], ['contain', t('cal.graph.contain')]] as [keyof GraphFilters, string][]).map(([k, l]) => (
            <label key={k} className="check-line small"><input type="checkbox" checked={filters[k]} onChange={() => setFilters({ ...filters, [k]: !filters[k] })} /> {l}</label>
          ))}
          <button className="tool small-btn" onClick={() => { setPos(layout(g.nodes, g.edges, {})); setView({ x: 0, y: 0, k: 1 }); }}>{t('cal.graph.relayout')}</button>
          <button className="tool small-btn" aria-label={t('cal.graph.zoomOut')} title={t('cal.graph.zoomOut')} onClick={() => zoomBy(1 / 1.25)}>−</button>
          <button className="tool small-btn" aria-label={t('cal.graph.zoomIn')} title={t('cal.graph.zoomIn')} onClick={() => zoomBy(1.25)}>+</button>
        </div>
      </header>
      <div className="graph-wrap">
        <svg ref={box} className="graph" onPointerDown={pan} onWheel={wheel} role="img" aria-label={t('cal.graph.aria', { nodes: counts.nodes, edges: counts.edges })}>
          <g transform={`translate(${size.w / 2 + view.x} ${size.h / 2 + view.y}) scale(${view.k})`}>
            <g>
              {g.edges.map((e, i) => {
                const a = pos[e.from], b = pos[e.to];
                if (!a || !b) return null;
                const st = EDGE[e.kind];
                const faded = dim(e.from) && dim(e.to);
                return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={st.color} strokeWidth={st.w / Math.sqrt(view.k)} strokeDasharray={st.dash} opacity={faded ? 0.12 : e.kind === 'contain' ? 0.5 : 0.85} />;
              })}
              {g.nodes.map((n) => {
                const p = pos[n.id];
                if (!p) return null;
                const d = dim(n.id);
                return (
                  <g key={n.id} className={'g-node ' + n.kind + (sel === n.id ? ' sel' : '') + (d ? ' dim' : '')} transform={`translate(${p.x} ${p.y})`} onPointerDown={(e) => dragNode(e, n.id)}>
                    <circle r={n.r} fill={n.kind === 'project' ? n.color : 'var(--card-bg)'} stroke={n.color} strokeWidth={n.kind === 'project' ? 0 : 2.5} />
                    {n.kind === 'daily' && <text className="g-glyph" y={3.5}>✎</text>}
                    {p.pinned && <circle className="g-pin" r={2.5} cx={n.r * 0.7} cy={-n.r * 0.7} />}
                    {(n.kind === 'project' || view.k > 0.8 || sel === n.id || match?.has(n.id)) && <text className="g-label" y={n.r + 13}>{n.label.length > 28 ? n.label.slice(0, 27) + '…' : n.label}</text>}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
        <div className="graph-legend">
          {(Object.keys(EDGE) as EdgeKind[]).map((k) => <span key={k} className="small"><svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={EDGE[k].color} strokeWidth="2" strokeDasharray={EDGE[k].dash} /></svg>{EDGE[k].label}</span>)}
          <span className="small muted graph-help">{t('cal.graph.help')}</span>
        </div>
        {node && (
          <aside className="graph-panel" aria-label={t('cal.graph.connectionsOf', { name: node.label })}>
            <div className="row"><span className="menu-label grow">{KIND[node.kind]}</span><button className="icon-btn small" aria-label={t('cal.close')} onClick={() => setSel(null)}>✕</button></div>
            <h3>{node.label}</h3>
            <div className="row">
              <button className="primary small-btn" onClick={() => open(node)}>{t('cal.open')}</button>
              {pos[node.id]?.pinned && <button className="tool small-btn" onClick={() => setPos((p) => ({ ...p, [node.id]: { ...p[node.id], pinned: undefined } }))}>{t('cal.graph.release')}</button>}
            </div>
            {neighbours(g, node.id).length > 0 && <span className="menu-label">{t('cal.graph.connections')}</span>}
            {(Object.keys(EDGE) as EdgeKind[]).map((k) => {
              const list = neighbours(g, node.id).filter((x) => x.kind === k);
              if (!list.length) return null;
              return (
                <section key={k}>
                  <span className="small muted">{EDGE[k].label} · {list.length}</span>
                  {list.map((x) => <button key={x.node.id + k} className="g-nb" onClick={() => setSel(x.node.id)}><span className="dot" style={{ background: x.node.color }} />{x.node.label}<span className="small muted">{x.out ? '→' : '←'}</span></button>)}
                </section>
              );
            })}
            {!neighbours(g, node.id).length && <span className="small muted">{t('cal.graph.none')}</span>}
          </aside>
        )}
      </div>
    </main>
  );
}
