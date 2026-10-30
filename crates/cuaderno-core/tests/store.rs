use cuaderno_core::{BackupSecret, CoreError, Doc, KdfParams, Store};
use serde_json::json;

// Argon2 ligero para que las pruebas sean rápidas (la app usa 64 MiB / 3 pasadas).
const FAST: KdfParams = KdfParams { m_kib: 1024, t: 1, p: 1 };
const PW: &str = "una frase larga de prueba";

fn store() -> Store {
    Store::open_in_memory().unwrap().with_kdf(FAST)
}

fn file_store(dir: &std::path::Path) -> Store {
    Store::open(&dir.join("cuaderno.db")).unwrap().with_kdf(FAST)
}

/// Todo el contenido de los archivos de datos de la carpeta (base de datos, WAL…).
fn bytes_on_disk(dir: &std::path::Path) -> Vec<u8> {
    let mut all = Vec::new();
    for e in std::fs::read_dir(dir).unwrap() {
        let p = e.unwrap().path();
        if p.file_name().unwrap().to_string_lossy().starts_with("cuaderno.db") {
            all.extend(std::fs::read(p).unwrap());
        }
    }
    all
}

fn contains(hay: &[u8], needle: &str) -> bool {
    hay.windows(needle.len()).any(|w| w == needle.as_bytes())
}

fn sample(s: &mut Store) {
    s.put_docs(&[
        Doc { id: "p1".into(), kind: "project".into(), parent: None, pos: 0.0, updated: 0, data: json!({"name": "Encargo · Mural Café Aurora", "color": "#0E7C7B"}) },
        Doc { id: "c1".into(), kind: "card".into(), parent: Some("p1".into()), pos: 1.0, updated: 0, data: json!({"type": "note", "title": "Brief", "body": "Luz de amanecer"}) },
    ])
    .unwrap();
}

fn enable(s: &mut Store) -> Vec<String> {
    let words = s.prepare_encryption(PW).unwrap();
    assert_eq!(words.len(), 24);
    let checks = vec![(0, words[0].clone()), (11, words[11].to_uppercase()), (23, words[23].clone())];
    s.confirm_encryption(&checks).unwrap();
    words
}

#[test]
fn crud_sin_cifrado() {
    let mut s = store();
    sample(&mut s);
    let docs = s.all_docs().unwrap();
    assert_eq!(docs.len(), 2);
    assert_eq!(docs.iter().find(|d| d.id == "c1").unwrap().data["body"], "Luz de amanecer");
    s.delete_docs(&["c1".into()]).unwrap();
    assert_eq!(s.all_docs().unwrap().len(), 1);
    assert!(!s.status().unwrap().encrypted);
}

#[test]
fn activar_cifra_el_archivo_completo_y_bloquear_impide_leer() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = file_store(dir.path());
    sample(&mut s);
    assert!(contains(&bytes_on_disk(dir.path()), "amanecer"), "sin cifrar, el texto está en el archivo");
    assert!(std::fs::read(dir.path().join("cuaderno.db")).unwrap().starts_with(b"SQLite format 3"));
    enable(&mut s);
    let disk = bytes_on_disk(dir.path());
    assert!(!contains(&disk, "amanecer") && !contains(&disk, "Mural") && !contains(&disk, "docs"), "en disco no queda nada legible, ni los nombres de tablas");
    assert!(!std::fs::read(dir.path().join("cuaderno.db")).unwrap().starts_with(b"SQLite format 3"), "ni siquiera la cabecera de SQLite");
    assert_eq!(s.all_docs().unwrap().len(), 2, "abierto: se lee con normalidad");
    s.put_docs(&[Doc { id: "c2".into(), kind: "card".into(), parent: None, pos: 2.0, updated: 0, data: json!({"body": "escrito después de cifrar secreto-nuevo"}) }]).unwrap();
    assert!(!contains(&bytes_on_disk(dir.path()), "secreto-nuevo"), "lo que se escribe después también va cifrado (WAL incluido)");
    s.lock();
    assert!(s.status().unwrap().locked);
    assert!(matches!(s.all_docs(), Err(CoreError::Locked)));
    assert!(matches!(s.put_docs(&[]), Err(CoreError::Locked)));
    assert!(matches!(s.unlock("contraseña mala"), Err(CoreError::WrongPassword)));
    s.unlock(PW).unwrap();
    assert_eq!(s.all_docs().unwrap().iter().find(|d| d.id == "c1").unwrap().data["body"], "Luz de amanecer");
}

#[test]
fn confirmar_exige_las_palabras_correctas() {
    let mut s = store();
    let words = s.prepare_encryption(PW).unwrap();
    let bad = vec![(3, "mal".to_string())];
    assert!(s.confirm_encryption(&bad).is_err());
    assert!(!s.status().unwrap().encrypted, "nada cambia hasta confirmar");
    s.confirm_encryption(&[(3, words[3].clone())]).unwrap();
    assert!(s.status().unwrap().encrypted);
}

#[test]
fn contrasena_corta_rechazada() {
    let mut s = store();
    assert!(matches!(s.prepare_encryption("corta"), Err(CoreError::PasswordTooShort(10))));
}

#[test]
fn recuperar_con_palabras_sin_tildes_y_nueva_contrasena() {
    let mut s = store();
    sample(&mut s);
    let words = enable(&mut s);
    s.lock();
    let typed: String = words.iter().enumerate().map(|(i, w)| format!("{}. {} ", i + 1, w.to_uppercase().replace('á', "a").replace('é', "e").replace('í', "i").replace('ó', "o").replace('ú', "u"))).collect();
    let mut wrong = words.clone();
    wrong.swap(0, 1);
    assert!(s.recover(&wrong.join(" "), "nueva contraseña segura").is_err());
    s.recover(&typed, "nueva contraseña segura").unwrap();
    assert_eq!(s.all_docs().unwrap().len(), 2);
    s.lock();
    assert!(matches!(s.unlock(PW), Err(CoreError::WrongPassword)), "la vieja ya no sirve");
    s.unlock("nueva contraseña segura").unwrap();
}

#[test]
fn cambiar_contrasena_rotar_palabras_y_desactivar() {
    let mut s = store();
    sample(&mut s);
    let old_words = enable(&mut s);
    assert!(s.change_password("mal", "otra contraseña larga").is_err());
    s.change_password(PW, "otra contraseña larga").unwrap();
    let new_words = s.rotate_recovery("otra contraseña larga").unwrap();
    s.lock();
    assert!(matches!(s.recover(&old_words.join(" "), "x".repeat(12).as_str()), Err(CoreError::WrongRecoveryWords)));
    s.recover(&new_words.join(" "), "tercera contraseña larga").unwrap();
    s.disable_encryption("tercera contraseña larga").unwrap();
    let st = s.status().unwrap();
    assert!(!st.encrypted && !st.locked);
    assert_eq!(s.all_docs().unwrap().len(), 2);
}

#[test]
fn manipular_los_datos_se_detecta() {
    // Una copia con el contenido de un documento puesto en otro id falla (el id es dato asociado).
    let mut s = store();
    sample(&mut s);
    enable(&mut s);
    let backup = s.export_backup().unwrap();
    let mut f: serde_json::Value = serde_json::from_str(&backup).unwrap();
    let docs = f["docs"].as_array_mut().unwrap();
    let c1 = docs.iter().find(|d| d["id"] == "c1").unwrap()["data"].clone();
    for d in docs.iter_mut() {
        if d["id"] == "p1" {
            d["data"] = c1.clone();
        }
    }
    let tampered = serde_json::to_string(&f).unwrap();
    assert!(matches!(s.import_backup(&tampered, BackupSecret::Password(PW)), Err(CoreError::Tampered)));
    assert_eq!(s.all_docs().unwrap().len(), 2, "un fallo no toca los datos");
}

#[test]
fn un_archivo_cifrado_modificado_no_se_abre() {
    let dir = tempfile::tempdir().unwrap();
    {
        let mut s = file_store(dir.path());
        sample(&mut s);
        enable(&mut s);
        s.lock();
    }
    let db = dir.path().join("cuaderno.db");
    let mut bytes = std::fs::read(&db).unwrap();
    assert!(bytes.len() > 4096, "al menos una página completa");
    bytes[200] ^= 0xFF; // un byte cambiado dentro de la primera página
    std::fs::write(&db, bytes).unwrap();
    let mut s = file_store(dir.path());
    let r = s.unlock(PW).and_then(|_| s.all_docs().map(|_| ()));
    assert!(r.is_err(), "SQLCipher detecta que una página fue alterada");
}

#[test]
fn copias_de_seguridad_cifradas_y_en_claro() {
    let mut s = store();
    sample(&mut s);
    let plain = s.export_backup().unwrap();
    assert!(plain.contains("amanecer"));
    let words = enable(&mut s);
    let enc = s.export_backup().unwrap();
    assert!(!enc.contains("amanecer") && !enc.contains("Mural"));
    assert_eq!(Store::inspect_backup(&enc).unwrap().0, true);

    // Otro cuaderno sin cifrar importa la copia cifrada con la contraseña o con las palabras.
    let mut other = store();
    assert!(matches!(other.import_backup(&enc, BackupSecret::None), Err(CoreError::BackupNeedsSecret)));
    assert!(matches!(other.import_backup(&enc, BackupSecret::Password("mal mal mal")), Err(CoreError::WrongPassword)));
    assert_eq!(other.import_backup(&enc, BackupSecret::Password(PW)).unwrap(), 2);
    assert!(!other.status().unwrap().encrypted, "se guarda con el cifrado del destino (ninguno)");
    assert_eq!(other.all_docs().unwrap().len(), 2);
    let mut third = store();
    assert_eq!(third.import_backup(&enc, BackupSecret::Words(&words.join(" "))).unwrap(), 2);

    // Un cuaderno cifrado importa una copia en claro y la guarda cifrada.
    s.import_backup(&plain, BackupSecret::None).unwrap();
    assert!(s.status().unwrap().encrypted && !s.status().unwrap().locked);
    assert!(matches!(Store::inspect_backup("{\"hola\":1}"), Err(CoreError::NotABackup)));
}

#[test]
fn persistencia_en_disco() {
    let dir = tempfile::tempdir().unwrap();
    {
        let mut s = file_store(dir.path());
        sample(&mut s);
        enable(&mut s);
    }
    let mut s = file_store(dir.path());
    let st = s.status().unwrap();
    assert!(st.locked && st.encrypted, "al abrir de nuevo, empieza bloqueado");
    assert!(dir.path().join("cuaderno.vault.json").exists(), "la cabecera vive fuera de la base de datos");
    s.unlock(PW).unwrap();
    assert_eq!(s.all_docs().unwrap().len(), 2);
}

#[test]
fn desactivar_deja_el_archivo_legible_y_sin_cabecera() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = file_store(dir.path());
    sample(&mut s);
    enable(&mut s);
    s.disable_encryption(PW).unwrap();
    assert!(contains(&bytes_on_disk(dir.path()), "amanecer"));
    assert!(!dir.path().join("cuaderno.vault.json").exists());
    drop(s);
    let s = file_store(dir.path());
    assert!(!s.status().unwrap().encrypted);
    assert_eq!(s.all_docs().unwrap().len(), 2);
}

#[test]
fn activacion_interrumpida_se_termina_al_desbloquear() {
    // Simula un cierre justo después de escribir la cabecera y el archivo cifrado temporal,
    // pero antes de cambiar el archivo.
    let dir = tempfile::tempdir().unwrap();
    let words;
    {
        let mut s = file_store(dir.path());
        sample(&mut s);
        words = enable(&mut s);
        s.lock();
    }
    let db = dir.path().join("cuaderno.db");
    let enc = std::fs::read(&db).unwrap();
    std::fs::write(dir.path().join("cuaderno.db.enc-tmp"), &enc).unwrap();
    // el archivo «principal» sigue siendo el antiguo sin cifrar
    {
        let mut plain = Store::open_in_memory().unwrap();
        sample(&mut plain);
    }
    std::fs::write(&db, b"basura que no es una base de datos cifrada").unwrap();
    let mut s = file_store(dir.path());
    s.unlock(PW).unwrap();
    assert_eq!(s.all_docs().unwrap().len(), 2);
    assert!(!words.is_empty());
}

#[test]
fn desbloquear_sigue_funcionando_tras_una_desactivacion_interrumpida() {
    // La cabecera sigue en el disco pero el archivo ya se abre sin clave.
    let dir = tempfile::tempdir().unwrap();
    {
        let mut s = file_store(dir.path());
        sample(&mut s);
        enable(&mut s);
        s.lock();
    }
    let side = std::fs::read(dir.path().join("cuaderno.vault.json")).unwrap();
    {
        let mut s = file_store(dir.path());
        s.unlock(PW).unwrap();
        s.disable_encryption(PW).unwrap();
    }
    std::fs::write(dir.path().join("cuaderno.vault.json"), side).unwrap(); // cabecera «olvidada»
    let mut s = file_store(dir.path());
    s.unlock(PW).unwrap();
    assert!(!s.status().unwrap().encrypted, "se detecta que ya no está cifrado");
    assert_eq!(s.all_docs().unwrap().len(), 2);
}

#[test]
fn copias_internas_con_limite_y_restauracion() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = file_store(dir.path());
    sample(&mut s);
    enable(&mut s);
    let a = s.snapshot_create(3).unwrap();
    assert_eq!(a.docs, 2);
    s.put_docs(&[Doc { id: "c9".into(), kind: "card".into(), parent: None, pos: 3.0, updated: 0, data: json!({"body": "nuevo"}) }]).unwrap();
    for _ in 0..4 {
        s.snapshot_create(3).unwrap();
    }
    let list = s.snapshot_list().unwrap();
    assert_eq!(list.len(), 3, "se conservan solo las 3 últimas");
    assert!(list.windows(2).all(|w| w[0].id > w[1].id), "de la más reciente a la más antigua");
    assert!(list.iter().all(|c| c.docs == 3));
    // Las copias internas también están cifradas en disco.
    s.put_docs(&[Doc { id: "c10".into(), kind: "card".into(), parent: None, pos: 4.0, updated: 0, data: json!({"body": "solo-en-copia"}) }]).unwrap();
    s.snapshot_create(3).unwrap();
    assert!(!contains(&bytes_on_disk(dir.path()), "solo-en-copia"));
    // Restaurar una copia reemplaza los datos y deja una copia del estado anterior (se puede deshacer).
    s.delete_docs(&["c1".into(), "c9".into(), "c10".into()]).unwrap();
    assert_eq!(s.all_docs().unwrap().len(), 1);
    let newest = s.snapshot_list().unwrap()[0].id;
    assert_eq!(s.snapshot_restore(newest, 5).unwrap(), 4);
    assert_eq!(s.all_docs().unwrap().len(), 4);
    assert_eq!(s.snapshot_list().unwrap()[0].docs, 1, "la copia de seguridad previa a restaurar");
    assert!(s.snapshot_restore(9999, 5).is_err());
    s.lock();
    assert!(matches!(s.snapshot_list(), Err(CoreError::Locked)));
}

#[test]
fn parametros_reales_de_argon2() {
    // Con los parámetros de la app (64 MiB, 3 pasadas, 4 hilos) también funciona de principio a fin.
    assert_eq!(KdfParams::default(), KdfParams { m_kib: 64 * 1024, t: 3, p: 4 });
    let mut s = Store::open_in_memory().unwrap();
    sample(&mut s);
    let w = s.prepare_encryption(PW).unwrap();
    s.confirm_encryption(&[(5, w[5].clone())]).unwrap();
    s.lock();
    let t = std::time::Instant::now();
    s.unlock(PW).unwrap();
    eprintln!("desbloquear con Argon2id 64 MiB: {:?}", t.elapsed());
    assert_eq!(s.all_docs().unwrap().len(), 2);
}

#[test]
fn desbloqueo_rapido_con_la_clave_del_llavero() {
    let mut s = store();
    sample(&mut s);
    assert!(matches!(s.quick_enable(), Err(CoreError::NotEncrypted)));
    enable(&mut s);
    let (account, key) = s.quick_enable().unwrap();
    assert!(account.starts_with("cuaderno-"));
    assert_eq!(key.len(), 32);
    assert!(s.status().unwrap().quick_unlock);
    s.lock();
    // Una clave equivocada no abre (y no deja el cuaderno a medias).
    assert!(matches!(s.unlock_with_key(&[7u8; 32]), Err(CoreError::WrongPassword)));
    assert!(s.status().unwrap().locked);
    s.unlock_with_key(&key).unwrap();
    assert_eq!(s.all_docs().unwrap().len(), 2);
    // Cambiar la contraseña no invalida el desbloqueo rápido (la clave de datos es la misma).
    s.change_password(PW, "otra contraseña larga").unwrap();
    s.lock();
    s.unlock_with_key(&key).unwrap();
    // Desactivar.
    assert_eq!(s.quick_disable().unwrap(), Some(account));
    s.lock();
    assert!(s.unlock_with_key(&key).is_err());
    assert!(!s.status().unwrap().quick_unlock);
}

#[test]
fn quitar_el_cifrado_quita_el_desbloqueo_rapido() {
    let mut s = store();
    enable(&mut s);
    s.quick_enable().unwrap();
    s.disable_encryption(PW).unwrap();
    assert!(!s.status().unwrap().quick_unlock);
}
