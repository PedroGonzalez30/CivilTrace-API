# Feature 006: correcciones de la segunda revisión del equipo

**Rama**: `006-correcciones-segunda-revision` (API y app; sale de `005-metricas-desempeno`) ·
**Fecha**: 25/11/2026 · **Autor**: Emilio Manuel Esquivel · **Origen**: comentarios del equipo
(24/11/2026) al probar la app, aclarados por Emilio el 25/11/2026.

| #      | Comentario del equipo                                                     | Cambio                                                                                                                          | Decisión |
| ------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1      | "Bajarle lo tenue a los campos para llenar"                               | Textos guía (`COLORES.marcador`) de `#9ca3af` a `#6b7280`.                                                                      | —        |
| 4      | "Los textos de los botones de la obra son muy largos"                     | Detalle de obra: "Actividades" y "Reportes".                                                                                    | —        |
| 5      | "Agregar trabajadores a una obra después de crearla"                      | `GET/POST /obras/:id/trabajadores`: el supervisor de la obra o el dueño agregan trabajadores (sin duplicar).                    | RF-68    |
| 6      | "Centrar los iconos de la barra de navegación"                            | Cada elemento de la barra ocupa el mismo ancho.                                                                                 | —        |
| 9      | "Si alguien no llegó, es falta" (ya pasaba al terminar el día)            | Sin cambio.                                                                                                                     | —        |
| 10     | "Después de la hora de salida, los que no se registraron son falta"       | Resumen del día y calendario: falta el mismo día en cuanto pasa la hora de salida.                                              | D-34     |
| 11     | "Escribir la hora en el horario en lugar de una lista"                    | `SelectorHora` es un campo HH:MM (24 h) que confirma la hora en am/pm.                                                          | D-36     |
| 12, 15 | "Poder marcar el número de horas a descontar" (sin monto)                 | `RegistroAsistencia.horasDescontadas` (0.5 a 12, medias horas) en Detalles de asistencia; muestra el $.                         | D-35     |
| 13     | "En la asistencia con QR, que indique si es entrada o salida"             | Confirmación del escaneo: "Registro de ENTRADA/SALIDA" en grande.                                                               | —        |
| 14     | "Poner márgenes en el QR"                                                 | QR del trabajador con margen blanco (`quietZone`).                                                                              | —        |
| 20, 22 | "Contraseña con validaciones" y "verificar contraseña al crear la cuenta" | Registro: reglas visibles (8 caracteres, mayúscula, minúscula, número) en app y API, y "Confirmar contraseña"; sin autollenado. | D-12     |
| 21     | "El teclado tapa la entrada del código de empresa al crear cuenta"        | `ModalEmpresa` sube con el teclado.                                                                                             | D-37     |

Ya resueltos antes: foto con error (D-32, D-33), firma y subir evidencias (003/004), reporte como
enlace (004), teclado en el registro (D-27). Métricas (8, 16): feature 005.

**Migración**: `…_horas_descontadas` (agrega una columna). Aplicarla en Azure antes de desplegar.

**Pruebas**: API `pruebas/integracion/correccionesSegundaRevision.test.ts`; app
`__tests__/correccionesSegundaRevision-test.tsx`, `SelectorHoraYPila-test.tsx`,
`HojaDetallesAsistencia-test.tsx` y `PantallasEscaneo-test.tsx`.
