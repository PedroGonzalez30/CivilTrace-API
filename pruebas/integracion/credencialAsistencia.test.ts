/**
 * @archivo credencialAsistencia.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del QR permanente del trabajador (GET /asistencia/mi-credencial).
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-19 Registrar asistencia propia, D-17
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import { construirAppPrueba, crearEscenarioBase, iniciarSesion } from '../configuracion/fabricas';

// 4. Pruebas
describe('GET /asistencia/mi-credencial', () => {
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

  it('CP21-A4 el trabajador recibe siempre el mismo QR (D-17)', async () => {
    const encabezados = iniciarSesion(app, escenario.ana);
    const primera = await app.inject({
      method: 'GET',
      url: '/asistencia/mi-credencial',
      headers: encabezados,
    });
    const segunda = await app.inject({
      method: 'GET',
      url: '/asistencia/mi-credencial',
      headers: iniciarSesion(app, escenario.ana),
    });

    expect(primera.statusCode).toBe(200);
    expect(primera.json().codigoQr).toMatch(/^ct1\.[A-Za-z0-9_-]{43}$/);
    expect(segunda.json().codigoQr).toBe(primera.json().codigoQr);
  });

  it('CP21-A16 un supervisor o un dueño no tienen QR de asistencia', async () => {
    for (const usuario of [escenario.maria, escenario.dueno]) {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/asistencia/mi-credencial',
        headers: iniciarSesion(app, usuario),
      });
      expect(respuesta.statusCode).toBe(403);
    }
  });

  it('CP21-A17 sin sesión responde 401', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/asistencia/mi-credencial' });
    expect(respuesta.statusCode).toBe(401);
  });
});
