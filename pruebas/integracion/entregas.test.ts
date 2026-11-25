/**
 * @archivo entregas.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del envío de entregas al cliente por rango de fechas con solo las fotos
 *   aprobadas, su lista en la app y en el portal (historia 3 del feature 004).
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-13 Enviar entrega al cliente, RF-67 Consultar entregas en el portal del cliente
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/baseDatos/clientePrisma';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import {
  extraerTokenPortal,
  obtenerUltimoCorreo,
  restaurarCorreo,
  simularFalloCorreo,
} from '../configuracion/dobleCorreo';
import {
  construirAppPrueba,
  crearActividad,
  crearAvance,
  crearEscenarioBase,
  crearObra,
  crearUsuario,
  iniciarSesion,
} from '../configuracion/fabricas';

// 3. Constantes del módulo
const CORREO_CLIENTE = 'cliente.hospital@ejemplo.com';
const RANGO = { fechaInicio: '2026-11-01', fechaFin: '2026-11-05' };

// 4. Pruebas
describe('Enviar entregas al cliente (RF-13, D-29)', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
  let rutaEntregas: string;
  let actividadMuros: string;

  beforeAll(async () => {
    await limpiarTablas();
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    const { obra, empresa } = escenario;
    await prisma.obra.update({ where: { id: obra.id }, data: { correoCliente: CORREO_CLIENTE } });
    rutaEntregas = `/obras/${obra.id}/entregas`;

    const pisos = await crearActividad({ obraId: obra.id, empresaId: empresa.id, nombre: 'Pisos' });
    const muros = await crearActividad({ obraId: obra.id, empresaId: empresa.id, nombre: 'Muros' });
    const banos = await crearActividad({ obraId: obra.id, empresaId: empresa.id, nombre: 'Baños' });
    actividadMuros = muros.id;
    const base = { empresaId: empresa.id };
    await crearAvance({
      ...base,
      actividadId: pisos.id,
      fechaRegistro: new Date('2026-11-02T18:00:00Z'),
    });
    await crearAvance({
      ...base,
      actividadId: pisos.id,
      fechaRegistro: new Date('2026-11-03T18:00:00Z'),
    });
    // 22:00 del 5 de noviembre en Tijuana (6 de noviembre en UTC): sí entra en el rango.
    await crearAvance({
      ...base,
      actividadId: muros.id,
      fechaRegistro: new Date('2026-11-06T05:00:00Z'),
    });
    await crearAvance({
      ...base,
      actividadId: muros.id,
      estado: 'PENDIENTE',
      fechaRegistro: new Date('2026-11-04T18:00:00Z'),
    });
    await crearAvance({
      ...base,
      actividadId: banos.id,
      fechaRegistro: new Date('2026-11-08T18:00:00Z'),
    });
  });

  beforeEach(() => {
    restaurarCorreo();
  });

  afterAll(async () => {
    restaurarCorreo();
    await app.close();
  });

  const enviar = (
    usuario: { id: string; rol: 'DUENO' | 'SUPERVISOR' | 'TRABAJADOR'; empresaId: string | null },
    rango = RANGO,
    ruta = rutaEntregas,
  ) =>
    app.inject({ method: 'POST', url: ruta, headers: iniciarSesion(app, usuario), payload: rango });

  it('CP16-E4 un trabajador o un supervisor de otra obra no pueden enviar entregas', async () => {
    const otroSupervisor = await crearUsuario({
      rol: 'SUPERVISOR',
      empresaId: escenario.empresa.id,
    });

    expect((await enviar(escenario.ana)).statusCode).toBe(403);
    expect((await enviar(otroSupervisor)).statusCode).toBe(403);
    const ajeno = await enviar({ ...escenario.dueno, empresaId: escenario.otraEmpresa.id });
    expect(ajeno.statusCode).toBe(404);
    expect(await prisma.entrega.count()).toBe(0);
  });

  it('CP16-E1 el supervisor envía el rango: solo fotos aprobadas, publicada y avisada por correo', async () => {
    const respuesta = await enviar(escenario.maria);

    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toMatchObject({
      estado: 'ENVIADA',
      ...RANGO,
      actividades: 2,
      fotos: 3,
      enlacePortal: 'ENVIADO',
    });
    const correo = obtenerUltimoCorreo(CORREO_CLIENTE);
    expect(correo?.asunto).toBe('Nueva entrega de Hospital para tu revisión');
    expect(correo?.texto).toContain('01/11/2026 al 05/11/2026');

    const portal = await app.inject({
      method: 'GET',
      url: '/portal/entregas',
      headers: { 'x-token-portal': extraerTokenPortal(correo) ?? '' },
    });
    expect(portal.statusCode).toBe(200);
    expect(portal.json()).toEqual([
      expect.objectContaining({ estado: 'ENVIADA', ...RANGO, actividades: 2, fotos: 3 }),
    ]);
  });

  it('CP16-E5 un rango encimado solo lleva las fotos aprobadas que no se habían enviado (P-15)', async () => {
    const repetida = await enviar(escenario.maria);
    expect(repetida.statusCode).toBe(400);
    expect(repetida.json().motivo).toBe('SIN_FOTOS_APROBADAS');

    await crearAvance({
      actividadId: actividadMuros,
      empresaId: escenario.empresa.id,
      fechaRegistro: new Date('2026-11-04T20:00:00Z'),
    });
    const nueva = await enviar(escenario.dueno, {
      fechaInicio: '2026-11-03',
      fechaFin: '2026-11-08',
    });
    expect(nueva.statusCode).toBe(201);
    // La foto nueva de Muros y la de Baños (8 de noviembre); las del primer envío ya no van.
    expect(nueva.json()).toMatchObject({ actividades: 2, fotos: 2 });
  });

  it('CP16-E2 un rango sin fotos aprobadas no crea la entrega', async () => {
    const respuesta = await enviar(escenario.maria, {
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-31',
    });

    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toMatchObject({
      motivo: 'SIN_FOTOS_APROBADAS',
      mensaje: 'No hay avances aprobados en ese rango de fechas',
    });
  });

  it('CP16-E3 una obra sin correo del cliente no puede enviar entregas', async () => {
    const obraSinCorreo = await crearObra({
      empresaId: escenario.empresa.id,
      supervisorId: escenario.maria.id,
      nombre: 'Sin correo',
    });

    const respuesta = await enviar(escenario.maria, RANGO, `/obras/${obraSinCorreo.id}/entregas`);

    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json().motivo).toBe('SIN_CORREO_CLIENTE');
  });

  it('CP16-A1 el rango debe ser válido', async () => {
    const invertido = await enviar(escenario.maria, {
      fechaInicio: '2026-11-05',
      fechaFin: '2026-11-01',
    });
    expect(invertido.statusCode).toBe(400);
    const sinFechas = await app.inject({
      method: 'POST',
      url: rutaEntregas,
      headers: iniciarSesion(app, escenario.maria),
      payload: {},
    });
    expect(sinFechas.statusCode).toBe(400);
  });

  it('CP16-A2 si el aviso por correo falla la entrega sí queda publicada', async () => {
    await crearAvance({
      actividadId: actividadMuros,
      empresaId: escenario.empresa.id,
      fechaRegistro: new Date('2026-11-20T18:00:00Z'),
    });
    simularFalloCorreo();

    const respuesta = await enviar(escenario.maria, {
      fechaInicio: '2026-11-20',
      fechaFin: '2026-11-20',
    });

    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toMatchObject({ estado: 'ENVIADA', enlacePortal: 'FALLIDO' });
  });

  it('CP16-A3 la app lista las entregas de la obra, la más reciente primero', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: rutaEntregas,
      headers: iniciarSesion(app, escenario.maria),
    });

    expect(respuesta.statusCode).toBe(200);
    const entregas =
      respuesta.json<{ fechaInicio: string; enviadaPor: string; estado: string }[]>();
    expect(entregas.map((entrega) => entrega.fechaInicio)).toEqual([
      '2026-11-20',
      '2026-11-03',
      '2026-11-01',
    ]);
    expect(entregas[2]).toMatchObject({ enviadaPor: 'María Castro', estado: 'ENVIADA' });
    const trabajador = await app.inject({
      method: 'GET',
      url: rutaEntregas,
      headers: iniciarSesion(app, escenario.ana),
    });
    expect(trabajador.statusCode).toBe(403);
  });
});
