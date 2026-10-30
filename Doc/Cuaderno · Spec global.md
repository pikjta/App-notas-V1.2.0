# Cuaderno · Spec global

Oct 20, 2026 · @mkbfdjmfrgmsq · Actualizado el 22 de octubre de 2026

## Qué es Cuaderno

Cuaderno es una agenda y organizador de proyectos personal que funciona entero en el ordenador del usuario, sin cuentas ni servidor. Reúne en una sola app lo que normalmente se reparte entre una agenda, un tablero de notas, un gestor de proyectos estilo Notion, un calendario y un diario de trabajo.

Está pensada para una persona que lleva varios proyectos a la vez —por ejemplo, encargos artísticos o de ilustración— y quiere verlos de forma visual, planificarlos con detalle y tener sus datos solo en su equipo.

El nombre de la sesión es «Cuaderno» por defecto y el usuario puede cambiarlo, igual que su tipografía. La interfaz está disponible en Español, English (británico), Français, Português (Portugal), Italiano y Deutsch; el ajuste de idioma la cambia al instante y el primer arranque usa el idioma del sistema (inglés si no coincide ninguno).

La definición nació en una maqueta interactiva publicada en claude.ai, titulada «Agenda local — maqueta». Este spec y el documento de funciones describen lo que esa maqueta contiene y las adaptaciones aprobadas para la app de escritorio.

## Principios

La app se rige por cinco principios, todos visibles en la maqueta:

- **Local y privada.** Los datos se guardan solo en el dispositivo; la barra lateral lo indica con la etiqueta «Local» («Todo se guarda solo en este dispositivo»). No hay cuentas, servidor ni sincronización.
- **Sin conexión.** Los festivos se calculan en el ordenador y la importación y exportación de calendarios (.ics) se procesa en local.
- **Visual.** Cada proyecto es un tablero libre de tarjetas que se mueven, redimensionan, colorean y unen con flechas.
- **Todo enlazado.** Notas, tareas, tarjetas, filas de tablas y notas diarias se conectan con enlaces `[[ ]]`, relaciones y flechas, y la vista Grafo muestra esas conexiones.
- **Nada se pierde.** Hay deshacer y rehacer, papelera, tres tipos de copia de seguridad y cifrado opcional con contraseña y 24 palabras de recuperación.

## Áreas principales

La barra lateral organiza la app en tres bloques: **Inicio**, **Vistas** (Hoy, Recordatorios, Calendario, Diario, Grafo y Papelera) y **Tareas principales**, que son los proyectos, agrupables en carpetas.

| Área | Qué ofrece |
| --- | --- |
| Inicio | Página principal; un tablero con widgets (Hoy, Próximos 7 días, Tareas principales) y tarjetas |
| Tareas principales | Un tablero libre por proyecto, con su color, título y apariencia propios |
| Tarjetas | Nueve tipos: Checklist, Recordatorio, Nota (Markdown), Tabla, Tabla PM, Imagen, Boceto, Paleta de color y Widget (solo en Inicio) |
| Tabla PM | Gestor de proyectos estilo Notion: columnas tipadas, fases y estados, fórmulas, relaciones, y vistas Tabla, Cronología, Kanban, Calendario y Galería |
| Hoy | Recordatorios de hoy, atrasados y próximos, checklists en curso y la nota del día |
| Recordatorios | Todos los recordatorios de todos los proyectos, ordenados por fecha y filtrables |
| Calendario | Vistas Día, Semana, Mes y Agenda, varios calendarios superpuestos, festivos por país e importación y exportación .ics |
| Diario | Una nota por día, con minicalendario, lista de entradas y los eventos de ese día |
| Grafo | Mapa de todas las conexiones entre proyectos, tarjetas, filas y notas diarias |
| Papelera | Proyectos y tarjetas eliminados, para restaurar o borrar definitivamente |
| Búsqueda global | Busca en todo: proyectos, tarjetas, notas, filas y celdas de las tablas |
| Ajustes | General, Recordatorios, Tablero, Backup, Seguridad y Datos |
| Personalización | Ambientes, colores y texturas de la barra lateral, el tablero y las tarjetas |

## Seguridad y datos

Los datos se guardan al instante y solo en el dispositivo; la protección se apoya en copias de seguridad y en un cifrado opcional.

- **Copias de seguridad, en tres niveles.** Backup automático (archivos periódicos que sobreviven aunque se borren los datos de la app), backup interno (copias dentro de la app para volver atrás) y backup manual (exportar o importar un archivo .json cuando el usuario quiera). Las copias se guardan en una carpeta elegida o en Descargas, en las subcarpetas «backup automático», «backup interno» y «backup manual».
- **Cifrado con contraseña.** Es opcional y viene desactivado. Al activarlo, los datos y las copias quedan cifrados; la app pide la contraseña al abrirse y se bloquea sola tras un tiempo sin uso. Si se olvida la contraseña, el acceso se recupera con 24 palabras, como en una billetera de criptomonedas.
- **Deshacer y papelera.** Casi todas las acciones se pueden deshacer, y lo eliminado pasa a la papelera antes de borrarse para siempre.
- **Formatos abiertos.** Las filas de las Tablas PM se exportan a Markdown compatible con Obsidian, las tablas a CSV y a Excel, y los calendarios a .ics.

## Estado actual

La app de escritorio existe y funciona como se esperaba (22 de octubre de 2026). Implementa las funciones de la maqueta con las adaptaciones al escritorio del plan.

- **App:** Tauri 2, TypeScript + React y SQLite cifrado con SQLCipher. Las funciones y sus textos están en «Cuaderno · Funciones de la maqueta»; el avance por etapas, en «Cuaderno · Plan de implementación por etapas».
- **Maqueta:** [Agenda local — maqueta](https://claude.ai/artifact/RETmsPaktaGMNrrMDdGTPq) sigue siendo la referencia de diseño. Su tarjeta «Notas internas de desarrollo» recoge las ocho notas de diseño.
- **Pruebas:** la app tiene pruebas automáticas de interfaz y de lógica (más de 100), además de un test con 1000 filas y otro de contraste en todos los ambientes.
- **Instaladores:** se generan sin firma con GitHub Actions (Windows, Ubuntu y macOS), lanzados a mano.
- **Sin confirmar:** abrir en Obsidian un `.md` exportado.

## Fuera de alcance y decisiones pendientes

Fuera de alcance: cuentas de usuario, servidor, sincronización entre dispositivos, colaboración y versión para móvil. La app es para un solo usuario en su ordenador.

Decisiones tomadas y pendientes (detalle en «Cuaderno · Plan de implementación por etapas»):

- [x] Plataforma: app de escritorio para macOS, Linux y Windows (aprobado el 20 de octubre de 2026)
- [x] Herramienta de escritorio: Tauri (aprobado el 20 de octubre de 2026)
- [x] Tecnología: TypeScript + React y SQLite (aprobado el 20 de octubre de 2026)
- [x] Derivación de la clave de la contraseña: Argon2id (aprobado el 20 de octubre de 2026)
- [x] Decisiones técnicas y de adaptación al escritorio (aprobadas el 20 de octubre de 2026; detalle en el plan)
- [x] Decisiones posteriores del 22 de octubre de 2026: sin actualizaciones automáticas ni desbloqueo rápido por ahora, sonido y «Probar aviso» incluidos (detalle en el plan)

## Mejoras continuadas

Mejoras que no bloquean ninguna etapa y se irán ampliando después de la primera versión.

- **Idiomas:** la maqueta solo tiene textos en español. **Se implementa en la versión 1.2.0** (ver «Mejoras version1.2.0»): interfaz, fechas, fórmulas, datos de ejemplo y plantillas en español, English, Français, Português, Italiano y Deutsch. El idioma inicial es el del sistema (inglés si no coincide ninguno).
- **Festivos:** la maqueta incluye el calendario de festivos solo de algunos países.
- **Seguridad extra (Nota 8):** llavero del sistema con Touch ID / Windows Hello, bloquear al minimizar, limpiar el portapapeles tras copiar las 24 palabras, fuentes incluidas en la app en lugar de Google Fonts y política de seguridad de contenido (CSP) estricta.
- **Distribución:** instaladores firmados y actualizaciones automáticas. Por ahora la app es de uso personal, así que se instala sin firma y se actualiza a mano. El código del actualizador y del desbloqueo rápido sigue en el proyecto sin usarse.
