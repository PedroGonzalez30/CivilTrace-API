/**
 * @archivo registroAsistencia.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del registro de entrada y salida por lote (POST /asistencia/registros), con
 *   y sin conexión, idempotencia y validaciones del QR.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-19 Registrar asistencia propia, RF-27 Registrar asistencia por el
 *   supervisor, RNF-07 Captura sin conexión (D-14)
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
  crearHorario,
  crearUsuario,
  iniciarSesion,
} from '../configuracion/fabricas';

// 3. Constantes del módulo
const LATITUD = 32.6245;
const LONGITUD = -115.4523;

// 4. Pruebas
describe('POST /asistencia/registros', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
  let qrAna: string;
  let idLocalPrimeraEntrada: string;

  const pedirQr = async (usuario: { id: string; rol: 'TRABAJADOR'; empresaId: string | null }) =>
    (
      await app.inject({
        method: 'GET',
        url: '/asistencia/mi-credencial',
        headers: iniciarSesion(app, usuario),
      })
    ).json().codigoQr as string;

  const escaneo = (sobrescribir: Record<string, unknown> = {}) => ({
    idLocal: randomUUID(),
    obraId: escenario.obra.id,
    codigoQr: qrAna,
    capturadoEn: new Date().toISOString(),
    sinConexion: false,
    latitud: LATITUD,
    longitud: LONGITUD,
    ...sobrescribir,
  });

  const enviar = (
    escaneos: unknown[],
    usuario: {
      id: string;
      rol: 'DUENO' | 'SUPERVISOR' | 'TRABAJADOR';
      empresaId: string | null;
    } = escenario.maria,
  ) =>
    app.inject({
      method: 'POST',
      url: '/asistencia/registros',
      headers: iniciarSesion(app, usuario),
      payload: { escaneos },
    });

  beforeAll(async () => {
    await limpiarTablas();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T16:02:00Z')); // viernes 08:02 en Tijuana
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    await crearHorario({
      obraId: escenario.obra.id,
      empresaId: escenario.empresa.id,
      creadoPorId: escenario.maria.id,
    });
    qrAna = await pedirQr({ ...escenario.ana, rol: 'TRABAJADOR' });
  });

  afterAll(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('CP21-E1 el supervisor escanea el QR y se guarda la entrada con ubicación y autor', async () => {
    const primero = escaneo();
    idLocalPrimeraEntrada = primero.idLocal;
    const respuesta = await enviar([primero]);

    expect(respuesta.statusCode).toBe(200);
    const [resultado] = respuesta.json().resultados;
    expect(resultado).toMatchObject({
      idLocal: primero.idLocal,
      estado: 'GUARDADO',
      registro: { tipo: 'ENTRADA', tipoJornada: 'COMPLETA', fecha: '2026-11-20' },
    });

    const registro = await prisma.registroAsistencia.findFirstOrThrow({
      where: { trabajadorId: escenario.ana.id },
    });
    expect(registro.entradaEn?.toISOString()).toBe('2026-11-20T16:02:00.000Z');
    expect(Number(registro.entradaLatitud)).toBeCloseTo(LATITUD);
    expect(registro.entradaRegistradaPorId).toBe(escenario.maria.id);
    expect(registro.entradaSinConexion).toBe(false);
    expect(registro.horarioEntrada).toBe('08:00');
  });

  it('CP21-A2 reenviar el mismo idLocal no duplica el registro', async () => {
    const respuesta = await enviar([escaneo({ idLocal: idLocalPrimeraEntrada })]);

    expect(respuesta.json().resultados[0]).toMatchObject({
      estado: 'DUPLICADO',
      registro: { tipo: 'ENTRADA' },
    });
    expect(await prisma.registroAsistencia.count()).toBe(1);
  });

  it('CP21-E2 el segundo escaneo es la salida; antes de las 16:00 es salida temprana', async () => {
    vi.setSystemTime(new Date('2026-11-20T23:30:00Z')); // 15:30 en Tijuana
    const respuesta = await enviar([escaneo()]);

    expect(respuesta.json().resultados[0]).toMatchObject({
      estado: 'GUARDADO',
      registro: { tipo: 'SALIDA', tipoJornada: 'SALIDA_TEMPRANA' },
    });
  });

  it('CP21-A1 un tercer escaneo el mismo día se rechaza', async () => {
    const respuesta = await enviar([escaneo()]);

    expect(respuesta.json().resultados[0]).toMatchObject({
      estado: 'RECHAZADO',
      motivo: 'ASISTENCIA_COMPLETA',
      registro: null,
    });
  });

  it('CP21-E3 un QR ajeno, de otra empresa o inventado no registra nada', async () => {
    const noAsignado = await crearUsuario({
      rol: 'TRABAJADOR',
      empresaId: escenario.empresa.id,
      nombre: 'No Asignado',
    });
    const qrNoAsignado = await pedirQr({ ...noAsignado, rol: 'TRABAJADOR' });
    const qrAjeno = await pedirQr({ ...escenario.trabajadorAjeno, rol: 'TRABAJADOR' });

    const respuesta = await enviar([
      escaneo({ codigoQr: qrNoAsignado }),
      escaneo({ codigoQr: qrAjeno }),
      escaneo({ codigoQr: 'hola' }),
    ]);
    const resultados = respuesta.json().resultados;

    expect(resultados.map((r: { motivo: string }) => r.motivo)).toEqual([
      'NO_ASIGNADO',
      'QR_INVALIDO',
      'QR_INVALIDO',
    ]);
    expect(JSON.stringify(resultados)).not.toContain('Trabajador Ajeno');
    expect(await prisma.registroAsistencia.count()).toBe(1);
  });

  it('CP21-A18 un supervisor que no es de la obra no puede registrar', async () => {
    const otroSupervisor = await crearUsuario({
      rol: 'SUPERVISOR',
      empresaId: escenario.empresa.id,
    });
    vi.setSystemTime(new Date('2026-11-21T16:00:00Z'));
    const respuesta = await enviar([escaneo()], otroSupervisor);

    expect(respuesta.json().resultados[0]).toMatchObject({
      estado: 'RECHAZADO',
      motivo: 'NO_ES_SUPERVISOR',
    });
  });

  it('CP21-A3 un escaneo sin conexión conserva la hora en que se capturó', async () => {
    vi.setSystemTime(new Date('2026-11-21T19:00:00Z')); // sábado 11:00 en Tijuana
    const respuesta = await enviar([
      escaneo({ sinConexion: true, capturadoEn: '2026-11-21T16:01:00.000Z' }),
    ]);

    expect(respuesta.json().resultados[0]).toMatchObject({
      estado: 'GUARDADO',
      registro: { tipo: 'ENTRADA', fecha: '2026-11-21', tipoJornada: 'COMPLETA' },
    });
    const registro = await prisma.registroAsistencia.findFirstOrThrow({
      where: { trabajadorId: escenario.ana.id, fecha: new Date('2026-11-21T00:00:00Z') },
    });
    expect(registro.entradaEn?.toISOString()).toBe('2026-11-21T16:01:00.000Z');
    expect(registro.entradaSinConexion).toBe(true);
  });

  it('CP21-A19 se rechazan capturas de hace más de 7 días o en el futuro', async () => {
    const respuesta = await enviar([
      escaneo({ sinConexion: true, capturadoEn: '2026-11-13T16:00:00.000Z' }),
      escaneo({ sinConexion: true, capturadoEn: '2026-11-21T19:10:00.000Z' }),
    ]);

    expect(respuesta.json().resultados.map((r: { motivo: string }) => r.motivo)).toEqual([
      'FECHA_FUERA_DE_RANGO',
      'FECHA_FUERA_DE_RANGO',
    ]);
  });

  it('CP21-A20 una entrada después de la tolerancia es retardo', async () => {
    vi.setSystemTime(new Date('2026-11-23T16:16:00Z')); // lunes 08:16 en Tijuana
    const respuesta = await enviar([escaneo()]);

    expect(respuesta.json().resultados[0].registro.tipoJornada).toBe('RETARDO');
  });

  it('CP21-A21 valida el lote: vacío, más de 100, sin sesión o sin rol de supervisor', async () => {
    expect((await enviar([])).statusCode).toBe(400);
    const muchos = Array.from({ length: 101 }, () => escaneo());
    expect((await enviar(muchos)).statusCode).toBe(400);
    const sinSesion = await app.inject({
      method: 'POST',
      url: '/asistencia/registros',
      payload: { escaneos: [escaneo()] },
    });
    expect(sinSesion.statusCode).toBe(401);
    const comoTrabajador = await enviar([escaneo()], escenario.ana);
    expect(comoTrabajador.statusCode).toBe(403);
  });
});
