/**
 * @archivo correccionesRevision.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas de las correcciones de la revisión del equipo: el supervisor consulta solo
 *   el código de trabajadores (D-23), toda la empresa ve su logotipo (D-25) y una obra nueva
 *   exige supervisor (D-24).
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos D-23, D-24, D-25 (feature 002)
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 002)
 */

// 1. Importaciones
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import '../configuracion/dobleAlmacenamiento';
import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import { construirAppPrueba, crearEscenarioBase, iniciarSesion } from '../configuracion/fabricas';

// 3. Constantes del módulo
const OBRA_NUEVA = {
  nombre: 'Puente Norte',
  descripcion: 'Construcción del puente peatonal norte',
  cliente: 'Municipio',
  correoCliente: 'obras@municipio.com',
  direccion: 'Av. Principal 123',
  fechaInicio: '2026-12-01',
  fechaFinal: '2027-06-30',
};

// 4. Pruebas
describe('Correcciones de la revisión (feature 002)', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

  beforeAll(async () => {
    await limpiarTablas();
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('CP04-A10 el supervisor recibe solo el código de trabajadores', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/empresa/codigos',
      headers: iniciarSesion(app, escenario.maria),
    });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().codigos).toEqual({
      trabajadores: escenario.empresa.codigoTrabajadores,
    });
  });

  it('CP04-A11 el dueño sigue recibiendo los dos códigos y el trabajador no tiene acceso', async () => {
    const dueno = await app.inject({
      method: 'GET',
      url: '/empresa/codigos',
      headers: iniciarSesion(app, escenario.dueno),
    });
    expect(dueno.json().codigos).toEqual({
      trabajadores: escenario.empresa.codigoTrabajadores,
      supervisores: escenario.empresa.codigoSupervisores,
    });
    const trabajador = await app.inject({
      method: 'GET',
      url: '/empresa/codigos',
      headers: iniciarSesion(app, escenario.ana),
    });
    expect(trabajador.statusCode).toBe(403);
  });

  it('CP04-A12 el supervisor no puede regenerar códigos', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/empresa/codigos/trabajadores/regenerar',
      headers: iniciarSesion(app, escenario.maria),
    });
    expect(respuesta.statusCode).toBe(403);
  });

  it('CP05-A10 supervisor y trabajador ven el logotipo de su empresa', async () => {
    const sinLogo = await app.inject({
      method: 'GET',
      url: '/empresa/logo',
      headers: iniciarSesion(app, escenario.ana),
    });
    expect(sinLogo.statusCode).toBe(404);

    const subida = await app.inject({
      method: 'POST',
      url: '/empresa/logo',
      headers: { ...iniciarSesion(app, escenario.dueno), 'content-type': 'image/png' },
      payload: Buffer.from('logo'),
    });
    expect(subida.statusCode).toBe(204);

    for (const usuario of [escenario.maria, escenario.ana]) {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/empresa/logo',
        headers: iniciarSesion(app, usuario),
      });
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.headers['content-type']).toContain('image/png');
    }
  });

  it('CP08-A10 crear una obra sin supervisor se rechaza con un mensaje claro', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/obras',
      headers: iniciarSesion(app, escenario.dueno),
      payload: OBRA_NUEVA,
    });
    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json().mensaje).toBe('Selecciona un supervisor para la obra');
  });

  it('CP08-A11 con supervisor de la empresa la obra se crea', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/obras',
      headers: iniciarSesion(app, escenario.dueno),
      payload: { ...OBRA_NUEVA, supervisorId: escenario.maria.id },
    });
    expect(respuesta.statusCode).toBe(201);
  });
});
