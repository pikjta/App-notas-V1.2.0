# Cuaderno · Mejoras de la versión 1.2.0

Registro de cada mejora: qué se pidió, qué se hizo y cómo se comprobó.

## 1. Número de versión 1.2.0

- **Qué se pidió:** poner la aplicación en la versión 1.2.0 (estaba en 1.0.0).
- **Qué se hizo:** `version` cambiada a `1.2.0` en `package.json`, `package-lock.json` (2 sitios), `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` y la entrada `cuaderno` de `Cargo.lock`.
- **Cómo se comprobó:** revisión de los valores con `grep`. Pendiente: confirmar con `npm run tauri dev` que `src-tauri` compila.

## 2. Idiomas (español, English, Français, Português, Italiano, Deutsch)

- **Qué se pidió:** que la app esté disponible en 6 idiomas. Traduce Claude y revisa Diego cada idioma. Idioma inicial: el del sistema (inglés si no coincide ninguno). Se traducen también los datos de ejemplo y las plantillas. Esta mejora sale de «Mejoras continuadas» del spec.
- **Decisiones:** sistema propio sin dependencias (`src/i18n/`); el español es el idioma de referencia y TypeScript obliga a que los demás tengan las mismas claves; plurales con `Intl.PluralRules` (permite añadir después idiomas como el ruso sin cambiar la infraestructura); fechas y números con la etiqueta regional del idioma (`es-ES`, `en-GB`, `fr-FR`, `pt-PT`, `it-IT`, `de-DE`). Al cambiar de idioma se vuelve a montar la interfaz. Los documentos del usuario nunca se traducen; solo lo que se crea nuevo.
- **Fases:** 1) infraestructura · 2) extraer los textos en español a `es.ts` · 3) inglés y francés + alias de fórmulas · 4) portugués, italiano y alemán · 5) fechas, plurales, datos de ejemplo y plantillas · 6) revisión automática de textos sin traducir.

### Fase 1 · Infraestructura — hecha
- Nueva carpeta `src/i18n/`: `index.ts` (`t()`, `tn()`, `locale()`, `detectLang()`, `setLang()`), un archivo por idioma (`es`, `en`, `fr`, `pt`, `it`, `de`) y `i18n.test.ts`.
- `App.tsx`: fija el idioma antes de pintar, recuerda el último usado (para la pantalla de bloqueo, que aparece antes de cargar los ajustes), actualiza `<html lang>` y vuelve a montar la interfaz al cambiar. En el primer arranque se usa el idioma del sistema.
- `starterDocs(lang)` y `sampleDocs(lang)` guardan el idioma elegido en los ajustes iniciales.
- Ajustes → Idioma ya cambia el idioma de los primeros textos traducidos (arranque y aviso del modo navegador), a modo de prueba de la infraestructura.
- Pruebas: 8 nuevas (mismas claves en los 6 idiomas, mismas variables, plurales, detección del idioma del sistema). Las pruebas existentes fijan el español con `src/__tests__/setup.ts`.
- Comprobado en la nube: `tsc` sin errores, 211 pruebas de Vitest y `vite build` correctos.
- Variantes regionales decididas: inglés británico (`en-GB`) y portugués de Portugal (`pt-PT`).

### Fase 2 · Extracción de los textos en español — hecha
- Los diccionarios del español están en `src/i18n/es/` (un archivo por área): `app.ts` (barra lateral, tablero, búsqueda, papelera, plantillas, modelo y estado), `cards.ts` (tarjetas), `settings.ts` (ajustes, bloqueo, apariencia, copias), `agenda.ts` (calendario, recordatorios, Hoy, Diario, grafo, festivos), `pm.ts` (vistas de la Tabla PM) y `calc.ts` (lógica de la Tabla PM, fórmulas, plantillas). En total unas 1.540 claves.
- Todos los textos visibles de unos 50 archivos pasan ahora por `t()` / `tn()`; el español queda idéntico y las 213 pruebas existentes (que comprueban textos en español) siguen pasando sin tocarlas.
- Las constantes con textos (etiquetas de tipos de columna, colores, texturas, países, iconos, meses y días…) se leen al pintar, con getters o funciones, para que el cambio de idioma en caliente funcione. Cambios de nombre: `WEEKDAY_SHORT` → `weekdayShort(i)`, `JOURNAL_TEMPLATE` → `journalTemplate()`, `FUNCTION_HELP` → `functionHelp()`.
- Fechas y horas: `'es-ES'` sustituido por `locale()`. Los meses y días van por claves para conservar el español exacto.
- Los textos creados al momento (tarjeta de bienvenida, proyecto «Inicio», calendarios integrados, plantillas de Tabla PM, nombres por defecto) usan el idioma elegido; los datos que el usuario ya tiene nunca se traducen.
- Los mensajes de error de fórmulas se reconocen por expresiones regulares guardadas en las claves `calc.fx.m.*`: cada idioma tiene que traducirlas junto con los mensajes.
- Cambios visibles en español: «1 tarjeta» (antes «1 tarjetas») en la papelera. El resto de plurales con «1 filas», «1 elementos», «1 eventos» se dejan igual a propósito para no alterar el español; se corrigen al traducir (fase 5).
- Sin traducir a propósito: nombre de la app «Cuaderno» (nombre de sesión por defecto, pantalla de bloqueo), sintaxis de enlaces `[[Diario/…]]`, alias de fórmulas en español, patrones de importación («sí», «verdadero»), error de desarrollador `useApp fuera de <App>`, nombres de marca de la plantilla de redes.
- Pendiente para la fase 5: los datos de ejemplo (`lib/sample.ts`) siguen en español; `starterDocs` ya usa el idioma elegido.
- Comprobado en la nube: `tsc` sin errores, 213 pruebas de Vitest y `vite build` correctos. Sin verificar en la app real (`npm run tauri dev`).

### Fase 3 · Inglés (británico) y francés — hecha
- Traducidas las ~1.560 claves de `src/i18n/es/` a `src/i18n/en/` y `src/i18n/fr/` (un archivo por área, como el español). Glosario común aplicado a los dos idiomas (tarjeta = card/carte, Tabla PM = PM Table/Tableau PM, papelera = Trash/Corbeille, etc.). Francés con «vous», guillemets « » y espacios insécables antes de `: ; ! ?`.
- Fórmulas: alias franceses añadidos al motor (`somme`, `moyenne`, `compter`, `si`, `arrondi`, `et`, `ou`, `non`, `racine`, `puissance`, `reste`, `entier`, `plafond`, `majusc`, `minusc`, `nbval`, `estvide`, `concatener`/`concaténer`, `aujourdhui`, `maximum`, `minimum`, `longueur`). Los mensajes de error y las expresiones regulares `calc.fx.m.*` están traducidos y probados (34 pruebas nuevas en `src/i18n/formula-i18n.test.ts`). Los nombres de función que salen en los errores (`raiz`, `potencia`, `residuo`) ahora son claves (`calc.fn.*`).
- Pruebas: `i18n.test.ts` exige que `en` y `fr` tengan todas las claves del español y las mismas {variables} (excepción: el ejemplo de fórmula, que lleva el nombre de columna traducido). Nueva prueba de interfaz `idiomas.test.tsx`: cambiar el idioma en Ajustes pasa la app a inglés y a francés al instante y lo recuerda.
- Comprobado en la nube: `tsc` sin errores, 248 pruebas de Vitest y `vite build` correctos. Sin verificar en la app real.
- Pendiente de revisión humana (Diego): carpetas de backup (en disco siguen en español), «Snap/Magnétisme», «Sûr ?», nombres de festivos con clave compartida entre países, longitud de `ui.board.help` y `pm.tl.hint`, y números con coma decimal también en inglés (se corrige en la fase 5).

### Fase 4 · Portugués (Portugal), italiano y alemán — hecha
- Traducidas las ~1.560 claves de `src/i18n/es/` a `src/i18n/pt/`, `src/i18n/it/` y `src/i18n/de/` (un archivo por área). Con esto la app tiene los 6 idiomas completos; `i18n.test.ts` exige que los seis tengan todas las claves y las mismas {variables}.
- Criterios: pt-PT con ortografía europea (ecrã, ficheiro, utilizador, «Definições», «Reciclagem», frases en infinitivo); italiano impersonal/imperativo; alemán con «du» o imperativo corto, comillas „ “ y sustantivos en mayúscula. Glosario común a todos los idiomas aplicado en las tres lenguas.
- Fórmulas: alias nuevos en portugués (`soma`, `media`/`média`, `se`, `contar`, `arredondar`, `hoje`…), italiano (`somma`, `media`, `se`, `conta`, `arrotonda`, `oggi`…) y alemán (`summe`, `mittelwert`, `wenn`, `anzahl`, `runden`, `heute`…), con y sin acentos. El tokenizador de fórmulas reconoce ahora cualquier letra latina acentuada (ã ç ê ü ä ö ß…). Pruebas ampliadas en `formula-i18n.test.ts` (errores explicados y alias en los 5 idiomas no españoles, y que `{e}`, `{o}`, `{rest}`, `B2`… siguen funcionando).
- Corregidos tras la traducción: pt «Rasurado» → «Riscado» (tachado) y «Largar» → «Soltar» (imagen).
- Comprobado en la nube: `tsc` sin errores, 333 pruebas de Vitest y `vite build` correctos. Sin verificar en la app real.
- Pendiente de revisión humana (Diego), por idioma:
  - pt: «Transferências/Transferir» (Descargas/Descargar), «Repor» (Restablecer), «Marco» (Hito), tratamiento «Escolha…»/«Adicione…» en algunas frases, «PRÓPRIO» (plantilla propia).
  - it: «Home» (Inicio), «Elenco» (lista), «Reimposta» vs «Ripristina», mezcla de «tu» e impersonal en algunos textos, «Download».
  - de: «Start» (Inicio), «Alarm» (aviso de recordatorio), «Strg» en atajos, «Stephanstag» y otros festivos compartidos, «Vorlaufzeit», «Ich habe sie gesichert».
  - Todos: nombres de festivos con clave compartida entre países; el «Día de la Raza» (Colombia) queda en español en it y de; «Backup» sin traducir (así lo escribe el español); iconos con nombre dudoso (birrete, llave inglesa).

### Fase 5 · Plurales, números, datos de ejemplo — hecha
- **Datos de ejemplo** (`lib/sample.ts`): ahora se generan en el idioma elegido (169 claves `sam.*` en `src/i18n/*/sample.ts`, traducidas a los 6 idiomas). Los enlaces `[[…]]` de los textos se construyen con los nombres traducidos de cada tarea/tarjeta/fila (variables `{pN}`, `{kN}`, `{pxN}`), así que siempre apuntan a algo que existe. Las columnas y estados de la Tabla PM se localizan por posición y las fórmulas citan los nombres reales de las columnas, para que funcionen en cualquier idioma. El español sale idéntico al anterior (comparado carácter a carácter). Prueba nueva `sample-i18n.test.ts`: en los 6 idiomas, enlaces resueltos, Tabla PM con 8 filas y «Margen» = 1948.
- **Plurales**: corregidos en español y en todos los idiomas los singulares que antes decían «1 filas», «1 elementos», «1 eventos», «Paleta de 1 colores», etc. (10 claves convertidas a `.one/.other` y 5 corregidas). Prueba nueva: todo `.one` tiene su `.other` en los 6 idiomas.
- **Separador decimal**: los números calculados por fórmulas (Tabla y Tabla PM) y el texto de edición de las celdas numéricas usan el separador del idioma (coma en es/fr/pt/it/de, punto en inglés). Al escribir se siguen aceptando coma y punto.
- **Fechas**: ya usan la etiqueta regional del idioma (`es-ES`, `en-GB`, `fr-FR`, `pt-PT`, `it-IT`, `de-DE`) desde la fase 2; no quedan `'es-ES'` fijos.
- Comprobado en la nube: `tsc` sin errores, 366 pruebas de Vitest y `vite build` correctos. Sin verificar en la app real.
- Observaciones: el rango de semana abrevia el mes sin punto («28 Okt 2026»); «Hace {n} días» solo se usa con n > 1, por eso su singular no se muestra. Revisión humana pendiente de nombres ficticios traducidos (proveedores «Sol Art Supplies», «Quincaillerie Pino»…), etiquetas de ejemplo traducidas (`#move`, `#déménagement`, `#umzug`…) y «Mein Bereich»/«Home» como nombre de la tarea de inicio.

### Fase 6 · Revisión final y documentación — hecha
- **Prueba de textos sin traducir** (`src/i18n/untranslated.test.ts`): recorre con el analizador de TypeScript todas las cadenas, plantillas y textos JSX del código (sin comentarios ni expresiones regulares) y falla si queda texto en español escrito a mano (letras con tilde, ¿ ¡, o palabras habituales como «Guardar», «Eliminar»…). Excepciones documentadas en la propia prueba: nombres de idioma en su idioma, palabras de ejemplo del modo navegador, carpetas de backup en disco, error de desarrollador y alias de fórmulas. Comprobado inyectando un texto español: la prueba lo detecta.
- **Documentación actualizada:** README (idiomas disponibles, «En tu idioma», estructura `i18n/`, apartado «Idiomas» con los pasos para añadir uno, estado de la versión), Spec global (idiomas), «Funciones de la maqueta» (fila Idioma) y Plan (nota del traslado desde «Mejoras continuadas»).
- **Pendiente de la 1.1.0 resuelto:** el README ya recogía los atajos nuevos (Alt+↑/↓ en la barra lateral, teclado de las tablas y fórmulas con `=`); no hizo falta cambiarlo.
- **Aviso en el README:** las 24 palabras de recuperación siguen siendo la lista BIP-39 en español, sea cual sea el idioma de la interfaz.
- Comprobado en la nube: `tsc` sin errores, 367 pruebas de Vitest y `vite build` correctos. Sin verificar en la app real.

### Resumen de la mejora de idiomas (1.2.0)
- 6 idiomas completos (es, en-GB, fr, pt-PT, it, de) con ~1.560 textos de interfaz + 169 de datos de ejemplo cada uno; plurales, decimales, fechas y alias de fórmulas por idioma.
- Pendiente humano: revisar las traducciones (dudas listadas en cada fase) y probar con `npm run tauri dev` el cambio de idioma, el primer arranque en otro idioma del sistema, los arrastres/portapapeles/selector de color de la 1.1.0 y las barras de formato.
