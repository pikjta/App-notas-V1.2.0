import { useApp } from '../App';
import { t } from '../i18n';
import { checklistsInProgress, groupReminders, longDate, reminders } from '../lib/agenda';
import { Markdown } from '../lib/markdown';
import { dailyId, journalTemplate, todayKey } from '../lib/store';
import { ReminderRow } from './ReminderRow';

export function Today() {
  const { state, dispatch, goTo, resolveLink, requestEdit } = useApp();
  const now = new Date();
  const groups = groupReminders(reminders(state), now).filter((g) => g.key === 'late' || g.key === 'today');
  const checks = checklistsInProgress(state).slice(0, 8);
  const tk = todayKey(now);
  const daily = state.cards.find((c) => c.id === dailyId(tk));
  const lateN = groups.filter((g) => g.key === 'late').reduce((m, g) => m + g.items.length, 0);
  const todayN = groups.filter((g) => g.key === 'today').reduce((m, g) => m + g.items.length, 0);

  return (
    <main className="board view">
      <header className="board-head">
        <div className="grow">
          <div className="kicker">{longDate(tk)}</div>
          <h1 className="board-title">{t('cal.today')}</h1>
        </div>
        <div className="stats">
          <div><b>{todayN}</b><span>{t('cal.today.forToday')}</span></div>
          <div className={lateN ? 'late' : ''}><b>{lateN}</b><span>{t('cal.today.late')}</span></div>
          <div><b>{checks.length}</b><span>{t('cal.today.checklists')}</span></div>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>{t('cal.today.noteTitle')}</h2>
          {daily ? <button className="tool" onClick={() => dispatch({ t: 'day', day: tk })}>{t('cal.today.openJournal')}</button>
            : <button className="tool" onClick={() => { requestEdit(dailyId(tk)); dispatch({ t: 'addDaily', day: tk, body: journalTemplate() }); }}>{t('cal.today.write')}</button>}
        </div>
        {daily && daily.type === 'note' ? (
          <div className="daily-preview"><Markdown body={daily.body.split('\n').slice(0, 8).join('\n')} link={resolveLink} /></div>
        ) : (
          <p className="muted">{t('cal.today.journalHint')}</p>
        )}
      </section>

      {groups.length === 0 ? (
        <section className="panel"><h2>{t('cal.rems.title')}</h2><p className="muted">{t('cal.today.noReminders')}</p></section>
      ) : groups.map((g) => (
        <section key={g.key} className={'panel' + (g.key === 'late' ? ' late' : '')}>
          <h2>{g.label} <span className="count">{g.items.length}</span></h2>
          {g.items.map((it) => <ReminderRow key={it.card.id} it={it} late={g.key === 'late'} />)}
        </section>
      ))}

      {checks.length > 0 && (
        <section className="panel">
          <h2>{t('cal.today.checklistsTitle')}</h2>
          {checks.map((x) => (
            <button key={x.card.id} className="check-prog" onClick={() => goTo(x.project.id, x.card.id)}>
              <span className="dot" style={{ background: x.project.color }} />
              <span className="grow"><b>{x.card.title || t('cal.today.checklist')}</b><span className="small muted"> · {x.project.name}</span></span>
              <span className="progress mini"><span style={{ width: `${Math.round((x.done / x.total) * 100)}%`, background: x.project.color }} /></span>
              <span className="small muted">{x.done}/{x.total}</span>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
