import { useApp } from '../../App';
import { t } from '../../i18n';
import { groupReminders, projectStats, reminders, whenLabel } from '../../lib/agenda';
import { WIDGET_LABEL } from '../../lib/model';
import type { WidgetCard, WidgetKind } from '../../lib/model';

const DAY = 86_400_000;

export function WidgetBody({ card }: { card: WidgetCard }) {
  const { state, dispatch, goTo } = useApp();
  const now = new Date();
  const all = reminders(state).filter((it) => !it.card.done);
  let content;
  if (card.widget === 'projects') {
    const list = state.projects.filter((p) => !p.trashed && !p.hidden && !p.home);
    content = list.length ? list.map((p) => {
      const st = projectStats(state.cards, p.id);
      return (
        <button key={p.id} className="w-row" onClick={() => dispatch({ t: 'select', id: p.id })}>
          <span className="dot" style={{ background: p.color }} /><span className="grow">{p.name}</span>
          <span className="progress mini"><span style={{ width: st.pct + '%', background: p.color }} /></span><span className="small muted">{st.total ? st.pct + '%' : ''}</span>
        </button>
      );
    }) : <p className="muted small">{t('cal.widget.noProjects')}</p>;
  } else {
    const items = card.widget === 'today'
      ? groupReminders(all, now).filter((g) => g.key === 'late' || g.key === 'today').flatMap((g) => g.items)
      : all.filter((it) => it.at && it.at.getTime() >= now.getTime() && it.at.getTime() < now.getTime() + 7 * DAY);
    content = items.length ? items.slice(0, 8).map((it) => (
      <button key={it.card.id} className="w-row" onClick={() => goTo(it.project.id, it.card.id)}>
        <span className="dot" style={{ background: it.project.color }} /><span className="grow">{it.card.title || it.card.note || t('cal.reminder')}</span>
        <span className={'small' + (it.at && it.at < now ? ' late-text' : ' muted')}>{whenLabel(it.at, now)}</span>
      </button>
    )) : <p className="muted small">{card.widget === 'today' ? t('cal.widget.nothingToday') : t('cal.widget.nothingWeek')}</p>;
  }
  return (
    <div className="widget">
      <div className="seg">{(Object.keys(WIDGET_LABEL) as WidgetKind[]).map((k) => <button key={k} className={card.widget === k ? 'on' : ''} onClick={() => dispatch({ t: 'patchCard', id: card.id, patch: { widget: k } })}>{WIDGET_LABEL[k]}</button>)}</div>
      <div className="w-list">{content}</div>
    </div>
  );
}
