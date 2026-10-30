import type { Part } from '../es/index';
import type { cards as Es } from '../es/cards';

export const cards: Part<typeof Es> = {
  'card.cancel': 'Annuler',

  // CheckBody.tsx
  'card.check.formatLabel': 'Format des tâches',
  'card.check.progress': '{done} sur {total} terminées',
  'card.check.expand': 'Déplier les sous-tâches',
  'card.check.collapse': 'Replier les sous-tâches',
  'card.check.addSub': 'Ajouter une sous-tâche',
  'card.check.done': 'Terminée',
  'card.check.placeholder': 'Écrivez une tâche…',
  'card.check.addTask': '+ Ajouter une tâche',
  'card.check.proxy': 'Tâches sélectionnées (pour copier, couper ou coller)',

  // NoteBody.tsx
  'card.note.formatLabel': 'Format de la note',
  'card.note.title': 'Titre',
  'card.note.bold': 'Gras (⌘B)',
  'card.note.italic': 'Italique (⌘I)',
  'card.note.strike': 'Barré',
  'card.note.code': 'Code',
  'card.note.list': 'Liste',
  'card.note.task': 'Case de tâche',
  'card.note.quote': 'Citation',
  'card.note.link': 'Lien',
  'card.note.wikiLink': 'Lien vers une autre tâche principale',
  'card.note.content': 'Contenu de la note',
  'card.note.empty': 'Note vide. Cliquez pour écrire.',
  'card.note.urlLabel': 'Adresse du lien',
  'card.note.linkTo': 'Lier à…',
  'card.note.searchPh': 'Rechercher une tâche principale ou une carte…',
  'card.note.searchLabel': 'Rechercher une tâche principale ou une carte',
  'card.note.includeCards': 'Inclure les cartes',
  'card.note.noMatch': 'Aucun résultat.',
  'card.note.noMatchQ': 'Aucun résultat pour « {q} ».',
  'card.note.linkWith': 'Lier avec',
  'card.note.dailyLabel': 'journal',

  // ImageBody.tsx
  'card.image.fallback': 'image',
  'card.image.label': 'Image',
  'card.image.paletteTitle': 'Palette · {name}',
  'card.image.linkLabel': 'palette',
  'card.image.paletteMade.one': 'Palette de {n} couleur créée',
  'card.image.paletteMade.other': 'Palette de {n} couleurs créée',
  'card.image.drop': 'Déposez une image ici ou cliquez pour la choisir',
  'card.image.reading': 'Lecture des couleurs…',
  'card.image.extract': 'Extraire la palette',
  'card.image.change': 'Changer',

  // PaletteBody.tsx
  'card.palette.copiedAll': 'Palette copiée',
  'card.palette.copyAll': 'Tout copier',
  'card.palette.clickCopy': 'Cliquer pour copier',
  'card.palette.copied': '{color} copié',
  'card.palette.change': 'Changer la couleur',
  'card.palette.remove': 'Retirer la couleur',
  'card.palette.add': 'Ajouter une couleur',
  'card.palette.from': 'Extraite de « {name} »',

  // SketchBody.tsx
  'card.sketch.thin': 'Fin',
  'card.sketch.medium': 'Moyen',
  'card.sketch.thick': 'Épais',
  'card.sketch.pen': 'Crayon',
  'card.sketch.marker': 'Feutre',
  'card.sketch.eraser': 'Gomme',
  'card.sketch.color': 'Couleur {color}',
  'card.sketch.hint': 'Dessinez ici avec la souris ou le stylet',
  'card.sketch.undo': '↶ Annuler le trait',
  'card.sketch.confirm': 'Effacer le dessin ?',
  'card.sketch.no': 'Non',
  'card.sketch.erase': 'Effacer',
  'card.sketch.eraseAll': 'Tout effacer',

  // lib/images.ts
  'card.img.notImage': 'Ce fichier n’est pas une image.',
  'card.img.readFail': 'Impossible de lire l’image.',
  'card.img.colorsFail': 'Impossible de lire les couleurs de cette image.',
  'card.img.openFail': 'Impossible d’ouvrir l’image.',

  // lib/markdown.tsx
  'card.md.goTo': 'Aller à {dest}',
  'card.md.missing': 'N’existe pas : {dest}',
};
