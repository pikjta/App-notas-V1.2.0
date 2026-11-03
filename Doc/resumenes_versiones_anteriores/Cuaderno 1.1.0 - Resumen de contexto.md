# Cuaderno 1.1.0 · Resumen de contexto

## Contexto del proyecto

Estoy desarrollando **Cuaderno 1.1.0**, una app de notas hecha con Tauri 2, React/TypeScript y SQLite. La carpeta del proyecto es `C:\Users\diego.sierra\Documents\Varios\Notas-App\Version 1.1.0`. Los documentos de referencia están en `Doc/`: Spec global, Funciones de la maqueta, Plan de implementación y Mejoras version1.1.0.

## Reglas de trabajo

- Respuestas cortas y en español.
- Fidelidad estricta a `Doc/` y al README. Si algo difiere, preguntar antes.
- Las pruebas y el build se ejecutan en la nube: `npx tsc --noEmit`, `npx vitest run` y `npx vite build`.
- No instalar dependencias en mi PC.
- `src-tauri` no se puede compilar en la nube, así que eso lo pruebo yo con `npm run tauri dev`.
- No implementar las "mejoras continuadas": traducciones, festivos, seguridad extra, instaladores firmados y actualizaciones automáticas.
- Cada mejora se registra en `Doc/Mejoras version1.1.0.md`, y las funciones nuevas también en `Doc/Cuaderno · Funciones de la maqueta.md`.

## Estado: las 6 fases del plan están implementadas y guardadas en la carpeta

Pasan `tsc`, 189 pruebas de Vitest y `vite build`.

1. **Fase 1.**
   - Papelera bajo Diario.
   - Vista previa de la Tabla PM con 3 columnas y su fila de cabecera.
   - Mejoras en la Checklist: texto que se parte en líneas, ↑/↓ entre tareas, selección con ratón o Mayús, copiar/cortar/pegar como Markdown y subtareas hasta 5 niveles.
   - Selector de color libre de 680 px, con campos HSB y RGB con iconos. El icono del botón de color es configurable.
   - 5 estilos de iconos y 53 iconos configurables en la barra lateral.
2. **Fase 2.** Arrastrar columnas de la Tabla PM sin tirones, sin seleccionar texto y con una etiqueta con el nombre de la columna junto al cursor.
3. **Fase 3.** Tabla y Tabla PM como hoja de cálculo.
   - Un clic selecciona; doble clic, F2 o escribir editan.
   - Flechas, rangos con Mayús o arrastre, y Ctrl+A.
   - Copiar, cortar y pegar rangos en formato Excel (TSV), con autocompletado.
   - "Duplicar tabla" cierra la tabla en edición.
4. **Fase 4.** Fórmulas con referencias tipo Excel.
   - Referencias `B2`, rangos `B2:C9` y columnas `B:B`, usadas con `suma`, `promedio`, `contar`, `si`, `redondear` y otras, en español o en inglés.
   - Tarjeta Tabla: una celda que empieza por «=» es una fórmula, con una barra que muestra la celda activa. A1 es la cabecera.
   - Tabla PM: la referencia se guarda por id de fila y columna, no por posición, y se muestra con letras y números. Si se borra la celda aparece `#REF`. `{B}` es la columna B de la misma fila.
   - Los errores muestran «⚠ Error», y al hacer clic se abre una ventana que explica qué pasó y cómo arreglarlo.
5. **Fase 5.** Barra de formato por elemento (no Markdown, salvo la Nota). Tiene negrita, cursiva, subrayado, tachado, color de texto, resaltado, alineación en las tablas y «Quitar formato». Está en la Checklist, la Tabla, la Tabla PM y la Nota.
6. **Fase 6.**
   - Arrastrar tareas en la barra lateral, dentro de una carpeta y entre carpetas.
   - Alt+↑/↓ para subir y bajar la tarea seleccionada.
   - Icono propio por tarea (`Project.icon`).

## Decisiones mías que los documentos no cubrían

- El número de fila en la Tabla PM sigue el orden de los datos, no el de la vista.
- Al pegar en la Tabla, las referencias de fórmulas no se desplazan.
- Las fórmulas de la tarjeta Tabla no admiten `{Nombre}`.

## Pendiente

- Actualizar el README con los atajos nuevos: Alt+↑/↓ en la barra lateral, el teclado de la Tabla y las fórmulas. No se pudo hacer porque el equipo perdió la conexión.
- Probar todo en mi PC con `npm run tauri dev` y pasar los detalles que salgan. Lo que depende del webview real está sin verificar: arrastres, portapapeles, selector de color y barras de formato.

## Detalles técnicos útiles

- Código fuente en `src/`.
  - Motor de hoja de cálculo compartido: `lib/grid.ts`.
  - Formato: `lib/format.ts` y `components/FormatBar.tsx`.
  - Fórmulas: `lib/formula.ts`, `lib/tablecalc.ts` (Tabla) y `lib/pm.ts` (Tabla PM).
  - Ventana de error: `components/FormulaErrorDialog.tsx`.
  - Barra lateral: `components/Sidebar.tsx`.
  - Estado y deshacer: `lib/store.ts`.
- Teclado y portapapeles: las tablas y la Checklist usan un textarea oculto que mantiene el foco, para que Ctrl+C/X/V funcionen igual en todos los webviews.
- Pruebas con jsdom: no tiene `PointerEvent`, así que los tests usan `new MouseEvent('pointerdown', …)`.

