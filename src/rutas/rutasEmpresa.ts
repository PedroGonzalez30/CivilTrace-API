/**
 * @archivo rutasEmpresa.ts
 * @proyecto Civil Trace
 * @descripcion Rutas /empresa: datos de la empresa del usuario (solo dueño).
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import { Rol } from '@/generated/prisma/enums';
import { exigirRol, verificarToken } from '@/middleware/autenticacion';
import { obtenerCodigosEmpresa,  obtenerPersonalEmpresa, eliminarPersonalEmpresa, } from '@/servicios/servicioEmpresa';
import { esquemaIdPersona } from '@/esquemas/esquemasEmpresa';
import { validar } from '@/utilidades/validar';

// 3. Constantes del módulo
const CODIGO_SIN_CONTENIDO = 204;

// 4. Función principal
/**
 * Registra las rutas de empresa (el prefijo /empresa lo pone quien las registra).
 *
 * @param app - Instancia de Fastify donde se registran las rutas.
 */
export async function rutasEmpresa(app: FastifyInstance): Promise<void> {
  app.get(
    '/codigos',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)] },
    async (peticion) => ({
      codigos: await obtenerCodigosEmpresa(peticion.user.empresaId),
    }),
  );
    app.get(
    '/personal',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)] },
    async (peticion) => ({
      personal: await obtenerPersonalEmpresa(peticion.user.empresaId),
    }),
  );
  app.delete(
    '/personal/:idPersona',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)] },
    async (peticion, respuesta) => {
      const { idPersona } = validar(esquemaIdPersona, peticion.params);
      await eliminarPersonalEmpresa(peticion.user.empresaId, idPersona);
      return respuesta.status(CODIGO_SIN_CONTENIDO).send();
    },
  );
}