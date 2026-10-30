import { describe, expect, it } from 'vitest';
import { buildGraph } from '../graph';
import { fromDocs } from '../model';
import { sampleDocs } from '../sample';
import { emptyState, reduce, search, searchIndex } from '../store';
import { cellText, setWorld, tableProgress, visibleRows } from '../pm';
import type { PmCard } from '../model';

describe('datos de ejemplo de la maqueta', () => {
  const d = fromDocs(sampleDocs());
  const s = reduce(emptyState, { t: 'load', ...d }).state;
  it('trae las tareas principales, calendarios y etiquetas del doc', () => {
    expect(s.projects.filter((p) => !p.hidden).map((p) => p.name)).toEqual(['Mi espacio', 'Mudanza de octubre', 'Curso de fotografía', 'Casa · semana', 'Diseño de mi app', 'Encargo · Mural Café Aurora']);
    expect(s.folders.map((f) => f.name)).toEqual(['Casa y vida', 'Aprendizaje']);
    expect(s.cards.filter((c) => c.type === 'note' && c.day).map((c) => (c as { day: string }).day)).toEqual(['2026-09-25', '2026-09-27', '2026-09-28']);
    expect(s.tags).toHaveLength(5);
    expect(s.events.find((e) => e.id === 'e1')!.repeat).toBe('year');
  });
  it('la Tabla PM «Seguimiento del encargo» calcula fórmulas y resúmenes', () => {
    setWorld({ cards: s.cards as never, projects: s.projects, tags: s.tags });
    const pm = (s.cards.find((c) => c.id === 'k20') as PmCard).pm;
    expect(pm.rows).toHaveLength(8);
    const margen = pm.cols.find((c) => c.name === 'Margen')!;
    const px5 = pm.rows.find((r) => r.id === 'px5')!;
    // 2400 € de presupuesto − (180 + 40 + 220 + 12) € de materiales
    expect(cellText(pm, margen, px5, s.tags).replace(/\D/g, '')).toContain('1948');
    expect(visibleRows(pm, s.tags, '2026-09-28', '').length).toBe(7);
    expect(tableProgress(pm)).toBeGreaterThanOrEqual(0);
  });
  it('el buscador y el grafo encuentran el contenido', () => {
    expect(search(searchIndex(s), 'andamio').length).toBeGreaterThan(0);
    expect(buildGraph(s).nodes.length).toBeGreaterThan(20);
  });
});

describe('enlaces a filas', () => {
  it('[[Tarea/Tabla/Fila]] conecta la nota con la fila en el grafo', () => {
    const s = reduce(emptyState, { t: 'load', ...fromDocs(sampleDocs()) }).state;
    const g = buildGraph(s);
    expect(g.edges.some((e) => e.kind === 'link' && e.to.startsWith('r:k20:'))).toBe(true);
  });
});
