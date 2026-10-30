//! Copias de seguridad automáticas en una carpeta elegida por el usuario.
//!
//! Reglas de seguridad: solo se crean y se borran archivos con el prefijo `cuaderno_auto_`
//! y la extensión `.json`; nunca se toca nada más de la carpeta. Cada copia se escribe primero
//! en un archivo temporal y después se renombra, para que una copia nunca quede a medias.

use std::fs;
use std::io::{Error, ErrorKind};
use std::path::{Path, PathBuf};

use crate::error::{CoreError, Result};

pub const PREFIX: &str = "cuaderno_auto_";
pub const INTERNAL_PREFIX: &str = "cuaderno_interno_";
pub const MANUAL_PREFIX: &str = "cuaderno_manual_";
/// Subcarpetas que se crean dentro de la carpeta de backup elegida.
pub const SUB_AUTO: &str = "backup automático";
pub const SUB_INTERNAL: &str = "backup interno";
pub const SUB_MANUAL: &str = "backup manual";

fn invalid(msg: &str) -> CoreError {
    CoreError::Io(Error::new(ErrorKind::InvalidInput, msg.to_string()))
}

/// Escribe `json` como `cuaderno_auto_<sello>[_cifrado].json` y deja solo las `keep` más recientes.
/// El sello lo pone la interfaz con la hora local (por ejemplo `2026-10-18_0930`).
pub fn write_auto_backup(dir: &Path, json: &str, stamp: &str, encrypted: bool, keep: usize) -> Result<String> {
    if stamp.is_empty() || stamp.len() > 24 || !stamp.chars().all(|c| c.is_ascii_digit() || c == '-' || c == '_') {
        return Err(invalid("sello de fecha no válido"));
    }
    if !dir.is_dir() {
        return Err(invalid("la carpeta de copias no existe o no está disponible"));
    }
    let name = format!("{PREFIX}{stamp}{}.json", if encrypted { "_cifrado" } else { "" });
    let tmp = dir.join(format!(".{name}.tmp"));
    fs::write(&tmp, json)?;
    fs::rename(&tmp, dir.join(&name))?;
    prune(dir, keep.max(1))?;
    Ok(name)
}

/// Copias automáticas de la carpeta, de la más reciente a la más antigua.
pub fn list_auto_backups(dir: &Path) -> Result<Vec<String>> {
    let mut names: Vec<String> = fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|n| n.starts_with(PREFIX) && n.ends_with(".json"))
        .collect();
    // El sello AAAA-MM-DD_HHMM ordena igual que el tiempo.
    names.sort();
    names.reverse();
    Ok(names)
}

fn prune(dir: &Path, keep: usize) -> Result<()> {
    for old in list_auto_backups(dir)?.into_iter().skip(keep) {
        fs::remove_file(dir.join(old))?;
    }
    Ok(())
}

fn check_stamp(stamp: &str) -> Result<()> {
    if stamp.is_empty() || stamp.len() > 24 || !stamp.chars().all(|c| c.is_ascii_digit() || c == '-' || c == '_') {
        return Err(invalid("sello de fecha no válido"));
    }
    Ok(())
}

/// Crea (si falta) una de las subcarpetas de backup dentro de `base` y devuelve su ruta.
pub fn ensure_sub(base: &Path, sub: &str) -> Result<PathBuf> {
    if ![SUB_AUTO, SUB_INTERNAL, SUB_MANUAL].contains(&sub) {
        return Err(invalid("subcarpeta no permitida"));
    }
    if !base.is_dir() {
        return Err(invalid("la carpeta de copias no existe o no está disponible"));
    }
    let dir = base.join(sub);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Copia automática dentro de `<carpeta>/backup automático`.
pub fn write_auto_in(base: &Path, json: &str, stamp: &str, encrypted: bool, keep: usize) -> Result<String> {
    write_auto_backup(&ensure_sub(base, SUB_AUTO)?, json, stamp, encrypted, keep)
}

/// Copias automáticas de `<carpeta>/backup automático` (vacío si aún no existe).
pub fn list_auto_in(base: &Path) -> Result<Vec<String>> {
    let dir = base.join(SUB_AUTO);
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    list_auto_backups(&dir)
}

/// Copia manual: `<carpeta>/backup manual/cuaderno_manual_<sello>[_cifrado].json`. No se borran las anteriores.
pub fn write_manual_backup(base: &Path, json: &str, stamp: &str, encrypted: bool) -> Result<String> {
    check_stamp(stamp)?;
    let dir = ensure_sub(base, SUB_MANUAL)?;
    let name = format!("{MANUAL_PREFIX}{stamp}{}.json", if encrypted { "_cifrado" } else { "" });
    let tmp = dir.join(format!(".{name}.tmp"));
    fs::write(&tmp, json)?;
    fs::rename(&tmp, dir.join(&name))?;
    Ok(name)
}

/// Copia interna en archivo: `<carpeta>/backup interno/cuaderno_interno_<sello>[_cifrado].json`.
/// Deja solo las `keep` más recientes (solo toca archivos con ese prefijo).
pub fn write_internal_file(base: &Path, json: &str, stamp: &str, encrypted: bool, keep: usize) -> Result<String> {
    check_stamp(stamp)?;
    let dir = ensure_sub(base, SUB_INTERNAL)?;
    let name = format!("{INTERNAL_PREFIX}{stamp}{}.json", if encrypted { "_cifrado" } else { "" });
    let tmp = dir.join(format!(".{name}.tmp"));
    fs::write(&tmp, json)?;
    fs::rename(&tmp, dir.join(&name))?;
    let mut names: Vec<String> = fs::read_dir(&dir)?
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|n| n.starts_with(INTERNAL_PREFIX) && n.ends_with(".json"))
        .collect();
    names.sort();
    names.reverse();
    for old in names.into_iter().skip(keep.max(1)) {
        fs::remove_file(dir.join(old))?;
    }
    Ok(name)
}
