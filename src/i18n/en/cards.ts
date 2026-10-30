import type { Part } from '../es/index';
import type { cards as Es } from '../es/cards';

export const cards: Part<typeof Es> = {
  'card.cancel': 'Cancel',

  // CheckBody.tsx
  'card.check.formatLabel': 'Task formatting',
  'card.check.progress': '{done} of {total} done',
  'card.check.expand': 'Expand subtasks',
  'card.check.collapse': 'Collapse subtasks',
  'card.check.addSub': 'Add subtask',
  'card.check.done': 'Done',
  'card.check.placeholder': 'Write a task…',
  'card.check.addTask': '+ Add task',
  'card.check.proxy': 'Selected tasks (to copy, cut or paste)',

  // NoteBody.tsx
  'card.note.formatLabel': 'Note formatting',
  'card.note.title': 'Heading',
  'card.note.bold': 'Bold (⌘B)',
  'card.note.italic': 'Italic (⌘I)',
  'card.note.strike': 'Strikethrough',
  'card.note.code': 'Code',
  'card.note.list': 'List',
  'card.note.task': 'Task checkbox',
  'card.note.quote': 'Quote',
  'card.note.link': 'Link',
  'card.note.wikiLink': 'Link to another main task',
  'card.note.content': 'Note content',
  'card.note.empty': 'Empty note. Click to write.',
  'card.note.urlLabel': 'Link address',
  'card.note.linkTo': 'Link to…',
  'card.note.searchPh': 'Search main task or card…',
  'card.note.searchLabel': 'Search main task or card',
  'card.note.includeCards': 'Include cards',
  'card.note.noMatch': 'No matches.',
  'card.note.noMatchQ': 'No matches for “{q}”.',
  'card.note.linkWith': 'Link with',
  'card.note.dailyLabel': 'journal',

  // ImageBody.tsx
  'card.image.fallback': 'image',
  'card.image.label': 'Image',
  'card.image.paletteTitle': 'Palette · {name}',
  'card.image.linkLabel': 'palette',
  'card.image.paletteMade.one': 'Palette of {n} colour created',
  'card.image.paletteMade.other': 'Palette of {n} colours created',
  'card.image.drop': 'Drop an image here or click to choose one',
  'card.image.reading': 'Reading colours…',
  'card.image.extract': 'Extract palette',
  'card.image.change': 'Change',

  // PaletteBody.tsx
  'card.palette.copiedAll': 'Palette copied',
  'card.palette.copyAll': 'Copy all',
  'card.palette.clickCopy': 'Click to copy',
  'card.palette.copied': 'Copied {color}',
  'card.palette.change': 'Change colour',
  'card.palette.remove': 'Remove colour',
  'card.palette.add': 'Add colour',
  'card.palette.from': 'Extracted from “{name}”',

  // SketchBody.tsx
  'card.sketch.thin': 'Thin',
  'card.sketch.medium': 'Medium',
  'card.sketch.thick': 'Thick',
  'card.sketch.pen': 'Pencil',
  'card.sketch.marker': 'Marker',
  'card.sketch.eraser': 'Eraser',
  'card.sketch.color': 'Colour {color}',
  'card.sketch.hint': 'Draw here with the mouse or pen',
  'card.sketch.undo': '↶ Undo stroke',
  'card.sketch.confirm': 'Erase the drawing?',
  'card.sketch.no': 'No',
  'card.sketch.erase': 'Erase',
  'card.sketch.eraseAll': 'Erase all',

  // lib/images.ts
  'card.img.notImage': 'That file is not an image.',
  'card.img.readFail': 'The image could not be read.',
  'card.img.colorsFail': 'The colours of this image could not be read.',
  'card.img.openFail': 'The image could not be opened.',

  // lib/markdown.tsx
  'card.md.goTo': 'Go to {dest}',
  'card.md.missing': 'Does not exist: {dest}',
};
