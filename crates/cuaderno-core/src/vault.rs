//! Cifrado de Cuaderno.
//!
//! Esquema de «sobre» (envelope encryption):
//! - Una **clave de datos** (DEK) aleatoria de 256 bits cifra cada documento con AES-256-GCM.
//!   Cada cifrado usa un nonce aleatorio de 96 bits y el id del documento como dato asociado (AAD),
//!   de modo que un documento cifrado no se puede mover a otro id sin que se detecte.
//! - La DEK se guarda **envuelta dos veces**:
//!   1. con una clave derivada de la contraseña mediante **Argon2id** (memoria intensiva);
//!   2. con una clave derivada de las **24 palabras BIP-39** (256 bits de entropía) mediante
//!      la semilla estándar BIP-39 (PBKDF2-HMAC-SHA512) y **HKDF-SHA256**.
//! - Cambiar la contraseña solo vuelve a envolver la DEK: no hace falta recifrar los datos.
//! - Todas las claves en memoria se borran (`zeroize`) al soltarse.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use bip39::{Language, Mnemonic};
use hkdf::Hkdf;
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use zeroize::{Zeroize, Zeroizing};

use crate::error::{CoreError, Result};

pub const MIN_PASSWORD: usize = 10;
const DEK_AAD: &[u8] = b"cuaderno-dek-v1";
const REC_INFO: &[u8] = b"cuaderno-recovery-kek-v1";

/// Parámetros de Argon2id. Por defecto: 64 MiB, 3 pasadas, 4 hilos (por encima del mínimo de OWASP). Se guardan junto a los datos para poder subirlos en el futuro.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct KdfParams {
    pub m_kib: u32,
    pub t: u32,
    pub p: u32,
}

impl Default for KdfParams {
    fn default() -> Self {
        Self { m_kib: 64 * 1024, t: 3, p: 4 }
    }
}

/// Caja cifrada: nonce + texto cifrado (en base64 para guardarla en JSON).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SealedBox {
    pub nonce: String,
    pub ct: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PasswordWrap {
    pub alg: String,
    pub params: KdfParams,
    pub salt: String,
    pub dek: SealedBox,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RecoveryWrap {
    pub alg: String,
    pub salt: String,
    pub dek: SealedBox,
}

/// Cabecera del cofre: se guarda en claro (no contiene secretos utilizables sin la contraseña).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VaultHeader {
    pub v: u32,
    pub cipher: String,
    pub created: i64,
    pub password: PasswordWrap,
    pub recovery: RecoveryWrap,
}

/// Clave de datos en memoria. Se borra al soltarse.
#[derive(Clone)]
pub struct Dek(Zeroizing<[u8; 32]>);

impl Dek {
    /// Bytes de la clave (solo para guardarla en el llavero del sistema).
    pub fn raw(&self) -> Zeroizing<Vec<u8>> {
        Zeroizing::new(self.0.to_vec())
    }
    /// Reconstruye la clave a partir de sus bytes (por ejemplo, leídos del llavero).
    pub fn from_raw(raw: &[u8]) -> Result<Self> {
        dek_from_bytes(raw)
    }
    pub fn random() -> Self {
        let mut k = Zeroizing::new([0u8; 32]);
        OsRng.fill_bytes(k.as_mut());
        Dek(k)
    }
    fn cipher(&self) -> Aes256Gcm {
        Aes256Gcm::new_from_slice(self.0.as_ref()).expect("clave de 32 bytes")
    }
    /// Cifra `plain` ligándolo a `aad`. Devuelve nonce (12 bytes) || texto cifrado.
    pub fn seal(&self, plain: &[u8], aad: &[u8]) -> Result<Vec<u8>> {
        let mut nonce = [0u8; 12];
        OsRng.fill_bytes(&mut nonce);
        let ct = self
            .cipher()
            .encrypt(Nonce::from_slice(&nonce), Payload { msg: plain, aad })
            .map_err(|_| CoreError::Crypto)?;
        let mut out = Vec::with_capacity(12 + ct.len());
        out.extend_from_slice(&nonce);
        out.extend_from_slice(&ct);
        Ok(out)
    }
    pub fn open(&self, sealed: &[u8], aad: &[u8]) -> Result<Vec<u8>> {
        if sealed.len() < 12 + 16 {
            return Err(CoreError::Tampered);
        }
        let (nonce, ct) = sealed.split_at(12);
        self.cipher()
            .decrypt(Nonce::from_slice(nonce), Payload { msg: ct, aad })
            .map_err(|_| CoreError::Tampered)
    }
}

fn rand_bytes<const N: usize>() -> [u8; N] {
    let mut b = [0u8; N];
    OsRng.fill_bytes(&mut b);
    b
}

fn seal_with(key: &[u8; 32], plain: &[u8]) -> Result<SealedBox> {
    let nonce: [u8; 12] = rand_bytes();
    let ct = Aes256Gcm::new_from_slice(key)
        .map_err(|_| CoreError::Crypto)?
        .encrypt(Nonce::from_slice(&nonce), Payload { msg: plain, aad: DEK_AAD })
        .map_err(|_| CoreError::Crypto)?;
    Ok(SealedBox { nonce: B64.encode(nonce), ct: B64.encode(ct) })
}

fn open_with(key: &[u8; 32], b: &SealedBox) -> std::result::Result<Zeroizing<Vec<u8>>, ()> {
    let nonce = B64.decode(&b.nonce).map_err(|_| ())?;
    let ct = B64.decode(&b.ct).map_err(|_| ())?;
    if nonce.len() != 12 {
        return Err(());
    }
    Aes256Gcm::new_from_slice(key)
        .map_err(|_| ())?
        .decrypt(Nonce::from_slice(&nonce), Payload { msg: &ct, aad: DEK_AAD })
        .map(Zeroizing::new)
        .map_err(|_| ())
}

fn dek_from_bytes(raw: &[u8]) -> Result<Dek> {
    if raw.len() != 32 {
        return Err(CoreError::Tampered);
    }
    let mut k = Zeroizing::new([0u8; 32]);
    k.copy_from_slice(raw);
    Ok(Dek(k))
}

fn password_kek(password: &str, salt: &[u8], p: KdfParams) -> Result<Zeroizing<[u8; 32]>> {
    let params = Params::new(p.m_kib, p.t, p.p, Some(32)).map_err(|_| CoreError::Crypto)?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut out = Zeroizing::new([0u8; 32]);
    argon
        .hash_password_into(password.as_bytes(), salt, out.as_mut())
        .map_err(|_| CoreError::Crypto)?;
    Ok(out)
}

/// Normaliza una palabra: minúsculas y sin tildes («Ábaco» → «abaco»).
pub fn parse_word(w: &str) -> String {
    w.trim()
        .chars()
        .map(|c| match c {
            'á' | 'Á' => 'a',
            'é' | 'É' => 'e',
            'í' | 'Í' => 'i',
            'ó' | 'Ó' => 'o',
            'ú' | 'Ú' | 'ü' | 'Ü' => 'u',
            c => c,
        })
        .collect::<String>()
        .to_lowercase()
}

/// Interpreta lo que escribe el usuario: sin distinguir mayúsculas ni tildes, separado por
/// espacios, comas o números de lista. Cada palabra se busca en la lista oficial española.
pub fn parse_mnemonic(input: &str) -> Result<Mnemonic> {
    let list = Language::Spanish.word_list();
    let strip = |w: &str| parse_word(w);
    let mut words = Vec::new();
    for raw in input.split(|c: char| c.is_whitespace() || c == ',' || c == '.' || c.is_ascii_digit()) {
        if raw.is_empty() {
            continue;
        }
        let key = strip(raw);
        match list.iter().find(|w| strip(w) == key) {
            Some(w) => words.push(*w),
            None => return Err(CoreError::InvalidMnemonic(format!("«{raw}» no está en la lista."))),
        }
    }
    if words.len() != 24 {
        return Err(CoreError::InvalidMnemonic(format!("deben ser 24 palabras y hay {}.", words.len())));
    }
    Mnemonic::parse_in(Language::Spanish, words.join(" "))
        .map_err(|_| CoreError::InvalidMnemonic("el orden o alguna palabra no es correcta.".into()))
}

fn recovery_kek(m: &Mnemonic, salt: &[u8]) -> Result<Zeroizing<[u8; 32]>> {
    let mut seed = m.to_seed_normalized("");
    let hk = Hkdf::<Sha256>::new(Some(salt), &seed);
    seed.zeroize();
    let mut out = Zeroizing::new([0u8; 32]);
    hk.expand(REC_INFO, out.as_mut()).map_err(|_| CoreError::Crypto)?;
    Ok(out)
}

pub fn wrap_password(dek: &Dek, password: &str, params: KdfParams) -> Result<PasswordWrap> {
    if password.chars().count() < MIN_PASSWORD {
        return Err(CoreError::PasswordTooShort(MIN_PASSWORD));
    }
    let salt: [u8; 16] = rand_bytes();
    let kek = password_kek(password, &salt, params)?;
    Ok(PasswordWrap { alg: "argon2id".into(), params, salt: B64.encode(salt), dek: seal_with(&kek, dek.0.as_ref())? })
}

pub fn wrap_recovery(dek: &Dek, m: &Mnemonic) -> Result<RecoveryWrap> {
    let salt: [u8; 16] = rand_bytes();
    let kek = recovery_kek(m, &salt)?;
    Ok(RecoveryWrap { alg: "bip39+hkdf-sha256".into(), salt: B64.encode(salt), dek: seal_with(&kek, dek.0.as_ref())? })
}

pub fn unwrap_password(h: &VaultHeader, password: &str) -> Result<Dek> {
    let salt = B64.decode(&h.password.salt).map_err(|_| CoreError::Tampered)?;
    let kek = password_kek(password, &salt, h.password.params)?;
    let raw = open_with(&kek, &h.password.dek).map_err(|_| CoreError::WrongPassword)?;
    dek_from_bytes(&raw)
}

pub fn unwrap_recovery(h: &VaultHeader, m: &Mnemonic) -> Result<Dek> {
    let salt = B64.decode(&h.recovery.salt).map_err(|_| CoreError::Tampered)?;
    let kek = recovery_kek(m, &salt)?;
    let raw = open_with(&kek, &h.recovery.dek).map_err(|_| CoreError::WrongRecoveryWords)?;
    dek_from_bytes(&raw)
}

/// Genera 24 palabras nuevas (256 bits de entropía del sistema operativo).
pub fn new_mnemonic() -> Mnemonic {
    let mut ent: [u8; 32] = rand_bytes();
    let m = Mnemonic::from_entropy_in(Language::Spanish, &ent).expect("32 bytes válidos");
    ent.zeroize();
    m
}

pub fn new_header(dek: &Dek, password: &str, m: &Mnemonic, params: KdfParams, now: i64) -> Result<VaultHeader> {
    Ok(VaultHeader {
        v: 1,
        cipher: "aes-256-gcm".into(),
        created: now,
        password: wrap_password(dek, password, params)?,
        recovery: wrap_recovery(dek, m)?,
    })
}
