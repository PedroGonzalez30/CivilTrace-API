/**
 * @archivo actaEntrega.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del reporte y el acta en PDF de una entrega (mismo archivo en la app y en
 *   el portal) y del bloqueo de actividades de entregas aceptadas (historia 6 del feature 004).
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-16 Generar acta de entrega-recepción, RF-17 Bloquear entrega aceptada,
 *   RF-71 Descargar documentos de una entrega en el portal
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/baseDatos/clientePrisma';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import {
  extraerCodigo,
  extraerTokenPortal,
  obtenerUltimoCorreo,
} from '../configuracion/dobleCorreo';
import {
  construirAppPrueba,
  crearActividad,
  crearAvance,
  crearEscenarioBase,
  iniciarSesion,
} from '../configuracion/fabricas';

// 3. Constantes del módulo
const CORREO_CLIENTE = 'cliente.acta@ejemplo.com';
const FIRMA = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  randomBytes(100),
]);
const NOMBRE = 'Maria Fernanda Lopez';

// 4. Funciones de apoyo
// pdfkit escribe el texto en hexadecimal y lo parte por el interletrado: <486f73> 30 <706974>.
function contieneTexto(pdf: Buffer, texto: string): boolean {
  const contenido = pdf.toString('latin1').replace(/>\s*-?\d+(\.\d+)?\s*</g, '');
  const lineas = [...contenido.matchAll(/<([0-9a-fA-F]+)>/g)].map((grupo) =>
    Buffer.from(grupo[1] ?? '', 'hex').toString('latin1'),
  );
  return lineas.some((linea) => linea.includes(texto));
}

const sha256 = (datos: Buffer) => createHash('sha256').update(datos).digest('hex');

// 5. Pruebas
describe('Acta, descargas y bloqueo de entregas (RF-16, RF-17, RF-71)', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
  let token: string;
  let terminada: string;
  let enCurso: string;
  let entregaAceptada: string;
  let entregaEnviada: string;

  async function enviarDia(dia: string): Promise<string> {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/obras/${escenario.obra.id}/entregas`,
      headers: iniciarSesion(app, escenario.maria),
      payload: { fechaInicio: dia, fechaFin: dia },
    });
    token = extraerTokenPortal(obtenerUltimoCorreo(CORREO_CLIENTE)) ?? token;
    return respuesta.json().id;
  }

  const portal = (metodo: 'GET' | 'POST', url: string, cuerpo?: object) =>
    app.inject({
      method: metodo,
      url,
      headers: { 'x-token-portal': token },
      ...(cuerpo ? { payload: cuerpo } : {}),
    });

  const rutaApp = (entregaId: string) => `/obras/${escenario.obra.id}/entregas/${entregaId}`;

  beforeAll(async () => {
    await limpiarTablas();
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    const { obra, empresa } = escenario;
    await prisma.obra.update({ where: { id: obra.id }, data: { correoCliente: CORREO_CLIENTE } });
    terminada = (
      await crearActividad({
        obraId: obra.id,
        empresaId: empresa.id,
        nombre: 'Pisos y puertas',
        estado: 'TERMINADA',
        fechaTerminada: '2026-11-04',
      })
    ).id;
    enCurso = (
      await crearActividad({ obraId: obra.id, empresaId: empresa.id, nombre: 'Muros del pasillo' })
    ).id;
    for (const actividadId of [terminada, enCurso]) {
      await crearAvance({
        actividadId,
        empresaId: empresa.id,
        fechaRegistro: new Date('2026-11-04T18:00:00Z'),
      });
    }
    await crearAvance({
      actividadId: enCurso,
      empresaId: empresa.id,
      fechaRegistro: new Date('2026-11-10T18:00:00Z'),
    });

    entregaAceptada = await enviarDia('2026-11-04');
    await portal('POST', `/portal/entregas/${entregaAceptada}/codigo`);
    const codigo = extraerCodigo(obtenerUltimoCorreo(CORREO_CLIENTE)) ?? '';
    await portal('POST', `/portal/entregas/${entregaAceptada}/aceptar`, {
      codigo,
      nombre: NOMBRE,
      firmaPng: FIRMA.toString('base64'),
    });
    entregaEnviada = await enviarDia('2026-11-10');
  });

  afterAll(async () => {
    await app.close();
  });

  it('CP17-E6 el supervisor genera el acta con obra, actividades y aceptación del cliente', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `${rutaApp(entregaAceptada)}/acta.pdf`,
      headers: iniciarSesion(app, escenario.maria),
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.headers['content-type']).toBe('application/pdf');
    const pdf = respuesta.rawPayload;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    for (const texto of ['Hospital', 'Pisos y puertas', NOMBRE, sha256(FIRMA)]) {
      expect(contieneTexto(pdf, texto)).toBe(true);
    }
    const entrega = await prisma.entrega.findUniqueOrThrow({ where: { id: entregaAceptada } });
    expect(entrega.actaSha256).toBe(sha256(pdf));
  });

  it('CP17-E7 una entrega que no está aceptada no tiene acta', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `${rutaApp(entregaEnviada)}/acta.pdf`,
      headers: iniciarSesion(app, escenario.dueno),
    });

    expect(respuesta.statusCode).toBe(409);
    expect(respuesta.json()).toMatchObject({
      motivo: 'ENTREGA_NO_ACEPTADA',
      mensaje: 'El acta se genera al aceptar la entrega',
    });
  });

  it('CP17-E8 el cliente descarga el mismo reporte y la misma acta que la app', async () => {
    const actaApp = await app.inject({
      method: 'GET',
      url: `${rutaApp(entregaAceptada)}/acta.pdf`,
      headers: iniciarSesion(app, escenario.dueno),
    });
    const reporteApp = await app.inject({
      method: 'GET',
      url: `${rutaApp(entregaAceptada)}/reporte.pdf`,
      headers: iniciarSesion(app, escenario.maria),
    });

    const actaPortal = await portal('GET', `/portal/entregas/${entregaAceptada}/acta.pdf`);
    const reportePortal = await portal('GET', `/portal/entregas/${entregaAceptada}/reporte.pdf`);

    expect(sha256(actaPortal.rawPayload)).toBe(sha256(actaApp.rawPayload));
    expect(sha256(reportePortal.rawPayload)).toBe(sha256(reporteApp.rawPayload));
    expect(contieneTexto(reportePortal.rawPayload, 'Reporte de avances')).toBe(true);
  });

  it('CP17-E9 de una entrega Enviada el cliente solo descarga el reporte', async () => {
    const reporte = await portal('GET', `/portal/entregas/${entregaEnviada}/reporte.pdf`);
    const acta = await portal('GET', `/portal/entregas/${entregaEnviada}/acta.pdf`);

    expect(reporte.statusCode).toBe(200);
    expect(acta.statusCode).toBe(409);
    expect(acta.json().mensaje).toBe('El acta se genera al aceptar la entrega');
  });

  it('CP17-A5 un trabajador no descarga documentos de la app', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `${rutaApp(entregaAceptada)}/reporte.pdf`,
      headers: iniciarSesion(app, escenario.ana),
    });

    expect(respuesta.statusCode).toBe(403);
  });

  it('CP17-E10 una actividad terminada de una entrega aceptada no se puede modificar (RF-17)', async () => {
    const ruta = `/obras/${escenario.obra.id}/actividades/${terminada}`;
    const detalle = await app.inject({
      method: 'GET',
      url: ruta,
      headers: iniciarSesion(app, escenario.maria),
    });
    expect(detalle.json().actividad.bloqueada).toBe(true);

    const reabrir = await app.inject({
      method: 'PATCH',
      url: `${ruta}/estado`,
      headers: iniciarSesion(app, escenario.maria),
      payload: { estado: 'ACTIVA' },
    });
    expect(reabrir.statusCode).toBe(409);
    expect(reabrir.json().motivo).toBe('ENTREGA_ACEPTADA');

    const subir = await app.inject({
      method: 'POST',
      url: `${ruta}/avances`,
      headers: {
        ...iniciarSesion(app, escenario.maria),
        'content-type': 'image/png',
        'x-latitud': '32.6245',
        'x-longitud': '-115.4523',
      },
      payload: Buffer.from('foto'),
    });
    expect(subir.statusCode).toBe(409);
  });

  it('CP17-A6 una actividad en curso de una entrega parcial aceptada sigue recibiendo avances (D-31)', async () => {
    const ruta = `/obras/${escenario.obra.id}/actividades/${enCurso}`;
    const detalle = await app.inject({
      method: 'GET',
      url: ruta,
      headers: iniciarSesion(app, escenario.maria),
    });
    expect(detalle.json().actividad.bloqueada).toBe(false);

    const subir = await app.inject({
      method: 'POST',
      url: `${ruta}/avances`,
      headers: {
        ...iniciarSesion(app, escenario.maria),
        'content-type': 'image/png',
        'x-latitud': '32.6245',
        'x-longitud': '-115.4523',
      },
      payload: Buffer.from('foto'),
    });
    expect(subir.statusCode).toBe(201);
  });
});
