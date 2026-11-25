/**
 * @archivo portalCliente.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas de los avances que ve el cliente en el portal: actividades con su estado y
 *   solo las fotos aprobadas, sin datos de otras obras ni de otras empresas (historia 2 del
 *   feature 004).
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-66 Consultar avances en el portal del cliente
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import { imagenesEnMemoria } from '../configuracion/dobleAlmacenamiento';
import {
  construirAppPrueba,
  crearActividad,
  crearAvance,
  crearEnlacePortal,
  crearEscenarioBase,
  crearObra,
} from '../configuracion/fabricas';

// 2. Tipos e interfaces
interface FotoRespuesta {
  id: string;
  fechaRegistro: string;
}

interface ActividadRespuesta {
  nombre: string;
  estado: string;
  fotos: FotoRespuesta[];
}

// 3. Constantes del módulo
const FOTO = Buffer.from('foto-aprobada');

// 4. Pruebas
describe('Avances en el portal del cliente (RF-66)', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
  let token: string;
  let idsAprobados: string[];
  let idsNoVisibles: string[];

  beforeAll(async () => {
    await limpiarTablas();
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    const { obra, empresa } = escenario;
    token = await crearEnlacePortal(obra);

    // 4 actividades y 10 fotos: 8 aprobadas, 1 rechazada y 1 pendiente de revisión.
    const nombres = ['Cimentación', 'Muros', 'Pisos y puertas', 'Baños'];
    const actividades = [];
    for (const [indice, nombre] of nombres.entries()) {
      actividades.push(
        await crearActividad({
          obraId: obra.id,
          empresaId: empresa.id,
          nombre,
          fechaEntrega: `2026-11-0${indice + 2}`,
          estado: indice === 0 ? 'TERMINADA' : 'ACTIVA',
        }),
      );
    }
    idsAprobados = [];
    idsNoVisibles = [];
    for (const [indice, actividad] of actividades.entries()) {
      for (const dia of [1, 2]) {
        const avance = await crearAvance({
          actividadId: actividad.id,
          empresaId: empresa.id,
          fechaRegistro: new Date(`2026-11-0${dia + indice}T1${dia}:00:00Z`),
        });
        imagenesEnMemoria.set(avance.fotoBlob, { datos: FOTO, tipo: 'image/jpeg' });
        idsAprobados.push(avance.id);
      }
    }
    for (const estado of ['RECHAZADO', 'PENDIENTE'] as const) {
      const avance = await crearAvance({
        actividadId: actividades[1]!.id,
        empresaId: empresa.id,
        estado,
      });
      imagenesEnMemoria.set(avance.fotoBlob, { datos: FOTO, tipo: 'image/jpeg' });
      idsNoVisibles.push(avance.id);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const consultar = (url: string, tokenPortal = token) =>
    app.inject({ method: 'GET', url, headers: { 'x-token-portal': tokenPortal } });

  it('CP16-PORTAL-E5 muestra las 4 actividades con su estado y solo las 8 fotos aprobadas', async () => {
    const respuesta = await consultar('/portal/avances');

    expect(respuesta.statusCode).toBe(200);
    const actividades = respuesta.json<ActividadRespuesta[]>();
    expect(actividades.map((actividad) => actividad.nombre)).toEqual([
      'Cimentación',
      'Muros',
      'Pisos y puertas',
      'Baños',
    ]);
    expect(actividades[0]?.estado).toBe('TERMINADA');
    const fotos = actividades.flatMap((actividad) => actividad.fotos);
    expect(fotos.map((foto) => foto.id).sort()).toEqual([...idsAprobados].sort());
    for (const actividad of actividades) {
      const fechas = actividad.fotos.map((foto) => foto.fechaRegistro);
      expect(fechas).toEqual([...fechas].sort());
    }
  });

  it('CP16-PORTAL-E6 una obra sin fotos aprobadas no muestra avances', async () => {
    const obraVacia = await crearObra({
      empresaId: escenario.empresa.id,
      supervisorId: escenario.maria.id,
      nombre: 'Obra sin avances',
    });
    const tokenVacio = await crearEnlacePortal(obraVacia, 'otro@ejemplo.com');

    const respuesta = await consultar('/portal/avances', tokenVacio);

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual([]);
  });

  it('CP16-PORTAL-E7 las fotos pendientes o rechazadas no se pueden descargar', async () => {
    for (const id of idsNoVisibles) {
      const respuesta = await consultar(`/portal/fotos/${id}`);
      expect(respuesta.statusCode).toBe(404);
    }
    const aprobada = await consultar(`/portal/fotos/${idsAprobados[0]}`);
    expect(aprobada.statusCode).toBe(200);
    expect(aprobada.headers['content-type']).toBe('image/jpeg');
    expect(aprobada.rawPayload.equals(FOTO)).toBe(true);
  });

  it('CP16-PORTAL-A7 el enlace de otra obra u otra empresa no descarga fotos de esta obra (SC-003)', async () => {
    const obraAjena = await crearObra({ empresaId: escenario.otraEmpresa.id, supervisorId: null });
    const tokenAjeno = await crearEnlacePortal(obraAjena, 'ajeno@ejemplo.com');

    const avances = await consultar('/portal/avances', tokenAjeno);
    expect(avances.json()).toEqual([]);
    const foto = await consultar(`/portal/fotos/${idsAprobados[0]}`, tokenAjeno);
    expect(foto.statusCode).toBe(404);
    expect(foto.rawPayload.equals(FOTO)).toBe(false);
  });
});
