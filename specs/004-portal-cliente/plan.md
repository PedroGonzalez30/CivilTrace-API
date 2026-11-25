# Implementation Plan: Portal web del cliente y entregas

**Branch**: `004-portal-cliente` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-portal-cliente/spec.md`

**Requerimientos (SRS v5.0, D-28)**: `RF-13 Enviar entrega al cliente`, `RF-14 Registrar aceptación de entrega`, `RF-15 Registrar observaciones del cliente`, `RF-16 Generar acta de entrega-recepción`, `RF-17 Bloquear entrega aceptada`, `RF-60 Firmar aceptación de entrega`, `RF-65 Enviar enlace del portal al cliente`, `RF-66 Consultar avances en el portal del cliente`, `RF-67 Consultar entregas en el portal del cliente`, `RF-71 Descargar documentos de una entrega en el portal`.

**Alcance de este plan**: los tres repositorios, en este orden (constitución VI.2): **API** (este repo), **app** (`CivilTrace`) y **portal** (`CivilTrace-Portal`, nuevo, T-02). Todos usan el [contrato](./contracts/portal-api.md).

## Summary

- **API**: enlace permanente por obra que se envía al registrarla; entregas por rango de fechas con
  copia fija de las fotos aprobadas (D-29); rutas públicas `/portal/*` con el token del enlace;
  código de un solo uso; firma PNG con SHA-256; reporte y acta en PDF generados en el servidor y
  guardados en Blob Storage; bloqueo de actividades de entregas aceptadas.
- **App**: "Enviar al cliente" en el reporte, lista de entregas con su estado, "Generar acta",
  aviso del enlace al registrar la obra y "Reenviar enlace", y actividades bloqueadas sin botones
  de edición.
- **Portal**: React + Vite. Avances, Entregas, aceptar con código y firma, registrar observaciones
  con firma, "Reporte aceptado" y descargas. Primero para celular (412 px), como en el Figma.

Detalle en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript estricto. API en Node 24 (módulos ES); app en Expo SDK 58 / React Native 0.88; portal en React 19 + Vite.

**Primary Dependencies**:

- API (nuevas, **requieren aprobación**, R-01, R-02, R-09): `pdfkit` (PDF), `@azure/communication-email` (correo), `@fastify/cors` (CORS del portal). El resto con `node:crypto` (token, AES-256-GCM, HMAC, SHA-256).
- App: ninguna nueva (`expo-file-system` y `expo-sharing` ya están para descargar y compartir el PDF).
- Portal: `react`, `react-dom`, `react-router` (modo hash); desarrollo: `vite`, `vitest`, `@testing-library/react`, `@playwright/test`, ESLint y Prettier.

**Storage**: PostgreSQL 17 con 4 tablas nuevas y ninguna columna existente cambiada ([data-model.md](./data-model.md)); migración `portal_cliente_entregas`. Firmas, reportes y actas en Blob Storage privado (carpetas `firmas/`, `entregas/`).

**Testing**: API con Vitest + `app.inject()` contra PostgreSQL de pruebas, doble de almacenamiento (ya existe) y doble de correo nuevo. App con jest-expo + Testing Library. Portal con Vitest + Testing Library y Playwright (aceptar y observar contra una API simulada con `page.route`).

**Target Platform**: API en Azure App Service B1 (`civiltrace-api`); portal en Azure Static Web Apps Free; app con Expo Go en Android e iOS.

**Project Type**: API REST + app móvil + sitio web estático.

**Performance Goals**: listas del portal en menos de 1 s; un acta de 10 actividades y 30 fotos en menos de 5 s la primera vez (después se lee del almacenamiento); SC-001 (aceptar en menos de 3 minutos).

**Constraints**:

- Sin JWT en el portal: todo se autoriza con el token del enlace y se filtra por `obraId` y `empresaId`.
- El token va en el fragmento (`#`) de la dirección y se manda en `X-Token-Portal` (R-03).
- Correo y PDF fuera de la transacción: si el correo falla, la obra o la entrega quedan guardadas y se avisa.
- Plan B1: `pdfkit` en el proceso de la API, con las fotos redimensionadas solo si pesan más de lo que permite `TAMANO_MAX_EVIDENCIA_MB` (5 MB).

**Scale/Scope**: hasta ~10 obras por empresa, una entrega por semana por obra, actas de hasta ~50 fotos.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principio                 | Cómo lo cumple este plan                                                                                                                                                                                                                                                         | Estado      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **I. El Figma manda**     | Las 10 pantallas están citadas por `node-id`. Falta en el Figma la vista de Avances del portal (RF-66): se arma con los componentes existentes y queda en P-14 para que el equipo la apruebe.                                                                                    | ⚠️ P-14     |
| **I.3–I.4 SRS**           | La constitución nombra el **SRS V4.0**; el usuario decidió usar el **v5.0** desde este feature (D-28). Se propone en este PR la enmienda **1.1.0** (MINOR) de I.3 e I.4 para citar el v5.0; requiere aprobación del equipo (ver Complexity Tracking).                            | ⚠️ Enmienda |
| **II. ECCT v1.0**         | Mismo patrón de archivos (`rutasPortal.ts`, `servicioEntregas.ts`, `servicioCorreo.ts`, `servicioPdf.ts`, `esquemasPortal.ts`, `constantes/portal.ts`); el portal usa las mismas reglas de ESLint y Prettier, encabezado y secciones numeradas.                                  | ✅          |
| **III. Pruebas primero**  | Pruebas en rojo antes de cada servicio, con claves provisionales `CP16-*` y `CP17-*` (R-12, P-10). Dobles de correo y almacenamiento; Playwright para aceptar y observar en el portal (III.3). Cobertura 80 % en servicios nuevos, 60 % en app y portal.                         | ✅          |
| **IV. Seguridad y datos** | Token de 256 bits (hash + cifrado AES-GCM), código de 6 dígitos con HMAC, 10 min y 5 intentos (IV.3); firmas y PDF en Blob privado con SHA-256 (IV.4); textos sin "firma electrónica" (IV.5); entregas respondidas no se borran (IV.6); aviso de privacidad en el portal (IV.7). | ✅          |
| **V. Azure**              | Recursos nuevos: Azure Communication Services + dominio administrado, Static Web Apps Free y el secreto `CLAVE_CIFRADO_PORTAL` en Key Vault. Se describen en Terraform (`infra/`) y **no se aplican** sin aprobación; el plan no toca recursos existentes.                       | ⚠️ Aprobar  |
| **VI. Forma de trabajar** | API primero, luego app y portal; una rama `004-portal-cliente` por repo y PR revisado; migración con nombre descriptivo; dudas registradas (P-10 a P-17).                                                                                                                        | ✅          |

**Resultado**: pasa con tres puntos que necesitan al equipo (P-14, enmienda de la constitución y recursos de Azure). Ninguno bloquea empezar la API con dobles de correo y almacenamiento.

**Revisión después del diseño (fase 1)**: el modelo solo agrega tablas; las rutas públicas filtran por obra y empresa; las tres dependencias nuevas están justificadas en research. Sigue pasando con los mismos tres puntos.

## Project Structure

### Documentation (this feature)

```text
specs/004-portal-cliente/
├── spec.md
├── plan.md              # Este archivo
├── research.md          # R-01 a R-12
├── data-model.md
├── quickstart.md
├── contracts/
│   └── portal-api.md
└── tasks.md             # Lo crea /speckit-tasks
```

### Source Code

```text
CivilTrace-API/
├── prisma/schema.prisma + migrations/<fecha>_portal_cliente_entregas/
├── src/
│   ├── constantes/portal.ts
│   ├── esquemas/esquemasEntregas.ts, esquemasPortal.ts
│   ├── middleware/tokenPortal.ts            # verificarTokenPortal (X-Token-Portal)
│   ├── rutas/rutasEntregas.ts               # /obras/:idObra/entregas, enlace-portal
│   ├── rutas/rutasPortal.ts                 # /portal/*
│   ├── servicios/servicioEnlacePortal.ts    # crear, cifrar, reenviar, rotar
│   ├── servicios/servicioEntregas.ts        # enviar, listar, responder, bloqueo
│   ├── servicios/servicioCodigoEntrega.ts
│   ├── servicios/servicioCorreo.ts          # Azure Communication Services
│   ├── servicios/servicioPdf.ts             # reporte y acta con pdfkit
│   └── utilidades/cifrado.ts                # AES-256-GCM y HMAC
├── pruebas/configuracion/dobleCorreo.ts
├── pruebas/integracion/enlacePortal.test.ts, entregas.test.ts, portalCliente.test.ts,
│   aceptacionEntrega.test.ts, actaEntrega.test.ts, bloqueoEntrega.test.ts
└── infra/                                    # Terraform: comunicacion.tf, portal.tf (sin aplicar)

CivilTrace/ (app)
├── src/servicios/servicioEntregas.ts
├── src/tipos/entrega.ts
├── src/componentes/TarjetaEntrega.tsx, ModalEnviarCliente.tsx
├── src/pantallas/dueno/PantallaReportesObra.tsx   # cambia: Enviar al cliente, entregas, acta
├── src/pantallas/dueno/PantallaAgregarObra.tsx    # cambia: aviso del enlace
├── src/pantallas/dueno/PantallaDetalleObra.tsx    # cambia: Reenviar enlace al cliente
└── __tests__/servicioEntregas-test.ts, PantallaReportesObra-test.tsx, ...

CivilTrace-Portal/ (nuevo)
├── src/main.tsx, App.tsx, rutas.tsx
├── src/conexion/clientePortal.ts         # fetch con X-Token-Portal, errores en español
├── src/pantallas/PantallaObra.tsx         # pestañas Avances / Entregas
├── src/pantallas/PantallaEntrega.tsx      # CLIENTE_Abrir enlace / detalle
├── src/pantallas/PantallaFirmar.tsx       # CLIENTE_FirmarAceptacion y CLIENTE_FirmarRechazo
├── src/pantallas/PantallaReporteAceptado.tsx
├── src/componentes/LienzoFirma.tsx, ModalCodigo.tsx, ModalObservaciones.tsx, TarjetaEntrega.tsx
├── src/estilos/tema.css                   # colores y Poppins del Figma
├── pruebas/ (Vitest) y e2e/ (Playwright)
├── staticwebapp.config.json               # encabezados de seguridad
└── .github/workflows/portal.yml
```

**Structure Decision**: tres proyectos independientes que comparten el contrato. La API conserva su estructura por capas (rutas → servicios); el portal es una SPA estática sin servidor propio.

## Fases de trabajo (resumen para `tasks.md`)

1. **Preparación**: dependencias aprobadas, variables de entorno (`URL_PORTAL`, `CLAVE_CIFRADO_PORTAL`, `AZURE_COMUNICACION_ENDPOINT`, `CORREO_REMITENTE`, `CORREO_EN_CONSOLA`), doble de correo, migración.
2. **API P1**: enlace (historia 1) → avances del portal (historia 2) → enviar entrega (historia 3) → aceptar (historia 4) → acta, descargas y bloqueo (historia 6).
3. **API P2**: observaciones (historia 5) y lista de entregas para la app (historia 5 de la app).
4. **App**: enviar, lista de entregas, acta, aviso y reenvío del enlace, bloqueo.
5. **Portal**: proyecto base, Avances, Entregas, código, firma, observaciones, aceptado, descargas, Playwright, Static Web Apps.
6. **Infra** (sin aplicar): Terraform de Communication Services y Static Web Apps; `terraform plan` sin `destroy`/`replace`.

## Pendientes que afectan el plan

- **P-10** claves del plan de pruebas · **P-11** código para observar (no) · **P-12** rotar si cambia el correo (sí) · **P-14** vista de Avances en el Figma · **P-15** foto en una sola entrega activa (sí) · **P-16** ubicación de las fotos no se guarda (R-11).
- **Aprobaciones**: `pdfkit`, `@azure/communication-email`, `@fastify/cors`; recursos de Azure; enmienda 1.1.0 de la constitución.

## Complexity Tracking

| Violación o desviación                                 | Por qué hace falta                                                             | Alternativa más simple descartada porque                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Constitución I.3–I.4 citan el SRS V4.0; se usa el v5.0 | La V4.0 quitó el portal, que el equipo mantiene (D-28)                         | Seguir la V4.0 obligaría a firmar en el teléfono del supervisor, contra el Figma |
| Tres dependencias nuevas en la API                     | PDF idéntico para portal y app; correo de Azure (T-03); CORS para otro dominio | Generar PDF en la app no sirve al portal; CORS a mano es propenso a errores      |
| Recursos nuevos de Azure                               | El correo y el portal no existen hoy                                           | Un servicio de correo externo contradice T-03                                    |
| Vista de Avances sin diseño en el Figma                | RF-66 es Must                                                                  | Omitirla incumple el SRS v5.0                                                    |
