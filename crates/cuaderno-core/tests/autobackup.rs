use cuaderno_core::autobackup::{ensure_sub, list_auto_backups, list_auto_in, write_auto_backup, write_auto_in, write_internal_file, write_manual_backup};

#[test]
fn escribe_rota_y_no_toca_otros_archivos() {
    let dir = tempfile::tempdir().unwrap();
    let p = dir.path();
    std::fs::write(p.join("mis_fotos.json"), "no tocar").unwrap();
    std::fs::write(p.join("cuaderno_auto_notas.txt"), "tampoco").unwrap();
    for (i, stamp) in ["2026-10-01_0900", "2026-10-02_0900", "2026-10-03_0900", "2026-10-04_0900"].iter().enumerate() {
        let name = write_auto_backup(p, &format!("{{\"n\":{i}}}"), stamp, i % 2 == 1, 3).unwrap();
        assert!(name.starts_with("cuaderno_auto_"));
    }
    let list = list_auto_backups(p).unwrap();
    assert_eq!(list, vec!["cuaderno_auto_2026-10-04_0900_cifrado.json", "cuaderno_auto_2026-10-03_0900.json", "cuaderno_auto_2026-10-02_0900_cifrado.json"]);
    assert_eq!(std::fs::read_to_string(p.join("mis_fotos.json")).unwrap(), "no tocar");
    assert!(p.join("cuaderno_auto_notas.txt").exists());
    assert!(!std::fs::read_dir(p).unwrap().any(|e| e.unwrap().file_name().to_string_lossy().ends_with(".tmp")));
}

#[test]
fn rechaza_sellos_raros_y_carpetas_inexistentes() {
    let dir = tempfile::tempdir().unwrap();
    assert!(write_auto_backup(dir.path(), "{}", "../../etc", false, 3).is_err());
    assert!(write_auto_backup(dir.path(), "{}", "", false, 3).is_err());
    assert!(write_auto_backup(&dir.path().join("no-existe"), "{}", "2026-10-01_0900", false, 3).is_err());
}

#[test]
fn subcarpetas_automatica_y_manual() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path();
    assert!(list_auto_in(base).unwrap().is_empty(), "sin carpeta aún: lista vacía");
    let a = write_auto_in(base, "{}", "2026-10-20_0900", false, 5).unwrap();
    let m = write_manual_backup(base, "{}", "2026-10-20_0905", true).unwrap();
    assert_eq!(a, "cuaderno_auto_2026-10-20_0900.json");
    assert_eq!(m, "cuaderno_manual_2026-10-20_0905_cifrado.json");
    assert!(base.join("backup automático").join(&a).exists());
    assert!(base.join("backup manual").join(&m).exists());
    assert_eq!(list_auto_in(base).unwrap(), vec![a]);
    // las copias manuales no se borran nunca
    for i in 0..4 {
        write_manual_backup(base, "{}", &format!("2026-10-2{i}_1000"), false).unwrap();
    }
    assert_eq!(std::fs::read_dir(base.join("backup manual")).unwrap().count(), 5);
    assert!(ensure_sub(base, "otra cosa").is_err());
    assert!(ensure_sub(&base.join("no-existe"), "backup manual").is_err());
    assert!(write_manual_backup(base, "{}", "../x", false).is_err());
}

#[test]
fn copia_interna_en_archivo_se_poda() {
    let d = tempfile::tempdir().unwrap();
    for i in 0..4 {
        write_internal_file(d.path(), "[]", &format!("2026-01-0{}_0900", i + 1), true, 2).unwrap();
    }
    let sub = d.path().join("backup interno");
    let mut n: Vec<_> = std::fs::read_dir(&sub).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).collect();
    n.sort();
    assert_eq!(n, vec!["cuaderno_interno_2026-01-03_0900_cifrado.json", "cuaderno_interno_2026-01-04_0900_cifrado.json"]);
}
