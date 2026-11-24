/**
 * @archivo detallesAsistencia.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas de "Detalles de asistencia": consultar y editar el día de un trabajador con
 *   historial de cambios, observación obligatoria y permisos.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-60 Registrar retardo o salida anticipada, RF-58 Mostrar calendario de
 *   asistencia, D-07
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
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

// 2. Tipos e interfaces
type UsuarioPrueba = {
  id: string;
  rol: 'DUENO' | 'SUPERVISOR' | 'TRABAJADOR';
  empresaId: string | null;
};

// 4. Pruebas
describe('Detalles de asistencia', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
  let luis: Awaited<ReturnType<typeof crearUsuario>>;

  const ruta = (trabajadorId: string, fecha: string) =>
    `/obras/${escenario.obra.id}/asistencia/trabajadores/${trabajadorId}/dias/${fecha}`;

  const editar = (
    trabajadorId: string,
    fecha: string,
    cambios: Record<string, unknown>,
    usuario: UsuarioPrueba = escenario.maria,
  ) =>
    app.inject({
      method: 'PATCH',
      url: ruta(trabajadorId, fecha),
      headers: iniciarSesion(app, usuario),
      payload: cambios,
    });

  const consultar = (
    trabajadorId: string,
    fecha: string,
    usuario: UsuarioPrueba = escenario.maria,
  ) =>
    app.inject({
      method: 'GET',
      url: ruta(trabajadorId, fecha),
      headers: iniciarSesion(app, usuario),
    });

  const crearRetardo = (trabajadorId: string) =>
    prisma.registroAsistencia.create({
      data: {
        empresaId: escenario.empresa.id,
        obraId: escenario.obra.id,
        trabajadorId,
        fecha: new Date('2026-11-20T00:00:00Z'),
        entradaEn: new Date('2026-11-20T16:25:00Z'), // 08:25 en Tijuana
        entradaRegistradaPorId: escenario.maria.id,
        tipoJornada: 'RETARDO',
        esDiaLaborable: true,
        horarioEntrada: '08:00',
        horarioSalida: '16:00',
        toleranciaMinutos: 15,
      },
    });

  beforeAll(async () => {
    await limpiarTablas();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T23:00:00Z')); // viernes 15:00 en Tijuana
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    luis = await crearUsuario({
      rol: 'TRABAJADOR',
      empresaId: escenario.empresa.id,
      nombre: 'Luis',
    });
    await prisma.obra.update({
      where: { id: escenario.obra.id },
      data: { trabajadores: { connect: { id: luis.id } } },
    });
    await crearHorario({
      obraId: escenario.obra.id,
      empresaId: escenario.empresa.id,
      creadoPorId: escenario.maria.id,
    });
    await crearRetardo(escenario.ana.id);
    await crearRetardo(luis.id);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('CP19-E1 el supervisor registra el retardo con observación y descuento', async () => {
    const respuesta = await editar(escenario.ana.id, '2026-11-20', {
      tipoJornada: 'RETARDO',
      anotacion: 'Llegó 25 minutos tarde',
      efectoPago: 'MEDIO_DIA',
    });

    expect(respuesta.statusCode).toBe(200);
    const detalle = respuesta.json();
    expect(detalle).toMatchObject({
      fecha: '2026-11-20',
      trabajador: { id: escenario.ana.id, nombre: 'Ana Sánchez' },
      obra: { id: escenario.obra.id, nombre: 'Hospital' },
      entrada: { hora: '2026-11-20T16:25:00.000Z', registradaPor: 'María Castro' },
      salida: null,
      tipoJornada: 'RETARDO',
      efectoPago: 'MEDIO_DIA',
      conDescuento: true,
      anotacion: 'Llegó 25 minutos tarde',
      esFaltaCalculada: false,
    });
    expect(detalle.cambios.map((cambio: { campo: string }) => cambio.campo).sort()).toEqual([
      'anotacion',
      'efectoPago',
    ]);
  });

  it('CP19-E3 sin observación no se guarda el retardo ni el historial', async () => {
    const respuesta = await editar(luis.id, '2026-11-20', {
      tipoJornada: 'RETARDO',
      efectoPago: 'SIN_PAGO',
    });

    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json().mensaje).toBe('La observación es obligatoria');
    const registro = await prisma.registroAsistencia.findFirstOrThrow({
      where: { trabajadorId: luis.id },
      include: { cambios: true },
    });
    expect(registro.efectoPago).toBe('PAGO_COMPLETO');
    expect(registro.cambios).toHaveLength(0);
  });

  it('CP19-A3 corregir la hora de entrada guarda la hora original, el autor y la fecha', async () => {
    const respuesta = await editar(escenario.ana.id, '2026-11-20', {
      entradaEn: '2026-11-20T16:00:00.000Z',
      anotacion: 'Olvidó registrarse; llegó a las 8:00',
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().entrada.hora).toBe('2026-11-20T16:00:00.000Z');
    expect(respuesta.json().cambios).toContainEqual(
      expect.objectContaining({
        campo: 'entradaEn',
        valorAnterior: '2026-11-20T16:25:00.000Z',
        valorNuevo: '2026-11-20T16:00:00.000Z',
        autor: 'María Castro',
        fecha: '2026-11-20T23:00:00.000Z',
      }),
    );
  });

  it('CP19-A7 un día laborable pasado sin registro se ve como falta y se puede justificar', async () => {
    const antes = await consultar(escenario.ana.id, '2026-11-19');
    expect(antes.json()).toMatchObject({
      tipoJornada: 'FALTA',
      esFaltaCalculada: true,
      entrada: null,
    });

    const respuesta = await editar(escenario.ana.id, '2026-11-19', {
      tipoJornada: 'FALTA',
      motivo: 'ENFERMEDAD',
      efectoPago: 'SIN_PAGO',
      anotacion: 'Incapacidad del IMSS',
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      tipoJornada: 'FALTA',
      esFaltaCalculada: false,
      motivo: 'ENFERMEDAD',
      conDescuento: true,
    });
  });

  it('CP19-A8 rechaza fechas futuras, salida antes de la entrada y cuerpos vacíos', async () => {
    const futura = await editar(escenario.ana.id, '2026-11-21', {
      tipoJornada: 'FALTA',
      anotacion: 'x',
    });
    expect(futura.statusCode).toBe(400);
    expect(futura.json().mensaje).toBe('No se puede registrar asistencia en una fecha futura');

    const salidaAntes = await editar(escenario.ana.id, '2026-11-20', {
      salidaEn: '2026-11-20T15:00:00.000Z',
    });
    expect(salidaAntes.statusCode).toBe(400);
    expect(salidaAntes.json().mensaje).toBe('La salida debe ser posterior a la entrada');

    expect((await editar(escenario.ana.id, '2026-11-20', {})).statusCode).toBe(400);
  });

  it('CP19-A9 solo el supervisor de la obra edita; el trabajador ve solo su detalle', async () => {
    const cambio = { anotacion: 'Prueba' };
    expect((await editar(escenario.ana.id, '2026-11-20', cambio, escenario.dueno)).statusCode).toBe(
      403,
    );
    expect((await editar(escenario.ana.id, '2026-11-20', cambio, escenario.ana)).statusCode).toBe(
      403,
    );
    const otro = await crearUsuario({ rol: 'SUPERVISOR', empresaId: escenario.empresa.id });
    expect((await editar(escenario.ana.id, '2026-11-20', cambio, otro)).statusCode).toBe(403);

    expect((await consultar(escenario.ana.id, '2026-11-20', escenario.ana)).statusCode).toBe(200);
    expect((await consultar(escenario.ana.id, '2026-11-20', escenario.dueno)).statusCode).toBe(200);
    expect((await consultar(escenario.ana.id, '2026-11-20', luis)).statusCode).toBe(403);
  });
});
