//! Capa de Tauri: expone el núcleo (`cuaderno-core`) a la interfaz como comandos.
//! La interfaz nunca toca archivos ni claves: solo pide y recibe documentos JSON.

use std::sync::Mutex;

use cuaderno_core::{BackupSecret, CoreError, Doc, Status, Store};
use serde::Serialize;
use tauri::{Manager, State};

pub struct AppState(pub Mutex<Store>);

type CmdResult<T> = Result<T, CoreError>;

fn with<T>(state: &State<AppState>, f: impl FnOnce(&mut Store) -> CmdResult<T>) -> CmdResult<T> {
    let mut store = state.0.lock().expect("almacén envenenado");
    f(&mut store)
}

#[tauri::command]
fn app_status(state: State<AppState>) -> CmdResult<Status> {
    with(&state, |s| s.status())
}

#[tauri::command]
fn docs_all(state: State<AppState>) -> CmdResult<Vec<Doc>> {
    with(&state, |s| s.all_docs())
}

#[tauri::command]
fn docs_put(state: State<AppState>, docs: Vec<Doc>) -> CmdResult<()> {
    with(&state, |s| s.put_docs(&docs))
}

#[tauri::command]
fn docs_delete(state: State<AppState>, ids: Vec<String>) -> CmdResult<()> {
    with(&state, |s| s.delete_docs(&ids))
}

// Las operaciones con Argon2 tardan ~0,5 s: se ejecutan fuera del hilo principal (`async`).

#[tauri::command]
async fn vault_prepare(state: State<'_, AppState>, password: String) -> CmdResult<Vec<String>> {
    with(&state, |s| s.prepare_encryption(&password))
}

#[tauri::command]
fn vault_confirm(state: State<AppState>, checks: Vec<(usize, String)>) -> CmdResult<()> {
    with(&state, |s| s.confirm_encryption(&checks))
}

#[tauri::command]
fn vault_cancel(state: State<AppState>) {
    let _ = with(&state, |s| {
        s.cancel_encryption();
        Ok(())
    });
}

#[tauri::command]
fn vault_lock(state: State<AppState>) {
    let _ = with(&state, |s| {
        s.lock();
        Ok(())
    });
}

#[tauri::command]
async fn vault_unlock(state: State<'_, AppState>, password: String) -> CmdResult<()> {
    with(&state, |s| s.unlock(&password))
}

#[tauri::command]
async fn vault_recover(state: State<'_, AppState>, words: String, new_password: String) -> CmdResult<()> {
    with(&state, |s| s.recover(&words, &new_password))
}

#[tauri::command]
async fn vault_change_password(state: State<'_, AppState>, current: String, next: String) -> CmdResult<()> {
    with(&state, |s| s.change_password(&current, &next))
}

#[tauri::command]
async fn vault_rotate_words(state: State<'_, AppState>, current: String) -> CmdResult<Vec<String>> {
    with(&state, |s| s.rotate_recovery(&current))
}

#[tauri::command]
async fn vault_disable(state: State<'_, AppState>, current: String) -> CmdResult<()> {
    let account = with(&state, |s| s.quick_account())?;
    with(&state, |s| s.disable_encryption(&current))?;
    if let Some(a) = account {
        let _ = cuaderno_os::delete_secret(&a);
    }
    Ok(())
}

// ---------- Desbloqueo rápido (llavero del sistema + Touch ID / Windows Hello) ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QuickInfo {
    /// «touchid», «hello» o «keyring» (Linux: llavero de la sesión, sin biometría).
    kind: &'static str,
    available: bool,
    enabled: bool,
}

fn os_err(msg: String) -> CoreError {
    CoreError::Io(std::io::Error::new(std::io::ErrorKind::Other, msg))
}

#[tauri::command]
fn quick_unlock_info(state: State<AppState>) -> CmdResult<QuickInfo> {
    let enabled = with(&state, |s| s.quick_account())?.is_some();
    Ok(QuickInfo { kind: cuaderno_os::Kind::current().id(), available: cuaderno_os::keychain_available(), enabled })
}

/// Activa el desbloqueo rápido: pide Touch ID / Windows Hello, guarda la clave en el llavero.
#[tauri::command]
async fn quick_unlock_enable(state: State<'_, AppState>) -> CmdResult<()> {
    tauri::async_runtime::spawn_blocking(|| cuaderno_os::confirm_presence("activar el desbloqueo rápido de Cuaderno"))
        .await
        .map_err(|e| os_err(e.to_string()))?
        .map_err(os_err)?;
    let (account, key) = with(&state, |s| s.quick_enable())?;
    if let Err(e) = cuaderno_os::store_secret(&account, &key) {
        // Si el llavero falla, no se deja la marca puesta.
        let _ = with(&state, |s| s.quick_disable());
        return Err(os_err(e));
    }
    Ok(())
}

#[tauri::command]
fn quick_unlock_disable(state: State<AppState>) -> CmdResult<()> {
    if let Some(a) = with(&state, |s| s.quick_disable())? {
        cuaderno_os::delete_secret(&a).map_err(os_err)?;
    }
    Ok(())
}

/// Desbloquea sin contraseña: pide Touch ID / Windows Hello y usa la clave del llavero.
#[tauri::command]
async fn quick_unlock(state: State<'_, AppState>) -> CmdResult<()> {
    let account = with(&state, |s| s.quick_account())?.ok_or(CoreError::NotEncrypted)?;
    tauri::async_runtime::spawn_blocking(|| cuaderno_os::confirm_presence("desbloquear Cuaderno"))
        .await
        .map_err(|e| os_err(e.to_string()))?
        .map_err(os_err)?;
    match cuaderno_os::load_secret(&account).map_err(os_err)? {
        Some(key) => with(&state, |s| s.unlock_with_key(&key)),
        None => {
            // La clave ya no está en el llavero: se desactiva y se usa la contraseña.
            let _ = with(&state, |s| s.quick_disable());
            Err(os_err("El llavero del sistema ya no tiene la clave. Usa la contraseña; puedes volver a activar el desbloqueo rápido en Ajustes.".into()))
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupInfo {
    encrypted: bool,
    docs: usize,
    exported_at: i64,
}

/// Escribe la copia en la ruta que el usuario eligió en el diálogo de guardar.
#[tauri::command]
fn backup_export(state: State<AppState>, path: String) -> CmdResult<()> {
    let json = with(&state, |s| s.export_backup())?;
    std::fs::write(path, json)?;
    Ok(())
}

#[tauri::command]
fn backup_inspect(path: String) -> CmdResult<BackupInfo> {
    let json = std::fs::read_to_string(path)?;
    let (encrypted, docs, exported_at) = Store::inspect_backup(&json)?;
    Ok(BackupInfo { encrypted, docs, exported_at })
}

/// `secret`: contraseña o palabras de la copia (si está cifrada). `words = true` si son palabras.
#[tauri::command]
async fn backup_import(state: State<'_, AppState>, path: String, secret: Option<String>, words: bool) -> CmdResult<usize> {
    let json = std::fs::read_to_string(path)?;
    let sec = match (&secret, words) {
        (None, _) => BackupSecret::None,
        (Some(s), false) => BackupSecret::Password(s),
        (Some(s), true) => BackupSecret::Words(s),
    };
    with(&state, |s| s.import_backup(&json, sec))
}

/// Solo se permiten archivos con la extensión indicada: la interfaz no puede leer ni escribir otros.
fn checked_path(path: &str, ext_ok: &str) -> CmdResult<std::path::PathBuf> {
    let p = std::path::PathBuf::from(path);
    match p.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()) {
        Some(ext) if ext == ext_ok => Ok(p),
        _ => Err(CoreError::Io(std::io::Error::new(std::io::ErrorKind::InvalidInput, format!("solo se admiten archivos .{ext_ok}")))),
    }
}

fn ics_path(path: &str) -> CmdResult<std::path::PathBuf> {
    checked_path(path, "ics")
}

/// Exportar una Tabla PM: escribe el .csv en la ruta elegida en el diálogo de guardar.
#[tauri::command]
fn csv_write(path: String, text: String) -> CmdResult<()> {
    std::fs::write(checked_path(&path, "csv")?, text)?;
    Ok(())
}

/// Importar a una Tabla PM: lee el .csv elegido (máx. 20 MB).
#[tauri::command]
fn csv_read(path: String) -> CmdResult<String> {
    let p = checked_path(&path, "csv")?;
    if std::fs::metadata(&p)?.len() > 20 * 1024 * 1024 {
        return Err(CoreError::Io(std::io::Error::new(std::io::ErrorKind::InvalidData, "el archivo es demasiado grande")));
    }
    let bytes = std::fs::read(p)?;
    // Excel en Windows a veces guarda en Latin-1: si no es UTF-8 válido, se interpreta así.
    Ok(match String::from_utf8(bytes) {
        Ok(s) => s,
        Err(e) => e.into_bytes().iter().map(|&b| b as char).collect(),
    })
}

/// Exportar un calendario: escribe el .ics en la ruta elegida en el diálogo de guardar.
#[tauri::command]
fn ics_write(path: String, text: String) -> CmdResult<()> {
    std::fs::write(ics_path(&path)?, text)?;
    Ok(())
}

/// Importar un calendario: lee el .ics elegido en el diálogo de abrir (máx. 20 MB).
#[tauri::command]
fn ics_read(path: String) -> CmdResult<String> {
    let p = ics_path(&path)?;
    if std::fs::metadata(&p)?.len() > 20 * 1024 * 1024 {
        return Err(CoreError::Io(std::io::Error::new(std::io::ErrorKind::InvalidData, "el archivo es demasiado grande")));
    }
    Ok(std::fs::read_to_string(p)?)
}

/// Abre un enlace normal en el navegador del sistema. Solo http, https y mailto.
#[tauri::command]
fn open_url(url: String) -> CmdResult<()> {
    let ok = ["http://", "https://", "mailto:"].iter().any(|p| url.to_lowercase().starts_with(p));
    if !ok || url.chars().any(|c| c.is_control()) {
        return Err(os_err("Solo se pueden abrir enlaces http, https y mailto".to_string()));
    }
    #[cfg(target_os = "windows")]
    let r = std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", &url]).spawn();
    #[cfg(target_os = "macos")]
    let r = std::process::Command::new("open").arg(&url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let r = std::process::Command::new("xdg-open").arg(&url).spawn();
    r.map(|_| ()).map_err(|e| os_err(e.to_string()))
}

/// Carpeta de Descargas del usuario: es la carpeta de backup por defecto.
#[tauri::command]
fn downloads_dir(app: tauri::AppHandle) -> CmdResult<String> {
    let p = app.path().download_dir().map_err(|e| os_err(e.to_string()))?;
    Ok(p.to_string_lossy().into_owned())
}

/// Copia automática: la interfaz decide cuándo (según la frecuencia elegida) y pone el sello
/// con la hora local. Se guarda en `<carpeta>/backup automático`. Si el cuaderno está cifrado,
/// la copia también lo está.
#[tauri::command]
fn auto_backup(state: State<AppState>, dir: String, stamp: String, keep: usize) -> CmdResult<String> {
    let (json, encrypted) = with(&state, |s| Ok((s.export_backup()?, s.status()?.encrypted)))?;
    cuaderno_core::autobackup::write_auto_in(std::path::Path::new(&dir), &json, &stamp, encrypted, keep)
}

#[tauri::command]
fn auto_backup_list(dir: String) -> CmdResult<Vec<String>> {
    cuaderno_core::autobackup::list_auto_in(std::path::Path::new(&dir))
}

/// Copia manual: un .json con todos los datos en `<carpeta>/backup manual`.
#[tauri::command]
fn manual_backup(state: State<AppState>, dir: String, stamp: String) -> CmdResult<String> {
    let (json, encrypted) = with(&state, |s| Ok((s.export_backup()?, s.status()?.encrypted)))?;
    cuaderno_core::autobackup::write_manual_backup(std::path::Path::new(&dir), &json, &stamp, encrypted)
}

/// Además de la copia dentro de la base de datos, escribe un archivo en `<carpeta>/backup interno`.
#[tauri::command]
fn internal_backup_file(state: State<AppState>, dir: String, stamp: String, keep: usize) -> CmdResult<String> {
    let (json, encrypted) = with(&state, |s| Ok((s.export_backup()?, s.status()?.encrypted)))?;
    cuaderno_core::autobackup::write_internal_file(std::path::Path::new(&dir), &json, &stamp, encrypted, keep)
}

// ---------- Copias internas (dentro de la propia base de datos, cifradas con ella) ----------

#[tauri::command]
fn snapshot_create(state: State<AppState>, keep: usize) -> CmdResult<cuaderno_core::SnapshotInfo> {
    with(&state, |s| s.snapshot_create(keep))
}

#[tauri::command]
fn snapshot_list(state: State<AppState>) -> CmdResult<Vec<cuaderno_core::SnapshotInfo>> {
    with(&state, |s| s.snapshot_list())
}

#[tauri::command]
fn snapshot_restore(state: State<AppState>, id: i64, keep: usize) -> CmdResult<usize> {
    with(&state, |s| s.snapshot_restore(id, keep))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("carpeta de datos de la app");
            std::fs::create_dir_all(&dir)?;
            let store = Store::open(&dir.join("cuaderno.db")).map_err(|e| e.to_string())?;
            app.manage(AppState(Mutex::new(store)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_status,
            docs_all,
            docs_put,
            docs_delete,
            vault_prepare,
            vault_confirm,
            vault_cancel,
            vault_lock,
            vault_unlock,
            vault_recover,
            vault_change_password,
            vault_rotate_words,
            vault_disable,
            backup_export,
            backup_inspect,
            backup_import,
            ics_write,
            ics_read,
            csv_write,
            csv_read,
            downloads_dir,
            open_url,
            auto_backup,
            auto_backup_list,
            manual_backup,
            snapshot_create,
            snapshot_list,
            snapshot_restore,
            internal_backup_file,
            quick_unlock_info,
            quick_unlock_enable,
            quick_unlock_disable,
            quick_unlock
        ])
        .run(tauri::generate_context!())
        .expect("error al arrancar Cuaderno");
}
