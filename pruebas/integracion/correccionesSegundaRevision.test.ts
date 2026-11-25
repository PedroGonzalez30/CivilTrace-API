/**
 * @archivo correccionesSegundaRevision.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del feature 006: asignar trabajadores a una obra ya creada (RF-68), horas
 *   descontadas en los detalles de asistencia (D-35) y falta el mismo día al pasar la hora de
 *   salida (D-34). La fecha del sistema se fija para que el horario sea predecible.
 * @autor Emilio Manuel Esquivel
 * @fecha 25/11/2026
 * @version 1.0.0
 * @requerimientos RF-68 Asignar trabajadores a una obra, RF-63 Registrar observación de asistencia,
 *   RF-59 Mostrar calendario de asistencia (SRS v5.0)
 * @historial 25/11/2026 - Emilio Manuel Esquivel - Creación (feature 006)
 */

// 1. Importaciones
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import {
  construirAppPrueba,
  crearEmpresa,
  crearEscenarioBase,
  crearHorario,
  crearUsuario,
  iniciarSesion,
} from '../configuracion/fabricas';

// 3. Constantes del módulo
// Miércoles 25/11/2026: 15:30 y 16:30 en Tijuana; el horario de la obra es de 8:00 a 16:00.
const ANTES_DE_LA_SALIDA = new Date('2026-11-25T23:30:00Z');
const DESPUES_DE_LA_SALIDA = new Date('2026-11-26T00:30:00Z');

// 4. Pruebas
describe('Correcciones de la segunda revisión (feature 006)', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(ANTES_DE_LA_SALIDA);
    await limpiarTablas();
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

  describe('RF-68 asignar trabajadores a una obra ya creada', () => {
    it('CP09-A10 el supervisor de la obra asigna trabajadores sin duplicar', async () => {
      const luis = await crearUsuario({
        rol: 'TRABAJADOR',
        empresaId: escenario.empresa.id,
        nombre: 'Luis Gómez',
      });
      const ruta = `/obras/${escenario.obra.id}/trabajadores`;

      const antes = await app.inject({
        method: 'GET',
        url: ruta,
        headers: iniciarSesion(app, escenario.maria),
      });
      expect(antes.json().disponibles.map((t: { nombre: string }) => t.nombre)).toContain(
        'Luis Gómez',
      );

      const respuesta = await app.inject({
        method: 'POST',
        url: ruta,
        headers: iniciarSesion(app, escenario.maria),
        payload: { trabajadoresIds: [luis.id, escenario.ana.id] },
      });

      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json().yaAsignados).toEqual([escenario.ana.id]);
      expect(
        respuesta
          .json()
          .asignados.map((t: { id: string }) => t.id)
          .sort(),
      ).toEqual([escenario.ana.id, luis.id].sort());
    });

    it('CP09-A11 solo el supervisor de la obra o el dueño, y solo trabajadores de la empresa', async () => {
      const ruta = `/obras/${escenario.obra.id}/trabajadores`;
      const otroSupervisor = await crearUsuario({
        rol: 'SUPERVISOR',
        empresaId: escenario.empresa.id,
      });
      const ajena = await crearEmpresa('Ajena');
      const trabajadorAjeno = await crearUsuario({ rol: 'TRABAJADOR', empresaId: ajena.id });
      const enviar = (usuario: Parameters<typeof iniciarSesion>[1], ids: string[]) =>
        app.inject({
          method: 'POST',
          url: ruta,
          headers: iniciarSesion(app, usuario),
          payload: { trabajadoresIds: ids },
        });

      expect((await enviar(otroSupervisor, [escenario.ana.id])).statusCode).toBe(403);
      expect((await enviar(escenario.ana, [escenario.ana.id])).statusCode).toBe(403);
      expect((await enviar(escenario.dueno, [trabajadorAjeno.id])).statusCode).toBe(400);
      expect((await enviar(escenario.dueno, [])).statusCode).toBe(400);
      expect((await enviar(escenario.dueno, [escenario.ana.id])).statusCode).toBe(200);
    });
  });

  describe('D-35 horas descontadas', () => {
    const rutaDia = (fecha: string) =>
      `/obras/${escenario.obra.id}/asistencia/trabajadores/${escenario.ana.id}/dias/${fecha}`;

    it('CP19-A20 el supervisor registra horas a descontar y queda en el historial', async () => {
      const respuesta = await app.inject({
        method: 'PATCH',
        url: rutaDia('2026-11-24'),
        headers: iniciarSesion(app, escenario.maria),
        payload: { tipoJornada: 'RETARDO', anotacion: 'Llegó tarde', horasDescontadas: 1.5 },
      });

      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toMatchObject({ horasDescontadas: 1.5, conDescuento: true });
      expect(respuesta.json().cambios).toContainEqual(
        expect.objectContaining({ campo: 'horasDescontadas', valorNuevo: '1.5' }),
      );

      const quitar = await app.inject({
        method: 'PATCH',
        url: rutaDia('2026-11-24'),
        headers: iniciarSesion(app, escenario.maria),
        payload: { horasDescontadas: 0 },
      });
      expect(quitar.json()).toMatchObject({ horasDescontadas: null, conDescuento: false });
    });

    it('CP19-A21 las horas van en pasos de media hora y sin negativos', async () => {
      for (const horasDescontadas of [0.3, -1, 13]) {
        const respuesta = await app.inject({
          method: 'PATCH',
          url: rutaDia('2026-11-23'),
          headers: iniciarSesion(app, escenario.maria),
          payload: { anotacion: 'Prueba', horasDescontadas },
        });
        expect(respuesta.statusCode).toBe(400);
      }
    });
  });

  describe('D-34 falta el mismo día al pasar la hora de salida', () => {
    const consultarHoy = () =>
      app.inject({
        method: 'GET',
        url: `/obras/${escenario.obra.id}/asistencia?fecha=2026-11-25`,
        headers: iniciarSesion(app, escenario.maria),
      });
    const tipoDeAna = (cuerpo: { trabajadores: { id: string; tipoJornada: string | null }[] }) =>
      cuerpo.trabajadores.find((t) => t.id === escenario.ana.id)?.tipoJornada;

    it('CP19-A22 antes de la salida no es falta; después sí, en el resumen y el calendario', async () => {
      vi.setSystemTime(ANTES_DE_LA_SALIDA);
      expect(tipoDeAna((await consultarHoy()).json())).toBeNull();

      vi.setSystemTime(DESPUES_DE_LA_SALIDA);
      expect(tipoDeAna((await consultarHoy()).json())).toBe('FALTA');

      const calendario = await app.inject({
        method: 'GET',
        url: `/asistencia/trabajadores/${escenario.ana.id}/calendario?mes=2026-11`,
        headers: iniciarSesion(app, escenario.maria),
      });
      const hoy = calendario
        .json()
        .dias.find((dia: { fecha: string }) => dia.fecha === '2026-11-25');
      expect(hoy).toMatchObject({ tipoJornada: 'FALTA', esFaltaCalculada: true });
    });
  });

  describe('D-12 reglas de contraseña al registrarse', () => {
    it('CP02-A10 rechaza contraseñas sin mayúscula, minúscula o número', async () => {
      const registrar = (contrasena: string) =>
        app.inject({
          method: 'POST',
          url: '/auth/registro',
          payload: {
            nombre: 'Dueña Nueva',
            correo: `duena.${contrasena.length}.${contrasena.charCodeAt(0)}@ejemplo.com`,
            contrasena,
            rol: 'DUENO',
            empresa: 'Constructora Nueva',
          },
        });

      expect((await registrar('sinmayuscula1')).json().mensaje).toBe(
        'La contraseña debe tener una mayúscula',
      );
      expect((await registrar('SINMINUSCULA1')).json().mensaje).toBe(
        'La contraseña debe tener una minúscula',
      );
      expect((await registrar('SinNumeros')).json().mensaje).toBe(
        'La contraseña debe tener un número',
      );
      expect((await registrar('Segura123')).statusCode).toBe(201);
    });
  });
});
