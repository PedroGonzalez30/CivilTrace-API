# Feature 002: correcciones de la revisión del equipo (API)

**Rama**: `002-correcciones-revision` · **Fecha**: 24/11/2026 · **Autor**: Emilio Manuel Esquivel
**Origen**: comentarios del equipo al probar el feature 001 en el celular. Decisiones D-22 a D-27 y
T-14 en `docs/decisiones.md`. La parte de la app está en el repo `CivilTrace`, en la misma rama.

## Alcance

| #   | Comentario del equipo                                                                      | Cambio en la API                                                                                                                                                    | Decisión |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | "Si puse 8 am la entrada y lo tomas en la noche te pone retardo, no falta"                 | `clasificarJornada`: una entrada desde la hora de salida es `FALTA`. Al registrar la salida, la falta se conserva.                                                  | D-22     |
| 2   | "El supervisor debe poder acceder a los códigos de la empresa, pero solo el de trabajador" | `GET /empresa/codigos` acepta `SUPERVISOR` y le responde `{ codigos: { trabajadores } }`. El dueño sigue recibiendo los dos; regenerar sigue siendo solo del dueño. | D-23     |
| 3   | "Al registrar una obra sin supervisor no sale ningún mensaje"                              | `POST /obras` exige `supervisorId`: 400 con "Selecciona un supervisor para la obra".                                                                                | D-24     |
| 4   | "Colocar la foto de la empresa en el header, parte derecha"                                | `GET /empresa/logo` lo pueden consultar los tres roles (siempre el de su propia empresa, sale del token).                                                           | D-25     |

Fuera de alcance: las fotos de perfil y de la empresa ya se guardan bien (lo confirmó el equipo en
una segunda prueba); no se cambian.

## Criterios de aceptación (pruebas)

- `pruebas/unidad/clasificacionAsistencia.test.ts`: CP19-A12 (15:59 = retardo; 16:00 y 20:00 =
  falta) y CP19-A13 (una falta sigue siendo falta al salir).
- `pruebas/integracion/correccionesRevision.test.ts`: CP02-A10 a CP02-A12 (códigos por rol),
  CP03-A10 (logotipo para supervisor y trabajador) y CP04-A10 a CP04-A11 (supervisor obligatorio).

## Tareas

- [x] T001 Pruebas en rojo de D-22, D-23, D-24 y D-25.
- [x] T002 D-22 en `src/servicios/servicioRegistroAsistencia.ts`.
- [x] T003 D-23 y D-25 en `src/rutas/rutasEmpresa.ts`.
- [x] T004 D-24 en `src/esquemas/esquemasObra.ts`.
- [x] T005 Suite completa, tipos, lint y Prettier en verde; decisiones D-22 a D-27 y T-14 en los dos repos.
- [ ] T006 PR revisado por el equipo y desplegado (no requiere migración).
