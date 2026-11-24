/**
 * @archivo permisosObra.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas de pertenencia y rol sobre una obra (aislamiento por empresa).
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-27 Registrar asistencia por el supervisor, constitución IV.2
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import { beforeAll, describe, expect, it } from 'vitest';

import type { DatosTokenAcceso } from '@/tipos/fastifyJwt';
import {
  estaAsignadoAObra,
  exigirAccesoAObra,
  exigirSupervisorDeObra,
  exigirSupervisorODueno,
  obtenerObraDeEmpresa,
} from '@/utilidades/permisosObra';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import { crearEscenarioBase, crearUsuario } from '../configuracion/fabricas';

// 4. Pruebas
describe('permisosObra', () => {
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
  const token = (usuario: { id: string; rol: string; empresaId: string | null }) =>
    ({ sub: usuario.id, rol: usuario.rol, empresaId: usuario.empresaId ?? '' }) as DatosTokenAcceso;

  beforeAll(async () => {
    await limpiarTablas();
    escenario = await crearEscenarioBase();
  });

  it('CP21-A10 una obra de otra empresa responde 404 sin revelar que existe', async () => {
    await expect(
      obtenerObraDeEmpresa(escenario.obra.id, escenario.otraEmpresa.id),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('CP21-A11 solo el supervisor de la obra pasa exigirSupervisorDeObra', async () => {
    const obra = await obtenerObraDeEmpresa(escenario.obra.id, escenario.empresa.id);
    const otroSupervisor = await crearUsuario({
      rol: 'SUPERVISOR',
      empresaId: escenario.empresa.id,
    });

    expect(() => exigirSupervisorDeObra(obra, token(escenario.maria))).not.toThrow();
    expect(() => exigirSupervisorDeObra(obra, token(otroSupervisor))).toThrow();
    expect(() => exigirSupervisorDeObra(obra, token(escenario.dueno))).toThrow();
    expect(() => exigirSupervisorODueno(obra, token(escenario.dueno))).not.toThrow();
    expect(() => exigirSupervisorODueno(obra, token(otroSupervisor))).toThrow();
  });

  it('CP21-A12 un trabajador solo accede a las obras en las que está asignado', async () => {
    const obra = await obtenerObraDeEmpresa(escenario.obra.id, escenario.empresa.id);
    const otroTrabajador = await crearUsuario({
      rol: 'TRABAJADOR',
      empresaId: escenario.empresa.id,
    });

    expect(await estaAsignadoAObra(escenario.ana.id, obra.id)).toBe(true);
    await expect(exigirAccesoAObra(obra, token(escenario.ana))).resolves.toBeUndefined();
    await expect(exigirAccesoAObra(obra, token(otroTrabajador))).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
