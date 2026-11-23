# Contrato de la API: asistencia y horario

**Feature**: `001-asistencia-qr-horario` · **Modelo**: [../data-model.md](../data-model.md)

**Reglas para todos los endpoints:**

- Usan `verificarToken`, filtran por el `empresaId` del token y validan la entrada con zod.
- Los errores tienen la forma `{ "mensaje": "<español>" }`.
- Las horas viajan en ISO 8601 UTC, las fechas como `YYYY-MM-DD` (fecha local de la empresa) y las horas de horario como `HH:MM`.

**Autorización:**

| Abreviatura | Quién puede |
|---|---|
| **SUP-OBRA** | El rol `SUPERVISOR` y `Obra.supervisorId === user.id`. |
| **DUENO** | El rol `DUENO`, con la obra o el trabajador en su empresa. |
| **TRA-PROPIO** | El rol `TRABAJADOR`, con `trabajadorId === user.id`. |

**Códigos de error:**

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos |
| 401 | Sin sesión |
| 403 | Sin permiso, o un recurso de otra empresa. Nunca se revela si existe |
| 404 | El recurso no existe en la empresa |
| 409 | Hay un conflicto |

---

## Horario de la obra (FR-009 a FR-013): pantalla `SUP_HorarioObra` (`2272:170`)

### `GET /obras/:obraId/horario`

**Quién**: SUP-OBRA, DUENO o un TRABAJADOR asignado a la obra.

```json
200 {
  "general": { "horaEntrada": "08:00", "horaSalida": "16:00", "toleranciaMinutos": 15,
               "diasLaborales": [1,2,3,4,5,6], "actualizadoEn": "...", "actualizadoPor": "María Castro" } | null,
  "hoy": { "fecha": "2026-11-20", "horaEntrada": "08:00", "horaSalida": "16:00",
           "toleranciaMinutos": 15, "esDiaLaborable": true, "esExcepcion": false } | null,
  "zonaHoraria": "America/Tijuana"
}
```

### `PUT /obras/:obraId/horario`

**Quién**: SUP-OBRA o DUENO.

```json
{ "horaEntrada": "08:00", "horaSalida": "16:00", "toleranciaMinutos": 15,
  "diasLaborales": [1,2,3,4,5,6], "alcance": "TODOS_LOS_DIAS" | "SOLO_HOY" }
```

- **200** responde con el mismo cuerpo que el `GET`.
- **400** en estos casos:
  - "La hora de salida debe ser posterior a la de entrada".
  - "Elige al menos un día laboral".
  - "La tolerancia debe ser de 10, 15 o 20 minutos".

`SOLO_HOY` crea una excepción `DIA` con la fecha local de hoy.

---

## Credencial QR del trabajador (FR-001, FR-002): pantalla `TRA-Asistencia Dia` (`96:329`)

### `GET /asistencia/mi-credencial`

**Quién**: TRABAJADOR. Si no tiene credencial, la crea.

```json
200 { "codigoQr": "ct1.Q2l2aWxUcmFjZS4uLg", "creadaEn": "..." }
```

### `POST /asistencia/mi-credencial/regenerar`

**Quién**: TRABAJADOR. Revoca la credencial actual y crea otra. Responde **201** con el mismo formato.

### `GET /asistencia/mi-dia`

**Quién**: TRABAJADOR. Muestra el horario y el estado de hoy en cada obra asignada.

```json
200 { "fecha": "2026-11-20", "obras": [ {
  "obraId": "...", "obraNombre": "Hospital",
  "horaEntrada": "08:00", "horaSalida": "16:00", "esDiaLaborable": true,
  "entrada": { "estado": "PENDIENTE" | "REGISTRADA", "hora": "..." | null },
  "salida":  { "estado": "PENDIENTE" | "REGISTRADA", "hora": "..." | null } } ] }
```

---

## Escaneo y registro (FR-003 a FR-008, FR-026 a FR-030)

Pantallas: `SUP_Asistencia_EscogerObra` (`96:2903`), `SUP_Asistencia_LeerQr` (`2272:117`) y `Sup_Asistencia_ConfirmarQR` (`96:2228`).

### `GET /asistencia/mis-obras`

**Quién**: SUPERVISOR. Devuelve las obras que supervisa, para la pantalla "Escoger obra" (FR-003).

```json
200 { "obras": [ { "id": "...", "nombre": "Hospital", "descripcion": "...", "direccion": "...",
                   "fechaInicio": "2026-10-12", "fechaFinal": "2028-10-12" } ] }
```

### `GET /obras/:obraId/asistencia/paquete-sin-conexion`

**Quién**: SUP-OBRA. Entrega lo que la app necesita para validar sin conexión (R-02).

```json
200 { "generadoEn": "...", "zonaHoraria": "America/Tijuana",
  "horario": { "general": {...} | null, "excepcionHoy": {...} | null },
  "trabajadores": [ { "id": "...", "nombre": "Emilio Manuel Esquivel Quiñonez",
      "oficio": "Plomero" | null, "fotoUrl": "https://...sas" | null,
      "huellaCredencial": "<sha256 hex>" | null, "faltasMes": 0 } ] }
```

### `POST /obras/:obraId/asistencia/vista-previa`

**Quién**: SUP-OBRA. Valida un QR **con conexión** y muestra la confirmación sin guardar nada (FR-004, FR-005).

```json
{ "codigoQr": "ct1...." }
```

- **200** responde:

  ```json
  { "tipo": "ENTRADA" | "SALIDA", "hora": "...",
    "trabajador": { "id", "nombre", "oficio", "fotoUrl", "faltasMes" } }
  ```

- **422** si el QR es inválido. El cuerpo es `{ "mensaje", "motivo" }`, y `motivo` toma estos valores:

  | Motivo | Mensaje |
  |---|---|
  | `QR_INVALIDO` | "El código no es de Civil Trace o ya no es válido". |
  | `NO_ASIGNADO` | "El trabajador no está asignado a esta obra". |
  | `ASISTENCIA_COMPLETA` | "La asistencia de hoy ya está completa". |

  Un QR de otra empresa responde `QR_INVALIDO` y no revela datos.

### `POST /asistencia/registros`

**Quién**: SUPERVISOR. Recibe un lote, con conexión o sin ella (R-03, R-04).

```json
{ "escaneos": [ { "idLocal": "uuid-v4", "obraId": "...", "codigoQr": "ct1....",
    "capturadoEn": "2026-11-20T15:02:11Z", "sinConexion": false,
    "latitud": 32.6245 | null, "longitud": -115.4523 | null } ] }
```

El lote lleva de 1 a 100 escaneos y se procesa en orden. Cada escaneo es independiente: si uno falla, no afecta a los demás.

```json
200 { "resultados": [ { "idLocal": "...", "estado": "GUARDADO" | "DUPLICADO" | "RECHAZADO",
    "motivo": null | "QR_INVALIDO" | "NO_ASIGNADO" | "NO_ES_SUPERVISOR" | "ASISTENCIA_COMPLETA" | "FECHA_FUERA_DE_RANGO",
    "mensaje": "..." | null,
    "registro": { "id", "trabajadorId", "fecha", "tipo": "ENTRADA" | "SALIDA", "hora", "tipoJornada" } | null } ] }
```

Hay una sola tasa de peticiones para todos los endpoints de asistencia: 100 por minuto, la global.

### `GET /obras/:obraId/asistencia?fecha=YYYY-MM-DD`

**Quién**: SUP-OBRA o DUENO. Es el "Resumen de asistencia" del día (FR-008). Si no se manda `fecha`, se usa hoy.

```json
200 { "fecha": "...", "horario": { ...efectivo del día... } | null,
  "estadoEntrada": "FINALIZADO" | "PENDIENTE", "estadoSalida": "FINALIZADO" | "PENDIENTE",
  "trabajadores": [ { "id", "nombre", "oficio", "entrada": "..." | null, "salida": "..." | null,
                      "tipoJornada": "..." | "FALTA" | null } ] }
```

`estadoEntrada` es `FINALIZADO` cuando ya pasó la hora de entrada más la tolerancia. `estadoSalida` lo es cuando ya pasó la hora de salida.

---

## Detalles de asistencia (FR-014 a FR-018): pantalla `SUP_DetallesAsistencia` (`2272:250`)

### `GET /obras/:obraId/asistencia/trabajadores/:trabajadorId/dias/:fecha`

**Quién**: SUP-OBRA, DUENO o TRA-PROPIO.

```json
200 { "fecha", "trabajador": { "id", "nombre", "oficio" }, "obra": { "id", "nombre" },
  "entrada": { "hora", "sinConexion", "latitud", "longitud", "registradaPor" } | null,
  "salida": { ... } | null,
  "tipoJornada": "COMPLETA" | "RETARDO" | "MEDIA_JORNADA" | "SALIDA_TEMPRANA" | "FALTA" | null,
  "esFaltaCalculada": false, "motivo": "CITA_MEDICA" | null, "efectoPago": "MEDIO_DIA",
  "conDescuento": true, "anotacion": "...",
  "registradoPor": "Mario Castro", "registradoEn": "...",
  "cambios": [ { "campo": "entradaEn", "valorAnterior": "...", "valorNuevo": "...",
                 "autor": "Mario Castro", "fecha": "..." } ] }
```

### `PATCH /obras/:obraId/asistencia/trabajadores/:trabajadorId/dias/:fecha`

**Quién**: solo SUP-OBRA. Todos los campos son opcionales, pero debe venir al menos uno.

```json
{ "tipoJornada": "MEDIA_JORNADA", "motivo": "CITA_MEDICA", "efectoPago": "MEDIO_DIA",
  "anotacion": "Salió a las 12:00 por cita en el IMSS", "entradaEn": "...", "salidaEn": "..." }
```

- **200** responde con el mismo cuerpo que el `GET`.
- **400** en estos casos:
  - "La observación es obligatoria", si el `tipoJornada` resultante no es `COMPLETA` y no hay anotación (RF-60).
  - "La salida debe ser posterior a la entrada".
  - "No se puede registrar asistencia en una fecha futura".
- **403** si quien la pide no es el supervisor de la obra.

Si el día no tenía registro, lo crea (FR-018). Cada campo que cambia genera un `CambioAsistencia`.

---

## Calendario (FR-019 a FR-023, RF-56, RF-58)

Pantallas: `SUP_CalendarioTrabajador` (`2272:354`), `..._DetalleDia` (`2272:523`) y `TRA-HIstorial asistencia` (`96:389`).

### `GET /asistencia/trabajadores/:trabajadorId/calendario?mes=YYYY-MM&obraId=...`

**Quién**: TRA-PROPIO, SUP-OBRA (si el trabajador está en alguna de sus obras) o DUENO.

- `obraId` es opcional. Si no se manda, se combinan todas las obras del trabajador visibles para quien consulta.
- Un trabajador que pide otro `trabajadorId` recibe **403** (RF-58, caso no válido).

```json
200 { "mes": "2026-05", "trabajador": { "id", "nombre", "oficio" },
  "resumen": { "faltas": 1, "mediasJornadas": 1, "retardos": 1, "salidasTempranas": 0 },
  "dias": [ { "fecha": "2026-05-13", "color": "ROJO", "tipoJornada": "FALTA",
              "esFaltaCalculada": true, "conDescuento": false, "obraId": "..." } ] }
```

- `dias` solo incluye los días con color, y la app pinta el resto.
- El detalle de un día se pide al endpoint de detalles.
- El aviso "Tienes N falta(s)…" lo pinta la app cuando `resumen.faltas >= 1` (D-16).
