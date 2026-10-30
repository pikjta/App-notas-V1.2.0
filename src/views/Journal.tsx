import { useApp } from '../App';
import { locale, t } from '../i18n';
import { longDate, longDateNoYear, shiftDay, weekdayInitial } from '../lib/agenda';
import type { NoteCard } from '../lib/model';
import { dailyId, journalTemplate, todayKey } from '../lib/store';
import { CardFrame } from '../components/Board';
import { hm, itemsBetween } from '../lib/calendar';

export function Journal() {
  const { state, dispatch, requestEdit } = useApp();
  const day = state.day;
  const tk = todayKey();
  const entries = state.cards.filter((c): c is NoteCard => c.type === 'note' && !!c.day && !c.trashed).sort((a, b) => (a.day! < b.day! ? 1 : -1));
  const has = new Set(entries.map((e) => e.day));
  const dayItems = itemsBetween(state, day, day);
  const card = entries.find((e) => e.id === dailyId(day));
  const [y, m] = day.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((offset + new Date(y, m, 0).getDate()) / 7) * 7 }, (_, i) => new Date(y, m - 1, 1 - offset + i));
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const firstLine = (b: string) => b.split('\n').map((l) => l.replace(/^#+\s*|^[-*]\s*(\[[ xX]\]\s*)?|^>\s*/g, '').trim()).find(Boolean) ?? t('cal.journal.empty');

  return (
    <main className="board view">
      <header className="board-head">
        <div className="grow">
          <h1 className="board-title cap">{t('cal.journal.title', { date: longDate(day) })}</h1>
        </div>
        <div className="row">
          <button className="tool" aria-label={t('cal.prevDay')} onClick={() => dispatch({ t: 'day', day: shiftDay(day, -1) })}>‹</button>
          <button className="tool" onClick={() => dispatch({ t: 'day', day: tk })}>{t('cal.today')}</button>
          <button className="tool" aria-label={t('cal.nextDay')} onClick={() => dispatch({ t: 'day', day: shiftDay(day, 1) })}>›</button>
        </div>
      </header>
      <div className="journal">
        <aside className="journal-side">
          <div className="mini-cal">
            <div className="row"><b className="grow cap">{first.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</b>
              <button className="icon-btn small" aria-label={t('cal.prevMonth')} onClick={() => dispatch({ t: 'day', day: key(new Date(y, m - 2, 1)) })}>‹</button>
              <button className="icon-btn small" aria-label={t('cal.nextMonth')} onClick={() => dispatch({ t: 'day', day: key(new Date(y, m, 1)) })}>›</button>
            </div>
            <div className="mini-grid">
              {[1, 2, 3, 4, 5, 6, 7].map((w) => <span key={w} className="wd">{weekdayInitial(w)}</span>)}
              {cells.map((d) => {
                const k = key(d);
                return (
                  <button key={k} className={'mday' + (k === day ? ' sel' : '') + (k === tk ? ' today' : '') + (d.getMonth() !== m - 1 ? ' out' : '')} onClick={() => dispatch({ t: 'day', day: k })}>
                    {d.getDate()}{has.has(k) && <i />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="small muted label">{t('cal.journal.entries', { n: entries.length })}</div>
          <div className="entries">
            {entries.length === 0 && <p className="small muted">{t('cal.journal.noEntries')}</p>}
            {entries.map((e) => (
              <button key={e.id} className={'entry' + (e.day === day ? ' on' : '')} onClick={() => dispatch({ t: 'day', day: e.day! })}>
                <b className="cap">{longDateNoYear(e.day!)}</b>
                <span className="small muted">{firstLine(e.body)}</span>
              </button>
            ))}
          </div>
        </aside>
        <div className="journal-main">
          {card ? (
            <CardFrame card={card} flash={false} fixed />
          ) : (
            <div className="empty journal-empty">
              <h3>{t('cal.journal.noNote')}</h3>
              <p>{t('cal.journal.noNoteHint')}</p>
              <div className="row center">
                <button className="primary" onClick={() => { requestEdit(dailyId(day)); dispatch({ t: 'addDaily', day, body: journalTemplate() }); }}>{t('cal.journal.fromTemplate')}</button>
                <button className="tool" onClick={() => { requestEdit(dailyId(day)); dispatch({ t: 'addDaily', day, body: '' }); }}>{t('cal.journal.blank')}</button>
              </div>
            </div>
          )}
        </div>
        <aside className="journal-cal">
          <div className="small muted label">{t('cal.journal.calDay')}</div>
          {dayItems.length === 0 ? <p className="small muted">{t('cal.journal.nothing')}</p> : dayItems.map((it) => (
            <div key={it.id} className="check-prog static">
              <span className="dot" style={{ background: it.color }} />
              <span className="small muted agenda-time">{it.kind === 'holiday' ? t('cal.holiday') : it.allDay ? t('cal.allDay') : it.start ? hm(it.start) : ''}</span>
              <span className="grow">{it.title || t('cal.untitled')}</span>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}
