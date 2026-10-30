import { useState } from 'react';
import { formatClock } from '../../lib/notify';
import { useApp } from '../../App';
import { locale, t, tn } from '../../i18n';
import { monthShort, weekdayInitial } from '../../lib/agenda';
import type { ReminderCard } from '../../lib/model';

const DAY = 86_400_000;

/** «hoy a las 10:30», «mañana», «en 3 días», «hace 2 días»… */
export function relativeWhen(iso: string | null, now = new Date()): { text: string; late: boolean } {
  if (!iso) return { text: t('cal.noDate'), late: false };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { text: t('cal.noDate'), late: false };
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / DAY);
  const hm = formatClock(d);
  const late = d.getTime() < now.getTime();
  if (days === 0) return { text: t(late ? 'cal.rel.todayPast' : 'cal.rel.today', { time: hm }), late };
  if (days === 1) return { text: t('cal.rel.tomorrow', { time: hm }), late: false };
  if (days === -1) return { text: t('cal.rel.yesterday', { time: hm }), late: true };
  if (days > 1) return { text: tn('cal.rel.inDays', days, { date: d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' }) }), late: false };
  return { text: tn('cal.rel.daysAgo', -days, { date: d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) }), late: true };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function ReminderBody({ card }: { card: ReminderCard }) {
  const { dispatch } = useApp();
  const [open, setOpen] = useState(false);
  const rel = relativeWhen(card.when);
  const when = card.when ? new Date(card.when) : null;
  const valid = when && !isNaN(when.getTime()) ? when : null;
  const setWhen = (d: Date) => dispatch({ t: 'patchCard', id: card.id, patch: { when: d.toISOString() } });
  return (
    <div className="reminder">
      <button className={'rem-big' + (rel.late ? ' late' : '')} aria-label={t('cal.rem.changeDate')} onClick={() => setOpen((o) => !o)}>
        <span className="rem-month">{valid ? monthShort(valid.getMonth()) : '—'}</span>
        <span className="rem-day">{valid ? valid.getDate() : '—'}</span>
      </button>
      <div className={'rem-when' + (rel.late ? ' late' : '')}>{rel.text}</div>
      {valid && <div className="small muted">{valid.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {formatClock(valid)}</div>}
      <div className="row wrap">
        <button className={'chip' + (card.bell ? ' on' : '')} aria-pressed={card.bell} title={card.bell ? t('cal.rem.silence') : t('cal.rem.activate')}
          onClick={() => dispatch({ t: 'patchCard', id: card.id, patch: { bell: !card.bell } })}>{card.bell ? t('cal.rem.bellOn') : t('cal.rem.bellOff')}</button>
        <button className="chip" onClick={() => setOpen((o) => !o)}>{valid ? t('cal.rem.change') : t('cal.rem.pickDate')}</button>
      </div>
      {open && <DatePicker value={valid} onChange={setWhen} onClose={() => setOpen(false)} />}
      <textarea className="rem-note" rows={2} value={card.note} placeholder={t('cal.rem.detailsPlaceholder')} aria-label={t('cal.rem.details')}
        onChange={(e) => dispatch({ t: 'patchCard', id: card.id, patch: { note: e.target.value } })} />
    </div>
  );
}

/** Selector: atajos, calendario mensual, hora y minutos. */
function DatePicker({ value, onChange, onClose }: { value: Date | null; onChange: (d: Date) => void; onClose: () => void }) {
  const base = value ?? (() => { const d = new Date(Date.now() + 3_600_000); d.setMinutes(0, 0, 0); return d; })();
  const [view, setView] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const cur = value ?? base;
  const put = (d: Date) => onChange(d);
  const day = (offset: number) => { const d = new Date(cur); const t = new Date(); t.setDate(t.getDate() + offset); d.setFullYear(t.getFullYear(), t.getMonth(), t.getDate()); put(d); setView(new Date(d.getFullYear(), d.getMonth(), 1)); };
  const first = (view.getDay() + 6) % 7; // semana desde el lunes
  const n = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(0), ...Array.from({ length: n }, (_, i) => i + 1)];
  return (
    <div className="date-pick" role="dialog" aria-label={t('cal.dp.label')}>
      <div className="row wrap">
        <button className="chip" onClick={() => day(0)}>{t('cal.today')}</button>
        <button className="chip" onClick={() => day(1)}>{t('cal.dp.tomorrow')}</button>
        <button className="chip" onClick={() => day(7)}>{t('cal.dp.inWeek')}</button>
      </div>
      <div className="row">
        <button className="icon-btn small" aria-label={t('cal.prevMonth')} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>‹</button>
        <b className="grow center">{view.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</b>
        <button className="icon-btn small" aria-label={t('cal.nextMonth')} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="dp-grid">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => <span key={d} className="small muted">{weekdayInitial(d)}</span>)}
        {cells.map((d, i) => d === 0 ? <span key={i} /> : (
          <button key={i} className={'dp-day' + (value && value.getFullYear() === view.getFullYear() && value.getMonth() === view.getMonth() && value.getDate() === d ? ' on' : '')}
            onClick={() => { const x = new Date(cur); x.setFullYear(view.getFullYear(), view.getMonth(), d); put(x); }}>{d}</button>
        ))}
      </div>
      <div className="row">
        <label className="small">{t('cal.dp.hour')}
          <select value={cur.getHours()} aria-label={t('cal.dp.hour')} onChange={(e) => { const x = new Date(cur); x.setHours(Number(e.target.value)); put(x); }}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{pad(h)}</option>)}
          </select>
        </label>
        <label className="small">{t('cal.dp.minutes')}
          <select value={Math.floor(cur.getMinutes() / 5) * 5} aria-label={t('cal.dp.minutes')} onChange={(e) => { const x = new Date(cur); x.setMinutes(Number(e.target.value)); put(x); }}>
            {Array.from({ length: 12 }, (_, m) => <option key={m} value={m * 5}>{pad(m * 5)}</option>)}
          </select>
        </label>
        <span className="grow" />
        <button className="primary small-btn" onClick={onClose}>{t('cal.dp.done')}</button>
      </div>
    </div>
  );
}
