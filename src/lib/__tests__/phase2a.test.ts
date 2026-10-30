import { describe, expect, it } from 'vitest';
import { checklistsInProgress, dueNotifications, groupReminders, projectStats, reminders, shiftDay } from '../agenda';
import { fromDocs, JOURNAL_ID, starterDocs } from '../model';
import type { ReminderCard } from '../model';
import { dailyId, emptyState, journalTemplate, newCard, reduce, search, searchIndex } from '../store';
import type { Action, State } from '../store';

const loaded = (): State => reduce(emptyState, { t: 'load', ...fromDocs(starterDocs()) }).state;
const run = (s: State, ...as: Action[]) => as.reduce((acc, a) => reduce(acc, a).state, s);
const NOW = new Date(2026, 8, 28, 12, 0);
const at = (d: number, h: number, m = 0) => new Date(2026, 8, 28 + d, h, m).toISOString();
const rem = (id: string, when: string | null, extra: Partial<ReminderCard> = {}): ReminderCard => ({ ...(newCard('reminder', 'home') as ReminderCard), id, when, title: id, ...extra });

describe('recordatorios', () => {
  const s = run(loaded(),
    { t: 'addCard', card: rem('ayer', at(-1, 10)) },
    { t: 'addCard', card: rem('esta-mañana', at(0, 9)) },
    { t: 'addCard', card: rem('esta-tarde', at(0, 18)) },
    { t: 'addCard', card: rem('jueves', at(3, 9)) },
    { t: 'addCard', card: rem('mes', at(30, 9)) },
    { t: 'addCard', card: rem('sin-fecha', null) },
    { t: 'addCard', card: rem('hecho', at(0, 8), { done: true }) });

  it('se agrupan en atrasados, hoy, próximos 7 días, más adelante, sin fecha y hechos', () => {
    const g = groupReminders(reminders(s), NOW);
    expect(g.map((x) => [x.label, x.items.map((i) => i.card.title)])).toEqual([
      ['Atrasados', ['ayer', 'esta-mañana']],
      ['Hoy', ['esta-tarde']],
      ['Próximos 7 días', ['jueves']],
      ['Más adelante', ['mes']],
      ['Sin fecha', ['sin-fecha']],
      ['Hechos', ['hecho']],
    ]);
  });

  it('marcar como hecho y posponer', () => {
    let t = run(s, { t: 'completeReminder', id: 'ayer', done: true });
    expect((t.cards.find((c) => c.id === 'ayer') as ReminderCard).done).toBe(true);
    t = run(t, { t: 'snoozeReminder', id: 'ayer', until: at(1, 9) });
    expect(t.cards.find((c) => c.id === 'ayer')).toMatchObject({ done: false, when: at(1, 9), notified: null });
  });

  it('avisos: solo con campana, a su hora (con antelación), una vez y no los muy antiguos', () => {
    let t = run(s, { t: 'patchCard', id: 'esta-tarde', patch: { bell: false } });
    expect(dueNotifications(t, NOW).map((x) => x.card.title)).toEqual(['esta-mañana']);
    expect(dueNotifications(t, new Date(2026, 8, 28, 17, 50), 15).map((x) => x.card.title)).toEqual(['esta-mañana']);
    t = run(t, { t: 'patchCard', id: 'esta-tarde', patch: { bell: true } });
    expect(dueNotifications(t, new Date(2026, 8, 28, 17, 50), 15).map((x) => x.card.title)).toEqual(['esta-mañana', 'esta-tarde']);
    const e = reduce(t, { t: 'markNotified', ids: ['esta-mañana'], at: 1 });
    expect(e.put).toHaveLength(1);
    expect(dueNotifications(e.state, NOW)).toHaveLength(0);
    const moved = run(e.state, { t: 'patchCard', id: 'esta-mañana', patch: { when: at(0, 12) } });
    expect(dueNotifications(moved, NOW).map((x) => x.card.title)).toEqual(['esta-mañana']);
    expect(dueNotifications(run(t, { t: 'settings', patch: { notify: false } }), NOW)).toHaveLength(0);
  });
});

describe('diario', () => {
  it('crea la nota del día (y el diario oculto) una sola vez; aparece en la búsqueda', () => {
    const e = reduce(loaded(), { t: 'addDaily', day: '2026-09-28', body: journalTemplate() });
    expect(e.put.map((d) => d.kind)).toEqual(['project', 'card']);
    let s = e.state;
    expect(s.view).toBe('journal');
    expect(s.projects.find((p) => p.id === JOURNAL_ID)?.hidden).toBe(true);
    const again = reduce(s, { t: 'addDaily', day: '2026-09-28', body: 'otra' });
    expect(again.put).toHaveLength(0);
    s = run(s, { t: 'patchCard', id: dailyId('2026-09-28'), patch: { body: '## Plan\n- [ ] Llamar a Café Aurora' } });
    expect(search(searchIndex(s), 'aurora')[0]).toMatchObject({ kind: 'Nota diaria', where: 'Diario › 28/09/2026' });
    expect(searchIndex(s).some((h) => h.kind === 'Tarea principal' && h.text === 'Diario')).toBe(false);
  });
  it('cambiar de día', () => {
    expect(shiftDay('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
    expect(run(loaded(), { t: 'day', day: '2026-10-01' })).toMatchObject({ day: '2026-10-01', view: 'journal' });
  });
});

describe('Hoy y widgets', () => {
  it('checklists en curso y progreso de una tarea principal', () => {
    const c = newCard('check', 'home');
    if (c.type !== 'check') throw new Error();
    const s = run(loaded(), { t: 'addCard', card: { ...c, items: [{ id: 'a', text: 'Uno', done: true, level: 0 }, { id: 'b', text: 'Dos', done: false, level: 0 }, { id: 'c', text: '', done: false, level: 0 }] } });
    expect(checklistsInProgress(s).map((x) => [x.done, x.total])).toEqual([[1, 2]]);
    expect(projectStats(s.cards, 'home')).toEqual({ done: 1, total: 2, pct: 50 });
  });
});
