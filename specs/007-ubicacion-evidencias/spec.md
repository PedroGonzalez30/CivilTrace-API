# Feature 007: Ubicación de cada evidencia fotográfica

**Rama**: `007-ubicacion-evidencias` (API y app salen de `006-correcciones-segunda-revision`; el
portal sale de `004-portal-cliente`) · **Fecha**: 25/11/2026 · **Autor**: Emilio Manuel Esquivel ·
**Decisión**: D-38 (resuelve P-16)

**Requerimientos (SRS v5.0)**: `RF-08 Capturar evidencia fotográfica` (Must: usuario, fecha, hora y
**coordenadas GPS** registrados de forma automática y sin opción de editarlos; sin señal GPS, la foto
se marca «Sin ubicación GPS» y se exige escribir una referencia de ubicación), `RF-12 Generar
reporte de avance de obra` (fotos con usuario, fecha, hora y **ubicación**) y `RF-66 Consultar
avances en el portal del cliente` (fotos con fecha, hora y **ubicación**).

## Alcance

| Dónde                      | Qué cambia                                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App: Subir evidencia       | **Cámara**: al tomar la foto, la app lee el GPS del teléfono (precisión alta, máx. 8 s; si no, la última posición de menos de 5 min). **Galería**: usa las coordenadas EXIF de la foto (si es 0,0 o no tiene, no cuentan). |
|                            | Con coordenadas: muestra "32.624500, -115.452300 (± 12 m)" sin campo para editarlas. Sin permiso o sin señal: «Sin ubicación GPS» y el campo **Referencia de ubicación** (obligatorio, 200 caracteres).                    |
| API: `POST …/avances`      | Cabeceras `x-latitud`, `x-longitud`, `x-precision-ubicacion` (opcional) o `x-referencia-ubicacion` (codificada con `encodeURIComponent`). Sin coordenadas ni referencia: **400** y no se guarda la evidencia.              |
| Detalle, revisión, reporte | Cada foto muestra su ubicación con «Ver mapa» (Google Maps). Pantallas: detalle de actividad (dueño/supervisor), revisar avance, actividad del trabajador y reportes.                                                      |
| PDF                        | Reporte de la app (expo-print), reporte y acta de la entrega (pdfkit): una línea "Ubicación: …" debajo de cada foto.                                                                                                       |
| Portal del cliente         | Avances y detalle de la entrega: "Ubicación: …" y enlace «Ver en el mapa».                                                                                                                                                 |

Fotos anteriores a este feature: «Ubicación no registrada».

## Contrato

Entrada (`POST /obras/:idObra/actividades/:idActividad/avances`, cuerpo = imagen):

| Cabecera                 | Regla                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| `x-latitud`              | Número entre -90 y 90; va junto con `x-longitud`.                        |
| `x-longitud`             | Número entre -180 y 180.                                                 |
| `x-precision-ubicacion`  | Metros ≥ 0, opcional.                                                    |
| `x-referencia-ubicacion` | Texto (≤ 200). Obligatoria sin coordenadas; con coordenadas se descarta. |

Salida: cada avance o foto (detalle de actividad, reporte, `/portal/avances`, `/portal/entregas/:id`)
agrega:

```json
{
  "ubicacion": { "latitud": 32.624538, "longitud": -115.452261, "precisionMetros": 12.5 },
  "referenciaUbicacion": null
}
```

Sin GPS: `"ubicacion": null, "referenciaUbicacion": "Sótano, junto a la cisterna"`.

## Datos

`AvanceActividad`: `latitud` y `longitud` (`Decimal(9,6)`, como la asistencia), `precisionMetros`
(`Float`) y `referenciaUbicacion` (`String`), todos opcionales. La entrega no copia la ubicación: se
lee de la foto original, que no se edita (RF-08, RF-17).

**Migración**: `20261125231653_ubicacion_evidencias` (solo agrega columnas). Aplicarla en Azure antes
de desplegar la API (P-19).

## Fuera de alcance

- RF-36 (ubicar la evidencia sobre el plano) y RF-40 (ubicación del trabajador durante la jornada)
  son Won't.
- Validar que la foto se tomó dentro de la obra: la obra no tiene coordenadas.
- El reporte de la app no dibuja un mapa; solo da las coordenadas.

## Pruebas

- API: `pruebas/integracion/ubicacionEvidencias.test.ts` (CP12-A14 a A18, CP11-A14, CP15-A11, A12 y
  CP16-PORTAL-E7) y `pruebas/unidad/ubicacionEvidencia.test.ts` (CP15-U1 a U4). Las pruebas
  anteriores que suben fotos ahora mandan coordenadas.
- App: `__tests__/ubicacionEvidencias-test.tsx` (CP12-A15 a A20, CP11-A15, CP15-A13) y el flujo de
  galería sin EXIF en `actividadesEvidencias-test.tsx` (CP12-A13).
- Portal: `pruebas/flujoPortal.test.tsx` (CP16-PORTAL-E7-PORTAL).
