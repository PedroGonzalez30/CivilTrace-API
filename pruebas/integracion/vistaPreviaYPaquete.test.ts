/**
 * @archivo vistaPreviaYPaquete.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas de la confirmación del escaneo (vista previa), del paquete para trabajar
 *   sin conexión, de la lista de obras del supervisor y de la foto del trabajador.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-27 Registrar asistencia por el supervisor, RNF-07 Captura sin conexión
 *   (D-14), D-17, D-18
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '@/baseDatos/clientePrisma';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import { imagenesEnMemoria } from '../configuracion/dobleAlmacenamiento';
import {
  construirAppPrueba,
  crearEscenarioBase,
  crearHorario,
  crearObra,
  crearUsuario,
  iniciarSesion,
} from '../configuracion/fabricas';

// 3. Constantes del módulo
const BLOB_FOTO_ANA = 'empresa/perfiles/ana.jpg';
const BYTES_FOTO = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

// 4. Pruebas
describe('Vista previa, paquete sin conexión, mis obras y foto', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
  let qrAna: string;

  const vistaPrevia = (
    codigoQr: string,
    usuario = escenario.maria as {
      id: string;
      rol: 'DUENO' | 'SUPERVISOR' | 'TRABAJADOR';
      empresaId: string | null;
    },
  ) =>
    app.inject({
      method: 'POST',
      url: `/obras/${escenario.obra.id}/asistencia/vista-previa`,
      headers: iniciarSesion(app, usuario),
      payload: { codigoQr },
    });

  beforeAll(async () => {
    await limpiarTablas();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T16:02:00Z'));
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    await prisma.usuario.update({
      where: { id: escenario.ana.id },
      data: { oficio: 'Albañil', fotoBlob: BLOB_FOTO_ANA },
    });
    imagenesEnMemoria.set(BLOB_FOTO_ANA, { datos: BYTES_FOTO, tipo: 'image/jpeg' });
    await crearHorario({
      obraId: escenario.obra.id,
      empresaId: escenario.empresa.id,
      creadoPorId: escenario.maria.id,
    });
    qrAna = (
      await app.inject({
        method: 'GET',
        url: '/asistencia/mi-credencial',
        headers: iniciarSesion(app, escenario.ana),
      })
    ).json().codigoQr;
  });

  afterAll(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('CP21-A22 la vista previa muestra al trabajador sin guardar nada', async () => {
    const respuesta = await vistaPrevia(qrAna);

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      tipo: 'ENTRADA',
      trabajador: {
        id: escenario.ana.id,
        nombre: 'Ana Sánchez',
        oficio: 'Albañil',
        fotoUrl: `/obras/${escenario.obra.id}/asistencia/trabajadores/${escenario.ana.id}/foto`,
        faltasMes: expect.any(Number),
      },
    });
    expect(await prisma.registroAsistencia.count()).toBe(0);
  });

  it('CP21-A23 la vista previa rechaza QR inválidos o de trabajadores no asignados con 422', async () => {
    const invalido = await vistaPrevia('ct1.noexiste');
    expect(invalido.statusCode).toBe(422);
    expect(invalido.json()).toMatchObject({ motivo: 'QR_INVALIDO' });

    const noAsignado = await crearUsuario({ rol: 'TRABAJADOR', empresaId: escenario.empresa.id });
    const qrNoAsignado = (
      await app.inject({
        method: 'GET',
        url: '/asistencia/mi-credencial',
        headers: iniciarSesion(app, noAsignado),
      })
    ).json().codigoQr;
    const respuesta = await vistaPrevia(qrNoAsignado);
    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toMatchObject({ motivo: 'NO_ASIGNADO' });
  });

  it('CP21-A24 solo el supervisor de la obra usa la vista previa', async () => {
    expect((await vistaPrevia(qrAna, escenario.dueno)).statusCode).toBe(403);
    expect((await vistaPrevia(qrAna, escenario.ana)).statusCode).toBe(403);
  });

  it('CP21-A25 el paquete sin conexión trae la huella del QR, nunca el QR', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `/obras/${escenario.obra.id}/asistencia/paquete-sin-conexion`,
      headers: iniciarSesion(app, escenario.maria),
    });

    expect(respuesta.statusCode).toBe(200);
    const paquete = respuesta.json();
    const tokenAna = qrAna.slice('ct1.'.length);
    const huellaEsperada = createHash('sha256').update(tokenAna).digest('hex');
    expect(paquete.zonaHoraria).toBe('America/Tijuana');
    expect(paquete.horario.general).toMatchObject({ horaEntrada: '08:00', horaSalida: '16:00' });
    expect(paquete.trabajadores).toContainEqual(
      expect.objectContaining({ id: escenario.ana.id, huellaCredencial: huellaEsperada }),
    );
    expect(respuesta.body).not.toContain(tokenAna);
  });

  it('CP21-A26 el paquete crea la credencial de quien todavía no abrió su QR', async () => {
    const nuevo = await crearUsuario({ rol: 'TRABAJADOR', empresaId: escenario.empresa.id });
    await prisma.obra.update({
      where: { id: escenario.obra.id },
      data: { trabajadores: { connect: { id: nuevo.id } } },
    });
    const respuesta = await app.inject({
      method: 'GET',
      url: `/obras/${escenario.obra.id}/asistencia/paquete-sin-conexion`,
      headers: iniciarSesion(app, escenario.maria),
    });
    const trabajador = respuesta.json().trabajadores.find((t: { id: string }) => t.id === nuevo.id);

    expect(trabajador.huellaCredencial).toMatch(/^[0-9a-f]{64}$/);
  });

  it('CP21-A27 un supervisor de otra obra no recibe el paquete', async () => {
    const otro = await crearUsuario({ rol: 'SUPERVISOR', empresaId: escenario.empresa.id });
    const respuesta = await app.inject({
      method: 'GET',
      url: `/obras/${escenario.obra.id}/asistencia/paquete-sin-conexion`,
      headers: iniciarSesion(app, otro),
    });
    expect(respuesta.statusCode).toBe(403);
  });

  it('CP21-A28 mis obras devuelve solo las obras que supervisa', async () => {
    const otro = await crearUsuario({ rol: 'SUPERVISOR', empresaId: escenario.empresa.id });
    await crearObra({
      empresaId: escenario.empresa.id,
      supervisorId: otro.id,
      nombre: 'Departamentos',
    });
    const respuesta = await app.inject({
      method: 'GET',
      url: '/asistencia/mis-obras',
      headers: iniciarSesion(app, escenario.maria),
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().obras).toEqual([
      expect.objectContaining({
        id: escenario.obra.id,
        nombre: 'Hospital',
        fechaInicio: '2026-01-01',
      }),
    ]);
  });

  it('CP21-A29 la foto del trabajador se sirve por la API al supervisor', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `/obras/${escenario.obra.id}/asistencia/trabajadores/${escenario.ana.id}/foto`,
      headers: iniciarSesion(app, escenario.maria),
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.headers['content-type']).toContain('image/jpeg');
    expect(respuesta.rawPayload).toEqual(BYTES_FOTO);

    const sinFoto = await app.inject({
      method: 'GET',
      url: `/obras/${escenario.obra.id}/asistencia/trabajadores/${escenario.maria.id}/foto`,
      headers: iniciarSesion(app, escenario.maria),
    });
    expect(sinFoto.statusCode).toBe(404);
  });
});
