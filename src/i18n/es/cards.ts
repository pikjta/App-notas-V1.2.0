// Tarjetas del tablero (checklist, nota, imagen, paleta, boceto) y sus utilidades. Claves con prefijo «card.».
export const cards = {
  'card.cancel': 'Cancelar',

  // CheckBody.tsx
  'card.check.formatLabel': 'Formato de las tareas',
  'card.check.progress': '{done} de {total} hechas',
  'card.check.expand': 'Desplegar subtareas',
  'card.check.collapse': 'Plegar subtareas',
  'card.check.addSub': 'Añadir subtarea',
  'card.check.done': 'Hecha',
  'card.check.placeholder': 'Escribe una tarea…',
  'card.check.addTask': '+ Añadir tarea',
  'card.check.proxy': 'Tareas seleccionadas (para copiar, cortar o pegar)',

  // NoteBody.tsx
  'card.note.formatLabel': 'Formato de la nota',
  'card.note.title': 'Título',
  'card.note.bold': 'Negrita (⌘B)',
  'card.note.italic': 'Cursiva (⌘I)',
  'card.note.strike': 'Tachado',
  'card.note.code': 'Código',
  'card.note.list': 'Lista',
  'card.note.task': 'Casilla de tarea',
  'card.note.quote': 'Cita',
  'card.note.link': 'Enlace',
  'card.note.wikiLink': 'Enlace a otra tarea principal',
  'card.note.content': 'Contenido de la nota',
  'card.note.empty': 'Nota vacía. Haz clic para escribir.',
  'card.note.urlLabel': 'Dirección del enlace',
  'card.note.linkTo': 'Enlazar a…',
  'card.note.searchPh': 'Buscar tarea principal o tarjeta…',
  'card.note.searchLabel': 'Buscar tarea principal o tarjeta',
  'card.note.includeCards': 'Incluir tarjetas',
  'card.note.noMatch': 'Nada coincide.',
  'card.note.noMatchQ': 'Nada coincide con «{q}».',
  'card.note.linkWith': 'Enlazar con',
  'card.note.dailyLabel': 'diario',

  // ImageBody.tsx
  'card.image.fallback': 'imagen',
  'card.image.label': 'Imagen',
  'card.image.paletteTitle': 'Paleta · {name}',
  'card.image.linkLabel': 'paleta',
  'card.image.paletteMade.one': 'Paleta de 1 color creada',
  'card.image.paletteMade.other': 'Paleta de {n} colores creada',
  'card.image.drop': 'Suelta una imagen aquí o haz clic para elegirla',
  'card.image.reading': 'Leyendo colores…',
  'card.image.extract': 'Extraer paleta',
  'card.image.change': 'Cambiar',

  // PaletteBody.tsx
  'card.palette.copiedAll': 'Paleta copiada',
  'card.palette.copyAll': 'Copiar todos',
  'card.palette.clickCopy': 'Clic para copiar',
  'card.palette.copied': 'Copiado {color}',
  'card.palette.change': 'Cambiar color',
  'card.palette.remove': 'Quitar color',
  'card.palette.add': 'Añadir color',
  'card.palette.from': 'Extraída de «{name}»',

  // SketchBody.tsx
  'card.sketch.thin': 'Fino',
  'card.sketch.medium': 'Medio',
  'card.sketch.thick': 'Grueso',
  'card.sketch.pen': 'Lápiz',
  'card.sketch.marker': 'Rotulador',
  'card.sketch.eraser': 'Borrador',
  'card.sketch.color': 'Color {color}',
  'card.sketch.hint': 'Dibuja aquí con el ratón o el lápiz',
  'card.sketch.undo': '↶ Deshacer trazo',
  'card.sketch.confirm': '¿Borrar el dibujo?',
  'card.sketch.no': 'No',
  'card.sketch.erase': 'Borrar',
  'card.sketch.eraseAll': 'Borrar todo',

  // lib/images.ts
  'card.img.notImage': 'Ese archivo no es una imagen.',
  'card.img.readFail': 'No se pudo leer la imagen.',
  'card.img.colorsFail': 'No se pudieron leer los colores de esta imagen.',
  'card.img.openFail': 'No se pudo abrir la imagen.',

  // lib/markdown.tsx
  'card.md.goTo': 'Ir a {dest}',
  'card.md.missing': 'No existe: {dest}',
} as const;
