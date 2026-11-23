# Investigación (fase 0): Asistencia con QR, horario por obra y calendario

**Feature**: `001-asistencia-qr-horario` · **Fecha**: 23/11/2026 · **Spec**: [spec.md](./spec.md)

Cada punto sigue el formato Decisión / Razón / Alternativas. Ninguno cambia el stack (T-01).

## R-01. Contenido del código QR

- **Decisión**: el QR contiene la cadena `ct1.<token>`. El token son 32 bytes aleatorios en base64url (256 bits) de una **credencial de asistencia** propia del trabajador. La API guarda el token y su huella SHA-256. El token es **permanente**: se crea la primera vez que el trabajador lo pide y no cambia (D-17).
- **Razón**: no expone el nombre, el correo ni el id (FR-001), y no se puede fabricar. El trabajador necesita volver a ver su QR en cualquier teléfono, así que la API debe poder devolver el token, y por eso se guarda tal cual. El riesgo es bajo: el token no da acceso a la cuenta, solo identifica para un registro que el supervisor confirma con la foto (FR-005). Si un trabajador deja la empresa, su QR deja de servir porque ya no está asignado a ninguna obra.
- **Alternativas descartadas**:
  - QR con el id del usuario firmado con JWT: el secreto de firma tendría que estar en el teléfono del supervisor para validar sin conexión.
  - Guardar solo el hash: el trabajador no podría recuperar su QR en otro teléfono.
  - QR que rota cada minuto (TOTP) o regenerable: el equipo decidió que el QR sea siempre el mismo (D-17).

## R-02. Validación sin conexión (D-14, FR-026 a FR-030)

- **Decisión**: el endpoint `GET /obras/:obraId/asistencia/paquete-sin-conexion` entrega a la app del supervisor:
  - los trabajadores asignados con su id, nombre, oficio, la ruta de la API para su foto y la **huella SHA-256** de su credencial vigente;
  - el horario general y la excepción de hoy;
  - la zona horaria y las faltas del mes;
  - `generadoEn`.

  Sin conexión, la app calcula el SHA-256 del token escaneado y lo busca en el paquete. El token en claro nunca se descarga.

- **Razón**: valida sin servidor y sin guardar secretos reutilizables en el teléfono. Si roban el teléfono, las huellas no sirven para fabricar un QR.
- **Alternativas descartadas**:
  - Descargar los tokens en claro: quien tenga el teléfono podría copiarlos.
  - No validar sin conexión y aceptar cualquier QR: incumple FR-004.

## R-03. Envío de registros e idempotencia

- **Decisión**: hay un solo endpoint de escritura, `POST /asistencia/registros`, que recibe un lote de 1 a 100 escaneos tanto con conexión como sin ella. Cada escaneo lleva un `idLocal` (UUID v4 generado por la app). La API guarda ese `idLocal` con restricción única en la entrada o la salida. Un reintento con el mismo `idLocal` devuelve `DUPLICADO` y el registro existente, sin crear otro. La respuesta trae el resultado de cada escaneo: `GUARDADO`, `DUPLICADO` o `RECHAZADO` con su motivo (FR-029).
- **Razón**: la app reintenta hasta tener confirmación, sin riesgo de duplicar. Con conexión, el escaneo es un lote de 1, así que hay una sola lógica que probar.
- **Alternativas descartadas**:
  - Dos endpoints, uno con conexión y otro sin ella: duplica las validaciones y las pruebas.
  - Deduplicar por trabajador + hora: dos escaneos legítimos pueden caer en el mismo minuto.

## R-04. Hora del registro

- **Decisión**:
  - Si `sinConexion = false`, la API usa **su propia hora** e ignora `capturadoEn`.
  - Si `sinConexion = true`, usa `capturadoEn`, del teléfono del supervisor. Se rechaza si está más de 5 minutos en el futuro o tiene más de 7 días (`MAXIMO_DIAS_REGISTRO_SIN_CONEXION`).
  - La fecha del registro es la fecha local de esa hora en la zona horaria de la empresa.
- **Razón**: cumple FR-024 y FR-028. Los límites evitan registros absurdos sin depender de detectar relojes mal configurados, que quedó fuera del MVP.
- **Alternativas descartadas**:
  - Usar siempre la hora del servidor: con escaneos sin conexión, la hora sería la de sincronización y no la de llegada.

## R-05. Zona horaria (D-15)

- **Decisión**: agregar `Empresa.zonaHoraria` (texto IANA, por defecto `America/Tijuana`). Las horas se guardan como `timestamptz` (instante UTC). La fecha local del registro se guarda como `date`. Las horas de horario (`"08:00"`) son hora local de la empresa. Las conversiones usan `Intl.DateTimeFormat` de Node 24, sin dependencias nuevas.
- **Razón**: cambiar después a `America/Mexico_City` solo cambia cómo se muestran y clasifican los registros **nuevos**. Los guardados conservan su instante, su fecha y su clasificación (FR-024a, FR-013).
- **Alternativas descartadas**:
  - Guardar la hora local sin zona: impide cambiar de zona sin migrar datos.
  - Usar una librería de fechas: no hace falta con `Intl`.

## R-06. Horario: general y "solo hoy" (D-06)

- **Decisión**: hay una tabla `HorarioObra` con dos alcances:
  - `GENERAL`: el vigente es el más reciente.
  - `DIA`: excepción con `fecha`; la más reciente para esa fecha gana sobre el general.

  Nunca se borra ni se sobrescribe: cada guardado crea una fila, y eso funciona como historial. Los días laborales se guardan como `Int[]` (0 = domingo … 6 = sábado), igual que `Date.getDay()`.

- **Razón**: se conserva quién cambió el horario y cuándo, sin otra tabla de historial. Las consultas son simples.
- **Alternativas descartadas**:
  - Columnas en `Obra`: pierden el historial y no permiten excepciones de un día.

## R-07. Clasificación y foto del horario (FR-012, FR-013)

- **Decisión**: al guardar la **entrada** se copia en el registro el horario efectivo de ese día: `horarioEntrada`, `horarioSalida`, `toleranciaMinutos` y `esDiaLaborable`.
  - Es `RETARDO` si `entrada > horarioEntrada + tolerancia`, comparando minutos locales; justo en el límite no es retardo.
  - Con la **salida**: si `salida < horarioSalida` y el tipo es `COMPLETA`, pasa a `SALIDA_TEMPRANA`. Si ya era `RETARDO`, queda como `RETARDO`. El supervisor decide si es media jornada.
  - En un día no laborable no se clasifica nada: queda `COMPLETA`.
  - Una clasificación automática **no** exige anotación. La anotación es obligatoria cuando el **supervisor guarda** un tipo distinto de `COMPLETA` (FR-016, RF-60).
- **Razón**: SC-006 exige que la clasificación sea exacta en los límites. La copia del horario evita reclasificar registros viejos. Así el escaneo queda en segundos (SC-001) y la justificación va después en "Detalles de asistencia".
- **Alternativas descartadas**:
  - Clasificar al consultar con el horario vigente: cambiaría días pasados.

## R-08. Faltas (suposición aprobada: "Faltas correcto")

- **Decisión**: la falta automática **no se guarda**. Se **calcula** al armar el calendario: un día laborable pasado, posterior a la asignación del trabajador, en el que el trabajador no tiene registro. Si el supervisor guarda detalles para ese día (FR-018), se crea un `RegistroAsistencia` con `tipoJornada = FALTA` (o lo que elija), sin entrada ni salida. La falta es "justificada" si tiene motivo.
- **Razón**: no hace falta un proceso programado, que en App Service B1 complicaría el MVP, y el calendario siempre es consistente con el horario de cada día.
- **Limitación aceptada**: el modelo no guarda la fecha de asignación de un trabajador a una obra. Mientras no exista, se cuentan días desde `max(inicio de la obra, alta del usuario)`. Hay que proponer `AsignacionObra` con fechas al equipo; está registrado como pendiente en el plan.
- **Alternativas descartadas**:
  - Un cron diario que inserte faltas: necesita infraestructura (Functions o WebJobs) y genera filas que habría que corregir si cambia el horario.

## R-09. Historial de cambios (FR-017, principio IV.6)

- **Decisión**: hay una tabla `CambioAsistencia` con un renglón por campo cambiado: `campo`, `valorAnterior`, `valorNuevo`, `autorId`, `creadoEn` y `motivo`, que es la anotación del guardado. Se escribe en la misma transacción que el cambio. No hay endpoints para borrar registros ni cambios.
- **Razón**: la pantalla `SUP_CalendarioTrabajador_DetalleDia` muestra "entrada original 8:20 → 8:00", y eso requiere el detalle por campo.

## R-10. Oficio del trabajador

- **Hallazgo**: el Figma muestra el oficio ("Plomero") en cinco pantallas, pero `Usuario` no tiene ese campo y no existe en la app.
- **Decisión**: agregar `Usuario.oficio String?` (opcional, máximo 60 caracteres). Se captura en el **perfil** (D-18): `GET /perfil` lo devuelve y `PUT /perfil` lo acepta. Si no hay oficio, se muestra solo el nombre. El Figma de perfil debe actualizarse con este campo.

## R-11. Fotografía del trabajador

- **Decisión**: se usa `Usuario.fotoBlob`, que ya existe, servida **a través de la API** con `GET /obras/:obraId/asistencia/trabajadores/:trabajadorId/foto` (SUP-OBRA o DUENO), igual que `GET /perfil/foto` (principio IV.4). La app la descarga con conexión y la guarda para usarla sin conexión. Si no hay foto, la app muestra las iniciales.
- **Ajuste (23/11/2026, implementación)**: se descartó la URL SAS porque la API no tiene código para generar enlaces temporales, y servirla por la API reutiliza `obtenerImagen`.

## R-12. Infraestructura de pruebas y lint

- **Hallazgo**: `package.json` todavía no tiene `lint` ni `test`. `CLAUDE.md` dice que eso es el "módulo 00".
- **Decisión**: la primera fase de tareas de este feature agrega Vitest (con `app.inject()` y PostgreSQL de `docker-compose`), ESLint para TypeScript y los scripts `lint`, `test` y `test:cobertura`. Sin esto no se cumple la puerta de calidad.

## R-13. Claves del plan de pruebas (P-03)

- **Hallazgo**: CP19 ("Registrar retardo y consultar calendario de asistencia") cubre RF-60, RF-58 y RF-56 del SRS V4.0. El plan de pruebas los llama RF-63, RF-61 y RF-59. RF-19 y RF-27 eran _Should_ y no tienen caso de prueba. Al subirlos a _Must_ (P-04) necesitan uno.
- **Decisión**: las pruebas usan:
  - `CP19-E1/E2/E3` para retardo, calendario y descuento;
  - las claves **propuestas** `CP21-E1/E2/E3` (Registrar asistencia con QR) y `CP22-E1/E2/E3` (Fijar horario de obra), para agregarlas al plan de pruebas;
  - pruebas extra como `CP19-A1`, `CP21-A1`… para casos borde que no son escenarios del plan.
