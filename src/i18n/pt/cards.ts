import type { Part } from '../es/index';
import type { cards as Es } from '../es/cards';

export const cards: Part<typeof Es> = {
  'card.cancel': 'Cancelar',

  // CheckBody.tsx
  'card.check.formatLabel': 'Formato das tarefas',
  'card.check.progress': '{done} de {total} concluídas',
  'card.check.expand': 'Expandir subtarefas',
  'card.check.collapse': 'Recolher subtarefas',
  'card.check.addSub': 'Adicionar subtarefa',
  'card.check.done': 'Concluída',
  'card.check.placeholder': 'Escrever uma tarefa…',
  'card.check.addTask': '+ Adicionar tarefa',
  'card.check.proxy': 'Tarefas selecionadas (para copiar, cortar ou colar)',

  // NoteBody.tsx
  'card.note.formatLabel': 'Formato da nota',
  'card.note.title': 'Título',
  'card.note.bold': 'Negrito (⌘B)',
  'card.note.italic': 'Itálico (⌘I)',
  'card.note.strike': 'Riscado',
  'card.note.code': 'Código',
  'card.note.list': 'Lista',
  'card.note.task': 'Caixa de tarefa',
  'card.note.quote': 'Citação',
  'card.note.link': 'Ligação',
  'card.note.wikiLink': 'Ligação a outra tarefa principal',
  'card.note.content': 'Conteúdo da nota',
  'card.note.empty': 'Nota vazia. Clicar para escrever.',
  'card.note.urlLabel': 'Endereço da ligação',
  'card.note.linkTo': 'Ligar a…',
  'card.note.searchPh': 'Procurar tarefa principal ou cartão…',
  'card.note.searchLabel': 'Procurar tarefa principal ou cartão',
  'card.note.includeCards': 'Incluir cartões',
  'card.note.noMatch': 'Sem resultados.',
  'card.note.noMatchQ': 'Sem resultados para «{q}».',
  'card.note.linkWith': 'Ligar com',
  'card.note.dailyLabel': 'diário',

  // ImageBody.tsx
  'card.image.fallback': 'imagem',
  'card.image.label': 'Imagem',
  'card.image.paletteTitle': 'Paleta · {name}',
  'card.image.linkLabel': 'paleta',
  'card.image.paletteMade.one': 'Paleta de {n} cor criada',
  'card.image.paletteMade.other': 'Paleta de {n} cores criada',
  'card.image.drop': 'Soltar uma imagem aqui ou clicar para a escolher',
  'card.image.reading': 'A ler as cores…',
  'card.image.extract': 'Extrair paleta',
  'card.image.change': 'Alterar',

  // PaletteBody.tsx
  'card.palette.copiedAll': 'Paleta copiada',
  'card.palette.copyAll': 'Copiar todas',
  'card.palette.clickCopy': 'Clicar para copiar',
  'card.palette.copied': '{color} copiada',
  'card.palette.change': 'Alterar cor',
  'card.palette.remove': 'Remover cor',
  'card.palette.add': 'Adicionar cor',
  'card.palette.from': 'Extraída de «{name}»',

  // SketchBody.tsx
  'card.sketch.thin': 'Fino',
  'card.sketch.medium': 'Médio',
  'card.sketch.thick': 'Grosso',
  'card.sketch.pen': 'Lápis',
  'card.sketch.marker': 'Marcador',
  'card.sketch.eraser': 'Borracha',
  'card.sketch.color': 'Cor {color}',
  'card.sketch.hint': 'Desenhar aqui com o rato ou a caneta',
  'card.sketch.undo': '↶ Anular traço',
  'card.sketch.confirm': 'Apagar o desenho?',
  'card.sketch.no': 'Não',
  'card.sketch.erase': 'Apagar',
  'card.sketch.eraseAll': 'Apagar tudo',

  // lib/images.ts
  'card.img.notImage': 'Esse ficheiro não é uma imagem.',
  'card.img.readFail': 'Não foi possível ler a imagem.',
  'card.img.colorsFail': 'Não foi possível ler as cores desta imagem.',
  'card.img.openFail': 'Não foi possível abrir a imagem.',

  // lib/markdown.tsx
  'card.md.goTo': 'Ir para {dest}',
  'card.md.missing': 'Não existe: {dest}',
};
