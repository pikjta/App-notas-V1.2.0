import { describe, expect, it } from 'vitest';
import { fromDocs, starterDocs } from '../lib/model';
import type { Card, ImageCard } from '../lib/model';
import { canCopyCard, copyCard, hasCardClip, pasteClip } from '../lib/cardClip';
import { emptyState, newCard, reduce } from '../lib/store';
import type { Action, State } from '../lib/store';

const loaded = (): State => reduce(emptyState, { t: 'load', ...fromDocs(starterDocs()) }).state;
const run = (s: State, ...as: Action[]) => as.reduce((acc, a) => reduce(acc, a).state, s);

describe('1.2.1: copiar y pegar tarjetas', () => {
  it('pega una nota en otro tablero, con identificador propio y sin tocar la original', () => {
    const n = { ...newCard('note', 'home'), title: 'Receta', body: 'hola' } as Card;
    let s = run(loaded(), { t: 'addCard', card: n }, { t: 'addProject', id: 'p1', name: 'Otro', color: '#0E7C7B' });
    expect(copyCard(s.cards.find((c) => c.id === n.id)!, s.assets)).toBe(true);
    const clip = pasteClip()!;
    s = run(s, { t: 'pasteCard', id: 'nueva', snap: clip.card, assets: clip.assets, project: 'p1' });
    const pasted = s.cards.find((c) => c.id === 'nueva')!;
    expect(pasted.project).toBe('p1');
    expect(pasted.title).toBe('Receta');
    expect(pasted.type === 'note' && pasted.body).toBe('hola');
    expect(s.cards.find((c) => c.id === n.id)?.project).toBe('home');
  });

  it('la copia es una foto: editar el original después no cambia lo que se pega', () => {
    const n = { ...newCard('note', 'home'), title: 'Antes' } as Card;
    let s = run(loaded(), { t: 'addCard', card: n });
    copyCard(s.cards.find((c) => c.id === n.id)!, s.assets);
    s = run(s, { t: 'patchCard', id: n.id, patch: { title: 'Después' } });
    expect(pasteClip()!.card.title).toBe('Antes');
  });

  it('duplica la imagen con un archivo nuevo, sin compartirlo con el original', () => {
    const img = { ...newCard('image', 'home'), asset: 'as1', name: 'a.png' } as ImageCard;
    let s = run(loaded(), { t: 'addImage', card: img, asset: { id: 'as1', card: img.id, mime: 'image/png', data: 'data:image/png;base64,AAAA' } });
    copyCard(s.cards.find((c) => c.id === img.id)!, s.assets);
    const clip = pasteClip()!;
    s = run(s, { t: 'pasteCard', id: 'copia', snap: clip.card, assets: clip.assets, project: 'home' });
    const pasted = s.cards.find((c) => c.id === 'copia') as ImageCard;
    expect(pasted.asset).toBeTruthy();
    expect(pasted.asset).not.toBe('as1');
    expect(s.assets[pasted.asset!].card).toBe('copia');
    expect(s.assets[pasted.asset!].data).toBe('data:image/png;base64,AAAA');
    expect(s.assets['as1']).toBeDefined();
  });

  it('no copia widgets ni notas del Diario, y no pega en un tablero en la papelera', () => {
    const w = newCard('note', 'home') as Card;
    expect(canCopyCard({ ...w, type: 'note', day: '2026-11-03' } as Card)).toBe(false);
    expect(canCopyCard({ ...w, type: 'widget', widget: 'today' } as unknown as Card)).toBe(false);
    expect(canCopyCard(w)).toBe(true);
    copyCard(w, {});
    expect(hasCardClip()).toBe(true);
    let s = run(loaded(), { t: 'addProject', id: 'p2', name: 'Borrar', color: '#0E7C7B' }, { t: 'trashProject', id: 'p2' });
    const before = s.cards.length;
    const clip = pasteClip()!;
    s = run(s, { t: 'pasteCard', id: 'x', snap: clip.card, assets: clip.assets, project: 'p2' });
    expect(s.cards).toHaveLength(before);
  });
});
