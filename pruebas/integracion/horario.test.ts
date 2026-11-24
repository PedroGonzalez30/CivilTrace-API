/**
 * @archivo horario.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del horario de la obra (GET y PUT /obras/:obraId/horario): general, "solo
 *   hoy", validaciones, permisos y que un cambio no reclasifica registros guardados.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-60 Registrar retardo o salida anticipada (horario de referencia), D-06
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/baseDatos/clientePrisma';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import {
  construirAppPrueba,
  crearEscenarioBase,
  crearUsuario,
  iniciarSesion,
} from '../configuracion/fabricas';

// 3. Constantes del módulo
const HORARIO_GENERAL = {
  horaEntrada: '08:00',
  horaSalida: '16:00',
  toleranciaMinutos: 15,
  diasLaborales: [1, 2, 3, 4, 5, 6],
  alcance: 'TODOS_LOS_DIAS',
};

type UsuarioPrueba = {
  id: string;
  rol: 'DUENO' | 'SUPERVISOR' | 'TRABAJADOR';
  empresaId: string | null;
};

// 4. Pruebas
describe('Horario de la obra', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

  const guardar = (cuerpo: Record<string, unknown>, usuario: UsuarioPrueba = escenario.maria) =>
    app.inject({
      method: 'PUT',
      url: `/obras/${escenario.obra.id}/horario`,
      headers: iniciarSesion(app, usuario),
      payload: cuerpo,
    });

  const consultar = (usuario: UsuarioPrueba = escenario.maria) =>
    app.inject({
      method: 'GET',
      url: `/obras/${escenario.obra.id}/horario`,
      headers: iniciarSesion(app, usuario),
    });

  beforeAll(async () => {
    await limpiarTablas();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T15:00:00Z')); // viernes 07:00 en Tijuana
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
  });

  afterAll(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('CP22-A3 una obra sin horario responde general y hoy nulos', async () => {
    const respuesta = await consultar();

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ general: null, hoy: null, zonaHoraria: 'America/Tijuana' });
  });

  it('CP22-E1 el supervisor guarda el horario general y se consulta', async () => {
    const respuesta = await guardar(HORARIO_GENERAL);

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      general: {
        horaEntrada: '08:00',
        horaSalida: '16:00',
        toleranciaMinutos: 15,
        diasLaborales: [1, 2, 3, 4, 5, 6],
        actualizadoPor: 'María Castro',
      },
      hoy: { fecha: '2026-11-20', esDiaLaborable: true, esExcepcion: false },
    });
    expect((await consultar(escenario.ana)).json().general.horaEntrada).toBe('08:00');
  });

  it('CP22-A4 una entrada a las 08:16 con ese horario se marca como retardo', async () => {
    const qr = (
      await app.inject({
        method: 'GET',
        url: '/asistencia/mi-credencial',
        headers: iniciarSesion(app, escenario.ana),
      })
    ).json().codigoQr;
    vi.setSystemTime(new Date('2026-11-20T16:16:00Z'));
    const respuesta = await app.inject({
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

    expect(respuesta.json().resultados[0].registro.tipoJornada).toBe('RETARDO');
  });

  it('CP22-E2 "Solo hoy" crea una excepción y al día siguiente vuelve el general', async () => {
    const respuesta = await guardar({
      ...HORARIO_GENERAL,
      horaEntrada: '09:00',
      horaSalida: '14:00',
      alcance: 'SOLO_HOY',
    });

    expect(respuesta.json()).toMatchObject({
      general: { horaEntrada: '08:00' },
      hoy: { horaEntrada: '09:00', horaSalida: '14:00', esExcepcion: true },
    });

    vi.setSystemTime(new Date('2026-11-21T15:00:00Z'));
    expect((await consultar()).json().hoy).toMatchObject({
      fecha: '2026-11-21',
      horaEntrada: '08:00',
      esExcepcion: false,
    });
  });

  it('CP22-A5 cambiar el horario no reclasifica registros ya guardados (FR-013)', async () => {
    await guardar({ ...HORARIO_GENERAL, horaEntrada: '09:00', toleranciaMinutos: 20 });
    const registro = await prisma.registroAsistencia.findFirstOrThrow({
      where: { trabajadorId: escenario.ana.id },
    });

    expect(registro.tipoJornada).toBe('RETARDO');
    expect(registro.horarioEntrada).toBe('08:00');
    expect(registro.toleranciaMinutos).toBe(15);
  });

  it('CP22-E3 rechaza horarios inválidos con mensajes claros', async () => {
    const salidaAntes = await guardar({ ...HORARIO_GENERAL, horaSalida: '07:00' });
    expect(salidaAntes.statusCode).toBe(400);
    expect(salidaAntes.json().mensaje).toBe('La hora de salida debe ser posterior a la de entrada');

    const sinDias = await guardar({ ...HORARIO_GENERAL, diasLaborales: [] });
    expect(sinDias.json().mensaje).toBe('Elige al menos un día laboral');

    const tolerancia = await guardar({ ...HORARIO_GENERAL, toleranciaMinutos: 12 });
    expect(tolerancia.json().mensaje).toBe('La tolerancia debe ser de 10, 15 o 20 minutos');

    const horaMala = await guardar({ ...HORARIO_GENERAL, horaEntrada: '25:00' });
    expect(horaMala.statusCode).toBe(400);
  });

  it('CP22-A6 el dueño puede cambiar el horario; un trabajador o un supervisor ajeno no', async () => {
    expect((await guardar(HORARIO_GENERAL, escenario.dueno)).statusCode).toBe(200);
    expect((await guardar(HORARIO_GENERAL, escenario.ana)).statusCode).toBe(403);
    const otro = await crearUsuario({ rol: 'SUPERVISOR', empresaId: escenario.empresa.id });
    expect((await guardar(HORARIO_GENERAL, otro)).statusCode).toBe(403);
    expect((await consultar(otro)).statusCode).toBe(403);
  });

  it('CP22-A7 el horario de una obra de otra empresa no existe para quien consulta', async () => {
    const ajeno = await crearUsuario({ rol: 'DUENO', empresaId: escenario.otraEmpresa.id });
    expect((await consultar(ajeno)).statusCode).toBe(404);
  });
});
