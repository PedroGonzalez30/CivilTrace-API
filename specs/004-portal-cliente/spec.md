# Especificación del feature: Portal web del cliente (enviar, aceptar o rechazar reportes)

**Feature Branch**: `004-portal-cliente` (API y app); repositorio nuevo `CivilTrace-Portal` (T-02)

**Created**: 2026-11-24

**Status**: Draft

**Autor**: Emilio Manuel Esquivel

**Input**: Descripción del usuario: "Hacer la página web del cliente aunque el SRS V4.0 la haya quitado; seguimos pensando en la página web como sale en el Figma."

**Origen y discrepancia con el SRS V4.0**:

- El SRS V4.0 dice "eliminación de la página web del cliente": el cliente acepta con su firma en el dispositivo del supervisor (`RF-57`) y el supervisor registra sus observaciones (`RF-13`).
- El equipo mantiene la página web porque así está en el Figma (D-01) y en las decisiones D-02, D-03, D-04, T-02 y T-03. Se registra como **P-10**: hay que corregir el SRS (y CP16–CP17 del plan de pruebas) para que digan que el cliente responde desde la página web.
- Mientras tanto, este feature cumple los mismos requerimientos del SRS con la página web en lugar del dispositivo del supervisor:

| RF del SRS V4.0                                   | Prioridad | Cómo se cumple aquí                                                                |
| ------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- |
| `RF-12 Enviar entrega al cliente`                 | Must      | El supervisor o el dueño envía el reporte; el cliente recibe un enlace por correo. |
| `RF-57 Registrar aceptación de entrega con firma` | Must      | El cliente firma en la página web (no en el teléfono del supervisor), con código.  |
| `RF-13 Registrar observaciones del cliente`       | Should    | El cliente escribe su comentario y firma en la página web al rechazar.             |
| `RF-14 Generar acta de entrega-recepción`         | Must      | Al aceptar se genera el acta en PDF; se descarga desde la página y desde la app.   |
| `RF-15 Bloquear entrega aceptada`                 | Must      | Las actividades y evidencias de una entrega aceptada ya no se pueden modificar.    |

**Fuera de este feature**:

- `RF-11 Generar reporte de avance de obra`: ya existe (la app genera el PDF con `expo-print`). Solo se reutiliza.
- `RF-16 Consultar expediente`, `RF-23 Verificar acta por QR` y `RF-24 Evaluación del cliente`: features posteriores.
- Métricas de desempeño (`RF-31`, `RF-61` a `RF-64`, D-09; pantalla `DesempenoTrabajador-Dueño` `2273:219`): feature 005.
- Infraestructura en Terraform del portal y del correo (T-03, T-04): se hace en el plan de este feature, pero los recursos nuevos de Azure se crean solo con aprobación del equipo.

**Pantallas del Figma** (archivo `EIXrnioyKFd9EoBY5PINOV`):

| Pantalla                                           | node-id    | Quién                |
| -------------------------------------------------- | ---------- | -------------------- |
| `SUP_REporte PDF` (botón "Enviar al cliente")      | `179:2834` | Supervisor (app)     |
| `ReportePdf -Dueño`                                | `144:1963` | Dueño (app)          |
| `ReportePdfEnviar -Dueño` ("Se envió al cliente")  | `144:2116` | Dueño (app)          |
| `ReporteActa -Dueño` ("Crear acta de entrega")     | `144:2536` | Dueño (app)          |
| `CLIENTE_Abrir enlace de reportes`                 | `246:1178` | Cliente (página web) |
| `CLIENTE_AceptarREPORTE CON CODIGO`                | `246:1269` | Cliente (página web) |
| `CLIENTE RECHAZAR REPORTE/AVNACES CON COMENTARIOS` | `246:1605` | Cliente (página web) |
| `CLIENTE_FirmarAceptacion`                         | `2271:118` | Cliente (página web) |
| `CLIENTE_FirmarRechazo`                            | `2271:158` | Cliente (página web) |
| `CLIENTE_ReporteAceptado`                          | `2271:192` | Cliente (página web) |

Las pantallas del cliente miden 412 px de ancho: la página se diseña primero para celular y también debe verse bien en computadora.

## User Scenarios & Testing _(mandatory)_

### Historia 1 - El supervisor o el dueño envía el reporte al cliente (Priority: P1)

Desde la vista previa del reporte de avances de una obra (filtrada por fechas), el supervisor o el dueño toca "Enviar al cliente". El sistema guarda una **entrega** con el periodo y las actividades del reporte en ese momento, y manda al correo del cliente de la obra un enlace a la página web. La app muestra "Se envió al cliente".

**Why this priority**: sin entregas enviadas el cliente no tiene nada que revisar. Es la entrada de todo el flujo (RF-12, Must).

**Independent Test**: con una obra con correo del cliente y actividades con evidencias aprobadas, enviar el reporte y comprobar que la entrega queda "Enviada" y que el doble del servicio de correo recibió un mensaje con un enlace válido.

**Acceptance Scenarios**:

1. **Given** una obra con correo del cliente y al menos una actividad con evidencia aprobada en el periodo, **When** el supervisor de la obra toca "Enviar al cliente", **Then** se crea una entrega "Enviada" con sus actividades, se envía el correo con el enlace y la app muestra "Se envió al cliente".
2. **Given** una obra sin correo del cliente, **When** se intenta enviar, **Then** no se crea la entrega y la app indica que la obra no tiene correo del cliente.
3. **Given** un periodo sin actividades con evidencia aprobada, **When** se intenta enviar, **Then** no se crea la entrega y la app indica que no hay avances aprobados para enviar.
4. **Given** un trabajador o un supervisor que no está asignado a la obra, **When** intenta enviar, **Then** la API lo rechaza (403).
5. **Given** que el servicio de correo falla, **When** se envía, **Then** la app muestra un error y la entrega no queda como enviada (se puede reintentar).

---

### Historia 2 - El cliente abre el enlace y revisa sus reportes (Priority: P1)

El cliente abre el enlace del correo sin crear cuenta. Ve "Reportes {obra}" con la lista de entregas de esa obra (la más reciente arriba, con periodo y estado) y abre una para ver sus actividades, avances y fotografías aprobadas.

**Why this priority**: es la razón de ser de la página (D-02) y lo que pide el cliente: ver avances con fotos.

**Independent Test**: con una entrega enviada, abrir el enlace en un navegador y ver la lista y el detalle con fotos, sin iniciar sesión.

**Acceptance Scenarios**:

1. **Given** un enlace válido, **When** el cliente lo abre, **Then** ve las entregas de esa obra con nombre, periodo (fecha de inicio y final) y estado (Enviada, Aceptada o Con observaciones).
2. **Given** una entrega, **When** el cliente la abre, **Then** ve sus actividades con fecha, descripción y las fotografías **aprobadas** (D-10) con fecha y hora; nunca ve fotos pendientes o rechazadas.
3. **Given** un enlace alterado, inventado o revocado, **When** se abre, **Then** la página muestra que el enlace no es válido y no muestra ningún dato.
4. **Given** un enlace de la obra A, **When** el cliente cambia la dirección para pedir una entrega de la obra B, **Then** la API responde como si no existiera (404) y no muestra datos.

---

### Historia 3 - El cliente acepta un reporte con código y firma (Priority: P1)

En una entrega "Enviada" el cliente toca "Aceptar". El sistema envía un código de 6 dígitos a su correo; el cliente lo escribe ("Introduce el código de seguridad"), escribe su nombre completo, dibuja su firma ("Firma tu aceptación") y toca "Firmar y aceptar". Ve "Reporte aceptado" con su nombre, fecha, hora, firma y el botón "Descargar acta (PDF)".

**Why this priority**: la aceptación con constancia es el objetivo del sistema (RF-57, RF-14, Must).

**Independent Test**: aceptar una entrega con el código que capturó el doble de correo y una firma; comprobar estado "Aceptada", firma guardada con su SHA-256 y acta descargable.

**Acceptance Scenarios**:

1. **Given** una entrega Enviada, **When** el cliente pide el código, **Then** recibe en el correo de la obra un código de 6 dígitos que vence en 10 minutos.
2. **Given** el código correcto, nombre y firma, **When** toca "Firmar y aceptar", **Then** la entrega pasa a Aceptada con nombre, fecha, hora y firma, y se genera el acta.
3. **Given** un código incorrecto, **When** lo escribe, **Then** se rechaza y se le indica cuántos intentos le quedan; al 5.º intento fallido el código se invalida y debe pedir otro.
4. **Given** un código con más de 10 minutos o ya usado, **When** lo escribe, **Then** se rechaza y puede pedir uno nuevo.
5. **Given** que no dibujó la firma o el nombre está vacío, **When** intenta confirmar, **Then** el botón "Firmar y aceptar" sigue desactivado.
6. **Given** una entrega ya Aceptada o Con observaciones, **When** el cliente la abre, **Then** la ve con su estado y sin botones de aceptar o rechazar.
7. **Given** una entrega Aceptada, **When** el cliente toca "Descargar acta (PDF)", **Then** descarga el acta con los datos de la obra, el periodo, las actividades, las evidencias aprobadas y el registro de aceptación (nombre, fecha, hora, firma).
8. **Given** una entrega Aceptada, **When** alguien intenta modificar o borrar una actividad o evidencia incluida en ella, **Then** la API lo rechaza (RF-15).

---

### Historia 4 - El cliente rechaza un reporte con comentario y firma (Priority: P2)

En una entrega "Enviada" el cliente toca "Rechazar", escribe qué debe corregirse ("Agrega un comentario para el supervisor"), escribe su nombre, firma ("Firma tu rechazo") y toca "Firmar y rechazar". La entrega queda "Con observaciones" y el supervisor y el dueño ven el comentario en la app.

**Why this priority**: RF-13 es Should; el flujo de aceptación funciona sin él, pero el cliente necesita dejar constancia de lo que falta.

**Independent Test**: rechazar una entrega con comentario y firma; comprobar estado, comentario y firma guardados y visibles en la app.

**Acceptance Scenarios**:

1. **Given** una entrega Enviada, comentario, nombre y firma, **When** toca "Firmar y rechazar", **Then** la entrega pasa a "Con observaciones" con el comentario, nombre, fecha, hora y firma.
2. **Given** un comentario vacío, **When** intenta continuar, **Then** no avanza e indica que falta el comentario.
3. **Given** una entrega Con observaciones, **When** el supervisor abre los reportes de la obra en la app, **Then** ve el estado y el comentario del cliente, y puede enviar una entrega nueva con las correcciones.

---

### Historia 5 - El supervisor y el dueño ven el estado de sus entregas (Priority: P2)

En los reportes de la obra la app muestra las entregas enviadas con su estado; en las aceptadas permite descargar el acta.

**Why this priority**: cierra el ciclo y cumple el mensaje de `CLIENTE_ReporteAceptado` ("el supervisor recibirá tu aceptación y el acta quedará en el expediente").

**Independent Test**: después de que el cliente acepte y rechace dos entregas, la app las muestra con su estado y el acta de la aceptada se descarga.

**Acceptance Scenarios**:

1. **Given** entregas Enviada, Aceptada y Con observaciones, **When** el supervisor abre los reportes de la obra, **Then** ve las tres con su estado y fecha de respuesta.
2. **Given** una entrega Aceptada, **When** toca el acta, **Then** descarga el mismo PDF que descarga el cliente.

### Edge Cases

- El cliente pide varios códigos seguidos: solo vale el último; se limita la frecuencia (un código por minuto por entrega).
- Dos pestañas responden la misma entrega: la segunda respuesta se rechaza porque la entrega ya no está "Enviada".
- Cambia el correo del cliente de la obra después de enviar: los enlaces anteriores dejan de funcionar y los códigos se envían al correo nuevo. (Por confirmar en P-12.)
- Una evidencia aprobada se rechaza después de enviar: la entrega conserva lo que se envió (se guarda la lista de actividades y evidencias en el momento del envío).
- Imagen de firma vacía, enorme o que no es imagen: la API la rechaza (PNG, máximo 1 MB).
- El enlace se reenvía a otra persona: puede ver la información, pero aceptar o rechazar exige el código que llega al correo de la obra (para rechazar, ver la pregunta abierta 2).
- Sin conexión o error del servidor en la página: se muestra un mensaje y se puede reintentar sin perder la firma dibujada.

## Requirements _(mandatory)_

### Functional Requirements

**Envío (API y app)**

- **FR-001**: El supervisor asignado a la obra y el dueño de la empresa DEBEN poder enviar al cliente el reporte de un periodo de la obra (`POST /obras/:idObra/entregas`).
- **FR-002**: Al enviar, el sistema DEBE guardar una entrega con obra, periodo, quién la envió, fecha y hora, y la lista de actividades y evidencias aprobadas incluidas en ese momento.
- **FR-003**: El sistema DEBE rechazar el envío si la obra no tiene correo del cliente o si el periodo no tiene evidencias aprobadas.
- **FR-004**: El sistema DEBE enviar al correo del cliente de la obra un mensaje con el enlace a la página web, usando Azure Communication Services Email (T-03). En las pruebas el correo se sustituye con un doble.
- **FR-005**: El enlace DEBE llevar un token aleatorio de al menos 128 bits, guardado solo como hash, ligado a la obra y al correo del cliente; da acceso únicamente a las entregas de esa obra.

**Página web del cliente (repositorio `CivilTrace-Portal`)**

- **FR-006**: La página DEBE mostrar, sin cuenta, la lista de entregas de la obra del enlace con nombre, periodo y estado, y el detalle de cada una con actividades y fotografías aprobadas.
- **FR-007**: Las fotografías y firmas DEBEN servirse a través de la API o con enlaces temporales; el almacenamiento sigue privado.
- **FR-008**: Para aceptar, el sistema DEBE enviar un código de un solo uso de 6 dígitos al correo de la obra, guardado como hash, válido 10 minutos y con máximo 5 intentos.
- **FR-009**: Aceptar DEBE exigir código válido, nombre completo y firma dibujada; rechazar DEBE exigir comentario, nombre completo y firma.
- **FR-010**: La firma DEBE guardarse como imagen PNG en Blob Storage privado con su huella SHA-256, nombre, fecha y hora (D-04).
- **FR-011**: Los textos DEBEN decir "aceptación" o "constancia de recepción" y nunca "firma electrónica" (constitución IV.5).
- **FR-012**: La página DEBE incluir el aviso de privacidad (LFPDPPP) o un enlace a él.

**Después de la respuesta**

- **FR-013**: Al aceptar, el sistema DEBE generar el acta de entrega-recepción en PDF con los datos de la obra, el periodo, las actividades, las evidencias aprobadas y el registro de aceptación (RF-14). La pueden descargar el cliente (desde la página) y el supervisor y el dueño (desde la app).
- **FR-014**: Una entrega solo DEBE poder responderse una vez; después queda Aceptada o Con observaciones de forma permanente.
- **FR-015**: Las actividades y evidencias incluidas en una entrega Aceptada NO DEBEN poder modificarse ni borrarse (RF-15).
- **FR-016**: La app DEBE mostrar al supervisor y al dueño las entregas de la obra con su estado, el comentario del cliente si lo rechazó y el acta si lo aceptó.

### Key Entities _(include if feature involves data)_

- **Entrega**: un reporte enviado al cliente. Obra, empresa, periodo (inicio y fin), quién la envió, fecha de envío, estado (`ENVIADA`, `ACEPTADA`, `CON_OBSERVACIONES`), y la respuesta: nombre del cliente, comentario (al rechazar), firma (ruta y SHA-256), fecha y hora de respuesta, ruta del acta.
- **Actividad de la entrega**: qué actividades y qué evidencias aprobadas incluía la entrega al enviarse (copia fija).
- **Enlace del cliente**: hash del token, obra, correo del cliente, fecha de creación y de revocación.
- **Código de un solo uso**: entrega, hash del código, vencimiento, intentos, si ya se usó.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Un cliente que nunca ha usado Civil Trace acepta un reporte desde su celular, desde que abre el correo hasta ver "Reporte aceptado", en menos de 3 minutos.
- **SC-002**: El 100 % de las entregas aceptadas tiene nombre, fecha, hora, firma con SHA-256 y acta descargable.
- **SC-003**: Ningún enlace da acceso a datos de otra obra ni de otra empresa (pruebas de aislamiento en verde).
- **SC-004**: Ningún código vencido, usado o después de 5 intentos permite aceptar.
- **SC-005**: Pruebas con su clave del plan (CP16, CP17) y cobertura de 80 % en los servicios nuevos de la API y 60 % en la app y la página (constitución III).

## Assumptions

- Lo puede enviar el supervisor asignado a la obra y el dueño (el Figma tiene "Enviar al cliente" en las dos versiones de la pantalla de reportes).
- El enlace es por obra: el cliente ve todas las entregas de esa obra con el mismo enlace (`CLIENTE_Abrir enlace de reportes` muestra "Reportes hospital" con varias entregas).
- El correo sale de un dominio administrado por Azure (T-03); para la entrega final se puede usar el dominio del cliente.
- La página se publica en Azure Static Web Apps nivel Free (T-02); la API agrega la dirección de la página a CORS.
- El acta la genera la API (no la app), porque la descargan la página y la app y debe ser el mismo archivo. Se decide la biblioteca en `plan.md`.
- Las pruebas no usan Azure real: correo y almacenamiento con dobles (constitución III.5).

## Preguntas abiertas para el equipo

1. **P-10**: actualizar el SRS (sección de interfaz, RF-13, RF-57 y versión) y CP16–CP17 del plan de pruebas para que el cliente responda en la página web. ¿Quién lo hace?
2. **P-11**: ¿rechazar también exige el código del correo? El Figma solo pide código para aceptar (D-03). Por defecto: **no**, solo comentario, nombre y firma.
3. **P-12**: ¿el cambio de correo del cliente en la obra revoca los enlaces ya enviados? Por defecto: **sí**.
