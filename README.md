# Cuaderno

**Agenda, tableros de notas y gestor de proyectos en tu ordenador. Sin cuentas, sin servidor y con cifrado opcional.**

![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-núcleo-000000?logo=rust&logoColor=white)
![Plataformas](https://img.shields.io/badge/macOS%20·%20Windows%20·%20Linux-lightgrey)
![Licencia MIT](https://img.shields.io/badge/licencia-MIT-green)

Cuaderno reúne en una sola app lo que normalmente se reparte entre una agenda, un tablero de notas, un gestor de proyectos estilo Notion, un calendario y un diario de trabajo. Está pensada para quien lleva varios proyectos a la vez (por ejemplo, encargos artísticos o de ilustración) y quiere verlos de forma visual, planificarlos con detalle y tener los datos solo en su equipo.

> La interfaz está disponible en **español, inglés, francés, portugués, italiano y alemán**. En el primer arranque usa el idioma del sistema (inglés si no coincide ninguno) y se cambia en **Ajustes → General → Idioma**.

## Índice

- [Qué puedes hacer](#qué-puedes-hacer)
- [Privacidad y seguridad](#privacidad-y-seguridad)
- [Instalación](#instalación)
- [Para desarrolladores](#para-desarrolladores)
- [Cómo está organizado el código](#cómo-está-organizado-el-código)
- [Cómo se guardan los datos](#cómo-se-guardan-los-datos)
- [Atajos de teclado](#atajos-de-teclado)
- [Documentación del proyecto](#documentación-del-proyecto)
- [Estado y futuro](#estado-y-futuro)
- [Licencia](#licencia)

## Qué puedes hacer

**Organizar con tableros libres.** Cada tarea principal (proyecto) es un tablero donde las tarjetas se mueven, se redimensionan, se colorean y se unen con flechas. Hay nueve tipos de tarjeta: nota en Markdown, checklist con subtareas, recordatorio, tabla, imagen, boceto a mano, paleta de color extraída de una imagen, widget (en Inicio) y Tabla PM. Las tareas principales se agrupan en carpetas.

**Gestionar proyectos con la Tabla PM.** Columnas tipadas (texto, número, selección, estado con fases, progreso, fecha, cronómetro, fórmula, relación, resumen e imágenes), filtros, orden, agrupación y formato condicional. Se ve como Tabla, Kanban, Cronología (con dependencias e hitos), Calendario o Galería, y cada fila tiene su propia página con descripción en Markdown, subtareas e historial de estados. Se exporta a CSV, a Excel y a Markdown compatible con Obsidian.

**Planificar el tiempo.** Hoy, Recordatorios con avisos del sistema, Calendario (día, semana, mes y agenda, varios calendarios superpuestos, festivos por país e importación y exportación `.ics`) y un Diario con una nota por día.

**Conectarlo todo.** Los enlaces `[[ ]]` unen notas, tareas, tarjetas, filas y notas diarias, y la vista Grafo dibuja todas esas conexiones. Una búsqueda global (⌘K) encuentra cualquier texto de la app.

**No perder nada.** Deshacer y rehacer (100 pasos), papelera y tres tipos de copia de seguridad: automática, interna y manual.

**En tu idioma.** Seis idiomas completos: menús, avisos, fechas, números y plurales, datos de ejemplo y plantillas. Las fórmulas se pueden escribir con los nombres de función de cada idioma (`SUMA`, `SUM`, `SOMME`, `SOMA`, `SOMMA`, `SUMME`…).

**Hacerlo tuyo.** Ambientes, colores y texturas para la barra lateral, el tablero y las tarjetas, y tipografía propia para el nombre de la sesión y el título de cada tablero. Los iconos tienen cinco estilos (uno parecido a Notion) y cada tarjeta puede llevar cualquier color con un selector libre.

## Privacidad y seguridad

- **Todo es local.** No hay cuentas, servidor ni sincronización. Los festivos se calculan en el ordenador y los `.ics` se procesan sin conexión.
- **Cifrado opcional**, desactivado por defecto. Al activarlo, la base de datos completa se cifra con SQLCipher y la app pide la contraseña al abrirse. También se bloquea sola tras un rato sin uso.
- **Clave de datos aleatoria de 256 bits**, protegida de dos maneras:
  - con tu contraseña, mediante **Argon2id** (64 MiB de memoria, 3 pasadas, 4 hilos);
  - con **24 palabras de recuperación BIP-39** (lista oficial en español, sea cual sea el idioma de la interfaz), como en una billetera de criptomonedas.
- Cambiar la contraseña no obliga a volver a cifrar los datos. Al bloquear, la clave se borra de la memoria.
- Las **copias de seguridad** de un cuaderno cifrado también salen cifradas.
- La interfaz no puede leer archivos ni la base de datos directamente: solo llama a los comandos del núcleo en Rust. No usa recursos externos y aplica una política de seguridad de contenido (CSP) estricta.

**Límites:** si el ordenador ya está comprometido (por ejemplo, con un keylogger), nadie puede impedir que capturen la contraseña al escribirla. Si pierdes la contraseña y las 24 palabras, no hay forma de recuperar los datos cifrados.

## Instalación

Cuaderno aún no tiene instaladores publicados. Los instaladores **sin firmar** se generan con GitHub Actions:

1. Ve a la pestaña **Actions** del repositorio.
2. Elige el workflow de tu sistema (**Windows**, **Ubuntu** o **macOS**) y pulsa **Run workflow**.
3. Cuando termine, descarga el instalador desde **Artifacts**:

| Sistema | Archivos |
|---|---|
| Windows 10 y 11 | `.msi` y `.exe` |
| Linux (Ubuntu 22.04) | `.deb`, `.rpm` y `.AppImage` |
| macOS | `.dmg` para Apple Silicon y otro para Intel |

Como no están firmados, el sistema puede avisarte al abrirlos:

- **Windows:** aparece SmartScreen («Más información» → «Ejecutar de todas formas»).
- **macOS:** la app lleva una firma ad-hoc, sin cuenta de Apple. Si aun así aparece «La app está dañada y no se puede abrir», no está dañada: macOS bloquea lo descargado sin firma de Apple. Arrastra Cuaderno a Aplicaciones y ejecuta en Terminal `xattr -cr /Applications/Cuaderno.app`; después ábrela con normalidad.

También puedes compilar tú mismo, como se explica a continuación.

## Para desarrolladores

### Requisitos

| | macOS | Windows | Linux |
|---|---|---|---|
| Node.js 20 o superior | ✓ | ✓ | ✓ |
| [Rust](https://rustup.rs) estable | ✓ | ✓ | ✓ |
| Extra | Xcode Command Line Tools (`xcode-select --install`) | Microsoft C++ Build Tools, WebView2 (viene con Windows 11), **Perl y NASM** (el cifrado compila OpenSSL) | `sudo apt install libwebkit2gtk-4.1-dev librsvg2-dev patchelf build-essential` |

Guía oficial de requisitos de Tauri: https://v2.tauri.app/start/prerequisites/

### Empezar

```bash
npm install
npm run tauri dev      # abre la app de escritorio con recarga en caliente
```

La primera compilación de Rust tarda unos minutos; después es rápida. Un cuaderno nuevo se abre con datos de ejemplo (Mi espacio, varias tareas principales y un encargo completo con su Tabla PM).

### Comandos

```bash
npm test                      # pruebas de la interfaz (Vitest)
cargo test -p cuaderno-core   # pruebas del núcleo: base de datos, cifrado y copias
npm run tauri build           # instalador para tu sistema
npm run dev                   # solo la interfaz en el navegador (datos en memoria, sin cifrado)
```

## Cómo está organizado el código

```
crates/cuaderno-core/    Núcleo en Rust, sin Tauri: SQLite, cifrado y copias. Con pruebas.
  src/vault.rs           Argon2id, AES-256-GCM y 24 palabras BIP-39 en español
  src/store.rs           Documentos, bloqueo, activar o quitar el cifrado, copias
  src/autobackup.rs      Copias automáticas con rotación
crates/cuaderno-os/      Llavero del sistema (reservado; hoy sin usar)
src-tauri/               Capa de Tauri: expone el núcleo como comandos a la interfaz
.github/                 Workflows de instaladores (Windows, Ubuntu y macOS)
Doc/                     Documentos de referencia: spec, funciones, plan y registro de mejoras 1.1.0 y 1.2.0
src/                     Interfaz en React y TypeScript
  lib/                   Lógica pura y testeable
    model.ts, store.ts   Tipos de datos, estado (reductor) y cola de guardado
    backend.ts           Puente con el núcleo (Tauri) o en memoria (navegador y pruebas)
    markdown.tsx         Markdown a React sin innerHTML, con enlaces [[ ]]
    pm.ts, pmio.ts       Tabla PM: tipos, filtros, totales, CSV y plantillas
    formula.ts           Lenguaje de fórmulas: analizador y evaluador (sin eval)
    calendar.ts, ics.ts  Calendario y formato iCalendar
    graph.ts             Grafo: nodos, conexiones y colocación por fuerzas
  i18n/                  Idiomas: es/ (referencia) y en, fr, pt, it, de; t(), tn() y locale()
  components/            Tablero, tarjetas, papelera, búsqueda y apariencia
  views/                 Hoy, Recordatorios, Calendario, Diario, Grafo y Tabla PM
  screens/               Bloqueo y Ajustes
```

## Cómo se guardan los datos

- Un archivo SQLite (`cuaderno.db`) en la carpeta de datos de la app:
  - macOS: `~/Library/Application Support/app.cuaderno.desktop/`
  - Windows: `%APPDATA%\app.cuaderno.desktop\`
  - Linux: `~/.local/share/app.cuaderno.desktop/`
- Todo son **documentos** `{ id, kind, parent, pos, updated, data }` con `data` en JSON. Añadir un tipo nuevo de tarjeta no requiere cambiar la base de datos.
- Las imágenes se guardan como documentos aparte, dentro de la base de datos cifrada.
- La interfaz junta los cambios y los guarda en una sola transacción cada 250 ms.

### Idiomas

Cada idioma es un conjunto de archivos en `src/i18n/<idioma>/` (uno por área: `app`, `cards`, `settings`, `agenda`, `pm`, `calc` y `sample`) con las mismas claves que el español (`src/i18n/es/`), que es la referencia. En el código se escribe `t('clave')`, `tn('clave', n)` para plurales (`clave.one` / `clave.other`) y `locale()` para fechas y números. Una prueba (`npm test`) exige que todos los idiomas tengan todas las claves con las mismas `{variables}`, y otra detecta textos en español escritos a mano en el código.

Para **añadir un idioma**: crear `src/i18n/<id>/` copiando la estructura de `en/` y traduciendo cada archivo; registrarlo en `src/i18n/index.ts` (`DICTS` y `LOCALES`) y en `LANGUAGES` y el tipo `Language` de `src/lib/model.ts`; añadir sus alias de fórmulas en `ALIAS` de `src/lib/formula.ts`; y apuntar el idioma en la lista `COMPLETE` de `src/i18n/i18n.test.ts`. Los idiomas con más de dos formas de plural (como el ruso) pueden añadir `.few` y `.many` sin cambiar nada más.

### Copias de seguridad

Se configuran en **Ajustes → Backup**. La carpeta por defecto es Descargas, y puedes elegir otra (por ejemplo, una sincronizada o un disco externo). Dentro se crean tres subcarpetas:

| Subcarpeta | Para qué sirve |
|---|---|
| `backup automático` | Archivos periódicos (cada 4 h, 8 h, 12 h, día o semana); conserva los últimos N |
| `backup interno` | «Fotos rápidas» para deshacer errores; también se guardan dentro de la app |
| `backup manual` | Un archivo `.json` cuando tú decides |

Cada copia se escribe primero en un archivo temporal para que nunca quede a medias, y la app solo borra archivos con su propio prefijo.

## Atajos de teclado

| Atajo | Acción |
|---|---|
| ⌘K / Ctrl+K | Buscar en todo |
| ⌘Z / Ctrl+Z | Deshacer (fuera de los campos de texto) |
| ⇧⌘Z / Ctrl+Y | Rehacer |
| ⌘B, ⌘I | Negrita y cursiva en una nota |
| Enter, Tab, ⇧Tab | En una checklist: nueva tarea, sangrar, quitar sangría |
| Alt+↑ / Alt+↓ | Sube o baja la tarea seleccionada en la barra lateral |
| Flechas, ⇧+flechas, F2, Ctrl+A/C/X/V | En las tablas: moverse, seleccionar, editar y copiar/pegar como en Excel |
| `=` al inicio de una celda | Fórmula (`=SUMA(A2:A9)`, `=B2*C3`) en Tabla y Tabla PM |
| `[[` en una nota | Selector para enlazar una tarea principal o una tarjeta |

## Documentación del proyecto

La carpeta [`Doc/`](Doc) contiene los tres documentos que definen la app:

- **Spec global**: qué es Cuaderno, sus principios y sus áreas principales.
- **Funciones de la maqueta**: inventario completo de funciones, con sus textos y opciones.
- **Plan de implementación por etapas**: decisiones técnicas, etapas y registro de lo hecho.

## Estado y futuro

La versión **1.0.0** completó las nueve etapas del plan; la **1.1.0** añadió la hoja de cálculo en las tablas, las fórmulas con referencias, la barra de formato y mejoras en la barra lateral; la **1.2.0** traduce la interfaz a seis idiomas. Es una app de uso personal, por eso los instaladores van sin firma y se actualiza a mano.

Mejoras previstas que **no** están incluidas todavía:

- Festivos de más países.
- Seguridad extra: llavero del sistema con Touch ID o Windows Hello, bloqueo al minimizar y limpieza del portapapeles tras copiar las 24 palabras.
- Instaladores firmados y actualizaciones automáticas.

## Licencia

[MIT](LICENSE)
