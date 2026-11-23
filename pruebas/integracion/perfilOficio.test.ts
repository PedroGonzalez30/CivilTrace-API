/**
 * @archivo perfilOficio.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del oficio del trabajador en su perfil (D-18): se guarda, se consulta, se
 *   conserva si no se envía y se borra con texto vacío.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos D-18 (oficio en el perfil), FR-025a del feature 001
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import { construirAppPrueba, crearEscenarioBase, iniciarSesion } from '../configuracion/fabricas';

// 4. Pruebas
describe('Oficio en el perfil', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

  const actualizar = (cambios: Record<string, unknown>) =>
    app.inject({
      method: 'PUT',
      url: '/perfil',
      headers: iniciarSesion(app, escenario.ana),
      payload: {
        nombre: 'Ana Sánchez',
        correo: 'ana.sanchez@ejemplo.com',
        telefono: '',
        ...cambios,
      },
    });

  beforeAll(async () => {
    await limpiarTablas();
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('CP06-A1 el trabajador guarda su oficio y lo consulta', async () => {
    const respuesta = await actualizar({ oficio: '  Albañil ' });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().perfil.oficio).toBe('Albañil');

    const perfil = await app.inject({
      method: 'GET',
      url: '/perfil',
      headers: iniciarSesion(app, escenario.ana),
    });
    expect(perfil.json().perfil.oficio).toBe('Albañil');
  });

  it('CP06-A2 si no se envía el oficio se conserva (apps anteriores no lo mandan)', async () => {
    const respuesta = await actualizar({});
    expect(respuesta.json().perfil.oficio).toBe('Albañil');
  });

  it('CP06-A3 un texto vacío borra el oficio y uno de más de 60 caracteres se rechaza', async () => {
    expect((await actualizar({ oficio: '' })).json().perfil.oficio).toBeNull();
    const largo = await actualizar({ oficio: 'x'.repeat(61) });
    expect(largo.statusCode).toBe(400);
  });
});
