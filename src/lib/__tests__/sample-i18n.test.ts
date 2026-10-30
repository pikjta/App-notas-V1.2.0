import { describe, expect, it } from 'vitest';
import { fromDocs } from '../model';
import type { Language } from '../model';
import { sampleDocs } from '../sample';
import { emptyState, reduce } from '../store';
import { cellText, setWorld } from '../pm';
import type { PmCard } from '../model';
import { getLang, SUPPORTED } from '../../i18n';

const WIKI = /\[\[([^\]\n|]+)(?:\|([^\]\n]*))?\]\]/g;

describe.each(SUPPORTED)('datos de ejemplo en %s', (lang: Language) => {
  const docs = sampleDocs(lang);
  const s = reduce(emptyState, { t: 'load', ...fromDocs(docs) }).state;
  const pmCards = s.cards.filter((c): c is PmCard => c.type === 'pm');
  const k20 = pmCards.find((c) => c.id === 'k20')!;

  it('no cambia el idioma actual y deja el idioma elegido en los ajustes', () => {
    expect(getLang()).toBe('es');
    expect(s.settings.lang).toBe(lang);
  });

  it('no deja claves sin resolver («sam.…») en ningún texto', () => {
    expect(JSON.stringify(docs)).not.toMatch(/sam\.[a-z]/i);
  });

  it('todos los enlaces [[destino|alias]] de notas y descripciones de fila apuntan a algo que existe', () => {
    const texts: string[] = [];
    for (const c of s.cards) {
      if (c.type === 'note') texts.push(c.body);
      if (c.type === 'pm') for (const r of c.pm.rows) if (r.desc) texts.push(r.desc);
    }
    const taskCol = k20.pm.cols[0];
    let n = 0;
    for (const body of texts) {
      for (const m of body.matchAll(WIKI)) {
        const dest = m[1];
        if (!dest.trim()) continue; // «[[ ]]» escrito como ejemplo en las notas de desarrollo
        n++;
        const [pName, ...rest] = dest.split('/');
        const p = s.projects.find((x) => x.name === pName);
        expect(p, `tarea principal «${pName}» en ${lang}`).toBeTruthy();
        if (!rest.length) continue;
        const card = s.cards.find((c) => c.project === p!.id && c.title === rest[0]);
        expect(card, `tarjeta «${rest[0]}» en ${lang}`).toBeTruthy();
        if (rest.length > 1) {
          expect(card!.type).toBe('pm');
          const rowName = rest.slice(1).join('/');
          const row = (card as PmCard).pm.rows.find((r) => r.cells[taskCol.id] === rowName);
          expect(row, `fila «${rowName}» en ${lang}`).toBeTruthy();
        }
        expect((m[2] ?? '').trim().length, 'alias').toBeGreaterThan(0);
      }
    }
    expect(n).toBe(9);
  });

  it('la Tabla PM tiene 8 filas y la fórmula «Margen» da un número', () => {
    setWorld({ cards: s.cards as never, projects: s.projects, tags: s.tags });
    expect(k20.pm.rows).toHaveLength(8);
    const margin = k20.pm.cols.find((c) => c.id === 'pxc15')!;
    const perHour = k20.pm.cols.find((c) => c.id === 'pxc14')!;
    const px5 = k20.pm.rows.find((r) => r.id === 'px5')!;
    for (const col of [margin, perHour]) {
      const txt = cellText(k20.pm, col, px5, s.tags);
      expect(txt).not.toMatch(/#REF|error|#/i);
      expect(txt.replace(/\D/g, '')).not.toBe('');
    }
    expect(cellText(k20.pm, margin, px5, s.tags).replace(/\D/g, '')).toContain('1948');
    expect(cellText(k20.pm, perHour, px5, s.tags).replace(/\D/g, '')).toContain('50');
  });

  it('las fórmulas citan columnas que existen y el estado/responsable de cada fila se resolvió', () => {
    const names = new Set(k20.pm.cols.map((c) => c.name));
    for (const c of k20.pm.cols.filter((x) => x.type === 'formula')) {
      for (const m of (c.expr ?? '').matchAll(/prop\("([^"]+)"\)/g)) expect(names.has(m[1]), `${m[1]} en ${lang}`).toBe(true);
    }
    const status = k20.pm.cols[1], owner = k20.pm.cols[3];
    const px2 = k20.pm.rows.find((r) => r.id === 'px2')!;
    expect(px2.cells[status.id]).toBe(status.phases![1].states[2].id);
    expect(owner.opts!.map((o) => o.id)).toContain(px2.cells[owner.id]);
    expect(k20.pm.rules![0].filter.col).toBe(k20.pm.cols[5].id);
  });
});
