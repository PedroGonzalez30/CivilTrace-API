---
description: 'Lista de tareas del feature 004: portal web del cliente y entregas (API, app y portal)'
---

# Tasks: Portal web del cliente y entregas

**Input**: documentos de diseño en `specs/004-portal-cliente/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/portal-api.md](./contracts/portal-api.md), [quickstart.md](./quickstart.md)

**Tests**: son **obligatorios** (constitución III). Cada prueba lleva la clave provisional `CP16-*` o `CP17-*` con el número de escenario de la spec (R-12, P-10). Se escriben antes de implementar y deben fallar primero.

**Organization**: por historia de usuario. Dentro de cada historia: **API** (pruebas → servicio → ruta), luego **app** (`../CivilTrace`) y **portal** (`../CivilTrace-Portal`), según la constitución VI.2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: US1 a US6, las historias de la spec.
- **(aprobado, P-17)**: no se ejecuta hasta que el equipo apruebe (P-17).
- Rutas sin prefijo son de `CivilTrace-API/`; `app:` es `CivilTrace/` y `portal:` es `CivilTrace-Portal/`.

**Reglas para todo archivo nuevo** (constitución II), que no se repiten en cada tarea: encabezado
ECCT con `@requerimientos` (RF del SRS v5.0), secciones numeradas, identificadores en español sin
acentos, constantes desde `src/constantes/portal.ts`, errores con `ErrorHttp` en español, zod en
cada ruta y filtro por `empresaId` (rutas de la app) o por `obraId` + `empresaId` del enlace
(rutas `/portal`).

---

## Phase 1: Setup

**Purpose**: dependencias, variables y proyecto del portal.

- [x] T001 (aprobado, P-17) Instalar `pdfkit`, `@types/pdfkit` (dev), `@azure/communication-email` y `@fastify/cors` en `package.json` (R-01, R-02, R-09)
- [x] T002 Agregar `URL_PORTAL`, `CLAVE_CIFRADO_PORTAL` (32 bytes base64), `AZURE_COMUNICACION_ENDPOINT`, `CORREO_REMITENTE` (opcionales) y `CORREO_EN_CONSOLA` (booleano) a `src/configuracion/entorno.ts` y `.env.example`
- [x] T003 [P] Crear `src/constantes/portal.ts` con las constantes de [data-model.md](./data-model.md) ("Constantes de negocio")
- [ ] T004 [P] Crear el repo `portal:` con Vite + React 19 + TypeScript estricto, React Router en modo hash, ESLint + Prettier con las reglas del ECCT, Vitest + Testing Library y Playwright; scripts `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`, `verificar-formato` en `portal:package.json`
- [ ] T005 [P] Crear `portal:src/estilos/tema.css` con colores, Poppins y espaciados tomados de las pantallas `CLIENTE_*` del Figma (`246:1178`, `2271:118`) y `portal:CLAUDE.md` con las reglas del repo
- [x] T006 [P] Enmienda 1.1.0 de `.specify/memory/constitution.md` (I.3 e I.4 citan el SRS v5.0 desde el feature 004) — (aprobado, P-17), va en el mismo PR para revisión

---

## Phase 2: Foundational (bloquea todas las historias)

- [x] T007 Agregar a `prisma/schema.prisma` las enumeraciones `EstadoEntrega` y `EstadoEnvioEnlace` y los modelos `EnlacePortal`, `Entrega`, `EntregaActividad`, `EntregaAvance` y `CodigoEntrega` según [data-model.md](./data-model.md) (todos sus campos e índices, incluidos `EnlacePortal.obraId` único, `EnlacePortal.tokenHash` único, `EntregaActividad` y `EntregaAvance` con sus `@@unique`), más las relaciones en `Obra`, `Actividad`, `AvanceActividad`, `Usuario` y `Empresa`
- [x] T008 Crear la migración `npx prisma migrate dev --name portal_cliente_entregas --config prisma7.config.ts` y regenerar el cliente; confirmar que solo agrega tablas
- [x] T009 [P] Crear `src/utilidades/cifrado.ts`: `cifrarTexto`/`descifrarTexto` (AES-256-GCM, formato de `EnlacePortal.tokenCifrado` en data-model.md) y `calcularHmacCodigo` (R-04); pruebas en `pruebas/unidad/cifrado.test.ts`
- [x] T010 [P] Crear `src/servicios/servicioCorreo.ts` con `enviarCorreo({ para, asunto, texto, html })` sobre Azure Communication Services con `DefaultAzureCredential`; 503 sin configuración; con `CORREO_EN_CONSOLA` escribe el mensaje en el registro (R-02)
- [x] T011 [P] Crear `pruebas/configuracion/dobleCorreo.ts` (correos en memoria, `obtenerUltimoCorreo(para)`, `simularFallo()`) y registrarlo en la configuración de Vitest junto al doble de almacenamiento
- [x] T012 [P] Crear `src/middleware/tokenPortal.ts` con `verificarTokenPortal`: lee `X-Token-Portal`, busca por `EnlacePortal.tokenHash` y deja `obraId` y `empresaId` en la petición; 404 con el mensaje del contrato si no existe (R-09)
- [x] T013 Registrar en `src/app.ts` `@fastify/cors` solo para `URL_PORTAL`, el prefijo `/portal` con límite de 30 peticiones por minuto por IP y las rutas nuevas (vacías por ahora) de `src/rutas/rutasPortal.ts` y `src/rutas/rutasEntregas.ts`
- [ ] T014 [P] Agregar a `pruebas/configuracion/fabricas.ts` fábricas de obra con enlace, avances aprobados en un rango y entregas en cada estado
- [ ] T015 [P] Crear `portal:src/conexion/clientePortal.ts`: `fetch` con `X-Token-Portal` tomado del fragmento `#/o/<token>`, errores en español, descarga de imágenes y PDF como `blob:`; pruebas en `portal:pruebas/clientePortal.test.ts`

**Checkpoint**: migración aplicada en la base de pruebas; tipos, lint y pruebas en verde.

---

## Phase 3: User Story 1 - El cliente recibe el enlace permanente de su obra (P1) 🎯 MVP

**Goal**: al registrar la obra el cliente recibe un enlace que abre el portal de su obra (RF-65).

**Independent Test**: registrar una obra y abrir el enlace del doble de correo (`GET /portal/obra` responde la obra).

### Pruebas (API) ⚠️ primero, en rojo

- [x] T016 [P] [US1] `pruebas/integracion/enlacePortal.test.ts`: `CP16-PORTAL-E1` correo con enlace al crear obra y `enlacePortal: 'ENVIADO'`; `CP16-PORTAL-E2` token alterado → 404 sin datos; `CP16-PORTAL-E3` obra anterior recibe enlace al reenviar; `CP16-PORTAL-E4` fallo de correo → obra guardada y `'FALLIDO'`; `'SIN_CORREO'` sin correo; reenviar manda el **mismo** token; cambio de correo rota el token (P-12); solo el dueño reenvía (403)

### Implementación

- [x] T017 [US1] Crear `src/servicios/servicioEnlacePortal.ts`: `crearEnlace` (token de `BYTES_TOKEN_PORTAL`, guarda `EnlacePortal.tokenHash` y `EnlacePortal.tokenCifrado`), `enviarEnlace`, `reenviarEnlace` (rota si `EnlacePortal.correo` difiere de `Obra.correoCliente`) y `construirUrlPortal`; actualiza `EnlacePortal.ultimoEnvioEn` y `EnlacePortal.estadoEnvio`
- [x] T018 [US1] Cambiar `crearObra` en `src/servicios/servicioObras.ts` y `POST /obras` en `src/rutas/rutasObras.ts` para crear el enlace en la transacción, enviar el correo después y responder `enlacePortal` (R-10)
- [x] T019 [US1] `POST /obras/:idObra/enlace-portal/reenviar` en `src/rutas/rutasEntregas.ts` (solo `DUENO`)
- [x] T020 [US1] `GET /portal/obra` en `src/rutas/rutasPortal.ts` con `src/esquemas/esquemasPortal.ts`

### App

- [ ] T021 [P] [US1] app: tipo `enlacePortal` en `src/tipos/obra.ts`; aviso en `src/pantallas/dueno/PantallaAgregarObra.tsx` si es `FALLIDO`; pruebas en `__tests__/PantallaAgregarObra-test.tsx`
- [ ] T022 [P] [US1] app: botón "Reenviar enlace al cliente" en `src/pantallas/dueno/PantallaDetalleObra.tsx` con `reenviarEnlacePortal` en `src/servicios/servicioObras.ts`; pruebas

### Portal

- [ ] T023 [US1] portal: `src/rutas.tsx` con `#/o/:token`, `src/pantallas/PantallaObra.tsx` (encabezado con la obra) y `src/pantallas/PantallaEnlaceInvalido.tsx` ("Este enlace no es válido…"); pruebas Vitest

**Checkpoint**: US1 funciona sola (quickstart pasos 2–3).

---

## Phase 4: User Story 2 - El cliente consulta los avances de su obra (P1)

**Goal**: actividades con estado y solo fotos aprobadas (RF-66).

**Independent Test**: obra con 4 actividades y 10 fotos (2 rechazadas) → el portal muestra 4 y 8.

- [x] T024 [P] [US2] `pruebas/integracion/portalCliente.test.ts`: `CP16-PORTAL-E5` 4 actividades y 8 fotos aprobadas ordenadas por fecha; `CP16-PORTAL-E6` sin fotos → `[]`; `CP16-PORTAL-E7` pendientes y rechazadas no salen; `GET /portal/fotos/:id` 404 si no es `APROBADO` o es de otra obra u otra empresa (SC-003)
- [x] T025 [US2] `GET /portal/avances` y `GET /portal/fotos/:idAvance` en `src/rutas/rutasPortal.ts`, con la consulta en `src/servicios/servicioPortal.ts` (reutiliza `obtenerImagen`); `ubicacion: null` hasta P-16
- [ ] T026 [US2] portal: pestaña "Avances" en `src/pantallas/PantallaObra.tsx` con `src/componentes/TarjetaActividad.tsx` y `src/componentes/GaleriaFotos.tsx` (estilo de la lista de `246:1269`, P-14); "Aún no hay avances registrados"; pruebas Vitest

**Checkpoint**: US1 + US2 funcionan solas.

---

## Phase 5: User Story 3 - El supervisor envía una entrega por rango de fechas (P1)

**Goal**: entrega Enviada con copia fija de las fotos aprobadas del rango, publicada y avisada (RF-13, D-29).

**Independent Test**: rango con 2 actividades con fotos aprobadas y 1 pendiente → entrega con 2 actividades, sin la pendiente, y correo de aviso.

- [x] T027 [P] [US3] `pruebas/integracion/entregas.test.ts`: `CP16-E1` entrega creada con actividades y solo fotos aprobadas, y correo con el enlace; `CP16-E2` rango sin fotos aprobadas → 400 `SIN_FOTOS_APROBADAS`; `CP16-E3` sin correo → 400 `SIN_CORREO_CLIENTE`; `CP16-E4` trabajador o supervisor ajeno → 403; `CP16-E5` rango encimado solo lleva fotos no enviadas (P-15); otra empresa → 404; el rango usa la zona horaria de la empresa
- [x] T028 [US3] Crear `src/servicios/servicioEntregas.ts` con `enviarEntrega` (transacción: lee avances `APROBADO` del rango que no estén en entregas `ENVIADA`/`ACEPTADA`, crea `Entrega` con `Entrega.fechaInicio`/`Entrega.fechaFin`/`Entrega.estado`, copia `EntregaActividad.*` y `EntregaAvance.*` según data-model.md; correo después) y `listarEntregasObra`
- [x] T029 [US3] `POST /obras/:idObra/entregas` y `GET /obras/:idObra/entregas` en `src/rutas/rutasEntregas.ts` con `src/esquemas/esquemasEntregas.ts` (`fechaFin >= fechaInicio`); permiso con `exigirSupervisorODueno`
- [ ] T030 [P] [US3] app: `src/tipos/entrega.ts` y `src/servicios/servicioEntregas.ts` (`enviarEntrega`, `listarEntregas`) con pruebas en `__tests__/servicioEntregas-test.ts`
- [ ] T031 [US3] app: botón "Enviar al cliente" en la vista previa de `src/pantallas/dueno/PantallaReportesObra.tsx` con el rango del filtro, confirmación y aviso "Se envió al cliente" (`144:2116`); mensajes de `SIN_CORREO_CLIENTE` y `SIN_FOTOS_APROBADAS`; pruebas en `__tests__/PantallaReportesObra-test.tsx`
- [ ] T032 [US3] portal: `GET /portal/entregas` en `src/rutas/rutasPortal.ts` (API) y pestaña "Entregas" en `portal:src/pantallas/PantallaObra.tsx` con `portal:src/componentes/TarjetaEntrega.tsx` (estilo de `246:1178`); "Todavía no hay entregas"; pruebas

**Checkpoint**: una entrega enviada desde la app aparece en el portal (quickstart paso 5).

---

## Phase 6: User Story 4 - El cliente acepta con código y firma (P1)

**Goal**: aceptación con nombre, código y firma (RF-14, RF-60).

**Independent Test**: aceptar con el código del doble de correo y una firma PNG → `ACEPTADA` con firma y SHA-256.

- [x] T033 [P] [US4] `pruebas/integracion/aceptacionEntrega.test.ts`: `CP17-E1` aceptar con código, nombre y firma; `CP17-E2` código incorrecto o vencido → 400 y se puede pedir otro; `CP17-E3` 5 fallos invalidan el código; `CP17-E4` firma vacía, no PNG o > `TAMANO_MAXIMO_FIRMA_BYTES` → 400; `CP17-E5` entrega ya respondida → 409 (dos respuestas simultáneas: una gana); 429 si se pide código antes de 60 s; correo enmascarado
- [x] T034 [US4] Crear `src/servicios/servicioCodigoEntrega.ts`: `solicitarCodigo` (invalida el anterior, `CodigoEntrega.codigoHash` con HMAC, `CodigoEntrega.venceEn`) y `verificarCodigo` (`CodigoEntrega.intentos`, `CodigoEntrega.invalidado`, `CodigoEntrega.usadoEn`)
- [x] T035 [US4] En `src/servicios/servicioEntregas.ts`: `aceptarEntrega` (valida PNG, guarda en `firmas/` con `guardarImagen`, `Entrega.firmaBlob`, `Entrega.firmaSha256`, `Entrega.nombreCliente`, `Entrega.respondidaEn`; cambio de estado con `updateMany` sobre `ENVIADA`)
- [x] T036 [US4] `GET /portal/entregas/:idEntrega`, `POST /portal/entregas/:idEntrega/codigo` (5 por minuto) y `POST /portal/entregas/:idEntrega/aceptar` (`bodyLimit` 1 MB) en `src/rutas/rutasPortal.ts`; `GET /portal/entregas/:idEntrega/firma`
- [ ] T037 [P] [US4] portal: `src/componentes/LienzoFirma.tsx` (Pointer Events, "Borrar", exporta PNG, avisa si está vacío) con pruebas
- [ ] T038 [US4] portal: `src/pantallas/PantallaEntrega.tsx` (detalle con actividades y fotos de la copia fija; botones solo si `ENVIADA`), `src/componentes/ModalCodigo.tsx` (`246:1269`) y `src/pantallas/PantallaFirmar.tsx` en modo aceptación (`2271:118`: "✓ Código verificado", nombre, firma, "Firmar y aceptar" desactivado sin firma, aviso de constancia)
- [ ] T039 [US4] portal: `src/pantallas/PantallaReporteAceptado.tsx` (`2271:192`: nombre, fecha y hora, firma, "Volver a mis reportes")
- [ ] T040 [US4] portal: `e2e/aceptar.spec.ts` (Playwright, 412 px de ancho): abrir enlace → entrega → código → firmar → "Reporte aceptado"

**Checkpoint**: quickstart paso 6 sin las descargas.

---

## Phase 7: User Story 6 - Acta, descargas y bloqueo (P1)

**Goal**: acta y reporte en PDF iguales para app y portal; actividades de entregas aceptadas bloqueadas (RF-16, RF-71, RF-17).

**Independent Test**: acta generada en la app = acta descargada en el portal (mismo SHA-256); subir foto a una actividad bloqueada → 409.

- [ ] T041 [P] [US6] `pruebas/integracion/actaEntrega.test.ts`: `CP17-E6` acta de entrega Aceptada con obra, actividades, fotos y aceptación (el PDF contiene el nombre del cliente y la firma); `CP17-E7` entrega no aceptada → 409 `ENTREGA_NO_ACEPTADA`; `CP17-E8` el cliente descarga reporte y acta y es el mismo archivo que en la app; `CP17-E9` entrega Enviada: reporte sí, acta no
- [ ] T042 [P] [US6] `pruebas/integracion/bloqueoEntrega.test.ts`: `CP17-E10` cambiar estado, subir avance o revisar avance de una actividad en entrega Aceptada → 409 `ENTREGA_ACEPTADA`; `bloqueada: true` en el detalle; una entrega Enviada o Con observaciones no bloquea
- [ ] T043 [US6] Crear `src/servicios/servicioPdf.ts` con `generarReporteEntrega` y `generarActaEntrega` (pdfkit; fotos JPEG/PNG de la copia fija; firma; textos de "constancia de recepción", nunca "firma electrónica")
- [ ] T044 [US6] En `src/servicios/servicioEntregas.ts`: `obtenerReportePdf` y `obtenerActaPdf` (generan una vez, guardan en `entregas/`, actualizan `Entrega.reporteBlob`, `Entrega.actaBlob`, `Entrega.actaSha256`; después leen del almacenamiento)
- [ ] T045 [US6] Rutas `GET /obras/:idObra/entregas/:idEntrega/reporte.pdf`, `POST /obras/:idObra/entregas/:idEntrega/acta` (`src/rutas/rutasEntregas.ts`), `GET /portal/entregas/:idEntrega/reporte.pdf` y `GET /portal/entregas/:idEntrega/acta.pdf` (`src/rutas/rutasPortal.ts`)
- [ ] T046 [US6] Crear `exigirActividadNoBloqueada` en `src/servicios/servicioEntregas.ts` y usarla en `actualizarEstadoActividad`, `registrarAvanceActividad` y `revisarAvance` de `src/servicios/servicioActividades.ts`; `bloqueada` en `obtenerDetalleActividad`
- [ ] T047 [P] [US6] app: lista de entregas con su estado en `src/pantallas/dueno/PantallaReportesObra.tsx` con `src/componentes/TarjetaEntrega.tsx`; "Generar acta" (`144:2536`) y descarga del reporte con `expo-file-system` + `expo-sharing`; pruebas
- [ ] T048 [P] [US6] app: ocultar botones de edición, subida y revisión cuando `bloqueada` en las pantallas de actividad del supervisor y del trabajador; pruebas
- [ ] T049 [US6] portal: botones "Descargar reporte" y "Descargar acta (PDF)" en `src/pantallas/PantallaEntrega.tsx` y `src/pantallas/PantallaReporteAceptado.tsx`; "El acta se genera al aceptar la entrega" si está Enviada; pruebas

**Checkpoint**: quickstart pasos 6–7 completos.

---

## Phase 8: User Story 5 - El cliente registra observaciones (P2)

**Goal**: rechazar con comentario, nombre y firma (RF-15).

**Independent Test**: observaciones con texto, nombre y firma → `CON_OBSERVACIONES` visible en la app.

- [x] T050 [P] [US5] En `pruebas/integracion/aceptacionEntrega.test.ts`: `CP17-E11` observaciones con texto, nombre y firma → `CON_OBSERVACIONES`; `CP17-E12` texto vacío → 400 y sin cambio de estado; `CP17-E13` las fotos de una entrega Con observaciones se pueden volver a enviar (P-15); no pide código (P-11)
- [x] T051 [US5] `registrarObservaciones` en `src/servicios/servicioEntregas.ts` (`Entrega.observaciones` según data-model.md, firma como en T035) y `POST /portal/entregas/:idEntrega/observaciones` en `src/rutas/rutasPortal.ts`
- [ ] T052 [US5] portal: `src/componentes/ModalObservaciones.tsx` (`246:1605`, "Rechazar y enviar") y `PantallaFirmar.tsx` en modo rechazo (`2271:158`, "Firmar y rechazar"); `e2e/observaciones.spec.ts`
- [ ] T053 [P] [US5] app: mostrar observaciones y nombre del cliente en `src/componentes/TarjetaEntrega.tsx`; pruebas

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T054 [P] portal: aviso de privacidad (`src/pantallas/PantallaPrivacidad.tsx`) enlazado al pie (constitución IV.7) y mensajes de error de red sin perder firma ni texto
- [ ] T055 [P] portal: `staticwebapp.config.json` con `Referrer-Policy: no-referrer`, CSP solo hacia la API y `.github/workflows/portal.yml` (tipos, lint, pruebas, Playwright y despliegue)
- [ ] T056 (aprobado, P-17) `infra/comunicacion.tf` y `infra/portal.tf` (Communication Services con dominio administrado, Static Web Apps Free, secreto `CLAVE_CIFRADO_PORTAL` en Key Vault y su referencia en el App Service); `terraform plan` sin `destroy`/`replace`; **no aplicar**
- [ ] T057 [P] Sumar `servicioEnlacePortal`, `servicioEntregas`, `servicioCodigoEntrega`, `servicioPortal`, `servicioPdf` y `utilidades/cifrado` a los umbrales de 80 % en `vitest.config.ts`; app y portal al 60 % por archivo
- [ ] T058 [P] Actualizar `CLAUDE.md` de la API y de la app (rutas `/portal`, dobles de correo, variables nuevas) y `README.md`
- [ ] T059 Agregar a `docs/decisiones.md` (ambos repos) las decisiones técnicas que queden (R-01 a R-10) y marcar los pendientes resueltos
- [ ] T060 Correr `quickstart.md` completo (pruebas y recorrido manual) y revisar cada pantalla contra el Figma
- [ ] T061 PR en los tres repos (API → app → portal) con la migración pendiente de aplicar en Azure anotada como P-09

---

## Dependencies & Execution Order

- **Setup (F1)** → **Foundational (F2)** → historias. T001 (aprobación) bloquea T010, T013 y T043.
- **US1** es base de US2–US6 (todas usan el enlace).
- **US2** y **US3** pueden avanzar en paralelo después de US1.
- **US4** depende de US3 (necesita entregas). **US6** depende de US4 (acta de una aceptada). **US5** depende de US3 y reutiliza la firma de US4.
- En cada historia: pruebas de la API → servicio → ruta → app y portal (constitución VI.2).
- **Polish** al final; T056 y el despliegue esperan las aprobaciones de P-17.

```text
F1 ─▶ F2 ─▶ US1 ─┬─▶ US2
                 └─▶ US3 ─▶ US4 ─▶ US6
                          └──────▶ US5
```

## Parallel Example: User Story 3

```text
T027 pruebas de entregas (API)     ┐
T030 servicio y tipos de la app    ├─ en paralelo
T032 pestaña Entregas del portal   ┘ (con la API simulada)
luego T028 → T029 → T031
```

## Implementation Strategy

1. **MVP**: F1 + F2 + US1 + US2 + US3 + US4 + US6. Es el flujo completo de RF Must: el cliente ve avances, recibe una entrega, la acepta con firma y descarga el acta.
2. **Incremento**: US5 (observaciones, Should).
3. **Antes de producción**: aprobaciones de P-17, Terraform aplicado por el equipo, migración en Azure y dominio de correo verificado.

## Notes

- Sin aprobación de T001 se puede avanzar con todo lo que no use `pdfkit`, correo real ni CORS: los dobles cubren las pruebas.
- Cada tarea termina con `npm run typecheck && npm run lint && npm test` en el repo que toca.
- Commits pequeños por tarea o grupo lógico; mensajes en español.

**Total**: 61 tareas · Setup 6 · Foundational 9 · US1 8 · US2 3 · US3 6 · US4 8 · US6 9 · US5 4 · Polish 8.
