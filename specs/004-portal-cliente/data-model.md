# Data model: Portal web del cliente y entregas (feature 004)

**Fecha**: 24/11/2026 · **Autor**: Emilio Manuel Esquivel · Migración: `portal_cliente_entregas`

Todas las tablas nuevas llevan `empresaId` para filtrar por empresa (constitución IV.2) y no se
borran registros de entregas respondidas (constitución IV.6). Nombres en español, sin acentos (ECCT).

## Enumeraciones nuevas

```prisma
enum EstadoEntrega {
  ENVIADA
  ACEPTADA
  CON_OBSERVACIONES
}

enum EstadoEnvioEnlace {
  ENVIADO
  FALLIDO
}
```

## EnlacePortal (RF-65)

Uno por obra y permanente; solo se rota si cambia el correo del cliente (research R-03).

| Campo           | Tipo               | Reglas                                                     |
| --------------- | ------------------ | ---------------------------------------------------------- |
| `id`            | String (cuid)      |                                                            |
| `obraId`        | String             | **único**; relación con `Obra` (`onDelete: Cascade`)       |
| `empresaId`     | String             | índice                                                     |
| `tokenHash`     | String             | **único**; SHA-256 del token de 256 bits (para buscar)     |
| `tokenCifrado`  | String             | AES-256-GCM (`iv:etiqueta:texto` en base64), para reenviar |
| `correo`        | String             | correo al que se envió el último enlace                    |
| `creadoEn`      | DateTime           | `now()`                                                    |
| `ultimoEnvioEn` | DateTime?          |                                                            |
| `estadoEnvio`   | EstadoEnvioEnlace? | resultado del último envío                                 |

## Entrega (RF-13, RF-14, RF-15, RF-16, RF-60)

| Campo           | Tipo              | Reglas                                                     |
| --------------- | ----------------- | ---------------------------------------------------------- |
| `id`            | String (cuid)     |                                                            |
| `obraId`        | String            | índice; relación con `Obra`                                |
| `empresaId`     | String            | índice                                                     |
| `fechaInicio`   | DateTime @db.Date | rango elegido (D-29)                                       |
| `fechaFin`      | DateTime @db.Date | `fechaFin >= fechaInicio`                                  |
| `enviadaPorId`  | String?           | `Usuario` (supervisor o dueño); `SetNull` si se da de baja |
| `enviadaEn`     | DateTime          | `now()`                                                    |
| `estado`        | EstadoEntrega     | `ENVIADA` al crear                                         |
| `nombreCliente` | String?           | 3–120 caracteres al responder                              |
| `observaciones` | String?           | obligatorio y no vacío si `CON_OBSERVACIONES` (máx. 2000)  |
| `firmaBlob`     | String?           | ruta en Blob Storage privado                               |
| `firmaSha256`   | String?           | 64 hex                                                     |
| `respondidaEn`  | DateTime?         | fecha y hora de la respuesta                               |
| `reporteBlob`   | String?           | PDF del reporte, se crea la primera vez que se pide        |
| `actaBlob`      | String?           | PDF del acta; solo si `ACEPTADA`                           |
| `actaSha256`    | String?           |                                                            |

**Transiciones** (una sola vez, FR-015):

```text
ENVIADA ──(código + nombre + firma)──▶ ACEPTADA            (bloquea actividades, RF-17)
ENVIADA ──(observaciones + nombre + firma)──▶ CON_OBSERVACIONES
```

Se valida con `updateMany({ where: { id, estado: 'ENVIADA' } })`: si cambia 0 filas, otra pestaña
ya respondió (409).

## EntregaActividad (copia fija, R-06)

| Campo            | Tipo               | Reglas                             |
| ---------------- | ------------------ | ---------------------------------- |
| `id`             | String (cuid)      |                                    |
| `entregaId`      | String             | índice; `onDelete: Cascade`        |
| `actividadId`    | String             | índice; referencia a `Actividad`   |
| `nombre`         | String             | copiado al enviar                  |
| `descripcion`    | String             | copiado                            |
| `estado`         | EstadoActividad    | copiado (`TERMINADA` = Verificada) |
| `fechaEntrega`   | DateTime @db.Date  | copiado                            |
| `fechaTerminada` | DateTime? @db.Date | copiado                            |

`@@unique([entregaId, actividadId])`.

## EntregaAvance (copia fija, R-06)

| Campo                | Tipo          | Reglas                                              |
| -------------------- | ------------- | --------------------------------------------------- |
| `id`                 | String (cuid) |                                                     |
| `entregaId`          | String        | índice                                              |
| `entregaActividadId` | String        | relación con `EntregaActividad`                     |
| `avanceId`           | String        | índice; referencia a `AvanceActividad` (`APROBADO`) |
| `comentario`         | String        | copiado                                             |
| `fechaRegistro`      | DateTime      | copiado                                             |

`@@unique([entregaId, avanceId])`. Un avance no puede estar en dos entregas `ENVIADA`/`ACEPTADA`
(P-15): se comprueba en el servicio dentro de la misma transacción.

## CodigoEntrega (RF-14, constitución IV.3)

| Campo        | Tipo          | Reglas                                       |
| ------------ | ------------- | -------------------------------------------- |
| `id`         | String (cuid) |                                              |
| `entregaId`  | String        | índice                                       |
| `codigoHash` | String        | HMAC-SHA256 (R-04)                           |
| `creadoEn`   | DateTime      | `now()`; uno por minuto por entrega          |
| `venceEn`    | DateTime      | `creadoEn + 10 min`                          |
| `intentos`   | Int           | `0`; al llegar a 5 se invalida               |
| `usadoEn`    | DateTime?     |                                              |
| `invalidado` | Boolean       | `false`; `true` al pedir otro o al 5.º fallo |

## Cambios a tablas existentes

- `Obra`: relaciones `enlacePortal EnlacePortal?` y `entregas Entrega[]`.
- `Actividad`: relación `entregas EntregaActividad[]`.
- `AvanceActividad`: relación `entregas EntregaAvance[]`.
- `Usuario`: relación `entregasEnviadas Entrega[]`.
- `Empresa`: relaciones a las tablas nuevas.

Ninguna columna existente cambia, así que la migración solo agrega tablas (segura para producción,
igual que P-09).

## Constantes de negocio (`src/constantes/portal.ts`)

```ts
BYTES_TOKEN_PORTAL = 32;
DIGITOS_CODIGO = 6;
MINUTOS_VIGENCIA_CODIGO = 10;
MAXIMO_INTENTOS_CODIGO = 5;
SEGUNDOS_ENTRE_CODIGOS = 60;
TAMANO_MAXIMO_FIRMA_BYTES = 512 * 1024;
LONGITUD_MAXIMA_OBSERVACIONES = 2000;
```
