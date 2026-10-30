import { useState } from 'react';
import { useApp } from '../App';
import { t, tn } from '../i18n';
import { CARD_KIND_LABEL } from '../lib/model';
import type { Project } from '../lib/model';

const ago = (ms: number) => {
  const d = Math.floor((Date.now() - ms) / 86_400_000);
  return d <= 0 ? t('ui.trash.today') : d === 1 ? t('ui.trash.yesterday') : tn('ui.trash.daysAgo', d);
};

/** Papelera general: tareas principales y tarjetas eliminadas de cualquier tablero. */
export function Trash() {
  const { state, dispatch } = useApp();
  const [confirm, setConfirm] = useState<string | null>(null);
  const projects = state.projects.filter((p) => p.trashed);
  const trashedIds = new Set(projects.map((p) => p.id));
  const cards = state.cards.filter((c) => c.trashed && !trashedIds.has(c.project));
  const name = (id: string) => state.projects.find((p) => p.id === id)?.name ?? '';
  const empty = projects.length + cards.length === 0;
  const folderName = (p: Project) => state.folders.find((f) => f.id === p.folder)?.name;

  return (
    <main className="board trash-view">
      <header className="board-head">
        <div className="grow">
          <h1 className="board-title">{t('ui.trash.title')}</h1>
          <p className="muted">{t('ui.trash.subtitle')}</p>
        </div>
        {!empty && (confirm === 'all' ? (
          <span className="confirm">{t('ui.trash.sure')}<button className="tool" onClick={() => setConfirm(null)}>{t('ui.trash.no')}</button><button className="danger" onClick={() => { dispatch({ t: 'emptyTrash' }); setConfirm(null); }}>{t('ui.trash.emptyAll')}</button></span>
        ) : (
          <button className="tool" onClick={() => setConfirm('all')}>{t('ui.trash.empty')}</button>
        ))}
      </header>
      <section className="trash-section">
        <h2>{t('ui.trash.projectsHead', { n: projects.length })}</h2>
        {projects.length === 0 ? <p className="muted">{t('ui.trash.noProjects')}</p> : (
          <div className="trash-list">
            {projects.map((p) => (
              <div key={p.id} className="trash-row">
                <span className="dot" style={{ background: p.color }} />
                <div className="grow"><b>{p.name}</b><div className="small muted">{tn('ui.trash.cards', state.cards.filter((c) => c.project === p.id).length)}{folderName(p) ? ' · ' + folderName(p) : ''} · {ago(p.trashed!)}</div></div>
                <button className="tool" onClick={() => dispatch({ t: 'restoreProject', id: p.id })}>{t('ui.trash.restore')}</button>
                {confirm === p.id ? <button className="danger" onClick={() => { dispatch({ t: 'purgeProject', id: p.id }); setConfirm(null); }}>{t('ui.trash.purgeConfirm')}</button> : <button className="tool subtle" aria-label={t('ui.trash.purge')} title={t('ui.trash.purge')} onClick={() => setConfirm(p.id)}>{t('ui.trash.purge')}</button>}
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="trash-section">
        <h2>{t('ui.trash.cardsHead', { n: cards.length })}</h2>
        {cards.length === 0 ? <p className="muted">{t('ui.trash.noCards')}</p> : (
          <div className="trash-list">
            {cards.map((c) => (
              <div key={c.id} className="trash-row">
                <span className="dot" style={{ background: state.projects.find((p) => p.id === c.project)?.color }} />
                <div className="grow"><b>{c.title || CARD_KIND_LABEL[c.type]}</b><div className="small muted">{CARD_KIND_LABEL[c.type]} · {name(c.project)} · {ago(c.trashed!)}</div></div>
                <button className="tool" onClick={() => dispatch({ t: 'restoreCard', id: c.id })}>{t('ui.trash.restore')}</button>
                {confirm === c.id ? <button className="danger" onClick={() => { dispatch({ t: 'purgeCard', id: c.id }); setConfirm(null); }}>{t('ui.trash.purgeConfirm')}</button> : <button className="tool subtle" aria-label={t('ui.trash.purge')} title={t('ui.trash.purge')} onClick={() => setConfirm(c.id)}>{t('ui.trash.purge')}</button>}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/** Papelera de un tablero: sus tarjetas eliminadas. */
export function BoardTrash({ project, onClose }: { project: Project; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const [confirm, setConfirm] = useState<string | null>(null);
  const cards = state.cards.filter((c) => c.project === project.id && c.trashed);
  return (
    <div className="ap-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="ap-panel" role="dialog" aria-label={t('ui.trash.boardTitle', { name: project.name })} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <header className="ap-head"><h2>{t('ui.trash.boardTitle', { name: project.name })}</h2></header>
        <div className="ap-body">
          {cards.length === 0 ? <p className="muted">{t('ui.trash.noBoardCards')}</p> : cards.map((c) => (
            <div key={c.id} className="trash-row">
              <div className="grow"><b>{c.title || CARD_KIND_LABEL[c.type]}</b><div className="small muted">{CARD_KIND_LABEL[c.type]} · {ago(c.trashed!)}</div></div>
              <button className="tool" onClick={() => dispatch({ t: 'restoreCard', id: c.id })}>{t('ui.trash.restore')}</button>
              {confirm === c.id ? <button className="danger" onClick={() => { dispatch({ t: 'purgeCard', id: c.id }); setConfirm(null); }}>{t('ui.trash.purgeConfirm')}</button> : <button className="tool subtle" aria-label={t('ui.trash.purge')} title={t('ui.trash.purge')} onClick={() => setConfirm(c.id)}>{t('ui.trash.purge')}</button>}
            </div>
          ))}
        </div>
        <footer className="ap-foot">
          {cards.length > 0 && (confirm === 'all' ? <span className="confirm">{t('ui.trash.sure')}<button className="tool" onClick={() => setConfirm(null)}>{t('ui.trash.no')}</button><button className="danger" onClick={() => { dispatch({ t: 'emptyBoardTrash', project: project.id }); setConfirm(null); }}>{t('ui.trash.emptyAll')}</button></span> : <button className="tool" onClick={() => setConfirm('all')}>{t('ui.trash.empty')}</button>)}
          <span className="grow" /><button className="primary" onClick={onClose}>{t('ui.common.close')}</button>
        </footer>
      </section>
    </div>
  );
}
