/**
 * @archivo desempeno.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas de las métricas de desempeño por trabajador y periodo (feature 005, D-30).
 *   La fecha del sistema se fija al miércoles 25/11/2026 (Tijuana) para que los periodos sean fijos.
 * @autor Emilio Manuel Esquivel
 * @fecha 25/11/2026
 * @version 1.0.0
 * @requerimientos RF-31 Calcular aprobación de actividades por trabajador, RF-61 Calcular retardos,
 *   RF-62 Calcular entregas a tiempo, RF-63 Calcular rechazo de evidencias, RF-64 Mostrar métricas
 *   de desempeño (SRS V4.0; D-30)
 * @historial 25/11/2026 - Emilio Manuel Esquivel - Creación (feature 005)
 */

// 1. Importaciones
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/baseDatos/clientePrisma';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import {
  construirAppPrueba,
  crearActividad,
  crearAvance,
  crearEscenarioBase,
  crearHorario,
  crearUsuario,
  iniciarSesion,
} from '../configuracion/fabricas';

// 3. Constantes del módulo
const AHORA = new Date('2026-11-25T20:00:00Z');

// 4. Pruebas
describe('Métricas de desempeño (feature 005)', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
  let ruta: string;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA);
    await limpiarTablas();
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    const { empresa, obra, ana, maria } = escenario;
    ruta = `/asistencia/trabajadores/${ana.id}/desempeno`;
    await crearHorario({ obraId: obra.id, empresaId: empresa.id, creadoPorId: maria.id });

    const registro = (fecha: string, tipoJornada: 'COMPLETA' | 'RETARDO') =>
      prisma.registroAsistencia.create({
        data: {
          empresaId: empresa.id,
          obraId: obra.id,
          trabajadorId: ana.id,
          fecha: new Date(`${fecha}T00:00:00Z`),
          entradaEn: new Date(`${fecha}T16:00:00Z`),
          tipoJornada,
          esDiaLaborable: true,
        },
      });
    await registro('2026-11-23', 'COMPLETA');
    await registro('2026-11-24', 'RETARDO');

    const base = { obraId: obra.id, empresaId: empresa.id, responsableId: ana.id };
    const pisos = await crearActividad({
      ...base,
      nombre: 'Pisos',
      fechaEntrega: '2026-11-24',
      estado: 'TERMINADA',
      fechaTerminada: '2026-11-23',
    });
    await crearActividad({
      ...base,
      nombre: 'Muros',
      fechaEntrega: '2026-11-24',
      estado: 'TERMINADA',
      fechaTerminada: '2026-11-24',
    });
    await crearActividad({
      ...base,
      nombre: 'Baños',
      fechaEntrega: '2026-11-05',
      estado: 'TERMINADA',
      fechaTerminada: '2026-11-10',
    });

    const avance = (
      estado: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE',
      fecha: string,
      tipo: 'DIARIO' | 'TERMINADO' = 'DIARIO',
    ) =>
      crearAvance({
        actividadId: pisos.id,
        empresaId: empresa.id,
        registradoPorId: ana.id,
        estado,
        tipo,
        fechaRegistro: new Date(fecha),
      });
    await avance('APROBADO', '2026-11-24T18:00:00Z');
    await avance('APROBADO', '2026-11-24T19:00:00Z');
    await avance('RECHAZADO', '2026-11-24T20:00:00Z');
    await avance('PENDIENTE', '2026-11-24T21:00:00Z');
    await avance('APROBADO', '2026-11-10T18:00:00Z');
    for (const estado of ['APROBADO', 'RECHAZADO'] as const) {
      const entrega = await avance(estado, '2026-11-24T22:00:00Z', 'TERMINADO');
      await prisma.avanceActividad.update({
        where: { id: entrega.id },
        data: { revisadoEn: new Date('2026-11-24T23:00:00Z'), revisadoPorId: maria.id },
      });
    }
  });

  afterAll(async () => {
    vi.useRealTimers();
    await app.close();
  });

  const consultar = (usuario: Parameters<typeof iniciarSesion>[1], periodo?: string) =>
    app.inject({
      method: 'GET',
      url: periodo ? `${ruta}?periodo=${periodo}` : ruta,
      headers: iniciarSesion(app, usuario),
    });

  it('CP20-E1 la semana va del lunes a hoy y hoy todavía no cuenta como falta', async () => {
    const respuesta = await consultar(escenario.maria, 'SEMANA');

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      trabajador: { nombre: 'Ana Sánchez' },
      periodo: { tipo: 'SEMANA', desde: '2026-11-23', hasta: '2026-11-25' },
      asistencia: { porcentaje: 50, completos: 1, total: 2, retardos: 1, faltas: 0 },
      evidencias: { porcentaje: 60, aprobadas: 3, rechazadas: 2, pendientes: 1 },
      actividadesEntregadas: { total: 2, antes: 1, mismoDia: 1, conRetraso: 0 },
      actividadesAprobadas: { porcentaje: 50, aprobadas: 1, rechazadas: 1 },
    });
  });

  it('CP20-E2 el mes cuenta las faltas calculadas y las entregas con retraso', async () => {
    const respuesta = await consultar(escenario.dueno, 'MES');

    // Noviembre de lunes a sábado hasta el 24: 20 días laborables; 18 sin registro son faltas.
    expect(respuesta.json()).toMatchObject({
      periodo: { desde: '2026-11-01', hasta: '2026-11-25' },
      asistencia: { porcentaje: 5, completos: 1, total: 20, retardos: 1, faltas: 18 },
      evidencias: { aprobadas: 4, rechazadas: 2 },
      actividadesEntregadas: { total: 3, antes: 1, mismoDia: 1, conRetraso: 1 },
    });
  });

  it('CP20-E3 "Todo" empieza en el alta del trabajador y el periodo por defecto es el mes', async () => {
    const todo = await consultar(escenario.dueno, 'TODO');
    const sinPeriodo = await consultar(escenario.dueno);

    expect(todo.json().periodo.desde).toBe('2026-01-01');
    expect(sinPeriodo.json().periodo.tipo).toBe('MES');
  });

  it('CP20-A1 sin datos los porcentajes son null', async () => {
    const nuevo = await crearUsuario({ rol: 'TRABAJADOR', empresaId: escenario.empresa.id });
    await prisma.obra.update({
      where: { id: escenario.obra.id },
      data: { trabajadores: { connect: { id: nuevo.id } } },
    });
    await prisma.usuario.update({ where: { id: nuevo.id }, data: { creadoEn: AHORA } });

    const respuesta = await app.inject({
      method: 'GET',
      url: `/asistencia/trabajadores/${nuevo.id}/desempeno?periodo=SEMANA`,
      headers: iniciarSesion(app, escenario.dueno),
    });

    expect(respuesta.json()).toMatchObject({
      asistencia: { porcentaje: null, total: 0 },
      evidencias: { porcentaje: null },
      actividadesAprobadas: { porcentaje: null },
    });
  });

  it('CP20-A2 el trabajador, otro supervisor u otra empresa no ven las métricas', async () => {
    const otroSupervisor = await crearUsuario({
      rol: 'SUPERVISOR',
      empresaId: escenario.empresa.id,
    });

    expect((await consultar(escenario.ana)).statusCode).toBe(403);
    expect((await consultar(otroSupervisor)).statusCode).toBe(403);
    expect(
      (await consultar({ ...escenario.dueno, empresaId: escenario.otraEmpresa.id })).statusCode,
    ).toBe(404);
    expect((await consultar(escenario.dueno, 'ANIO')).statusCode).toBe(400);
  });
});
