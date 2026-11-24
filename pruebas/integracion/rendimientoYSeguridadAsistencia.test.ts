/**
 * @archivo rendimientoYSeguridadAsistencia.test.ts
 * @proyecto Civil Trace
 * @descripcion Metas de rendimiento del plan (lote de 100 escaneos < 5 s, calendario < 1 s) y
 *   comprobaciones de seguridad: el token del QR solo lo ve su dueño y la asistencia no se borra.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-27 Registrar asistencia por el supervisor, RF-58 Mostrar calendario de
 *   asistencia, constitución IV.6
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001, T039-T040)
 */

// 1. Importaciones
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/baseDatos/clientePrisma';
import { obtenerOCrearCredencial } from '@/servicios/servicioCredencialAsistencia';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import {
  construirAppPrueba,
  crearEscenarioBase,
  crearHorario,
  crearUsuario,
  iniciarSesion,
} from '../configuracion/fabricas';

// 3. Constantes del módulo
const TRABAJADORES_DEL_LOTE = 100;
const MAXIMO_MS_LOTE = 5_000;
const MAXIMO_MS_CALENDARIO = 1_000;

// 4. Pruebas
describe('Rendimiento y seguridad de asistencia', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
  const codigos: string[] = [];

  beforeAll(async () => {
    await limpiarTablas();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T16:02:00Z'));
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    await crearHorario({
      obraId: escenario.obra.id,
      empresaId: escenario.empresa.id,
      creadoPorId: escenario.maria.id,
    });
    for (let indice = 0; indice < TRABAJADORES_DEL_LOTE; indice += 1) {
      const trabajador = await crearUsuario({ rol: 'TRABAJADOR', empresaId: escenario.empresa.id });
      await prisma.obra.update({
        where: { id: escenario.obra.id },
        data: { trabajadores: { connect: { id: trabajador.id } } },
      });
      codigos.push((await obtenerOCrearCredencial(trabajador.id, escenario.empresa.id)).codigoQr);
    }
  });

  afterAll(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('CP21-A34 un lote de 100 escaneos se procesa en menos de 5 s', async () => {
    const inicio = performance.now();
    const respuesta = await app.inject({
      method: 'POST',
      url: '/asistencia/registros',
      headers: iniciarSesion(app, escenario.maria),
      payload: {
        escaneos: codigos.map((codigoQr) => ({
          idLocal: randomUUID(),
          obraId: escenario.obra.id,
          codigoQr,
          capturadoEn: '2026-11-20T16:00:00.000Z',
          sinConexion: true,
          latitud: null,
          longitud: null,
        })),
      },
    });
    const duracion = performance.now() - inicio;

    expect(respuesta.statusCode).toBe(200);
    expect(
      respuesta.json().resultados.every((r: { estado: string }) => r.estado === 'GUARDADO'),
    ).toBe(true);
    expect(duracion).toBeLessThan(MAXIMO_MS_LOTE);
  });

  it('CP19-A15 el calendario mensual responde en menos de 1 s', async () => {
    const inicio = performance.now();
    const respuesta = await app.inject({
      method: 'GET',
      url: `/asistencia/trabajadores/${escenario.ana.id}/calendario?mes=2026-11`,
      headers: iniciarSesion(app, escenario.maria),
    });

    expect(respuesta.statusCode).toBe(200);
    expect(performance.now() - inicio).toBeLessThan(MAXIMO_MS_CALENDARIO);
  });

  it('CP21-A35 el token del QR solo aparece en la respuesta de su dueño', async () => {
    const credencial = await obtenerOCrearCredencial(escenario.ana.id, escenario.empresa.id);
    const token = credencial.codigoQr.slice('ct1.'.length);
    const rutas = [
      `/obras/${escenario.obra.id}/asistencia/paquete-sin-conexion`,
      `/obras/${escenario.obra.id}/asistencia`,
      `/asistencia/trabajadores/${escenario.ana.id}/calendario?mes=2026-11`,
      `/obras/${escenario.obra.id}/horario`,
    ];
    for (const url of rutas) {
      const respuesta = await app.inject({
        method: 'GET',
        url,
        headers: iniciarSesion(app, escenario.maria),
      });
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.body).not.toContain(token);
    }
  });

  it('CP21-A36 no existe ninguna ruta para borrar asistencia, horarios ni credenciales', () => {
    const rutas = app.printRoutes({ commonPrefix: false });
    // Sanidad: el listado incluye los métodos, así que la búsqueda de DELETE es significativa.
    expect(rutas).toContain('PATCH');
    const lineasBorrado = rutas.split('\n').filter((linea) => linea.includes('DELETE'));

    expect(lineasBorrado.filter((linea) => /asistencia|horario|credencial/i.test(linea))).toEqual(
      [],
    );
  });
});
