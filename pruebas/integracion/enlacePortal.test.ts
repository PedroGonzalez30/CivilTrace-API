/**
 * @archivo enlacePortal.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del enlace permanente del portal: se envía al registrar la obra, se puede
 *   reenviar y abre el portal de esa obra (historia 1 del feature 004).
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente
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
  crearEscenarioBase,
  crearObra,
  iniciarSesion,
} from '../configuracion/fabricas';

// 3. Constantes del módulo
const CORREO_CLIENTE = 'cliente.hospital@ejemplo.com';
const OBRA_NUEVA = {
  nombre: 'Hospital Norte',
  descripcion: 'Construcción del hospital general norte',
  cliente: 'Secretaría de Salud',
  correoCliente: CORREO_CLIENTE,
  direccion: 'Av. Principal 123',
  fechaInicio: '2026-12-01',
  fechaFinal: '2027-06-30',
};

// 4. Pruebas
describe('Enlace permanente del portal (RF-65)', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

  beforeAll(async () => {
    await limpiarTablas();
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
  });

  beforeEach(() => {
    restaurarCorreo();
  });

  afterAll(async () => {
    restaurarCorreo();
    await app.close();
  });

  async function registrarObra(correoCliente = CORREO_CLIENTE) {
    return app.inject({
      method: 'POST',
      url: '/obras',
      headers: iniciarSesion(app, escenario.dueno),
      payload: { ...OBRA_NUEVA, correoCliente, supervisorId: escenario.maria.id },
    });
  }

  async function abrirPortal(token: string | undefined) {
    return app.inject({
      method: 'GET',
      url: '/portal/obra',
      headers: token === undefined ? {} : { 'x-token-portal': token },
    });
  }

  it('CP16-PORTAL-E1 al registrar la obra el cliente recibe el enlace y entra sin cuenta', async () => {
    const respuesta = await registrarObra();

    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json().enlacePortal).toBe('ENVIADO');
    const correo = obtenerUltimoCorreo(CORREO_CLIENTE);
    expect(correo?.texto).toContain('https://portal.prueba/#/o/');
    expect(correo?.html).toContain('https://portal.prueba/#/o/');

    const portal = await abrirPortal(extraerTokenPortal(correo));
    expect(portal.statusCode).toBe(200);
    expect(portal.json()).toMatchObject({
      nombre: OBRA_NUEVA.nombre,
      cliente: OBRA_NUEVA.cliente,
      direccion: OBRA_NUEVA.direccion,
      fechaInicio: OBRA_NUEVA.fechaInicio,
      fechaFinal: OBRA_NUEVA.fechaFinal,
      empresa: { nombre: escenario.empresa.nombre, tieneLogo: false },
    });
  });

  it('CP16-PORTAL-E2 un enlace alterado, vacío o que no existe no muestra ninguna obra', async () => {
    await registrarObra();
    const token = extraerTokenPortal(obtenerUltimoCorreo(CORREO_CLIENTE)) ?? '';
    const alterado = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;

    for (const intento of [alterado, '', 'x'.repeat(500), undefined]) {
      const respuesta = await abrirPortal(intento);
      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.json().mensaje).toBe(
        'Este enlace no es válido. Pide uno nuevo a tu supervisor.',
      );
      expect(respuesta.body).not.toContain(OBRA_NUEVA.nombre);
    }
  });

  it('CP16-PORTAL-E3 una obra registrada antes del portal recibe su enlace al reenviarlo', async () => {
    const obraAnterior = await crearObra({
      empresaId: escenario.empresa.id,
      supervisorId: escenario.maria.id,
      nombre: 'Bodega Sur',
    });
    await prisma.obra.update({
      where: { id: obraAnterior.id },
      data: { correoCliente: 'bodega@ejemplo.com' },
    });

    const respuesta = await app.inject({
      method: 'POST',
      url: `/obras/${obraAnterior.id}/enlace-portal/reenviar`,
      headers: iniciarSesion(app, escenario.dueno),
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ enlacePortal: 'ENVIADO' });
    const portal = await abrirPortal(extraerTokenPortal(obtenerUltimoCorreo('bodega@ejemplo.com')));
    expect(portal.json().nombre).toBe('Bodega Sur');
  });

  it('CP16-PORTAL-E4 si el correo falla la obra se guarda y el enlace se puede reenviar', async () => {
    simularFalloCorreo();
    const respuesta = await registrarObra('falla@ejemplo.com');

    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json().enlacePortal).toBe('FALLIDO');
    const obraId: string = respuesta.json().obra.id;
    const enlace = await prisma.enlacePortal.findUnique({ where: { obraId } });
    expect(enlace?.estadoEnvio).toBe('FALLIDO');

    restaurarCorreo();
    const reenvio = await app.inject({
      method: 'POST',
      url: `/obras/${obraId}/enlace-portal/reenviar`,
      headers: iniciarSesion(app, escenario.dueno),
    });
    expect(reenvio.json()).toEqual({ enlacePortal: 'ENVIADO' });
    expect(extraerTokenPortal(obtenerUltimoCorreo('falla@ejemplo.com'))).toBeDefined();
  });

  it('CP16-PORTAL-A4 reenviar manda el mismo enlace permanente', async () => {
    const obraId: string = (await registrarObra('mismo@ejemplo.com')).json().obra.id;
    const primero = extraerTokenPortal(obtenerUltimoCorreo('mismo@ejemplo.com'));

    await app.inject({
      method: 'POST',
      url: `/obras/${obraId}/enlace-portal/reenviar`,
      headers: iniciarSesion(app, escenario.dueno),
    });

    expect(extraerTokenPortal(obtenerUltimoCorreo('mismo@ejemplo.com'))).toBe(primero);
    expect(primero).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const enlace = await prisma.enlacePortal.findUnique({ where: { obraId } });
    expect(enlace?.tokenHash).not.toContain(primero ?? '');
    expect(enlace?.tokenCifrado).not.toContain(primero ?? '');
  });

  it('CP16-PORTAL-A5 si cambia el correo del cliente el enlace anterior deja de funcionar (P-12)', async () => {
    const obraId: string = (await registrarObra('viejo@ejemplo.com')).json().obra.id;
    const anterior = extraerTokenPortal(obtenerUltimoCorreo('viejo@ejemplo.com'));
    await prisma.obra.update({
      where: { id: obraId },
      data: { correoCliente: 'nuevo@ejemplo.com' },
    });

    await app.inject({
      method: 'POST',
      url: `/obras/${obraId}/enlace-portal/reenviar`,
      headers: iniciarSesion(app, escenario.dueno),
    });

    const nuevo = extraerTokenPortal(obtenerUltimoCorreo('nuevo@ejemplo.com'));
    expect(nuevo).toBeDefined();
    expect(nuevo).not.toBe(anterior);
    expect((await abrirPortal(anterior)).statusCode).toBe(404);
    expect((await abrirPortal(nuevo)).statusCode).toBe(200);
  });

  it('CP16-PORTAL-A6 solo el dueño de la empresa reenvía y la obra debe tener correo', async () => {
    const obraId: string = (await registrarObra()).json().obra.id;
    const ruta = `/obras/${obraId}/enlace-portal/reenviar`;

    const supervisor = await app.inject({
      method: 'POST',
      url: ruta,
      headers: iniciarSesion(app, escenario.maria),
    });
    expect(supervisor.statusCode).toBe(403);

    const otraEmpresa = await app.inject({
      method: 'POST',
      url: `/obras/${obraId}/enlace-portal/reenviar`,
      headers: iniciarSesion(app, { ...escenario.dueno, empresaId: escenario.otraEmpresa.id }),
    });
    expect(otraEmpresa.statusCode).toBe(404);

    await prisma.obra.update({ where: { id: obraId }, data: { correoCliente: null } });
    const sinCorreo = await app.inject({
      method: 'POST',
      url: ruta,
      headers: iniciarSesion(app, escenario.dueno),
    });
    expect(sinCorreo.statusCode).toBe(400);
    expect(sinCorreo.json().motivo).toBe('SIN_CORREO_CLIENTE');
  });
});
