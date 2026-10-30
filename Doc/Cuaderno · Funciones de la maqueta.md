# Cuaderno · Funciones de la maqueta

Oct 20, 2026 · @mkbfdjmfrgmsq

Inventario de todas las funciones de la última versión de la maqueta, con sus textos y opciones tal como aparecen en pantalla.

**Actualizado el 22 de octubre de 2026 con la app de escritorio.** La app implementa estas funciones. Donde difiere de la maqueta, se indica con «En la app»: son las adaptaciones al escritorio aprobadas en el plan y los cambios posteriores acordados con el usuario.

## 1. Barra lateral y estructura general

La pantalla tiene una barra lateral fija a la izquierda y el área principal a la derecha, que muestra la vista o el tablero elegido.

**Nombre de la sesión.** Arriba, el nombre «Cuaderno», editable al hacer clic («Haz clic para cambiar el nombre de la sesión»). El botón «Aa» abre «Fuente del nombre», con:

- Fuente, entre 12: Clásica, Elegante, Moderna, Geométrica, Manuscrita, Máquina, Editorial, Libro, Artística, Titular, Cartel y Rotulador. Cada botón muestra «Aa» en su tipografía.
- Tamaño (S, M, L), Grosor (Normal, Semi, Negrita), Estilo (Recta, Cursiva) y Color («Tinta (según la barra)» o colores de la paleta).
- Botón «Restablecer».

**Buscador.** Botón «Buscar» (⌘K) que abre el campo «Buscar en todo…» (ver apartado 2).

**Navegación.**

- **Inicio.**
- **Vistas:** Hoy, Recordatorios, Calendario, Grafo, Diario y Papelera. **En la app** la Papelera está justo debajo de Diario, dentro de Vistas.
- **Tareas principales:** cada proyecto muestra su punto de color, su nombre, un contador de hechas/total y una barra de progreso. Al pasar el cursor aparecen «Mover a una carpeta» (menú «Mover a» con las carpetas y «Sin carpeta») y «Mover a la papelera».
- **Carpetas:** plegables, con nombre editable, botón «Nueva tarea principal aquí» y «Eliminar carpeta (las tareas se conservan)». Si no tienen nada, muestran «Carpeta vacía».
- Botones al final de la lista: «+ Tarea principal» y «Carpeta».

**Cronómetro activo.** Cuando hay un cronómetro en marcha en una Tabla PM, aparece un indicador con el tiempo en directo y el nombre de la tarea («Ir a la tarea»), más un botón «Detener».

**Pie de la barra.**

- Indicador de backup, que abre su configuración. Con el backup automático activo muestra «Backup activo» y su frecuencia («Automático … · interno cada …»).
- Botones: Ajustes, «Bloquear ahora» (solo con el cifrado activado) y «Personalizar barra».
- Etiqueta «Local», con la ayuda «Todo se guarda solo en este dispositivo».

**Volver atrás.** Al saltar a otro sitio desde un enlace o una búsqueda, aparece un botón para volver («Volver a la vista anterior» o «Volver a «nombre de la tarea»»).

## 2. Búsqueda global

El campo «Buscar en todo…» busca en toda la app mientras se escribe, sin distinguir tildes ni mayúsculas. **En la app** se abre en una ventana desde el botón «Buscar» de la barra lateral o con ⌘K / Ctrl+K.

- **Qué indexa:** nombres de tareas principales; títulos de tarjetas; tareas y subtareas de los checklists; líneas de las notas; cabeceras y celdas de las tablas simples; celdas de las Tablas PM; y líneas de las notas diarias.
- **Resultados:** cada uno muestra el texto con la coincidencia resaltada, su tipo (Tarea principal, Tarea, Subtarea, Nota, Columna, Celda, Nota diaria, Tabla PM…) y su ruta («Proyecto › Tarjeta»). Si no hay ninguno: «Sin resultados para «…»».
- **Teclado:** «↑↓ para moverte · Enter para abrir»; el botón × borra la búsqueda.
- **Al abrir un resultado:** una tarjeta se centra en su tablero y parpadea un momento; una fila de Tabla PM abre su tabla y su página; una nota diaria abre el Diario en ese día.

## 3. Tablero de una tarea principal

Cada tarea principal (e Inicio) es un tablero libre donde las tarjetas se colocan a mano.

**Cabecera.**

- Título editable («Sin nombre» si está vacío).
- Botón «Aa» → «Fuente del título», con las mismas 12 fuentes, Grosor y Estilo que el nombre de la sesión; Tamaño S, M, L y XL; y Color: Tinta (según el fondo), Color de la tarea, Carbón, Hueso, Terracota, Bermellón, Magenta, Ciruela, Índigo, Cobalto, Turquesa, Oliva, Ocre y Piedra.
- Porcentaje de progreso con barra y un resumen.
- Botones «Personalizar tablero» (ver apartado 15) y «Añadir tarjeta».

**Menú «Añadir tarjeta».** Cada opción lleva su descripción:

- Checklist (Lista de subtareas con progreso)
- Recordatorio (Fecha, hora y aviso)
- Nota (Texto libre)
- Tabla (Filas y columnas, tipo Excel)
- Tabla PM (Seguimiento de proyecto con fases, estilo Notion)
- Imagen (Referencia o boceto; también puedes soltarla en el tablero)
- Boceto (Dibuja a mano alzada)
- Paleta de color (Colores con sus códigos; o extráela de una imagen)
- Solo en Inicio: Widget · Hoy, Widget · Próximos 7 días y Widget · Tareas principales

**Barra de herramientas.**

- «Imán»: interruptor que alinea las tarjetas a una cuadrícula invisible.
- «Deshacer» (⌘Z / Ctrl+Z) y «Rehacer».
- «Papelera» con contador: abre «Papelera de «tablero»», con «Restaurar», eliminar definitivamente (confirmación «Borrar para siempre») y vaciar la papelera del tablero. Si no hay nada: «No hay tarjetas eliminadas en este tablero.».

**Mover y redimensionar.** Ayuda en pantalla: «Arrastra por la franja superior · esquina inferior para el tamaño · doble clic para abrir en grande». Al pasar el cursor por una tarjeta, las demás se atenúan (Efecto foco).

**Tablero vacío.** Muestra «Tablero vacío», «Añade una tarjeta o suelta aquí una imagen.» y el botón «Añadir primera tarjeta».

**Soltar imágenes.** Una imagen arrastrada desde el ordenador crea una tarjeta Imagen en ese punto.

**Flechas entre tarjetas.**

- Al pasar el cursor por una tarjeta aparecen puntos ●. Arrastrar uno hasta otra tarjeta crea una flecha curva («Flecha creada · pasa el cursor por ella para editarla»). Si ya están unidas: «Esas tarjetas ya están unidas».
- Al hacer clic en la flecha se abre su menú: «Etiqueta (opcional)», Color, «Flecha en ambos sentidos», «↺ Invertir dirección» y «Eliminar flecha». El menú no se cierra mientras se escribe la etiqueta.
- Las flechas siguen a las tarjetas al moverlas. Si una tarjeta va a la papelera, su flecha se oculta y vuelve al restaurarla.

## 4. Tarjetas

**Común a todas.**

- **Franja superior:** se arrastra para mover la tarjeta y muestra su tipo y tres botones: «Color de la tarjeta», «Abrir en grande» y «Eliminar tarjeta» (va a la papelera: «Tarjeta movida a la papelera»).
- **Colores:** Automático (según el tablero), Mantequilla, Melocotón, Rosa, Lila, Cielo, Menta, Papel, Tinta, Bosque y los de etiqueta Ilustración, Pintura, Cliente, Urgente y Digital. **En la app** (mejora 1.1.0) el botón de color es un icono (paleta por defecto, configurable en «Personalizar barra») que abre «Color de la tarjeta»: un selector libre con cuadro de saturación y brillo, barra de tono, campos HSB en una columna y RGB en otra (cada uno con su icono: rueda de color, gota, sol, y un punto rojo, verde y azul), HEX, el color nuevo junto al actual y los botones «Automático», «Cancelar» y «Aceptar». Ya no hay colores predefinidos; las tarjetas que tenían uno lo conservan. El texto se contrasta solo.
- **Título:** editable («Sin título»).
- **Tamaño:** se cambia desde la esquina inferior.
- **Abrir en grande:** muestra la tarjeta en la ventana «Tarjeta en grande», con el mismo contenido y controles, su color, su título y «Cerrar (Esc)».

**Checklist.**

- Tareas con casilla y subtareas plegables. Las tareas con subtareas muestran un estado parcial y su contador.
- Botones «Añadir tarea» y «Añadir subtarea» (pregunta «¿Dentro de qué tarea?»). **En la app** (mejora 1.1.0) solo queda «+ Añadir tarea» abajo; cada tarea y cada subtarea tiene un botón (+) junto al de plegar que añade una subtarea (hasta 5 niveles, con la viñeta de cada nivel más a la derecha), y ya no existe la pregunta «¿Dentro de qué tarea?».
- **En la app** (mejora 1.1.0): una barra de formato (negrita, cursiva, subrayado, tachado, color de texto y resaltado) sobre la lista aplica el formato a las tareas seleccionadas.
- Atajo: Tab convierte una tarea en subtarea de la anterior y Mayús+Tab lo deshace. **En la app** (mejora 1.1.0): el texto largo se parte en varias líneas (en cualquier carácter, como una terminal); ↑ y ↓ pasan a la tarea anterior o siguiente (en un texto de varias líneas, desde la primera o la última); Ctrl+A selecciona todas las tareas (también se pueden seleccionar con el ratón arrastrando de una tarea a otra o con Mayús+clic, y se copian igual con Ctrl+C; dentro de una tarea el ratón selecciona texto con normalidad), Ctrl+C las copia como Markdown (`- [ ] tarea`, con sangría para las subtareas), Ctrl+X las corta y Ctrl+V pega varias líneas como varias tareas (con todo seleccionado, reemplaza la lista).
- La tarjeta muestra su progreso, que suma al de la tarea principal.

**Recordatorio.**

- Muestra la fecha en grande (mes y día), el tiempo relativo y la fecha completa, con un botón para activar o silenciar el aviso.
- El selector de fecha ofrece atajos (Hoy, Mañana, En una semana), un calendario mensual, Hora y Minutos, y «Listo».

**Nota.** Texto en Markdown con barra de formato y enlaces `[[ ]]` (ver apartado 5). **En la app** (mejora 1.1.0) la nota es un editor de texto formateado, sin sintaxis Markdown a la vista, que se modifica con la barra de formato de la tarjeta. Si está vacía: «Nota vacía. Haz clic para escribir.».

**Tabla.** Tabla simple con cabeceras editables, «Añadir columna», «Eliminar columna», celdas editables, «+ Nueva fila» y «Eliminar fila». **En la app** (mejora 1.1.0) la tabla se maneja como una hoja de cálculo: clic selecciona, doble clic o escribir edita, las flechas se mueven (Mayús o arrastrar amplían el rango), Ctrl+A elige toda la tabla, Ctrl+C / X / V copian, cortan y pegan rangos (texto con tabuladores, compatible con Excel; la tabla crece al pegar) y al escribir se sugieren palabras de la misma columna. Una celda que empieza por «=» es una fórmula (`=B2*C2`, `=suma(D2:D9)`; A1 es la cabecera de la primera columna): se ve el resultado, una barra superior muestra la celda activa y su contenido, y un error abre una ventana que lo explica.

**Tabla PM.**

- En el tablero muestra un resumen: pestañas, barra de progreso con resumen, las primeras filas con sus etiquetas y su %, el número de filas restantes y el botón «Abrir tabla». **En la app** (mejora 1.1.0) cada fila muestra las 3 primeras columnas visibles de la tabla.
- Al abrirla se ve la tabla completa (ver apartado 6).

**Imagen.**

- Zona «Suelta una imagen aquí o haz clic para elegirla» y botón «Cambiar».
- Clic en la imagen para ampliarla.
- Botón «Extraer paleta» (Crear una tarjeta con los colores principales de la imagen): crea una tarjeta Paleta unida a la imagen con una flecha.

**Boceto.**

- Lienzo para dibujar a mano alzada («Dibuja aquí con el ratón o el lápiz»), con trazos suavizados.
- Herramientas: Lápiz, Rotulador (translúcido) y Borrador; grosores Fino, Medio y Grueso; ocho colores.
- Botones «↶ Deshacer trazo» y «Borrar todo» (con confirmación «¿Borrar el dibujo? · No · Borrar»).

**Paleta de color.**

- Muestras de color con su código en HEX, RGB o HSL; clic en una muestra copia su código.
- Botones «Copiar todos», «Cambiar color», «Quitar color» y «Añadir color».
- Si viene de una imagen, indica «Extraída de «imagen»».

**Widgets (solo en Inicio).**

- Widget · Hoy: lo de hoy en todos los calendarios.
- Widget · Próximos 7 días: lo que viene esa semana.
- Widget · Tareas principales: el progreso de cada tarea.
- Cada fila abre su elemento.

## 5. Editor Markdown y enlaces \[\[ \]\]

Las notas (tarjetas Nota y notas diarias) se leen ya formateadas y se editan con un clic sobre el texto («Haz clic en el texto para editar»).

- **Minibarra de formato:** Negrita (Ctrl+B), Cursiva (Ctrl+I), Tachado, Título, Lista, Casilla de tarea, Cita, Código (`</>`), Enlace, «Enlace a otra tarea principal \[\[ \]\]» y «Listo».
- **Escritura:** Enter continúa listas y casillas. Clic fuera de la nota cierra el editor; los cambios se guardan mientras se escribe.
- **Lectura:** títulos, negrita, cursiva, tachado, código, citas, listas, enlaces y casillas de tarea, que se marcan directamente en la nota.
- **Selector de enlace («Enlazar a…»):** buscador «Buscar tarea principal o tarjeta…» y casilla «Incluir tarjetas». Inserta `[[destino|nombre_del_enlace]]`.
- **Enlaces `[[ ]]`:** llevan a una tarea principal, una tarjeta, una fila de Tabla PM o una nota diaria (`[[Diario/2026-09-27|ayer]]`). Al seguirlos aparece el botón de volver.
- **Enlazado desde:** las páginas de fila de la Tabla PM muestran qué notas las enlazan (ver apartado 6).

Además, las palabras precedidas de # (por ejemplo, #diseño) se muestran como etiquetas. Los enlaces normales `[texto](url)` se muestran subrayados en azul, y **en la app** se abren en el navegador del sistema al hacer clic (solo http, https y mailto). En la maqueta no se abrían.

## 6. Tabla PM

Gestor de proyectos estilo Notion dentro de una tarjeta. Se abre en grande en una ventana propia; Esc la cierra.

**Crear.** Al añadir una Tabla PM aparece «Nueva Tabla PM» («Elige una plantilla para empezar. Después puedes cambiar columnas, fases y estados.»), con cuatro plantillas:

- Proyecto con fases (Inicio → Desarrollo → Verificación → Entrega): Tarea · Estado · Progreso · Responsable · Etiquetas · Fechas · Horas · Presupuesto · Facturado.
- Encargo artístico (del primer contacto al cobro): Pieza · Estado · Progreso · Cliente · Fechas · Precio · Pagado · Etiquetas.
- Contenidos y redes (de la idea a publicado, por plataforma): Pieza · Estado · Progreso · Plataforma · Publicación · Etiquetas.
- Tabla vacía (solo una columna de texto).

Las plantillas propias aparecen con la etiqueta «TUYA» y se pueden eliminar.

**En la app (mejora 1.1.0) · formato, columnas y tareas.** La vista Tabla tiene una barra de formato a la izquierda de «Archivadas»: negrita, cursiva, subrayado, tachado, color de texto, resaltado, alineación y «Quitar formato», aplicados a las celdas seleccionadas (texto, número, fórmula y resumen). Al arrastrar una columna no se selecciona texto y una etiqueta con su nombre sigue al ratón. «Duplicar tabla» cierra la tabla en edición para ver las dos. Copiar y pegar lleva solo el texto.

**En la app (mejora 1.1.0) · fórmulas como en Excel.** En columnas de Número, una celda que empieza por «=» es una fórmula (`=B2*C3`, `=SUMA(B2:B9)`); se calcula con Enter o al hacer clic fuera. La cabecera es la fila 1 y los datos empiezan en la fila 2. Las filas que no existen valen vacío (`=SUMA(A2:A34)` funciona aunque haya menos filas). Los tipos «Fórmula» y «Resumen» ya no se ofrecen. Funciones: SUMA, PROMEDIO, CONTAR, CONTARA, MAX, MIN, SI, Y, O, NO, REDONDEAR, ABS, ENTERO, RAIZ, POTENCIA, RESIDUO, HOY, CONCATENAR, MAYUSC, MINUSC, LARGO. Ctrl+A y Ctrl+C copian toda la tabla con sus cabeceras; al pegar en otra tabla se crean las filas y columnas que falten.

**En la app (mejora 1.1.0) · vista Tabla como hoja de cálculo.** Un clic selecciona una celda; doble clic, F2 o escribir la editan (los menús de estado, selección, etiquetas, fecha, relación e imágenes se abren con doble clic o F2). Flechas, Mayús o arrastrar para elegir un rango, Ctrl+A para toda la tabla, Ctrl+C / X / V para copiar, cortar y pegar rangos con texto separado por tabuladores (cada texto se convierte al tipo de su columna; si se pegan más filas, se añaden), Supr para vaciar, y sugerencias de autocompletado con las palabras de la misma columna en las columnas de texto.

**Cabecera de la tabla abierta.**

- Título editable.
- Buscador «Buscar en esta tabla…»: busca en todas las columnas y descripciones, sin tildes.
- Menú «Opciones de la tabla»: ☰ Propiedades (columnas visibles), 🖌 Formato condicional, ⧉ Copiar para pegar en Excel, ⇅ Importar / exportar CSV, 💾 Guardar como plantilla, ⎘ Duplicar tabla y 🗑 Mover la tabla a la papelera.
- La cabecera y la barra tienen un tinte suave del color de la tarea principal, y la pestaña activa lleva su color sólido.

**Vistas.**

- Por defecto: Tabla, Cronología y Kanban. El botón «+» añade Tabla, Kanban, Cronología, Calendario o Galería.
- Las pestañas se arrastran para reordenarlas. Doble clic o ▾ abre el menú de la vista: nombre, «← Mover · Mover →», «Duplicar vista» y «Eliminar vista».
- Cada vista guarda sus filtros, orden y agrupación y, en la cronología, su propio orden de filas.

**Barra de herramientas.**

- «Filtros», con un contador. Combinación «Todas (Y)» o «Cualquiera (O)», con operadores según el tipo: contiene, es, está en la fase, está vencida, es antes de, es después de, está marcada, =, >, <, está vacío…
- «Ordenar y agrupar»: varias columnas («Ordenar por», «luego por») y «Agrupar filas por». Sin orden, las filas siguen el orden manual y se pueden arrastrar.
- «Nueva columna» y «Nueva fila».
- Botón «Archivadas · N», para mostrar las filas archivadas atenuadas.

**Tipos de columna.** Texto, Número (formatos 1.234, €, % y Horas), Selección, Selección múltiple (etiquetas globales, compartidas por toda la app), Estado con fases, Progreso, Casilla, Fecha (día o rango; el selector tiene un calendario mensual, el interruptor «Rango» —«Elige el día de inicio y luego el de fin»—, «Hoy» y «Quitar fecha»), Tiempo (cronómetro), Fórmula, Relación, Resumen e Imágenes. Cada categoría tiene su icono y su color.

**Menú de columna.**

- ↑ Ordenar ascendente, ↓ Ordenar descendente, ← Insertar columna a la izquierda, → Insertar columna a la derecha y Ocultar columna.
- Configuración: nombre, Tipo, Formato y eliminar (pide confirmación: «¿Eliminar «columna» y todos sus datos?»).
- Las columnas se redimensionan y se mueven arrastrando. La primera columna queda fija.

**Opciones, fases y progreso.**

- Selección: opciones con nombre y color; el selector de celda permite «Buscar o crear…», «Quitar» y «Editar opciones».
- Estado con fases: editor «Fases y estados» con fases de color y estados dentro de cada fase.
- Progreso: «Calcular desde» un estado. El primer estado vale 0 % y el último 100 %.

**Fórmulas.**

- Editor con vista previa del resultado. Columnas insertables con un clic.
- Funciones: if, round, concat, dateBetween, dateAdd, today, min, max, contains y formatDate.
- Operadores: + − × ÷ ( ) > < == and or. Las columnas se guardan por identidad, así que se pueden renombrar sin romper la fórmula.
- Errores explicados: «Referencia circular entre fórmulas», «Función desconocida»…
- **En la app** (mejora 1.1.0): referencias tipo Excel. `B2` es la celda de la columna B y la fila 2 (cada cabecera muestra su letra y la columna de agarre el número de fila); `B2:C9` y `B:B` son rangos que se usan en funciones como `suma`, `promedio`, `contar`, `min` y `max` (también existen `si`, `redondear`, `concatenar`, `hoy`…, con argumentos separados por coma o punto y coma); `{B}` es la columna B de la misma fila. La referencia se guarda por identidad de fila y columna, así que sigue apuntando a la misma celda al reordenar, ordenar o filtrar; si se borra, aparece `#REF`. Una celda con error muestra «⚠ Error» y, al hacer clic, una ventana explica qué pasó y cómo arreglarlo.

**Relación y Resumen.**

- Al hacer clic en la celda se abre un selector con dos pestañas. «Interna»: filas de otra Tabla PM. «Externa»: cualquier tarea principal, tarjeta o fila, con la casilla «Incluir tarjetas y filas».
- Cada enlace admite un alias. Clic en una pastilla abre una vista previa dentro de la tabla, con «Ver» y «Quitar».
- Resumen: Relación, Columna y Cálculo (Contar filas, Suma, Media, Mínimo, Máximo, % completadas, Mostrar valores). Las filas archivadas no cuentan.

**Tabla.**

- Filas alternas y resaltado al pasar el cursor.
- Grupos plegables.
- Paginación de 100 filas.
- Fila «Total» con un cálculo por columna: Suma, Media, Mínimo, Máximo, Contar, % marcadas, Marcadas, Con valor, Vacías, Con fecha, Vencidas…
- Navegación con teclado.
- El asa ⋮⋮ de cada fila se arrastra para moverla o se pulsa para abrir su menú: Abrir como página, Duplicar, Insertar fila debajo, Archivar y Eliminar fila.

**Cronología.**

- Barras con título y etiqueta, del color de la fase y verdes al 100 %.
- Ayuda: «Arrastra una tarea en horizontal para cambiar fechas y en vertical para reordenarla · sus bordes cambian la duración · los puntos ● crean dependencias · pasa el cursor por una flecha y pulsa × para quitarla».
- Zoom Días, Semanas y Meses; botones «Hoy» y «Restablecer orden».
- Interruptor «Desplazar dependientes»: al mover una tarea, desplaza las que dependen de ella.
- Hitos ◆.
- Si una dependencia no cuadra en fechas, su flecha se ve en rojo, sin ventana de aviso. No se permiten ciclos.
- Filas sin fecha: «Sin fecha · clic en la línea para planificarla». Sin columna de fecha: «Añade una columna de tipo Fecha para usar la cronología.».

**Kanban.**

- «Columnas por» cualquier columna de selección, estado, casilla, relación o etiquetas.
- Las tarjetas se arrastran entre columnas para cambiar ese valor; «Añadir aquí» crea una fila en esa columna.
- Cada columna tiene un fondo suave y un borde superior de su color.

**Calendario.** Mes con las filas arrastrables a otro día, y una columna lateral «Sin fecha».

**Galería.** Tarjetas con portada (la primera imagen) en tamaños S, M y L. Sin columna de imágenes: «Añade una columna de tipo «Imágenes» para mostrar portadas en las tarjetas.».

**Página de la fila (panel lateral «Página de la tarea»).**

- Botones: «\[\[ \]\] Enlace» (copia el enlace), descargar como .md (compatible con Obsidian) y «Copiar» (el Markdown).
- Título y todas sus propiedades editables.
- «Planificación»: ◆ Hito, ↻ Repetir (Nunca, Semana, Mes, Año), ⛓ Bloqueada por y Bloquea a.
- «Descripción» en Markdown; «/» abre «Insertar bloque»: Título 1, 2 y 3, Lista, Lista numerada, Tarea, Cita, Código, Separador y Enlace interno.
- «Subtareas» con progreso.
- «Historial de estados», con la duración de cada fase.
- «Enlazado desde»: las notas que enlazan la fila.

**Comportamientos.**

- **Recurrentes:** al pasar al último estado se crea la siguiente repetición, con las fechas desplazadas, las casillas desmarcadas y el primer estado.
- **Cronómetro:** solo uno activo a la vez, con indicador en la barra lateral.
- **Archivadas:** no cuentan en los totales ni en el progreso.
- **Formato condicional:** «la primera regla que se cumple manda». Cada regla es una condición más color y negrita, con prioridad editable. Sugerencias: Vencidas en rojo, Completadas en verde, Sin estado en gris. Se aplica en la tabla, el Kanban y la cronología.

**CSV y Excel.**

- «Copiar para pegar en Excel»: cada dato cae en su celda al pegarlo en Excel, LibreOffice o Google Sheets.
- Exportar la vista actual: «Descargar .csv» o «Copiar CSV», con separador configurable (punto y coma por defecto, para Excel en español).
- Importar: «Elegir archivo .csv». Detecta el separador y los tipos, y permite asignar cada columna antes de importar. Se puede deshacer.

## 7. Hoy y Recordatorios

**Hoy.**

- Cabecera con la fecha larga y tres contadores: «para hoy», «atrasados» (en rojo si hay alguno) y «checklists en curso».
- Bloque «Nota de hoy». Si ya existe, muestra un adelanto y «Abrir en el diario →». Si no, muestra «+ Escribir la nota de hoy» y el texto «Un diario de trabajo: plan del día, notas e ideas, con enlaces \[\[ \]\] a tus tareas.».
- Recordatorios agrupados (Atrasados, hoy…). Cada uno muestra la fecha, el título, su ruta, la hora, el botón «Activar o silenciar aviso» y «Abrir». Si no hay ninguno: «No tienes recordatorios para hoy ni atrasados.».
- «Checklists en curso»: lista con su contador y su proyecto; cada uno abre su tarjeta.

**Recordatorios.**

- Subtítulo: «Todos los recordatorios de todas tus tareas principales, ordenados por fecha».
- Filtros: Todos, Con aviso y Silenciados.
- Recordatorios agrupados por fecha, con los mismos controles que en Hoy. Si no hay ninguno: «No hay recordatorios con este filtro.».

## 8. Calendario

**Navegación.**

- Modos Día, Semana y Mes, más el botón «Agenda» (los próximos 30 días).
- Botones «Hoy», Anterior y Siguiente, y «Añadir recordatorio».
- Minicalendario lateral.
- Leyenda «En pantalla» con los calendarios visibles.
- Ayuda: «Arrastra un recordatorio para cambiarlo de día u hora. Los festivos aparecen resaltados.».

**Vista Mes.** Cada día tiene «Ver este día», un icono 📓 si tiene nota diaria (abre esa nota) y «Añadir nota o recordatorio». Muestra los eventos como chips y un «+N» si hay más.

**Vistas Día y Semana.**

- Fila «Todo el día» y rejilla horaria.
- Los eventos se arrastran para cambiarlos de día u hora («Movido al …»).
- Cada día de la cabecera abre su vista o añade un recordatorio.

**Agenda.** Los próximos 30 días de los calendarios visibles. Si no hay nada: «Nada en los próximos 30 días en los calendarios visibles.».

**Calendarios.**

- Por defecto: Cuaderno (recordatorios de tableros y recordatorios simples), Cumpleaños y Festivos.
- Panel «Calendarios · Superponer en pantalla», con casillas por calendario y «Seleccionar todos» / «Deseleccionar todos».
- Color de cada calendario.
- «Eliminar calendario», con confirmación.
- «Añadir calendario» abre «Nuevo calendario»: nombre («Ej.: Viajes, Médico, Clases…»), color y el aviso «Las notas y recordatorios que añadas aquí vivirán solo dentro de este calendario.».

**Nota o recordatorio de calendario.**

- Campos: Calendario, Título («Ej.: Cumpleaños de Ana»), tipo («Recordatorio · con hora» o «Nota · todo el día»), Fecha (con día anterior y siguiente), Hora, Repetir (Nunca, Cada semana, Cada mes, Cada año) y Nota opcional.
- Botones: Eliminar, Cancelar y Guardar.

**Ajustes del calendario.**

- «Números de semana» (ISO).
- «La semana empieza el»: Lunes o Domingo.
- «Vista al abrir»: Día, Semana, Mes o Agenda.
- «Horario en Día y Semana»: 6–24 h, 7–22 h o 0–24 h.
- «Festivos»: festivos nacionales del país elegido en Ajustes, calculados en el ordenador. Si el país no tiene festivos en la maqueta: «Todavía no hay festivos para … en esta maqueta.».
- «Importar y exportar · archivos .ics»: «Exportar calendarios visibles» (genera cuaderno-calendario.ics) e «Importar un archivo .ics» («Se crea un calendario nuevo con sus eventos.»). Texto: «Formato estándar compatible con Google Calendar, Apple Calendar y Outlook. Todo se procesa en tu ordenador.».

**Apariencia del calendario.** Panel con las pestañas Barra lateral, Fondo y Celdas (ver apartado 15).

## 9. Diario

Una nota por día, en tres columnas.

- **Cabecera:** «Diario · …» con la fecha, y botones Día anterior, Hoy y Día siguiente.
- **Columna izquierda:** minicalendario (con mes anterior y siguiente) y «Entradas · N», la lista de días con nota. Si no hay ninguna: «Aún no hay entradas.».
- **Columna central:** la **misma tarjeta de nota de los tableros**, con su cabecera (color, abrir en grande, papelera), título editable («Nota del día» por defecto), minibarra de formato y Markdown. Se cierra con clic fuera. A diferencia del tablero, no se arrastra ni se une con flechas. La papelera borra la nota de ese día («Nota del día borrada») y se puede deshacer.
- **Día sin nota:** «Sin nota este día», «Empieza con la plantilla (plan del día, notas, ideas y bocetos) o en blanco.» y los botones «Crear con plantilla» y «En blanco». La plantilla tiene «## Plan del día», «## Notas» e «## Ideas y bocetos».
- **Columna derecha:** «En el calendario ese día», con los eventos de esa fecha; si no hay: «Nada programado.».
- **Conexiones:** enlaces `[[Diario/AAAA-MM-DD|alias]]` desde cualquier nota, icono 📓 en el Calendario, bloque «Nota de hoy» en Hoy, búsqueda global, Grafo, backups y deshacer.

## 10. Grafo

Mapa de fuerzas con todas las conexiones de la app.

- **Nodos:** tareas principales (los más grandes), tarjetas, filas de Tablas PM y notas diarias.
- **Conexiones:** pertenencia (gris suave), Enlace \[\[ \]\], Relación (violeta), Flecha del tablero (naranja) y Dependencia (rojo discontinuo).
- **Filtros:** tarjetas, Filas de tablas, Notas diarias y Líneas de pertenencia. Al ocultar las tarjetas, sus enlaces pasan a su tarea principal.
- **Controles:** «Resaltar…» (busca y resalta nodos), «Reordenar», Alejar y Acercar, y zoom con la rueda del ratón hacia el cursor (30 %–250 %).
- **Interacción:** ayuda «Rueda del ratón para acercar o alejar · arrastra los nodos para colocarlos y el fondo para moverte · clic en un nodo para ver sus conexiones». Un nodo arrastrado queda fijo.
- **Panel del nodo:** «Conexiones» (o «Sin conexiones.») y el botón «Abrir».

## 11. Papelera

Vista general con el subtítulo «Lo que eliminas se guarda aquí hasta que lo borres definitivamente».

- **«Tareas principales · N»:** proyectos eliminados. Al restaurarlos vuelven a su carpeta si aún existe. Si no hay ninguno: «No hay tareas principales en la papelera.».
- **«Tarjetas de todos los tableros · N»:** tarjetas eliminadas de cualquier tablero. Si no hay ninguna: «No hay tarjetas en la papelera.».
- **Acciones por elemento:** «Restaurar» o «Eliminar definitivamente» (confirmación «Borrar para siempre»).
- **«Vaciar papelera»:** con confirmación «¿Seguro? Vaciar todo».
- Cada tablero tiene además su propia papelera (ver apartado 3). Inicio no se puede eliminar, y siempre queda al menos una tarea principal.

## 12. Ajustes

Ventana «Ajustes» («Los cambios se guardan al instante, solo en este dispositivo.») con seis pestañas: General, Recordatorios, Tablero, Backup, Seguridad y Datos. Backup y Seguridad tienen su propio apartado (13 y 14).

| Pestaña | Ajuste | Opciones |
| --- | --- | --- |
| General | Idioma | Español, English, Français, Português, Italiano, Deutsch. **En la app (mejora 1.2.0)** los seis idiomas están completos: menús, avisos, errores, fechas, horas, números (coma o punto decimal), plurales, datos de ejemplo y plantillas. Al cambiarlo, la interfaz se actualiza al instante. En el primer arranque se usa el idioma del sistema (inglés si no hay coincidencia). Las fórmulas aceptan las funciones en español, inglés y, según el idioma, también francés, portugués, italiano y alemán (`SUMA`, `SUM`, `SOMME`, `SOMA`, `SOMMA`, `SUMME`…). El contenido que ya tienes nunca se traduce solo |
| General | Formato de hora | 24 h, 12 h |
| General | Primer día de la semana | Lunes, Domingo |
| General | Localización | País, con buscador «Buscar país…»; los países con calendario incluido llevan la etiqueta «Festivos» |
| Recordatorios | Notificaciones del sistema | Sí / No: una notificación del sistema a la hora del recordatorio, mientras la app esté abierta (en la maqueta: «Notificaciones del navegador») |
| Recordatorios | Sonido | Sí / No: un sonido suave junto al aviso |
| Recordatorios | Avisar | A la hora, 5 min antes, 15 min, 1 h |
| Recordatorios | Al abrir la app | Sí / No: mostrar los recordatorios que pasaron mientras estaba cerrada |
| Tablero | Efecto foco | Desactivado, Suave, Intenso |
| Tablero | Imán activado al abrir | Sí / No |
| Tablero | Tamaño de la cuadrícula | Fina, Media, Amplia |
| Tablero | Reducir animaciones | Sí / No |
| Datos | Copia de seguridad manual | Botón «Abrir» |
| Datos | Espacio usado | Datos guardados en este ordenador (en la maqueta: «en este navegador») |
| Datos | Borrar todos los datos | «Borrar…» → «¿Seguro? Te recomendamos exportar una copia antes.» → «Sí, borrar todo» |

En la maqueta, «Notificaciones del navegador», «Sonido» y «Al abrir la app» solo guardan su valor: no envían avisos, no reproducen sonido ni muestran los recordatorios pasados. **En la app** sí funcionan: notificación del sistema, sonido suave y, al abrir la app, los recordatorios que pasaron mientras estaba cerrada. Los avisos solo llegan con la app abierta. Además, la app añade los botones «Probar aviso» y «Probar» (sonido).

## 13. Copias de seguridad

Tres niveles, configurados en Ajustes → Backup. El indicador de la barra lateral abre esta pestaña.

**Carpeta de backup.**

- Opciones: Descargas o Una carpeta, con «Elegir carpeta…» y «Volver a Descargas».
- Dentro se crean las subcarpetas «backup automático», «backup interno» y «backup manual», que se muestran en un esquema de árbol.
- **En la app** no existe «Navegador detectado» ni las instrucciones para cambiar la carpeta de descargas: la carpeta por defecto es Descargas y se puede elegir otra con «Elegir carpeta…».

**Backup automático** («archivos que sobreviven aunque borres el navegador»; en la app, aunque borres los datos de la app).

- «Activar backup automático».
- Frecuencia: Cada 4 h, Cada 8 h, Cada 12 h, Cada día o Cada semana.
- Copias a conservar: deslizador de 20 a 100 copias, de 5 en 5 (30 por defecto); al superar el límite se borra la más antigua.
- Carpeta, «Última copia» y «Hacer copia ahora».

**Backup interno** («fotos rápidas para deshacer errores»).

- «Activar backup interno»: guarda una copia dentro de la app cada cierto tiempo, entre 15 min y 12 h. **En la app** también escribe un archivo `cuaderno_interno_<fecha>.json` (`_cifrado` si hay cifrado) en la subcarpeta «backup interno» y conserva los últimos N.
- Copias a conservar: deslizador de 20 a 100 copias, de 5 en 5.
- «Copias internas recientes · N», cada una con «Restaurar», y «Crear copia ahora».

**Backup manual** («cuando tú decides»). Ventana «Copia de seguridad» («Tus datos viven solo en este navegador. [En la app: «…solo en este ordenador.»] Guarda una copia en un archivo de vez en cuando para no perder nada.»):

- «Exportar copia» → «Exportar ahora»: un archivo .json con todos los datos, en la subcarpeta «backup manual». Después muestra «Copia creada».
- «Importar copia» → «Elegir archivo…». Antes de importar pide confirmación: «¿Reemplazar tus datos actuales?», con el resumen del archivo y su fecha, y el aviso de que se puede deshacer. Botón «Reemplazar e importar».
- Indica la «Última copia».
- Errores: «No se pudo leer el archivo» y «Este archivo no parece una copia de Cuaderno.».
- Con el cifrado activado, las copias se exportan cifradas (…\_cifrado.json). Al importar una copia cifrada, la ventana «Copia cifrada» pide la contraseña («Usar las 24 palabras» como alternativa) y el botón «Descifrar».

Todas las copias incluyen las Tablas PM completas: fórmulas, reglas, historial e imágenes.

## 14. Cifrado y bloqueo

Opcional y desactivado por defecto. Se configura en Ajustes → Seguridad.

**Activar («Cifrado con contraseña» → «Activar…»).**

1. «Antes de activar el cifrado»: explica la contraseña y las 24 palabras de recuperación, como las de una billetera de criptomonedas. Hay que marcar «Entiendo que si pierdo la contraseña y las 24 palabras, pierdo mis datos.» para continuar.
2. «1 · Elige una contraseña»: mínimo 10 caracteres, con medidor (Muy corta, Débil, Aceptable, Fuerte), repetición y el consejo de usar una frase larga.
3. «2 · Tus 24 palabras de recuperación»: rejilla numerada de 24 palabras de la lista oficial BIP-39 en español, con «Copiar», «Descargar .txt», «Imprimir» y «Ya las he guardado».
4. «3 · Comprueba tu copia»: pide tres palabras al azar (sin importar tildes ni mayúsculas) y termina con «Confirmar y cifrar».

**Con el cifrado activado.**

- «✓ Cifrado activado», con la fecha y el detalle técnico.
- «Bloquear ahora».
- «Bloqueo automático»: interruptor y, si está activo, un desplegable con 5, 15 o 30 minutos y 1, 2 o 4 horas. Viene activado con 15 minutos y recuerda el último valor.
- «Contraseña · Cambiar…»: pide la actual y la nueva dos veces. No vuelve a cifrar los datos.
- «Palabras de recuperación · Generar nuevas…»: las anteriores dejan de abrir la app, pero siguen abriendo las copias hechas antes.
- «Desactivar el cifrado · Desactivar…»: pide la contraseña.
- En la barra lateral aparece el botón «Bloquear ahora».

**Pantalla de bloqueo.**

- Muestra el nombre de la sesión, «Tus datos están cifrados en este dispositivo», el campo de contraseña y «Desbloquear» («Descifrando…»). Si la contraseña falla: «Contraseña incorrecta.».
- «¿Olvidaste la contraseña? Usar las 24 palabras»: se escriben las palabras con un contador («N de 24 palabras») y el aviso de las que no están en la lista. Después se eligen y repiten una contraseña nueva y se pulsa «Recuperar acceso». Se vuelve atrás con «← Volver a la contraseña».

**Técnica.**

- Datos cifrados con AES-256-GCM, con una clave de datos aleatoria.
- Esa clave se guarda envuelta con la contraseña (en la maqueta PBKDF2-SHA256 con 600.000 iteraciones; **en la app** Argon2id con 64 MiB de memoria, 3 pasadas y 4 hilos) y con las 24 palabras (BIP-39, con su comprobación).
- Al bloquear, los datos, las copias internas y el historial de deshacer desaparecen de la memoria visible; solo queda la versión cifrada.
- Las copias de seguridad se cifran igual.

## 15. Personalización y apariencia

- **Personalizar barra:** color (Papel, Salvia, Rosa arcilla, Ocre, Tinta, Cobalto, Bosque) y textura de la barra lateral, iguales en todos los tableros; el panel indica su alcance: «Toda la app». **En la app** (mejora 1.1.0) también se elige el «Estilo de los iconos» (Notion, Lineal, Grueso, Relleno o Duotono; iconos libres incluidos en la app) el «Icono del botón de color» (Paleta, Gota, Bote de pintura, Muestras o Pincel) y los «Iconos de la barra» (Inicio, Hoy, Recordatorios, Calendario, Grafo, Diario y Papelera: cada uno se puede cambiar por cualquiera de los 53 iconos).
- **Personalizar tablero:**
  - «Ambientes» predefinidos: Estudio, Cuaderno, Acuarela, Risografía, Noche y Taller.
  - El panel indica su alcance: «Solo esta tarea principal». Pestañas Tablero (colores Papel, Blanco roto, Arena, Niebla, Lavanda, Noche, Abismo) y Tarjetas (Papel, Blanco, Crema, Menta, Cielo, Grafito, Marino), cada una con «Color · …» y «Textura · …» (Liso, Puntos, Cuadrícula, Cuaderno, Lienzo, Diagonal, Acuarela).
  - «Aplicar a todas las tareas», «Restablecer» y «Listo».
- **Apariencia del calendario:** pestañas Barra lateral, Fondo y Celdas; el panel indica su alcance: «Solo el calendario».
- **Tipografías:** del nombre de la sesión y del título de cada tablero (apartados 1 y 3).
- **Color de cada tarjeta:** apartado 4.
- **Color de la tarea principal:** tiñe la Tabla PM y sus elementos.
- **Legibilidad:** los colores de texto se contrastan solos con el fondo.

## 16. Deshacer, avisos y atajos

- **Deshacer y rehacer:** en casi todas las acciones (tableros, tarjetas, Tablas PM, notas diarias, importaciones), con un historial de 100 pasos. Las ediciones seguidas cuentan como un solo paso.
- **Avisos:** mensajes breves en la parte inferior («Tarjeta movida a la papelera», «Fila duplicada»…), muchos con botón «Deshacer».
- **Copiar manualmente:** en la maqueta, si el navegador bloquea el portapapeles, aparece «El navegador no dejó copiar automáticamente» con el texto ya seleccionado. **En la app**, si no se puede copiar, aparece el aviso «No se pudo copiar».
- **Atajos:**
  - ⌘Z / Ctrl+Z deshace; ⇧⌘Z / Ctrl+Y rehace.
  - Esc cierra ventanas y menús.
  - Ctrl+B y Ctrl+I dan negrita y cursiva en las notas.
  - Tab y Mayús+Tab crean o deshacen subtareas en los checklists.
  - **En la app** (mejora 1.1.0): Alt+↑ / Alt+↓ mueven la tarea seleccionada en la barra lateral, que también admite arrastrar tareas entre carpetas; cada tarea puede tener su propio icono, que se elige en «Personalizar tablero».
  - ↑↓ y Enter funcionan en la búsqueda; en la Tabla PM se navega con el teclado.

## 17. Datos de ejemplo de la maqueta

**En la app**, un cuaderno nuevo se abre con estos datos de ejemplo. Las copias automáticas e internas empiezan desactivadas.

| Tarea principal | Carpeta | Contenido destacado |
| --- | --- | --- |
| Inicio | — | Se llama «Mi espacio» y es la página de Inicio. Nota «Bienvenida», checklist «Esta semana» y widgets «Hoy», «Mis tareas principales» y «Próximos 7 días» |
| Mudanza de octubre | Casa y vida | Checklists «Cajas y embalaje» y «Trámites», recordatorio, tabla «Presupuesto», nota «Para no olvidar» |
| Curso de fotografía | Aprendizaje | Checklist «Módulo 3 · Luz natural», recordatorio «Entregar ejercicio» |
| Casa · semana | Casa y vida | Checklist «Compra» y recordatorios domésticos |
| Diseño de mi app | — | Notas «Decisiones tomadas» y «Notas internas de desarrollo» (Notas 1–8), checklist «Plan de pruebas · Tabla PM» |
| Encargo · Mural Café Aurora | — | Tablas PM «Seguimiento del encargo» y «Materiales», nota «Brief», imagen «Referencia · amanecer», paleta «Paleta · amanecer», boceto «Composición rápida» y flechas entre ellas |

Además: tres notas diarias (25, 27 y 28 de septiembre de 2026), los calendarios Cuaderno, Cumpleaños y Festivos, y la fecha de referencia de la maqueta en torno al 28 de septiembre de 2026.

## 18. Nota «Decisiones tomadas»

Tarjeta del tablero «Diseño de mi app» que recoge las primeras decisiones de diseño, tal como aparecen:

- **Interfaz:** cuadrícula libre con tarjetas de distintos tamaños; arrastrar y soltar con imán; editar el texto con un clic; tareas y subtareas en las checklists.
- **Datos:** «Copias automáticas en archivo» (marcada como hecha) y «Decidir fechas en tareas» (sin marcar).
- Etiquetas: `100% local` y #diseño.
