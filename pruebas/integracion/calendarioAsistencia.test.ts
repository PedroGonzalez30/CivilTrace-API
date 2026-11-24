/**
 * @archivo calendarioAsistencia.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del calendario mensual de asistencia: colores, faltas calculadas, símbolo
 *   de descuento, resumen del mes, permisos y alta del trabajador (D-20).
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-56 Mostrar días con descuento, RF-58 Mostrar calendario de asistencia, D-08,
 *   D-13, D-16, D-20
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/baseDatos/clientePrisma';
import type { EfectoPago, TipoJornada } from '@/generated/prisma/enums';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import {
  construirAppPrueba,
  crearEscenarioBase,
  crearHorario,
  crearObra,
  crearUsuario,
  iniciarSesion,
} from '../configuracion/fabricas';

// 2. Tipos e interfaces
type UsuarioPrueba = {
  id: string;
  rol: 'DUENO' | 'SUPERVISOR' | 'TRABAJADOR';
  empresaId: string | null;
};

// 3. Constantes del módulo
const DOMINGOS_MAYO = [3, 10, 17, 24];

// 4. Pruebas
describe('Calendario de asistencia', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

  const calendario = (trabajadorId: string, mes: string, usuario: UsuarioPrueba, obraId?: string) =>
    app.inject({
      method: 'GET',
      url: `/asistencia/trabajadores/${trabajadorId}/calendario?mes=${mes}${obraId ? `&obraId=${obraId}` : ''}`,
      headers: iniciarSesion(app, usuario),
    });

  const crearDia = (
    trabajadorId: string,
    fecha: string,
    tipoJornada: TipoJornada,
    efectoPago: EfectoPago = 'PAGO_COMPLETO',
    anotacion: string | null = null,
  ) =>
    prisma.registroAsistencia.create({
      data: {
        empresaId: escenario.empresa.id,
        obraId: escenario.obra.id,
        trabajadorId,
        fecha: new Date(`${fecha}T00:00:00Z`),
        entradaEn: new Date(`${fecha}T15:00:00Z`),
        tipoJornada,
        efectoPago,
        anotacion,
        esDiaLaborable: true,
      },
    });

  beforeAll(async () => {
    await limpiarTablas();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-25T18:00:00Z')); // lunes 25 de mayo, 11:00 en Tijuana
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    await crearHorario({
      obraId: escenario.obra.id,
      empresaId: escenario.empresa.id,
      creadoPorId: escenario.maria.id,
    });
    for (let dia = 1; dia <= 24; dia += 1) {
      if (DOMINGOS_MAYO.includes(dia) || dia === 13) {
        continue;
      }
      const fecha = `2026-05-${String(dia).padStart(2, '0')}`;
      if (dia === 19) {
        await crearDia(escenario.ana.id, fecha, 'MEDIA_JORNADA', 'MEDIO_DIA', 'Cita en el IMSS');
      } else if (dia === 20) {
        await crearDia(escenario.ana.id, fecha, 'RETARDO', 'PAGO_COMPLETO', 'Llegó tarde');
      } else {
        await crearDia(escenario.ana.id, fecha, 'COMPLETA');
      }
    }
  });

  afterAll(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('CP19-A10 colorea cada día y arma el resumen del mes (D-08)', async () => {
    const respuesta = await calendario(escenario.ana.id, '2026-05', escenario.maria);

    expect(respuesta.statusCode).toBe(200);
    const datos = respuesta.json();
    expect(datos.resumen).toEqual({
      faltas: 1,
      mediasJornadas: 1,
      retardos: 1,
      salidasTempranas: 0,
    });
    const porFecha = new Map(datos.dias.map((dia: { fecha: string }) => [dia.fecha, dia]));
    expect(porFecha.get('2026-05-13')).toMatchObject({ color: 'ROJO', esFaltaCalculada: true });
    expect(porFecha.get('2026-05-14')).toMatchObject({ color: 'VERDE', conDescuento: false });
    expect(porFecha.get('2026-05-19')).toMatchObject({ color: 'NARANJA', conDescuento: true });
    expect(porFecha.get('2026-05-20')).toMatchObject({ color: 'NARANJA', conDescuento: false });
    expect(porFecha.has('2026-05-17')).toBe(false); // domingo
    expect(porFecha.has('2026-05-25')).toBe(false); // hoy todavía no es falta
    expect(porFecha.has('2026-05-26')).toBe(false); // futuro
  });

  it('CP19-E2 el trabajador ve el día con descuento y su motivo', async () => {
    vi.setSystemTime(new Date('2026-12-10T18:00:00Z'));
    await crearDia(
      escenario.ana.id,
      '2026-12-05',
      'RETARDO',
      'MEDIO_DIA',
      'Llegó 25 minutos tarde',
    );

    const respuesta = await calendario(escenario.ana.id, '2026-12', escenario.ana);
    const dia5 = respuesta.json().dias.find((dia: { fecha: string }) => dia.fecha === '2026-12-05');
    expect(dia5).toMatchObject({ conDescuento: true, color: 'NARANJA' });

    const detalle = await app.inject({
      method: 'GET',
      url: `/obras/${escenario.obra.id}/asistencia/trabajadores/${escenario.ana.id}/dias/2026-12-05`,
      headers: iniciarSesion(app, escenario.ana),
    });
    expect(detalle.json()).toMatchObject({
      anotacion: 'Llegó 25 minutos tarde',
      efectoPago: 'MEDIO_DIA',
    });
    vi.setSystemTime(new Date('2026-05-25T18:00:00Z'));
  });

  it('CP19-A1 un trabajador no puede abrir el calendario de otro', async () => {
    const otro = await crearUsuario({ rol: 'TRABAJADOR', empresaId: escenario.empresa.id });
    expect((await calendario(escenario.ana.id, '2026-05', otro)).statusCode).toBe(403);
  });

  it('CP19-A11 el dueño ve los de su empresa; uno de otra empresa no encuentra al trabajador', async () => {
    expect((await calendario(escenario.ana.id, '2026-05', escenario.dueno)).statusCode).toBe(200);
    const duenoAjeno = await crearUsuario({ rol: 'DUENO', empresaId: escenario.otraEmpresa.id });
    expect((await calendario(escenario.ana.id, '2026-05', duenoAjeno)).statusCode).toBe(404);
  });

  it('CP19-A12 un supervisor solo ve el calendario en sus obras', async () => {
    const otroSupervisor = await crearUsuario({
      rol: 'SUPERVISOR',
      empresaId: escenario.empresa.id,
    });
    expect((await calendario(escenario.ana.id, '2026-05', otroSupervisor)).statusCode).toBe(403);

    const segundaObra = await crearObra({
      empresaId: escenario.empresa.id,
      supervisorId: otroSupervisor.id,
      trabajadorIds: [escenario.ana.id],
      nombre: 'Departamentos',
      fechaInicio: '2026-06-01',
    });
    const respuesta = await calendario(escenario.ana.id, '2026-05', otroSupervisor);
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().dias).toEqual([]);
    const conObraAjena = await calendario(
      escenario.ana.id,
      '2026-05',
      otroSupervisor,
      escenario.obra.id,
    );
    expect(conObraAjena.statusCode).toBe(403);
    expect(
      (await calendario(escenario.ana.id, '2026-05', escenario.dueno, segundaObra.id)).json().dias,
    ).toEqual([]);
  });

  it('CP19-A13 las faltas cuentan desde el alta del trabajador (D-20)', async () => {
    const nuevo = await crearUsuario({
      rol: 'TRABAJADOR',
      empresaId: escenario.empresa.id,
      creadoEn: new Date('2026-05-21T16:00:00Z'),
    });
    await prisma.obra.update({
      where: { id: escenario.obra.id },
      data: { trabajadores: { connect: { id: nuevo.id } } },
    });

    const respuesta = await calendario(nuevo.id, '2026-05', escenario.maria);
    expect(respuesta.json().dias.map((dia: { fecha: string }) => dia.fecha)).toEqual([
      '2026-05-21',
      '2026-05-22',
      '2026-05-23',
    ]);
    expect(respuesta.json().resumen.faltas).toBe(3);
  });

  it('CP19-A14 valida el mes', async () => {
    expect((await calendario(escenario.ana.id, '2026-13', escenario.maria)).statusCode).toBe(400);
    expect((await calendario(escenario.ana.id, 'mayo', escenario.maria)).statusCode).toBe(400);
  });
});
