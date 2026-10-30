import { describe, expect, it } from 'vitest';
import { arrowBetween, eraseAt, formatColor, inkOn, paletteFromPixels, strokePath } from '../graphics';
import { splitWiki } from '../markdown';
import { DEFAULT_THEME, fromDocs, starterDocs, uid } from '../model';
import type { ImageCard } from '../model';
import { emptyState, newCard, reduce, search, searchIndex } from '../store';
import type { Action, State } from '../store';

const loaded = (): State => reduce(emptyState, { t: 'load', ...fromDocs(starterDocs()) }).state;
const run = (s: State, ...as: Action[]) => as.reduce((acc, a) => reduce(acc, a).state, s);

describe('imágenes', () => {
  it('la imagen se guarda como documento aparte y se borra al borrar la tarjeta', () => {
    const c = newCard('image', 'home') as ImageCard;
    const asset = { id: 'a1', card: c.id, mime: 'image/png', data: 'data:image/png;base64,AAAA' };
    const e = reduce(loaded(), { t: 'addImage', card: { ...c, asset: 'a1', name: 'boceto.png' }, asset });
    expect(e.put.map((d) => d.kind)).toEqual(['asset', 'card']);
    let s = e.state;
    expect(s.assets.a1.data).toContain('base64');
    const moved = reduce(s, { t: 'moveCard', id: c.id, x: 300, y: 300 });
    expect(moved.put.map((d) => d.kind)).toEqual(['card']);
    s = run(moved.state, { t: 'trashCard', id: c.id });
    expect(s.assets.a1).toBeTruthy();
    const purge = reduce(s, { t: 'purgeCard', id: c.id });
    expect(purge.del).toEqual([c.id, 'a1']);
    expect(purge.state.assets.a1).toBeUndefined();
    expect(search(searchIndex(run(loaded(), { t: 'addImage', card: { ...c, asset: 'a1', name: 'boceto.png' }, asset })), 'boceto')[0].kind).toBe('Imagen');
  });

  it('los documentos «asset» se cargan en el estado', () => {
    const docs = [...starterDocs(), { id: 'a9', kind: 'asset', parent: 'c', pos: 0, updated: 0, data: { mime: 'image/jpeg', data: 'data:x' } }];
    expect(fromDocs(docs).assets.a9).toMatchObject({ card: 'c', mime: 'image/jpeg' });
  });
});

describe('flechas y apariencia', () => {
  it('crear, sin duplicados ni bucles, editar y quitar', () => {
    const a = newCard('note', 'home'), b = newCard('note', 'home');
    let s = run(loaded(), { t: 'addCard', card: a }, { t: 'addCard', card: b }, { t: 'addLink', project: 'home', link: { id: 'l1', from: a.id, to: b.id, label: '', color: null, both: false } });
    expect(s.projects[0].links).toHaveLength(1);
    s = run(s, { t: 'addLink', project: 'home', link: { id: 'l2', from: b.id, to: a.id, label: '', color: null, both: false } }, { t: 'addLink', project: 'home', link: { id: 'l3', from: a.id, to: a.id, label: '', color: null, both: false } });
    expect(s.projects[0].links).toHaveLength(1);
    s = run(s, { t: 'patchLink', project: 'home', id: 'l1', patch: { label: 'contexto', both: true, color: '#C8372D' } });
    expect(s.projects[0].links![0]).toMatchObject({ label: 'contexto', both: true, color: '#C8372D' });
    s = run(s, { t: 'removeLink', project: 'home', id: 'l1' });
    expect(s.projects[0].links).toHaveLength(0);
  });

  it('cada tarea principal guarda su apariencia', () => {
    let s = run(loaded(), { t: 'addProject', id: 'p1', name: 'Mural', color: '#0E7C7B' }, { t: 'setTheme', project: 'p1', patch: { board: 'noche', texture: 'diagonal' } });
    expect(s.projects.find((p) => p.id === 'p1')!.theme).toEqual({ ...DEFAULT_THEME, board: 'noche', texture: 'diagonal' });
    expect(s.projects[0].theme).toEqual(DEFAULT_THEME);
    s = run(s, { t: 'setTheme', project: 'p1', patch: { texture: 'liso' } });
    expect(s.projects.find((p) => p.id === 'p1')!.theme).toEqual({ ...DEFAULT_THEME, board: 'noche', texture: 'liso' });
  });

  it('la flecha sale del lado más cercano y apunta a la otra tarjeta', () => {
    const g = arrowBetween({ x: 0, y: 0, w: 100, h: 100 }, { x: 300, y: 0, w: 100, h: 100 });
    expect(g.d.startsWith('M 100 50')).toBe(true);
    expect(g.d.endsWith('300 50')).toBe(true);
    const v = arrowBetween({ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 400, w: 100, h: 100 });
    expect(v.d.startsWith('M 50 100')).toBe(true);
    expect(v.mid.y).toBeGreaterThan(100);
  });
});

describe('boceto y paleta', () => {
  it('trazos suavizados, borrador y deshacer trazo', () => {
    expect(strokePath([[0, 0], [10, 10], [20, 0]])).toMatch(/^M 0 0 Q 10 10 15\.0 5\.0 L 20 0$/);
    const strokes = [{ c: '#000', s: 4, o: 1, p: [[10, 10], [20, 20]] as [number, number][] }, { c: '#000', s: 4, o: 1, p: [[200, 200]] as [number, number][] }];
    expect(eraseAt(strokes, [21, 21])).toHaveLength(1);
    const sk = newCard('sketch', 'home');
    const s = run(loaded(), { t: 'addCard', card: sk }, { t: 'addStroke', card: sk.id, stroke: strokes[0] }, { t: 'addStroke', card: sk.id, stroke: strokes[1] });
    const c = s.cards.find((x) => x.id === sk.id);
    expect(c?.type === 'sketch' && c.strokes).toHaveLength(2);
  });

  it('extrae los colores principales de una imagen', () => {
    const px: number[] = [];
    const put = (rgb: number[], n: number) => { for (let i = 0; i < n; i++) px.push(rgb[0], rgb[1], rgb[2], 255); };
    put([246, 215, 176], 500); put([242, 140, 56], 300); put([122, 78, 45], 250); put([185, 119, 74], 200); put([245, 214, 178], 100); put([0, 0, 0], 3);
    for (let i = 0; i < 50; i++) px.push(255, 0, 0, 0); // transparentes: se ignoran
    const pal = paletteFromPixels(px, 6);
    expect(pal).toContain('#7A4E2D');
    expect(pal).toContain('#F28C38');
    expect(pal.length).toBeGreaterThanOrEqual(4);
    expect(pal).not.toContain('#FF0000');
  });

  it('formatos de color y texto legible', () => {
    expect(formatColor('#f28c38', 'hex')).toBe('#F28C38');
    expect(formatColor('#F28C38', 'rgb')).toBe('rgb(242, 140, 56)');
    expect(formatColor('#F28C38', 'hsl')).toBe('hsl(27, 88%, 58%)');
    expect(inkOn('#FFFFFF')).toBe('#1F1D1A');
    expect(inkOn('#1F1D1A')).toBe('#FFFFFF');
  });
});

describe('enlaces [[ ]]', () => {
  it('separa destino y alias', () => {
    expect(splitWiki('Mural/Brief|el brief')).toEqual({ dest: 'Mural/Brief', label: 'el brief' });
    expect(splitWiki(' Mural ')).toEqual({ dest: 'Mural', label: 'Mural' });
    expect(splitWiki('Mural/Brief').label).toBe('Brief');
  });
  it('uid genera identificadores distintos', () => {
    expect(uid('x')).not.toBe(uid('x'));
  });
});
