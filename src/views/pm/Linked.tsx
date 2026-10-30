import { t } from '../../i18n';
import { useState } from 'react';
import { useApp } from '../../App';
import { errorText } from '../../lib/backend';
import { readImage } from '../../lib/images';
import { uid } from '../../lib/model';
import { cellText, COLORS, getWorld, linkInfo, linkKey, progress, relLinks, rowTitle, stateInfo, strList } from '../../lib/pm';
import type { CellVal, Col, Pm, RelLink, Row } from '../../lib/pm';

const fold = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Pastillas de una celda de relación (alias o título; las rotas, tachadas). */
export function RelPills({ v }: { v: CellVal }) {
  const links = relLinks(v);
  if (!links.length) return <span className="muted">—</span>;
  return <>{links.map((l) => { const i = linkInfo(l); return <span key={linkKey(l)} className={'rel-pill ' + l.kind + (i.missing ? ' missing' : '')} title={`${i.kind}${i.where ? ' · ' + i.where : ''}`}>{l.alias || i.title}</span>; })}</>;
}

/** Miniaturas de una celda de imagen. */
export function ImageThumbs({ v, max = 3 }: { v: CellVal; max?: number }) {
  const { state } = useApp();
  const ids = strList(v).filter((id) => state.assets[id]);
  if (!ids.length) return <span className="muted">—</span>;
  return (
    <span className="thumbs">
      {ids.slice(0, max).map((id) => <img key={id} src={state.assets[id].data} alt="" />)}
      {ids.length > max && <span className="small muted">+{ids.length - max}</span>}
    </span>
  );
}

/**
 * Editor de una celda de relación. «Interna»: filas de la tabla enlazada de la columna (se pueden
 * resumir). «Externa»: cualquier tarea principal, tarjeta o fila de la app. Cada enlace admite
 * un alias y una vista previa.
 */
export function RelationMenu({ card, col, row, set, close, onOpenRow }: { pm: Pm; card: string; col: Col; row: Row; set: (v: CellVal) => void; close: () => void; onOpenRow: (id: string) => void }) {
  const { goTo, openPm } = useApp();
  const world = getWorld();
  const [tab, setTab] = useState<'in' | 'out'>(col.target ? 'in' : 'out');
  const [q, setQ] = useState('');
  const [inclAll, setInclAll] = useState(false);
  const [peek, setPeek] = useState<RelLink | null>(null);
  const links = relLinks(row.cells[col.id]);
  const has = (l: RelLink) => links.some((x) => linkKey(x) === linkKey(l));
  const toggle = (l: RelLink) => set(has(l) ? links.filter((x) => linkKey(x) !== linkKey(l)) : [...links, l]);
  const target = world.cards.find((c) => c.id === col.target);
  const fq = fold(q.trim());
  const match = (t: string) => !fq || fold(t).includes(fq);

  type Opt = { l: RelLink; title: string; sub: string };
  let options: Opt[] = [];
  if (tab === 'in' && target?.pm) {
    options = target.pm.rows.filter((r) => !(target.id === card && r.id === row.id)).map((r) => ({ l: { kind: 'row', card: target.id, row: r.id } as RelLink, title: rowTitle(target.pm!, r, world.tags), sub: target.title }));
  } else if (tab === 'out') {
    const live = new Map(world.projects.filter((p) => !p.trashed && !p.hidden).map((p) => [p.id, p.name]));
    for (const p of world.projects) if (live.has(p.id)) options.push({ l: { kind: 'project', project: p.id }, title: p.name, sub: t('pm.link.subProject') });
    for (const c of inclAll ? world.cards : []) {
      if (c.trashed || !live.has(c.project)) continue;
      options.push({ l: { kind: 'card', card: c.id }, title: c.title || t('pm.untitled'), sub: t('pm.link.subCard', { project: live.get(c.project) ?? '' }) });
      if (c.pm) for (const r of c.pm.rows) if (!(c.id === card && r.id === row.id)) options.push({ l: { kind: 'row', card: c.id, row: r.id }, title: rowTitle(c.pm, r, world.tags), sub: t('pm.link.subRow', { card: c.title || t('pm.link.table') }) });
    }
  }
  options = options.filter((o) => match(o.title) || match(o.sub)).slice(0, 60);

  if (peek) return <Peek l={peek} back={() => setPeek(null)} open={() => {
    if (peek.kind === 'row' && peek.card === card) { onOpenRow(peek.row); close(); }
    else if (peek.kind === 'row' || (peek.kind === 'card' && world.cards.find((c) => c.id === peek.card)?.type === 'pm')) { openPm(peek.card); }
    else if (peek.kind === 'card') { const c = world.cards.find((x) => x.id === peek.card); if (c) goTo(c.project, c.id); }
    else goTo(peek.project, null);
  }} />;

  return (
    <div className="stack small-gap rel-menu">
      {links.length > 0 && (
        <div className="rel-chosen">
          {links.map((l) => {
            const i = linkInfo(l);
            return (
              <div key={linkKey(l)} className="row">
                <span className={'rel-pill ' + l.kind + (i.missing ? ' missing' : '')}>{i.title}</span>
                <input className="grow" value={l.alias ?? ''} placeholder={t('pm.link.aliasPlaceholder')} aria-label={t('pm.link.aliasOf', { title: i.title })} onChange={(e) => set(links.map((x) => (linkKey(x) === linkKey(l) ? { ...x, alias: e.target.value || undefined } : x)))} />
                <button className="link small" onClick={() => setPeek(l)}>{t('pm.link.peek')}</button>
                <button className="icon-btn small" aria-label={t('pm.link.removeOf', { title: i.title })} onClick={() => toggle(l)}>×</button>
              </div>
            );
          })}
        </div>
      )}
      <div className="seg">
        <button className={tab === 'in' ? 'on' : ''} disabled={!target} title={target ? '' : t('pm.link.pickTable')} onClick={() => setTab('in')}>{target ? t('pm.link.internalNamed', { name: target.title || t('pm.link.table') }) : t('pm.link.internal')}</button>
        <button className={tab === 'out' ? 'on' : ''} onClick={() => setTab('out')}>{t('pm.link.external')}</button>
      </div>
      <input autoFocus value={q} placeholder={t('pm.link.search')} aria-label={t('pm.link.searchLabel')} onChange={(e) => setQ(e.target.value)} />
      {tab === 'out' && <label className="check-line small"><input type="checkbox" checked={inclAll} onChange={() => setInclAll(!inclAll)} /> {t('pm.link.inclAll')}</label>}
      <div className="rel-options">
        {options.map((o) => (
          <button key={linkKey(o.l)} className={has(o.l) ? 'on' : ''} onClick={() => toggle(o.l)}>
            <span className={'rel-kind ' + o.l.kind}>{o.l.kind === 'row' ? t('pm.kind.row') : o.l.kind === 'card' ? t('pm.kind.card') : t('pm.kind.task')}</span>
            <span className="grow ellipsis">{o.title}</span><span className="small muted ellipsis">{o.sub}</span>{has(o.l) && ' ✓'}
          </button>
        ))}
        {!options.length && <span className="small muted pad">{tab === 'in' && !target ? t('pm.link.noTable') : t('pm.link.noMatch')}</span>}
      </div>
    </div>
  );
}

function Peek({ l, back, open }: { l: RelLink; back: () => void; open: () => void }) {
  const world = getWorld();
  const i = linkInfo(l);
  let body: React.ReactNode = null;
  if (l.kind === 'row' && i.row && i.table?.pm) {
    const pm = i.table.pm, r = i.row;
    const st = pm.cols.find((c) => c.type === 'status'), pr = pm.cols.find((c) => c.type === 'progress');
    const si = st ? stateInfo(st, r.cells[st.id]) : null;
    body = (
      <>
        {si && <span className="pill" style={{ background: COLORS[si.ph.color][0], color: COLORS[si.ph.color][1] }}>{si.st.name}</span>}
        {pr && <div className="progress"><span style={{ width: progress(pm, pr, r) + '%' }} /></div>}
        <div className="peek-props">
          {pm.cols.filter((c) => !c.hidden && !['text', 'status', 'progress', 'relation', 'image'].includes(c.type)).slice(0, 6).map((c) => { const t = cellText(pm, c, r, world.tags); return t ? <div key={c.id} className="row small"><span className="muted grow">{c.name}</span><b>{t}</b></div> : null; })}
        </div>
        {r.desc && <p className="small peek-desc">{r.desc.slice(0, 220)}{r.desc.length > 220 ? '…' : ''}</p>}
      </>
    );
  } else if (l.kind === 'card') {
    const c = world.cards.find((x) => x.id === l.card);
    body = c?.body ? <p className="small peek-desc">{c.body.slice(0, 260)}{c.body.length > 260 ? '…' : ''}</p> : <span className="small muted">{c ? t('pm.link.cardType', { type: c.type }) : ''}</span>;
  }
  return (
    <div className="stack small-gap peek">
      <button className="link small" onClick={back}>{t('pm.link.back')}</button>
      <span className="small muted">{i.kind}{i.where ? ' · ' + i.where : ''}</span>
      <h3>{l.alias ? `${l.alias} ` : ''}{l.alias && <span className="muted small">({i.title})</span>}{!l.alias && i.title}</h3>
      {i.missing ? <span className="err small">{t('pm.link.gone')}</span> : body}
      {!i.missing && <button className="primary small-btn" onClick={open}>{t('pm.link.open')}</button>}
    </div>
  );
}

/** Editor de una celda de imagen: añadir (varias a la vez), ver en grande y quitar. */
export function ImageMenu({ card, col, row }: { card: string; col: Col; row: Row }) {
  const { state, dispatch, toast } = useApp();
  const [zoom, setZoom] = useState<string | null>(null);
  const ids = strList(row.cells[col.id]).filter((id) => state.assets[id]);
  const add = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      try { const img = await readImage(f); dispatch({ t: 'pmImage', card, row: row.id, col: col.id, asset: { id: uid('asset'), card, ...img } }); }
      catch (e) { toast(errorText(e)); }
    }
  };
  return (
    <div className="stack small-gap">
      <div className="img-grid">
        {ids.map((id) => (
          <div key={id} className="img-cell">
            <img src={state.assets[id].data} alt="" onClick={() => setZoom(id)} />
            <button className="icon-btn small" aria-label={t('pm.link.imgRemove')} onClick={() => dispatch({ t: 'pmImageRemove', card, row: row.id, col: col.id, asset: id })}>×</button>
          </div>
        ))}
      </div>
      <label className="tool small-btn">{t('pm.link.imgAdd')}<input type="file" accept="image/*" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ''; }} /></label>
      {zoom && <div className="lightbox" role="dialog" aria-label={t('pm.link.image')} onClick={() => setZoom(null)}><img src={state.assets[zoom].data} alt="" /></div>}
    </div>
  );
}
