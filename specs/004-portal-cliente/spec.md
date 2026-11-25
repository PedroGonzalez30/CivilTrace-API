# Especificación del feature: Portal web del cliente y entregas

**Feature Branch**: `004-portal-cliente` (API y app); repositorio nuevo `CivilTrace-Portal` (T-02)

**Created**: 2026-11-24

**Status**: Draft

**Autor**: Emilio Manuel Esquivel

**Input**: Descripción del usuario: "Hacer la página web del cliente como sale en el Figma, con el SRS v5.0 como base."

**Base**: `SRS_Civil_Trace_v5.0_con_cambios.docx` (decisión D-28). Desde este feature los números de RF son los del **SRS v5.0**; los features 001 a 003 conservan los de la V4.0 (P-03).

**Requerimientos del SRS v5.0 que atiende**:

| RF                                                       | Prioridad | Resumen                                                                                                   |
| -------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| `RF-65 Enviar enlace del portal al cliente`              | Must      | Al registrar la obra, el cliente recibe por correo un enlace **único y permanente** al portal de su obra. |
| `RF-66 Consultar avances en el portal del cliente`       | Must      | Actividades de la obra con su estado y solo las fotos aceptadas con fecha, hora y ubicación, por fecha.   |
| `RF-67 Consultar entregas en el portal del cliente`      | Must      | Sección Entregas: cada entrega con su estado; en las Enviadas, Aceptar o Registrar observaciones.         |
| `RF-13 Enviar entrega al cliente`                        | Must      | El supervisor elige un **rango de fechas**; la entrega lleva solo lo aprobado del rango (D-29).           |
| `RF-14 Registrar aceptación de entrega`                  | Must      | Nombre + código de un solo uso + firma; guarda nombre, firma, fecha y hora.                               |
| `RF-60 Firmar aceptación de entrega`                     | Must      | Recuadro de firma; no se confirma sin firma; la firma se guarda como imagen.                              |
| `RF-15 Registrar observaciones del cliente`              | Should    | Texto no vacío; la entrega pasa a Con observaciones y el supervisor las ve.                               |
| `RF-16 Generar acta de entrega-recepción`                | Must      | PDF para una entrega Aceptada, a solicitud del dueño o el supervisor ("Generar acta").                    |
| `RF-71 Descargar documentos de una entrega en el portal` | Must      | El cliente descarga el reporte de la entrega y, si está Aceptada, el acta.                                |
| `RF-17 Bloquear entrega aceptada`                        | Must      | Nadie modifica ni elimina actividades o evidencias de una entrega Aceptada.                               |

**Fuera de este feature** (features posteriores):

- `RF-26 Registrar evaluación del cliente` (Could): calificación 1–5 opcional al aceptar. No está en el Figma.
- `RF-22 Registrar cambio solicitado` y `RF-72 Aceptar cambio desde el portal` (Could).
- `RF-25 Verificar acta por código QR` (Should).
- `RF-18 Consultar expediente de la obra` (Must): el acta queda lista para el expediente, pero la pantalla del expediente es otro feature.
- `RF-27 Mostrar indicadores por obra` (Could) y `RF-33 Calcular desempeño del trabajador` (**Won't** en el v5.0; ver P-13).
- Infraestructura nueva de Azure (correo con Azure Communication Services, T-03; Static Web Apps, T-02): se describe en Terraform en el plan y se crea solo con aprobación del equipo.

**Pantallas del Figma** (archivo `EIXrnioyKFd9EoBY5PINOV`):

| Pantalla                                           | node-id    | Quién              |
| -------------------------------------------------- | ---------- | ------------------ |
| `SUP_REporte PDF` (botón "Enviar al cliente")      | `179:2834` | Supervisor (app)   |
| `ReportePdf -Dueño`                                | `144:1963` | Dueño (app)        |
| `ReportePdfEnviar -Dueño` ("Se envió al cliente")  | `144:2116` | Supervisor o dueño |
| `ReporteActa -Dueño` ("Crear acta de entrega")     | `144:2536` | Supervisor o dueño |
| `CLIENTE_Abrir enlace de reportes`                 | `246:1178` | Cliente (portal)   |
| `CLIENTE_AceptarREPORTE CON CODIGO`                | `246:1269` | Cliente (portal)   |
| `CLIENTE RECHAZAR REPORTE/AVNACES CON COMENTARIOS` | `246:1605` | Cliente (portal)   |
| `CLIENTE_FirmarAceptacion`                         | `2271:118` | Cliente (portal)   |
| `CLIENTE_FirmarRechazo`                            | `2271:158` | Cliente (portal)   |
| `CLIENTE_ReporteAceptado`                          | `2271:192` | Cliente (portal)   |

Las pantallas del cliente miden 412 px: el portal se diseña primero para celular y también debe verse bien en computadora.

**Faltan en el Figma** (P-14): la vista de **Avances** del portal (RF-66: actividades con estado y fotos) y cómo se separan Avances y Entregas (pestañas o secciones). Hasta que el equipo las diseñe, el portal usa los mismos componentes del Figma: tarjetas de `CLIENTE_Abrir enlace de reportes` y la lista de actividades de `CLIENTE_AceptarREPORTE CON CODIGO`.

**Términos**: una actividad **Verificada** (SRS v5.0) es la que en la API tiene estado `TERMINADA`: el supervisor aprobó su foto "Terminado" o la terminó él mismo (feature 003). Una foto **aceptada** es un avance `APROBADO`.

## User Scenarios & Testing _(mandatory)_

### Historia 1 - El cliente recibe el enlace permanente de su obra (Priority: P1)

Cuando el dueño registra una obra con el correo del cliente, el sistema crea un enlace único y permanente al portal de esa obra y se lo envía al cliente por correo. El cliente lo abre en cualquier navegador, sin crear cuenta.

**Why this priority**: es la puerta del portal (RF-65, Must); sin enlace el cliente no ve nada.

**Independent Test**: registrar una obra y comprobar que el doble de correo recibió un mensaje con un enlace que abre el portal de esa obra.

**Acceptance Scenarios**:

1. **Given** un dueño que registra una obra con correo del cliente, **When** la guarda, **Then** el cliente recibe un correo con el enlace y, al abrirlo, entra al portal de su obra sin crear cuenta.
2. **Given** un enlace alterado o que no corresponde a ninguna obra, **When** alguien lo abre, **Then** el portal no muestra información de ninguna obra.
3. **Given** una obra registrada antes de este feature (sin enlace), **When** el supervisor envía su primera entrega o el dueño elige "Reenviar enlace al cliente", **Then** se crea el enlace y se envía por correo.
4. **Given** que el correo del cliente falla al enviarse, **When** se guarda la obra, **Then** la obra sí se guarda, la app avisa que el correo no salió y permite reenviar el enlace.

---

### Historia 2 - El cliente consulta los avances de su obra (Priority: P1)

En el portal, el cliente ve las actividades de su obra con su estado y, en cada una, solo las fotografías aceptadas con fecha, hora y ubicación, ordenadas por fecha.

**Why this priority**: RF-66 (Must). Es lo que pidió el cliente: ver el avance con fotos sin depender de WhatsApp.

**Independent Test**: con una obra de 4 actividades y 10 fotos (2 rechazadas), abrir el enlace y ver las 4 actividades y solo las 8 fotos aceptadas.

**Acceptance Scenarios**:

1. **Given** una obra con 4 actividades y 10 fotos, 2 rechazadas, **When** el cliente abre su enlace, **Then** ve las 4 actividades con su estado y solo las 8 fotos aceptadas con fecha, hora y ubicación.
2. **Given** una obra sin fotos aceptadas, **When** el cliente abre su enlace, **Then** el portal indica que aún no hay avances registrados.
3. **Given** fotos pendientes de revisión, **When** el cliente consulta, **Then** no las ve (D-10).

---

### Historia 3 - El supervisor envía una entrega al cliente por rango de fechas (Priority: P1)

En la vista previa del reporte de la obra, el supervisor (o el dueño, como en el Figma) elige un **rango de fechas** con el filtro y toca "Enviar al cliente". La entrega incluye las actividades del rango con **solo sus fotos aprobadas** (las pendientes y rechazadas no van); no hay selección manual de actividades (D-29). Queda publicada en el portal con estado Enviada y el cliente recibe un aviso por correo con el enlace de su obra. La app muestra "Se envió al cliente".

**Why this priority**: RF-13 (Must). Sin entregas no hay nada que aceptar.

**Independent Test**: enviar una entrega de un rango con 2 actividades con fotos aprobadas y 1 foto pendiente; comprobar que aparece en el portal como Enviada con sus fotos aceptadas y que el doble de correo recibió el aviso.

**Acceptance Scenarios**:

1. **Given** una obra con fotos aprobadas en el rango elegido, **When** el supervisor envía, **Then** la entrega aparece en el portal con estado Enviada, con cada actividad del rango y solo sus fotos aprobadas, y el cliente recibe un correo con el enlace del portal.
2. **Given** un rango sin fotos aprobadas, **When** intenta enviar, **Then** el sistema no crea la entrega e indica que no hay avances aprobados en ese rango.
3. **Given** una obra sin correo del cliente, **When** intenta enviar, **Then** el sistema lo impide e indica que falta el correo.
4. **Given** un supervisor no asignado a la obra o un trabajador, **When** intenta enviar, **Then** la API lo rechaza (403).
5. **Given** un rango que se encima con el de una entrega Enviada o Aceptada, **When** se envía, **Then** la entrega nueva solo lleva las fotos aprobadas que no se habían enviado; si no queda ninguna, el sistema lo indica (P-15).

---

### Historia 4 - El cliente acepta una entrega con código y firma (Priority: P1)

En la sección Entregas, en una entrega Enviada, el cliente toca "Aceptar". El sistema envía un código de un solo uso a su correo ("Introduce el código de seguridad"); el cliente lo escribe, escribe su nombre, dibuja su firma ("Firma tu aceptación") y toca "Firmar y aceptar". Ve "Reporte aceptado" con nombre, fecha, hora y firma.

**Why this priority**: RF-14 y RF-60 (Must): la aceptación con constancia es el objetivo del sistema.

**Independent Test**: aceptar una entrega con el código que capturó el doble de correo y una firma; comprobar estado Aceptada con nombre, firma (PNG + SHA-256), fecha y hora.

**Acceptance Scenarios**:

1. **Given** una entrega Enviada, **When** el cliente escribe su nombre, ingresa el código recibido, dibuja su firma y confirma, **Then** la entrega pasa a Aceptada con nombre, firma, fecha y hora.
2. **Given** un código incorrecto o vencido, **When** intenta confirmar, **Then** no se registra la aceptación y puede pedir un código nuevo.
3. **Given** 5 intentos fallidos, **When** escribe otro código, **Then** el código queda invalidado y debe pedir uno nuevo.
4. **Given** un recuadro de firma vacío, **When** intenta confirmar, **Then** no se registra la aceptación e indica que falta la firma ("El botón se activa cuando dibujas tu firma").
5. **Given** una entrega Aceptada o Con observaciones, **When** el cliente la abre, **Then** ve su estado y no aparecen las opciones Aceptar ni Registrar observaciones.

---

### Historia 5 - El cliente registra observaciones (Priority: P2)

En una entrega Enviada, el cliente toca "Rechazar", escribe qué debe corregirse ("Agrega un comentario para el supervisor"), escribe su nombre, firma ("Firma tu rechazo") y toca "Firmar y rechazar". La entrega pasa a "Con observaciones" y el supervisor las ve en la app.

**Why this priority**: RF-15 es Should. El SRS solo exige el texto; el Figma (D-03) agrega nombre y firma, y se conservan.

**Independent Test**: registrar observaciones con texto, nombre y firma; la entrega queda Con observaciones y el texto aparece en la app.

**Acceptance Scenarios**:

1. **Given** una entrega Enviada, **When** el cliente escribe observaciones, su nombre y firma, y las envía, **Then** la entrega pasa a Con observaciones y el supervisor las ve.
2. **Given** un texto de observaciones vacío, **When** intenta guardar, **Then** la entrega no cambia de estado e indica que falta el texto.
3. **Given** una entrega Con observaciones, **When** el supervisor corrige, **Then** puede enviar una entrega nueva con esas actividades (la anterior queda en el historial, P-15).

---

### Historia 6 - Acta de entrega-recepción y descargas (Priority: P1)

Para una entrega Aceptada, el supervisor o el dueño toca "Generar acta" y obtiene el acta en PDF con los datos de la obra, las actividades, las fotos aceptadas y el registro de aceptación (nombre, firma, fecha y hora). En el portal, el cliente descarga el reporte de cualquier entrega y, si está Aceptada, también el acta.

**Why this priority**: RF-16 y RF-71 (Must). El acta es el documento de cierre que hoy se hace en papel.

**Independent Test**: con una entrega Aceptada, generar el acta desde la app y descargarla desde el portal: es el mismo PDF; con una Enviada, el portal solo ofrece el reporte.

**Acceptance Scenarios**:

1. **Given** una entrega Aceptada, **When** el dueño o el supervisor solicita el acta, **Then** obtiene un PDF con los datos de la obra, las actividades, las fotos aceptadas y el registro de aceptación con la firma del cliente.
2. **Given** una entrega no aceptada, **When** se solicita el acta, **Then** el sistema no la genera e indica que falta la aceptación.
3. **Given** una entrega Aceptada, **When** el cliente elige Descargar en el portal, **Then** obtiene el reporte de avance y el acta en PDF ("Descargar acta (PDF)" en `CLIENTE_ReporteAceptado`).
4. **Given** una entrega Enviada, **When** el cliente consulta sus documentos, **Then** solo puede descargar el reporte y el portal indica que el acta se genera al aceptar.
5. **Given** una entrega Aceptada, **When** cualquier usuario intenta modificar o eliminar una de sus actividades o evidencias, **Then** el sistema rechaza la operación y la app las muestra sin opciones de edición (RF-17).

### Edge Cases

- El cliente pide varios códigos seguidos: solo vale el último y se limita a un código por minuto por entrega.
- Dos pestañas responden la misma entrega: la segunda respuesta se rechaza porque ya no está Enviada.
- Cambia el correo del cliente de la obra: el enlace sigue siendo el mismo (es permanente), se envía al correo nuevo y los códigos van al correo nuevo (P-12).
- Una foto aceptada se rechaza después de enviar la entrega: la entrega conserva lo que se envió (copia fija de actividades y fotos al enviar).
- Imagen de firma vacía, mayor a 1 MB o que no es PNG: la API la rechaza.
- El enlace se reenvía a otra persona: puede ver avances y entregas, pero aceptar exige el código que llega al correo de la obra.
- Error de red en el portal: mensaje claro y se puede reintentar sin perder la firma dibujada ni el texto escrito.

## Requirements _(mandatory)_

### Functional Requirements

**Enlace y correo**

- **FR-001**: Al registrar una obra con correo del cliente, el sistema DEBE crear un enlace único y permanente a su portal y enviarlo por correo (RF-65). El token DEBE ser aleatorio de al menos 128 bits y guardarse solo como hash (constitución IV.3).
- **FR-002**: El dueño DEBE poder reenviar el enlace de una obra; las obras sin enlace lo reciben al reenviar o al enviar su primera entrega.
- **FR-003**: Los correos DEBEN enviarse con Azure Communication Services Email (T-03). En pruebas se usa un doble.

**Portal: avances y entregas**

- **FR-004**: El portal DEBE mostrar, sin cuenta, las actividades de la obra del enlace con su estado y solo sus fotos aceptadas con fecha, hora y ubicación, ordenadas por fecha (RF-66).
- **FR-005**: El portal DEBE mostrar la sección Entregas con cada entrega y su estado (Enviada, Aceptada, Con observaciones); solo las Enviadas ofrecen Aceptar y Registrar observaciones (RF-67).
- **FR-006**: Un enlace DEBE dar acceso solo a su obra; pedir datos de otra obra u otra empresa responde 404 sin datos.
- **FR-007**: Fotos y firmas DEBEN servirse a través de la API o con enlaces temporales; el almacenamiento sigue privado.

**Entregas**

- **FR-008**: El supervisor asignado a la obra y el dueño DEBEN poder enviar una entrega eligiendo un rango de fechas; la entrega incluye las actividades del rango con solo sus fotos aprobadas (RF-13, D-29).
- **FR-009**: El sistema DEBE rechazar la entrega si el rango no tiene fotos aprobadas o si la obra no tiene correo del cliente.
- **FR-010**: Al enviar, el sistema DEBE guardar una copia fija de las actividades y fotos aceptadas incluidas, publicar la entrega en el portal y avisar al cliente por correo.

**Aceptación y observaciones**

- **FR-011**: Para aceptar, el sistema DEBE enviar al correo de la obra un código de 6 dígitos, guardado como hash, válido 10 minutos, con máximo 5 intentos (constitución IV.3).
- **FR-012**: Aceptar DEBE exigir nombre, código válido y firma dibujada; DEBE guardar nombre, firma, fecha y hora (RF-14, RF-60).
- **FR-013**: Registrar observaciones DEBE exigir un texto no vacío; además pide nombre y firma como en el Figma (RF-15, D-03).
- **FR-014**: La firma DEBE guardarse como PNG en Blob Storage privado con su huella SHA-256 (D-04). Los textos dicen "aceptación" o "constancia de recepción", nunca "firma electrónica" (constitución IV.5).
- **FR-015**: Una entrega DEBE responderse una sola vez.

**Documentos y bloqueo**

- **FR-016**: El supervisor y el dueño DEBEN poder generar el acta en PDF de una entrega Aceptada; el sistema DEBE negarla si no está Aceptada (RF-16).
- **FR-017**: El cliente DEBE poder descargar desde el portal el reporte de cada entrega y el acta de las Aceptadas (RF-71). Es el mismo archivo que obtienen el supervisor y el dueño.
- **FR-018**: El sistema DEBE rechazar modificar o eliminar actividades y evidencias que formen parte de una entrega Aceptada (RF-17).
- **FR-019**: La app DEBE mostrar al supervisor y al dueño las entregas de la obra con su estado, las observaciones del cliente y el acta.
- **FR-020**: El portal DEBE incluir el aviso de privacidad o un enlace a él (LFPDPPP, constitución IV.7).

### Key Entities _(include if feature involves data)_

- **Enlace del portal**: obra, hash del token, correo al que se envió, fecha de creación y de último envío. Uno por obra (permanente).
- **Entrega**: obra, empresa, quién la envió, fecha de envío, estado (`ENVIADA`, `ACEPTADA`, `CON_OBSERVACIONES`); respuesta del cliente: nombre, observaciones, firma (ruta y SHA-256), fecha y hora; ruta del acta y del reporte.
- **Actividad de la entrega**: copia fija de cada actividad incluida y de sus fotos aceptadas al momento de enviar.
- **Código de un solo uso**: entrega, hash del código, vencimiento, intentos, si ya se usó.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Un cliente que nunca usó Civil Trace acepta una entrega desde su celular, desde que abre el correo hasta ver "Reporte aceptado", en menos de 3 minutos.
- **SC-002**: El 100 % de las entregas Aceptadas tiene nombre, fecha, hora, firma con SHA-256 y acta descargable.
- **SC-003**: Ningún enlace muestra datos de otra obra ni de otra empresa (pruebas de aislamiento en verde).
- **SC-004**: Ningún código vencido, usado o con 5 intentos fallidos permite aceptar.
- **SC-005**: Cada escenario tiene prueba automática con la clave del plan de pruebas (por mapear al v5.0, P-10); cobertura de 80 % en servicios nuevos de la API y 60 % en la app y el portal (constitución III).

## Assumptions

- El acta y el reporte de la entrega los genera la **API** (no la app): el portal y la app deben descargar el mismo archivo. La biblioteca de PDF se decide en `plan.md`.
- El dueño también puede enviar entregas porque el Figma tiene "Enviar al cliente" en sus pantallas, aunque RF-13 menciona solo al supervisor.
- La entrega se arma con el filtro de fechas del reporte que ya existe (Figma `ReporteFiltro`); no hace falta diseñar una selección de actividades (D-29).
- El correo sale de un dominio administrado por Azure (T-03); en la entrega final puede usarse el dominio del cliente.
- El portal se publica en Azure Static Web Apps nivel Free (T-02); la API agrega su dirección a CORS.
- Las pruebas no usan Azure real: correo y almacenamiento con dobles (constitución III.5).

## Preguntas abiertas para el equipo

Las respuestas por defecto permiten avanzar; se registran en `docs/decisiones.md`.

1. **P-10**: el plan de pruebas (CP15–CP17) sigue la V4.0. Hay que mapear sus claves al v5.0 o agregar casos para el portal. ¿Quién lo hace?
2. **P-11**: ¿registrar observaciones también exige el código del correo? Por defecto **no** (ni el SRS ni el Figma lo piden).
3. **P-12**: si cambia el correo del cliente, el enlace permanente se reenvía al correo nuevo. Por defecto **sí**.
4. **P-14**: falta diseñar en el Figma la vista de Avances del portal. Por defecto se arman con los componentes existentes.
5. **P-15**: una foto aprobada solo va en una entrega Enviada o Aceptada; si la entrega queda Con observaciones, sus fotos se pueden volver a enviar. Por defecto **sí**.
