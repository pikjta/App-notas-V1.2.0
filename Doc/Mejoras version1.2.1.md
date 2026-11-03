# Mejoras versión 1.2.1

Continuación de `Mejoras version1.2.0.md`. Carpeta de trabajo: `Version 1.2.1` (la 1.2.0 queda intacta). Los bugs y mejoras de partida están en `Doc/bugs/`.

## 1. Número de versión 1.2.1
- Cambiado en `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` y `Cargo.lock` (paquete `cuaderno`).
- No se tocó nada de lo que afecta a los datos (identificador `app.cuaderno.desktop`, `cuaderno.db`, etc.).

## Bug 1 · Tabla PM: cabecera desfasada respecto a las filas — hecho (pendiente de probar)

### Qué se pidió
(`Doc/bugs/bug tabla PM.jpg`) En la Tabla PM la cabecera de columnas no coincide con las celdas: «Tarea» aparece desplazada a la derecha y tapa la primera letra de «Estado».

### Causa
La regla `.pm-grid th[data-letter] { position: relative; }` (añadida con las letras A, B, C de las columnas) pisaba el `position: sticky` de la cabecera. La primera columna lleva `left: 44px` (ancho del asa de fila), que con `relative` desplaza la celda 44 px a la derecha y la monta sobre la siguiente. Además, la cabecera dejaba de quedarse fija al bajar.

### Qué se hizo
- `src/styles/app.css`: eliminada esa regla. El `::before` con la letra sigue anclado porque `sticky` ya es un contenedor de posición.

### Cómo se comprobó
- Sin ejecutar: en Ubuntu aún no hay `node` ni `cargo` instalados. Pendiente: `npm run tauri dev` → Tabla PM → comprobar alineación de cabecera y filas, y que la cabecera queda fija al bajar y la primera columna al desplazar a la derecha.

## Mejora 1 · Cabecera fija en las secciones — hecha (pendiente de probar)

### Qué se pidió
(`Doc/bugs/Mejora visual secciones.jpg`) Que la parte alta de cada sección (título, indicadores y botones) quede fija al bajar con la rueda del ratón, para ver siempre el título de la sección. Secciones indicadas: tarea de la barra lateral, página de inicio (Mi espacio), Hoy y Recordatorios.

### Qué se hizo
- `src/styles/app.css`: `.board-head` pasa a `position: sticky; top: 0` con `z-index: 9000` y el color de fondo del tablero. Se compensa con márgenes negativos y relleno para que quede a sangre en la parte alta y el diseño no se mueva.
- Como las cuatro secciones usan `.board-head`, la regla también afecta a Diario, Grafo y Papelera, que comparten ese encabezado.
- El texto de ayuda «Arrastra por la franja superior…» del tablero queda fuera de la parte fija (sigue desplazándose con el contenido).
- El fondo de la parte fija es el color liso del ambiente; no repite la textura (puntos, cuadrícula…) para evitar saltos.

### Cómo se comprobó
- Sin ejecutar (mismo motivo). Pendiente probar en todos los ambientes y con tarjetas arrastradas por debajo de la cabecera.
