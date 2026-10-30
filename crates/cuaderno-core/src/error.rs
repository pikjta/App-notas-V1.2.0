use serde::Serialize;

/// Errores del núcleo. El mensaje (`Display`) está pensado para mostrarse tal cual al usuario.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("Contraseña incorrecta.")]
    WrongPassword,
    #[error("Esas palabras no corresponden a este cuaderno.")]
    WrongRecoveryWords,
    #[error("Las palabras de recuperación no son válidas: {0}")]
    InvalidMnemonic(String),
    #[error("El cuaderno está bloqueado.")]
    Locked,
    #[error("El cifrado no está activado.")]
    NotEncrypted,
    #[error("El cifrado ya está activado.")]
    AlreadyEncrypted,
    #[error("La contraseña debe tener al menos {0} caracteres.")]
    PasswordTooShort(usize),
    #[error("No hay ninguna activación de cifrado pendiente de confirmar.")]
    NoPendingSetup,
    #[error("Los datos están dañados o han sido modificados.")]
    Tampered,
    #[error("El archivo no es una copia de seguridad de Cuaderno.")]
    NotABackup,
    #[error("Esta copia está cifrada: hace falta su contraseña o sus palabras.")]
    BackupNeedsSecret,
    #[error("Este cuaderno se guardó con una versión anterior de Cuaderno que cifraba de otra forma. Restaura una copia de seguridad en un cuaderno nuevo.")]
    LegacyFormat,
    #[error("Error de la base de datos: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("Error al leer o escribir datos: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Error de archivo: {0}")]
    Io(#[from] std::io::Error),
    #[error("Error de cifrado.")]
    Crypto,
}

pub type Result<T> = std::result::Result<T, CoreError>;

/// Tauri necesita que los errores de los comandos se puedan serializar: enviamos el mensaje.
impl Serialize for CoreError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}
