# Decisiones del proyecto Civil Trace

Registro de decisiones ya tomadas por el equipo. Claude Code las toma como dadas y no las vuelve a
preguntar. Las nuevas decisiones se agregan al final con fecha.

## Producto

| # | Fecha | Decisión |
|---|---|---|
| D-01 | 20/11/2026 | El alcance del MVP es lo que muestra el Figma `EIXrnioyKFd9EoBY5PINOV`. Lo que no está ahí no se desarrolla, salvo que haga falta para funcionar y el equipo lo apruebe. |
| D-02 | 20/11/2026 | Usuarios de la app móvil: dueño, supervisor y trabajador. El cliente no tiene cuenta: usa una **página web** a la que entra con un enlace que recibe por correo. |
| D-03 | 20/11/2026 | El cliente acepta un reporte con **código de un solo uso + firma** dibujada en pantalla. Si lo rechaza, escribe un comentario y también **firma**. Pantallas: `CLIENTE_FirmarAceptacion`, `CLIENTE_FirmarRechazo`, `CLIENTE_ReporteAceptado`. |
| D-04 | 20/11/2026 | La firma se guarda como imagen (JPG o PNG) en almacenamiento privado, con su huella SHA-256, nombre, fecha y hora. Es demostrativa, no tiene peso legal; no se presenta como firma electrónica. |
| D-05 | 20/11/2026 | Obra y servicio son lo mismo y se registran con los mismos campos. |
| D-06 | 20/11/2026 | El horario de entrada y salida se fija **por obra** (supervisor o dueño), con tolerancia de 10, 15 o 20 minutos (por defecto 15), días laborales y opción "todos los días" o "solo hoy". |
| D-07 | 20/11/2026 | Asistencia: el trabajador muestra su QR y el supervisor lo escanea. Al mantener presionado a un trabajador en la lista, el supervisor abre "Detalles de asistencia": tipo de jornada (completa, retardo, media jornada, salida temprana, falta), motivo (cita médica, enfermedad, permiso personal, asunto familiar, otro), efecto en el pago (pago completo, medio día, sin pago), anotaciones y edición de horas. Todo cambio guarda valor anterior, autor, fecha y hora. |
| D-08 | 20/11/2026 | Calendario de asistencia: verde = asistencia completa, naranja = retardo o media jornada (o salida temprana), rojo = falta. Al tocar un día se ven sus detalles. Lo ve el trabajador (el suyo) y el supervisor o el dueño (el de sus trabajadores). |
| D-09 | 20/11/2026 | Desempeño por trabajador: porcentaje de asistencia; evidencias aprobadas y rechazadas; actividades entregadas antes de la fecha, el mismo día o con retraso. Periodo: semana, mes o todo. |
| D-10 | 20/11/2026 | Las fotos del trabajador nacen "Pendiente de revisión"; el supervisor las aprueba o rechaza con observación. Solo las aprobadas cuentan para terminar actividades, reportes, entregas y actas. Las que sube el supervisor nacen aprobadas. |
| D-11 | 20/11/2026 | La lista de protección personal (EPP) queda fuera del alcance. |
| D-12 | 20/11/2026 | Contraseñas con criterios generales de seguridad: las reglas que ya usa la API al cambiar contraseña (mínimo 8 caracteres, una minúscula, una mayúscula y un número; argon2). Hoy el registro solo exige 8 caracteres: hay que aplicar las mismas reglas en registro y cambio. |
| D-13 | 23/11/2026 | RF-56: los días con descuento en el pago (medio día o sin pago) muestran el símbolo **$** en el calendario de asistencia, además de su color. Hay que agregarlo al Figma (`SUP_CalendarioTrabajador`, `TRA-HIstorial asistencia`). |
| D-14 | 23/11/2026 | La asistencia por QR funciona **sin conexión**: el supervisor escanea, el registro se guarda en su teléfono y se envía al recuperar la señal, igual que las evidencias (RNF-07). El servidor lo vuelve a validar al recibirlo. |
| D-15 | 23/11/2026 | Zona horaria por empresa, `America/Tijuana` por defecto. Más adelante se podrá cambiar a la hora de CDMX (`America/Mexico_City`). |
| D-16 | 23/11/2026 | El aviso "Tienes N falta(s) este mes" y el recordatorio de las 3 faltas injustificadas se muestran al trabajador solo si tiene al menos 1 falta en el mes. |

## Técnica

| # | Fecha | Decisión |
|---|---|---|
| T-01 | 20/11/2026 | Se conservan las tecnologías actuales. **API:** Node 24, Fastify 5, TypeScript, Prisma 7 + PostgreSQL 17, zod, JWT con refresco, argon2, Azure Blob Storage. **App:** Expo SDK 58, React Native 0.88, **React Navigation** (no Expo Router), expo-camera, expo-location. |
| T-02 | 20/11/2026 | Página web del cliente en un repositorio nuevo `CivilTrace-Portal`: React + Vite + TypeScript, desplegada en Azure Static Web Apps (nivel Free). Reutiliza colores, Poppins y estilo del Figma. |
| T-03 | 20/11/2026 | Correo (enlace, aviso de reporte, código de un solo uso) con Azure Communication Services Email y dominio administrado por Azure. |
| T-04 | 20/11/2026 | Infraestructura con Terraform en `CivilTrace-API/infra`. Lo existente se importa sin recrearse; lo nuevo se agrega en las mismas regiones. Al entregar al cliente se crea todo de nuevo en **México Central**. |
| T-05 | 20/11/2026 | Recursos existentes (no recrear): grupo `rg-civiltrace` (West US); `plan-civiltrace` B1 y `civiltrace-api` (West US); `civiltrace-bd3` PostgreSQL 17 Standard_B1ms (Canada Central); `civiltracestorage` Standard_LRS (West US); identidades `oidc-msi-9d1d` y `oidc-msi-a92e` (West US). Variables de la API: `AZURE_STORAGE_CONTENEDOR`, `AZURE_STORAGE_CUENTA`, `DATABASE_URL`, `JWT_SECRETO`, `NODE_ENV`. |
| T-06 | 20/11/2026 | Pendiente: la API (West US) y la base (Canada Central) están en regiones distintas, lo que agrega latencia. Se mantiene así en el MVP; en el entorno del cliente van juntas. |

## Pendientes de confirmar

| # | Tema |
|---|---|
| P-02 | Cuál de las dos identidades OIDC usa el workflow actual; la otra se puede borrar. El equipo no lo sabe: revisarlo en Azure (federated credentials de `oidc-msi-9d1d` y `oidc-msi-a92e`) con la cuenta que administra `rg-civiltrace`. |

## Resueltas

| # | Fecha | Decisión |
|---|---|---|
| P-01 | 23/11/2026 | La página "Dueño" del Figma es la versión vigente de las pantallas del dueño. |
| P-03 | 23/11/2026 | Se usa la numeración de RF del **SRS V4.0**. Las claves del plan de pruebas se mapean a ella. |
| P-04 | 23/11/2026 | RF-19 y RF-27 (asistencia) suben de Should a **Must**: son parte del MVP en el Figma. |
| G-01 | 23/11/2026 | El equipo aprueba la gobernanza de la constitución: las enmiendas van por pull request con aprobación del equipo y se registran aquí; se usa versionado semántico (MAJOR / MINOR / PATCH). |
