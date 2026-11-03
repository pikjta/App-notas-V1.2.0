# OMNIA 1.2.0 · Resumen de contexto

Continuación de «Cuaderno 1.1.0 · Resumen de contexto». Todo lo que decía ese documento sigue valiendo (las 6 fases de la 1.1.0, las decisiones propias y los detalles técnicos); aquí se añade lo hecho en la 1.2.0.

## Contexto del proyecto

Sigo desarrollando la app de notas, que ahora se llama **OMNIA** (antes «Cuaderno»). Está hecha con Tauri 2, React/TypeScript y un núcleo Rust con SQLite/SQLCipher. La versión actual es **1.2.0** y la carpeta es `C:\Users\diego.sierra\Documents\Varios\Notas-App\Version 1.2.0`. Era una copia exacta de la 1.1.0. La 1.1.0 queda intacta en `Version 1.1.0`.

Documentos de referencia en `Doc/`: Spec global, Funciones de la maqueta, Plan de implementación (los tres siguen llamándose «Cuaderno · …» a propósito, porque describen la maqueta) y **`Mejoras version1.2.0.md`**, que es el registro de todo lo hecho en esta versión.

**Ya hay clientes con datos reales.** Cualquier cambio debe conservar sus datos y su actualización. Regla nueva y muy importante: no cambiar el identificador `app.cuaderno.desktop`, los archivos `cuaderno.db` y `cuaderno.vault.json`, los prefijos de copias (`cuaderno_auto_`, `cuaderno_interno_`, `cuaderno_manual_`), la marca `app: "cuaderno"` de los archivos de copia ni las constantes de cifrado, salvo que antes se escriba una migración.

## Reglas de trabajo

- Respuestas cortas y en español.
- Fidelidad estricta a `Doc/` y al README. Si algo difiere, preguntar antes.
- Las pruebas y el build se ejecutan en la nube: `npx tsc --noEmit`, `npx vitest run`, `npx vite build`.
- El núcleo Rust se prueba en la nube con `cargo test -p cuaderno-core` (hace falta red). `src-tauri` no se puede compilar en la nube: lo pruebo yo con `npm run tauri dev`.
- No instalar dependencias en mi PC.
- Cada mejora se registra en `Doc/Mejoras version1.2.0.md` (qué se pidió, qué se hizo, cómo se comprobó). Las funciones nuevas también en `Doc/Cuaderno · Funciones de la maqueta.md`.
- Nota práctica: la terminal de mi PC (`device_bash`) suele estar «arrancando» y fallar. Se ha trabajado así: traer archivos con `device_stage_files`, editarlos en la nube y devolverlos uno a uno con `device_commit_files` (con la ruta de destino completa). No dejar archivos temporales en mi carpeta.

## Estado: lo hecho en la 1.2.0

Pasan `tsc`, **368 pruebas de Vitest**, `vite build` y **25 pruebas del núcleo Rust**. Nada de esto está probado todavía en la app real.

1. **Versión 1.2.0** en todos los archivos de versión.
2. **Idiomas (6 fases, hechas).** La app está completa en 6 idiomas: español, English (en-GB), Français, Português (pt-PT), Italiano y Deutsch.
   - El idioma inicial es el del sistema operativo y, si no coincide con ninguno, inglés. Se cambia en Ajustes.
   - Sistema propio de traducciones: `t`, `tn` (plurales con `.one/.other`), `tIn`, `locale`, `decimalSep`. Los diccionarios están en `src/i18n/<idioma>/<área>.ts` (unas 1.560 claves de interfaz y 169 de datos de ejemplo por idioma).
   - Los datos de ejemplo y las plantillas se generan en el idioma elegido. Las fechas usan la etiqueta regional, los números el separador decimal del idioma, y las fórmulas aceptan los nombres de función de cada idioma, con y sin acentos.
   - Pruebas que vigilan el sistema: `i18n.test.ts` (los 6 idiomas con las mismas claves y {variables}), `untranslated.test.ts` (falla si queda español escrito a mano en el código), `formula-i18n.test.ts` y `sample-i18n.test.ts`.
   - Las 24 palabras de recuperación siguen siendo la lista BIP-39 en español, sea cual sea el idioma.
3. **Mejora 2 · Borrado real de datos (hecha).** Bug: desinstalar y reinstalar conservaba las tarjetas, porque los desinstaladores no borran la carpeta de datos y el botón «Borrar todos los datos» solo vaciaba los documentos.
   - Núcleo: `Store::wipe_all()` cierra la base, sobrescribe con ceros y borra `cuaderno.db`, `-wal`, `-shm`, `-journal`, temporales y `cuaderno.vault.json`, y abre un almacén nuevo. Funciona bloqueado y en memoria. 4 pruebas nuevas en `crates/cuaderno-core/tests/store.rs`.
   - Comando Tauri `data_wipe_all` (borra además la clave del llavero). Interfaz: `Backend.wipeAll()`, y `reload(true)` limpia el historial de deshacer.
   - Ajustes → Datos muestra el aviso «¿Vas a desinstalar? Bórralos aquí antes» (clave `set.data.uninstallHint`). El README tiene el apartado «Desinstalar y borrar tus datos» con rutas por sistema.
   - Windows: se confía en la casilla «Delete the application data» del instalador NSIS de Tauri 2. **No está verificado** y el `.msi` no la tiene.
4. **Mejora 3 · Nombre OMNIA e icono (hecha).**
   - Icono: logo y «OMNIA» sin eslogan, sobre fondo crema, generado con `tauri icon` en `src-tauri/icons`. `app-icon.png` de la raíz es el cuadrado de origen.
   - Nombre visible cambiado en `tauri.conf.json` (`productName`, título de ventana), `index.html`, pantalla de bloqueo, textos de los 6 idiomas, exportación `.ics`, mensajes de error del núcleo, textos del desbloqueo rápido, README y RELEASING.
   - Sin cambiar a propósito: lo que lista la regla de compatibilidad de arriba, los nombres de crates y paquete (`cuaderno-core`, `cuaderno-os`, `cuaderno`), y las palabras «cuaderno» como objeto (ambiente visual «Cuaderno», icono de diario).
   - Quien ya tenía la app conserva «Cuaderno» como nombre de sesión y de calendario principal (es lo que tiene guardado y se puede renombrar). Solo las instalaciones nuevas salen con «OMNIA». Se ofreció una migración automática y está sin decidir.

## Detalles técnicos útiles (nuevos)

- Datos en `app_data_dir`: `%APPDATA%\app.cuaderno.desktop\`, `~/Library/Application Support/app.cuaderno.desktop/` o `~/.local/share/app.cuaderno.desktop/`. Archivos: `cuaderno.db` (+ `-wal`, `-shm`), `cuaderno.vault.json` (cabecera de cifrado y desbloqueo rápido).
- Interfaz `Backend` en `src/lib/backend.ts`, con `tauriBackend` (usa `invoke`) y `memoryBackend` (navegador y pruebas). Cualquier función nueva del backend hay que añadirla a los dos y, si es de Rust, al `generate_handler!` de `src-tauri/src/lib.rs`.
- Núcleo Rust: `crates/cuaderno-core` (almacén, cifrado, copias, `Store`) y `crates/cuaderno-os` (llavero y confirmación de presencia). El estado de la app y el historial de deshacer están en `src/App.tsx` y `src/lib/store.ts`.
- Para añadir texto nuevo a la interfaz: escribir la clave en `src/i18n/es/<área>.ts` y traducirla en los otros 5 idiomas; si falta una, falla `i18n.test.ts`. Los plurales usan `.one/.other`.
- Pruebas de interfaz: `src/__tests__/` (jsdom). La del borrado es `wipe12.test.tsx`; la de idiomas, `idiomas.test.tsx`.
- Entorno de la nube: el proyecto se monta en una carpeta de trabajo con `node_modules`; hay que traer los archivos del PC antes de probar. Las rutas de la nube no se conservan entre chats.

## Pendiente

- **Pruebas en mi PC** (todo lo de la 1.2.0 está sin verificar en la app real):
  - `cargo test -p cuaderno-core`.
  - `npm run tauri dev`: cambio de idioma, primer arranque con otro idioma del sistema, «Borrar todos los datos» (con y sin cifrado, comprobando la carpeta de datos), icono y nombre OMNIA en ventana y barra de tareas.
  - Desinstalar el `.exe` en Windows y ver si aparece la casilla de borrar datos.
  - **Instalar el nuevo instalador sobre una instalación real de Cuaderno** y comprobar que actualiza y conserva los datos. Al cambiar el nombre del producto, en Windows podría instalarse aparte.
- **Revisión humana de las traducciones.** Las dudas están listadas por idioma en las fases 3 a 5 de `Mejoras version1.2.0.md` (pt, it, de, festivos compartidos, «Backup» sin traducir, etc.).
- **Arrastres de la 1.1.0** sin verificar en el webview real: arrastres, portapapeles, selector de color y barras de formato.
- Decisión abierta: migrar automáticamente «Cuaderno» → «OMNIA» en el nombre de sesión y el calendario principal de las instalaciones existentes.
- Pendiente de ampliar: lista de bugs y funciones nuevas de la 1.2 que irá aportando el usuario.
- Mejoras continuadas aún sin implementar (de la 1.1.0): festivos, seguridad extra, instaladores firmados y actualizaciones automáticas. En `tauri.conf.json` siguen los marcadores `PEGA_AQUI_TU_CLAVE_PUBLICA_DE_ACTUALIZACIONES` y `TU_USUARIO/TU_REPOSITORIO`.
