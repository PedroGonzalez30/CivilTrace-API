# Implementation Plan: Asistencia con QR, horario por obra y calendario

**Branch**: `001-asistencia-qr-horario` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-asistencia-qr-horario/spec.md`

**Requerimientos**: `RF-19 Registrar asistencia propia`, `RF-27 Registrar asistencia por el supervisor`, `RF-56 Mostrar días con descuento`, `RF-58 Mostrar calendario de asistencia`, `RF-60 Registrar retardo o salida anticipada`, `RNF-07 Captura sin conexión` (aplicado a asistencia por D-14).

**Alcance de este plan**: solo la **API**. Según el principio VI.2, primero se termina la API con sus pruebas. La parte de la app (escáner, almacenamiento sin conexión y pantallas) tendrá su propia especificación y su propio plan en el repositorio `CivilTrace`, basados en el [contrato](./contracts/asistencia-api.md).

## Summary

Se agregan a la API:

- el horario por obra, general o "solo hoy" con tolerancia;
- la credencial QR permanente de cada trabajador;
- el oficio del trabajador en su perfil;
- el registro de entrada y salida por lotes idempotentes, que sirve con conexión o sin ella;
- la edición de los detalles de asistencia con historial por campo;
- el calendario mensual con colores, faltas calculadas y el símbolo $ de descuento.

El enfoque técnico:

- La hora de servidor se usa con conexión y la hora de captura sin ella. La fecha local se calcula con la zona horaria de la empresa.
- Cada registro guarda una copia del horario con el que se evaluó, para que no se reclasifique.
- El QR es un token aleatorio de 256 bits. La app del supervisor recibe solo su huella SHA-256 para validar sin conexión.

Detalle en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript estricto sobre Node 24, módulos ES.

**Primary Dependencies**: Fastify 5, `@fastify/jwt`, `@fastify/rate-limit`, `@fastify/helmet`, Prisma 7 con `@prisma/adapter-pg`, zod 4 y `@azure/storage-blob` (URLs SAS de fotos). `node:crypto` para el token y el SHA-256, e `Intl` para la zona horaria. **No se agregan dependencias de producción.**

**Storage**: PostgreSQL 17, con 4 tablas nuevas y 2 columnas nuevas (ver [data-model.md](./data-model.md)). Las fotos ya existentes se leen de Blob Storage privado.

**Testing**: Vitest con `app.inject()` contra el PostgreSQL de `docker-compose`, y un doble de almacenamiento. Se agregan en la fase de preparación (R-12).

**Target Platform**: Azure App Service Linux B1 (`civiltrace-api`, West US).

**Project Type**: servicio web (API REST) que consumen la app móvil y, más adelante, el portal.

**Performance Goals**:

- Un escaneo, de la vista previa al registro, en menos de 1 s del lado de la API, para cumplir SC-001 (menos de 10 s de punta a punta).
- Un lote de 100 escaneos en menos de 5 s.
- Un calendario mensual en menos de 1 s.

**Constraints**:

- Lotes idempotentes y orden de escaneo respetado.
- Los registros de asistencia y su historial no se borran.
- Aislamiento por `empresaId` en cada consulta.
- Plan B1 sin procesos programados: las faltas se calculan al consultar.
- La API y la base están en regiones distintas (T-06): conviene evitar idas y vueltas por escaneo, por ejemplo con lecturas agrupadas y una sola transacción por escaneo.

**Scale/Scope**: el MVP contempla hasta unas 10 obras por empresa, 50 trabajadores por obra y unos 2 escaneos por trabajador al día.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principio                 | Cómo lo cumple este plan                                                                                                                                                                                                                                                                                                                   | Estado                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **I. El Figma manda**     | Las 9 pantallas están citadas por `node-id` y cada endpoint dice qué pantalla atiende. Hay dos agregados que no están en el Figma, ambos decididos por el equipo y registrados: el símbolo $ (D-13) y la operación sin conexión (D-14). El oficio (R-10) **sí** está en el Figma; lo que falta es dónde se captura, y queda como pregunta. | ✅                                       |
| **I.4 Trazabilidad SRS**  | La spec, el plan y el contrato citan RF-19, RF-27, RF-56, RF-58, RF-60 y RNF-07. Cada archivo nuevo llevará `@requerimientos`.                                                                                                                                                                                                             | ✅                                       |
| **II. ECCT v1.0**         | Los archivos nuevos siguen el patrón existente (`rutasX.ts`, `servicioX.ts`, `esquemasX.ts`, `constantes/x.ts`), con encabezado, secciones numeradas, identificadores en español sin acentos y constantes de negocio con nombre (data-model, "Constantes").                                                                                | ✅                                       |
| **III. Pruebas primero**  | Las pruebas se escriben antes del servicio, con claves `CP19-E1..E3` y las propuestas `CP21` y `CP22` (R-13). La cobertura mínima de los servicios es 80 %. **Prerrequisito**: falta la infraestructura de pruebas y lint, que es la primera fase de tareas (R-12).                                                                        | ⚠️ Se resuelve en la fase de preparación |
| **IV. Seguridad y datos** | Todas las rutas usan zod, token, rol y pertenencia a la empresa. Un QR de otra empresa no revela datos. El token del QR es de 256 bits y la app sin conexión solo recibe su huella. Las fotos se sirven con SAS temporal. No se borra asistencia y el historial guarda autor, fecha, valor anterior y motivo (IV.6).                       | ✅                                       |
| **V. Azure**              | No se crean recursos de Azure nuevos; solo hay una migración de base de datos.                                                                                                                                                                                                                                                             | ✅                                       |
| **VI. Forma de trabajar** | La rama `001-asistencia-qr-horario` va a PR con revisión. La migración se llama `asistencia_qr_horario`. La API va antes que la app. Las dudas de negocio están registradas (ver Pendientes).                                                                                                                                              | ✅                                       |

**Resultado**: pasa. La advertencia de III es un prerrequisito con tarea asignada, no una violación.

**Revisión después del diseño (fase 1)**: el modelo y el contrato no agregan dependencias, servicios de Azure ni tablas que se borren en cascada desde datos de evidencia. Sigue pasando.

## Project Structure

### Documentation (this feature)

```text
specs/001-asistencia-qr-horario/
├── spec.md
├── plan.md                  # este archivo
├── research.md              # fase 0
├── data-model.md            # fase 1
├── quickstart.md            # fase 1
├── contracts/
│   └── asistencia-api.md    # fase 1
├── checklists/
│   └── requirements.md
└── tasks.md                 # fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                         # + enums, HorarioObra, CredencialAsistencia,
│                                         #   RegistroAsistencia, CambioAsistencia,
│                                         #   Empresa.zonaHoraria, Usuario.oficio
└── migrations/<fecha>_asistencia_qr_horario/

src/
├── app.ts                                # registra rutasAsistencia y rutasHorario
├── esquemas/esquemasPerfil.ts           # + oficio opcional (D-18)
├── constantes/asistencia.ts              # TOLERANCIAS_PERMITIDAS, PREFIJO_QR, límites
├── esquemas/esquemasAsistencia.ts        # zod: horario, lote de escaneos, detalles, calendario
├── rutas/
│   ├── rutasHorario.ts                   # /obras/:obraId/horario
│   └── rutasAsistencia.ts                # /asistencia/* y /obras/:obraId/asistencia/*
├── servicios/
│   ├── servicioHorario.ts                # horario efectivo del día, guardar general o solo hoy
│   ├── servicioCredencialAsistencia.ts   # obtener o crear la credencial permanente y resolver el token
│   ├── servicioRegistroAsistencia.ts     # vista previa, lote, clasificación, resumen del día
│   ├── servicioDetallesAsistencia.ts     # detalle del día y edición con historial
│   └── servicioCalendarioAsistencia.ts   # calendario mensual, faltas calculadas, resumen
└── utilidades/
    ├── fechasLocales.ts                  # instante ↔ fecha y hora local con zona IANA
    └── permisosObra.ts                   # esSupervisorDeObra, perteneceAEmpresa (reutilizable)

pruebas/
├── configuracion/                        # setup de Vitest, base de prueba, semilla, doble de almacenamiento
├── unidad/
│   ├── fechasLocales.test.ts
│   └── clasificacionAsistencia.test.ts   # límites de tolerancia (SC-006)
└── integracion/
    ├── horario.test.ts                   # CP22
    ├── registroAsistencia.test.ts        # CP21
    ├── detallesAsistencia.test.ts        # CP19-E1, CP19-E3
    └── calendarioAsistencia.test.ts      # CP19-E2 y aislamiento
```

**Structure Decision**: es un solo proyecto (la API) y respeta la estructura que ya describe `CLAUDE.md`:

- las rutas solo validan, autorizan y llaman servicios;
- la lógica vive en los servicios;
- las pruebas van en `pruebas/`, como ya prevé `CLAUDE.md`.

Las dos utilidades nuevas (`fechasLocales` y `permisosObra`) las reutilizarán los features de desempeño y de reportes.

## Pendientes para el equipo (no bloquean la API)

1. **Oficio en el perfil** (D-18): el Figma de perfil debe agregar el campo "Oficio".
2. **Agregar al plan de pruebas** los casos `CP21` (Registrar asistencia con QR) y `CP22` (Fijar horario de obra). El equipo ya lo aprobó (D-19).
3. **Fecha de asignación de un trabajador a una obra** (R-08). Sin ella, las faltas calculadas empiezan a contar desde el inicio de la obra o el alta del usuario. Se propone un modelo `AsignacionObra` con fechas en un feature posterior.
4. **Actualizar el Figma** con el símbolo $ (D-13).

## Complexity Tracking

No hay violaciones de la constitución que justificar.
