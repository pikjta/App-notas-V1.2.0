// Evita una ventana de consola extra en Windows (versión final).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cuaderno_lib::run()
}
