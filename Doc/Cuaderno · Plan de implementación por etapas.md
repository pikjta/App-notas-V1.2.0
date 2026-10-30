# Cuaderno · Plan de implementación por etapas

Oct 20, 2026 · @mkbfdjmfrgmsq · Actualizado el 22 de octubre de 2026

## Decisiones aprobadas

Cuaderno será una app de escritorio para macOS, Linux y Windows, hecha con Tauri, TypeScript + React y SQLite, y con la contraseña protegida con Argon2id. Aprobado por el usuario el 20 de octubre de 2026.

| Tema | Decisión |
| --- | --- |
| Plataforma | App de escritorio para macOS, Linux y Windows |
| Herramienta de escritorio | Tauri |
| Interfaz | TypeScript + React |
| Almacenamiento | SQLite |
| Clave de la contraseña | Argon2id (sustituye a PBKDF2 de la maqueta) |
| Cifrado de SQLite | Archivo completo de la base de datos cifrado con SQLCipher, usando la clave derivada |
| Parámetros de Argon2id | 64 MiB de memoria, 3 pasadas, 4 hilos; guardados junto a los datos para poder subirlos en el futuro |
| Textos pensados para el navegador | Se adaptan al escritorio: «Notificaciones del navegador» → notificaciones del sistema; «en este navegador» → «en este ordenador»; se quitan «Navegador detectado» y las instrucciones para cambiar la carpeta de Descargas |
| Vista enlazada | No se implementa |
| Funciones | Exactamente las de la maqueta, según el documento «Cuaderno · Funciones de la maqueta», con las adaptaciones de esta tabla |
| Idiomas y festivos | Pasan a «Mejoras continuadas» del spec: no bloquean ninguna etapa. Los idiomas se implementaron después, en la versión 1.2.0 |

Comportamientos en escritorio que la maqueta no define, aprobados el 20 de octubre de 2026:

| Tema | Decisión |
| --- | --- |
| Cronómetro con la app cerrada | Sigue contando: se guarda la hora de inicio |
| Avisos con la app cerrada | Solo llegan con la app abierta, como dice la maqueta; sin segundo plano |
| Carpeta de backup por defecto | Descargas, con opción de elegir otra carpeta |
| Imágenes | Se guardan dentro de la base de datos cifrada |
| Modo oscuro del sistema | No se sigue; se mantiene el ambiente «Noche» como en la maqueta |
| Avisos de recordatorios | Se implementan como dicen los textos de ayuda de la maqueta: notificación del sistema, sonido suave y, al abrir la app, los recordatorios que pasaron mientras estaba cerrada |
| Enlaces normales texto | Al hacer clic se abren en el navegador del sistema (solo http, https y mailto) |

Las 24 palabras de recuperación siguen el estándar BIP-39 tal cual, como en la maqueta. Al tener 256 bits aleatorios, no necesitan Argon2id.

## Decisiones pendientes de aprobación

No quedan decisiones pendientes. Las recomendaciones de seguridad de la Nota 8 y la distribución (instaladores firmados y actualizaciones automáticas) pasan a «Mejoras continuadas» del spec. En la etapa 8 se generan instaladores sin firma, porque por ahora la app es de uso personal.

## Etapas

Nueve etapas, de la base técnica a la distribución. Cada una termina con algo usable y verificado contra la maqueta antes de pasar a la siguiente. Los números entre paréntesis remiten a los apartados del documento de funciones.

| Etapa | Contenido | Se da por terminada cuando |
| --- | --- | --- |
| 0 · Base técnica | Proyecto de escritorio con TypeScript + React; compilación en macOS, Linux y Windows; pruebas automáticas; estilos y tipografías de la maqueta | La app vacía se abre en los tres sistemas y las pruebas corren solas |
| 1 · Datos y seguridad de base | Esquema SQLite con el modelo de la maqueta; guardado instantáneo; motor de deshacer y rehacer (100 pasos); módulo criptográfico (AES-256-GCM, Argon2id, BIP-39) aún sin interfaz | Los datos de ejemplo se guardan, se recuperan al reiniciar y se deshacen; el cifrado pasa sus pruebas |
| 2 · Estructura y tableros | Barra lateral, carpetas, tareas principales, tablero libre (mover, redimensionar, color, imán, efecto foco), papeleras, búsqueda global, volver atrás (1, 2, 3, 11) | Se puede organizar todo como en la maqueta, sin tarjetas avanzadas |
| 3 · Tarjetas | Checklist, Recordatorio, Nota con editor Markdown y enlaces \[\[ \]\], Tabla, Imagen, Boceto, Paleta, Widgets y flechas entre tarjetas (3, 4, 5) | Los ocho tipos del menú y los widgets funcionan igual que en la maqueta |
| 4 · Vistas de tiempo | Hoy, Recordatorios, Calendario (vistas, calendarios, festivos, .ics), Diario y avisos de recordatorios (7, 8, 9) | Las vistas coinciden con la maqueta y los avisos llegan a su hora |
| 5 · Tabla PM | En las cuatro fases ya probadas en la maqueta: núcleo; páginas y organización; tiempo y fechas; cálculo y conexiones (6) | Pasan las pruebas de las Notas 2 a 6 de la maqueta |
| 6 · Grafo, ajustes y apariencia | Grafo, Ajustes (General, Recordatorios, Tablero, Datos), ambientes, colores, texturas y tipografías (10, 12, 15) | Todas las opciones de la maqueta están y funcionan |
| 7 · Copias y cifrado | Backup automático, interno y manual con carpeta elegida; cifrado con contraseña, 24 palabras, pantalla de bloqueo y bloqueo automático; copias cifradas (13, 14) | Se restaura una copia, se bloquea, se recupera con las palabras y nada legible queda en el disco |
| 8 · Pulido y entrega | Rendimiento con 500 filas o más, accesibilidad, legibilidad en todos los ambientes, pruebas manuales en los tres sistemas, exportación .md abierta en Obsidian, instaladores | Pasan las pruebas generales de la Nota 7 y la app se instala en los tres sistemas |

## Decisiones posteriores (22 de octubre de 2026)

| Tema | Decisión |
| --- | --- |
| Actualizaciones automáticas | Fuera por ahora (distribución: «Mejoras continuadas»). La app no busca ni instala versiones |
| Desbloqueo rápido (llavero, Touch ID, Windows Hello) | Fuera por ahora («Mejoras continuadas», seguridad extra) |
| Sonido y «Probar aviso» | Se mantienen en Ajustes → Recordatorios |
| Instaladores | Se generan sin firma con tres workflows de GitHub Actions lanzados a mano (Windows, Ubuntu y macOS), con `tauri-sin-actualizador.json` para desactivar los archivos del actualizador |
| Datos de ejemplo | Un cuaderno nuevo carga los datos de ejemplo de la maqueta; las copias automáticas e internas empiezan desactivadas |
| Buscador | Ventana que se abre con el botón «Buscar» o con ⌘K |
| Copia interna | Además de la copia dentro de la app, escribe un archivo en la subcarpeta «backup interno» |

## Registro por etapas

Estado a 22 de octubre de 2026. El usuario confirma que la app funciona como se esperaba.

| Etapa | Estado | Notas |
| --- | --- | --- |
| 0 · Base técnica | Hecha | Tauri 2, React, TypeScript y pruebas automáticas |
| 1 · Datos y seguridad de base | Hecha | SQLite con SQLCipher, deshacer de 100 pasos, Argon2id y BIP-39 |
| 2 · Estructura y tableros | Hecha | Barra lateral, carpetas, papeleras, búsqueda y volver atrás |
| 3 · Tarjetas | Hecha | Tarjeta en grande, enlaces entre notas, checklist con subtareas y recordatorio con selector de fecha |
| 4 · Vistas de tiempo | Hecha | Hoy, Recordatorios, Calendario (Día, Semana, Mes y Agenda), Diario y avisos |
| 5 · Tabla PM | Hecha | Pestañas de vista, página de la tarea, reglas, plantillas, relaciones y resúmenes |
| 6 · Grafo, ajustes y apariencia | Hecha | Grafo con «Resaltar…», «Reordenar» y zoom; Ajustes y personalización |
| 7 · Copias y cifrado | Hecha | Copias automática, interna y manual; cifrado, 24 palabras y bloqueo |
| 8 · Pulido y entrega | Hecha en lo automático | Probado con 1000 filas, contrastes de todos los ambientes e instaladores sin firma. Sin confirmar: abrir en Obsidian un `.md` exportado |

## Reglas de trabajo

- **Fidelidad estricta.** La maqueta es la referencia: textos, opciones y comportamiento se copian tal cual. Cualquier diferencia se pregunta antes y necesita aprobación explícita del usuario.
- **Documentos de referencia.** [Cuaderno · Spec global](https://claude.ai/code/artifact/ad47635a-8047-4d6d-8a54-cce55a375710), [Cuaderno · Funciones de la maqueta](https://claude.ai/code/artifact/07f88874-f3a3-4b82-8457-687ac0459374) y la [maqueta](https://claude.ai/artifact/RETmsPaktaGMNrrMDdGTPq), con sus Notas internas 1 a 8.
- **Verificación por etapa.** Cada etapa se compara pantalla a pantalla con la maqueta y repite las pruebas registradas en sus Notas 2 a 7.
- **Registro.** Al cerrar cada etapa se anota en este documento qué se hizo, qué se probó y qué decisiones se tomaron.
