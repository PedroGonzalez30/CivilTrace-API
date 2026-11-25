# Feature 005: Métricas de desempeño del trabajador

**Rama**: `005-metricas-desempeno` (API y app; sale de `004-portal-cliente`) · **Fecha**: 25/11/2026 ·
**Autor**: Emilio Manuel Esquivel · **Decisión**: D-30 · **Pantalla**: `DesempenoTrabajador-Dueño`
(`2273:219`)

**Requerimientos**: el SRS v5.0 deja `RF-33 Calcular desempeño del trabajador` como Won't, pero el
equipo lo mantiene (D-30). Se toman las reglas de la V4.0: `RF-31` (actividades aprobadas y
rechazadas), `RF-61` (retardos y salidas anticipadas), `RF-62` (entregas a tiempo), `RF-63`
(rechazo de evidencias) y `RF-64` (mostrar métricas al dueño y al supervisor).

## Alcance

Por trabajador y periodo (**Semana**: lunes a hoy; **Mes**: día 1 a hoy; **Todo**: desde su alta),
en la zona horaria de la empresa:

| Tarjeta                 | Cálculo                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asistencia              | Días del calendario (RF-58) en el periodo: % = completos / total; además retardos, medias jornadas, salidas tempranas y faltas (calculadas o guardadas). |
| Evidencias aceptadas    | Fotos que subió el trabajador en el periodo: % = aprobadas / (aprobadas + rechazadas); las pendientes no cuentan.                                          |
| Actividades entregadas  | Actividades a su cargo terminadas en el periodo: antes de la fecha, el mismo día o con retraso (comparando la fecha terminada con la programada).          |
| Actividades aprobadas   | Entregas "Terminado" del trabajador revisadas en el periodo: % = aprobadas / (aprobadas + rechazadas) (RF-31).                                            |

Sin datos, el porcentaje es `null` y la app muestra "Sin datos".

**Quién lo ve** (RF-64): el dueño, de cualquier trabajador de su empresa; el supervisor, de los
trabajadores de sus obras (solo con los datos de sus obras). El trabajador no.

**Dónde**: el dueño toca un trabajador en **Personal** (retroalimentación del equipo); el supervisor
tiene un botón **Personal** en la esquina superior derecha de **Asistencia de personal**, que lleva a
la lista de sus trabajadores y de ahí a sus métricas.

## Contrato

`GET /asistencia/trabajadores/:trabajadorId/desempeno?periodo=SEMANA|MES|TODO`

```json
{
  "trabajador": { "id": "…", "nombre": "Emilio", "oficio": "Plomero" },
  "periodo": { "tipo": "MES", "desde": "2026-11-01", "hasta": "2026-11-25" },
  "asistencia": { "porcentaje": 92, "completos": 22, "total": 24, "retardos": 1, "mediasJornadas": 0, "salidasTempranas": 0, "faltas": 1 },
  "evidencias": { "porcentaje": 90, "aprobadas": 18, "rechazadas": 2, "pendientes": 1 },
  "actividadesEntregadas": { "total": 14, "antes": 9, "mismoDia": 3, "conRetraso": 2 },
  "actividadesAprobadas": { "porcentaje": 80, "aprobadas": 4, "rechazadas": 1 }
}
```

Errores: 400 periodo inválido · 403 trabajador o supervisor sin relación · 404 trabajador de otra
empresa.

## Pruebas

`pruebas/integracion/desempeno.test.ts` (claves `CP20-*`) y en la app `__tests__/desempeno-test.tsx`.
