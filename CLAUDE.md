# CivilTrace-API — instrucciones para Claude Code

API de Civil Trace: registra obras, actividades, evidencias fotográficas, asistencia, reportes y la
aceptación del cliente. La usan la app móvil (dueño, supervisor, trabajador) y la página web del cliente.

Antes de cualquier trabajo lee:

- `.specify/memory/constitution.md` (principios obligatorios: estándar ECCT, pruebas, seguridad, Azure).
- `docs/decisiones.md` (decisiones ya tomadas; no las vuelvas a preguntar).

## Stack (no cambiar sin aprobación del equipo)

- Node 24, TypeScript estricto, módulos ES, alias `@/` → `src/`.
- Fastify 5 con `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/jwt` (acceso + refresco con rotación).
- Prisma 7 (`prisma-client`, salida en `src/generated/prisma`, adaptador `@prisma/adapter-pg`) + PostgreSQL 17.
- zod 4 para validar entrada y variables de entorno (`src/configuracion/entorno.ts`).
- argon2 para contraseñas. `@azure/storage-blob` + `@azure/identity` para fotos, logos y firmas.
- Feature 004 (P-17): `pdfkit` (reporte y acta en PDF), `@azure/communication-email` (correo con la
  identidad administrada) y `@fastify/cors` (solo para el origen `URL_PORTAL`).

## Estructura

```
src/
  app.ts, servidor.ts       Arranque y registro de plugins/rutas
  configuracion/            entorno.ts (zod)
  rutas/                    Una por recurso; solo validan, autorizan y llaman servicios
  servicios/                Lógica de negocio y acceso a datos (Prisma)
  esquemas/                 Esquemas zod de entrada y salida
  middleware/               autenticacion.ts (verificarToken, exigirRol); tokenPortal.ts
                            (verificarTokenPortal: rutas /portal con el encabezado X-Token-Portal)
  utilidades/, constantes/, tipos/, baseDatos/
prisma/                     schema.prisma y migraciones
infra/                      Terraform: hoy solo los recursos nuevos del feature 004 (ver infra/README.md);
                            los existentes se leen con data, todavía no se importan
pruebas/                    Pruebas Vitest (unidad, integración y configuración)
herramientas/lint/          ESLint aislado (decisión T-07)
specs/                      Especificaciones de Spec Kit por feature
```

## Comandos

```bash
docker compose up -d                       # PostgreSQL local (desarrollo) y de pruebas (puerto 5434, en memoria)
npm install                                # también instala ESLint en herramientas/lint (postinstall)
npx prisma migrate dev --name <nombre> --config prisma7.config.ts   # nueva migración (nombre en español)
npx prisma generate --config prisma7.config.ts                       # después de cambiar el esquema
npm run dev                                # API local con recarga
npm run typecheck && npm run lint && npm test   # obligatorio antes de terminar una tarea
npm run test:cobertura                     # cobertura; 80 % de líneas por servicio con pruebas
npm run formatear                          # Prettier (verificar con npm run verificar-formato)
```

- **Pruebas**: Vitest en `pruebas/` (`unidad/`, `integracion/`, `configuracion/`). Usan
  `DATABASE_URL_PRUEBAS` (ver `.env.example`), nunca la base de desarrollo; se preparan con
  `prisma migrate deploy` y se vacían con `limpiarTablas()`. No uses `prisma migrate reset`.
  Fábricas de datos en `pruebas/configuracion/fabricas.ts`; el almacenamiento y el correo son dobles
  en memoria (`dobleAlmacenamiento.ts`, `dobleCorreo.ts`: lee el enlace y el código de los correos).
- **Portal del cliente (local)**: en `.env` pon `URL_PORTAL`, `CLAVE_CIFRADO_PORTAL` (32 bytes en
  base64) y `CORREO_EN_CONSOLA=true`: los correos con el enlace y el código salen en la consola.
  Sin `AZURE_STORAGE_CUENTA`, en desarrollo las fotos se guardan en `almacenamiento-local/` (D-32).
- **Lint**: ESLint vive en `herramientas/lint/` porque TypeScript 7 no trae la API de JavaScript que
  usa `typescript-eslint` (decisión T-07).
- **Cobertura pendiente**: los servicios anteriores al módulo 00 (autenticación, obras, empresa,
  actividades, reportes, almacenamiento) aún no tienen pruebas; al agregarlas, súmalos a los umbrales
  de `vitest.config.ts`.

## Reglas

- Cada ruta: esquema zod, `verificarToken`, `exigirRol` cuando aplique y filtro por `empresaId` del
  token. Nunca devuelvas datos de otra empresa. Las rutas públicas del portal del cliente se validan con
  el token del enlace, no con JWT.
- Errores con `ErrorHttp` y mensajes en español. No expongas trazas ni datos internos.
- Fotos, logos y firmas en contenedores privados; nunca URLs públicas permanentes.
- No borres registros de evidencia, entregas aceptadas ni asistencia: usa estados e historial.
- La ruta `/almacenamiento-prueba` es de prueba: debe quedar deshabilitada cuando `NODE_ENV=production`.
- Secretos solo en `.env` (local) y Key Vault (Azure). Si ves un secreto en el código o en un archivo
  versionado, detente y avisa.
- Pruebas con Vitest y `app.inject()`; nombre con la clave del plan de pruebas (`CP14-E2 ...`).
  Almacenamiento y correo se sustituyen con dobles en las pruebas.

## Azure

- Suscripción "Azure for Students", grupo `rg-civiltrace`. API en `civiltrace-api` (West US, plan B1),
  base `civiltrace-bd3` (Canada Central), almacenamiento `civiltracestorage`.
- Despliegue: `.github/workflows/main_civiltrace-api.yml` (OIDC) al hacer push a `main`.
- Cambios de infraestructura solo con Terraform en `infra/`. Nunca apliques un plan que destruya o
  reemplace recursos existentes; muéstralo y pregunta.
- Comandos `az` que modifiquen recursos: explica qué harán y espera aprobación.

## Figma

Archivo `EIXrnioyKFd9EoBY5PINOV`. Cada especificación trae los `node-id` de sus pantallas; úsalos para
entender qué datos necesita cada pantalla y diseñar los contratos de la API.
