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

## Bug 2 · Cabecera fija: el contenido se veía por encima de la banda — hecho (pendiente de probar)

### Qué se pidió
(`Doc/bugs/superposicion.jpg`) Con la cabecera fija de la Mejora 1, en la sección Inicio la banda «Inicio · 0 % · Sin tareas» quedaba a unos 32 px del borde superior y por encima se veían las tarjetas desplazándose.

### Causa
Error introducido por la Mejora 1. El tablero (`.board`) tenía 32 px de relleno superior y en el webview (WebKit) lo «sticky» se pega al borde interior de ese relleno, no al borde de la ventana. El margen negativo que puse no compensaba eso.

### Qué se hizo
- `src/styles/app.css`: `.board` pasa de `padding: 32px 40px 60px` a `padding: 0 40px 60px`; los 32 px de arriba los aporta ahora el relleno de `.board-head` (sin margen negativo), de modo que la banda queda pegada al borde superior y el diseño se ve igual.
- Regla nueva `.board > :first-child:not(.board-head) { margin-top: 32px; }` para que los tableros sin cabecera (p. ej. Calendario) conserven su espacio superior.

### Cómo se comprobó
- Sin ejecutar (no se compila ni se ejecuta nada en este equipo). Pendiente probar en Inicio, una tarea, Hoy, Recordatorios, Diario, Papelera y Calendario, con y sin desplazamiento.

## Bug 3 · «Cuaderno» e «Inicio» en español con la interfaz en otro idioma — hecho (pendiente de probar)

### Qué se pidió
(`Doc/bugs/bug de idioma.jpg`) Con la interfaz en francés, la barra lateral mostraba «Cuaderno» (debería ser OMNIA) y el título del tablero de inicio salía «Inicio».

### Causa
La interfaz estaba bien en francés. Lo que salía en español eran datos guardados en la base de una instalación anterior: el nombre de sesión «Cuaderno» y el nombre del proyecto de inicio, que se escriben una sola vez al crear el cuaderno y no siguen al idioma. Es la decisión que quedó abierta en la 1.2.0 (migrar «Cuaderno» → «OMNIA»), ahora aprobada.

### Qué se hizo
- **Migración de nombre (`src/lib/model.ts`, `fromDocs`)**: al cargar, si la configuración no tiene `nameV` (campo nuevo, versión de la migración) el nombre de sesión «Cuaderno» pasa a «OMNIA» y el calendario principal («cal-main») también, solo si su nombre es exactamente «Cuaderno». Después la configuración lleva `nameV: 1`, así que si el usuario vuelve a poner «Cuaderno» a propósito ya no se cambia. Un nombre propio nunca se toca. Se guarda al siguiente cambio de ajustes.
- **Nombre del tablero de Inicio**: función nueva `projectName()` en `model.ts`. Si el proyecto de inicio conserva el nombre de ejemplo de cualquier idioma («Inicio», «Home», «Accueil», «Start», «Início», «Mi espacio», «My space»…) se muestra en el idioma actual. No modifica los datos guardados y un nombre propio se respeta. Usado en el título del tablero (`Board.tsx`) y en la papelera (`Trash.tsx`).
- **No se tradujeron** las notas de ejemplo (p. ej. «Bienvenida»): son texto del usuario y pueden estar editadas.
- Prueba nueva: `src/__tests__/names121.test.ts`.
- No se tocó ningún identificador, archivo, prefijo ni constante de cifrado.

### Cómo se comprobó
- Sin ejecutar nada (no se compila ni se ejecuta en este equipo): `tsc`, Vitest y la app están pendientes. Pendiente comprobar con una base antigua en español y la interfaz en francés.

## Documentación · Desinstalar y borrar rastros (README) — hecha

### Qué se pidió
Saber cómo eliminar todo rastro de la app instalada. En Ubuntu, la carpeta `~/.local/share/app.cuaderno.desktop/` contenía, además de `cuaderno.db` (`-shm`, `-wal`), archivos del motor web: `localstorage`, `mediakeys`, `hsts-storage.sqlite` y otros.

### Qué se hizo
- `README.md`, apartado «Desinstalar y borrar tus datos»: añadido un párrafo que explica qué hay en esa carpeta (datos de OMNIA y archivos propios de WebKitGTK), que «Borrar todos los datos» no elimina estos últimos y cómo dejar la carpeta limpia (borrarla entera con la app cerrada, con la advertencia de comprobar la ruta). Menciona los posibles restos de caché en `~/.cache/` y `~/.config/` y cómo buscarlos.
- Marcado como **sin verificar** en Windows y macOS, donde los archivos del motor web tienen otros nombres.
- No se cambió ningún código: «Borrar todos los datos» sigue igual.

## Documentación · Actualizar sin perder datos ni dejar rastros — hecha

### Qué se pidió
Cómo reinstalar una versión nueva en Ubuntu, macOS y Windows sin dejar rastros de la antigua pero conservando los datos. Se aclaró que los «rastros» son los archivos del motor web (caché, `localstorage`…).

### Qué se hizo
- Esos archivos viven en la misma carpeta que los datos (`app.cuaderno.desktop`), así que no se pueden separar sin tocar código; además son inofensivos (`localStorage` solo guarda el último idioma, `src/i18n/index.ts`). Se documentó que **no hace falta borrarlos** al actualizar.
- `RELEASING.md`: apartado nuevo «Actualizar a una versión nueva conservando los datos» (copia de seguridad, desinstalar la antigua, casilla de Windows, qué no borrar y cómo limpiar solo los archivos del motor web).
- `README.md`: resumen del procedimiento con remisión a `RELEASING.md`.
- Sin cambios de código ni de configuración de Tauri. Sigue **sin verificar** que el instalador nuevo reemplace al antiguo tras el cambio de nombre del producto (Cuaderno → OMNIA) y los nombres de los archivos del motor web en Windows y macOS.

## Mejora 2 · Copiar y pegar tarjetas — hecha (pendiente de probar)

### Qué se pidió
Poder copiar y pegar tarjetas: se seleccionan con un clic en la parte superior de la tarjeta (entre el nombre y la paleta de color) y se pegan en cualquier otra parte de la app. Tras copiar, una animación pequeña y breve que diga «tarea copiada».

### Qué se hizo
- **Selección** (`src/components/Board.tsx`): un clic en la franja superior de la tarjeta (`.card-head`, sin contar sus botones) la selecciona, con un borde del color de acento (`.card.selected`, en `app.css`). Un clic en cualquier otro sitio, otro tablero o Esc la deselecciona.
- **Copiar**: Ctrl/⌘+C con una tarjeta seleccionada. **Pegar**: Ctrl/⌘+V en el tablero abierto (Inicio u otra tarea principal; cualquier proyecto, aunque no sea el de origen). La copia nueva queda debajo de las demás, con un identificador propio, y se selecciona y se desplaza a la vista (mismo efecto de resalte que la búsqueda). Se puede pegar varias veces.
- **Portapapeles interno** (`src/lib/cardClip.ts`, nuevo): guarda una foto de la tarjeta en memoria al copiar (editar o borrar el original después no cambia lo pegado). No usa el portapapeles del sistema y se pierde al cerrar la app.
- **Acción `pasteCard`** (`src/lib/store.ts`): crea la tarjeta y **duplica sus imágenes** (tarjeta de imagen y celdas de una Tabla PM) con identificadores nuevos, para que copia y original no compartan archivos. Entra en el historial de deshacer. No pega en un tablero en la papelera.
- **Animación**: sobre la tarjeta copiada aparece una pastilla «Tarjeta copiada» que sube, se mantiene y se desvanece en ~1,2 s (`.copied-pop`, `role="status"`). Respeta «reducir movimiento» de los ajustes.
- **Textos** `ui.board.cardCopied` y `ui.board.cardNoCopy` en los 6 idiomas.
- **No se copian**: widgets (solo viven en Inicio) ni notas de un día del Diario (pertenecen a su fecha); sale «Esta tarjeta no se puede copiar». Las flechas entre tarjetas no se copian.
- **Conflictos evitados**: dentro de un campo de texto, de una tarjeta o con una ventana abierta no se interceptan Ctrl+C / Ctrl+V (siguen valiendo el copiar y pegar de la checklist y de las tablas).
- Documentado en «Funciones de la maqueta» (apartado 16, atajos) y en la tabla de atajos del README.
- Pruebas nuevas: `src/__tests__/cardcopy121.test.ts` (pegar en otro tablero, foto del momento, imágenes duplicadas, no copiables y tablero en la papelera).

### Decisiones y puntos a confirmar
- **Texto del aviso:** se pidió «tarea copiada»; se usó **«Tarjeta copiada»** porque lo que se copia es una tarjeta (las «tareas» de la app son los proyectos). Si se prefiere el texto literal, es cambiar una clave por idioma.
- La zona de selección es toda la franja superior de la tarjeta (incluye el asa y la etiqueta del tipo), no solo el hueco entre el nombre y la paleta.
- Las flechas, los enlaces `[[ ]]` y las relaciones de una Tabla PM con otras tablas se copian tal cual (los identificadores de otras tarjetas no se cambian).

### Cómo se comprobó
- Sin ejecutar nada en este equipo: `tsc`, Vitest y la app están pendientes. Probar: seleccionar con clic en la franja, Ctrl+C y ver la animación; Ctrl+V en el mismo tablero, en otro y en Inicio; tarjeta de imagen y Tabla PM con imágenes; que Ctrl+C dentro de una checklist o tabla siga funcionando; deshacer tras pegar.
