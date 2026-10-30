import type { Part } from '../es/index';
import type { cards as Es } from '../es/cards';

export const cards: Part<typeof Es> = {
  'card.cancel': 'Abbrechen',

  // CheckBody.tsx
  'card.check.formatLabel': 'Format der Aufgaben',
  'card.check.progress': '{done} von {total} erledigt',
  'card.check.expand': 'Unteraufgaben ausklappen',
  'card.check.collapse': 'Unteraufgaben einklappen',
  'card.check.addSub': 'Unteraufgabe hinzufügen',
  'card.check.done': 'Erledigt',
  'card.check.placeholder': 'Aufgabe schreiben…',
  'card.check.addTask': '+ Aufgabe hinzufügen',
  'card.check.proxy': 'Ausgewählte Aufgaben (zum Kopieren, Ausschneiden oder Einfügen)',

  // NoteBody.tsx
  'card.note.formatLabel': 'Format der Notiz',
  'card.note.title': 'Überschrift',
  'card.note.bold': 'Fett (⌘B)',
  'card.note.italic': 'Kursiv (⌘I)',
  'card.note.strike': 'Durchgestrichen',
  'card.note.code': 'Code',
  'card.note.list': 'Liste',
  'card.note.task': 'Aufgaben-Kästchen',
  'card.note.quote': 'Zitat',
  'card.note.link': 'Link',
  'card.note.wikiLink': 'Link zu einer anderen Hauptaufgabe',
  'card.note.content': 'Inhalt der Notiz',
  'card.note.empty': 'Leere Notiz. Zum Schreiben klicken.',
  'card.note.urlLabel': 'Link-Adresse',
  'card.note.linkTo': 'Verlinken mit…',
  'card.note.searchPh': 'Hauptaufgabe oder Karte suchen…',
  'card.note.searchLabel': 'Hauptaufgabe oder Karte suchen',
  'card.note.includeCards': 'Karten einbeziehen',
  'card.note.noMatch': 'Keine Treffer.',
  'card.note.noMatchQ': 'Keine Treffer für „{q}“.',
  'card.note.linkWith': 'Verlinken mit',
  'card.note.dailyLabel': 'Tagebuch',

  // ImageBody.tsx
  'card.image.fallback': 'Bild',
  'card.image.label': 'Bild',
  'card.image.paletteTitle': 'Palette · {name}',
  'card.image.linkLabel': 'Palette',
  'card.image.paletteMade.one': 'Palette mit {n} Farbe erstellt',
  'card.image.paletteMade.other': 'Palette mit {n} Farben erstellt',
  'card.image.drop': 'Bild hierher ziehen oder klicken, um eines auszuwählen',
  'card.image.reading': 'Farben werden gelesen…',
  'card.image.extract': 'Palette extrahieren',
  'card.image.change': 'Ändern',

  // PaletteBody.tsx
  'card.palette.copiedAll': 'Palette kopiert',
  'card.palette.copyAll': 'Alle kopieren',
  'card.palette.clickCopy': 'Zum Kopieren klicken',
  'card.palette.copied': '{color} kopiert',
  'card.palette.change': 'Farbe ändern',
  'card.palette.remove': 'Farbe entfernen',
  'card.palette.add': 'Farbe hinzufügen',
  'card.palette.from': 'Extrahiert aus „{name}“',

  // SketchBody.tsx
  'card.sketch.thin': 'Dünn',
  'card.sketch.medium': 'Mittel',
  'card.sketch.thick': 'Dick',
  'card.sketch.pen': 'Bleistift',
  'card.sketch.marker': 'Marker',
  'card.sketch.eraser': 'Radierer',
  'card.sketch.color': 'Farbe {color}',
  'card.sketch.hint': 'Hier mit Maus oder Stift zeichnen',
  'card.sketch.undo': '↶ Strich rückgängig',
  'card.sketch.confirm': 'Zeichnung löschen?',
  'card.sketch.no': 'Nein',
  'card.sketch.erase': 'Löschen',
  'card.sketch.eraseAll': 'Alles löschen',

  // lib/images.ts
  'card.img.notImage': 'Diese Datei ist kein Bild.',
  'card.img.readFail': 'Das Bild konnte nicht gelesen werden.',
  'card.img.colorsFail': 'Die Farben dieses Bildes konnten nicht gelesen werden.',
  'card.img.openFail': 'Das Bild konnte nicht geöffnet werden.',

  // lib/markdown.tsx
  'card.md.goTo': 'Gehe zu {dest}',
  'card.md.missing': 'Existiert nicht: {dest}',
};
