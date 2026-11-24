# Feature 003: actividades y evidencias del supervisor y del trabajador (API)

**Rama**: `003-actividades-evidencias` (sobre `002-correcciones-revision`) · **Fecha**: 24/11/2026 ·
**Autor**: Emilio Manuel Esquivel · **App**: repo `CivilTrace`, misma rama.

## Contexto

El dueño ya consulta actividades y avances (Pedro, módulo anterior). Faltan los flujos del Figma para
el supervisor y el trabajador, y la revisión de evidencias de D-10: las fotos del trabajador nacen
"Pendiente de revisión" y el supervisor las aprueba o rechaza con observación.

Pantallas (Figma `EIXrnioyKFd9EoBY5PINOV`):

- Supervisor: `SUP_Trabajo_VerObras` (161:402), `Sup_DetalleObra` (161:475), `SUP_ACTIVIDADESOBRA`
  (2139:313, 168:706 vacía), `SUP_ACTIVIDADESOBRATerminadas` (2139:177), `Sup_Agregar1ActividadObra`
  (168:781), `SUP_VERACTIVIDADOBRAActiva` (168:922), `SUP_VERACTIVIDADOBRATerminada` (196:181),
  `Supervisor · Revisar avance` (2138:577), `Actividad aprobada` (2142:182), `Actividad rechazada`
  (2142:393), `SUP_SUBIREVIDENCIA` (2217:122).
- Trabajador: `TRA VER ACTIVIDADES` (58:344), `TRA-VERACTIVIDAD` (58:592),
  `TRA-VERACTIVIDAD_EvidenciaAgregada` (296:176), subir evidencia (58:933).

## Historias

1. **US1 (P1) Supervisor gestiona actividades de sus obras**: ve sus obras, el detalle, la lista de
   actividades activas y terminadas, agrega una actividad (nombre, responsable, descripción, fecha de
   inicio y fecha de fin estimada) y ve los avances de cada una.
2. **US2 (P1) Trabajador sube evidencia**: ve sus actividades activas con los días restantes, abre una
   (instrucción = descripción) y sube una foto como "Avance diario" o "Terminado", con comentario
   opcional. Nace "Pendiente de revisión" (D-10).
3. **US3 (P1) Supervisor revisa**: abre un avance pendiente, ve la evidencia anterior y la nueva, y lo
   aprueba o lo rechaza; al rechazar la observación es obligatoria. Aprobar un "Terminado" termina la
   actividad; rechazarlo la deja activa ("Actividad rechazada vuelve a activarse").
4. **US4 (P2) Supervisor sube evidencia**: desde la actividad sube su propia foto; nace aprobada. Si es
   "Terminado", la actividad se termina.

## Reglas

- R1 Acceso: el supervisor solo trabaja en las obras que supervisa; el dueño en todas las de su empresa;
  el trabajador solo ve y sube evidencia en las actividades de las que es responsable. Otra empresa = 404.
- R2 Estado del avance: del trabajador → `PENDIENTE`; del supervisor o dueño → `APROBADO` (D-10).
- R3 Solo un "Terminado" pendiente por actividad (409 si ya hay uno en revisión).
- R4 No se suben avances a una actividad terminada (409).
- R5 Solo se revisan avances `PENDIENTE` (409 si ya se revisó). Rechazo sin observación → 400.
  Observación hasta 500 caracteres. Se guardan quién revisó y cuándo.
- R6 Aprobar un "Terminado" → actividad `TERMINADA` con `fechaTerminada` = fecha local de la entrega.
- R7 Los reportes solo cuentan evidencias aprobadas (D-10).
- R8 La fecha de inicio es opcional y no puede ser posterior a la de entrega.

## Contrato (cambios)

Todas bajo `/obras/:idObra/actividades` salvo `mias`. Las respuestas solo **agregan** campos; la app del
dueño sigue funcionando.

| Método y ruta                                 | Quién                                     | Cambio                                                                                                                                                                |
| --------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /obras/:idObra/actividades`              | dueño, supervisor de la obra, trabajador  | Aplica R1 (el trabajador solo recibe las suyas). Cada actividad agrega `descripcion`, `fechaInicio`, `responsableId` y `enRevision` (tiene un "Terminado" pendiente). |
| `GET /obras/:idObra/actividades/:id`          | igual                                     | R1. Cada avance agrega `tipo` (`DIARIO`/`TERMINADO`), `observacion`, `revisadoPor`, `revisadoEn`.                                                                     |
| `POST /obras/:idObra/actividades`             | dueño, supervisor de la obra              | Acepta `descripcion` (≤ 1000) y `fechaInicio` (R8).                                                                                                                   |
| `POST /obras/:idObra/actividades/:id/avances` | dueño, supervisor de la obra, responsable | Cabecera nueva `x-tipo-avance: DIARIO \| TERMINADO` (por defecto `DIARIO`). R2, R3, R4.                                                                               |
| `PATCH .../avances/:idAvance/revision`        | dueño, supervisor de la obra              | **Nuevo**. Cuerpo `{ decision: "APROBAR" \| "RECHAZAR", observacion?: string }`. R5, R6. Responde `{ avance, actividad }`.                                            |
| `GET /actividades/mias`                       | trabajador                                | **Nuevo**. Actividades activas de las que es responsable, con `obraId` y `obraNombre`, ordenadas por entrega.                                                         |
| `GET /obras/:idObra/reporte`                  | sin cambio de permisos                    | R7.                                                                                                                                                                   |

## Modelo (migración `actividades_evidencias`)

- `Actividad`: `descripcion String @default("")`, `fechaInicio DateTime? @db.Date`.
- `AvanceActividad`: `tipo TipoAvance @default(DIARIO)`, `observacion String?`, `revisadoPorId String?`
  (relación a `Usuario`), `revisadoEn DateTime?`.
- Enum nuevo `TipoAvance { DIARIO TERMINADO }`.

Solo agrega columnas con valor por defecto o nulas: no afecta datos existentes. Se aplica en Azure con
`npx prisma migrate deploy --config prisma7.config.ts` (lo corre el equipo, no Claude).

## Pendientes de confirmar con el equipo (se implementó la opción por defecto)

- P-06 Los "Pendientes" con casillas de `TRA-VERACTIVIDAD` (Paredes, Piso, Regadera) no tienen
  pantalla para capturarlos en `Sup_Agregar1ActividadObra`. **Por defecto: no se implementan**; la
  instrucción es la descripción.
- P-07 El "Avance diario" del trabajador también nace pendiente de revisión (D-10 dice "las fotos del
  trabajador"). **Por defecto: sí.**
- P-08 El responsable de una actividad puede ser cualquier trabajador o supervisor de la empresa (como
  hoy). **Por defecto: sin cambio.**

## Pruebas

`pruebas/integracion/actividadesEvidencias.test.ts` con las claves del plan de pruebas: CP09 (obras
asignadas), CP10 (registrar actividad), CP11 (consultar actividades), CP12 (capturar evidencia), CP13
(terminar actividad), CP14 (revisar evidencias) y CP15 (reporte), con sufijo `-A`. Cobertura del 80 % por archivo en
`servicioActividades.ts` al sumarlo a `vitest.config.ts`.

## Tareas

- [x] T001 Spec y contrato (este archivo).
- [x] T002 Esquema y migración.
- [x] T003 Pruebas en rojo de R1–R8.
- [x] T004 Servicio y rutas.
- [x] T005 Reportes solo con aprobadas (R7).
- [x] T006 Suite, tipos, lint, Prettier y cobertura en verde.
- [ ] T007 Decisiones y PR.
