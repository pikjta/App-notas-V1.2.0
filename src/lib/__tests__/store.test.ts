import { describe, expect, it } from 'vitest';
import { memoryBackend } from '../backend';
import { fromDocs, starterDocs } from '../model';
import type { Card } from '../model';
import { coalesceKey, createSaver, diff, emptyState, History, newCard, reduce, search, searchIndex, snapOf } from '../store';
import type { Action, State } from '../store';

const loaded = (): State => reduce(emptyState, { t: 'load', ...fromDocs(starterDocs()) }).state;
const run = (s: State, ...as: Action[]) => as.reduce((acc, a) => reduce(acc, a).state, s);
const card = (s: State, id: string) => s.cards.find((c) => c.id === id) as Card;

describe('tareas principales y papelera', () => {
  it('crear, renombrar, mandar a la papelera, restaurar y borrar para siempre', () => {
    let s = run(loaded(), { t: 'addProject', id: 'p1', name: '  Mural  ', color: '#0E7C7B' });
    expect(s.projects[1].name).toBe('Mural');
    expect(s.sel).toBe('p1');
    s = run(s, { t: 'addCard', card: newCard('note', 'p1') }, { t: 'trashProject', id: 'p1' });
    expect(s.projects.find((p) => p.id === 'p1')?.trashed).toBeGreaterThan(0);
    expect(s.sel).toBe('home');
    s = run(s, { t: 'restoreProject', id: 'p1' });
    expect(s.projects.find((p) => p.id === 'p1')?.trashed).toBeNull();
    const e = reduce(run(s, { t: 'trashProject', id: 'p1' }), { t: 'emptyTrash' });
    expect(e.state.projects).toHaveLength(1);
    expect(e.del).toHaveLength(2);
    expect(run(s, { t: 'trashProject', id: 'home' }).projects[0].trashed).toBeNull();
  });

  it('las tarjetas van a la papelera y se restauran encima de las demás', () => {
    const n = newCard('note', 'home');
    let s = run(loaded(), { t: 'addCard', card: n }, { t: 'trashCard', id: n.id });
    expect(card(s, n.id).trashed).toBeGreaterThan(0);
    s = run(s, { t: 'restoreCard', id: n.id });
    expect(card(s, n.id).trashed).toBeNull();
    expect(card(s, n.id).z).toBe(Math.max(...s.cards.map((c) => c.z)));
    const e = reduce(s, { t: 'purgeCard', id: n.id });
    expect(e.del).toEqual([n.id]);
  });
});

describe('tablero libre', () => {
  it('las tarjetas nuevas se colocan debajo y encima de las demás', () => {
    const a = newCard('note', 'home'), b = newCard('check', 'home');
    const s = run(loaded(), { t: 'addCard', card: a }, { t: 'addCard', card: b });
    expect(card(s, b.id).y).toBeGreaterThan(card(s, a.id).y);
    expect(card(s, b.id).z).toBeGreaterThan(card(s, a.id).z);
  });

  it('mover y redimensionar con imán; sin imán, al píxel; límites', () => {
    const a = newCard('note', 'home');
    let s = run(loaded(), { t: 'addCard', card: a }, { t: 'moveCard', id: a.id, x: 37, y: -50 });
    expect([card(s, a.id).x, card(s, a.id).y]).toEqual([48, 0]);
    s = run(s, { t: 'resizeCard', id: a.id, w: 2000, h: 50 });
    expect([card(s, a.id).w, card(s, a.id).h]).toEqual([960, 120]);
    s = run(s, { t: 'settings', patch: { snap: false } }, { t: 'moveCard', id: a.id, x: 37, y: 13 }, { t: 'resizeCard', id: a.id, w: 301, h: 0 });
    expect([card(s, a.id).x, card(s, a.id).y, card(s, a.id).w, card(s, a.id).h]).toEqual([37, 13, 301, 0]);
  });

  it('traer al frente', () => {
    const a = newCard('note', 'home'), b = newCard('note', 'home');
    const s = run(loaded(), { t: 'addCard', card: a }, { t: 'addCard', card: b }, { t: 'raiseCard', id: a.id });
    expect(card(s, a.id).z).toBeGreaterThan(card(s, b.id).z);
  });

  it('tabla: celdas, cabeceras, filas y columnas', () => {
    const t = newCard('table', 'home');
    if (t.type !== 'table') throw new Error();
    let s = run(loaded(), { t: 'addCard', card: t }, { t: 'tableHead', card: t.id, col: 0, value: 'Material' }, { t: 'tableCell', card: t.id, row: t.rows[0].id, col: 0, value: 'Pintura' }, { t: 'tableAddCol', card: t.id }, { t: 'tableAddRow', card: t.id, id: 'r3' });
    let c = card(s, t.id);
    if (c.type !== 'table') throw new Error();
    expect(c.heads).toEqual(['Material', 'Columna 2', 'Columna 3']);
    expect(c.rows.map((r) => r.cells.length)).toEqual([3, 3, 3]);
    expect(c.rows[0].cells[0]).toBe('Pintura');
    s = run(s, { t: 'tableRemoveCol', card: t.id, col: 1 }, { t: 'tableRemoveRow', card: t.id, row: 'r3' });
    c = card(s, t.id);
    if (c.type !== 'table') throw new Error();
    expect(c.heads).toEqual(['Material', 'Columna 3']);
    expect(c.rows).toHaveLength(2);
  });

  it('checklist: añadir, marcar, sangrar y borrar elementos', () => {
    const c0 = newCard('check', 'home');
    if (c0.type !== 'check') throw new Error();
    const first = c0.items[0].id;
    // La primera tarea no puede ser subtarea (no tiene de qué colgar): la sangría se aplica a la segunda.
    const s = run(loaded(), { t: 'addCard', card: c0 }, { t: 'checkItem', card: c0.id, item: first, patch: { text: 'Comprar pintura', done: true, level: 1 } }, { t: 'addCheckItem', card: c0.id, after: first, id: 'it2' }, { t: 'checkItem', card: c0.id, item: 'it2', patch: { level: 1 } }, { t: 'addCheckItem', card: c0.id, after: 'it2', id: 'it3' }, { t: 'checkItem', card: c0.id, item: 'it3', patch: { level: 4 } });
    const c = card(s, c0.id);
    if (c.type !== 'check') throw new Error();
    // El nivel nunca salta (it3 pidió 4 y queda a 2) y hay sub-subtareas.
    expect(c.items.map((i) => [i.text, i.done, i.level])).toEqual([['Comprar pintura', true, 0], ['', false, 1], ['', false, 2]]);
  });
});

describe('deshacer y rehacer', () => {
  it('cada paso se deshace y rehace, y el diff guarda solo lo necesario', () => {
    const h = new History();
    let s = loaded();
    const steps: Action[] = [];
    const a = newCard('note', 'home');
    steps.push({ t: 'addCard', card: a }, { t: 'moveCard', id: a.id, x: 200, y: 96 }, { t: 'patchCard', id: a.id, patch: { color: '#FFF3C4' } }, { t: 'trashCard', id: a.id });
    const snaps = [snapOf(s)];
    let now = 0;
    for (const step of steps) { h.record(snapOf(s), coalesceKey(step), (now += 5000)); s = reduce(s, step).state; snaps.push(snapOf(s)); }
    let cur = snapOf(s);
    for (let i = snaps.length - 2; i >= 0; i--) { const t = h.undo(cur)!; expect(t).toStrictEqual(snaps[i]); cur = t; }
    expect(h.undo(cur)).toBeNull();
    for (let i = 1; i < snaps.length; i++) { const t = h.redo(cur)!; expect(t).toStrictEqual(snaps[i]); cur = t; }
    const d = diff(snaps[1], snaps[2]);
    expect(d.put.map((x) => x.id)).toEqual([a.id]);
    expect(diff(snaps[1], snaps[0]).del).toEqual([a.id]);
  });

  it('escribir seguido en el mismo campo cuenta como un solo paso', () => {
    const h = new History();
    const s = loaded();
    const id = s.cards[0].id;
    ['h', 'ho', 'hola'].forEach((body, i) => h.record(snapOf(s), coalesceKey({ t: 'patchCard', id, patch: { body } }), 1000 + i * 300));
    h.record(snapOf(s), coalesceKey({ t: 'patchCard', id, patch: { body: 'x' } }), 9000);
    expect(h.undo(snapOf(s))).not.toBeNull();
    expect(h.undo(snapOf(s))).not.toBeNull();
    expect(h.undo(snapOf(s))).toBeNull();
  });
});

describe('búsqueda', () => {
  it('encuentra en títulos, notas, checklists y tablas, sin distinguir tildes, y no en la papelera', () => {
    const t = newCard('table', 'home');
    if (t.type !== 'table') throw new Error();
    const n = newCard('note', 'home');
    let s = run(loaded(), { t: 'addProject', id: 'p1', name: 'Mural Café Aurora', color: '#0E7C7B' }, { t: 'addCard', card: t }, { t: 'tableCell', card: t.id, row: t.rows[0].id, col: 1, value: 'Barniz UV' }, { t: 'addCard', card: { ...n, project: 'p1' } }, { t: 'patchCard', id: n.id, patch: { title: 'Brief', body: '## Luz\n- [ ] Medir la pared del café' } });
    const ix = searchIndex(s);
    expect(search(ix, 'cafe').map((h) => h.kind)).toEqual(['Tarea principal', 'Nota']);
    expect(search(ix, 'barniz')[0]).toMatchObject({ kind: 'Celda', card: t.id });
    expect(search(ix, 'medir')[0].text).toBe('Medir la pared del café');
    s = run(s, { t: 'trashCard', id: n.id });
    expect(search(searchIndex(s), 'medir')).toHaveLength(0);
  });
});

describe('guardado', () => {
  it('agrupa escrituras y guarda solo la última versión', async () => {
    const be = memoryBackend(starterDocs());
    const saver = createSaver(be, () => undefined, 10_000);
    let s = loaded();
    const n = newCard('note', 'home');
    let e = reduce(s, { t: 'addCard', card: n });
    saver.queue(e.put, e.del);
    s = e.state;
    for (const body of ['h', 'ho', 'hola']) { e = reduce(s, { t: 'patchCard', id: n.id, patch: { body } }); saver.queue(e.put, e.del); s = e.state; }
    await saver.flush();
    expect(fromDocs(await be.all()).cards.find((c) => c.id === n.id)).toMatchObject({ body: 'hola' });
  });

  it('los datos de la Fase 0 (sin posición) se cargan colocados en cuadrícula', () => {
    const docs = starterDocs().map((d) => (d.kind === 'card' ? { ...d, data: { type: 'note', title: 'Vieja', body: '' } } : d));
    const { cards } = fromDocs(docs);
    expect(cards[0]).toMatchObject({ x: 0, y: 0, w: 380, h: 0, color: null, trashed: null });
  });

  it('avisa si el cuaderno está bloqueado al guardar', async () => {
    const be = memoryBackend(starterDocs());
    await be.vaultPrepare('una contraseña larga');
    await be.vaultConfirm([[0, 'ábaco']]);
    await be.lock();
    const errors: string[] = [];
    const saver = createSaver(be, (m) => errors.push(m));
    saver.queue(starterDocs(), []);
    await saver.flush();
    expect(errors).toEqual(['El cuaderno está bloqueado.']);
  });
});
