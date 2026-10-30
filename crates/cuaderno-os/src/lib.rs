//! Integración de Cuaderno con el sistema operativo para el «desbloqueo rápido».
//!
//! - **macOS**: la clave se guarda en el Llavero (Keychain) y antes de usarla se pide Touch ID
//!   (o la contraseña del Mac, si no hay Touch ID).
//! - **Windows**: la clave se guarda en el Administrador de credenciales y antes de usarla se
//!   pide Windows Hello (huella, cara o PIN).
//! - **Linux**: la clave se guarda en el llavero de la sesión (Secret Service: GNOME Keyring,
//!   KWallet…). No hay un aviso biométrico estándar en Linux, así que queda protegida por el
//!   inicio de sesión del usuario.
//!
//! Este crate no sabe nada de cifrado: guarda y lee bytes. El núcleo comprueba que la clave
//! leída es la buena antes de usarla.

use keyring::Entry;

const SERVICE: &str = "app.cuaderno.desktop";

/// Qué protege el desbloqueo rápido en este sistema (para explicarlo en la interfaz).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    TouchId,
    WindowsHello,
    SessionKeyring,
}

impl Kind {
    pub fn current() -> Self {
        if cfg!(target_os = "macos") {
            Kind::TouchId
        } else if cfg!(target_os = "windows") {
            Kind::WindowsHello
        } else {
            Kind::SessionKeyring
        }
    }
    pub fn id(self) -> &'static str {
        match self {
            Kind::TouchId => "touchid",
            Kind::WindowsHello => "hello",
            Kind::SessionKeyring => "keyring",
        }
    }
}

/// ¿Hay un llavero del sistema utilizable? (En Linux puede faltar el servicio Secret Service.)
pub fn keychain_available() -> bool {
    Entry::store_status().is_ok()
}

pub fn store_secret(account: &str, secret: &[u8]) -> Result<(), String> {
    Entry::new(SERVICE, account)
        .and_then(|e| e.set_secret(secret))
        .map_err(|e| format!("No se pudo guardar la clave en el llavero del sistema: {e}"))
}

/// Lee la clave. `Ok(None)` si ya no está (por ejemplo, si el usuario la borró del llavero).
pub fn load_secret(account: &str) -> Result<Option<Vec<u8>>, String> {
    let entry = Entry::new(SERVICE, account).map_err(|e| format!("Llavero no disponible: {e}"))?;
    match entry.get_secret() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("No se pudo leer el llavero del sistema: {e}")),
    }
}

pub fn delete_secret(account: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE, account).map_err(|e| format!("Llavero no disponible: {e}"))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("No se pudo borrar la clave del llavero: {e}")),
    }
}

/// Pide al usuario que confirme que es él (Touch ID / Windows Hello). Bloquea hasta que responde.
/// En Linux no hay aviso estándar: devuelve `Ok(())` y la protección es la sesión del usuario.
#[cfg(any(target_os = "macos", target_os = "windows"))]
pub fn confirm_presence(reason: &str) -> Result<(), String> {
    use robius_authentication::{AndroidText, BiometricStrength, Context, PolicyBuilder, Text, WindowsText};
    use std::sync::mpsc;
    use std::time::Duration;

    let policy = PolicyBuilder::new()
        .biometrics(Some(BiometricStrength::Strong))
        // Si no hay biometría, se permite la contraseña del sistema o el PIN de Windows Hello.
        .password(true)
        .build()
        .ok_or("No se pudo preparar la autenticación del sistema.")?;
    let text = Text {
        android: AndroidText { title: "Cuaderno", subtitle: None, description: None },
        apple: reason,
        windows: WindowsText::new_truncated("Cuaderno", reason),
    };
    let (tx, rx) = mpsc::channel();
    Context::new(())
        .authenticate(text, &policy, move |r| {
            let _ = tx.send(r.is_ok());
        })
        .map_err(|e| format!("No se pudo mostrar la autenticación del sistema: {e:?}"))?;
    match rx.recv_timeout(Duration::from_secs(120)) {
        Ok(true) => Ok(()),
        Ok(false) => Err("Autenticación cancelada o no reconocida.".into()),
        Err(_) => Err("Se agotó el tiempo de la autenticación.".into()),
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn confirm_presence(_reason: &str) -> Result<(), String> {
    Ok(())
}
