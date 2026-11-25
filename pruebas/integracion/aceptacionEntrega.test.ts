/**
 * @archivo aceptacionEntrega.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas de la respuesta del cliente desde el portal: código de un solo uso, aceptar
 *   con nombre y firma, y detalle de la entrega (historia 4 del feature 004).
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-14 Registrar aceptación de entrega, RF-60 Firmar aceptación de entrega,
 *   RF-67 Consultar entregas en el portal del cliente
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/baseDatos/clientePrisma';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import { imagenesEnMemoria } from '../configuracion/dobleAlmacenamiento';
import {
  extraerCodigo,
  extraerTokenPortal,
  obtenerUltimoCorreo,
  restaurarCorreo,
} from '../configuracion/dobleCorreo';
import {
  construirAppPrueba,
  crearActividad,
  crearAvance,
  crearEscenarioBase,
  crearObra,
  iniciarSesion,
} from '../configuracion/fabricas';

// 3. Constantes del módulo
const CORREO_CLIENTE = 'cliente.hospital@ejemplo.com';
const ENCABEZADO_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FIRMA = Buffer.concat([ENCABEZADO_PNG, randomBytes(200)]);
const NOMBRE = 'María Fernanda López Ruiz';

// 4. Pruebas
describe('Aceptar una entrega desde el portal (RF-14, RF-60)', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
  let actividadId: string;
  let token: string;
  let diaSiguiente = 1;

  beforeAll(async () => {
    await limpiarTablas();
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    await prisma.obra.update({
      where: { id: escenario.obra.id },
      data: { correoCliente: CORREO_CLIENTE },
    });
    actividadId = (
      await crearActividad({ obraId: escenario.obra.id, empresaId: escenario.empresa.id })
    ).id;
  });

  beforeEach(() => {
    restaurarCorreo();
  });

  afterAll(async () => {
    restaurarCorreo();
    await app.close();
  });

  /** Crea una foto aprobada en un día nuevo y envía ese día como entrega. */
  async function crearEntregaEnviada(): Promise<string> {
    const dia = String(diaSiguiente).padStart(2, '0');
    diaSiguiente += 1;
    await crearAvance({
      actividadId,
      empresaId: escenario.empresa.id,
      comentario: `Avance del día ${dia}`,
      fechaRegistro: new Date(`2026-11-${dia}T18:00:00Z`),
    });
    const respuesta = await app.inject({
      method: 'POST',
      url: `/obras/${escenario.obra.id}/entregas`,
      headers: iniciarSesion(app, escenario.maria),
      payload: { fechaInicio: `2026-11-${dia}`, fechaFin: `2026-11-${dia}` },
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

  async function pedirCodigo(entregaId: string): Promise<string> {
    const respuesta = await portal('POST', `/portal/entregas/${entregaId}/codigo`);
    expect(respuesta.statusCode).toBe(202);
    return extraerCodigo(obtenerUltimoCorreo(CORREO_CLIENTE)) ?? '';
  }

  const aceptar = (entregaId: string, codigo: string, extra: object = {}) =>
    portal('POST', `/portal/entregas/${entregaId}/aceptar`, {
      codigo,
      nombre: NOMBRE,
      firmaPng: FIRMA.toString('base64'),
      ...extra,
    });

  // Permite pedir otro código sin esperar el minuto real entre códigos.
  const envejecerCodigos = (entregaId: string) =>
    prisma.codigoEntrega.updateMany({
      where: { entregaId },
      data: { creadoEn: new Date(Date.now() - 2 * 60_000) },
    });

  it('CP17-E1 acepta con nombre, código y firma; guarda la firma con su SHA-256', async () => {
    const entregaId = await crearEntregaEnviada();

    const solicitud = await portal('POST', `/portal/entregas/${entregaId}/codigo`);
    expect(solicitud.statusCode).toBe(202);
    expect(solicitud.json().correo).toBe('cl***@ejemplo.com');
    const correo = obtenerUltimoCorreo(CORREO_CLIENTE);
    expect(correo?.asunto).toMatch(/^Tu código de Civil Trace: \d{6}$/);
    const codigo = extraerCodigo(correo) ?? '';

    const respuesta = await aceptar(entregaId, codigo);

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      id: entregaId,
      estado: 'ACEPTADA',
      nombreCliente: NOMBRE,
      tieneActa: true,
    });
    const guardada = await prisma.entrega.findUniqueOrThrow({ where: { id: entregaId } });
    expect(guardada.firmaSha256).toBe(createHash('sha256').update(FIRMA).digest('hex'));
    expect(imagenesEnMemoria.get(guardada.firmaBlob ?? '')?.datos.equals(FIRMA)).toBe(true);
    expect(guardada.respondidaEn).toBeInstanceOf(Date);
    const firma = await portal('GET', `/portal/entregas/${entregaId}/firma`);
    expect(firma.headers['content-type']).toBe('image/png');
  });

  it('CP17-E2 un código incorrecto o vencido no acepta y se puede pedir otro', async () => {
    const entregaId = await crearEntregaEnviada();
    const codigo = await pedirCodigo(entregaId);
    const incorrecto = codigo === '000000' ? '111111' : '000000';

    const fallo = await aceptar(entregaId, incorrecto);
    expect(fallo.statusCode).toBe(400);
    expect(fallo.json()).toMatchObject({
      motivo: 'CODIGO_INCORRECTO',
      mensaje: 'Código incorrecto. Te quedan 4 intentos',
    });

    await prisma.codigoEntrega.updateMany({
      where: { entregaId },
      data: { venceEn: new Date(Date.now() - 1000) },
    });
    const vencido = await aceptar(entregaId, codigo);
    expect(vencido.json().motivo).toBe('CODIGO_VENCIDO');

    await envejecerCodigos(entregaId);
    const nuevo = await pedirCodigo(entregaId);
    expect((await aceptar(entregaId, nuevo)).statusCode).toBe(200);
  });

  it('CP17-E3 al quinto intento fallido el código queda invalidado', async () => {
    const entregaId = await crearEntregaEnviada();
    const codigo = await pedirCodigo(entregaId);
    const incorrecto = codigo === '000000' ? '111111' : '000000';

    for (let intento = 1; intento <= 5; intento += 1) {
      expect((await aceptar(entregaId, incorrecto)).statusCode).toBe(400);
    }
    const correcto = await aceptar(entregaId, codigo);
    expect(correcto.statusCode).toBe(400);
    expect(correcto.json().motivo).toBe('CODIGO_VENCIDO');
  });

  it('CP17-E4 sin firma, con un archivo que no es PNG o muy grande no se acepta', async () => {
    const entregaId = await crearEntregaEnviada();
    const codigo = await pedirCodigo(entregaId);
    const firmasInvalidas = [
      '',
      Buffer.from('no es una imagen').toString('base64'),
      Buffer.concat([ENCABEZADO_PNG, Buffer.alloc(600 * 1024)]).toString('base64'),
    ];

    for (const firmaPng of firmasInvalidas) {
      const respuesta = await aceptar(entregaId, codigo, { firmaPng });
      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json().motivo).toBe('FIRMA_INVALIDA');
    }
    const sinNombre = await aceptar(entregaId, codigo, { nombre: 'A' });
    expect(sinNombre.statusCode).toBe(400);
    const entrega = await prisma.entrega.findUniqueOrThrow({ where: { id: entregaId } });
    expect(entrega.estado).toBe('ENVIADA');
  });

  it('CP17-E5 una entrega ya respondida no se puede volver a aceptar ni pedir código', async () => {
    const entregaId = await crearEntregaEnviada();
    const codigo = await pedirCodigo(entregaId);
    // Dos pestañas confirman al mismo tiempo: solo una gana.
    const [primera, segunda] = await Promise.all([
      aceptar(entregaId, codigo),
      aceptar(entregaId, codigo),
    ]);
    expect([primera.statusCode, segunda.statusCode].sort()).toEqual([200, 409]);

    expect((await aceptar(entregaId, codigo)).statusCode).toBe(409);
    await envejecerCodigos(entregaId);
    const otroCodigo = await portal('POST', `/portal/entregas/${entregaId}/codigo`);
    expect(otroCodigo.statusCode).toBe(409);
    expect(otroCodigo.json().motivo).toBe('ENTREGA_RESPONDIDA');
  });

  it('CP17-A2 no se puede pedir otro código antes de un minuto', async () => {
    const entregaId = await crearEntregaEnviada();
    await pedirCodigo(entregaId);

    const repetido = await portal('POST', `/portal/entregas/${entregaId}/codigo`);

    expect(repetido.statusCode).toBe(429);
  });

  it('CP17-A3 el detalle muestra la copia fija de actividades y fotos de la entrega', async () => {
    const entregaId = await crearEntregaEnviada();

    const detalle = await portal('GET', `/portal/entregas/${entregaId}`);

    expect(detalle.statusCode).toBe(200);
    const cuerpo = detalle.json();
    expect(cuerpo).toMatchObject({ id: entregaId, estado: 'ENVIADA', nombreCliente: null });
    expect(cuerpo.actividades).toHaveLength(1);
    expect(cuerpo.actividades[0]).toMatchObject({ nombre: 'Colocar loseta' });
    expect(cuerpo.actividades[0].fotos).toHaveLength(1);
    expect(cuerpo.actividades[0].fotos[0].comentario).toMatch(/^Avance del día/);
  });

  it('CP17-A4 el enlace de otra obra no ve ni responde esta entrega', async () => {
    const entregaId = await crearEntregaEnviada();
    const otraObra = await crearObra({
      empresaId: escenario.empresa.id,
      supervisorId: escenario.maria.id,
    });
    await prisma.obra.update({
      where: { id: otraObra.id },
      data: { correoCliente: 'otro@ejemplo.com' },
    });
    await app.inject({
      method: 'POST',
      url: `/obras/${otraObra.id}/enlace-portal/reenviar`,
      headers: iniciarSesion(app, escenario.dueno),
    });
    const tokenAjeno = extraerTokenPortal(obtenerUltimoCorreo('otro@ejemplo.com')) ?? '';

    for (const [metodo, ruta] of [
      ['GET', `/portal/entregas/${entregaId}`],
      ['POST', `/portal/entregas/${entregaId}/codigo`],
    ] as const) {
      const respuesta = await app.inject({
        method: metodo,
        url: ruta,
        headers: { 'x-token-portal': tokenAjeno },
      });
      expect(respuesta.statusCode).toBe(404);
    }
  });

  const observar = (entregaId: string, extra: object = {}) =>
    portal('POST', `/portal/entregas/${entregaId}/observaciones`, {
      observaciones: 'Las puertas del baño 2 no tienen chapa y falta sellar el piso del pasillo.',
      nombre: NOMBRE,
      firmaPng: FIRMA.toString('base64'),
      ...extra,
    });

  it('CP17-E11 el cliente registra observaciones con nombre y firma y el supervisor las ve', async () => {
    const entregaId = await crearEntregaEnviada();

    const respuesta = await observar(entregaId);

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      estado: 'CON_OBSERVACIONES',
      nombreCliente: NOMBRE,
      observaciones: expect.stringContaining('no tienen chapa'),
      tieneActa: false,
    });
    const lista = await app.inject({
      method: 'GET',
      url: `/obras/${escenario.obra.id}/entregas`,
      headers: iniciarSesion(app, escenario.maria),
    });
    const enApp = lista.json<{ id: string; observaciones: string | null }[]>();
    expect(enApp.find((entrega) => entrega.id === entregaId)?.observaciones).toContain('chapa');
    expect((await observar(entregaId)).statusCode).toBe(409);
  });

  it('CP17-E12 sin texto de observaciones no cambia el estado de la entrega', async () => {
    const entregaId = await crearEntregaEnviada();

    const vacio = await observar(entregaId, { observaciones: '   ' });
    const sinFirma = await observar(entregaId, { firmaPng: '' });

    expect(vacio.statusCode).toBe(400);
    expect(vacio.json().mensaje).toBe('Escribe qué debe corregirse');
    expect(sinFirma.json().motivo).toBe('FIRMA_INVALIDA');
    const entrega = await prisma.entrega.findUniqueOrThrow({ where: { id: entregaId } });
    expect(entrega.estado).toBe('ENVIADA');
  });

  it('CP17-E13 las fotos de una entrega con observaciones se pueden volver a enviar (P-15)', async () => {
    const entregaId = await crearEntregaEnviada();
    const entrega = await prisma.entrega.findUniqueOrThrow({ where: { id: entregaId } });
    await observar(entregaId);

    const reenvio = await app.inject({
      method: 'POST',
      url: `/obras/${escenario.obra.id}/entregas`,
      headers: iniciarSesion(app, escenario.maria),
      payload: {
        fechaInicio: entrega.fechaInicio.toISOString().slice(0, 10),
        fechaFin: entrega.fechaFin.toISOString().slice(0, 10),
      },
    });

    expect(reenvio.statusCode).toBe(201);
    expect(reenvio.json().fotos).toBe(1);
  });

  it('CP17-A5 comprobar el código antes de firmar no lo gasta y cuenta los intentos', async () => {
    const entregaId = await crearEntregaEnviada();
    const codigo = await pedirCodigo(entregaId);
    const incorrecto = codigo === '000000' ? '111111' : '000000';
    const comprobar = (valor: string) =>
      portal('POST', `/portal/entregas/${entregaId}/codigo/comprobar`, { codigo: valor });

    const fallo = await comprobar(incorrecto);
    expect(fallo.json()).toMatchObject({ motivo: 'CODIGO_INCORRECTO' });
    expect((await comprobar(codigo)).json()).toEqual({ valido: true });
    expect((await aceptar(entregaId, codigo)).statusCode).toBe(200);
  });
});
