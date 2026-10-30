// Las pruebas de la interfaz esperan los textos en español: se fija como «último idioma usado»
// para que no dependa del idioma del sistema donde se ejecuten.
try { localStorage.setItem('cuaderno.lang', 'es'); } catch { /* entorno sin localStorage (node) */ }
