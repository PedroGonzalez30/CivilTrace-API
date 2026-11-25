/**
 * @archivo rutasObras.ts
 * @proyecto Civil Trace
 * @descripcion Rutas /obras: consultar las obras de la empresa y crear una nueva (solo dueño).
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.1.0
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Envía el enlace del portal al crear la obra
 *   (feature 004, RF-65 Enviar enlace del portal al cliente)
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import { esquemaCrearObra } from '@/esquemas/esquemasObra';
import { Rol } from '@/generated/prisma/enums';
import { exigirRol, verificarToken } from '@/middleware/autenticacion';
import { enviarEnlacePortal } from '@/servicios/servicioEnlacePortal';
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
      // El correo sale después de guardar: si falla, la obra queda y la app ofrece reenviar (R-10).
      const enlacePortal = await enviarEnlacePortal({
        id: obra.id,
        empresaId: peticion.user.empresaId,
        nombre: datos.nombre,
        correoCliente: datos.correoCliente,
      });
      return respuesta.status(CODIGO_CREADO).send({ obra, enlacePortal });
    },
  );
}
