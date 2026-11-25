# Contrato de la API: portal del cliente y entregas (feature 004)

**Fecha**: 24/11/2026 · **Autor**: Emilio Manuel Esquivel

Errores: `{ mensaje: string, motivo?: string }` en español (constitución II). Fechas `AAAA-MM-DD`;
instantes ISO 8601. Todas las rutas validan con zod.

## A. Rutas de la app (JWT)

### `POST /obras` (cambia) — RF-65

Respuesta 201: la obra de siempre más

```json
{ "enlacePortal": "ENVIADO" | "FALLIDO" | "SIN_CORREO" }
```

### `POST /obras/:idObra/enlace-portal/reenviar` — RF-65

- Rol: `DUENO`. Manda el mismo enlace permanente al `correoCliente` actual (lo crea si la obra no
  tenía). Si el correo cambió desde el último envío, rota el token (P-12).
- 200 `{ "enlacePortal": "ENVIADO" }` · 400 la obra no tiene correo del cliente · 503 correo sin
  configurar o falló.

### `POST /obras/:idObra/entregas` — RF-13, D-29

- Rol: supervisor de la obra o dueño (`exigirSupervisorODueno`).
- Cuerpo: `{ "fechaInicio": "2026-11-01", "fechaFin": "2026-11-05" }`.
- 201:

```json
{
  "id": "…",
  "estado": "ENVIADA",
  "fechaInicio": "2026-11-01",
  "fechaFin": "2026-11-05",
  "enviadaEn": "2026-11-05T18:20:00.000Z",
  "actividades": 3,
  "fotos": 8,
  "enlacePortal": "ENVIADO" | "FALLIDO"
}
```

- 400 `motivo: "SIN_CORREO_CLIENTE"` · 400 `motivo: "SIN_FOTOS_APROBADAS"` (también si todas ya
  estaban en otra entrega, P-15) · 403 sin permiso · 404 obra de otra empresa.
- Si el correo falla, la entrega **sí** queda creada y publicada en el portal; la app avisa y
  permite "Reenviar enlace".

### `GET /obras/:idObra/entregas` — FR-019

- Roles: dueño, supervisor de la obra. 200: lista ordenada por `enviadaEn` descendente:

```json
[
  {
    "id": "…",
    "estado": "ACEPTADA",
    "fechaInicio": "…",
    "fechaFin": "…",
    "enviadaEn": "…",
    "enviadaPor": "Luis Gómez",
    "actividades": 3,
    "fotos": 8,
    "nombreCliente": "María Fernanda López Ruiz",
    "observaciones": null,
    "respondidaEn": "…",
    "tieneActa": true
  }
]
```

### `GET /obras/:idObra/entregas/:idEntrega/reporte.pdf` — RF-12, RF-71

- Dueño o supervisor de la obra. 200 `application/pdf`. El mismo archivo que descarga el cliente.

### `GET /obras/:idObra/entregas/:idEntrega/acta.pdf` — RF-16

- Dueño o supervisor de la obra. GET para descargarla directo a un archivo en la app. Genera el
  acta la primera vez y después devuelve el mismo archivo:
  200 `application/pdf`. 409 `motivo: "ENTREGA_NO_ACEPTADA"` si no está Aceptada.

### Bloqueo — RF-17

`PATCH /obras/:idObra/actividades/:idActividad/estado`, `POST …/avances` y `PATCH …/avances/:id/revision`
responden 409 `motivo: "ENTREGA_ACEPTADA"` si la actividad está en una entrega Aceptada.
`GET /obras/:idObra/actividades/:idActividad` agrega `"bloqueada": boolean`.

## B. Rutas públicas del portal (sin JWT)

Encabezado obligatorio: `X-Token-Portal: <token>`. Token inválido o revocado: 404
`{ "mensaje": "Este enlace no es válido. Pide uno nuevo a tu supervisor." }`. Límite: 30
peticiones por minuto por IP. CORS solo para `URL_PORTAL`.

### `GET /portal/obra` — RF-65

```json
{
  "nombre": "Hospital",
  "cliente": "…",
  "direccion": "…",
  "fechaInicio": "…",
  "fechaFinal": "…",
  "empresa": { "nombre": "…", "tieneLogo": true }
}
```

### `GET /portal/avances` — RF-66

Actividades de la obra con su estado y **solo** fotos `APROBADO`, ordenadas por fecha:

```json
[
  {
    "id": "…",
    "nombre": "Pisos y puertas",
    "estado": "TERMINADA",
    "fechaEntrega": "…",
    "fechaTerminada": "…",
    "fotos": [{ "id": "…", "comentario": "…", "fechaRegistro": "…", "ubicacion": null }]
  }
]
```

Sin fotos aprobadas: `[]` y el portal muestra "Aún no hay avances registrados".

### `GET /portal/fotos/:idAvance` — RF-66

`image/jpeg` o `image/png`. 404 si el avance no es `APROBADO` o no es de la obra del enlace.

### `GET /portal/entregas` — RF-67

```json
[
  {
    "id": "…",
    "estado": "ENVIADA",
    "fechaInicio": "…",
    "fechaFin": "…",
    "enviadaEn": "…",
    "actividades": 3,
    "fotos": 8,
    "respondidaEn": null
  }
]
```

### `GET /portal/entregas/:idEntrega` — RF-67

Detalle con la copia fija (actividades y fotos de la entrega), y si ya se respondió: `nombreCliente`,
`observaciones`, `respondidaEn`, `tieneActa`. Las fotos se piden con `/portal/fotos/:idAvance`; la
firma con `/portal/entregas/:idEntrega/firma` (`image/png`).

### `POST /portal/entregas/:idEntrega/codigo` — RF-14

- Envía el código al correo de la obra. 202 `{ "correo": "m***@gmail.com", "venceEn": "…" }`
  (correo enmascarado).
- 409 si la entrega no está Enviada · 429 si se pidió otro hace menos de 60 s.

### `POST /portal/entregas/:idEntrega/codigo/comprobar` — RF-14

- Cuerpo `{ "codigo": "123456" }`. 200 `{ "valido": true }` para mostrar "✓ Código verificado"
  antes de firmar (`2271:118`). No gasta el código; los fallos cuentan para los 5 intentos.

### `POST /portal/entregas/:idEntrega/aceptar` — RF-14, RF-60

- `bodyLimit` 1 MB. Cuerpo: `{ "codigo": "123456", "nombre": "…", "firmaPng": "<base64>" }`.
- 200: la entrega con `estado: "ACEPTADA"`, `nombreCliente`, `respondidaEn`, `tieneActa: true`.
- 400 `motivo: "CODIGO_INCORRECTO"` con `intentosRestantes` · 400 `motivo: "CODIGO_VENCIDO"` ·
  400 `motivo: "FIRMA_INVALIDA"` (vacía, no PNG o > 512 KB) · 409 ya respondida.

### `POST /portal/entregas/:idEntrega/observaciones` — RF-15

- `bodyLimit` 1 MB. Cuerpo: `{ "observaciones": "…", "nombre": "…", "firmaPng": "<base64>" }`.
- 200 con `estado: "CON_OBSERVACIONES"` · 400 sin texto (`"Escribe qué debe corregirse"`) ·
  409 ya respondida. No pide código (P-11).

### `GET /portal/entregas/:idEntrega/reporte.pdf` y `GET /portal/entregas/:idEntrega/acta.pdf` — RF-71

- `application/pdf`. El acta responde 409 `motivo: "ENTREGA_NO_ACEPTADA"` con el mensaje "El acta se
  genera al aceptar la entrega".

## C. Correos

| Cuándo                     | Asunto                                     | Contenido                               |
| -------------------------- | ------------------------------------------ | --------------------------------------- |
| Obra registrada / reenviar | "Sigue el avance de {obra}"                | Enlace `https://<portal>/#/o/<token>`   |
| Entrega enviada            | "Nueva entrega de {obra} para tu revisión" | Periodo, número de actividades y enlace |
| Código de aceptación       | "Tu código de Civil Trace: 123456"         | Código y vigencia de 10 minutos         |

Los textos dicen "aceptación" o "constancia", nunca "firma electrónica" (constitución IV.5).
