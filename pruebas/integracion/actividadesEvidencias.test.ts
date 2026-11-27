/**
 * @archivo actividadesEvidencias.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas de actividades y evidencias para supervisor y trabajador (feature 003):
 *   permisos por obra y responsable, evidencia pendiente de revisión (D-10), revisión con
 *   observación, terminación al aprobar la entrega y reportes solo con evidencias aprobadas.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos D-10, spec 003 (R1–R8), CP10–CP15 del plan de pruebas
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 003)
 */

// 1. Importaciones
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import '../configuracion/dobleAlmacenamiento';
import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import {
  construirAppPrueba,
  crearEscenarioBase,
  crearUsuario,
  iniciarSesion,
} from '../configuracion/fabricas';

// 2. Tipos e interfaces
type Escenario = Awaited<ReturnType<typeof crearEscenarioBase>>;
type Usuario = Escenario['ana'];

// 3. Constantes del módulo
const FOTO = Buffer.from('foto-de-prueba');
// Feature 007 (RF-08): toda evidencia lleva ubicación.
const UBICACION = { 'x-latitud': '32.6245', 'x-longitud': '-115.4523' };

// 4. Pruebas
describe('Actividades y evidencias (feature 003)', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Escenario;
  let otroSupervisor: Usuario;
  let luis: Usuario;

  const crearActividad = (usuario: Usuario, datos: Record<string, unknown> = {}) =>
    app.inject({
      method: 'POST',
      url: `/obras/${escenario.obra.id}/actividades`,
      headers: iniciarSesion(app, usuario),
      payload: {
        nombre: 'Colocar loseta',
        descripcion: 'Colocar loseta en el baño del segundo piso',
        fechaInicio: '2026-10-02',
        fechaEntrega: '2026-10-27',
        responsableId: escenario.ana.id,
        ...datos,
      },
    });

  const subirEvidencia = (
    usuario: Usuario,
    idActividad: string,
    tipo?: 'DIARIO' | 'TERMINADO',
    comentario = 'Avance de hoy',
  ) =>
    app.inject({
      method: 'POST',
      url: `/obras/${escenario.obra.id}/actividades/${idActividad}/avances`,
      headers: {
        ...iniciarSesion(app, usuario),
        'content-type': 'image/png',
        'x-comentario-avance': encodeURIComponent(comentario),
        ...UBICACION,
        ...(tipo ? { 'x-tipo-avance': tipo } : {}),
      },
      payload: FOTO,
    });

  const revisar = (
    usuario: Usuario,
    idActividad: string,
    idAvance: string,
    cuerpo: Record<string, unknown>,
  ) =>
    app.inject({
      method: 'PATCH',
      url: `/obras/${escenario.obra.id}/actividades/${idActividad}/avances/${idAvance}/revision`,
      headers: iniciarSesion(app, usuario),
      payload: cuerpo,
    });

  const detalle = (usuario: Usuario, idActividad: string) =>
    app.inject({
      method: 'GET',
      url: `/obras/${escenario.obra.id}/actividades/${idActividad}`,
      headers: iniciarSesion(app, usuario),
    });

  beforeAll(async () => {
    await limpiarTablas();
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    otroSupervisor = await crearUsuario({
      rol: 'SUPERVISOR',
      empresaId: escenario.empresa.id,
      nombre: 'Mario Ruiz',
    });
    luis = await crearUsuario({
      rol: 'TRABAJADOR',
      empresaId: escenario.empresa.id,
      nombre: 'Luis Gómez',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CP10 Registrar actividad', () => {
    it('CP10-A10 el supervisor de la obra crea una actividad con descripción y fecha de inicio', async () => {
      const respuesta = await crearActividad(escenario.maria);

      expect(respuesta.statusCode).toBe(201);
      expect(respuesta.json().actividad).toMatchObject({
        nombre: 'Colocar loseta',
        descripcion: 'Colocar loseta en el baño del segundo piso',
        fechaInicio: '2026-10-02',
        fechaEntrega: '2026-10-27',
        responsable: 'Ana Sánchez',
        responsableId: escenario.ana.id,
        estado: 'ACTIVA',
        enRevision: false,
      });
    });

    it('CP10-A11 otro supervisor o un trabajador no pueden crear actividades en la obra', async () => {
      expect((await crearActividad(otroSupervisor)).statusCode).toBe(403);
      expect((await crearActividad(escenario.ana)).statusCode).toBe(403);
    });

    it('CP10-A12 la fecha de inicio no puede ser posterior a la entrega', async () => {
      const respuesta = await crearActividad(escenario.maria, { fechaInicio: '2026-11-01' });
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json().mensaje).toBe(
        'La fecha de inicio no puede ser posterior a la de entrega',
      );
    });
  });

  describe('CP11 Consultar actividades', () => {
    it('CP11-A10 el trabajador solo ve las actividades de las que es responsable', async () => {
      await crearActividad(escenario.maria, { nombre: 'Empastar', responsableId: luis.id });

      const lista = await app.inject({
        method: 'GET',
        url: `/obras/${escenario.obra.id}/actividades`,
        headers: iniciarSesion(app, escenario.ana),
      });
      expect(lista.statusCode).toBe(200);
      const nombres = lista.json().actividades.map((a: { nombre: string }) => a.nombre);
      expect(nombres).toContain('Colocar loseta');
      expect(nombres).not.toContain('Empastar');

      const supervisor = await app.inject({
        method: 'GET',
        url: `/obras/${escenario.obra.id}/actividades`,
        headers: iniciarSesion(app, escenario.maria),
      });
      expect(supervisor.json().actividades).toHaveLength(2);
    });

    it('CP11-A11 "mis actividades" junta las activas del trabajador con el nombre de la obra', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/actividades/mias',
        headers: iniciarSesion(app, escenario.ana),
      });
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json().actividades).toEqual([
        expect.objectContaining({
          nombre: 'Colocar loseta',
          obraId: escenario.obra.id,
          obraNombre: escenario.obra.nombre,
        }),
      ]);

      const supervisor = await app.inject({
        method: 'GET',
        url: '/actividades/mias',
        headers: iniciarSesion(app, escenario.maria),
      });
      expect(supervisor.statusCode).toBe(403);
    });

    it('CP11-A12 un supervisor ajeno no ve la obra y otra empresa recibe 404', async () => {
      const ajeno = await app.inject({
        method: 'GET',
        url: `/obras/${escenario.obra.id}/actividades`,
        headers: iniciarSesion(app, otroSupervisor),
      });
      expect(ajeno.statusCode).toBe(403);

      const otraEmpresa = await app.inject({
        method: 'GET',
        url: `/obras/${escenario.obra.id}/actividades`,
        headers: iniciarSesion(app, escenario.trabajadorAjeno),
      });
      expect(otraEmpresa.statusCode).toBe(404);
    });
  });

  describe('CP12 Capturar evidencia', () => {
    let idActividad: string;

    beforeAll(async () => {
      idActividad = (await crearActividad(escenario.maria, { nombre: 'Hacer mezcla' })).json()
        .actividad.id;
    });

    it('CP12-A10 la evidencia del trabajador nace pendiente de revisión (D-10)', async () => {
      const respuesta = await subirEvidencia(escenario.ana, idActividad);

      expect(respuesta.statusCode).toBe(201);
      expect(respuesta.json().avance).toMatchObject({
        estado: 'PENDIENTE',
        tipo: 'DIARIO',
        comentario: 'Avance de hoy',
        registradoPor: 'Ana Sánchez',
      });
    });

    it('CP12-A11 la del supervisor nace aprobada', async () => {
      const respuesta = await subirEvidencia(escenario.maria, idActividad);
      expect(respuesta.json().avance).toMatchObject({ estado: 'APROBADO', tipo: 'DIARIO' });
    });

    it('CP12-A12 un trabajador que no es responsable no puede subir evidencia', async () => {
      expect((await subirEvidencia(luis, idActividad)).statusCode).toBe(403);
    });

    it('CP12-A13 un tipo de evidencia desconocido se rechaza', async () => {
      const respuesta = await app.inject({
        method: 'POST',
        url: `/obras/${escenario.obra.id}/actividades/${idActividad}/avances`,
        headers: {
          ...iniciarSesion(app, escenario.ana),
          'content-type': 'image/png',
          'x-tipo-avance': 'OTRO',
        },
        payload: FOTO,
      });
      expect(respuesta.statusCode).toBe(400);
    });
  });

  describe('CP13 y CP14 Entrega y revisión', () => {
    let idActividad: string;

    beforeAll(async () => {
      idActividad = (await crearActividad(escenario.maria, { nombre: 'Poner piso' })).json()
        .actividad.id;
    });

    it('CP13-A10 la entrega "Terminado" deja la actividad en revisión y no admite otra', async () => {
      const entrega = await subirEvidencia(escenario.ana, idActividad, 'TERMINADO');
      expect(entrega.json().avance).toMatchObject({ estado: 'PENDIENTE', tipo: 'TERMINADO' });

      const actividad = (await detalle(escenario.maria, idActividad)).json().actividad;
      expect(actividad).toMatchObject({ estado: 'ACTIVA', enRevision: true });

      const otra = await subirEvidencia(escenario.ana, idActividad, 'TERMINADO');
      expect(otra.statusCode).toBe(409);
    });

    it('CP14-A10 rechazar exige observación; con ella la actividad vuelve a activarse', async () => {
      const pendiente = (await detalle(escenario.maria, idActividad)).json().actividad.avances[0];

      const sinMotivo = await revisar(escenario.maria, idActividad, pendiente.id, {
        decision: 'RECHAZAR',
      });
      expect(sinMotivo.statusCode).toBe(400);
      expect(sinMotivo.json().mensaje).toBe('Indica el motivo del rechazo');

      const rechazo = await revisar(escenario.maria, idActividad, pendiente.id, {
        decision: 'RECHAZAR',
        observacion: 'El piso tiene desniveles. Corrige la nivelación.',
      });
      expect(rechazo.statusCode).toBe(200);
      expect(rechazo.json().avance).toMatchObject({
        estado: 'RECHAZADO',
        observacion: 'El piso tiene desniveles. Corrige la nivelación.',
        revisadoPor: 'María Castro',
      });
      expect(rechazo.json().avance.revisadoEn).toEqual(expect.any(String));
      expect(rechazo.json().actividad).toMatchObject({ estado: 'ACTIVA', enRevision: false });
    });

    it('CP14-A11 un avance ya revisado no se vuelve a revisar y el trabajador no puede revisar', async () => {
      const revisado = (await detalle(escenario.maria, idActividad)).json().actividad.avances[0];
      const otraVez = await revisar(escenario.maria, idActividad, revisado.id, {
        decision: 'APROBAR',
      });
      expect(otraVez.statusCode).toBe(409);

      const nueva = (await subirEvidencia(escenario.ana, idActividad, 'TERMINADO')).json().avance;
      const porTrabajador = await revisar(escenario.ana, idActividad, nueva.id, {
        decision: 'APROBAR',
      });
      expect(porTrabajador.statusCode).toBe(403);
    });

    it('CP14-A12 aprobar la entrega termina la actividad; ya no admite evidencias', async () => {
      const pendiente = (await detalle(escenario.maria, idActividad))
        .json()
        .actividad.avances.find((a: { estado: string }) => a.estado === 'PENDIENTE');

      const aprobacion = await revisar(escenario.maria, idActividad, pendiente.id, {
        decision: 'APROBAR',
      });
      expect(aprobacion.statusCode).toBe(200);
      expect(aprobacion.json().avance).toMatchObject({ estado: 'APROBADO', observacion: null });
      expect(aprobacion.json().actividad).toMatchObject({
        estado: 'TERMINADA',
        enRevision: false,
        fechaTerminada: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });

      expect((await subirEvidencia(escenario.ana, idActividad)).statusCode).toBe(409);
    });

    it('CP13-A11 si el supervisor sube "Terminado", la actividad termina sin revisión', async () => {
      const id = (await crearActividad(escenario.maria, { nombre: 'Pintar' })).json().actividad.id;
      const entrega = await subirEvidencia(escenario.maria, id, 'TERMINADO');

      expect(entrega.json().avance).toMatchObject({ estado: 'APROBADO', tipo: 'TERMINADO' });
      expect((await detalle(escenario.ana, id)).json().actividad.estado).toBe('TERMINADA');
    });
  });

  describe('CP13 Terminar a mano y fotos', () => {
    it('CP13-A12 el supervisor termina o reactiva una actividad a mano; otro supervisor no', async () => {
      const id = (await crearActividad(escenario.maria, { nombre: 'Limpiar' })).json().actividad.id;
      const cambiar = (usuario: Usuario, estado: string, fechaTerminada?: string) =>
        app.inject({
          method: 'PATCH',
          url: `/obras/${escenario.obra.id}/actividades/${id}/estado`,
          headers: iniciarSesion(app, usuario),
          payload: { estado, ...(fechaTerminada ? { fechaTerminada } : {}) },
        });

      expect((await cambiar(otroSupervisor, 'TERMINADA')).statusCode).toBe(403);
      const terminada = await cambiar(escenario.maria, 'TERMINADA', '2026-10-20');
      expect(terminada.json().actividad).toMatchObject({
        estado: 'TERMINADA',
        fechaTerminada: '2026-10-20',
      });
      const hoy = await cambiar(escenario.dueno, 'TERMINADA');
      expect(hoy.json().actividad.fechaTerminada).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const activa = await cambiar(escenario.maria, 'ACTIVA');
      expect(activa.json().actividad).toMatchObject({ estado: 'ACTIVA', fechaTerminada: null });
    });

    it('CP11-A13 el responsable descarga la foto de su evidencia; otro trabajador no', async () => {
      const id = (await crearActividad(escenario.maria, { nombre: 'Resanar' })).json().actividad.id;
      const avance = (await subirEvidencia(escenario.ana, id)).json().avance;
      const foto = (usuario: Usuario, idAvance = avance.id) =>
        app.inject({
          method: 'GET',
          url: `/obras/${escenario.obra.id}/actividades/${id}/avances/${idAvance}/foto`,
          headers: iniciarSesion(app, usuario),
        });

      const propia = await foto(escenario.ana);
      expect(propia.statusCode).toBe(200);
      expect(propia.headers['content-type']).toContain('image/png');
      expect((await foto(luis)).statusCode).toBe(403);
      expect((await foto(escenario.maria, 'no-existe')).statusCode).toBe(404);
    });

    it('CP14-A13 revisar una evidencia que no existe responde 404', async () => {
      const id = (await crearActividad(escenario.maria, { nombre: 'Barrer' })).json().actividad.id;
      const respuesta = await revisar(escenario.maria, id, 'no-existe', { decision: 'APROBAR' });
      expect(respuesta.statusCode).toBe(404);
    });
  });

  describe('CP15 Reporte', () => {
    it('CP15-A10 el reporte solo incluye evidencias aprobadas (D-10)', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: `/obras/${escenario.obra.id}/reporte`,
        headers: iniciarSesion(app, escenario.dueno),
      });
      expect(respuesta.statusCode).toBe(200);
      const estados = respuesta
        .json()
        .actividades.flatMap((a: { avances: { estado: string }[] }) =>
          a.avances.map((avance) => avance.estado),
        );
      expect(estados.length).toBeGreaterThan(0);
      expect(new Set(estados)).toEqual(new Set(['APROBADO']));
    });
  });
});
