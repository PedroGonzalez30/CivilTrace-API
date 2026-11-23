/**
 * @archivo salud.test.ts
 * @proyecto Civil Trace
 * @descripcion Prueba humo: confirma que la infraestructura de pruebas levanta la app y responde.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos Constitución III (pruebas primero)
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (módulo 00)
 */

// 1. Importaciones
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { construirAppPrueba } from '../configuracion/fabricas';

// 4. Pruebas
describe('Salud de la API', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;

  beforeAll(async () => {
    app = await construirAppPrueba();
  });

  afterAll(async () => {
    await app.close();
  });

  it('M00-A1 responde estado ok en /salud', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/salud' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ estado: 'ok' });
  });
});
