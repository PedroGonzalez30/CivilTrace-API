/**
 * @archivo rutasPortal.ts
 * @proyecto Civil Trace
 * @descripcion Rutas públicas /portal del portal web del cliente. No usan JWT: se autorizan con el
 *   token del enlace de la obra (X-Token-Portal) y tienen su propio límite de peticiones.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-66 Consultar avances en el portal
 *   del cliente, RF-67 Consultar entregas en el portal del cliente
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import { MAXIMO_PETICIONES_PORTAL_POR_MINUTO } from '@/constantes/portal';
import { esquemaParametrosFotoPortal } from '@/esquemas/esquemasPortal';
import { obtenerAccesoPortal, verificarTokenPortal } from '@/middleware/tokenPortal';
import {
  listarAvancesPortal,
  obtenerFotoPortal,
  obtenerObraPortal,
} from '@/servicios/servicioPortal';
import { validar } from '@/utilidades/validar';

// 3. Constantes del módulo
/** Opciones comunes: token del enlace y límite propio por IP (research R-09). */
export const OPCIONES_RUTA_PORTAL = {
  preHandler: [verificarTokenPortal],
  config: { rateLimit: { max: MAXIMO_PETICIONES_PORTAL_POR_MINUTO, timeWindow: '1 minute' } },
};

// 4. Función principal
export async function rutasPortal(app: FastifyInstance): Promise<void> {
  app.get('/obra', OPCIONES_RUTA_PORTAL, async (peticion) =>
    obtenerObraPortal(obtenerAccesoPortal(peticion)),
  );

  app.get('/avances', OPCIONES_RUTA_PORTAL, async (peticion) =>
    listarAvancesPortal(obtenerAccesoPortal(peticion)),
  );

  app.get('/fotos/:idAvance', OPCIONES_RUTA_PORTAL, async (peticion, respuesta) => {
    const { idAvance } = validar(esquemaParametrosFotoPortal, peticion.params);
    const foto = await obtenerFotoPortal(obtenerAccesoPortal(peticion), idAvance);
    // Privado: la foto no debe quedar en cachés compartidas (constitución IV.4).
    return respuesta
      .header('Cache-Control', 'private, max-age=300')
      .type(foto.tipo)
      .send(foto.datos);
  });
}
