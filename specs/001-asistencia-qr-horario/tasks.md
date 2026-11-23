---
description: 'Lista de tareas del feature 001: asistencia con QR, horario por obra y calendario (API)'
---

# Tasks: Asistencia con QR, horario por obra y calendario

**Input**: documentos de diseño en `specs/001-asistencia-qr-horario/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/asistencia-api.md](./contracts/asistencia-api.md), [quickstart.md](./quickstart.md)

**Tests**: son **obligatorios**, por el principio III de la constitución (pruebas primero). Cada prueba lleva en su nombre la clave del plan de pruebas que valida (`CP19-E1`, `CP21-E2`…) o una clave de caso borde (`CP21-A1`…). Se escriben antes de la implementación y deben fallar antes de implementar.

**Organization**: las tareas se agrupan por historia de usuario, en el orden de prioridad de la spec.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede hacerse en paralelo (archivos distintos y sin dependencias pendientes).
- **[Story]**: US1 a US4, las historias de la spec.

**Reglas para todo archivo nuevo** (constitución II), que no se repiten en cada tarea:

- Encabezado ECCT con `@requerimientos`.
- Secciones numeradas.
- Identificadores en español sin acentos.
- Constantes de negocio desde `src/constantes/asistencia.ts`.
- Errores con `ErrorHttp` y mensajes en español.
- Cada ruta usa `verificarToken`, valida con zod y filtra por el `empresaId` del token.

---

## Phase 1: Setup (módulo 00: pruebas y lint)

**Purpose**: la API todavía no tiene `lint` ni `test` (research R-12). Sin esto no se cumple la puerta de calidad.

- [x] T001 Instalar Vitest y `@vitest/coverage-v8` como dependencias de desarrollo. Crear `vitest.config.ts` con el alias `@/` → `src/`, `include: ['pruebas/**/*.test.ts']`, la cobertura de `src/servicios/**` con umbral de líneas del 80 % y la ejecución en serie para las pruebas de integración. Agregar los scripts `test` y `test:cobertura` en `package.json`.
- [x] T002 [P] Instalar ESLint 9 con `typescript-eslint` y `eslint-config-prettier`. Crear `eslint.config.js` con las reglas del ECCT que se pueden automatizar (`no-var`, `prefer-const`, `eqeqeq`, `curly`) e ignorar `src/generated/**`. Agregar el script `lint` en `package.json`. Corregir los errores que aparezcan en `src/` sin cambiar comportamiento.
- [x] T003 [P] Crear una base de prueba separada: un servicio `postgres-pruebas` (o una base `civiltrace_pruebas`) en `docker-compose.yml` y la variable `DATABASE_URL_PRUEBAS` en `.env.example`. No poner secretos reales.
- [x] T004 Crear `pruebas/configuracion/configuracionGlobal.ts`, que aplica las migraciones con `prisma migrate reset --force --skip-seed` sobre la base de prueba antes de la suite. Crear también `pruebas/configuracion/baseDatosPrueba.ts`, con la función `limpiarTablas()` (TRUNCATE en cascada de las tablas de negocio entre archivos de prueba).
- [x] T005 [P] Crear `pruebas/configuracion/dobleAlmacenamiento.ts`, un doble del servicio de almacenamiento que guarda las imágenes en memoria (`guardarImagen`, `obtenerImagen`, `eliminarImagen`). Conectarlo con `vi.mock('@/servicios/servicioAlmacenamiento')` en el setup.
- [x] T006 Crear `pruebas/configuracion/fabricas.ts` con los ayudantes `crearEmpresa()`, `crearUsuario({ rol, empresaId, oficio? })`, `crearObra({ empresaId, supervisorId, trabajadorIds })`, `iniciarSesion(app, usuario)` (devuelve el encabezado `Authorization`) y `construirAppPrueba()` (envuelve `construirApp()`). Debe incluir los datos de [quickstart.md](./quickstart.md): Todo Concreto, María Castro, Ana Sánchez, la obra Hospital y otra empresa.
- [x] T007 Crear `pruebas/integracion/salud.test.ts`, una prueba humo de `GET /salud` con `app.inject()`, para comprobar que la infraestructura funciona. Verificar que `npm run typecheck && npm run lint && npm test` pasan.

**Checkpoint**: la puerta de calidad funciona.

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: esquema, constantes, utilidades de fechas y permisos, y el horario efectivo, que usan todas las historias.

**⚠️ CRITICAL**: no se empieza ninguna historia antes de terminar esta fase.

- [X] T008 Modificar `prisma/schema.prisma` según [data-model.md](./data-model.md):
  - los enums `AlcanceHorario`, `TipoJornada`, `MotivoAsistencia` y `EfectoPago`;
  - los campos `Empresa.zonaHoraria` y `Usuario.oficio`;
  - los modelos `HorarioObra`, `CredencialAsistencia` (con `trabajadorId @unique`), `RegistroAsistencia` (con `@@unique([trabajadorId, obraId, fecha])` y `entradaIdLocal`/`salidaIdLocal` únicos) y `CambioAsistencia`, todos con `onDelete: Restrict` y los índices del modelo;
  - las relaciones inversas en `Empresa`, `Obra` y `Usuario`.

  Generar la migración con `npx prisma migrate dev --name asistencia_qr_horario` y correr `npm run generar`.

- [X] T009 [P] Crear `src/constantes/asistencia.ts` con las constantes de la sección "Constantes de negocio" de [data-model.md](./data-model.md).
- [X] T010 [P] Escribir primero `pruebas/unidad/fechasLocales.test.ts`, que cubra:
  - la conversión instante → fecha y minutos locales en `America/Tijuana` y en `America/Mexico_City`;
  - el cambio de horario de verano de Tijuana;
  - `HH:MM` → minutos;
  - el día de la semana local.
- [X] T011 Implementar `src/utilidades/fechasLocales.ts` con `Intl.DateTimeFormat` (R-05):
  - `obtenerFechaLocal(instante, zona)` → `YYYY-MM-DD`;
  - `obtenerMinutosLocales(instante, zona)`;
  - `convertirHoraAMinutos('HH:MM')`;
  - `obtenerDiaSemana(fecha)`;
  - `construirInstante(fecha, 'HH:MM', zona)`;
  - `esZonaHorariaValida(zona)`.

  Deben pasar las pruebas de T010.

- [X] T012 [P] Implementar `src/utilidades/permisosObra.ts`:
  - `obtenerObraDeEmpresa(obraId, empresaId)`: lanza 404 si la obra no existe en la empresa;
  - `exigirSupervisorDeObra(obra, usuario)`: 403;
  - `exigirSupervisorODueno(obra, usuario)`;
  - `estaAsignadoAObra(trabajadorId, obraId)`.

  Agregar su prueba unitaria o de integración en `pruebas/integracion/permisosObra.test.ts`, que incluya otra empresa → 403/404 sin revelar datos.

- [X] T013 Implementar en `src/servicios/servicioHorario.ts` las funciones de lectura que comparten las historias, según R-06 y [data-model.md](./data-model.md) `HorarioObra.alcance`, `HorarioObra.fecha` y `HorarioObra.diasLaborales`:
  - `obtenerHorarioGeneral(obraId)`;
  - `obtenerHorarioEfectivo(obraId, fecha)`, que devuelve `{ horaEntrada, horaSalida, toleranciaMinutos, esDiaLaborable, esExcepcion }` o `null`;
  - `obtenerZonaHorariaEmpresa(empresaId)`.

**Checkpoint**: la base está lista.

---

## Phase 3: User Story 1: Registrar entrada y salida con QR (Priority: P1) 🎯 MVP

**Goal**: el trabajador muestra su QR permanente y el supervisor lo escanea, con conexión o sin ella. Se guardan la entrada y la salida con hora, ubicación y supervisor (RF-19, RF-27, RNF-07 / D-14, D-17).

**Independent Test**: dos escaneos del mismo trabajador en un día crean una entrada y una salida, y `GET /asistencia/mi-dia` muestra ambas como `REGISTRADA` (quickstart CP21-E1, CP21-E2).

### Tests for User Story 1 ⚠️ (escribir primero y comprobar que fallan)

- [ ] T014 [P] [US1] Crear `pruebas/unidad/clasificacionAsistencia.test.ts` con:
  - `CP19-A4`: entrada 08:15 exactas con tolerancia de 15 → `COMPLETA`; 08:16 → `RETARDO`;
  - salida antes de `horarioSalida` con `COMPLETA` → `SALIDA_TEMPRANA`;
  - salida temprana con `RETARDO` → sigue `RETARDO`;
  - día no laborable → `COMPLETA`.
- [ ] T015 [P] [US1] Crear `pruebas/integracion/credencialAsistencia.test.ts` con:
  - `CP21-A4`: dos llamadas a `GET /asistencia/mi-credencial` devuelven el mismo `codigoQr` con prefijo `ct1.`;
  - un supervisor o dueño que la pide recibe 403.
- [ ] T016 [P] [US1] Crear `pruebas/integracion/registroAsistencia.test.ts` con:
  - `CP21-E1`: entrada `GUARDADO` con ubicación y autora;
  - `CP21-E2`: salida y `SALIDA_TEMPRANA`;
  - `CP21-E3`: QR de otra empresa → `QR_INVALIDO` sin datos; trabajador no asignado → `NO_ASIGNADO`;
  - `CP21-A1`: tercer escaneo → `ASISTENCIA_COMPLETA`;
  - `CP21-A2`: `idLocal` repetido → `DUPLICADO`, con un solo registro;
  - `CP21-A3`: lote `sinConexion` con `capturadoEn` 08:01 → entrada 08:01 y `entradaSinConexion = true`; `capturadoEn` con más de 7 días o más de 5 min en el futuro → `FECHA_FUERA_DE_RANGO`;
  - supervisor de otra obra → `NO_ES_SUPERVISOR`;
  - lote de 101 → 400.
- [ ] T017 [P] [US1] Crear `pruebas/integracion/vistaPreviaYPaquete.test.ts` con:
  - `POST /obras/:obraId/asistencia/vista-previa`, que devuelve el tipo `ENTRADA`/`SALIDA`, el nombre, el oficio, `fotoUrl` como ruta de la API; `GET .../foto` devuelve la imagen del doble y `faltasMes`, y responde 422 con cada `motivo`;
  - `GET /obras/:obraId/asistencia/paquete-sin-conexion`, que incluye `huellaCredencial` = SHA-256 del token y **nunca** el token en claro;
  - `GET /asistencia/mis-obras`, que solo devuelve las obras supervisadas.
- [ ] T018 [P] [US1] Crear `pruebas/integracion/resumenDia.test.ts` con:
  - `GET /obras/:obraId/asistencia?fecha=`, con `estadoEntrada` `FINALIZADO`/`PENDIENTE` según la hora de entrada más la tolerancia, y la lista de trabajadores con su hora de entrada;
  - `GET /asistencia/mi-dia`, con el estado por obra.

### Implementation for User Story 1

- [ ] T019 [P] [US1] Crear `src/esquemas/esquemasAsistencia.ts` con los esquemas zod `esquemaVistaPrevia`, `esquemaLoteEscaneos` (de 1 a `MAXIMO_ESCANEOS_POR_LOTE` escaneos, `idLocal` UUID, latitud de -90 a 90 y longitud de -180 a 180 o null) y `esquemaConsultaFecha`, según [contracts/asistencia-api.md](./contracts/asistencia-api.md).
- [ ] T020 [P] [US1] Implementar `src/servicios/servicioCredencialAsistencia.ts`:
  - `obtenerOCrearCredencial(trabajadorId, empresaId)`: `randomBytes(32)` en base64url, `tokenHash` en SHA-256 hex y prefijo `PREFIJO_QR`;
  - `resolverCodigoQr(codigoQr)`: valida el prefijo y busca por `tokenHash`; si no hay credencial, devuelve `null`.

  Según [data-model.md](./data-model.md) `CredencialAsistencia.token`, `CredencialAsistencia.tokenHash` y `CredencialAsistencia.trabajadorId` (una por trabajador, D-17).

- [ ] T021 [US1] Implementar en `src/servicios/servicioRegistroAsistencia.ts` la función pura `clasificarJornada({ entradaMinutos, salidaMinutos?, horario, tipoActual })`, según R-07 y [data-model.md](./data-model.md) `RegistroAsistencia.tipoJornada`. Deben pasar las pruebas de T014.
- [ ] T022 [US1] Implementar en `src/servicios/servicioRegistroAsistencia.ts` la función `procesarLoteEscaneos(supervisor, escaneos)`:
  - procesa en orden, con una transacción por escaneo;
  - valida la credencial, la empresa, la asignación y que el usuario sea supervisor de la obra;
  - calcula la hora según R-04: servidor si `sinConexion = false`; `capturadoEn` dentro de `MAXIMO_DIAS_REGISTRO_SIN_CONEXION` y `MAXIMO_MINUTOS_EN_FUTURO` si es `true`;
  - calcula la fecha local con la zona de la empresa;
  - aplica la idempotencia por `entradaIdLocal`/`salidaIdLocal`, y ante una violación de unicidad devuelve `DUPLICADO` con el registro existente;
  - si es la primera vez, guarda la entrada con la copia del horario efectivo; si es la segunda, guarda la salida y reclasifica; si es la tercera, rechaza;
  - devuelve un resultado por escaneo.

  Según [data-model.md](./data-model.md) `RegistroAsistencia.fecha`, `.entradaEn`, `.entradaLatitud`, `.entradaLongitud`, `.entradaSinConexion`, `.entradaIdLocal`, `.entradaRegistradaPorId`, los campos `salida*`, `.esDiaLaborable`, `.horarioEntrada`, `.horarioSalida` y `.toleranciaMinutos`.

- [ ] T023 [US1] Implementar en `src/servicios/servicioRegistroAsistencia.ts`:
  - `obtenerVistaPrevia(supervisor, obraId, codigoQr)`, que no guarda nada y lanza `ErrorHttp` 422 con `motivo`;
  - `obtenerPaqueteSinConexion(supervisor, obraId)`, con `fotoUrl` como ruta de la API y solo `huellaCredencial`;
  - `obtenerFotoTrabajador(usuario, obraId, trabajadorId)`, que reutiliza `obtenerImagen`;
  - `obtenerResumenDia(usuario, obraId, fecha?)`;
  - `obtenerMiDia(trabajador)`;
  - `listarObrasSupervisadas(supervisor)`.

  `faltasMes` se obtiene con una función de conteo de faltas del mes en `src/servicios/servicioCalendarioAsistencia.ts` (crear el archivo con esa función exportada; el resto se completa en US4).

- [ ] T024 [US1] Crear `src/rutas/rutasAsistencia.ts` con:
  - `GET /asistencia/mi-credencial` (TRABAJADOR);
  - `GET /asistencia/mi-dia` (TRABAJADOR);
  - `GET /asistencia/mis-obras` (SUPERVISOR);
  - `POST /asistencia/registros` (SUPERVISOR);
  - `GET /obras/:obraId/asistencia/paquete-sin-conexion`;
  - `POST /obras/:obraId/asistencia/vista-previa`;
  - `GET /obras/:obraId/asistencia`;
  - `GET /obras/:obraId/asistencia/trabajadores/:trabajadorId/foto`.

  El cuerpo del error 422 debe incluir `motivo`. Registrar las rutas en `src/app.ts`.

- [ ] T025 [US1] Agregar el oficio al perfil (D-18, FR-025a): `oficio` opcional en `src/esquemas/esquemasPerfil.ts` (máximo 60 caracteres; una cadena vacía se guarda como `null`), y devolverlo en `GET /perfil` y aceptarlo en `PUT /perfil` en `src/servicios/servicioPerfil.ts`, según [data-model.md](./data-model.md) `Usuario.oficio`. Prueba `CP06-A1` en `pruebas/integracion/perfilOficio.test.ts`.

**Checkpoint**: US1 funciona y las pruebas CP21 pasan.

---

## Phase 4: User Story 2: Fijar el horario de la obra (Priority: P1)

**Goal**: el supervisor de la obra o el dueño define la entrada, la salida, la tolerancia, los días laborales y si aplica a todos los días o solo hoy (D-06, FR-009 a FR-013).

**Independent Test**: guardar 08:00–16:00, 15 min, L–S; después, una entrada a las 08:16 se clasifica como `RETARDO` (quickstart CP22-E1).

### Tests for User Story 2 ⚠️

- [ ] T026 [P] [US2] Crear `pruebas/integracion/horario.test.ts` con:
  - `CP22-E1`: guardar el horario general y leerlo;
  - `CP22-E2`: "Solo hoy" crea una excepción y al día siguiente vuelve el general;
  - `CP22-E3`: salida ≤ entrada → 400; sin días → 400; tolerancia 12 → 400;
  - trabajador o supervisor de otra obra → 403;
  - un dueño sí puede;
  - un registro ya guardado conserva su copia del horario tras cambiarlo (FR-013).

### Implementation for User Story 2

- [ ] T027 [P] [US2] Agregar `esquemaGuardarHorario` a `src/esquemas/esquemasAsistencia.ts` según [data-model.md](./data-model.md) `HorarioObra.horaEntrada`, `HorarioObra.horaSalida`, `HorarioObra.toleranciaMinutos` y `HorarioObra.diasLaborales`, más `alcance` (`TODOS_LOS_DIAS` | `SOLO_HOY`), con los mensajes del contrato.
- [ ] T028 [US2] Implementar `guardarHorario(usuario, obraId, datos)` en `src/servicios/servicioHorario.ts`. Solo inserta filas, nunca actualiza (R-06). `SOLO_HOY` crea `alcance = DIA` con la fecha local de hoy. `HorarioObra.creadoPorId` viene del token. Devuelve el mismo formato que el GET.
- [ ] T029 [US2] Crear `src/rutas/rutasHorario.ts` con `GET /obras/:obraId/horario` (SUP-OBRA, DUENO o TRABAJADOR asignado) y `PUT /obras/:obraId/horario` (SUP-OBRA o DUENO). Registrar las rutas en `src/app.ts`.

**Checkpoint**: US1 y US2 funcionan; la clasificación de retardo usa el horario guardado.

---

## Phase 5: User Story 3: Ver y editar los detalles de asistencia (Priority: P2)

**Goal**: el supervisor justifica y ajusta el día de un trabajador: tipo de jornada, motivo, efecto en el pago, anotación y horas. Cada cambio queda en el historial (D-07, RF-60, FR-014 a FR-018).

**Independent Test**: cambiar `RETARDO` → `MEDIA_JORNADA` + `CITA_MEDICA` + `MEDIO_DIA` + anotación. Al consultar el detalle se ven los valores nuevos y un cambio por cada campo modificado (quickstart CP19-E1).

### Tests for User Story 3 ⚠️

- [ ] T030 [P] [US3] Crear `pruebas/integracion/detallesAsistencia.test.ts` con:
  - `CP19-E1`: retardo con la anotación "Llegó 25 minutos tarde" y `MEDIO_DIA` se guarda y aparece en el detalle;
  - `CP19-E3`: `RETARDO` sin anotación → 400 "La observación es obligatoria" y no cambia nada (ni registro ni historial);
  - `CP19-A3`: entrada 08:20 → 08:00 crea un `CambioAsistencia` con `valorAnterior`, autor y fecha;
  - un día laborable pasado sin registro marcado como `FALTA` crea el registro (FR-018);
  - fecha futura → 400;
  - dueño o supervisor de otra obra intentando el `PATCH` → 403;
  - el `GET` del detalle lo puede ver el propio trabajador, pero no otro trabajador.

### Implementation for User Story 3

- [ ] T031 [P] [US3] Agregar `esquemaEditarDetalles` a `src/esquemas/esquemasAsistencia.ts`, según [data-model.md](./data-model.md) `RegistroAsistencia.tipoJornada`, `RegistroAsistencia.motivo`, `RegistroAsistencia.efectoPago`, `RegistroAsistencia.anotacion`, `RegistroAsistencia.entradaEn` y `RegistroAsistencia.salidaEn`. Debe venir al menos un campo y la salida debe ser posterior a la entrada. La regla de anotación obligatoria se valida en el servicio, porque depende del tipo resultante.
- [ ] T032 [US3] Implementar `src/servicios/servicioDetallesAsistencia.ts`:
  - `obtenerDetalleDia(usuario, obraId, trabajadorId, fecha)`, con el historial ordenado, `registradoPor`, `conDescuento` y `esFaltaCalculada`; reutiliza la falta calculada de `servicioCalendarioAsistencia`;
  - `editarDetalleDia(supervisor, obraId, trabajadorId, fecha, cambios)`, en una transacción que crea el registro si no existe (FR-018), exige la anotación cuando el tipo resultante no es `COMPLETA` (FR-016) y escribe un `CambioAsistencia` por cada campo que cambia.

  Según [data-model.md](./data-model.md) `CambioAsistencia.campo`, `CambioAsistencia.valorAnterior`, `CambioAsistencia.valorNuevo` y `CambioAsistencia.autorId`.

- [ ] T033 [US3] Agregar a `src/rutas/rutasAsistencia.ts` los endpoints `GET` y `PATCH /obras/:obraId/asistencia/trabajadores/:trabajadorId/dias/:fecha`, con la autorización del contrato (el `PATCH` solo para SUP-OBRA).

**Checkpoint**: US1 a US3 funcionan.

---

## Phase 6: User Story 4: Consultar el calendario de asistencia (Priority: P2)

**Goal**: calendario mensual por trabajador con colores, faltas calculadas, símbolo $ y resumen del mes, visible para el trabajador (el suyo), el supervisor y el dueño (D-08, D-13, D-16, RF-56, RF-58).

**Independent Test**: con los datos de mayo de 2026 de la spec (13 falta, 14 y 15 completos, 19 media jornada), el calendario devuelve ROJO, VERDE, VERDE y NARANJA con `conDescuento` el día 19 (quickstart CP19-E2).

### Tests for User Story 4 ⚠️

- [ ] T034 [P] [US4] Crear `pruebas/integracion/calendarioAsistencia.test.ts` con:
  - `CP19-E2`: el día 5 de diciembre de 2026 con descuento → `conDescuento = true` y el detalle con el motivo;
  - `CP19-A1`: un trabajador que pide el calendario de otro → 403;
  - `CP19-A2`: un día laborable pasado sin registro → `ROJO`, con `esFaltaCalculada = true`;
  - los días futuros y no laborables no aparecen;
  - un dueño de otra empresa → 403;
  - `resumen` con los conteos correctos;
  - sin `obraId`, combina las obras visibles para quien consulta;
  - el conteo de faltas usa D-20 (desde `max(inicio de la obra, alta del usuario)`).

### Implementation for User Story 4

- [ ] T035 [P] [US4] Agregar `esquemaConsultaCalendario` a `src/esquemas/esquemasAsistencia.ts`, con `mes` en formato `YYYY-MM` y `obraId` opcional.
- [ ] T036 [US4] Completar `src/servicios/servicioCalendarioAsistencia.ts` con `obtenerCalendario(usuario, trabajadorId, mes, obraId?)`:
  - recorre los días del mes en la zona de la empresa, hasta ayer como máximo para las faltas;
  - toma los registros del mes en una sola consulta y los horarios efectivos por día;
  - calcula las faltas (R-08, D-20), el color y `conDescuento`, según [data-model.md](./data-model.md) `RegistroAsistencia.efectoPago` y la tabla "Color en el calendario";
  - arma el resumen;
  - aplica la autorización TRA-PROPIO, SUP-OBRA o DUENO.

  Reutilizar la función de conteo de faltas creada en T023.

- [ ] T037 [US4] Agregar `GET /asistencia/trabajadores/:trabajadorId/calendario` a `src/rutas/rutasAsistencia.ts`.

**Checkpoint**: las cuatro historias funcionan de forma independiente.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T038 [P] Correr `npm run test:cobertura` y completar las pruebas hasta tener 80 % o más de líneas en `src/servicios/servicioHorario.ts`, `servicioCredencialAsistencia.ts`, `servicioRegistroAsistencia.ts`, `servicioDetallesAsistencia.ts` y `servicioCalendarioAsistencia.ts`.
- [ ] T039 [P] Rendimiento (plan, Performance Goals):
  - un lote de 100 escaneos en menos de 5 s y un calendario mensual en menos de 1 s contra la base local;
  - medirlo en `pruebas/integracion/rendimientoAsistencia.test.ts`;
  - si no se cumple, agrupar las lecturas (precargar credenciales, asignaciones y horarios del lote).
- [ ] T040 [P] Seguridad:
  - comprobar que ningún endpoint devuelve `CredencialAsistencia.token`, salvo `GET /asistencia/mi-credencial` al propio trabajador;
  - comprobar que los logs no imprimen `codigoQr` (agregar `redact` si hace falta en `src/app.ts`);
  - comprobar que no existe ninguna ruta `DELETE` de asistencia.
- [ ] T041 Recorrer [quickstart.md](./quickstart.md) completo contra la API local. Revisar cada endpoint contra las pantallas del Figma por `node-id` (la tabla de la spec), incluida la insignia $ del calendario (`2272:354`, `96:389`).
- [ ] T042 Actualizar `CLAUDE.md`: quitar la nota "`npm run lint` y `npm test` se agregan en el módulo 00" y documentar `npm run test:cobertura`. Agregar en `docs/decisiones.md` las decisiones técnicas que surjan durante la implementación.
- [ ] T043 Correr `npm run typecheck && npm run lint && npm test` y `npm run verificar-formato`. Abrir un PR de `001-asistencia-qr-horario` a `main` para que lo revise otro integrante (VI.1).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (fase 1)**: no tiene dependencias.
- **Foundational (fase 2)**: depende de Setup y bloquea todas las historias.
- **US1 (fase 3)**: depende de Foundational y es el MVP.
- **US2 (fase 4)**: depende de Foundational. Es independiente de US1, salvo que su prueba de FR-013 usa un escaneo (`procesarLoteEscaneos`).
- **US3 (fase 5)**: depende de Foundational. Usa registros creados por US1, aunque sus pruebas también pueden crearlos directamente con Prisma.
- **US4 (fase 6)**: depende de Foundational. Comparte `servicioCalendarioAsistencia.ts` con T023 y lo usa T032 para la falta calculada.
- **Polish (fase 7)**: depende de todas las historias.

### Within Each User Story

- Las pruebas se escriben primero y deben fallar.
- Después van los esquemas, los servicios y las rutas.
- Cada tarea termina con `npm run typecheck && npm run lint && npm test`.

### Parallel Opportunities

- Fase 1: T002, T003 y T005 en paralelo después de T001.
- Fase 2: T009, T010 y T012 en paralelo después de T008.
- US1: las cinco pruebas (T014 a T018) en paralelo; luego T019 y T020 en paralelo.
- Con varias personas, después de la fase 2 una toma US1 y otra US2. US3 y US4 pueden empezar con datos creados en sus propias pruebas.

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo:
Task: "T014 clasificacionAsistencia.test.ts"
Task: "T015 credencialAsistencia.test.ts"
Task: "T016 registroAsistencia.test.ts"
Task: "T017 vistaPreviaYPaquete.test.ts"
Task: "T018 resumenDia.test.ts"

# Luego esquema y credencial en paralelo:
Task: "T019 esquemasAsistencia.ts"
Task: "T020 servicioCredencialAsistencia.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Fase 1 (módulo 00) y fase 2.
2. Fase 3, US1: el escaneo ya registra entradas y salidas, y sin horario no clasifica retardos.
3. **Parar y validar** CP21 con quickstart.
4. Continuar con US2 para que haya retardos. Juntas, US1 y US2 ya permiten que la app empiece su parte.

### Incremental Delivery

1. Setup y Foundational.
2. US1 y US2 (las dos P1): la app móvil ya puede pasar asistencia.
3. US3: detalles y justificaciones.
4. US4: calendario.
5. Polish y PR.

---

## Notes

- La parte de la **app móvil** (escáner, almacenamiento sin conexión, pantallas) tendrá su propia spec y su propio plan en `CivilTrace`, con base en [contracts/asistencia-api.md](./contracts/asistencia-api.md), una vez terminada la API (VI.2).
- No se editan migraciones ya aplicadas. Si el esquema cambia después de T008, se crea una migración nueva.
- Hacer commit después de cada tarea o grupo lógico, con un mensaje en español.
