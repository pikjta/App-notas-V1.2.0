//! Núcleo de Cuaderno: almacenamiento local en SQLite con cifrado opcional y copias de seguridad.
//! No depende de Tauri, así que se puede probar con `cargo test -p cuaderno-core`.

pub mod autobackup;
pub mod error;
pub mod store;
pub mod vault;

pub use error::{CoreError, Result};
pub use store::{BackupSecret, Doc, SnapshotInfo, Status, Store};
pub use vault::{KdfParams, MIN_PASSWORD};
