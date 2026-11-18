/**
 * @archivo rutasObras.ts
 * @proyecto Civil Trace
 * @descripcion Rutas /obras: consultar las obras de la empresa y crear una nueva (solo dueño).
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import { esquemaCrearObra } from '@/esquemas/esquemasObra';
import { Rol } from '@/generated/prisma/enums';
import { exigirRol, verificarToken } from '@/middleware/autenticacion';
import { crearObra, listarObras } from '@/servicios/servicioObras';
import { validar } from '@/utilidades/validar';

// 3. Constantes del módulo
const CODIGO_CREADO = 201;

// 4. Función principal
/**
 * Registra las rutas de obras (el prefijo /obras lo pone quien las registra).
 *
 * @param app - Instancia de Fastify donde se registran las rutas.
 */
export async function rutasObras(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: [verificarToken] }, async (peticion) => ({
    obras: await listarObras(peticion.user.empresaId),
  }));

  app.post(
    '/',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)] },
    async (peticion, respuesta) => {
      const datos = validar(esquemaCrearObra, peticion.body);
      const obra = await crearObra(peticion.user.empresaId, datos);
      return respuesta.status(CODIGO_CREADO).send({ obra });
    },
  );
}