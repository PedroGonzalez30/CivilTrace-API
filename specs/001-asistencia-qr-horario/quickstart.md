# Guía de validación: Asistencia con QR, horario por obra y calendario

**Feature**: `001-asistencia-qr-horario` · Contrato: [contracts/asistencia-api.md](./contracts/asistencia-api.md) · Modelo: [data-model.md](./data-model.md)

## Requisitos previos

- Node 24 y Docker.
- Un `.env` copiado de `.env.example`.
- La infraestructura de pruebas del módulo 00 (R-12): `npm run lint` y `npm test` deben existir.

```bash
docker compose up -d
npm install
npx prisma migrate dev            # aplica la migración asistencia_qr_horario
npm run typecheck && npm run lint && npm test
```

## Datos de prueba

`pruebas/` tiene una semilla de prueba (no la de producción) con estos datos:

- Empresa "Todo Concreto", en `America/Tijuana`.
- Dueño, supervisora María Castro (`maria.castro@ejemplo.com`) y trabajadora Ana Sánchez (`ana.sanchez@ejemplo.com`, oficio "Albañil").
- Obra "Hospital", supervisada por María, con Ana asignada.
- Otra empresa con su propio trabajador, para las pruebas de aislamiento.

## Escenarios que deben pasar

| Clave | Escenario | Resultado esperado |
|---|---|---|
| CP22-E1 | María guarda el horario 08:00–16:00, 15 min, L–S, "Todos los días" | `GET /obras/:id/horario` devuelve ese horario general |
| CP22-E2 | María guarda 09:00–14:00 "Solo hoy" | `hoy.esExcepcion = true`; mañana vuelve el general |
| CP22-E3 | Salida 07:00 con entrada 08:00 | 400 "La hora de salida debe ser posterior a la de entrada" |
| CP21-E1 | Ana pide su credencial y María la escanea a las 08:02 | `GUARDADO`, entrada `COMPLETA`, con la ubicación y María como autora |
| CP21-E2 | Segundo escaneo a las 15:30 | `GUARDADO` como salida y `tipoJornada = SALIDA_TEMPRANA` |
| CP21-E3 | Escaneo de un QR de otra empresa o de un trabajador no asignado | `RECHAZADO` `QR_INVALIDO` o `NO_ASIGNADO`, sin registro |
| CP21-A1 | Tercer escaneo del día | `RECHAZADO` `ASISTENCIA_COMPLETA` |
| CP21-A2 | Mismo `idLocal` enviado dos veces | La segunda respuesta es `DUPLICADO`, con un solo registro |
| CP21-A3 | Lote sin conexión con `capturadoEn` de las 08:01 enviado a las 11:00 | La entrada queda a las 08:01, con `entradaSinConexion = true` |
| CP21-A4 | Ana pide su credencial dos veces, desde dos sesiones distintas | Recibe el mismo `codigoQr` (D-17) |
| CP06-A1 | Ana guarda el oficio "Albañil" en su perfil | `GET /perfil` lo devuelve y la vista previa del escaneo lo muestra |
| CP19-E1 | Ana llega 08:25; María guarda `RETARDO`, anotación "Llegó 25 minutos tarde", `MEDIO_DIA` | El día sale `NARANJA` en el calendario, con `conDescuento = true` y la anotación |
| CP19-E2 | Ana abre su calendario de diciembre 2026 con un descuento el día 5 | El día 5 tiene `conDescuento = true` y su detalle muestra el motivo |
| CP19-E3 | María guarda `RETARDO` sin anotación | 400 "La observación es obligatoria" y nada cambia |
| CP19-A1 | Ana pide el calendario de otro trabajador | 403 |
| CP19-A2 | Día laborable pasado sin registro | `ROJO`, con `esFaltaCalculada = true` |
| CP19-A3 | María cambia la entrada de 08:20 a 08:00 | Queda un `CambioAsistencia` con el valor anterior y la autora |
| CP19-A4 | Entrada a las 08:15 exactas (tolerancia de 15) | `COMPLETA`; a las 08:16, `RETARDO` (SC-006) |

## Comprobación manual rápida (API local)

1. Inicia sesión como María y como Ana con `POST /auth/iniciar-sesion` y guarda los tokens.
2. Como María, guarda el horario con `PUT /obras/:obraId/horario`.
3. Como Ana, pide `GET /asistencia/mi-credencial` y copia `codigoQr`.
4. Como María, llama `POST /obras/:obraId/asistencia/vista-previa` y luego `POST /asistencia/registros` con ese código.
5. Como Ana, pide `GET /asistencia/mi-dia`: la entrada debe estar `REGISTRADA`.
6. Como Ana, pide `GET /asistencia/trabajadores/<su id>/calendario?mes=<mes actual>`: el día de hoy debe aparecer con color.

## Revisión contra el Figma

Antes de cerrar el feature, compara las respuestas con las pantallas de la spec, por `node-id`. Cada dato que muestra cada pantalla debe venir en algún endpoint: nombre, oficio, foto, horas, estados, resumen del mes, símbolo $ e historial.
