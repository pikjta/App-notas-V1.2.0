import type { Part } from '../es/index';
import type { cards as Es } from '../es/cards';

export const cards: Part<typeof Es> = {
  'card.cancel': 'Annulla',

  // CheckBody.tsx
  'card.check.formatLabel': 'Formato delle attività',
  'card.check.progress': '{done} su {total} completate',
  'card.check.expand': 'Espandi sottoattività',
  'card.check.collapse': 'Comprimi sottoattività',
  'card.check.addSub': 'Aggiungi sottoattività',
  'card.check.done': 'Completata',
  'card.check.placeholder': 'Scrivi un’attività…',
  'card.check.addTask': '+ Aggiungi attività',
  'card.check.proxy': 'Attività selezionate (da copiare, tagliare o incollare)',

  // NoteBody.tsx
  'card.note.formatLabel': 'Formato della nota',
  'card.note.title': 'Titolo',
  'card.note.bold': 'Grassetto (⌘B)',
  'card.note.italic': 'Corsivo (⌘I)',
  'card.note.strike': 'Barrato',
  'card.note.code': 'Codice',
  'card.note.list': 'Elenco',
  'card.note.task': 'Casella attività',
  'card.note.quote': 'Citazione',
  'card.note.link': 'Collegamento',
  'card.note.wikiLink': 'Collegamento a un’altra attività principale',
  'card.note.content': 'Contenuto della nota',
  'card.note.empty': 'Nota vuota. Fai clic per scrivere.',
  'card.note.urlLabel': 'Indirizzo del collegamento',
  'card.note.linkTo': 'Collega a…',
  'card.note.searchPh': 'Cerca attività principale o scheda…',
  'card.note.searchLabel': 'Cerca attività principale o scheda',
  'card.note.includeCards': 'Includi schede',
  'card.note.noMatch': 'Nessun risultato.',
  'card.note.noMatchQ': 'Nessun risultato per «{q}».',
  'card.note.linkWith': 'Collega con',
  'card.note.dailyLabel': 'diario',

  // ImageBody.tsx
  'card.image.fallback': 'immagine',
  'card.image.label': 'Immagine',
  'card.image.paletteTitle': 'Tavolozza · {name}',
  'card.image.linkLabel': 'tavolozza',
  'card.image.paletteMade.one': 'Tavolozza di {n} colore creata',
  'card.image.paletteMade.other': 'Tavolozza di {n} colori creata',
  'card.image.drop': 'Trascina un’immagine qui o fai clic per sceglierla',
  'card.image.reading': 'Lettura dei colori…',
  'card.image.extract': 'Estrai tavolozza',
  'card.image.change': 'Cambia',

  // PaletteBody.tsx
  'card.palette.copiedAll': 'Tavolozza copiata',
  'card.palette.copyAll': 'Copia tutti',
  'card.palette.clickCopy': 'Fai clic per copiare',
  'card.palette.copied': '{color} copiato',
  'card.palette.change': 'Cambia colore',
  'card.palette.remove': 'Rimuovi colore',
  'card.palette.add': 'Aggiungi colore',
  'card.palette.from': 'Estratta da «{name}»',

  // SketchBody.tsx
  'card.sketch.thin': 'Sottile',
  'card.sketch.medium': 'Medio',
  'card.sketch.thick': 'Spesso',
  'card.sketch.pen': 'Matita',
  'card.sketch.marker': 'Pennarello',
  'card.sketch.eraser': 'Gomma',
  'card.sketch.color': 'Colore {color}',
  'card.sketch.hint': 'Disegna qui con il mouse o la penna',
  'card.sketch.undo': '↶ Annulla tratto',
  'card.sketch.confirm': 'Cancellare il disegno?',
  'card.sketch.no': 'No',
  'card.sketch.erase': 'Cancella',
  'card.sketch.eraseAll': 'Cancella tutto',

  // lib/images.ts
  'card.img.notImage': 'Quel file non è un’immagine.',
  'card.img.readFail': 'Impossibile leggere l’immagine.',
  'card.img.colorsFail': 'Impossibile leggere i colori di questa immagine.',
  'card.img.openFail': 'Impossibile aprire l’immagine.',

  // lib/markdown.tsx
  'card.md.goTo': 'Vai a {dest}',
  'card.md.missing': 'Non esiste: {dest}',
};
