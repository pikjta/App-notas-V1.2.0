# Publicar versiones y actualizaciones de Cuaderno

Las actualizaciones están **firmadas**: cada versión se firma con una clave privada que solo
tienes tú, y las apps instaladas solo aceptan versiones firmadas con ella. Así nadie puede
colar una actualización falsa, aunque consiga acceso al repositorio de descargas.

## 1. Crear la clave de firma (una sola vez)

```bash
npm run tauri signer generate -- -w ~/.tauri/cuaderno.key
```

Te pedirá una contraseña para proteger la clave. Se crean dos archivos:

- `~/.tauri/cuaderno.key` — **privada**. Guárdala en un lugar seguro (por ejemplo, en tu gestor
  de contraseñas). **Si la pierdes, las apps ya instaladas no podrán actualizarse** a versiones
  firmadas con otra clave: habría que reinstalarlas a mano.
- `~/.tauri/cuaderno.key.pub` — pública. Va dentro de la app.

## 2. Configurar la app (una sola vez)

En `src-tauri/tauri.conf.json`, dentro de `plugins.updater`:

- `pubkey`: pega el contenido de `cuaderno.key.pub` en lugar de `PEGA_AQUI_TU_CLAVE_PUBLICA_DE_ACTUALIZACIONES`.
- `endpoints`: cambia `TU_USUARIO/TU_REPOSITORIO` por los tuyos. La dirección queda así:
  `https://github.com/usuario/repositorio/releases/latest/download/latest.json`

Mientras no lo cambies, «Buscar actualizaciones» dirá que aún no están configuradas.

## 3. Secretos en GitHub (una sola vez)

En el repositorio: **Settings → Secrets and variables → Actions → New repository secret**:

| Nombre | Valor |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | El **contenido** del archivo `~/.tauri/cuaderno.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | La contraseña que pusiste al crearla |

## 4. Publicar una versión

1. Sube el número de versión **igual en los tres sitios**: `package.json`,
   `src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml` (por ejemplo, `1.0.0`).
2. Haz commit y sube una etiqueta con ese número:
   ```bash
   git commit -am "Versión 1.0.0"
   git tag v1.0.0
   git push && git push --tags
   ```
3. En la pestaña **Actions** verás «Publicar versión». Tarda unos 15–25 minutos: compila para
   Windows, Mac (Apple Silicon e Intel) y Linux, pasa las pruebas y firma todo.
4. En **Releases** aparece un **borrador** con los instaladores y `latest.json`. Revísalo y
   pulsa **Publish release**. Desde ese momento, las apps instaladas verán la actualización.

También puedes lanzarlo a mano: **Actions → Publicar versión → Run workflow** (usa la versión
de `tauri.conf.json` para la etiqueta).

## Qué instala cada sistema

| Sistema | Instaladores | Se actualiza sola |
|---|---|---|
| Windows | `.msi` y `.exe` | Sí |
| macOS | `.dmg` (y `.app.tar.gz` para el actualizador) | Sí |
| Linux | `.AppImage`, `.deb`, `.rpm` | Sí con **AppImage**; con `.deb`/`.rpm` se actualiza con el gestor de paquetes descargando el nuevo |

## Avisos del sistema la primera vez (sin firma de código)

La firma de actualizaciones es gratuita, pero la **firma de código** de Apple y Microsoft es aparte:

- **macOS**: sin certificado de Apple Developer (99 $/año), la primera vez macOS dirá que no
  puede verificar al desarrollador. Se abre con **clic derecho → Abrir**. Para quitar el aviso,
  añade los secretos `APPLE_*` comentados en `.github/workflows/release.yml`
  (guía: https://v2.tauri.app/distribute/sign/macos/).
- **Windows**: SmartScreen puede avisar («Windows protegió su PC» → «Más información» →
  «Ejecutar de todos modos»). Se quita con un certificado de firma de código
  (guía: https://v2.tauri.app/distribute/sign/windows/).
- **Linux**: no hay aviso.

## Comprobar el desbloqueo rápido en cada sistema

El desbloqueo rápido (Ajustes → Seguridad) usa código propio de cada sistema que conviene
probar en cada uno tras instalar:

- **macOS**: activa el interruptor → aparece Touch ID → bloquea (🔒) → «Desbloquear con Touch ID».
  En el Llavero verás una entrada `app.cuaderno.desktop`.
- **Windows**: igual, con Windows Hello (huella, cara o PIN). La clave aparece en
  Administrador de credenciales → Credenciales de Windows.
- **Linux**: necesita un llavero de sesión (GNOME Keyring o KWallet, que vienen con casi todos
  los escritorios). No hay aviso de huella: se desbloquea mientras tu sesión esté iniciada.
