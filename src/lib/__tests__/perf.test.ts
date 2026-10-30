import { describe, expect, it } from 'vitest';
import { fromDocs, starterDocs } from '../model';
import type { PmCard } from '../model';
import { allStates, cellText, pmTemplate, visibleRows } from '../pm';
import type { Pm } from '../pm';
import { emptyState, newCard, reduce, search, searchIndex } from '../store';

/** Etapa 8 · rendimiento con 500 filas o más. */
function big(n: number): Pm {
  const pm = pmTemplate();
  const title = pm.cols.find((c) => c.type === 'text')!;
  const status = pm.cols.find((c) => c.type === 'status')!;
  const st = allStates(status);
  const date = pm.cols.find((c) => c.type === 'date');
  pm.rows = Array.from({ length: n }, (_, i) => ({
    id: 'r' + i,
    cells: { [title.id]: 'Tarea ' + i, [status.id]: st[i % st.length].st.id, ...(date ? { [date.id]: { start: `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, end: null } } : {}) },
  })) as Pm['rows'];
  return pm;
}

describe('rendimiento con 1000 filas', () => {
  it('filtra, ordena, calcula y busca por debajo de 1 s', () => {
    const pm = big(1000);
    const title = pm.cols.find((c) => c.type === 'text')!;
    const t0 = performance.now();
    const rows = visibleRows({ ...pm, sorts: [{ col: title.id, dir: 'desc' }] } as Pm, [], '2026-10-11', 'tarea 99');
    for (const r of pm.rows) for (const c of pm.cols) cellText(pm, c, r, []);
    let s = reduce(emptyState, { t: 'load', ...fromDocs(starterDocs()) }).state;
    const card = { ...(newCard('pm', 'home') as PmCard), title: 'Grande', pm };
    s = { ...s, cards: [...s.cards, card] };
    search(searchIndex(s), 'tarea 500');
    expect(rows.length).toBeGreaterThan(0);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
