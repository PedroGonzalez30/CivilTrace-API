# Modelo de datos: Asistencia con QR, horario por obra y calendario

**Feature**: `001-asistencia-qr-horario` · **Spec**: [spec.md](./spec.md) · **Investigación**: [research.md](./research.md)

Los cambios van en `prisma/schema.prisma` en una sola migración, `asistencia_qr_horario`. Ninguna tabla nueva se borra en cascada desde `Usuario`, para cumplir el principio IV.6: no se borran registros de asistencia.

## Enumeraciones nuevas

| Enum | Valores |
|---|---|
| `AlcanceHorario` | `GENERAL`, `DIA` |
| `TipoJornada` | `COMPLETA`, `RETARDO`, `MEDIA_JORNADA`, `SALIDA_TEMPRANA`, `FALTA` |
| `MotivoAsistencia` | `CITA_MEDICA`, `ENFERMEDAD`, `PERMISO_PERSONAL`, `ASUNTO_FAMILIAR`, `OTRO` |
| `EfectoPago` | `PAGO_COMPLETO`, `MEDIO_DIA`, `SIN_PAGO` |

## Cambios a modelos existentes

| Modelo | Campo nuevo | Tipo | Regla |
|---|---|---|---|
| `Empresa` | `zonaHoraria` | `String @default("America/Tijuana")` | Identificador IANA válido (R-05, D-15). |
| `Usuario` | `oficio` | `String?` | Máximo 60 caracteres. Opcional (R-10). |

## Entidades nuevas

### HorarioObra (R-06, FR-009 a FR-011)

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `String @id cuid` | |
| `obraId` | → `Obra` | `onDelete: Restrict` |
| `empresaId` | → `Empresa` | Aislamiento por empresa |
| `alcance` | `AlcanceHorario` | |
| `fecha` | `DateTime? @db.Date` | Obligatoria si `alcance = DIA`; nula si es `GENERAL` |
| `horaEntrada` | `String` | `HH:MM` en 24 h, hora local de la empresa |
| `horaSalida` | `String` | `HH:MM` y mayor que `horaEntrada` |
| `toleranciaMinutos` | `Int` | 10, 15 o 20 (`TOLERANCIAS_PERMITIDAS`) |
| `diasLaborales` | `Int[]` | 1 a 7 valores distintos entre 0 y 6 (0 = domingo) |
| `creadoPorId` | → `Usuario` | Supervisor de la obra o dueño |
| `creadoEn` | `DateTime @default(now())` | |

Índice `@@index([obraId, alcance, fecha, creadoEn])`. Las filas no se actualizan ni se borran.

- **Horario general vigente:** el `GENERAL` más reciente.
- **Horario efectivo del día D:** el `DIA` más reciente con `fecha = D`. Si no hay, el general.
- **Día laborable:** si `getDay(D)` está en los `diasLaborales` del horario efectivo.
- **Sin horario:** si la obra no tiene ninguno, no hay días laborables, así que no hay faltas ni retardos.

### CredencialAsistencia (R-01, FR-001)

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `String @id cuid` | |
| `trabajadorId` | → `Usuario` | Rol `TRABAJADOR` |
| `empresaId` | → `Empresa` | |
| `token` | `String @unique` | 32 bytes aleatorios en base64url |
| `tokenHash` | `String @unique` | SHA-256 en hex de `token` |
| `creadaEn` | `DateTime @default(now())` | |
| `revocadaEn` | `DateTime?` | Se llena al regenerar. Nunca se borra |

Un trabajador tiene a lo sumo una credencial con `revocadaEn = null`. La primera se crea la primera vez que la pide.

### RegistroAsistencia (FR-006, FR-007, FR-012 a FR-016)

Hay uno por trabajador, obra y fecha: `@@unique([trabajadorId, obraId, fecha])`.

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `String @id cuid` | |
| `empresaId`, `obraId`, `trabajadorId` | relaciones | `onDelete: Restrict` |
| `fecha` | `DateTime @db.Date` | Fecha local en la zona de la empresa |
| `entradaEn` | `DateTime?` (timestamptz) | |
| `entradaLatitud`, `entradaLongitud` | `Decimal? @db.Decimal(9,6)` | Nulas significa "Sin ubicación GPS" |
| `entradaSinConexion` | `Boolean @default(false)` | FR-028 |
| `entradaIdLocal` | `String? @unique` | UUID de la app (R-03) |
| `entradaRegistradaPorId` | → `Usuario?` | Supervisor |
| `salidaEn`, `salidaLatitud`, `salidaLongitud`, `salidaSinConexion`, `salidaIdLocal`, `salidaRegistradaPorId` | igual que en la entrada | |
| `tipoJornada` | `TipoJornada @default(COMPLETA)` | |
| `motivo` | `MotivoAsistencia?` | |
| `efectoPago` | `EfectoPago @default(PAGO_COMPLETO)` | |
| `anotacion` | `String?` | Máximo 500 caracteres. Obligatoria si el supervisor guarda un tipo distinto de `COMPLETA` |
| `esDiaLaborable` | `Boolean` | Copia del horario (R-07) |
| `horarioEntrada`, `horarioSalida` | `String?` | Copia del horario efectivo |
| `toleranciaMinutos` | `Int?` | Copia del horario efectivo |
| `creadoEn`, `actualizadoEn` | `DateTime` | |

Índices: `@@index([empresaId])`, `@@index([obraId, fecha])` y `@@index([trabajadorId, fecha])`.

**Transiciones**:

```text
(sin registro) --escaneo 1--> entrada guardada; tipo = RETARDO si entrada > horarioEntrada + tolerancia, si no COMPLETA
entrada guardada --escaneo 2--> salida guardada; si salida < horarioSalida y tipo = COMPLETA, tipo = SALIDA_TEMPRANA
salida guardada --escaneo 3--> RECHAZADO "La asistencia de hoy ya está completa"
(sin registro, día laborable pasado) --> FALTA calculada (no se guarda)
cualquier estado --supervisor guarda detalles--> tipo, motivo, efecto, anotación y horas elegidas + CambioAsistencia
```

**Color en el calendario** (FR-020):

| Color | Cuándo |
|---|---|
| `VERDE` | `COMPLETA` |
| `NARANJA` | `RETARDO`, `MEDIA_JORNADA` o `SALIDA_TEMPRANA` |
| `ROJO` | `FALTA`, guardada o calculada |
| Sin color | Días no laborables sin registro y días futuros |

`conDescuento = efectoPago ∈ {MEDIO_DIA, SIN_PAGO}` hace que el día muestre el símbolo **$** (D-13).

### CambioAsistencia (R-09, FR-017)

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `String @id cuid` | |
| `registroId` | → `RegistroAsistencia` | `onDelete: Restrict` |
| `campo` | `String` | `tipoJornada`, `motivo`, `efectoPago`, `anotacion`, `entradaEn` o `salidaEn` |
| `valorAnterior`, `valorNuevo` | `String?` | Las horas se guardan en ISO 8601 |
| `autorId` | → `Usuario` | |
| `creadoEn` | `DateTime @default(now())` | |

Se inserta en la misma transacción que la actualización del registro. No hay actualización ni borrado.

## Constantes de negocio (`src/constantes/asistencia.ts`)

| Constante | Valor |
|---|---|
| `TOLERANCIAS_PERMITIDAS` | `[10, 15, 20]` |
| `TOLERANCIA_MINUTOS_POR_DEFECTO` | `15` |
| `ZONA_HORARIA_POR_DEFECTO` | `'America/Tijuana'` |
| `MAXIMO_ESCANEOS_POR_LOTE` | `100` |
| `MAXIMO_DIAS_REGISTRO_SIN_CONEXION` | `7` |
| `MAXIMO_MINUTOS_EN_FUTURO` | `5` |
| `LONGITUD_MAXIMA_ANOTACION` | `500` |
| `PREFIJO_QR` | `'ct1.'` |
| `DURACION_URL_FOTO_MINUTOS` | `60` |
