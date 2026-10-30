// Red de seguridad: busca textos en español que se hayan quedado escritos a mano en el código
// (cadenas o texto JSX con letras propias del español) en vez de pasar por t()/tn().
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Todos los archivos del código (texto crudo, lo resuelve Vite): sin pruebas ni diccionarios.
const SOURCES = import.meta.glob<string>('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
const SKIP = /^\.\/|\/__tests__\/|\.test\./; // «./…» son los propios diccionarios (esta carpeta)
// Excepciones conocidas (dato interno, nombre propio, sintaxis o patrón de reconocimiento, no texto de la interfaz).
const ALLOW: RegExp[] = [
  /^(Español|Français|Português)$/, // nombres de idioma, cada uno en su propio idioma
  /^(ábaco|abeja|mural|pincel|barniz|paleta|sierra|aurora)$/, // palabras de ejemplo del modo navegador
  /backup automático|backup interno|backup manual/, // carpetas reales en disco
  /useApp fuera de/, // error de desarrollador
  /^(potência|nao|não|maiúscula|minúscula|évazio|máximo|mínimo|média|concaténer|gross|größe|länge|año|sí|sí)/i, // alias de fórmulas y unidades (nombres de función de cada idioma)
];

// Palabras españolas habituales en la interfaz que no llevan tilde (para no depender solo de las letras acentuadas).
const SPANISH_WORDS = /^(Guardar|Eliminar|Cancelar|Aceptar|Crear|Nuevo|Nueva|Sin |Hacer|Abrir|Cerrar|Editar|Copiar|Pegar|Buscar|Volver|Todos|Ninguno|Cambiar|Mover|Borrar|Duplicar|Importar|Exportar|Mostrar|Ocultar|Quitar|Elegir|Continuar|Siguiente|Anterior)\b/;

/** Textos escritos a mano en un archivo: cadenas, plantillas y texto JSX (ignora comentarios y expresiones regulares). */
function literals(file: string, code: string): { line: number; text: string }[] {
  const src = ts.createSourceFile(file, code, ts.ScriptTarget.ES2021, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { line: number; text: string }[] = [];
  const add = (n: ts.Node, text: string) => out.push({ line: src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1, text });
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n)) add(n, n.text);
    else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) add(n, n.text);
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

describe('textos en español sin traducir', () => {
  it('no queda texto en español escrito a mano fuera de los diccionarios', () => {
    const hits: string[] = [];
    for (const [f, code] of Object.entries(SOURCES)) {
      if (SKIP.test(f)) continue;
      for (const { line, text } of literals(f, code)) {
        if (!/[áéíóúñÁÉÍÓÚÑ¿¡]/.test(text) && !SPANISH_WORDS.test(text)) continue;
        if (ALLOW.some((r) => r.test(text))) continue;
        hits.push(`${f}:${line}: ${text.trim().replace(/\s+/g, ' ').slice(0, 120)}`);
      }
    }
    expect(hits, hits.join('\n')).toEqual([]);
  });
});
