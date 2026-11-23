# Especificación del feature: Asistencia con QR, horario por obra y calendario

**Feature Branch**: `001-asistencia-qr-horario`

**Created**: 2026-11-23

**Status**: Draft

**Input**: Descripción del usuario: "Asistencia con QR, horario por obra y calendario (decisiones D-06, D-07 y D-08)."

**Requerimientos del SRS V4.0 que atiende**:

- `RF-19 Registrar asistencia propia` (Must, decisión P-04): el trabajador lo cumple mostrando su QR.
- `RF-27 Registrar asistencia por el supervisor` (Must, decisión P-04).
- `RF-56 Mostrar días con descuento`.
- `RF-58 Mostrar calendario de asistencia`.
- `RF-60 Registrar retardo o salida anticipada`.

**Fuera de este feature**:

- `RF-61 Calcular retardos` y las métricas de desempeño (D-09) van en el feature de desempeño. Ese feature usará los registros que se crean aquí.
- `RF-21 Notificar registro de salida pendiente`: no aparece en el Figma.
- `RF-28 Registrar asistencia biométrica` y `RF-29 Notificar faltas acumuladas` son _Won't have_.

**Pantallas del Figma** (archivo `EIXrnioyKFd9EoBY5PINOV`):

| Pantalla                                 | node-id                            | Rol                |
| ---------------------------------------- | ---------------------------------- | ------------------ |
| `SUP_Asistencia_EscogerObra`             | `96:2903`                          | Supervisor         |
| `SUP_Asistencia_LeerQr (accesos nuevos)` | `2272:117` (sustituye a `96:2209`) | Supervisor         |
| `Sup_Asistencia_ConfirmarQR`             | `96:2228`                          | Supervisor         |
| `SUP_HorarioObra`                        | `2272:170`                         | Supervisor         |
| `SUP_DetallesAsistencia`                 | `2272:250`                         | Supervisor         |
| `SUP_CalendarioTrabajador`               | `2272:354`                         | Supervisor o dueño |
| `SUP_CalendarioTrabajador_DetalleDia`    | `2272:523`                         | Supervisor o dueño |
| `TRA-Asistencia Dia`                     | `96:329`                           | Trabajador         |
| `TRA-HIstorial asistencia`               | `96:389`                           | Trabajador         |

## User Scenarios & Testing _(mandatory)_

### User Story 1: Registrar entrada y salida con QR (Priority: P1)

El trabajador abre "Mi asistencia" y ve su código QR personal, junto con la hora de entrada y la de salida de su obra con el estado de cada una ("Pendiente" o "Registrada"). El supervisor elige la obra en la que pasará asistencia y escanea el QR con la cámara. Antes de confirmar ve el nombre completo y la fotografía del trabajador, la hora y la ubicación, y luego acepta o rechaza. El primer registro aceptado del día es la entrada y el segundo es la salida.

**Why this priority**: es la base del feature. Sin registros de entrada y salida no hay horario que aplicar, detalles que editar ni calendario que mostrar (RF-19, RF-27).

**Independent Test**: con una obra, un supervisor y un trabajador asignado, el supervisor escanea el QR del trabajador dos veces en el día. Se deben guardar una entrada y una salida con fecha, hora, ubicación y supervisor, y la pantalla del trabajador debe pasar de "Pendiente" a "Registrada" en ambas.

**Acceptance Scenarios**:

1. **Given** un trabajador asignado a la obra "Hospital" sin entrada registrada hoy, **When** el supervisor escanea su QR y pulsa "Aceptar", **Then** se guarda la entrada con fecha, hora, ubicación del supervisor y nombre del supervisor que la registró, y aparece en "Resumen de asistencia" como "Entrada 8:02".
2. **Given** un trabajador con entrada registrada hoy, **When** el supervisor escanea su QR y acepta, **Then** se guarda la salida del día.
3. **Given** un trabajador con entrada y salida registradas hoy, **When** el supervisor escanea su QR, **Then** el sistema no crea un registro nuevo e informa que la asistencia del día ya está completa (RF-19, caso no válido).
4. **Given** un QR de un trabajador que no está asignado a la obra elegida, o un QR que no es de Civil Trace, **When** el supervisor lo escanea, **Then** el sistema no registra la asistencia y explica el motivo (RF-27, caso no válido).
5. **Given** el supervisor ve la confirmación de un QR escaneado, **When** pulsa "Rechazar" (por ejemplo, porque la foto no corresponde a la persona), **Then** no se guarda ningún registro.
6. **Given** un QR de un trabajador de otra empresa, **When** se escanea, **Then** el sistema no registra la asistencia ni muestra datos de ese trabajador.
7. **Given** el supervisor está en la obra sin señal, **When** escanea y acepta el QR de un trabajador asignado, **Then** el registro queda en su teléfono como "Pendiente de envío" con la hora y la ubicación del escaneo, y al volver la conexión se guarda en el servidor marcado como "Registrado sin conexión".

---

### User Story 2: Fijar el horario de la obra (Priority: P1)

El supervisor de la obra o el dueño define la hora de entrada y de salida de la obra, la tolerancia para registrar (10, 15 o 20 minutos; 15 por defecto) y los días laborales. Puede aplicar el horario a todos los días o solo al día de hoy. El horario vale para todos los trabajadores asignados a la obra (D-06).

**Why this priority**: sin horario el sistema no puede decidir si una entrada es puntual o es retardo, ni qué días cuentan como laborales en el calendario.

**Independent Test**: el supervisor guarda un horario de 08:00 a 16:00, con 15 min de tolerancia, de lunes a sábado. Una entrada a las 08:14 se clasifica como completa y una a las 08:16 como retardo.

**Acceptance Scenarios**:

1. **Given** una obra sin horario, **When** el supervisor guarda entrada 08:00, salida 16:00, tolerancia 15 min, días L a S y "Todos los días", **Then** el horario aplica desde ese momento a todos los trabajadores de la obra y la pantalla de asistencia muestra 8:00 am y 4:00 pm.
2. **Given** un horario de 08:00 con tolerancia de 15 min, **When** se registra una entrada a las 08:16, **Then** la jornada se marca como "Retardo". La pantalla de horario explica la regla con el texto "Una entrada después de las 08:15 se marca como retardo".
3. **Given** un horario general de 08:00 a 16:00, **When** el supervisor guarda 09:00 a 14:00 con "Solo hoy", **Then** ese horario aplica solo a la fecha de hoy y al día siguiente vuelve el general.
4. **Given** una hora de salida igual o anterior a la de entrada, o ningún día laboral elegido, **When** se intenta guardar, **Then** el sistema no guarda el horario e indica el error.
5. **Given** un trabajador o un supervisor de otra obra, **When** intenta cambiar el horario, **Then** el sistema lo impide.

---

### User Story 3: Ver y editar los detalles de asistencia de un trabajador (Priority: P2)

En "Resumen de asistencia", el supervisor mantiene presionado a un trabajador y abre "Detalles de asistencia". Ahí puede cambiar el tipo de jornada (completa, retardo, media jornada, salida temprana o falta), el motivo (cita médica, enfermedad, permiso personal, asunto familiar u otro), el efecto en el pago (pago completo, medio día o sin pago) y las anotaciones, y puede editar las horas de entrada y salida. Cada cambio guarda el valor anterior, el autor, la fecha y la hora (D-07, RF-60).

**Why this priority**: permite justificar retardos y faltas y fijar su efecto en el pago, que es lo que el cliente pidió (RF-60). Depende de la historia 1.

**Independent Test**: el supervisor cambia la jornada de un trabajador de "Retardo" a "Media jornada", con motivo "Cita médica", efecto "Medio día" y una anotación. Al reabrir los detalles se ven esos valores, y el historial registra el cambio con el valor anterior.

**Acceptance Scenarios**:

1. **Given** un trabajador con entrada a las 8:02, **When** el supervisor elige "Media jornada", "Cita médica" y "Medio día", escribe una anotación y pulsa "Guardar detalles", **Then** el día queda con esos datos y el historial registra quién hizo el cambio, cuándo y los valores anteriores.
2. **Given** un día clasificado como retardo, salida temprana, media jornada o falta, **When** el supervisor intenta guardar sin anotación, **Then** el sistema no lo guarda e indica que la observación es obligatoria (RF-60, caso no válido).
3. **Given** un trabajador que olvidó registrar su entrada a las 8:00 y la registró a las 8:20, **When** el supervisor edita la entrada a 8:00 con una anotación, **Then** se guarda la nueva hora, se conserva la original (8:20) y el detalle del día muestra "entrada original 8:20 → 8:00".
4. **Given** un trabajador sin ningún registro en un día laboral, **When** el supervisor marca el día como "Falta" con motivo y efecto, **Then** el día queda como falta justificada o injustificada según el motivo.
5. **Given** un usuario que no es el supervisor de esa obra, **When** intenta editar los detalles, **Then** el sistema lo impide.

---

### User Story 4: Consultar el calendario de asistencia (Priority: P2)

El trabajador ve su propio calendario mensual de asistencia. El supervisor y el dueño ven el de cada uno de sus trabajadores. Cada día laboral pasado tiene un color: verde para asistencia completa, naranja para retardo, media jornada o salida temprana, y rojo para falta. Arriba se muestra el resumen del mes (por ejemplo, "1 falta · 1 media jornada · 1 retardo"). Al tocar un día se ven la entrada, la salida, el motivo, el efecto en el pago, la anotación, quién lo registró y las modificaciones (D-08, RF-56, RF-58).

**Why this priority**: muestra al trabajador y a quienes le pagan lo que se registró y cómo afecta su pago (RF-56, RF-58). Depende de las historias 1 a 3.

**Independent Test**: con registros de mayo de 2026 (13 falta, 14 y 15 completos, 19 media jornada), el calendario de mayo muestra rojo el 13, verde el 14 y el 15 y naranja el 19. Al tocar el 19 se ve "Media jornada", la salida a las 12:00 pm, "Cita médica" y "Medio día de pago".

**Acceptance Scenarios**:

1. **Given** un trabajador con la observación "Medio día de pago" el 5 de noviembre, **When** él o su supervisor abre el calendario de noviembre, **Then** el día 5 está en naranja y su detalle muestra la anotación y el efecto en el pago (RF-58, caso válido).
2. **Given** un trabajador, **When** intenta abrir el calendario de otro trabajador, **Then** el sistema lo impide (RF-58, caso no válido).
3. **Given** un día con descuento en el pago (medio día o sin pago), **When** el trabajador lo toca, **Then** ve el motivo del descuento (RF-56).
4. **Given** un trabajador sin faltas ni descuentos en el mes, **When** abre su calendario, **Then** no ve alertas de faltas y la confirmación del supervisor dice "Sin faltas este mes".
5. **Given** un trabajador con al menos 1 falta en el mes, **When** abre su calendario, **Then** ve "Tienes N falta(s) este mes" y el recordatorio "Recuerda que 3 faltas injustificadas pueden ser motivo de despido." Sin faltas en el mes no se muestra ni el aviso ni el recordatorio.
6. **Given** un día con efecto en el pago "Medio día" o "Sin pago", **When** cualquier usuario con permiso abre el calendario, **Then** el día muestra el símbolo **$** además de su color (RF-56, decisión D-13).
7. **Given** un dueño, **When** abre el calendario de un trabajador de otra empresa, **Then** el sistema lo impide.

---

### Edge Cases

- **Día laboral sin registros:** al terminar un día laboral de la obra, el trabajador asignado que no tenga entrada aparece con "Falta" en el calendario. El supervisor puede cambiarla después con motivo y efecto.
- **Entrada sin salida:** si el día termina sin salida, el día conserva su clasificación por la entrada y el detalle muestra "Salida —". El supervisor puede agregar la salida con "Editar horas".
- **Salida antes de la hora de salida:** si la salida se registra antes de la hora fijada, el día se marca como "Salida temprana" y el supervisor debe agregar la observación (RF-60).
- **Escaneo en un día no laboral:** el sistema registra la asistencia y no cuenta retardo, porque ese día no hay horario contra el cual compararla.
- **Trabajador en varias obras:** el QR es el mismo para todas sus obras. El registro queda en la obra que eligió el supervisor, y solo puede haber una entrada por día en cada obra.
- **Cambio de horario a media jornada:** un horario nuevo no reclasifica registros ya guardados. Cada registro conserva el horario con el que se evaluó.
- **Sin GPS:** si el teléfono del supervisor no tiene ubicación al escanear, el registro se guarda con "Sin ubicación GPS" (mismo criterio que las evidencias).
- **QR copiado:** si alguien muestra la foto de un QR ajeno, el supervisor lo detecta porque la confirmación muestra la fotografía del dueño del QR y puede rechazar.
- **QR fijo (D-17):** el QR de cada trabajador es siempre el mismo, en cualquier teléfono y en todas sus obras. No se regenera en el MVP.
- **Sin conexión:** el supervisor puede escanear sin señal. Los registros quedan guardados en su teléfono y se envían al recuperar la conexión, igual que las evidencias (RNF-07). Ver FR-026 a FR-030.
- **Conflicto al sincronizar:** si al enviar un registro hecho sin conexión el servidor ya tiene la entrada y la salida de ese trabajador, obra y día, se conserva lo que ya estaba. El registro sobrante se informa al supervisor y no se guarda.
- **Asignación cambiada:** si al sincronizar el trabajador ya no está asignado a la obra, el registro se rechaza y se informa al supervisor.

## Requirements _(mandatory)_

### Functional Requirements

**QR y registro (RF-19, RF-27)**

- **FR-001**: El sistema DEBE dar a cada trabajador un código QR personal y **permanente** (siempre el mismo, D-17), que lo identifique sin mostrar datos personales legibles y que no se pueda fabricar a partir de su nombre, correo o identificador.
- **FR-002**: El trabajador DEBE poder ver su QR en "Mi asistencia" con el horario de hoy de su obra y el estado de la entrada y la salida ("Pendiente" o "Registrada").
- **FR-003**: El supervisor DEBE elegir la obra antes de escanear, y solo puede elegir entre las obras que supervisa.
- **FR-004**: Al escanear, el sistema DEBE validar que el QR sea vigente, que el trabajador sea de la misma empresa y que esté asignado a la obra elegida. Si alguna validación falla, no registra nada y muestra el motivo.
- **FR-005**: Antes de guardar, el sistema DEBE mostrar al supervisor el nombre completo, la fotografía, el oficio, la hora y la ubicación del registro, más un aviso si el trabajador tiene faltas en el mes. El supervisor puede aceptar o rechazar.
- **FR-006**: El sistema DEBE guardar cada registro aceptado con la fecha, la hora del servidor, la ubicación (o "Sin ubicación GPS"), la obra y el supervisor que lo registró.
- **FR-007**: El sistema DEBE permitir como máximo una entrada y una salida por trabajador, por obra y por día. El primer registro es la entrada y el segundo, la salida. Un tercero se rechaza.
- **FR-008**: La pantalla de asistencia del supervisor DEBE mostrar el horario del día con el estado de la entrada y la salida ("Finalizado" o "Pendiente"), y la lista "Resumen de asistencia" con cada trabajador y su hora de entrada.

**Horario por obra (D-06)**

- **FR-009**: El supervisor de la obra y el dueño DEBEN poder fijar la hora de entrada, la de salida, la tolerancia (10, 15 o 20 min; 15 por defecto) y los días laborales de la obra.
- **FR-010**: El horario DEBE poder aplicarse a "Todos los días", y entonces queda como horario general, o a "Solo hoy", y entonces vale solo para la fecha actual.
- **FR-011**: El sistema DEBE rechazar horarios con la salida igual o anterior a la entrada, o sin días laborales.
- **FR-012**: El sistema DEBE clasificar la entrada como "Retardo" cuando ocurra después de la hora de entrada más la tolerancia. La salida se marca como "Salida temprana" cuando ocurra antes de la hora de salida.
- **FR-013**: Cada registro DEBE guardar el horario con el que se evaluó, para que los cambios de horario no lo reclasifiquen.

**Detalles de asistencia (D-07, RF-60)**

- **FR-014**: El supervisor de la obra DEBE poder abrir los detalles de asistencia de un trabajador para un día y cambiar el tipo de jornada, el motivo, el efecto en el pago, las anotaciones y las horas de entrada y salida.
- **FR-015**: Los tipos de jornada son: completa, retardo, media jornada, salida temprana y falta. Los motivos son: cita médica, enfermedad, permiso personal, asunto familiar y otro. Los efectos en el pago son: pago completo, medio día y sin pago.
- **FR-016**: El sistema DEBE exigir una anotación cuando el tipo de jornada no sea "Completa".
- **FR-017**: Cada cambio DEBE guardar en un historial el campo, el valor anterior, el valor nuevo, el autor, la fecha y la hora. Los registros de asistencia y su historial nunca se borran.
- **FR-018**: El supervisor DEBE poder registrar una falta o una asistencia en un día laboral pasado que no tenga registros.

**Calendario (D-08, RF-56, RF-58)**

- **FR-019**: El sistema DEBE mostrar un calendario mensual por trabajador y por obra, con navegación entre meses.
- **FR-020**: Cada día laboral pasado DEBE mostrarse en verde (completa), naranja (retardo, media jornada o salida temprana) o rojo (falta). Los días no laborales y los días futuros no llevan color de asistencia.
- **FR-021**: Al tocar un día, el sistema DEBE mostrar el tipo de jornada, la entrada, la salida, el motivo, el efecto en el pago, la anotación, quién registró y cuándo, y cada modificación con su valor original.
- **FR-022**: El calendario DEBE mostrar el resumen del mes: número de faltas, de medias jornadas y de retardos. Al trabajador con al menos 1 falta en el mes se le muestra "Tienes N falta(s) este mes" y el recordatorio sobre las 3 faltas injustificadas. Sin faltas no se muestra.
- **FR-022a**: Los días con efecto en el pago "Medio día" o "Sin pago" DEBEN mostrar el símbolo **$** en el calendario, además de su color (RF-56, D-13).
- **FR-023**: El trabajador solo puede ver su calendario. El supervisor ve los de los trabajadores de sus obras y el dueño, los de todos los trabajadores de su empresa. Nadie puede ver datos de otra empresa.

**Transversales**

- **FR-024**: Las horas DEBEN registrarse con la hora del servidor cuando hay conexión, o con la hora del dispositivo en el momento del escaneo cuando no la hay (FR-028). Se muestran en la zona horaria de la empresa.
- **FR-024a**: La zona horaria DEBE guardarse por empresa, con `America/Tijuana` por defecto, y DEBE poder cambiarse después (por ejemplo, a `America/Mexico_City`) sin modificar los registros ya guardados. En este feature no hay pantalla para cambiarla.
- **FR-025**: Los mensajes de error DEBEN estar en español y no exponer datos internos.
- **FR-025a**: El perfil del usuario DEBE permitir capturar y consultar un oficio opcional, de máximo 60 caracteres (D-18).

**Sin conexión (RNF-07 aplicado a asistencia)**

- **FR-026**: Mientras tenga conexión, la app del supervisor DEBE conservar los datos necesarios para validar sin señal los QR de los trabajadores asignados a sus obras: identidad, nombre, oficio, fotografía, credencial vigente y horario de la obra.
- **FR-027**: Sin conexión, el supervisor DEBE poder escanear, ver la confirmación (FR-005) y aceptar o rechazar. Los registros aceptados se guardan en el teléfono como "Pendiente de envío".
- **FR-028**: Cada registro hecho sin conexión DEBE guardar la hora y la ubicación del momento del escaneo, y quedar marcado como "Registrado sin conexión" en el detalle del día.
- **FR-029**: Al recuperar la conexión, los registros pendientes DEBEN enviarse en orden. El servidor los vuelve a validar con FR-004 y FR-007, y el supervisor ve cuáles se guardaron y cuáles se rechazaron y por qué.
- **FR-030**: Los registros pendientes de envío no se pierden si se cierra la app o se reinicia el teléfono.

### Key Entities _(include if feature involves data)_

- **Horario de obra**: pertenece a una obra. Tiene hora de entrada, hora de salida, tolerancia, días laborales y alcance: general o un solo día con su fecha. La obra tiene un horario general vigente y puede tener excepciones de un día.
- **Credencial QR del trabajador**: identificador secreto y permanente de un trabajador, que se presenta como código QR. Hay una por trabajador.
- **Oficio del trabajador**: texto opcional (por ejemplo, "Plomero") que el trabajador captura en su perfil (D-18) y que se muestra en las pantallas de asistencia.
- **Registro de asistencia (día)**: un trabajador en una obra en una fecha. Tiene la hora de entrada y la de salida (con la ubicación y el supervisor de cada una), el tipo de jornada, el motivo, el efecto en el pago, la anotación y el horario con que se evaluó. Hay uno por trabajador, obra y fecha.
- **Historial de asistencia**: cada cambio a un registro de asistencia, con el campo, el valor anterior, el valor nuevo, el autor, la fecha y la hora.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El supervisor registra la entrada de un trabajador, del escaneo a la confirmación, en menos de 10 segundos.
- **SC-002**: El supervisor pasa asistencia de 20 trabajadores en menos de 5 minutos.
- **SC-003**: El 100 % de los registros guardados tienen fecha, hora, obra y supervisor, y el 100 % de los cambios tienen autor, fecha, hora y valor anterior.
- **SC-004**: Ningún QR inválido, de otra obra o de otra empresa genera un registro (0 registros indebidos en las pruebas del plan).
- **SC-005**: El trabajador encuentra en su calendario el motivo de cualquier descuento con a lo sumo 2 toques desde "Mi asistencia".
- **SC-006**: La clasificación de retardo coincide con la regla del horario (entrada + tolerancia) en el 100 % de los casos de prueba, incluidos los límites exactos.

## Assumptions

- **Asistencia propia (RF-19):** se cumple con el QR que muestra el trabajador y que escanea el supervisor. El trabajador no registra su asistencia por sí solo; así lo indican el Figma y la decisión D-07.
- **Hora y ubicación:** se usan la hora del servidor y la ubicación del teléfono del supervisor en el momento del escaneo.
- **Zona horaria:** una por empresa, con `America/Tijuana` por defecto. El cambio a `America/Mexico_City` queda para después (FR-024a).
- **Hora sin conexión:** la hora del teléfono del supervisor se acepta como válida. Detectar relojes mal configurados queda fuera del MVP.
- **Edición de detalles:** solo la hace el supervisor de la obra, como indica D-07. El dueño consulta el calendario y puede cambiar el horario (D-06), pero el Figma no le da la pantalla de detalles.
- **Faltas justificadas e injustificadas:** una falta es injustificada si no tiene motivo y justificada si lo tiene. Esto solo afecta lo que se muestra; no genera alertas, porque RF-29 es _Won't have_.
- **Símbolo de descuento (RF-56):** el equipo decidió (D-13) que los días con descuento muestren el símbolo **$** en el calendario. El Figma todavía no lo tiene y DEBE actualizarse en `SUP_CalendarioTrabajador`, `TRA-HIstorial asistencia` y sus detalles, con el mismo estilo.
- **Fotografía del trabajador:** se usa la foto de perfil que ya existe. Si no tiene, se muestran sus iniciales.
- **Oficio (D-18):** el trabajador lo captura en su perfil. Es opcional y, si no lo tiene, se muestra solo el nombre.
- **Fuera de alcance:** las métricas de desempeño (RF-61, D-09) van en otro feature.
