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

## Estructura

```
src/
  app.ts, servidor.ts       Arranque y registro de plugins/rutas
  configuracion/            entorno.ts (zod)
  rutas/                    Una por recurso; solo validan, autorizan y llaman servicios
  servicios/                Lógica de negocio y acceso a datos (Prisma)
  esquemas/                 Esquemas zod de entrada y salida
  middleware/               autenticacion.ts (verificarToken, exigirRol)
  utilidades/, constantes/, tipos/, baseDatos/
prisma/                     schema.prisma y migraciones
infra/                      Terraform (se crea en el módulo 00)
pruebas/                    Pruebas (se crea en el módulo 00)
```

## Comandos

```bash
docker compose up -d                       # PostgreSQL local
npm install
npx prisma migrate dev --name <nombre>     # nueva migración (nombre descriptivo en español)
npm run dev                                # API local con recarga
npm run typecheck && npm run lint && npm test   # obligatorio antes de terminar una tarea
npm run formatear
```

`npm run lint` y `npm test` se agregan en el módulo 00. Si no existen todavía, ese es el primer trabajo.

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
