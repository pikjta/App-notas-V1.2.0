//! Almacén de Cuaderno sobre SQLite.
//!
//! Todo se guarda como **documentos**: `{ id, kind, parent, pos, updated, data }`, donde `data`
//! es JSON. Si el cifrado está activado, **todo el archivo de la base de datos** va cifrado con
//! SQLCipher (AES-256) usando la clave de datos; la cabecera con la clave envuelta (contraseña y
//! 24 palabras) vive aparte, en `cuaderno.vault.json`, porque hace falta leerla antes de abrir la
//! base. La interfaz nunca ve la base de datos: solo documentos JSON.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use zeroize::Zeroizing;

use crate::error::{CoreError, Result};
use crate::vault::{self, Dek, KdfParams, VaultHeader};

fn now_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Doc {
    pub id: String,
    pub kind: String,
    #[serde(default)]
    pub parent: Option<String>,
    #[serde(default)]
    pub pos: f64,
    #[serde(default)]
    pub updated: i64,
    pub data: Value,
}

/// Desbloqueo rápido: la clave de datos está en el llavero del sistema bajo `account`; `check`
/// es un valor cifrado con esa clave para comprobar que la del llavero es la buena.
#[derive(Clone, Debug, Serialize, Deserialize)]
struct QuickMeta {
    account: String,
    check: String,
}
const QUICK_CHECK: &[u8] = b"cuaderno-quick-unlock-check";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub encrypted: bool,
    pub locked: bool,
    pub docs: i64,
    pub vault_created: Option<i64>,
    /// Desbloqueo rápido activado en este equipo (la clave está en el llavero del sistema).
    pub quick_unlock: bool,
}

/// Activación de cifrado preparada pero aún no confirmada (el usuario debe comprobar sus palabras).
struct PendingSetup {
    dek: Dek,
    header: VaultHeader,
    words: Vec<String>,
}

/// Formato del archivo de copia de seguridad.
#[derive(Serialize, Deserialize)]
struct BackupFile {
    app: String,
    format: u32,
    exported_at: i64,
    encrypted: bool,
    vault: Option<VaultHeader>,
    docs: Vec<RawDoc>,
}

#[derive(Serialize, Deserialize)]
struct RawDoc {
    id: String,
    kind: String,
    parent: Option<String>,
    pos: f64,
    updated: i64,
    /// JSON en claro, o base64 de nonce||cifrado si la copia está cifrada.
    data: String,
}

pub enum BackupSecret<'a> {
    None,
    Password(&'a str),
    Words(&'a str),
}

/// Lo que se guarda fuera de la base de datos, en claro (no contiene secretos utilizables).
#[derive(Default, Serialize, Deserialize)]
struct Sidecar {
    vault: Option<VaultHeader>,
    quick: Option<QuickMeta>,
}

/// Copia interna: una foto de los datos guardada dentro de la propia base de datos.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotInfo {
    pub id: i64,
    pub at: i64,
    pub docs: i64,
}

const SETUP: &str = "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             PRAGMA secure_delete = ON;
             CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS docs (
               id TEXT PRIMARY KEY,
               kind TEXT NOT NULL,
               parent TEXT,
               pos REAL NOT NULL DEFAULT 0,
               updated INTEGER NOT NULL,
               data BLOB NOT NULL
             );
             CREATE INDEX IF NOT EXISTS docs_kind ON docs(kind);
             CREATE INDEX IF NOT EXISTS docs_parent ON docs(parent);
             CREATE TABLE IF NOT EXISTS snapshots (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               at INTEGER NOT NULL,
               docs INTEGER NOT NULL,
               data TEXT NOT NULL
             );";

fn hex(raw: &[u8]) -> Zeroizing<String> {
    Zeroizing::new(raw.iter().map(|b| format!("{b:02x}")).collect())
}

/// `PRAGMA key` con la clave de datos en bruto (sin derivación adicional de SQLCipher).
fn key_pragma(dek: &Dek) -> Zeroizing<String> {
    Zeroizing::new(format!("PRAGMA key = \"x'{}'\";", hex(&dek.raw()).as_str()))
}

fn sql_quote(p: &Path) -> String {
    p.to_string_lossy().replace('\'', "''")
}

pub struct Store {
    /// `None` mientras un cuaderno cifrado en disco está bloqueado (el archivo ni siquiera está abierto).
    conn: Option<Connection>,
    /// Ruta de la base de datos; `None` en las pruebas en memoria (sin cifrado de archivo).
    path: Option<PathBuf>,
    header: Option<VaultHeader>,
    quick: Option<QuickMeta>,
    dek: Option<Dek>,
    kdf: KdfParams,
    pending: Option<PendingSetup>,
}

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let side = Self::read_sidecar(path)?;
        let conn = if side.vault.is_some() {
            None // cifrado: no se puede abrir sin la clave
        } else {
            let c = Connection::open(path)?;
            Self::setup(&c)?;
            Some(c)
        };
        Ok(Store { conn, path: Some(path.to_path_buf()), header: side.vault, quick: side.quick, dek: None, kdf: KdfParams::default(), pending: None })
    }

    pub fn open_in_memory() -> Result<Self> {
        let c = Connection::open_in_memory()?;
        Self::setup(&c)?;
        Ok(Store { conn: Some(c), path: None, header: None, quick: None, dek: None, kdf: KdfParams::default(), pending: None })
    }

    fn setup(conn: &Connection) -> Result<()> {
        conn.execute_batch(SETUP)?;
        // Las bases de datos de versiones anteriores guardaban la cabecera del cifrado dentro del archivo.
        let legacy: Option<String> = conn.query_row("SELECT value FROM meta WHERE key = 'vault'", [], |r| r.get(0)).optional()?;
        if legacy.is_some() {
            return Err(CoreError::LegacyFormat);
        }
        Ok(())
    }

    fn sidecar_path(path: &Path) -> PathBuf {
        path.with_extension("vault.json")
    }

    fn read_sidecar(path: &Path) -> Result<Sidecar> {
        match fs::read_to_string(Self::sidecar_path(path)) {
            Ok(t) => Ok(serde_json::from_str(&t)?),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Sidecar::default()),
            Err(e) => Err(e.into()),
        }
    }

    /// Guarda la cabecera del cifrado y el desbloqueo rápido (escritura atómica).
    fn write_sidecar(&self) -> Result<()> {
        let Some(path) = &self.path else { return Ok(()) };
        let side = Sidecar { vault: self.header.clone(), quick: self.quick.clone() };
        let target = Self::sidecar_path(path);
        if side.vault.is_none() && side.quick.is_none() {
            match fs::remove_file(&target) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => return Err(e.into()),
            }
            return Ok(());
        }
        let tmp = target.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_string(&side)?)?;
        fs::rename(&tmp, &target)?;
        Ok(())
    }

    fn conn(&self) -> Result<&Connection> {
        self.conn.as_ref().ok_or(CoreError::Locked)
    }

    fn conn_mut(&mut self) -> Result<&mut Connection> {
        self.conn.as_mut().ok_or(CoreError::Locked)
    }

    /// Abre el archivo cifrado con la clave de datos. Si una activación o desactivación se
    /// interrumpió a medias, termina el cambio de archivo.
    fn open_encrypted(path: &Path, dek: &Dek) -> Result<Connection> {
        let try_open = || -> Result<Connection> {
            let c = Connection::open(path)?;
            c.execute_batch(&key_pragma(dek))?;
            c.query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get::<_, i64>(0)).map_err(|_| CoreError::Tampered)?;
            Self::setup(&c)?;
            Ok(c)
        };
        match try_open() {
            Ok(c) => Ok(c),
            Err(e) => {
                let tmp = path.with_extension("db.enc-tmp");
                if tmp.exists() {
                    fs::rename(&tmp, path)?;
                    return try_open();
                }
                Err(e)
            }
        }
    }

    /// Solo para pruebas: parámetros de Argon2 más ligeros.
    pub fn with_kdf(mut self, kdf: KdfParams) -> Self {
        self.kdf = kdf;
        self
    }

    // ---------- estado ----------

    pub fn status(&self) -> Result<Status> {
        let docs: i64 = match &self.conn {
            Some(c) if !(self.header.is_some() && self.dek.is_none()) => c.query_row("SELECT COUNT(*) FROM docs", [], |r| r.get(0))?,
            _ => 0,
        };
        Ok(Status {
            encrypted: self.header.is_some(),
            locked: self.header.is_some() && self.dek.is_none(),
            docs,
            vault_created: self.header.as_ref().map(|h| h.created),
            quick_unlock: self.quick.is_some(),
        })
    }

    /// Falla si el cuaderno está cifrado y bloqueado.
    fn require_open(&self) -> Result<Option<&Dek>> {
        match (self.header.is_some(), self.dek.as_ref()) {
            (true, None) => Err(CoreError::Locked),
            (true, Some(d)) => Ok(Some(d)),
            (false, _) => Ok(None),
        }
    }

    // ---------- documentos ----------

    fn read_docs(&self) -> Result<Vec<Doc>> {
        let mut st = self.conn()?.prepare("SELECT id, kind, parent, pos, updated, data FROM docs ORDER BY kind, pos, id")?;
        let rows = st.query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, Option<String>>(2)?, r.get::<_, f64>(3)?, r.get::<_, i64>(4)?, r.get::<_, Vec<u8>>(5)?))
        })?;
        let mut out = Vec::new();
        for row in rows {
            let (id, kind, parent, pos, updated, blob) = row?;
            out.push(Doc { id, kind, parent, pos, updated, data: serde_json::from_slice(&blob)? });
        }
        Ok(out)
    }

    pub fn all_docs(&self) -> Result<Vec<Doc>> {
        self.require_open()?;
        self.read_docs()
    }

    /// Guarda varios documentos en una sola transacción (crear o reemplazar).
    pub fn put_docs(&mut self, docs: &[Doc]) -> Result<()> {
        self.require_open()?;
        let tx = self.conn_mut()?.transaction()?;
        {
            let mut st = tx.prepare(
                "INSERT INTO docs(id, kind, parent, pos, updated, data) VALUES(?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, parent = excluded.parent,
                   pos = excluded.pos, updated = excluded.updated, data = excluded.data",
            )?;
            for d in docs {
                let json = serde_json::to_vec(&d.data)?;
                let updated = if d.updated > 0 { d.updated } else { now_ms() };
                st.execute(params![d.id, d.kind, d.parent, d.pos, updated, json])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn delete_docs(&mut self, ids: &[String]) -> Result<()> {
        self.require_open()?;
        let tx = self.conn_mut()?.transaction()?;
        for id in ids {
            tx.execute("DELETE FROM docs WHERE id = ?1", params![id])?;
        }
        tx.commit()?;
        Ok(())
    }

    // ---------- cifrado de archivo completo ----------

    /// Copia la base de datos abierta a `dest` con otra clave (`None` = sin cifrar) y devuelve
    /// la conexión original cerrada. Usa `sqlcipher_export`.
    fn export_to(conn: &Connection, dest: &Path, key: Option<&Dek>) -> Result<()> {
        let _ = fs::remove_file(dest);
        let key_sql = match key {
            Some(k) => format!("x'{}'", hex(&k.raw()).as_str()),
            None => String::new(),
        };
        let attach = format!("ATTACH DATABASE '{}' AS target KEY \"{}\";", sql_quote(dest), key_sql);
        conn.execute_batch(&attach)?;
        let r = conn.query_row("SELECT sqlcipher_export('target')", [], |r| r.get::<_, Option<String>>(0));
        let _ = conn.execute_batch("DETACH DATABASE target;");
        r?;
        Ok(())
    }

    /// Sobrescribe con ceros el archivo antiguo (mejor esfuerzo) y pone el nuevo en su lugar.
    fn swap_files(path: &Path, tmp: &Path) -> Result<()> {
        for ext in ["db-wal", "db-shm"] {
            let _ = fs::remove_file(path.with_extension(ext));
        }
        if let Ok(meta) = fs::metadata(path) {
            if let Ok(mut f) = fs::OpenOptions::new().write(true).open(path) {
                use std::io::Write;
                let zeros = vec![0u8; 64 * 1024];
                let mut left = meta.len();
                while left > 0 {
                    let n = left.min(zeros.len() as u64) as usize;
                    if f.write_all(&zeros[..n]).is_err() {
                        break;
                    }
                    left -= n as u64;
                }
                let _ = f.sync_all();
            }
        }
        fs::rename(tmp, path)?;
        Ok(())
    }

    /// Reescribe el archivo de la base de datos con (`Some`) o sin (`None`) cifrado y lo reabre.
    fn reencrypt_file(&mut self, to: Option<&Dek>) -> Result<()> {
        let Some(path) = self.path.clone() else { return Ok(()) };
        let tmp = path.with_extension("db.enc-tmp");
        {
            let conn = self.conn()?;
            conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
            Self::export_to(conn, &tmp, to)?;
        }
        // La clave y la cabecera se anotan antes de cambiar el archivo: si algo se interrumpe,
        // `open_encrypted` termina el cambio con el archivo temporal.
        self.conn = None;
        Self::swap_files(&path, &tmp)?;
        let conn = match to {
            Some(k) => Self::open_encrypted(&path, k)?,
            None => {
                let c = Connection::open(&path)?;
                Self::setup(&c)?;
                c
            }
        };
        self.conn = Some(conn);
        Ok(())
    }

    // ---------- cifrado: activar, bloquear, desbloquear ----------

    /// Paso 1: genera la clave y las 24 palabras, pero no cambia nada todavía.
    pub fn prepare_encryption(&mut self, password: &str) -> Result<Vec<String>> {
        if self.header.is_some() {
            return Err(CoreError::AlreadyEncrypted);
        }
        let dek = Dek::random();
        let m = vault::new_mnemonic();
        let header = vault::new_header(&dek, password, &m, self.kdf, now_ms())?;
        let words: Vec<String> = m.words().map(String::from).collect();
        self.pending = Some(PendingSetup { dek, header, words: words.clone() });
        Ok(words)
    }

    /// Paso 2: el usuario ha demostrado que tiene las palabras; se cifra todo el archivo.
    pub fn confirm_encryption(&mut self, checks: &[(usize, String)]) -> Result<()> {
        let p = self.pending.as_ref().ok_or(CoreError::NoPendingSetup)?;
        let norm = |w: &str| vault::parse_word(w);
        for (i, w) in checks {
            if p.words.get(*i).map(|x| norm(x)) != Some(norm(w)) {
                return Err(CoreError::InvalidMnemonic(format!("la palabra n.º {} no coincide.", i + 1)));
            }
        }
        let p = self.pending.take().expect("comprobado arriba");
        // Se anota la cabecera primero: si el programa se cierra a medias, el siguiente arranque termina el cambio.
        self.header = Some(p.header);
        if let Err(e) = self.write_sidecar().and_then(|_| self.reencrypt_file(Some(&p.dek))) {
            self.header = None;
            let _ = self.write_sidecar();
            if self.conn.is_none() {
                if let Some(path) = &self.path {
                    self.conn = Connection::open(path).ok();
                }
            }
            return Err(e);
        }
        self.dek = Some(p.dek);
        Ok(())
    }

    pub fn cancel_encryption(&mut self) {
        self.pending = None;
    }

    pub fn lock(&mut self) {
        self.dek = None; // la clave se borra de memoria al soltarse (zeroize)
        self.pending = None;
        if self.header.is_some() && self.path.is_some() {
            self.conn = None; // se cierra el archivo cifrado
        }
    }

    /// Abre el archivo cifrado con la clave ya comprobada.
    fn open_with(&mut self, dek: Dek) -> Result<()> {
        if let Some(path) = self.path.clone() {
            if self.conn.is_none() {
                match Self::open_encrypted(&path, &dek) {
                    Ok(c) => self.conn = Some(c),
                    Err(e) => {
                        // ¿Se interrumpió una desactivación? Si el archivo se abre sin clave, el cifrado ya no está.
                        if let Ok(c) = Connection::open(&path) {
                            if c.query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get::<_, i64>(0)).is_ok() && Self::setup(&c).is_ok() {
                                self.header = None;
                                self.quick = None;
                                self.write_sidecar()?;
                                self.conn = Some(c);
                                return Ok(());
                            }
                        }
                        return Err(e);
                    }
                }
            }
        }
        self.dek = Some(dek);
        Ok(())
    }

    pub fn unlock(&mut self, password: &str) -> Result<()> {
        let h = self.header.clone().ok_or(CoreError::NotEncrypted)?;
        let dek = vault::unwrap_password(&h, password)?;
        self.open_with(dek)
    }

    /// Recupera el acceso con las 24 palabras y fija una contraseña nueva.
    pub fn recover(&mut self, words: &str, new_password: &str) -> Result<()> {
        let mut h = self.header.clone().ok_or(CoreError::NotEncrypted)?;
        let m = vault::parse_mnemonic(words)?;
        let dek = vault::unwrap_recovery(&h, &m)?;
        h.password = vault::wrap_password(&dek, new_password, self.kdf)?;
        self.header = Some(h);
        self.write_sidecar()?;
        self.open_with(dek)
    }

    pub fn change_password(&mut self, current: &str, next: &str) -> Result<()> {
        let mut h = self.header.clone().ok_or(CoreError::NotEncrypted)?;
        let dek = vault::unwrap_password(&h, current)?;
        h.password = vault::wrap_password(&dek, next, self.kdf)?;
        self.header = Some(h);
        self.write_sidecar()?;
        self.open_with(dek)
    }

    /// Genera 24 palabras nuevas: las anteriores dejan de servir para este cuaderno.
    pub fn rotate_recovery(&mut self, current: &str) -> Result<Vec<String>> {
        let mut h = self.header.clone().ok_or(CoreError::NotEncrypted)?;
        let dek = vault::unwrap_password(&h, current)?;
        let m = vault::new_mnemonic();
        h.recovery = vault::wrap_recovery(&dek, &m)?;
        self.header = Some(h);
        self.write_sidecar()?;
        self.open_with(dek)?;
        Ok(m.words().map(String::from).collect())
    }

    // ---------- desbloqueo rápido (llavero del sistema) ----------

    /// Cuenta del llavero donde está la clave, si el desbloqueo rápido está activado.
    pub fn quick_account(&self) -> Result<Option<String>> {
        Ok(self.quick.as_ref().map(|q| q.account.clone()))
    }

    /// Prepara el desbloqueo rápido: devuelve la cuenta y la clave que la capa de sistema guardará
    /// en el llavero. Solo con el cuaderno cifrado y abierto.
    pub fn quick_enable(&mut self) -> Result<(String, zeroize::Zeroizing<Vec<u8>>)> {
        if self.header.is_none() {
            return Err(CoreError::NotEncrypted);
        }
        let dek = self.dek.as_ref().ok_or(CoreError::Locked)?;
        let mut id = [0u8; 12];
        rand::RngCore::fill_bytes(&mut rand::rngs::OsRng, &mut id);
        let account = format!("cuaderno-{}", id.iter().map(|b| format!("{b:02x}")).collect::<String>());
        let check = B64.encode(dek.seal(QUICK_CHECK, account.as_bytes())?);
        let raw = dek.raw();
        self.quick = Some(QuickMeta { account: account.clone(), check });
        self.write_sidecar()?;
        Ok((account, raw))
    }

    /// Quita la marca de desbloqueo rápido (la capa de sistema borra la clave del llavero).
    pub fn quick_disable(&mut self) -> Result<Option<String>> {
        let account = self.quick_account()?;
        self.quick = None;
        self.write_sidecar()?;
        Ok(account)
    }

    /// Desbloquea con la clave leída del llavero, comprobándola antes con el valor de control.
    pub fn unlock_with_key(&mut self, raw: &[u8]) -> Result<()> {
        self.header.as_ref().ok_or(CoreError::NotEncrypted)?;
        let q = self.quick.clone().ok_or(CoreError::NotEncrypted)?;
        let dek = Dek::from_raw(raw)?;
        let check = B64.decode(&q.check).map_err(|_| CoreError::Tampered)?;
        match dek.open(&check, q.account.as_bytes()) {
            Ok(v) if v == QUICK_CHECK => self.open_with(dek),
            _ => Err(CoreError::WrongPassword),
        }
    }

    pub fn disable_encryption(&mut self, current: &str) -> Result<()> {
        let h = self.header.clone().ok_or(CoreError::NotEncrypted)?;
        let dek = vault::unwrap_password(&h, current)?;
        self.open_with(dek)?; // por si estaba bloqueado
        self.reencrypt_file(None)?;
        self.header = None;
        // Sin cifrado no tiene sentido el desbloqueo rápido (la capa de sistema borra el llavero).
        self.quick = None;
        self.write_sidecar()?;
        self.dek = None;
        Ok(())
    }

    // ---------- copias de seguridad ----------

    fn backup_file(&self, sealed: bool) -> Result<BackupFile> {
        let dek = if sealed { self.require_open()? } else { None };
        let docs = self
            .read_docs()?
            .into_iter()
            .map(|d| {
                let json = serde_json::to_vec(&d.data)?;
                let data = match dek {
                    Some(k) => B64.encode(k.seal(&json, d.id.as_bytes())?),
                    None => String::from_utf8_lossy(&json).into_owned(),
                };
                Ok(RawDoc { id: d.id, kind: d.kind, parent: d.parent, pos: d.pos, updated: d.updated, data })
            })
            .collect::<Result<Vec<_>>>()?;
        Ok(BackupFile { app: "cuaderno".into(), format: 1, exported_at: now_ms(), encrypted: dek.is_some(), vault: if dek.is_some() { self.header.clone() } else { None }, docs })
    }

    /// Exporta todos los documentos. Si el cuaderno está cifrado, la copia también lo está
    /// (se abre con la contraseña o las palabras vigentes en el momento de la copia).
    pub fn export_backup(&self) -> Result<String> {
        self.require_open()?;
        Ok(serde_json::to_string(&self.backup_file(self.header.is_some())?)?)
    }

    /// Mira una copia sin importarla: ¿está cifrada?, ¿cuántos documentos tiene?
    pub fn inspect_backup(json: &str) -> Result<(bool, usize, i64)> {
        let f: BackupFile = serde_json::from_str(json).map_err(|_| CoreError::NotABackup)?;
        if f.app != "cuaderno" {
            return Err(CoreError::NotABackup);
        }
        Ok((f.encrypted, f.docs.len(), f.exported_at))
    }

    /// Descifra y valida una copia sin tocar la base de datos.
    fn decode_backup(f: BackupFile, secret: BackupSecret) -> Result<Vec<Doc>> {
        let src_dek = match (&f.vault, secret) {
            (None, _) => None,
            (Some(h), BackupSecret::Password(pw)) => Some(vault::unwrap_password(h, pw)?),
            (Some(h), BackupSecret::Words(w)) => Some(vault::unwrap_recovery(h, &vault::parse_mnemonic(w)?)?),
            (Some(_), BackupSecret::None) => return Err(CoreError::BackupNeedsSecret),
        };
        let mut docs = Vec::with_capacity(f.docs.len());
        for d in f.docs {
            let data: Value = match &src_dek {
                Some(k) => {
                    let blob = B64.decode(&d.data).map_err(|_| CoreError::Tampered)?;
                    serde_json::from_slice(&k.open(&blob, d.id.as_bytes())?)?
                }
                None => serde_json::from_str(&d.data)?,
            };
            docs.push(Doc { id: d.id, kind: d.kind, parent: d.parent, pos: d.pos, updated: d.updated, data });
        }
        Ok(docs)
    }

    fn replace_docs(&mut self, docs: &[Doc]) -> Result<()> {
        let tx = self.conn_mut()?.transaction()?;
        tx.execute("DELETE FROM docs", [])?;
        {
            let mut st = tx.prepare("INSERT INTO docs(id, kind, parent, pos, updated, data) VALUES(?1, ?2, ?3, ?4, ?5, ?6)")?;
            for d in docs {
                st.execute(params![d.id, d.kind, d.parent, d.pos, d.updated, serde_json::to_vec(&d.data)?])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    /// Reemplaza todos los datos por los de la copia. Los documentos se guardan con el cifrado
    /// **actual** del cuaderno (el de su archivo), no con el de la copia.
    pub fn import_backup(&mut self, json: &str, secret: BackupSecret) -> Result<usize> {
        self.require_open()?;
        let f: BackupFile = serde_json::from_str(json).map_err(|_| CoreError::NotABackup)?;
        if f.app != "cuaderno" {
            return Err(CoreError::NotABackup);
        }
        // Primero se descifra y valida todo; si algo falla, no se toca la base de datos.
        let docs = Self::decode_backup(f, secret)?;
        self.replace_docs(&docs)?;
        Ok(docs.len())
    }

    // ---------- copias internas (dentro de la propia base de datos) ----------

    /// Guarda una foto de los datos y deja solo las `keep` más recientes.
    pub fn snapshot_create(&mut self, keep: usize) -> Result<SnapshotInfo> {
        self.require_open()?;
        let file = self.backup_file(false)?;
        let n = file.docs.len() as i64;
        let at = now_ms();
        let json = serde_json::to_string(&file)?;
        let conn = self.conn()?;
        conn.execute("INSERT INTO snapshots(at, docs, data) VALUES(?1, ?2, ?3)", params![at, n, json])?;
        let id = conn.last_insert_rowid();
        conn.execute("DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT ?1)", params![keep.max(1) as i64])?;
        Ok(SnapshotInfo { id, at, docs: n })
    }

    /// Copias internas, de la más reciente a la más antigua.
    pub fn snapshot_list(&self) -> Result<Vec<SnapshotInfo>> {
        self.require_open()?;
        let mut st = self.conn()?.prepare("SELECT id, at, docs FROM snapshots ORDER BY id DESC")?;
        let rows = st.query_map([], |r| Ok(SnapshotInfo { id: r.get(0)?, at: r.get(1)?, docs: r.get(2)? }))?;
        Ok(rows.collect::<std::result::Result<_, _>>()?)
    }

    /// Vuelve a una copia interna. Antes se guarda una copia del estado actual, así que se puede deshacer.
    pub fn snapshot_restore(&mut self, id: i64, keep: usize) -> Result<usize> {
        self.require_open()?;
        let json: String = self.conn()?.query_row("SELECT data FROM snapshots WHERE id = ?1", params![id], |r| r.get(0)).optional()?.ok_or(CoreError::NotABackup)?;
        let f: BackupFile = serde_json::from_str(&json)?;
        let docs = Self::decode_backup(f, BackupSecret::None)?;
        self.snapshot_create(keep)?;
        self.replace_docs(&docs)?;
        Ok(docs.len())
    }

    /// Solo para pruebas: la ruta de la base de datos.
    #[doc(hidden)]
    pub fn db_path(&self) -> Option<&Path> {
        self.path.as_deref()
    }
}
