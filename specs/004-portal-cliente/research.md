# Research: Portal web del cliente y entregas (feature 004)

**Fecha**: 24/11/2026 · **Autor**: Emilio Manuel Esquivel · **Spec**: [spec.md](./spec.md)

Cada decisión trae su razón y las alternativas que se descartaron. Las que necesitan aprobación del
equipo están marcadas con **(aprobar)**.

## R-01 Dónde se generan los PDF (reporte de la entrega y acta)

- **Decisión**: en la API, con `pdfkit` **(aprobar: dependencia nueva de producción)**.
- **Razón**: el cliente (portal) y el supervisor o el dueño (app) deben descargar **el mismo
  archivo** (RF-16, RF-71). `pdfkit` es JavaScript puro, no necesita navegador y acepta las fotos
  JPEG y la firma PNG directamente. El archivo se guarda en Blob Storage privado la primera vez y
  las siguientes descargas lo leen de ahí, así que siempre es idéntico.
- **Alternativas**: `expo-print` en la app (ya existe para el reporte, pero el portal no puede usarlo
  y saldrían dos archivos distintos); Puppeteer o Playwright en el servidor (necesita Chromium, no
  cabe bien en el plan B1); `pdf-lib` (más bajo nivel: hay que acomodar el texto a mano).

## R-02 Envío de correo

- **Decisión**: `@azure/communication-email` con Azure Communication Services y un dominio
  administrado por Azure (T-03) **(aprobar: dependencia y recurso de Azure nuevos)**. La API se
  autentica con su identidad administrada (`DefaultAzureCredential`), igual que con Blob Storage.
- **Interfaz propia**: `servicioCorreo.enviarCorreo({ para, asunto, texto, html })`. En las pruebas
  se sustituye con `pruebas/configuracion/dobleCorreo.ts`, que guarda los mensajes en memoria para
  leer el enlace y el código (constitución III.5).
- **Sin configuración** (`AZURE_COMUNICACION_ENDPOINT` vacío): igual que el almacenamiento, el envío
  responde 503 y el resto de la API funciona. En desarrollo local se puede activar
  `CORREO_EN_CONSOLA=true` para ver el enlace y el código en la consola.
- **Alternativas**: SendGrid o Resend (otra cuenta y otra llave fuera de Azure; contradice T-03);
  SMTP de Gmail (límites y contraseñas de aplicación).

## R-03 Enlace permanente por obra (RF-65)

- **Decisión**: token aleatorio de 32 bytes (`randomBytes`, 256 bits) en base64url; en la base solo
  se guarda su SHA-256 (`calcularHashToken`, ya existe en `utilidades/tokens.ts`). Un enlace por
  obra, tabla `EnlacePortal`.
- **Dónde va el token**: en el **fragmento** de la dirección del portal
  (`https://<portal>/#/o/<token>`). El fragmento no se envía al servidor de archivos estáticos ni
  aparece en el encabezado `Referer`, así que no queda en registros de terceros. El portal lo manda
  a la API en el encabezado `X-Token-Portal`.
- **Reenviar y avisos**: el enlace debe ser **permanente** y cada correo (registro de la obra,
  cada entrega, reenvío) debe llevar el mismo. Por eso, además del hash para buscarlo, se guarda el
  token **cifrado** con AES-256-GCM (`node:crypto`) y una llave `CLAVE_CIFRADO_PORTAL` de 32 bytes
  que vive en `.env` y en Key Vault (constitución IV.1). Si se filtra la base sin la llave, los
  tokens no se pueden usar.
- **Rotar**: solo cuando cambia el correo del cliente de la obra (P-12) se crea un token nuevo y el
  anterior deja de funcionar, para que la persona del correo viejo pierda el acceso.
- **Alternativas**: solo hash y rotar en cada correo (cada correo nuevo rompería el enlace de los
  anteriores, contradice "permanente"); un token por entrega (el SRS v5.0 pide uno por obra).

## R-04 Código de un solo uso para aceptar (RF-14)

- **Decisión**: 6 dígitos con `randomInt(0, 1_000_000)`, guardado como HMAC-SHA256 con una llave
  derivada de `JWT_SECRETO`; vence en 10 minutos; máximo 5 intentos; uno por minuto por entrega
  (constitución IV.3). Pedir uno nuevo invalida el anterior.
- **Razón**: con solo un millón de combinaciones, un SHA-256 simple se rompe por fuerza bruta si se
  filtra la base; el HMAC con llave secreta lo evita sin el costo de argon2 en cada intento.
- **Alternativas**: argon2 (lento sin necesidad, el límite de 5 intentos ya protege en línea);
  enlace mágico de un clic (el Figma pide escribir el código).

## R-05 Firma

- **Decisión**: el portal dibuja en un `<canvas>` con Pointer Events (dedo, lápiz o ratón) y la manda
  como PNG en base64 dentro del JSON de aceptar u observar. La API valida que sea PNG (firma de
  bytes), de máximo 512 KB, y la guarda en Blob Storage privado con su SHA-256 (D-04).
- **Límite de cuerpo**: la ruta sube su `bodyLimit` a 1 MB solo para esas dos rutas (la API usa
  100 KB por defecto).
- **Alternativas**: `signature_pad` (dependencia extra para algo de ~80 líneas); SVG (más difícil de
  meter en el PDF).

## R-06 Copia fija de la entrega (P-15, D-29)

- **Decisión**: al enviar, la API busca los avances `APROBADO` de la obra con `fechaRegistro` dentro
  del rango (en la zona horaria de la empresa) que **no** estén en otra entrega `ENVIADA` o
  `ACEPTADA`. Guarda una fila por actividad (`EntregaActividad`, con nombre, estado y fechas
  copiados) y una por avance (`EntregaAvance`, con el id del avance y su comentario copiado).
- **Razón**: los avances aprobados no se borran (constitución IV.6) y RF-17 bloquea su edición una
  vez aceptados, así que basta con referenciarlos; los datos de la actividad sí pueden cambiar
  mientras la entrega está Enviada, por eso se copian.
- **Alternativas**: guardar todo el reporte como JSON (difícil de consultar y de bloquear); generar
  el PDF al enviar y nada más (el portal necesita los datos para mostrarlos, no solo el archivo).

## R-07 Bloqueo de entregas aceptadas (RF-17)

- **Decisión**: una función `exigirActividadNoBloqueada(actividadId)` en los servicios que
  modifican actividades o avances (`actualizarEstadoActividad`, `registrarAvanceActividad`,
  `revisarAvance`). Responde 409 "La actividad forma parte de una entrega aceptada". La consulta de
  actividad devuelve `bloqueada: true` para que la app oculte los botones.
- **Alternativas**: un trigger en PostgreSQL (difícil de probar y de explicar en el PR).

## R-08 Portal: repositorio `CivilTrace-Portal`

- **Decisión**: React 19 + Vite + TypeScript estricto (T-02), React Router en modo hash (por el
  token en el fragmento), CSS Modules con los colores y la fuente Poppins del Figma, sin librería de
  componentes. Pruebas con Vitest + Testing Library y Playwright para aceptar y rechazar
  (constitución III.3). ESLint + Prettier con las mismas reglas del ECCT.
- **Publicación**: Azure Static Web Apps nivel Free, con GitHub Actions **(aprobar: recurso nuevo)**.
  Encabezados: `Referrer-Policy: no-referrer` y una CSP que solo permite la API.
- **Alternativas**: Next.js (servidor innecesario); que la API sirva el portal (mezcla
  responsabilidades y el plan B1 es pequeño).

## R-09 Rutas públicas del portal en la API

- **Decisión**: prefijo `/portal`, sin JWT; un `preHandler` `verificarTokenPortal` lee
  `X-Token-Portal`, busca el hash y deja en la petición `obraId` y `empresaId`. Todas las consultas
  filtran por esos dos valores; si una entrega o foto no pertenece a la obra del enlace, 404.
- **Límite de peticiones** propio: 30 por minuto por IP en `/portal` y 5 por minuto para pedir
  código. CORS solo para la dirección del portal (`URL_PORTAL`) con `@fastify/cors`
  **(aprobar: dependencia nueva)**.
- **Fotos y firma en el portal**: se sirven a través de la API (`GET /portal/fotos/:avanceId`) con
  el mismo token, como ya hace la app (T-09). Como una etiqueta `<img>` no puede mandar el
  encabezado, el portal las descarga con `fetch` y crea un `blob:` local.

## R-10 Correo al registrar la obra (RF-65)

- **Decisión**: `crearObra` crea el enlace dentro de la misma transacción; el correo se envía
  **después** de guardar. Si falla, la obra queda guardada y la respuesta trae
  `enlacePortal: 'ENVIADO' | 'FALLIDO' | 'SIN_CORREO'`; la app lo avisa y el dueño puede reenviar.
- **Obras anteriores**: no tienen enlace. Lo reciben con "Reenviar enlace" o con su primera entrega.

## R-11 Ubicación de las fotos (RF-66 y RF-12 piden "ubicación")

- **Hallazgo**: `AvanceActividad` no guarda ubicación; la app no la captura hoy (es parte de RF-08,
  feature anterior). **No se resuelve en este feature**: el portal y los PDF muestran fecha y hora, y
  la ubicación cuando exista. Se registra como **P-16**.

## R-12 Plan de pruebas

- Mientras no se resuelva P-10, las pruebas usan claves provisionales por historia: `CP16-PORTAL-*`
  (enlace y portal), `CP16-E*` (enviar entrega) y `CP17-E*` (aceptar, observar, acta, bloqueo), con
  el número de escenario de la spec. Se renombran cuando el equipo mapee el plan al v5.0.
