/**
 * @archivo resumenDia.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del resumen de asistencia del día (supervisor y dueño) y de "Mi asistencia"
 *   del trabajador.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-19 Registrar asistencia propia, RF-27 Registrar asistencia por el supervisor
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import {
  construirAppPrueba,
  crearEscenarioBase,
  crearHorario,
  iniciarSesion,
} from '../configuracion/fabricas';

// 4. Pruebas
describe('Resumen del día y Mi asistencia', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

  const resumen = (
    usuario: { id: string; rol: 'DUENO' | 'SUPERVISOR' | 'TRABAJADOR'; empresaId: string | null },
    fecha?: string,
  ) =>
    app.inject({
      method: 'GET',
      url: `/obras/${escenario.obra.id}/asistencia${fecha ? `?fecha=${fecha}` : ''}`,
      headers: iniciarSesion(app, usuario),
    });

  beforeAll(async () => {
    await limpiarTablas();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T16:10:00Z')); // viernes 08:10 en Tijuana
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    await crearHorario({
      obraId: escenario.obra.id,
      empresaId: escenario.empresa.id,
      creadoPorId: escenario.maria.id,
    });
  });

  afterAll(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('CP21-A30 antes de que termine la tolerancia la entrada sigue pendiente', async () => {
    const respuesta = await resumen(escenario.maria);

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      fecha: '2026-11-20',
      horario: { horaEntrada: '08:00', horaSalida: '16:00' },
      estadoEntrada: 'PENDIENTE',
      estadoSalida: 'PENDIENTE',
      trabajadores: [{ id: escenario.ana.id, entrada: null, salida: null }],
    });
  });

  it('CP21-A31 después del escaneo la lista muestra la hora de entrada', async () => {
    const qr = (
      await app.inject({
        method: 'GET',
        url: '/asistencia/mi-credencial',
        headers: iniciarSesion(app, escenario.ana),
      })
    ).json().codigoQr;
    await app.inject({
      method: 'POST',
      url: '/asistencia/registros',
      headers: iniciarSesion(app, escenario.maria),
      payload: {
        escaneos: [
          {
            idLocal: randomUUID(),
            obraId: escenario.obra.id,
            codigoQr: qr,
            capturadoEn: new Date().toISOString(),
            sinConexion: false,
            latitud: null,
            longitud: null,
          },
        ],
      },
    });
    vi.setSystemTime(new Date('2026-11-20T16:20:00Z')); // 08:20

    const respuesta = await resumen(escenario.dueno);

    expect(respuesta.json()).toMatchObject({
      estadoEntrada: 'FINALIZADO',
      estadoSalida: 'PENDIENTE',
      trabajadores: [
        { id: escenario.ana.id, entrada: '2026-11-20T16:10:00.000Z', tipoJornada: 'COMPLETA' },
      ],
    });
  });

  it('CP19-A6 un día laborable pasado sin registro aparece como falta', async () => {
    const respuesta = await resumen(escenario.maria, '2026-11-19');

    expect(respuesta.json()).toMatchObject({
      estadoEntrada: 'FINALIZADO',
      estadoSalida: 'FINALIZADO',
      trabajadores: [{ id: escenario.ana.id, entrada: null, tipoJornada: 'FALTA' }],
    });
  });

  it('CP21-A32 un trabajador no ve el resumen de la obra', async () => {
    expect((await resumen(escenario.ana)).statusCode).toBe(403);
  });

  it('CP21-A33 Mi asistencia muestra el horario de hoy y el estado de entrada y salida', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/asistencia/mi-dia',
      headers: iniciarSesion(app, escenario.ana),
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      fecha: '2026-11-20',
      obras: [
        {
          obraId: escenario.obra.id,
          obraNombre: 'Hospital',
          horaEntrada: '08:00',
          horaSalida: '16:00',
          esDiaLaborable: true,
          entrada: { estado: 'REGISTRADA', hora: '2026-11-20T16:10:00.000Z' },
          salida: { estado: 'PENDIENTE', hora: null },
        },
      ],
    });
  });
});
