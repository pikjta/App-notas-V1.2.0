// Portapapeles interno de tarjetas (1.2.1): copiar una tarjeta y pegarla en cualquier tablero de la app.
// Guarda una foto de la tarjeta en el momento de copiar, así que editar o borrar el original después no cambia lo que se pega.
// Vive en memoria: al cerrar la app se pierde. No toca el portapapeles del sistema.
import type { Asset, Card } from './model';

export type CardClip = { card: Card; assets: Asset[] };

let clip: CardClip | null = null;

/** Las notas de un día del Diario pertenecen a su fecha y los widgets solo viven en Inicio: no se copian. */
export const canCopyCard = (c: Card): boolean => !(c.type === 'widget' || (c.type === 'note' && !!c.day));

/** Imágenes de la tarjeta: la de una tarjeta de imagen y las de las celdas de una Tabla PM. */
export function assetsOfCard(card: Card, assets: Record<string, Asset>): Asset[] {
  if (card.type === 'image') return card.asset && assets[card.asset] ? [assets[card.asset]] : [];
  if (card.type === 'pm') return Object.values(assets).filter((a) => a.card === card.id);
  return [];
}

/** Guarda la copia. Devuelve false si esa tarjeta no se puede copiar. */
export function copyCard(card: Card, assets: Record<string, Asset>): boolean {
  if (!canCopyCard(card)) return false;
  clip = JSON.parse(JSON.stringify({ card, assets: assetsOfCard(card, assets) })) as CardClip;
  return true;
}

/** Devuelve una copia nueva de lo copiado (para que pegar varias veces no comparta objetos). */
export function pasteClip(): CardClip | null {
  return clip ? (JSON.parse(JSON.stringify(clip)) as CardClip) : null;
}

export const hasCardClip = (): boolean => clip !== null;
export const clearCardClip = (): void => { clip = null; };
