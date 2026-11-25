# Quickstart: validar el feature 004 (portal del cliente y entregas)

**Fecha**: 24/11/2026 · Contrato: [contracts/portal-api.md](./contracts/portal-api.md) · Datos:
[data-model.md](./data-model.md)

## 1. Requisitos

- Docker Desktop encendido; Node 24.
- Repos en la rama `004-portal-cliente`: `CivilTrace-API`, `CivilTrace` y `CivilTrace-Portal`.
- `.env` de la API con las variables nuevas (ver `.env.example`):
  - `URL_PORTAL=http://localhost:5173`
  - `CLAVE_CIFRADO_PORTAL=<32 bytes en base64>` (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
  - `CORREO_EN_CONSOLA=true` (en local el enlace y el código salen en la consola de la API; no
    hace falta Azure Communication Services).

## 2. Pruebas automáticas

```bash
# API
cd CivilTrace-API
docker compose up -d
npx prisma migrate deploy --config prisma7.config.ts
npm run typecheck && npm run lint && npm test

# App
cd ../CivilTrace
npm run typecheck && npm run lint && npx jest --maxWorkers=2

# Portal
cd ../CivilTrace-Portal
npm install
npm run typecheck && npm run lint && npm test
npx playwright install chromium && npm run test:e2e
```

Esperado: todo en verde. Las pruebas de la API con clave `CP16-*` y `CP17-*` cubren cada escenario
de la spec; Playwright cubre aceptar y registrar observaciones de punta a punta.

## 3. Recorrido manual

1. API: `npm run dev`. Portal: `npm run dev` (abre `http://localhost:5173`).
2. App (Expo Go, dueño): registrar una obra con un correo de cliente.
   - **Esperado**: la consola de la API muestra el correo con el enlace `…/#/o/<token>`.
3. Abrir ese enlace en el navegador del celular o de la computadora.
   - **Esperado**: portal de la obra; "Aún no hay avances registrados".
4. App (supervisor y trabajador): crear una actividad, subir fotos, aprobar unas y rechazar otra;
   aprobar el "Terminado".
   - **Esperado**: en el portal, la actividad con estado y solo las fotos aprobadas (RF-66).
5. App (supervisor): Reportes → filtrar un rango → "Enviar al cliente".
   - **Esperado**: "Se envió al cliente"; en el portal, Entregas muestra la entrega Enviada (RF-13,
     RF-67); la consola muestra el aviso por correo.
6. Portal: abrir la entrega → "Aceptar" → copiar el código de la consola → nombre → firmar →
   "Firmar y aceptar".
   - **Esperado**: "Reporte aceptado" con nombre, fecha, hora y firma; "Descargar acta (PDF)" y el
     reporte descargan (RF-14, RF-60, RF-71).
7. App: la entrega aparece Aceptada; "Generar acta" descarga el **mismo** PDF (RF-16). Intentar
   subir una foto a esa actividad → mensaje de entrega aceptada (RF-17).
8. Repetir 5–6 con otro rango y elegir "Rechazar": comentario, nombre y firma.
   - **Esperado**: la entrega queda Con observaciones y el supervisor ve el comentario (RF-15).

## 4. Casos de error a revisar a mano

- Enlace con un carácter cambiado → "Este enlace no es válido".
- Código incorrecto 5 veces → hay que pedir otro.
- Firmar sin dibujar → el botón sigue desactivado.
- Rango sin fotos aprobadas → la app indica que no hay avances aprobados.
