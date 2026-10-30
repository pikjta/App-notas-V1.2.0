import { useState } from 'react';
import { useApp } from '../App';
import { t } from '../i18n';
import { groupReminders, reminders } from '../lib/agenda';
import { ReminderRow } from './ReminderRow';

type Filter = 'all' | 'bell' | 'quiet';
const filters = (): [Filter, string][] => [['all', t('cal.rems.all')], ['bell', t('cal.rems.bell')], ['quiet', t('cal.rems.quiet')]];

export function Reminders() {
  const { state } = useApp();
  const [f, setF] = useState<Filter>('all');
  const all = reminders(state);
  const list = all.filter((it) => f === 'all' || (f === 'bell' ? it.card.bell : !it.card.bell));
  const groups = groupReminders(list);
  return (
    <main className="board view">
      <header className="board-head">
        <div className="grow"><h1 className="board-title">{t('cal.rems.title')}</h1><p className="muted small">{t('cal.rems.subtitle')}</p></div>
        <div className="seg big">{filters().map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
      </header>
      {groups.length === 0 ? (
        <div className="empty">{t('cal.rems.empty')}</div>
      ) : groups.map((g) => (
        <section key={g.key} className={'panel' + (g.key === 'late' ? ' late' : '')}>
          <h2>{g.label} <span className="count">{g.items.length}</span></h2>
          {g.items.map((it) => <ReminderRow key={it.card.id} it={it} late={g.key === 'late'} />)}
        </section>
      ))}
    </main>
  );
}
